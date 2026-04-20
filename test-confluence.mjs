// Phase 3 파이프라인 end-to-end 테스트
// server.ts의 gatherConfluenceContext 전체 로직을 여기서 재현해서 동작 확인

import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
dotenv.config();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── 환경변수 로드 ──
const env = (() => {
  const email = process.env.ATLASSIAN_EMAIL;
  const token = process.env.ATLASSIAN_API_TOKEN;
  const base = process.env.ATLASSIAN_BASE_URL;
  const spaceKeys = (process.env.CONFLUENCE_SPACE_KEYS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const rootPageId = (process.env.CONFLUENCE_ROOT_PAGE_ID ?? "").trim();
  if (!email || !token || !base || spaceKeys.length === 0) throw new Error("env missing");
  return { email, token, base, spaceKeys, rootPageId, auth: "Basic " + Buffer.from(`${email}:${token}`).toString("base64") };
})();

// ── System prompts (server.ts와 동일) ──
const HAIKU_AREA_SYSTEM = `당신은 제품 Spec에서 **의사결정이 필요한 영역**을 식별하는 분석가다.

입력된 Spec이 **건드리는 모든 영역**을 짧은 한국어 phrase로 뽑아라. 결정을 **내렸든 침묵했든** 무관하다. Confluence 지식 베이스에서 과거 선행 결정/정책을 찾기 위한 검색 앵커로 쓰인다.

**포함할 것 (영역):**
- 사용자 상태별 분기 영역: "비로그인 접근", "이력서 등록 판단"
- 데이터 선정·카운팅 기준: "매력 기업 선정 기준", "공고 카운팅 기준"
- UX 흐름 영역: "회원가입 유도", "로그인 유도 UX"
- 실험/측정 영역: "A/B 쿠키 유지", "GTM 이벤트 정의"
- 범위·정책 경계: "기업 상세 이동", "에러 처리"

**제외할 것:**
- 구현 디테일 (debounce, 로딩 UI 등)
- 너무 일반적 단어 ("공고", "기능")
- Spec 문장 그대로 복사

**출력 규칙:**
- JSON 배열만. 설명·마크다운 코드블록 금지.
- 각 phrase **2~4어절** 한국어 (영어 고유명사 허용: A/B, GTM, API)
- 3~5개

**예시:**

Spec: "채용 공고 상세에서 비로그인도 접근 가능. 지원 버튼 누르면 로그인 유도. 이력서 등록 여부로 분기."
출력: ["비로그인 접근","로그인 유도 UX","이력서 등록 판단","지원 버튼 분기"]

Spec: "매력 기업 섹션을 홈에 추가. A/B 테스트 쿠키 30일. 대조군은 기존 홈."
출력: ["매력 기업 선정","섹션 노출 순서","A/B 쿠키 유지","대조군 처리"]`;

const HAIKU_FILTER_SYSTEM = `당신은 문서 큐레이터다. 입력으로 주어진 현재 Spec과 Confluence 후보 문서 목록(제목+excerpt)을 보고, **선행 정책/결정 비교**에 쓸 만한 문서를 고른다.

**평가 기준:**
- 각 후보에 대해 3가지 판정:
  - "origin": 이 문서가 **현재 Spec의 원본/복제본**으로 보임 (제목·내용이 거의 동일). 비교 대상 아니므로 **제외**.
  - "relevant": 현재 Spec이 다루는 영역에 대해 **과거 결정·정책·가이드**를 담고 있음. 관련성 점수 1~10 부여.
  - "noise": 회의록, 관련 없는 기획, 로드맵, 회고 등. **제외**.

**출력 규칙:**
- JSON 객체만. 설명 금지.
- 형식: { "selected": [{ "idx": 숫자, "score": 1~10, "reason": "짧은 한 줄" }], "excluded_origin": [idx...], "excluded_noise": [idx...] }
- selected는 **score 내림차순, 최대 5개**. 없으면 빈 배열.
- score 7 미만은 가급적 제외.`;

const HAIKU_POSITION_SYSTEM = `당신은 정책 문서 분석가다. 주어진 Confluence 본문이 **특정 영역들에 대해 어떤 입장을 취하는지**만 추출한다.

**작업:**
- 각 본문 × 각 영역 조합에 대해:
  - 해당 본문에 그 영역에 대한 **구체적 결정/기준/정책**이 있으면 position 문자열로 요약 (1~2문장)
  - 짧은 **원문 발췌** (quote, 100~300자) 첨부
  - 없으면 position/quote 모두 null

**규칙:**
- JSON 객체만. 설명 금지.
- 형식: { "docs": [{ "idx": 숫자, "findings": [{ "area": "영역명", "position": "...", "quote": "..." }] }] }
- 한 본문에서 findings가 빈 배열이어도 OK (영역에 대해 아무 말 안 함 = 정상)
- **추측 금지.** 본문에 없는 내용을 만들지 말라.`;

// ── 파이프라인 단계들 ──

async function extractAreas(specText) {
  const trimmed = specText.length > 8000 ? specText.slice(0, 8000) : specText;
  const t0 = Date.now();
  const resp = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    system: HAIKU_AREA_SYSTEM,
    messages: [{ role: "user", content: `아래 Spec이 건드리는 영역을 JSON 배열로만 출력해라.\n\n${trimmed}` }],
  });
  const text = resp.content.find(b => b.type === "text")?.text ?? "";
  const m = text.match(/\[[\s\S]*?\]/);
  const areas = m ? JSON.parse(m[0]).filter(x => typeof x === "string").map(s => s.trim()).slice(0, 5) : [];
  console.log(`[haiku-1] ${Date.now()-t0}ms | in:${resp.usage.input_tokens} out:${resp.usage.output_tokens}`);
  return areas;
}

async function searchBroad(areas, perArea = 5) {
  const spaceClause = env.spaceKeys.length === 1 ? `space = "${env.spaceKeys[0]}"` : `space in (${env.spaceKeys.map(k => `"${k}"`).join(",")})`;
  const ancestorClause = env.rootPageId ? ` AND ancestor = ${env.rootPageId}` : "";
  const runOne = async (area) => {
    const cql = `${spaceClause}${ancestorClause} AND type = page AND text ~ "${area.replace(/"/g, '\\"')}"`;
    const url = new URL(`${env.base}/rest/api/search`);
    url.searchParams.set("cql", cql);
    url.searchParams.set("limit", String(perArea));
    const res = await fetch(url.toString(), { headers: { Authorization: env.auth, Accept: "application/json" } });
    if (!res.ok) return { area, results: [] };
    const d = await res.json();
    return { area, results: d.results ?? [] };
  };
  const t0 = Date.now();
  const all = await Promise.all(areas.map(runOne));
  const byId = new Map();
  for (const { area, results } of all) {
    for (const r of results) {
      const id = r.content?.id ?? "";
      if (!id) continue;
      const webui = r.content?._links?.webui ?? r._links?.webui ?? "";
      const excerpt = (r.excerpt ?? "").replace(/@@@hl@@@/g, "").replace(/@@@endhl@@@/g, "").trim();
      const existing = byId.get(id);
      if (existing) {
        if (!existing.matchedAreas.includes(area)) existing.matchedAreas.push(area);
      } else {
        byId.set(id, { id, title: r.title ?? r.content?.title ?? "", url: webui ? `${env.base}${webui}` : "", excerpt, matchedAreas: [area] });
      }
    }
  }
  const candidates = [...byId.values()];
  console.log(`[confluence-broad] ${Date.now()-t0}ms | ${areas.length}영역 → ${candidates.length}후보`);
  return candidates;
}

async function classifyAndRank(specText, candidates) {
  const specSnippet = specText.length > 3000 ? specText.slice(0, 3000) : specText;
  const candText = candidates.map((c, i) => `[${i}] ${c.title}\n    매칭영역: ${c.matchedAreas.join(", ")}\n    excerpt: ${c.excerpt.slice(0, 300)}`).join("\n\n");
  const userMsg = `# 현재 Spec (앞 3000자)\n${specSnippet}\n\n# Confluence 후보 (총 ${candidates.length}개)\n${candText}\n\n위 후보들을 origin/relevant/noise로 분류하고, relevant만 score 내림차순 최대 5개 선정해라. JSON 객체로만 출력.`;
  const t0 = Date.now();
  const resp = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1200,
    system: HAIKU_FILTER_SYSTEM,
    messages: [{ role: "user", content: userMsg }],
  });
  const text = resp.content.find(b => b.type === "text")?.text ?? "";
  const m = text.match(/\{[\s\S]*\}/);
  const parsed = m ? JSON.parse(m[0]) : { selected: [], excluded_origin: [], excluded_noise: [] };
  console.log(`[haiku-2] ${Date.now()-t0}ms | in:${resp.usage.input_tokens} out:${resp.usage.output_tokens} | selected:${parsed.selected?.length ?? 0} origin:${parsed.excluded_origin?.length ?? 0} noise:${parsed.excluded_noise?.length ?? 0}`);
  return parsed;
}

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|td|th)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchBodies(ids, capChars = 5000) {
  const fetchOne = async (id) => {
    const res = await fetch(`${env.base}/rest/api/content/${id}?expand=body.view`, { headers: { Authorization: env.auth, Accept: "application/json" } });
    if (!res.ok) return [id, ""];
    const d = await res.json();
    const t = stripHtml(d?.body?.view?.value ?? "");
    return [id, t.length > capChars ? t.slice(0, capChars) + "\n... (생략)" : t];
  };
  const t0 = Date.now();
  const pairs = await Promise.all(ids.map(fetchOne));
  const total = pairs.reduce((s, [,v]) => s + v.length, 0);
  console.log(`[confluence-body] ${Date.now()-t0}ms | ${ids.length}건 | 본문 ${total}자`);
  return new Map(pairs);
}

async function extractPositions(areas, selected) {
  const docsText = selected.map((s, i) => `[${i}] ${s.candidate.title}\n--- 본문 ---\n${s.body}\n--- 끝 ---`).join("\n\n");
  const userMsg = `# 분석할 영역 (${areas.length}개)\n${areas.map((a, i) => `${i + 1}. ${a}`).join("\n")}\n\n# 본문 (${selected.length}개)\n${docsText}\n\n각 본문이 각 영역에 대해 취하는 입장을 JSON 객체로만 출력해라.`;
  const t0 = Date.now();
  const resp = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 3000,
    system: HAIKU_POSITION_SYSTEM,
    messages: [{ role: "user", content: userMsg }],
  });
  const text = resp.content.find(b => b.type === "text")?.text ?? "";
  const m = text.match(/\{[\s\S]*\}/);
  const parsed = m ? JSON.parse(m[0]) : { docs: [] };
  const total = parsed.docs?.reduce((s, d) => s + (d.findings?.length ?? 0), 0) ?? 0;
  console.log(`[haiku-3] ${Date.now()-t0}ms | in:${resp.usage.input_tokens} out:${resp.usage.output_tokens} | findings: ${total}`);
  return parsed;
}

function format(areas, selected, positions) {
  const byArea = new Map();
  for (const a of areas) byArea.set(a, []);
  for (const d of positions.docs ?? []) {
    const src = selected[d.idx];
    if (!src) continue;
    for (const f of d.findings ?? []) {
      if (!f.area || !f.position) continue;
      const list = byArea.get(f.area) ?? [];
      list.push({ title: src.candidate.title, url: src.candidate.url, position: f.position, quote: f.quote ?? "" });
      byArea.set(f.area, list);
    }
  }
  const blocks = areas.map(area => {
    const fs = byArea.get(area) ?? [];
    if (fs.length === 0) return `## 영역: ${area}\n- **Confluence 선행 결정: 없음**`;
    const items = fs.map(f => {
      const q = f.quote ? `\n  - 원문 발췌: "${f.quote.replace(/\n+/g, " ").slice(0, 300)}"` : "";
      return `- [${f.title}](${f.url})\n  - 입장: ${f.position}${q}`;
    }).join("\n");
    return `## 영역: ${area}\n${items}`;
  });
  return `[참고: Confluence 선행 결정 비교 — ${areas.length}개 영역, ${selected.length}개 문서]\n\n${blocks.join("\n\n")}`;
}

// ── 실행 ──
const sampleSpec = `
# 채용 공고 지도 뷰 기획

## 목적
구직자가 자신의 위치 주변의 채용 공고를 지도 위에서 탐색할 수 있는 신규 화면을 제공한다.

## 요구사항
- 지도 위에 채용 공고를 마커로 표시한다.
- 마커 클릭 시 하단 시트에 공고 카드 목록이 열린다.
- 비로그인 사용자도 지도 뷰와 공고 상세에 접근 가능하다.
- 지원 버튼 클릭 시 로그인 유도 팝업 노출.
- 공고 카드는 기본적으로 거리순 정렬. 로그인 유저는 매칭 점수 기반 매칭순도 선택 가능.
- 리스트 뷰에서 설정한 필터(직무, 경력, 고용 형태)가 지도 뷰에도 적용된다.

## Out of Scope
- 저장/관심 기능 (북마크)
- 해외 공고
`;

console.log("=== Phase 3 E2E 테스트 ===\n");
const pT0 = Date.now();

const areas = await extractAreas(sampleSpec);
console.log("[areas]", areas, "\n");

const candidates = await searchBroad(areas, 5);
console.log(`[candidates] ${candidates.length}건:`, candidates.map(c => c.title), "\n");

const filter = await classifyAndRank(sampleSpec, candidates);
console.log("[filter selected]", filter.selected);
console.log("[filter excluded origin]", filter.excluded_origin);
console.log("[filter excluded noise]", filter.excluded_noise, "\n");

const pickedIdxs = (filter.selected ?? []).filter(s => s.score >= 6).slice(0, 5).map(s => s.idx);
const picked = pickedIdxs.map(i => candidates[i]).filter(Boolean);
console.log(`[picked] ${picked.length}건:`, picked.map(p => p.title), "\n");

if (picked.length === 0) {
  console.log("❌ picked 0건 — 주입 포기");
  process.exit(0);
}

const bodies = await fetchBodies(picked.map(p => p.id), 5000);
const selected = picked.map(c => ({ candidate: c, body: bodies.get(c.id) ?? "" })).filter(s => s.body.length > 0);
console.log(`[bodies] ${selected.length}건 본문 확보\n`);

const positions = await extractPositions(areas, selected);
console.log("[positions]", JSON.stringify(positions, null, 2), "\n");

const ctx = format(areas, selected, positions);
console.log(`\n=== 최종 Sonnet 주입 컨텍스트 (${ctx.length}자) ===\n`);
console.log(ctx);
console.log(`\n=== 전체 소요: ${Date.now() - pT0}ms ===`);
