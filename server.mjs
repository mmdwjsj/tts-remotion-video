import { createServer } from "node:http";
import { spawn } from "node:child_process";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import { copyFile, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const port = Number(process.env.PORT || 3000);
const publicDir = resolve("public", "web");
const videoOutputDir = resolve("output", "web");
const audioOutputDir = resolve("output", "audio");
mkdirSync(videoOutputDir, { recursive: true });
mkdirSync(audioOutputDir, { recursive: true });
let bundlePromise;
const renderConcurrency = 2;
const videoJobs = new Map();
const ttsJobs = new Map();
const rankingJobs = new Map();
const sendJson = (res, status, value) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
};
const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
};
const safeBaseName = (value, fallback) =>
  String(value || fallback)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .trim()
    .slice(0, 80) || fallback;
const safeFileName = (value, fallback, extension) =>
  `${safeBaseName(value, fallback).replace(new RegExp(`\\.${extension}$`, "i"), "")}.${extension}`;
const latestFile = (directory, extension) =>
  readdirSync(directory)
    .filter((name) => name.toLowerCase().endsWith(`.${extension}`))
    .map((name) => ({
      name,
      path: join(directory, name),
      modified: statSync(join(directory, name)).mtimeMs,
    }))
    .sort((a, b) => b.modified - a.modified)[0];
const displayName = (name) => name.replace(/^\d+-[a-z0-9]+-/i, "");
const numericValue = (value) => {
  if (typeof value === "number") return value;
  const match = String(value ?? "")
    .replace(/,/g, "")
    .match(/[-+]?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : Number.NaN;
};
const publicJob = (job) =>
  job ? { ...job, outputLocation: undefined } : undefined;

const startRender = async (jobId, payload) => {
  try {
    videoJobs.set(jobId, { status: "rendering", progress: 0 });
    bundlePromise ??= bundle({ entryPoint: resolve("src", "index.ts") });
    const serveUrl = await bundlePromise;
    const inputProps = { title: payload.title, items: payload.items };
    const composition = await selectComposition({
      serveUrl,
      id: "Ranking3D",
      inputProps,
    });
    const filename = safeFileName(payload.filename, "ranking-video", "mp4");
    const outputLocation = join(videoOutputDir, `${jobId}-${filename}`);
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      concurrency: renderConcurrency,
      outputLocation,
      inputProps,
      onProgress: ({ progress }) =>
        videoJobs.set(jobId, { status: "rendering", progress }),
    });
    videoJobs.set(jobId, {
      status: "done",
      progress: 1,
      filename,
      url: `/download/${encodeURIComponent(jobId)}`,
      outputLocation,
    });
  } catch (error) {
    videoJobs.set(jobId, {
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const runProcess = (command, args) =>
  new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: resolve("."),
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolvePromise({ stdout, stderr })
        : reject(
            new Error(
              (stderr || stdout || `TTS 进程退出，代码 ${code}`).trim(),
            ),
          ),
    );
  });

const startTts = async (jobId, payload) => {
  try {
    ttsJobs.set(jobId, {
      status: "generating",
      progress: 0.05,
      message: "正在加载 Kokoro 模型",
    });
    const filename = safeFileName(payload.filename, "narration", "wav");
    const outputLocation = join(audioOutputDir, `${jobId}-${filename}`);
    const localPython = resolve(".venv", "Scripts", "python.exe");
    const python = existsSync(localPython) ? localPython : "python";
    await runProcess(python, [
      resolve("tts", "providers", "local_tts.py"),
      "--text",
      payload.text,
      "--speaker",
      String(payload.speaker),
      "--speed",
      String(payload.speed),
      "--output",
      outputLocation,
    ]);
    ttsJobs.set(jobId, {
      status: "done",
      progress: 1,
      message: "语音生成完成",
      filename,
      url: `/download-audio/${encodeURIComponent(jobId)}`,
      outputLocation,
    });
  } catch (error) {
    ttsJobs.set(jobId, {
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const probeDuration = async (file) => {
  const { stdout } = await runProcess("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    file,
  ]);
  const duration = Number(stdout.trim());
  if (!Number.isFinite(duration)) throw new Error(`无法读取音频时长：${file}`);
  return duration;
};
const concatPath = (file) =>
  `file '${file.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`;

const startRankingGeneration = async (jobId, payload) => {
  const jobDir = resolve("jobs", jobId);
  const segmentDir = join(jobDir, "audio", "segments");
  const publicJobDir = resolve("public", "generated", jobId);
  mkdirSync(segmentDir, { recursive: true });
  mkdirSync(publicJobDir, { recursive: true });
  try {
    const ordered = [...payload.items].sort((a, b) => b.rank - a.rank);
    const segments = [
      { id: "intro", label: "开场白", text: payload.intro },
      ...ordered.map((item) => ({
        id: `rank-${item.rank}`,
        label: `排名 ${item.rank}`,
        rank: item.rank,
        text: `อันดับที่ ${item.rank} ${item.name}`,
      })),
    ];
    const localPython = resolve(".venv", "Scripts", "python.exe");
    const python = existsSync(localPython) ? localPython : "python";
    const silenceFile = join(jobDir, "audio", "silence.wav");
    rankingJobs.set(jobId, {
      status: "generating-audio",
      message: `正在生成 1/${segments.length} 段语音`,
    });
    await runProcess("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "anullsrc=r=24000:cl=mono",
      "-t",
      String(payload.interval),
      "-c:a",
      "pcm_s16le",
      silenceFile,
    ]);
    const timelineSegments = [];
    const concatEntries = [];
    let cursor = 0;
    const speechJobs = segments.map((segment, index) => ({
      text: segment.text,
      output: join(
        segmentDir,
        `${String(index).padStart(2, "0")}-${segment.id}.wav`,
      ),
    }));
    const batchFile = join(jobDir, "audio", "tts-batch.json");
    await writeFile(
      batchFile,
      `${JSON.stringify(speechJobs, null, 2)}\n`,
      "utf8",
    );
    rankingJobs.set(jobId, {
      status: "generating-audio",
      message: `正在批量生成 ${segments.length} 段语音`,
    });
    await runProcess(python, [
      resolve("tts", "providers", "local_tts.py"),
      "--batch-json",
      batchFile,
      "--speaker",
      "1",
      "--speed",
      String(payload.speed),
    ]);
    for (let index = 0; index < segments.length; index++) {
      const segment = segments[index];
      rankingJobs.set(jobId, {
        status: "analyzing-audio",
        message: `正在分析 ${index + 1}/${segments.length} 段语音：${segment.label}`,
      });
      const speechFile = speechJobs[index].output;
      const speechDuration = await probeDuration(speechFile);
      const duration = speechDuration + payload.interval;
      timelineSegments.push({
        ...segment,
        index,
        start: cursor,
        speechDuration,
        intervalDuration: payload.interval,
        duration,
        end: cursor + duration,
        startFrame: Math.round(cursor * 30),
        durationInFrames: Math.round(duration * 30),
      });
      cursor += duration;
      concatEntries.push(concatPath(speechFile), concatPath(silenceFile));
    }
    const concatFile = join(jobDir, "audio", "concat.txt");
    const audioFile = join(jobDir, "audio", "ranking.wav");
    await writeFile(concatFile, `${concatEntries.join("\n")}\n`, "utf8");
    rankingJobs.set(jobId, {
      status: "merging-audio",
      message: "正在合并分段语音和移动间隔",
    });
    await runProcess("ffmpeg", [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatFile,
      "-ar",
      "24000",
      "-ac",
      "1",
      "-c:a",
      "pcm_s16le",
      audioFile,
    ]);
    const totalDuration = await probeDuration(audioFile);
    const durationInFrames = Math.ceil(totalDuration * 30);
    const timeline = {
      fps: 30,
      intervalDuration: payload.interval,
      totalDuration,
      durationInFrames,
      audioFile: `generated/${jobId}/ranking.wav`,
      segments: timelineSegments,
    };
    const timelineFile = join(jobDir, "timeline.json");
    await writeFile(
      timelineFile,
      `${JSON.stringify(timeline, null, 2)}\n`,
      "utf8",
    );
    await copyFile(audioFile, join(publicJobDir, "ranking.wav"));
    await copyFile(timelineFile, join(publicJobDir, "timeline.json"));
    rankingJobs.set(jobId, {
      status: "rendering",
      message: "正在按 Timeline 总时长渲染视频",
    });
    // public/generated receives a new WAV for every task. Remotion snapshots
    // public/ during bundling, therefore this task needs a fresh bundle.
    const serveUrl = await bundle({ entryPoint: resolve("src", "index.ts") });
    const inputProps = {
      title: payload.title,
      items: payload.items,
      audioFile: timeline.audioFile,
      durationInFrames,
      timeline: timeline.segments,
    };
    const composition = await selectComposition({
      serveUrl,
      id: "Ranking3D",
      inputProps,
    });
    const videoFilename = safeFileName(
      payload.filename,
      "ranking-video",
      "mp4",
    );
    const videoFile = join(videoOutputDir, `${jobId}-${videoFilename}`);
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      concurrency: renderConcurrency,
      outputLocation: videoFile,
      inputProps,
      onProgress: ({ progress }) =>
        rankingJobs.set(jobId, {
          status: "rendering",
          message: `正在渲染视频 ${Math.round(progress * 100)}%`,
        }),
    });
    rankingJobs.set(jobId, {
      status: "done",
      message: "生成完成",
      audioFilename: "ranking.wav",
      timelineFilename: "timeline.json",
      videoFilename,
      audioUrl: `/ranking-download/${jobId}/audio`,
      timelineUrl: `/ranking-download/${jobId}/timeline`,
      videoUrl: `/ranking-download/${jobId}/video`,
      files: { audio: audioFile, timeline: timelineFile, video: videoFile },
    });
  } catch (error) {
    rankingJobs.set(jobId, {
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  if (req.method === "POST" && url.pathname === "/api/render") {
    try {
      const payload = await readBody(req);
      if (
        !payload.title?.trim() ||
        !Array.isArray(payload.items) ||
        payload.items.length < 1
      )
        return sendJson(res, 400, { error: "请填写标题并至少录入一行数据" });
      const invalid = payload.items.some(
        (item) =>
          !Number.isFinite(item.rank) ||
          !String(item.name).trim() ||
          !Number.isFinite(numericValue(item.value)) ||
          numericValue(item.value) <= 0 
          // || !String(item.unit).trim()
          ,
      );
      if (invalid)
        return sendJson(res, 400, {
          error: "排名、名称和数值必须填写正确，数值必须大于 0；单位可选",
        });
      const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      void startRender(jobId, payload);
      return sendJson(res, 202, { jobId });
    } catch (error) {
      return sendJson(res, 400, {
        error: error instanceof Error ? error.message : "请求格式错误",
      });
    }
  }
  if (req.method === "POST" && url.pathname === "/api/tts") {
    try {
      const payload = await readBody(req);
      const text = String(payload.text || "").trim();
      const speaker = Number(payload.speaker ?? 1);
      const speed = Number(payload.speed ?? 1);
      if (!text) return sendJson(res, 400, { error: "请输入解说文案" });
      if (text.length > 5000)
        return sendJson(res, 400, { error: "单次文案不能超过 5000 个字符" });
      if (!Number.isInteger(speaker) || speaker < 0 || speaker > 11)
        return sendJson(res, 400, { error: "音色编号必须是 0 到 11" });
      if (!Number.isFinite(speed) || speed < 0.5 || speed > 2)
        return sendJson(res, 400, { error: "语速必须在 0.5 到 2.0 之间" });
      const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      void startTts(jobId, { ...payload, text, speaker, speed });
      return sendJson(res, 202, { jobId });
    } catch (error) {
      return sendJson(res, 400, {
        error: error instanceof Error ? error.message : "请求格式错误",
      });
    }
  }
  if (req.method === "POST" && url.pathname === "/api/ranking-generate") {
    try {
      const payload = await readBody(req);
      const interval = Number(payload.interval);
      const speed = Number(payload.speed ?? 0.8);
      if (!String(payload.intro || "").trim())
        return sendJson(res, 400, { error: "请输入泰文开场白" });
      if (!Array.isArray(payload.items) || payload.items.length < 1)
        return sendJson(res, 400, { error: "请至少录入一行排名数据" });
      if (!Number.isFinite(interval) || interval < 0.1 || interval > 20)
        return sendJson(res, 400, {
          error: "柱子移动间隔必须在 0.1 到 20 秒之间",
        });
      if (!Number.isFinite(speed) || speed < 0.5 || speed > 2)
        return sendJson(res, 400, { error: "语速必须在 0.5 到 2.0 之间" });
      const invalid = payload.items.some(
        (item) =>
          !Number.isFinite(item.rank) ||
          !String(item.name).trim() ||
          !Number.isFinite(numericValue(item.value)) 
          // || !String(item.unit).trim()
          ,
      );
      if (invalid)
        return sendJson(res, 400, {
          error: "请完整填写排名、泰文名称和数值；单位可选",
        });
      const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      void startRankingGeneration(jobId, {
        ...payload,
        intro: String(payload.intro).trim(),
        interval,
        speed,
      });
      return sendJson(res, 202, { jobId });
    } catch (error) {
      return sendJson(res, 400, {
        error: error instanceof Error ? error.message : "请求格式错误",
      });
    }
  }
  if (req.method === "GET" && url.pathname.startsWith("/api/jobs/")) {
    const job = videoJobs.get(url.pathname.split("/").pop());
    return job
      ? sendJson(res, 200, publicJob(job))
      : sendJson(res, 404, { error: "任务不存在" });
  }
  if (req.method === "GET" && url.pathname.startsWith("/api/tts-jobs/")) {
    const job = ttsJobs.get(url.pathname.split("/").pop());
    return job
      ? sendJson(res, 200, publicJob(job))
      : sendJson(res, 404, { error: "任务不存在" });
  }
  if (req.method === "GET" && url.pathname.startsWith("/api/ranking-jobs/")) {
    const job = rankingJobs.get(url.pathname.split("/").pop());
    return job
      ? sendJson(res, 200, { ...job, files: undefined })
      : sendJson(res, 404, { error: "任务不存在" });
  }
  if (req.method === "GET" && url.pathname === "/api/latest") {
    const latest = latestFile(videoOutputDir, "mp4");
    return latest
      ? sendJson(res, 200, {
          filename: displayName(latest.name),
          url: "/download/latest",
        })
      : sendJson(res, 404, { error: "还没有生成过视频" });
  }
  if (req.method === "GET" && url.pathname === "/api/latest-audio") {
    const latest = latestFile(audioOutputDir, "wav");
    return latest
      ? sendJson(res, 200, {
          filename: displayName(latest.name),
          url: "/download-audio/latest",
        })
      : sendJson(res, 404, { error: "还没有生成过音频" });
  }
  if (req.method === "GET" && url.pathname === "/download/latest") {
    const latest = latestFile(videoOutputDir, "mp4");
    if (!latest) return sendJson(res, 404, { error: "还没有可下载的视频" });
    res.writeHead(200, {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(displayName(basename(latest.path)))}`,
    });
    return createReadStream(latest.path).pipe(res);
  }
  if (req.method === "GET" && url.pathname === "/download-audio/latest") {
    const latest = latestFile(audioOutputDir, "wav");
    if (!latest) return sendJson(res, 404, { error: "还没有可下载的音频" });
    res.writeHead(200, {
      "Content-Type": "audio/wav",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(displayName(basename(latest.path)))}`,
    });
    return createReadStream(latest.path).pipe(res);
  }
  if (req.method === "GET" && url.pathname.startsWith("/download/")) {
    const job = videoJobs.get(
      decodeURIComponent(url.pathname.split("/").pop()),
    );
    if (!job?.outputLocation || !existsSync(job.outputLocation))
      return sendJson(res, 404, { error: "文件不存在" });
    res.writeHead(200, {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(job.filename)}`,
    });
    return createReadStream(job.outputLocation).pipe(res);
  }
  if (req.method === "GET" && url.pathname.startsWith("/download-audio/")) {
    const job = ttsJobs.get(decodeURIComponent(url.pathname.split("/").pop()));
    if (!job?.outputLocation || !existsSync(job.outputLocation))
      return sendJson(res, 404, { error: "文件不存在" });
    res.writeHead(200, {
      "Content-Type": "audio/wav",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(job.filename)}`,
    });
    return createReadStream(job.outputLocation).pipe(res);
  }
  if (req.method === "GET" && url.pathname.startsWith("/ranking-download/")) {
    const [, , jobId, kind] = url.pathname.split("/");
    const job = rankingJobs.get(jobId);
    const file = job?.files?.[kind];
    if (!file || !existsSync(file))
      return sendJson(res, 404, { error: "文件不存在" });
    const meta =
      kind === "audio"
        ? ["audio/wav", "ranking.wav"]
        : kind === "timeline"
          ? ["application/json; charset=utf-8", "timeline.json"]
          : ["video/mp4", job.videoFilename];
    res.writeHead(200, {
      "Content-Type": meta[0],
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(meta[1])}`,
    });
    return createReadStream(file).pipe(res);
  }
  const requested = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const file = resolve(publicDir, requested);
  if (!file.startsWith(publicDir) || !existsSync(file)) {
    res.writeHead(404);
    return res.end("Not found");
  }
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
  };
  res.writeHead(200, {
    "Content-Type": types[extname(file)] || "application/octet-stream",
  });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`页面已启动：http://localhost:${port}`));
