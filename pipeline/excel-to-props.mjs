import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { readExcelProps } from "./excel-data.mjs";

const input = process.argv[2] ?? "E:/temp/data/sourceData.xlsx";
const output = process.argv[3] ?? "temp/excel-props.json";
if (!input) {
  console.error("用法：npm run excel:props -- <数据.xlsx> [输出.json]");
  process.exit(1);
}

const props = await readExcelProps(path.resolve(input));
const outputPath = path.resolve(output);
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(props, null, 2)}\n`, "utf8");
console.log(`已生成 Remotion props：${outputPath}`);
