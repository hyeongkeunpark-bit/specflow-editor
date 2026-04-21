// 데이터 카탈로그 CSV 2개 → wanted-db-catalog.md + wanted-db-index.json
// 로컬에서 한 번 실행해서 산출물 커밋. Vercel 런타임은 산출물만 읽음.
//
// 실행: node scripts/build-db-catalog.mjs

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const TABLES_CSV = path.join(ROOT, "첨부/데이터 카탈로그 - 테이블.csv");
const COLUMNS_CSV = path.join(ROOT, "첨부/데이터 카탈로그 - 컬럼.csv");
const CATALOG_MD = path.join(ROOT, "wanted-db-catalog.md");
const INDEX_JSON = path.join(ROOT, "wanted-db-index.json");

// ── CSV 파서 (RFC 4180 간이 구현: 쿼팅, 줄바꿈 내 쿼팅 처리) ──
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else { field += c; }
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function toObjects(rows) {
  if (rows.length === 0) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).filter(r => r.some(c => c && c.trim())).map(r => {
    const o = {};
    headers.forEach((h, i) => { o[h] = (r[i] ?? "").trim(); });
    return o;
  });
}

// ── CSV 로드 ──
const tableRows = toObjects(parseCSV(fs.readFileSync(TABLES_CSV, "utf-8")));
const columnRows = toObjects(parseCSV(fs.readFileSync(COLUMNS_CSV, "utf-8")));

console.log(`[parse] 테이블: ${tableRows.length}, 컬럼: ${columnRows.length}`);

// ── 테이블별 컬럼 집계 ──
const columnsByTable = new Map(); // key: "데이터세트.테이블" → [{컬럼, 설명, 정책태그}]
for (const c of columnRows) {
  const key = `${c["데이터세트"]}.${c["테이블"]}`;
  if (!columnsByTable.has(key)) columnsByTable.set(key, []);
  columnsByTable.get(key).push({
    name: c["컬럼"],
    desc: c["설명"] || "",
    policy: c["정책 태그"] || "",
  });
}

// ── 구조화 ──
const tables = tableRows.map(t => {
  const id = `${t["데이터세트"]}.${t["테이블"]}`;
  const cols = columnsByTable.get(id) ?? [];
  return {
    id,
    dataset: t["데이터세트"],
    name: t["테이블"],
    kind: t["종류"] || "",
    desc: t["설명"] || "",
    notes: t["특이사항"] || "",
    category1: t["분류1"] || "",
    category2: t["분류2"] || "",
    owner: t["마지막에 수정한 사람"] || "",
    columns: cols,
  };
}).filter(t => t.name); // 빈 row 제거

// ── 데이터셋 설명 (테이블 수 + 대표 분류) ──
const datasetStats = new Map();
for (const t of tables) {
  if (!datasetStats.has(t.dataset)) {
    datasetStats.set(t.dataset, { count: 0, cats: new Set() });
  }
  const s = datasetStats.get(t.dataset);
  s.count++;
  if (t.category1) s.cats.add(t.category1);
}

// ── Markdown 생성 ──
function mdEscape(s) {
  return (s || "").replace(/\|/g, "\\|").replace(/\n+/g, " ").trim();
}

const categoryKey = (t) => {
  const c1 = t.category1 || "미분류";
  const c2 = t.category2 || "";
  return c2 ? `${c1}/${c2}` : c1;
};

const md = [];
md.push(`# 원티드 데이터 카탈로그 (자동 생성)`);
md.push(``);
md.push(`출처: \`첨부/데이터 카탈로그 - 테이블.csv\` + \`첨부/데이터 카탈로그 - 컬럼.csv\``);
md.push(`생성 방식: \`node scripts/build-db-catalog.mjs\``);
md.push(``);
md.push(`- 전체 테이블 수: **${tables.length}**`);
md.push(`- 전체 컬럼 수: **${columnRows.length}**`);
md.push(`- 특이사항 있는 테이블: **${tables.filter(t => t.notes).length}** (핵심 운영 맥락)`);
md.push(``);
md.push(`## 데이터셋 개요`);
md.push(``);
md.push(`| 데이터셋 | 테이블 수 | 주요 분류 |`);
md.push(`|---|---|---|`);
const datasetsOrdered = [...datasetStats.entries()].sort((a, b) => b[1].count - a[1].count);
for (const [ds, s] of datasetsOrdered) {
  md.push(`| \`${ds}\` | ${s.count} | ${[...s.cats].join(", ") || "-"} |`);
}
md.push(``);

// 데이터셋별 섹션
for (const [ds] of datasetsOrdered) {
  const dsTables = tables.filter(t => t.dataset === ds);
  if (dsTables.length === 0) continue;
  md.push(`---`);
  md.push(``);
  md.push(`## 📦 \`${ds}\` (${dsTables.length}개 테이블)`);
  md.push(``);
  // 분류별 sort
  dsTables.sort((a, b) => {
    const ka = categoryKey(a);
    const kb = categoryKey(b);
    if (ka !== kb) return ka.localeCompare(kb, "ko");
    return a.name.localeCompare(b.name);
  });

  for (const t of dsTables) {
    md.push(`### \`${t.name}\` ${t.category1 ? `— ${categoryKey(t)}` : ""}`);
    md.push(``);
    if (t.desc) md.push(`**설명:** ${t.desc}`);
    if (t.notes) md.push(`\n⚠️ **특이사항:** ${t.notes}`);
    if (t.owner) md.push(`\n_owner: ${t.owner}_`);
    md.push(``);
    if (t.columns.length > 0) {
      md.push(`<details><summary>컬럼 ${t.columns.length}개</summary>\n`);
      md.push(`| 컬럼 | 설명 | 정책 태그 |`);
      md.push(`|---|---|---|`);
      for (const c of t.columns) {
        md.push(`| \`${c.name}\` | ${mdEscape(c.desc)} | ${mdEscape(c.policy)} |`);
      }
      md.push(``);
      md.push(`</details>`);
      md.push(``);
    }
  }
}

fs.writeFileSync(CATALOG_MD, md.join("\n"), "utf-8");
console.log(`[write] ${CATALOG_MD} (${fs.statSync(CATALOG_MD).size} bytes)`);

// ── JSON 인덱스 (Haiku 런타임용) ──
// 각 테이블 메타 + markdown 블록 오프셋을 알 수 있게
const index = {
  generated: new Date().toISOString(),
  total_tables: tables.length,
  total_columns: columnRows.length,
  tables_with_notes: tables.filter(t => t.notes).length,
  tables: tables.map(t => ({
    id: t.id,
    dataset: t.dataset,
    name: t.name,
    category: categoryKey(t),
    // Haiku에 보낼 요약 — desc 앞 120자 + has_notes 플래그
    summary: (t.desc || "").slice(0, 120),
    has_notes: t.notes.length > 0,
    column_count: t.columns.length,
  })),
};
fs.writeFileSync(INDEX_JSON, JSON.stringify(index, null, 2), "utf-8");
console.log(`[write] ${INDEX_JSON} (${fs.statSync(INDEX_JSON).size} bytes)`);

// ── 요약 리포트 ──
console.log(``);
console.log(`=== 생성 완료 ===`);
console.log(`  카탈로그 md: ${(fs.statSync(CATALOG_MD).size / 1024).toFixed(1)}KB`);
console.log(`  인덱스 json: ${(fs.statSync(INDEX_JSON).size / 1024).toFixed(1)}KB`);
console.log(`  메타 요약 크기(Haiku input 추정): ${(JSON.stringify(index.tables).length / 1024).toFixed(1)}KB`);
