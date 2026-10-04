# TTS Remotion Video

统一管理 3D 排名视频、TTS 音频和最终视频渲染。

## 目录

- `src/`：Remotion 和 React Three Fiber 视频源码
- `tts/`：本地 TTS 推理代码和模型
- `pipeline/`：数据转换、TTS、时间轴和渲染脚本
- `inputs/`：排名数据和解说文案
- `jobs/`：每次生成任务的配置、音频与时间轴
- `public/generated/`：Remotion 渲染时读取的任务资源
- `output/`：最终视频
- `temp/`：可删除的中间文件

## 基本命令

```powershell
npm install
npm run start
npm run build

npm run tts:local -- --text "ข้อความทดสอบ" --output jobs/demo/audio/intro.wav
```

本地 TTS 示例：

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r tts\requirements.txt
.\.venv\Scripts\python tts\providers\local_tts.py --text "ข้อความทดสอบ" --output jobs\demo\audio\intro.wav

npm run tts:local -- --text "ข้อความทดสอบ" --output jobs/demo/audio/intro.wav
```

旧的 `bar-chart-race` 和 `tts-generator` 项目只是本次迁移的只读来源，新项目运行时不依赖它们。

