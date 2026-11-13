/**
 * 数据工具：json group by — 数据整理
 */

export const name = "dsh-data-json-group-by";
export const inject = ["tools"];

const NL = String.fromCharCode(10);
const SITE = "https://deepseekbase.com/zh/tools/";
const TEXT_OUTPUT = {
  schema: { type: "object", additionalProperties: false, properties: { text: { type: "string" } }, required: ["text"] },
  render: (_args, value) => [{ type: "text", text: (value && value.text) || "" }],
};

function parseCSV(t) {
  const rows = String(t || "").replace(/\r/g, "").split(NL).filter((x) => x.trim().length);
  if (!rows.length) throw new Error("没有数据");
  return rows.map((r) => r.split(",").map((c) => c.trim().replace(/^"(.*)"$/, "$1")));
}
function toCSV(rows) { return rows.map((r) => r.map((c) => (String(c).indexOf(",") >= 0 ? '"' + String(c).replace(/"/g, '""') + '"' : String(c))).join(",")).join(NL); }
function colIndex(head, name) { const i = head.indexOf(name); if (i < 0) throw new Error("找不到列: " + name); return i; }
function num(x) { const v = Number(String(x).replace(/[^0-9.\-]/g, "")); return Number.isFinite(v) ? v : NaN; }
function sum(arr) { return arr.filter((x) => Number.isFinite(x)).reduce((a, b) => a + b, 0); }

const OPS = {
  csv_sort_col: (t, a) => { const rows = parseCSV(t); const i = colIndex(rows[0], a); const head = rows[0]; const body = rows.slice(1); body.sort((x, y) => { const nx = num(x[i]), ny = num(y[i]); if (Number.isFinite(nx) && Number.isFinite(ny)) return nx - ny; return String(x[i]).localeCompare(String(y[i])); }); return toCSV([head].concat(body)); },
  csv_filter: (t, a) => { const rows = parseCSV(t); const [col, val] = String(a).split("="); const i = colIndex(rows[0], col); const body = rows.slice(1).filter((r) => String(r[i]).indexOf(val) >= 0); return toCSV([rows[0]].concat(body)); },
  csv_select_cols: (t, a) => { const rows = parseCSV(t); const idx = String(a).split(",").map((x) => Number(x.trim())); return toCSV(rows.map((r) => idx.map((i) => r[i] === undefined ? "" : r[i]))); },
  csv_rename_header: (t, a) => { const rows = parseCSV(t); const [oldN, newN] = String(a).split(":"); const i = colIndex(rows[0], oldN); rows[0][i] = newN; return toCSV(rows); },
  csv_dedupe: (t) => { const rows = parseCSV(t); const seen = {}; const out = [rows[0]]; for (const r of rows.slice(1)) { const k = r.join("|"); if (!seen[k]) { seen[k] = 1; out.push(r); } } return toCSV(out); },
  csv_count: (t) => { const rows = parseCSV(t); return "数据行: " + (rows.length - 1) + "，列数: " + rows[0].length; },
  csv_group_count: (t, a) => { const rows = parseCSV(t); const i = colIndex(rows[0], a); const m = {}; for (const r of rows.slice(1)) m[r[i]] = (m[r[i]] || 0) + 1; return Object.keys(m).sort((x, y) => m[y] - m[x]).map((k) => k + "," + m[k]).join(NL); },
  csv_sum_col: (t, a) => { const rows = parseCSV(t); const i = colIndex(rows[0], a); return "合计: " + sum(rows.slice(1).map((r) => num(r[i]))); },
  csv_avg_col: (t, a) => { const rows = parseCSV(t); const i = colIndex(rows[0], a); const xs = rows.slice(1).map((r) => num(r[i])).filter((x) => Number.isFinite(x)); return xs.length ? "平均: " + (sum(xs) / xs.length) : "无数字"; },
  csv_max_col: (t, a) => { const rows = parseCSV(t); const i = colIndex(rows[0], a); const xs = rows.slice(1).map((r) => num(r[i])).filter((x) => Number.isFinite(x)); return xs.length ? "最大: " + Math.max.apply(null, xs) : "无数字"; },
  csv_min_col: (t, a) => { const rows = parseCSV(t); const i = colIndex(rows[0], a); const xs = rows.slice(1).map((r) => num(r[i])).filter((x) => Number.isFinite(x)); return xs.length ? "最小: " + Math.min.apply(null, xs) : "无数字"; },
  csv_to_json_lines: (t) => { const rows = parseCSV(t); const head = rows[0]; return rows.slice(1).map((r) => { const o = {}; head.forEach((h, i) => { o[h] = r[i]; }); return JSON.stringify(o); }).join(NL); },
  csv_transpose: (t) => { const rows = parseCSV(t); const maxLen = Math.max.apply(null, rows.map((r) => r.length)); const out = []; for (let i = 0; i < maxLen; i++) out.push(rows.map((r) => r[i] === undefined ? "" : r[i])); return toCSV(out); },
  csv_add_index: (t) => { const rows = parseCSV(t); return toCSV([["#"].concat(rows[0])].concat(rows.slice(1).map((r, i) => [String(i + 1)].concat(r)))); },
  csv_trim: (t) => toCSV(parseCSV(t).map((r) => r.map((c) => c.trim()))),
  tsv_to_csv: (t) => String(t).split(NL).map((r) => r.split("\t").join(",")).join(NL),
  csv_to_tsv: (t) => String(t).split(NL).map((r) => r.split(",").join("\t")).join(NL),
  csv_fill_empty: (t, a) => { const v = String(a || ""); return toCSV(parseCSV(t).map((r) => r.map((c) => (c === "" ? v : c)))); },
  csv_clean_spaces: (t) => toCSV(parseCSV(t).map((r) => r.map((c) => c.replace(/\s+/g, " ").trim()))),
  csv_validate: (t) => {
    const rows = parseCSV(t); const n = rows[0].length; const bad = [];
    rows.slice(1).forEach((r, i) => { if (r.length !== n) bad.push("第 " + (i + 2) + " 行: " + r.length + " 列"); });
    return "表头列数: " + n + NL + "数据行: " + (rows.length - 1) + NL + (bad.length ? "异常:" + NL + bad.join(NL) : "列数一致");
  },
  csv_preview: (t, a) => { const n = Math.max(1, Number(a) || 5); const rows = parseCSV(t); return toCSV(rows.slice(0, n + 1)); },
  ndjson_to_array: (t) => { const out = String(t).split(NL).filter((x) => x.trim()).map((x) => JSON.parse(x)); return JSON.stringify(out, null, 2); },
  array_to_ndjson: (t) => { const arr = JSON.parse(t); if (!Array.isArray(arr)) throw new Error("需要 JSON 数组"); return arr.map((x) => JSON.stringify(x)).join(NL); },
  json_pick_keys: (t, a) => { const o = JSON.parse(t); const ks = String(a).split(",").map((x) => x.trim()); const out = {}; ks.forEach((k) => { if (o[k] !== undefined) out[k] = o[k]; }); return JSON.stringify(out, null, 2); },
  json_omit_keys: (t, a) => { const o = JSON.parse(t); const ks = String(a).split(",").map((x) => x.trim()); const out = {}; Object.keys(o).forEach((k) => { if (ks.indexOf(k) < 0) out[k] = o[k]; }); return JSON.stringify(out, null, 2); },
  json_rename_keys: (t, a) => { const o = JSON.parse(t); const [from, to] = String(a).split(":"); const out = {}; Object.keys(o).forEach((k) => { out[k === from ? to : k] = o[k]; }); return JSON.stringify(out, null, 2); },
  json_array_sort: (t, a) => { const arr = JSON.parse(t); if (!Array.isArray(arr)) throw new Error("需要数组"); const k = String(a || ""); arr.sort((x, y) => { const nx = k ? x[k] : x, ny = k ? y[k] : y; const a1 = Number(nx), b1 = Number(ny); if (Number.isFinite(a1) && Number.isFinite(b1)) return a1 - b1; return String(nx).localeCompare(String(ny)); }); return JSON.stringify(arr, null, 2); },
  json_group_by: (t, a) => { const arr = JSON.parse(t); if (!Array.isArray(arr)) throw new Error("需要数组"); const k = String(a); const m = {}; arr.forEach((o) => { const key = String(o[k]); (m[key] = m[key] || []).push(o); }); return JSON.stringify(m, null, 2); },
  json_unique: (t, a) => { const arr = JSON.parse(t); if (!Array.isArray(arr)) throw new Error("需要数组"); const k = String(a || ""); const seen = {}; const out = arr.filter((o) => { const key = k ? JSON.stringify(o[k]) : JSON.stringify(o); if (seen[key]) return false; seen[key] = 1; return true; }); return JSON.stringify(out, null, 2); },
  json_keys_list: (t) => { const o = JSON.parse(t); return Object.keys(o).join(NL); },
  json_type_stats: (t) => { const o = JSON.parse(t); const m = {}; Object.keys(o).forEach((k) => { const ty = o[k] === null ? "null" : Array.isArray(o[k]) ? "array" : typeof o[k]; m[ty] = (m[ty] || 0) + 1; }); return Object.keys(m).map((k) => k + ": " + m[k]).join(NL); },
  markdown_to_csv: (t) => {
    const rows = String(t).split(NL).filter((x) => x.trim().indexOf("|") >= 0);
    const data = rows.map((r) => r.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim())).filter((r) => !r.every((c) => /^-+$/.test(c)));
    return toCSV(data);
  },
  csv_to_markdown: (t) => { const rows = parseCSV(t); const head = "| " + rows[0].join(" | ") + " |"; const sep = "| " + rows[0].map(() => "---").join(" | ") + " |"; return [head, sep].concat(rows.slice(1).map((r) => "| " + r.join(" | ") + " |")).join(NL); },
  csv_to_html: (t) => { const rows = parseCSV(t); const head = "<tr>" + rows[0].map((c) => "<th>" + c + "</th>").join("") + "</tr>"; const body = rows.slice(1).map((r) => "<tr>" + r.map((c) => "<td>" + c + "</td>").join("") + "</tr>").join(NL); return "<table>" + NL + head + NL + body + NL + "</table>"; },
  lines_to_csv: (t) => String(t).split(NL).filter((x) => x.trim()).map((x) => '"' + x.replace(/"/g, '""') + '"').join(NL),
  csv_merge_cols: (t, a) => { const rows = parseCSV(t); const [c1, c2, sep] = String(a).split(":"); const i1 = colIndex(rows[0], c1), i2 = colIndex(rows[0], c2); rows.slice(1).forEach((r) => { r[i1] = r[i1] + (sep || " ") + r[i2]; }); return toCSV(rows); },
  csv_split_col: (t, a) => { const rows = parseCSV(t); const [col, sep] = String(a).split(":"); const i = colIndex(rows[0], col); const out = [rows[0].concat([col + "_1", col + "_2"])]; rows.slice(1).forEach((r) => { const p = String(r[i]).split(sep || " "); r.push(p[0] || ""); r.push(p.slice(1).join(sep || " ") || ""); out.push(r); }); return toCSV(out); },
  csv_lower_headers: (t) => { const rows = parseCSV(t); rows[0] = rows[0].map((c) => c.toLowerCase()); return toCSV(rows); },
  csv_upper_headers: (t) => { const rows = parseCSV(t); rows[0] = rows[0].map((c) => c.toUpperCase()); return toCSV(rows); },
  csv_drop_empty_rows: (t) => { const rows = parseCSV(t); return toCSV([rows[0]].concat(rows.slice(1).filter((r) => r.some((c) => c !== "")))); },
};

export function apply(ctx, config) {
  void config;
  ctx.tools.register({
    name: "data_json_group_by",
    description: "数据工具：json group by",
    parameters: {
      text: { "type": "string", required: true, "description": "数据" },
      a: { "type": "string", "description": "参数 a" },
    },
    output: TEXT_OUTPUT,
    async execute(args) {
      const t = args && args.text != null ? String(args.text) : "";
      const a = args && args.a != null ? String(args.a) : "";
      try {
        const fn = OPS["json_group_by"];
        if (!fn) throw new Error("未知操作");
        const v = await fn(t, a);
        return { text: ["数据工具：json group by", "=".repeat(52), String(v), "", "更多工具：" + SITE].join(NL) };
      } catch (e) {
        return { text: "处理失败: " + String((e && e.message) || e) };
      }
    },
  });
}
