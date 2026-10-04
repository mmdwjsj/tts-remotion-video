import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readExcelProps } from "./excel-data.mjs";

const input = process.argv[2] ?? "E:/temp/data/sourceData.xlsx";
if (!input) {
  console.error("用法：npm run render:excel -- <数据.xlsx> [输出.mp4]");
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = path.resolve(input);
const baseName = path.basename(inputPath, path.extname(inputPath));
const outputPath = path.resolve(process.argv[3] ?? path.join(root, "output", `${baseName}.mp4`));
const propsPath = path.join(root, "temp", `${baseName}.props.json`);
const props = await readExcelProps(inputPath);

await mkdir(path.dirname(outputPath), { recursive: true });
await mkdir(path.dirname(propsPath), { recursive: true });
await writeFile(propsPath, `${JSON.stringify(props, null, 2)}\n`, "utf8");

const cli = path.join(root, "node_modules", "@remotion", "cli", "remotion-cli.js");
const args = [cli, "render", "src/index.ts", "Ranking3D", outputPath, "--props", propsPath];
console.log(`正在根据 ${inputPath} 渲染视频...`);
const child = spawn(process.execPath, args, { cwd: root, stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 1));
