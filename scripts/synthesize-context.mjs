// harvest-output.json → Haiku로 테이블별 맥락 추출 → wanted-db-context.md 생성
// 실행: node scripts/synthesize-context.mjs

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const HARVEST = path.join(__dirname, "harvest-output.json");
const OUTPUT = path.join(__dirname, "..", "wanted-db-context.md");

const SYSTEM = `당신은 DB 운영 맥락 추출 전문가다. 주어진 Confluence 문서들에서 특정 테이블에 대한 **운영 규칙·정책·특이사항만** 뽑아 구조화된 markdown으로 반환한다.

**추출 대상:**
- 상태값(enum) 정의: 값, 의미, 전이 규칙, deprecated 표시
- 필드 의미 및 판단 기준 (예: "이력서 등록"의 정확한 조건)
- 테이블 간 관계·제약 규칙
- 타임스탬프·날짜 컬럼의 운영상 의미 (예: 2016-05-10 이전 데이터 예외)
- 데이터 추출·조회 시 주의사항
- Legacy / Deprecated 필드·값 (미사용 status 등)

**제외 대상:**
- 실험 가설, UI/디자인 제안 (정책 아님)
- 회의 일정·담당자 배정
- 상세 코드 스니펫/SQL (원리만 요약)
- 미래 로드맵 (현행 정책 아니면 제외)

**출력 형식 (Markdown, 순수 텍스트만. 코드 블록으로 감싸지 마라):**

## 🔑 핵심 규칙
- **{주제}**: {규칙 1~2문장} _(출처: [{제목}]({URL}), {YYYY-MM-DD})_
- ...

## ⚠️ 특이사항 / 주의
- **{주제}**: {1~2문장} _(출처: ...)_

## 🗃️ Deprecated / Legacy
- **{값 or 필드}**: {미사용 사유·이후 시점} _(출처: ...)_

**규칙:**
- 문서에 명시된 내용만. 추측·확장 금지.
- **오래된 문서(수정일 3년 초과)**는 항목 끝에 \`⏰ 확인 필요\` 마커 첨부.
- 출처 없는 항목 금지.
- 해당 섹션에 내용 없으면 섹션 헤더 생략.
- 합성 요약 금지 — 서로 다른 문서의 내용을 한 항목으로 합치지 말 것 (한 항목 = 한 출처).`;

async function synthesizeTable(table, docs) {
  if (docs.length === 0) return `## ${table}\n\n_(관련 문서 없음)_\n`;

  const now = new Date();
  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const docsText = docs.map((d, i) => (
    `## [${i}] ${d.title}
- 최근 수정: ${d.lastModified || "미상"}
- URL: ${d.url}

--- 본문 시작 ---
${d.body}
--- 본문 끝 ---`
  )).join("\n\n");

  const userMsg = `# 테이블: ${table}
# 현재 시점: ${currentYm}

# 제공 문서 (${docs.length}개)

${docsText}

위 문서들에서 \`${table}\` 테이블과 직접 관련된 운영 맥락(규칙/주의/deprecated)을 markdown 섹션으로 추출해라.`;

  const t0 = Date.now();
  const resp = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 8000,
    system: SYSTEM,
    messages: [{ role: "user", content: userMsg }],
  });
  const text = resp.content.find((b) => b.type === "text")?.text ?? "";
  const u = resp.usage;
  console.log(`[synth:${table}] ${Date.now() - t0}ms | in:${u.input_tokens} out:${u.output_tokens} | ${text.length}자`);
  return text.trim();
}

// ── 메인 ──
const harvest = JSON.parse(fs.readFileSync(HARVEST, "utf-8"));

const md = [];
md.push(`# 원티드 DB 운영 맥락`);
md.push(``);
md.push(`Confluence 문서에서 테이블별 운영 규칙·정책·특이사항을 자동 추출한 문서.`);
md.push(``);
md.push(`- 생성: ${new Date().toISOString().slice(0, 10)}`);
md.push(`- 소스: \`scripts/harvest-output.json\` (Confluence 검색 + 수동 seed)`);
md.push(`- 재생성: \`node scripts/harvest-context.mjs && node scripts/synthesize-context.mjs\``);
md.push(``);
md.push(`## 활용 가이드`);
md.push(``);
md.push(`- 각 테이블 섹션은 해당 테이블을 다루는 Spec 작성·검토 시 **선행 결정/제약/예외** 참고용.`);
md.push(`- 스키마(컬럼 목록)는 \`wanted-db-catalog.md\` 참조.`);
md.push(`- \`⏰ 확인 필요\` 마커 = 3년 이상 된 문서 기반. DRI 확인 후 현행 여부 판단.`);
md.push(`- 각 항목 끝 \`(출처: ...)\` 링크로 근거 검증 가능.`);
md.push(``);
md.push(`---`);
md.push(``);

const totalT0 = Date.now();
for (const t of harvest.tables) {
  console.log(`\n━━━ ${t.table} (${t.docs.length} docs) ━━━`);
  const section = await synthesizeTable(t.table, t.docs);
  md.push(`# 📂 ${t.table}`);
  md.push(``);
  md.push(section);
  md.push(``);
  md.push(`---`);
  md.push(``);
}

fs.writeFileSync(OUTPUT, md.join("\n"), "utf-8");
const elapsed = Math.round((Date.now() - totalT0) / 1000);
console.log(`\n=== 완료 (${elapsed}s) → ${OUTPUT} (${(fs.statSync(OUTPUT).size / 1024).toFixed(1)}KB) ===`);
