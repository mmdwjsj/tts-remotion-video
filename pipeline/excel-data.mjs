import ExcelJS from "exceljs";
const palette = ["#E4572E", "#3B6E8F", "#2E933C", "#F2A104", "#9A48D0", "#D6455D", "#4C4C9D", "#1F8A70", "#C97B3D", "#7A6F9B"];
const text = (v) => String(v ?? "").trim();
const norm = (v) => text(v).toLowerCase();
const numberConfig = (cfg, keys, fallback) => { const k = keys.find((x) => cfg[x] !== undefined); const n = Number(k ? cfg[k] : fallback); return Number.isFinite(n) ? n : fallback; };

export async function readExcelProps(inputPath) {
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile(inputPath);
  const sheet = workbook.getWorksheet("data") ?? workbook.worksheets[0]; if (!sheet) throw new Error("Excel 中没有工作表");
  const headers = sheet.getRow(1).values.slice(1).map(text);
  const find = (...names) => headers.findIndex((h) => names.includes(norm(h)));
  const nameIndex = find("name", "country", "名称", "国家"); const colorIndex = find("color", "颜色"); const quantityIndex = find("quantity", "value", "数值", "数量");
  if (nameIndex < 0) throw new Error("第一行必须包含 name（或 country/名称/国家）列");
  const yearColumns = headers.map((h, i) => ({ year: Number(h), index: i })).filter((x) => Number.isInteger(x.year)).sort((a, b) => a.year - b.year);
  const columns = yearColumns.length >= 2 ? yearColumns : quantityIndex >= 0 ? [{ year: 0, index: quantityIndex }, { year: 1, index: quantityIndex }] : [];
  if (columns.length < 2) throw new Error("至少需要两列年份，或提供 quantity/value/数值列");
  const series = [];
  for (let r = 2; r <= sheet.rowCount; r++) { const row = sheet.getRow(r); const country = text(row.getCell(nameIndex + 1).value); if (!country) continue; const values = {}; for (const c of columns) { const value = Number(row.getCell(c.index + 1).value); if (!Number.isFinite(value)) throw new Error(`第 ${r} 行数值不是数字`); values[c.year] = value; } series.push({ country, color: colorIndex >= 0 ? text(row.getCell(colorIndex + 1).value) || palette[(r - 2) % palette.length] : palette[(r - 2) % palette.length], values }); }
  if (!series.length) throw new Error("data 表没有可用数据");
  const cfgSheet = workbook.getWorksheet("config") ?? workbook.getWorksheet("配置"); const cfg = {}; cfgSheet?.eachRow((row) => { const k = norm(row.getCell(1).value); if (k) cfg[k] = row.getCell(2).value; });
  return { title: text(cfg.title) || "数据排名", unit: text(cfg.unit), source: text(cfg.source) || "数据来源：Excel", topN: numberConfig(cfg, ["topn"], Math.min(8, series.length)), durationSeconds: numberConfig(cfg, ["durationseconds"], 12), holdStartFrames: numberConfig(cfg, ["holdstartframes"], 20), holdEndFrames: numberConfig(cfg, ["holdendframes"], 45), years: columns.map((c) => c.year), series };
}
