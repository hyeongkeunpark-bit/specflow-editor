// 테이블별 Confluence 정책·정의 문서 수확 (v2 — 쿼리 확장 + Haiku 필터)
//
// 파이프라인:
//   1. 테이블별 12~18개 쿼리 병렬 검색 → 원시 후보
//   2. 수동 seed 합치기
//   3. Haiku-2로 origin/relevant/noise 분류 + 상위 N 선별
//   4. 본문 fetch (상위만)
// 출력: scripts/harvest-output.json

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const EMAIL = process.env.ATLASSIAN_EMAIL;
const TOKEN = process.env.ATLASSIAN_API_TOKEN;
const BASE = process.env.ATLASSIAN_BASE_URL;
const AUTH = "Basic " + Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64");
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TOP_N_PER_TABLE = 10; // 최종 본문 fetch 할 문서 수

// ── 테이블별 쿼리 (훨씬 풍부하게) ──
const targets = [
  {
    table: "apply",
    queries: [
      'type=page AND title ~ "지원서 상태"',
      'type=page AND title ~ "지원" AND (title ~ "정의" OR title ~ "정책")',
      'type=page AND text ~ "apply.status"',
      'type=page AND title ~ "자동 전송"',
      'type=page AND title ~ "지원 플로우"',
      'type=page AND text ~ "chk_time"',
      'type=page AND text ~ "apply_time" AND text ~ "정의"',
      'type=page AND title ~ "접수" AND title ~ "지원"',
      'type=page AND title ~ "서류 통과" AND title ~ "지원"',
      'type=page AND text ~ "status=5" OR text ~ "status=2"',
      'type=page AND title ~ "기간만료"',
      'type=page AND title ~ "매칭 제안"',
      'type=page AND text ~ "apply table"',
      'type=page AND title ~ "취소" AND title ~ "지원"',
    ],
  },
  {
    table: "user",
    queries: [
      'type=page AND title ~ "user 정의"',
      'type=page AND (title ~ "프로필 정의" OR title ~ "프로필 단계")',
      'type=page AND text ~ "dormant_user"',
      'type=page AND title ~ "휴면" AND (title ~ "정책" OR title ~ "복귀")',
      'type=page AND title ~ "회원 상태"',
      'type=page AND title ~ "회원가입"',
      'type=page AND text ~ "leave_time"',
      'type=page AND text ~ "accept_event_email"',
      'type=page AND text ~ "job_search_intention"',
      'type=page AND title ~ "원아이디" OR title ~ "oneid"',
      'type=page AND title ~ "프로필" AND (title ~ "수집" OR title ~ "정의")',
      'type=page AND title ~ "회원 탈퇴"',
      'type=page AND text ~ "user_pref" AND text ~ "정의"',
      'type=page AND title ~ "user_pref"',
      'type=page AND title ~ "연봉 수집"',
    ],
  },
  {
    table: "resume",
    queries: [
      'type=page AND (title ~ "이력서 정의" OR title ~ "이력서 상태")',
      'type=page AND text ~ "is_written"',
      'type=page AND text ~ "is_default"',
      'type=page AND title ~ "기본 이력서"',
      'type=page AND title ~ "이력서 등록"',
      'type=page AND title ~ "이력서" AND title ~ "정책"',
      'type=page AND title ~ "매치업 이력서"',
      'type=page AND title ~ "이력서 작성"',
      'type=page AND text ~ "wanted_resume_id"',
      'type=page AND title ~ "이력서 레벨"',
      'type=page AND title ~ "이력서 임시저장"',
      'type=page AND title ~ "경력 인증"',
      'type=page AND title ~ "이력서" AND title ~ "구조"',
    ],
  },
  {
    table: "wanted_des",
    queries: [
      'type=page AND (title ~ "공고 정의" OR title ~ "공고 상태")',
      'type=page AND text ~ "wanted_des"',
      'type=page AND text ~ "is_private"',
      'type=page AND title ~ "공고 탐색"',
      'type=page AND title ~ "공고" AND title ~ "정책"',
      'type=page AND title ~ "공고 승인"',
      'type=page AND title ~ "공고 오픈" OR title ~ "공고 마감"',
      'type=page AND title ~ "포지션 상세"',
      'type=page AND text ~ "wanted_job_detail"',
      'type=page AND title ~ "공고 분류" OR title ~ "공고 태그"',
      'type=page AND title ~ "공고 재오픈"',
      'type=page AND title ~ "공고" AND title ~ "규칙"',
      'type=page AND title ~ "채용 포지션"',
    ],
  },
  {
    table: "company_des",
    queries: [
      'type=page AND text ~ "company_des"',
      'type=page AND text ~ "company_confirm"',
      'type=page AND text ~ "company_detail"',
      'type=page AND (title ~ "기업 정의" OR title ~ "기업 승인")',
      'type=page AND title ~ "블랙기업"',
      'type=page AND title ~ "기업 관리자"',
      'type=page AND title ~ "기업 온보딩"',
      'type=page AND title ~ "기업" AND (title ~ "정책" OR title ~ "규칙")',
      'type=page AND title ~ "기업 이용동의"',
      'type=page AND text ~ "company_admin"',
      'type=page AND text ~ "company_role"',
      'type=page AND title ~ "기업 검증" OR title ~ "기업 인증"',
      'type=page AND title ~ "기업 상태"',
      'type=page AND title ~ "기업 소개 페이지"',
      'type=page AND title ~ "기업 탈퇴" OR title ~ "기업 삭제"',
      'type=page AND title ~ "기업" AND title ~ "상태값"',
      'type=page AND title ~ "confirm_time"',
      'type=page AND title ~ "access_type"',
    ],
  },
  {
    table: "bookmark",
    queries: [
      'type=page AND (title ~ "북마크 정의" OR title ~ "북마크 정책")',
      'type=page AND text ~ "bookmark.flag"',
      'type=page AND title ~ "북마크"',
      'type=page AND title ~ "이직 의향"',
      'type=page AND title ~ "관심 기업" OR title ~ "관심 공고"',
      'type=page AND title ~ "저장" AND (title ~ "공고" OR title ~ "기업")',
      'type=page AND title ~ "팔로우" AND title ~ "기업"',
      'type=page AND text ~ "company_follow"',
      'type=page AND title ~ "북마크 플로우"',
      'type=page AND title ~ "북마크 이벤트"',
      'type=page AND title ~ "북마크" AND title ~ "기획"',
    ],
  },
  {
    table: "matching_score",
    queries: [
      'type=page AND (title ~ "매칭 점수" OR title ~ "매칭 알고리즘")',
      'type=page AND title ~ "서류 통과" AND title ~ "모델"',
      'type=page AND text ~ "matching_score"',
      'type=page AND (title ~ "매칭 정의" OR title ~ "matching")',
      'type=page AND title ~ "AI 점수"',
      'type=page AND title ~ "합격률"',
      'type=page AND title ~ "매칭 이력서"',
      'type=page AND title ~ "개인화" AND title ~ "추천"',
      'type=page AND title ~ "세그먼트" AND title ~ "매칭"',
      'type=page AND title ~ "매치업" AND (title ~ "정의" OR title ~ "정책")',
      'type=page AND title ~ "공고 추천"',
      'type=page AND text ~ "ai_score"',
    ],
  },
];

// ── 수동 검증된 핵심 seed ──
const MANUAL_SEEDS = {
  apply: ["74711046", "401604675", "64749833", "73564218"],
  user: ["85131300", "96567375", "73564218", "2870968509", "2961539198"],
  resume: ["85131300", "73564218", "96567375"],
  wanted_des: ["73564218", "778010642", "638189722"],
  company_des: ["73564218", "638189722", "92504141"],
  bookmark: ["4533452807"],
  matching_score: [],
};

// ── 공통: noise 제목 필터 ──
const GLOBAL_SKIP_TITLES = [
  /주간 미팅/i, /주간 스크럼/i, /데일리 스크럼/i, /업무 공유/i, /업무공유/i,
  /스탠드업/i, /회의록/i, /리더십 공유/i, /주간 스쿼드/i, /주간 공유/i,
  /제품실 (업무|공유)/i, /사업실 업무/i, /디자인실 업무/i,
  /월간 회고/i, /스프린트 회고/i, /회고록/i,
];

function cleanHl(s) { return (s || "").replace(/@@@hl@@@/g, "").replace(/@@@endhl@@@/g, "").trim(); }

async function search(cql, limit = 8) {
  const url = new URL(`${BASE}/rest/api/search`);
  url.searchParams.set("cql", cql);
  url.searchParams.set("limit", String(limit));
  try {
    const res = await fetch(url.toString(), { headers: { Authorization: AUTH, Accept: "application/json" } });
    if (!res.ok) return [];
    const d = await res.json();
    return (d.results ?? []).map((r) => ({
      id: r.content?.id ?? "",
      title: cleanHl(r.title ?? r.content?.title ?? ""),
      url: r.content?._links?.webui ? `${BASE}${r.content._links.webui}` : "",
      excerpt: cleanHl(r.excerpt ?? ""),
      lastModified: (r.lastModified ?? "").slice(0, 10),
    })).filter((x) => x.id);
  } catch {
    return [];
  }
}

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|td|th)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function fetchBody(id) {
  try {
    const res = await fetch(`${BASE}/rest/api/content/${id}?expand=body.view,version,space`, { headers: { Authorization: AUTH, Accept: "application/json" } });
    if (!res.ok) return { body: "", version: "", title: "", url: "" };
    const d = await res.json();
    return {
      body: stripHtml(d?.body?.view?.value ?? ""),
      version: (d?.version?.when ?? "").slice(0, 10),
      title: d?.title ?? "",
      url: d?._links?.webui ? `${BASE}${d._links.webui}` : "",
    };
  } catch {
    return { body: "", version: "", title: "", url: "" };
  }
}

// ── Haiku-2: 후보들을 origin/relevant/noise 분류 ──
const FILTER_SYSTEM = `당신은 문서 큐레이터다. 주어진 Confluence 후보 문서 목록(제목+수정일+excerpt)을 보고, 특정 DB 테이블의 **운영 규칙·정책·특이사항·정의** 가 담겼을 가능성이 높은 문서만 선별한다.

**평가 기준 (분류):**
- "relevant": 테이블과 직접 관련된 정의/정책/규칙/히스토리. 관련성 점수 1~10.
- "noise": 회의록, 실험 UI 기획(정책 아님), 마케팅 캠페인, 옛날 로드맵, 개발 로그 등.

**신선도:**
- 2026: 정상
- 2024~2025: 정상
- 2021~2023: -1점
- 2020 이하: 매우 중요한 표준/정의가 아니면 -3점
- **단, "(seed)"로 표시된 문서는 수동 검증된 것이므로 반드시 최소 score 8로 포함.**

**출력:**
- JSON 객체만. 설명·마크다운 코드블록 금지.
- 형식: { "selected": [{ "idx": 숫자, "score": 1~10, "reason": "짧은 한 줄" }] }
- selected는 score 내림차순 최대 ${TOP_N_PER_TABLE}개.
- score 6 미만은 제외.`;

async function classifyAndRank(table, candidates) {
  if (candidates.length === 0) return [];
  const now = new Date();
  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const cardsText = candidates.map((c, i) =>
    `[${i}]${c._seed ? " (seed)" : ""} ${c.title}\n    수정: ${c.lastModified || "?"}\n    excerpt: ${c.excerpt.slice(0, 250)}`
  ).join("\n\n");
  const userMsg = `# 테이블: ${table}
# 현재 시점: ${currentYm}

# 후보 문서 (${candidates.length}개)

${cardsText}

각 후보의 관련성을 판정하고 최대 ${TOP_N_PER_TABLE}개를 score 내림차순으로 선정해라. JSON 객체로만.`;

  try {
    const t0 = Date.now();
    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: FILTER_SYSTEM,
      messages: [{ role: "user", content: userMsg }],
    });
    const text = resp.content.find((b) => b.type === "text")?.text ?? "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return [];
    const parsed = JSON.parse(m[0]);
    const u = resp.usage;
    console.log(`  [filter:${table}] ${Date.now() - t0}ms | in:${u.input_tokens} out:${u.output_tokens} | selected ${parsed.selected?.length ?? 0}`);
    return parsed.selected ?? [];
  } catch (err) {
    console.error(`  [filter:${table}] ERR:`, err.message);
    return [];
  }
}

// ── 테이블별 메인 ──
async function harvestForTable(target) {
  console.log(`\n━━━ ${target.table} ━━━`);

  // 1. 쿼리 병렬 검색
  const searchResults = await Promise.all(target.queries.map((q) => search(q, 8)));
  const searchHitsCount = searchResults.reduce((s, rs) => s + rs.length, 0);

  // 2. dedupe + noise 필터
  const byId = new Map();
  for (const rs of searchResults) {
    for (const r of rs) {
      if (!r.id) continue;
      if (GLOBAL_SKIP_TITLES.some((re) => re.test(r.title))) continue;
      if (!byId.has(r.id)) byId.set(r.id, r);
    }
  }

  // 3. seed 보강 (검색 미등장이어도 포함)
  const seeds = MANUAL_SEEDS[target.table] ?? [];
  for (const sid of seeds) {
    if (!byId.has(sid)) {
      byId.set(sid, { id: sid, title: "(seed — 메타 대기중)", url: "", excerpt: "", lastModified: "", _seed: true });
    } else {
      byId.get(sid)._seed = true;
    }
  }

  console.log(`  검색 hits ${searchHitsCount}, dedupe 후 ${byId.size}, seed ${seeds.length}`);

  // 3.5. seed 문서의 메타 (title/url/date)를 먼저 채워야 Haiku filter가 판정 가능
  const seedsNeedingMeta = [...byId.values()].filter((c) => c._seed && c.title === "(seed — 메타 대기중)");
  if (seedsNeedingMeta.length > 0) {
    const metas = await Promise.all(seedsNeedingMeta.map((c) => fetchBody(c.id)));
    seedsNeedingMeta.forEach((c, i) => {
      c.title = metas[i].title || c.title;
      c.url = metas[i].url;
      c.lastModified = metas[i].version;
      c._prefetchedBody = metas[i].body; // 나중에 body fetch 중복 방지
    });
  }

  // 4. Haiku-2 분류/랭킹
  const candidatesArr = [...byId.values()];
  const selected = await classifyAndRank(target.table, candidatesArr);
  const picked = selected.map((s) => ({ ...candidatesArr[s.idx], score: s.score, reason: s.reason })).filter(Boolean);

  // 5. 본문 fetch (prefetch 된 건 재사용)
  const needBody = picked.filter((c) => !c._prefetchedBody);
  const bodies = await Promise.all(needBody.map((c) => fetchBody(c.id)));
  const bodyMap = new Map(needBody.map((c, i) => [c.id, bodies[i]]));

  const docs = picked.map((c) => {
    const body = c._prefetchedBody ?? bodyMap.get(c.id)?.body ?? "";
    return {
      id: c.id,
      title: c.title,
      url: c.url,
      lastModified: c.lastModified,
      excerpt: c.excerpt,
      score: c.score,
      reason: c.reason,
      body: body.slice(0, 6000),
      fullLength: body.length,
    };
  });

  console.log(`  → 최종 ${docs.length}건`);
  for (const d of docs) console.log(`    [${d.score}] [${d.lastModified}] ${d.title}`);

  return { table: target.table, candidatesCount: byId.size, docs };
}

// ── 메인 ──
const t0 = Date.now();
const results = [];
for (const target of targets) {
  results.push(await harvestForTable(target));
}
const elapsed = Math.round((Date.now() - t0) / 1000);

const output = {
  generated: new Date().toISOString(),
  elapsed_sec: elapsed,
  tables: results,
};
const outPath = path.join(__dirname, "harvest-output.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf-8");
console.log(`\n=== 완료 (${elapsed}s) → ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)}KB) ===`);
