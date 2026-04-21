import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.SERVER_PORT || 3001;
const DEFAULT_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
const ALLOWED_MODELS = new Set(["claude-sonnet-4-6", "claude-opus-4-6", "claude-opus-4-7"]);

app.use(express.json({ limit: "5mb" }));

// ── Claude API 클라이언트 ──
// extended-cache-ttl-2025-04-11: Spec 블록에 1h TTL 캐시 적용용 beta 헤더
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: { "anthropic-beta": "extended-cache-ttl-2025-04-11" },
});

// ── 시스템 프롬프트 + 지식 파일 로드 ──
// 리터럴 경로로 읽어야 @vercel/nft가 파일을 번들에 포함함
function readFileWithLiteralPath(filename: string): string {
  // nft가 추적 가능한 리터럴 매핑
  const fileMap: Record<string, string> = {
    "prompt-v4-prototype-first.md": path.join(__dirname, "prompt-v4-prototype-first.md"),
    "product-spec-v2-template.txt": path.join(__dirname, "product-spec-v2-template.txt"),
    "wanted-db-knowledge.md": path.join(__dirname, "wanted-db-knowledge.md"),
    "wanted-db-catalog.md": path.join(__dirname, "wanted-db-catalog.md"),
    "wanted-db-context.md": path.join(__dirname, "wanted-db-context.md"),
    "wanted-db-index.json": path.join(__dirname, "wanted-db-index.json"),
  };
  const filePath = fileMap[filename];
  if (!filePath) throw new Error(`알 수 없는 파일: ${filename}`);
  return fs.readFileSync(filePath, "utf-8");
}

// nft 정적 분석 힌트 — 이 줄이 있어야 Vercel이 파일을 번들에 포함
path.join(__dirname, "prompt-v4-prototype-first.md");
path.join(__dirname, "product-spec-v2-template.txt");
path.join(__dirname, "wanted-db-knowledge.md");
path.join(__dirname, "wanted-db-catalog.md");
path.join(__dirname, "wanted-db-context.md");
path.join(__dirname, "wanted-db-index.json");

function loadSystemPrompt(): string {
  let prompt = "";
  try {
    prompt = readFileWithLiteralPath("prompt-v4-prototype-first.md");
  } catch (err) {
    console.error("[server] ❌ 시스템 프롬프트 로드 실패:", (err as Error).message);
    prompt = "당신은 Product Spec 작성과 Prototype 생성을 돕는 AI 에이전트입니다.";
    console.error("[server] ⚠️ 폴백 프롬프트 사용 중 (정상 동작 불가)");
  }

  try {
    const knowledge = readFileWithLiteralPath("product-spec-v2-template.txt");
    prompt += "\n\n---\n\n# Knowledge: Product Spec 템플릿\n\n" + knowledge;
  } catch (err) {
    console.error("[server] ❌ 지식 파일 로드 실패:", (err as Error).message);
  }

  console.log(`[server] 시스템 프롬프트 로드 완료: ${prompt.length}자`);
  return prompt;
}

// ── 헬스체크 ──
app.get("/api/health", (_req, res) => {
  const prompt = loadSystemPrompt();
  res.json({
    status: prompt.length > 100 ? "ok" : "error",
    promptLength: prompt.length,
    env: process.env.VERCEL ? "vercel" : "local",
  });
});

// ── DB 지식 조회 도구 ──

function loadDbKnowledge(): string {
  try {
    return readFileWithLiteralPath("wanted-db-knowledge.md");
  } catch (err) {
    console.warn("[db-knowledge] 파일 로드 실패:", (err as Error).message);
    return "";
  }
}

// ── Metrics 수집 (Google Sheets Apps Script 웹훅으로 fire-and-forget POST) ──
// 환경변수 METRICS_WEBHOOK_URL 없으면 skip. 실패해도 AI 응답 영향 없음.

function hashSession(sid?: string): string {
  if (!sid) return "";
  return crypto.createHash("sha1").update(sid).digest("hex").slice(0, 8);
}

type MetricPayload = {
  timestamp?: string;
  duration_sec?: number;
  model?: string;
  stop_reason?: string;
  output_chars?: number;
  input_tokens?: number;
  output_tokens?: number;
  cache_read?: number;
  cache_write?: number;
  endpoint?: string;
  include_db?: boolean;
  session_hash?: string;
};

function pushMetric(payload: MetricPayload): void {
  const url = process.env.METRICS_WEBHOOK_URL;
  if (!url) return;

  const body = { timestamp: new Date().toISOString(), ...payload };
  // fire-and-forget: await 하지 않음, 실패해도 응답 흐름 영향 0
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: controller.signal,
  })
    .then((r) => {
      if (!r.ok) console.warn(`[metrics] webhook ${r.status}`);
    })
    .catch((err) => {
      if (err.name !== "AbortError") console.warn(`[metrics] ${err.message}`);
    })
    .finally(() => clearTimeout(timer));
}

// ── DB 카탈로그/맥락 런타임 선별 주입 (Stage 2) ──
//
// 구조:
//   wanted-db-index.json    → 테이블 메타 (Haiku 선별 input)
//   wanted-db-catalog.md    → 스키마 블록 (테이블별 ### ` ` 섹션)
//   wanted-db-context.md    → 운영 맥락 블록 (테이블별 # 📂 섹션)
//
// 서버 시작 시 파싱해서 메모리 Map에 캐싱.

type DbIndexEntry = { id: string; dataset: string; name: string; category: string; summary: string; has_notes: boolean; column_count: number };
type DbCache = {
  index: DbIndexEntry[] | null;
  catalogBlocks: Map<string, string>; // key: "dataset.name"
  contextBlocks: Map<string, string>; // key: table name
  loaded: boolean;
};
const dbCache: DbCache = { index: null, catalogBlocks: new Map(), contextBlocks: new Map(), loaded: false };

function parseCatalogBlocks(md: string): Map<string, string> {
  // catalog.md: "## 📦 \`{dataset}\` (N개 테이블)" → "### \`{table}\` " blocks
  const blocks = new Map<string, string>();
  const lines = md.split("\n");
  let currentDataset = "";
  let currentTable = "";
  let buffer: string[] = [];

  const flush = () => {
    if (currentDataset && currentTable) {
      const key = `${currentDataset}.${currentTable}`;
      blocks.set(key, buffer.join("\n").trim());
    }
    buffer = [];
  };

  for (const line of lines) {
    const dsMatch = line.match(/^## 📦 `([^`]+)`/);
    if (dsMatch) {
      flush();
      currentDataset = dsMatch[1];
      currentTable = "";
      continue;
    }
    const tblMatch = line.match(/^### `([^`]+)`/);
    if (tblMatch) {
      flush();
      currentTable = tblMatch[1];
      buffer.push(line); // 헤더 포함
      continue;
    }
    if (/^---\s*$/.test(line)) {
      flush();
      currentTable = "";
      continue;
    }
    if (currentTable) buffer.push(line);
  }
  flush();
  return blocks;
}

function parseContextBlocks(md: string): Map<string, string> {
  // context.md: "# 📂 {table_name}" blocks
  const blocks = new Map<string, string>();
  const parts = md.split(/^# 📂 /m);
  for (const part of parts.slice(1)) { // first part is header matter
    const firstLineEnd = part.indexOf("\n");
    const name = part.slice(0, firstLineEnd).trim();
    let body = part.slice(firstLineEnd + 1).trim();
    // 다음 섹션 시작 전까지만 (--- 구분선 처리)
    const sepIdx = body.lastIndexOf("\n---\n");
    if (sepIdx !== -1) body = body.slice(0, sepIdx).trim();
    blocks.set(name, body);
  }
  return blocks;
}

function ensureDbCache(): void {
  if (dbCache.loaded) return;
  try {
    const indexRaw = readFileWithLiteralPath("wanted-db-index.json");
    const indexData = JSON.parse(indexRaw);
    dbCache.index = indexData.tables ?? [];

    const catalogMd = readFileWithLiteralPath("wanted-db-catalog.md");
    dbCache.catalogBlocks = parseCatalogBlocks(catalogMd);

    const contextMd = readFileWithLiteralPath("wanted-db-context.md");
    dbCache.contextBlocks = parseContextBlocks(contextMd);

    dbCache.loaded = true;
    console.log(`[db-cache] 로드 완료 — index: ${dbCache.index?.length ?? 0}, catalog: ${dbCache.catalogBlocks.size}, context: ${dbCache.contextBlocks.size}`);
  } catch (err) {
    console.warn("[db-cache] 로드 실패:", (err as Error).message);
    dbCache.loaded = false;
  }
}

// Haiku — Spec 보고 관련 테이블 선별
const DB_SELECT_SYSTEM = `당신은 DB 테이블 선별기다. 주어진 Spec과 사용 가능한 DB 테이블 목록을 보고, 이 Spec의 **Use Case 갭 분석에 참고할 테이블**을 최대 10개 선정한다.

**선정 기준:**
- Spec이 직접 건드리는 기능·엔티티 (예: 공고 기능 → wanted_des, 지원 → apply)
- Spec이 암묵적으로 의존하는 맥락 (예: 로그인 플로우 → user, 이력서 기반 매칭 → resume + matching_score)
- 정책·운영 규칙이 중요할 가능성 있는 테이블 (has_notes=true 우선)

**제외:**
- 전혀 무관한 도메인 (예: Spec이 채용인데 교육·긱스)
- 분석용 mart 테이블 (Spec이 지표 분석일 때만 포함)

**출력:**
- JSON 배열만. 테이블 ID (dataset.name) 형식.
- 최대 10개, 관련도 내림차순.
- 예: ["wanteddb.apply","wanteddb.user","wanteddb.resume"]

**규칙:**
- 없으면 빈 배열.
- 설명·마크다운 코드블록 금지.
- id는 반드시 제공 목록에 존재하는 것만.`;

async function selectRelevantTables(specText: string): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [];
  ensureDbCache();
  if (!dbCache.index || dbCache.index.length === 0) return [];

  const spec = specText.length > 6000 ? specText.slice(0, 6000) : specText;
  // 테이블 메타 컴팩트 포맷 (id | category | summary)
  const tablesJson = dbCache.index
    .map((t) => `${t.id} | ${t.category} | ${t.summary}${t.has_notes ? " (맥락있음)" : ""}`)
    .join("\n");

  try {
    const t0 = Date.now();
    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: DB_SELECT_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            // 정적 테이블 목록 → prompt cache (5분 TTL) 로 비용 절감
            { type: "text", text: `# 사용 가능한 DB 테이블 (${dbCache.index.length}개)\n\n${tablesJson}`, cache_control: { type: "ephemeral" } },
            { type: "text", text: `# Spec\n\n${spec}\n\n위 Spec 분석에 참고할 테이블 최대 10개를 JSON 배열로만 출력해라.` },
          ],
        },
      ],
    });
    const textBlock = resp.content.find((b) => b.type === "text");
    const text = textBlock && "text" in textBlock ? textBlock.text : "";
    const m = text.match(/\[[\s\S]*?\]/);
    if (!m) {
      console.warn("[db-select] JSON 파싱 실패:", text.slice(0, 200));
      return [];
    }
    const parsed = JSON.parse(m[0]);
    if (!Array.isArray(parsed)) return [];
    const validIds = new Set(dbCache.index.map((t) => t.id));
    const selected = parsed.filter((x) => typeof x === "string" && validIds.has(x)).slice(0, 10);
    const u = resp.usage as any;
    console.log(`[db-select] ${Date.now() - t0}ms | in:${u?.input_tokens} (cache_read:${u?.cache_read_input_tokens ?? 0}, cache_write:${u?.cache_creation_input_tokens ?? 0}) out:${u?.output_tokens} | selected: ${JSON.stringify(selected)}`);
    return selected;
  } catch (err: any) {
    console.error("[db-select] ERROR:", err.message);
    return [];
  }
}

function buildStructuredDbContext(tableIds: string[]): string {
  if (tableIds.length === 0) return "";
  ensureDbCache();

  const blocks: string[] = [];
  for (const id of tableIds) {
    const [dataset, name] = id.split(".");
    const catalogBlock = dbCache.catalogBlocks.get(id);
    const contextBlock = dbCache.contextBlocks.get(name);
    if (!catalogBlock && !contextBlock) continue;

    const parts: string[] = [];
    parts.push(`## 📦 ${id}`);
    if (catalogBlock) parts.push(catalogBlock);
    if (contextBlock) {
      parts.push(``);
      parts.push(`### 🧭 운영 맥락 / 정책`);
      parts.push(contextBlock);
    }
    blocks.push(parts.join("\n"));
  }
  if (blocks.length === 0) return "";

  return `[참고: DB 구조 + 운영 맥락 — ${blocks.length}개 테이블 선별 주입]

아래는 현재 Spec이 건드리는 것으로 판정된 테이블의 스키마(컬럼 목록)와 운영 맥락(정책·규칙·특이사항)이다.
Use Case 갭 분석 시:
- 스키마에 있는 필드/컬럼 중 Spec이 언급 안 한 것 → 고려 누락 여부 검토
- 운영 맥락 섹션의 규칙 → Spec 결정과의 충돌 또는 반영 여부 확인
- 오래된 문서(⏰ 마커)는 현행 정책 확인 필요

${blocks.join("\n\n---\n\n")}`;
}

// 런타임 DB 컨텍스트 수집 (Haiku 선별 → 구조화 주입). 실패 시 빈 문자열 반환 (fallback은 호출측에서 처리).
async function gatherDbContext(userText: string): Promise<string> {
  const t0 = Date.now();
  const ids = await selectRelevantTables(userText);
  if (ids.length === 0) return "";
  const ctx = buildStructuredDbContext(ids);
  console.log(`[db-pipeline] 총 ${Date.now() - t0}ms | ${ids.length}개 테이블 → ${ctx.length}자 주입`);
  return ctx;
}

// ── Confluence 탐색 (Phase 3: 결정 비교 기반) ──
//
// 파이프라인:
//   1. [Haiku-1] Spec → 건드리는 "영역" 3~5개 (짧은 phrase)
//   2. [Confluence] 영역별 병렬 검색 → dedupe 후보 ~20건 (excerpt만)
//   3. [Haiku-2] origin/noise 필터 + 랭킹 → top 3~5
//   4. [Confluence] top 3~5 본문 fetch + HTML strip
//   5. [Haiku-3] 각 본문에서 영역별 "입장" 추출
//   6. 구조화 포맷으로 Sonnet에 주입
// 실패 시: 빈도 기반 excerpt v1 fallback

const KO_STOPWORDS = new Set([
  "있다","없다","하는","되는","대한","기능","페이지","화면","사용자","유저","서비스",
  "기획","정책","다음","이후","이전","해당","또는","그리고","있음","없음","필요","가능",
  "경우","내용","설정","제공","표시","노출","버튼","영역","입력","선택","확인","클릭",
  "추가","삭제","변경","수정","상태","정보","대한","위한","통해","관련","항목","기본",
]);

function extractKeywords(text: string, topN = 5): string[] {
  if (!text) return [];
  const tokens = text.match(/[가-힣]{2,10}|[A-Za-z]{3,15}/g) ?? [];
  const freq = new Map<string, number>();
  for (const raw of tokens) {
    const tok = raw.toLowerCase();
    if (KO_STOPWORDS.has(raw)) continue;
    if (/^[a-z]+$/.test(tok) && tok.length < 4) continue;
    freq.set(tok, (freq.get(tok) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([w]) => w);
}

// Confluence 환경변수 묶음 로드
type ConfluenceEnv = { email: string; token: string; base: string; spaceKeys: string[]; rootPageId: string; auth: string };
function loadConfluenceEnv(): ConfluenceEnv | null {
  const email = process.env.ATLASSIAN_EMAIL;
  const token = process.env.ATLASSIAN_API_TOKEN;
  const base = process.env.ATLASSIAN_BASE_URL;
  const spaceKeys = (process.env.CONFLUENCE_SPACE_KEYS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const rootPageId = (process.env.CONFLUENCE_ROOT_PAGE_ID ?? "").trim();
  if (!email || !token || !base || spaceKeys.length === 0) return null;
  const auth = "Basic " + Buffer.from(`${email}:${token}`).toString("base64");
  return { email, token, base, spaceKeys, rootPageId, auth };
}

// ── 1단계: Haiku로 "영역" 추출 (결정/침묵 무관) ──
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

async function extractAreasWithHaiku(specText: string): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [];
  const trimmed = specText.length > 8000 ? specText.slice(0, 8000) : specText;
  try {
    const t0 = Date.now();
    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: HAIKU_AREA_SYSTEM,
      messages: [{ role: "user", content: `아래 Spec이 건드리는 영역을 JSON 배열로만 출력해라.\n\n${trimmed}` }],
    });
    const textBlock = resp.content.find((b) => b.type === "text");
    const text = textBlock && "text" in textBlock ? textBlock.text : "";
    const jsonMatch = text.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
      console.warn("[haiku-1] JSON 파싱 실패:", text.slice(0, 200));
      return [];
    }
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];
    const areas = parsed
      .filter((x: unknown) => typeof x === "string")
      .map((s: string) => s.trim())
      .filter((s: string) => s.length >= 2 && s.length <= 30)
      .slice(0, 5);
    const u = resp.usage as any;
    console.log(`[haiku-1] ${Date.now() - t0}ms | in:${u?.input_tokens} out:${u?.output_tokens} | areas: ${JSON.stringify(areas)}`);
    return areas;
  } catch (err: any) {
    console.error("[haiku-1] ERROR:", err.message);
    return [];
  }
}

// ── 2단계: 영역별 병렬 Confluence 검색 + dedupe ──
type Candidate = { id: string; title: string; url: string; excerpt: string; matchedAreas: string[]; lastUpdated: string };

// lastUpdated ISO → "2019-04", "2024-09" 등 표시용 YYYY-MM 추출 (정렬/랭킹 단순화)
function toYearMonth(iso: string): string {
  if (!iso || iso.length < 7) return "미상";
  return iso.slice(0, 7);
}

async function searchConfluenceBroad(areas: string[], env: ConfluenceEnv, perArea = 5): Promise<Candidate[]> {
  const spaceClause = env.spaceKeys.length === 1
    ? `space = "${env.spaceKeys[0]}"`
    : `space in (${env.spaceKeys.map((k) => `"${k}"`).join(",")})`;
  const ancestorClause = env.rootPageId ? ` AND ancestor = ${env.rootPageId}` : "";

  const runOne = async (area: string): Promise<{ area: string; results: any[] }> => {
    const cql = `${spaceClause}${ancestorClause} AND type = page AND text ~ "${area.replace(/"/g, '\\"')}"`;
    const url = new URL(`${env.base}/rest/api/search`);
    url.searchParams.set("cql", cql);
    url.searchParams.set("limit", String(perArea));
    url.searchParams.set("expand", "content.version");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(url.toString(), { headers: { Authorization: env.auth, Accept: "application/json" }, signal: controller.signal });
      if (!res.ok) return { area, results: [] };
      const data: any = await res.json();
      return { area, results: data.results ?? [] };
    } catch {
      return { area, results: [] };
    } finally {
      clearTimeout(timer);
    }
  };

  const t0 = Date.now();
  const allResults = await Promise.all(areas.map(runOne));
  const byId = new Map<string, Candidate>();
  for (const { area, results } of allResults) {
    for (const r of results) {
      const id = r.content?.id ?? "";
      if (!id) continue;
      const webui = r.content?._links?.webui ?? r._links?.webui ?? "";
      const rawExcerpt = typeof r.excerpt === "string" ? r.excerpt : "";
      const excerpt = rawExcerpt.replace(/@@@hl@@@/g, "").replace(/@@@endhl@@@/g, "").trim();
      const iso = r.lastModified ?? r.content?.version?.when ?? "";
      const lastUpdated = toYearMonth(iso);
      const existing = byId.get(id);
      if (existing) {
        if (!existing.matchedAreas.includes(area)) existing.matchedAreas.push(area);
      } else {
        byId.set(id, {
          id,
          title: r.title ?? r.content?.title ?? "",
          url: webui ? `${env.base}${webui}` : "",
          excerpt,
          matchedAreas: [area],
          lastUpdated,
        });
      }
    }
  }
  const candidates = [...byId.values()];
  console.log(`[confluence-broad] ${Date.now() - t0}ms | ${areas.length}영역 × ${perArea} → ${candidates.length}후보 (dedupe)`);
  return candidates;
}

// ── 3단계: Haiku-2로 후보 분류 + 랭킹 ──
const HAIKU_FILTER_SYSTEM = `당신은 문서 큐레이터다. 입력으로 주어진 현재 Spec과 Confluence 후보 문서 목록(제목+excerpt+수정일)을 보고, **선행 정책/결정 비교**에 쓸 만한 문서를 고른다.

**평가 기준:**
- 각 후보에 대해 3가지 판정:
  - "origin": 이 문서가 **현재 Spec의 원본/복제본**으로 보임 (제목·내용이 거의 동일). 비교 대상 아니므로 **제외**.
  - "relevant": 현재 Spec이 다루는 영역에 대해 **과거 결정·정책·가이드**를 담고 있음. 관련성 점수 1~10 부여.
  - "noise": 회의록, 관련 없는 기획, 로드맵, 회고 등. **제외**.

**신선도(최근 수정일) 반영:**
- 2년 이내 수정: 기본 점수 유지
- 2~4년 전 수정: -1~-2점 감점 (이미 지났을 수 있음)
- 4년 이상 전 수정: **강한 감점 (-3점 이상)**. 해당 문서가 **확립된 표준/규칙**으로 보일 때만 남기고, 그 외엔 noise로 판정.
- 제목에 "[실험 후보]", "실험중", "(YYYY.MM)" 등 시점 마커가 있고 오래됐으면 더 적극적으로 noise 분류.

**출력 규칙:**
- JSON 객체만. 설명 금지.
- 형식: { "selected": [{ "idx": 숫자, "score": 1~10, "reason": "짧은 한 줄 (날짜 근거 포함)" }], "excluded_origin": [idx...], "excluded_noise": [idx...] }
- selected는 **score 내림차순, 최대 5개**. 없으면 빈 배열.
- score 7 미만은 가급적 제외.`;

type FilterResult = { selected: { idx: number; score: number; reason: string }[]; excluded_origin: number[]; excluded_noise: number[] };

async function classifyAndRank(specText: string, candidates: Candidate[]): Promise<FilterResult | null> {
  if (!process.env.ANTHROPIC_API_KEY || candidates.length === 0) return null;
  const specSnippet = specText.length > 3000 ? specText.slice(0, 3000) : specText;
  const now = new Date();
  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const candidateText = candidates.map((c, i) => `[${i}] ${c.title}\n    최근 수정: ${c.lastUpdated}\n    매칭영역: ${c.matchedAreas.join(", ")}\n    excerpt: ${c.excerpt.slice(0, 300)}`).join("\n\n");
  const userMsg = `# 현재 시점: ${currentYm}\n\n# 현재 Spec (앞 3000자)\n${specSnippet}\n\n# Confluence 후보 (총 ${candidates.length}개)\n${candidateText}\n\n위 후보들을 origin/relevant/noise로 분류하고, **신선도도 반영해** relevant만 score 내림차순 최대 5개 선정해라. JSON 객체로만 출력.`;

  try {
    const t0 = Date.now();
    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      system: HAIKU_FILTER_SYSTEM,
      messages: [{ role: "user", content: userMsg }],
    });
    const textBlock = resp.content.find((b) => b.type === "text");
    const text = textBlock && "text" in textBlock ? textBlock.text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[haiku-2] JSON 파싱 실패:", text.slice(0, 200));
      return null;
    }
    const parsed: FilterResult = JSON.parse(jsonMatch[0]);
    const u = resp.usage as any;
    console.log(`[haiku-2] ${Date.now() - t0}ms | in:${u?.input_tokens} out:${u?.output_tokens} | selected:${parsed.selected?.length ?? 0} origin:${parsed.excluded_origin?.length ?? 0} noise:${parsed.excluded_noise?.length ?? 0}`);
    return parsed;
  } catch (err: any) {
    console.error("[haiku-2] ERROR:", err.message);
    return null;
  }
}

// ── 4단계: 본문 fetch + HTML strip ──
function stripHtml(html: string): string {
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

async function fetchBodies(ids: string[], env: ConfluenceEnv, capChars = 5000): Promise<Map<string, string>> {
  const fetchOne = async (id: string): Promise<[string, string]> => {
    const url = `${env.base}/rest/api/content/${id}?expand=body.view`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(url, { headers: { Authorization: env.auth, Accept: "application/json" }, signal: controller.signal });
      if (!res.ok) return [id, ""];
      const data: any = await res.json();
      const html = data?.body?.view?.value ?? "";
      const text = stripHtml(html);
      return [id, text.length > capChars ? text.slice(0, capChars) + "\n... (본문 이후 생략)" : text];
    } catch {
      return [id, ""];
    } finally {
      clearTimeout(timer);
    }
  };
  const t0 = Date.now();
  const pairs = await Promise.all(ids.map(fetchOne));
  const map = new Map(pairs);
  const totalChars = [...map.values()].reduce((s, v) => s + v.length, 0);
  console.log(`[confluence-body] ${Date.now() - t0}ms | ${ids.length}건 fetch | 본문 ${totalChars}자`);
  return map;
}

// ── 5단계: Haiku-3로 영역별 "입장" 추출 (batch) ──
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

type PositionFinding = { area: string; position: string; quote: string };
type PositionResult = { docs: { idx: number; findings: PositionFinding[] }[] };

async function extractPositions(areas: string[], selected: { candidate: Candidate; body: string }[]): Promise<PositionResult | null> {
  if (!process.env.ANTHROPIC_API_KEY || selected.length === 0) return null;
  const docsText = selected.map((s, i) => `[${i}] ${s.candidate.title}\n--- 본문 ---\n${s.body}\n--- 끝 ---`).join("\n\n");
  const userMsg = `# 분석할 영역 (${areas.length}개)\n${areas.map((a, i) => `${i + 1}. ${a}`).join("\n")}\n\n# 본문 (${selected.length}개)\n${docsText}\n\n각 본문이 각 영역에 대해 취하는 입장을 JSON 객체로만 출력해라.`;

  try {
    const t0 = Date.now();
    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      system: HAIKU_POSITION_SYSTEM,
      messages: [{ role: "user", content: userMsg }],
    });
    const textBlock = resp.content.find((b) => b.type === "text");
    const text = textBlock && "text" in textBlock ? textBlock.text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[haiku-3] JSON 파싱 실패:", text.slice(0, 300));
      return null;
    }
    const parsed: PositionResult = JSON.parse(jsonMatch[0]);
    const u = resp.usage as any;
    const totalFindings = parsed.docs?.reduce((s, d) => s + (d.findings?.length ?? 0), 0) ?? 0;
    console.log(`[haiku-3] ${Date.now() - t0}ms | in:${u?.input_tokens} out:${u?.output_tokens} | findings: ${totalFindings}`);
    return parsed;
  } catch (err: any) {
    console.error("[haiku-3] ERROR:", err.message);
    return null;
  }
}

// ── 6단계: 구조화 포맷으로 Sonnet 주입 ──
function formatStructuredContext(
  areas: string[],
  selected: { candidate: Candidate; body: string }[],
  positions: PositionResult,
): string {
  // 영역별로 findings 집계
  type Finding = { title: string; url: string; position: string; quote: string; lastUpdated: string };
  const byArea = new Map<string, Finding[]>();
  for (const a of areas) byArea.set(a, []);
  for (const doc of positions.docs ?? []) {
    const src = selected[doc.idx];
    if (!src) continue;
    for (const f of doc.findings ?? []) {
      if (!f.area || !f.position) continue;
      const list = byArea.get(f.area) ?? [];
      list.push({
        title: src.candidate.title,
        url: src.candidate.url,
        position: f.position,
        quote: f.quote ?? "",
        lastUpdated: src.candidate.lastUpdated,
      });
      byArea.set(f.area, list);
    }
  }

  // 오래된 문서 표시 (현재 시점 기준 2년 이상 전)
  const now = new Date();
  const cutoff2y = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
  const isStale = (ym: string) => {
    if (!ym || ym === "미상") return false;
    const [y, m] = ym.split("-").map(Number);
    if (!y || !m) return false;
    return new Date(y, m - 1, 1) < cutoff2y;
  };

  const blocks: string[] = [];
  for (const area of areas) {
    const findings = byArea.get(area) ?? [];
    if (findings.length === 0) {
      blocks.push(`## 영역: ${area}\n- **Confluence 선행 결정: 없음** (검색 결과에 이 영역에 대한 구체적 정책/결정을 담은 문서 없음)`);
    } else {
      const items = findings.map((f) => {
        const quote = f.quote ? `\n  - 원문 발췌: "${f.quote.replace(/\n+/g, " ").slice(0, 300)}"` : "";
        const staleWarn = isStale(f.lastUpdated) ? ` ⚠️ **오래된 문서 — 현재 유효한 정책인지 DRI 확인 필요**` : "";
        return `- [${f.title}](${f.url}) (최근 수정: ${f.lastUpdated})${staleWarn}\n  - 입장: ${f.position}${quote}`;
      }).join("\n");
      blocks.push(`## 영역: ${area}\n${items}`);
    }
  }

  return `[참고: Confluence 선행 결정 비교 — ${areas.length}개 영역, ${selected.length}개 문서 분석]

아래는 현재 Spec이 건드리는 각 영역에 대해, Confluence에서 발견한 **과거 결정/정책**이다. 당신의 작업:
- **Spec 침묵 + Confluence 정책 있음** → "선행 정책 반영 누락" 플래그 (최우선)
- **Spec 입장 ≠ Confluence 입장** → "정책 충돌" 플래그
- **Spec과 일치** → 언급 생략 (이미 반영됨)

**주의:** 문서에 "⚠️ 오래된 문서" 표시가 있으면 **현재 유효한 정책이라 단정하지 말고**, 플래그 문구에 "DRI 확인 필요"를 함께 명시해라. 오래됐지만 확립된 표준(예: 디자인 시스템, 브랜드 가이드)은 예외.

${blocks.join("\n\n")}`;
}

// ── 7단계: orchestrator (전체 파이프라인 + fallback) ──
async function gatherConfluenceContext(userText: string): Promise<string> {
  const env = loadConfluenceEnv();
  if (!env) {
    console.warn("[confluence] 환경변수 누락 — 검색 건너뜀");
    return "";
  }

  const pipelineT0 = Date.now();

  // Step 1: 영역 추출
  const areas = await extractAreasWithHaiku(userText);
  if (areas.length === 0) {
    return await legacyFallback(userText, env);
  }

  // Step 2: 병렬 검색
  const candidates = await searchConfluenceBroad(areas, env, 5);
  if (candidates.length === 0) {
    console.log("[confluence] 후보 0건 — 주입 건너뜀");
    return "";
  }

  // Step 3: 분류/랭킹
  const filterResult = await classifyAndRank(userText, candidates);
  if (!filterResult) return await legacyFallback(userText, env);

  const pickedIdxs = (filterResult.selected ?? []).filter((s) => s.score >= 6).slice(0, 5).map((s) => s.idx);
  const picked = pickedIdxs.map((i) => candidates[i]).filter(Boolean);
  if (picked.length === 0) {
    console.log("[confluence] filter 후 0건 (모두 origin/noise) — 주입 건너뜀");
    return "";
  }

  // Step 4: 본문 fetch
  const bodies = await fetchBodies(picked.map((p) => p.id), env, 5000);
  const selected = picked.map((c) => ({ candidate: c, body: bodies.get(c.id) ?? "" })).filter((s) => s.body.length > 0);
  if (selected.length === 0) return await legacyFallback(userText, env);

  // Step 5: 입장 추출
  const positions = await extractPositions(areas, selected);
  if (!positions) return await legacyFallback(userText, env);

  // Step 6: 포맷
  const ctx = formatStructuredContext(areas, selected, positions);
  console.log(`[confluence-pipeline] 총 ${Date.now() - pipelineT0}ms | 주입 ${ctx.length}자`);
  return ctx;
}

// v1 스타일 fallback: 빈도 기반 키워드 → excerpt 주입
async function legacyFallback(userText: string, env: ConfluenceEnv): Promise<string> {
  console.log("[confluence] legacy fallback 발동");
  const keywords = extractKeywords(userText, 5);
  if (keywords.length === 0) return "";
  const spaceClause = env.spaceKeys.length === 1 ? `space = "${env.spaceKeys[0]}"` : `space in (${env.spaceKeys.map((k) => `"${k}"`).join(",")})`;
  const ancestorClause = env.rootPageId ? ` AND ancestor = ${env.rootPageId}` : "";
  const textClause = keywords.map((k) => `text ~ "${k.replace(/"/g, '\\"')}"`).join(" OR ");
  const cql = `${spaceClause}${ancestorClause} AND type = page AND (${textClause})`;
  const url = new URL(`${env.base}/rest/api/search`);
  url.searchParams.set("cql", cql);
  url.searchParams.set("limit", "3");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url.toString(), { headers: { Authorization: env.auth, Accept: "application/json" }, signal: controller.signal });
    if (!res.ok) return "";
    const data: any = await res.json();
    const items = (data.results ?? []).slice(0, 3).map((r: any, i: number) => {
      const webui = r.content?._links?.webui ?? r._links?.webui ?? "";
      const excerpt = (r.excerpt ?? "").replace(/@@@hl@@@/g, "").replace(/@@@endhl@@@/g, "").trim();
      return `${i + 1}. ${r.title ?? ""}\n   URL: ${env.base}${webui}\n   ${excerpt}`;
    }).join("\n\n");
    return items ? `[참고: Confluence 관련 문서 (fallback)]\n\n${items}` : "";
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

// ── Ennoia API (레거시, 유지) ──

app.post("/api/chat", async (req, res) => {
  const { messages, model: reqModel } = req.body as {
    messages: { role: string; content: any }[];
    model?: string;
  };

  if (!messages || messages.length === 0) {
    return res.status(400).json({ error: "messages is required" });
  }

  const systemPrompt = loadSystemPrompt();
  const useModel = (reqModel && ALLOWED_MODELS.has(reqModel)) ? reqModel : DEFAULT_MODEL;

  try {
    const response = await anthropic.messages.create({
      model: useModel,
      max_tokens: 64000,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: messages.map((m) => {
        const role = m.role === "assistant" ? "assistant" as const : "user" as const;
        return { role, content: m.content };
      }),
    });

    // thinking 블록을 건너뛰고 text 블록만 추출
    const textBlock = response.content.find((b) => b.type === "text");
    const text = textBlock && "text" in textBlock ? textBlock.text : "";

    const u = response.usage as any;
    console.log(`[api/chat] Response: ${text.length} chars | input: ${u?.input_tokens} (cache write: ${u?.cache_creation_input_tokens ?? 0}, read: ${u?.cache_read_input_tokens ?? 0}) output: ${u?.output_tokens}`);
    return res.status(200).json({ text });
  } catch (error: any) {
    console.error("[api/chat] Error:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// ── SSE 스트리밍 엔드포인트 ──

app.post("/api/chat/stream", async (req, res) => {
  const { messages, systemPromptMode, model: reqModel, includeDbContext, includeConfluenceContext, sessionId } = req.body as {
    messages: { role: string; content: any }[];
    systemPromptMode?: "full" | "none";
    model?: string;
    includeDbContext?: boolean;
    includeConfluenceContext?: boolean;
    sessionId?: string;
  };

  if (!messages || messages.length === 0) {
    return res.status(400).json({ error: "messages is required" });
  }

  // SSE 응답 헤더
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const startTime = Date.now();

  const system = systemPromptMode === "none"
    ? []
    : [{ type: "text" as const, text: loadSystemPrompt(), cache_control: { type: "ephemeral" as const } }];
  const useModel = (reqModel && ALLOWED_MODELS.has(reqModel)) ? reqModel : DEFAULT_MODEL;
  let fullResponse = "";

  // role 변환만 수행, DB/Confluence 주입은 아래에서 async 처리
  const apiMessages: any[] = messages.map((m) => {
    const role = m.role === "assistant" ? "assistant" as const : "user" as const;
    return { role, content: m.content };
  });

  // DB 컨텍스트 주입 (Stage 2 — Haiku 선별 → catalog+context 블록 조합). 실패 시 기존 knowledge.md fallback.
  if (includeDbContext && apiMessages.length > 0) {
    const lastIdx = apiMessages.length - 1;
    const last = apiMessages[lastIdx];
    if (last?.role === "user" && typeof last.content === "string") {
      let ctx = "";
      try {
        ctx = await gatherDbContext(last.content);
      } catch (err) {
        console.warn("[db-context] gather 실패:", (err as Error).message);
      }
      if (!ctx) {
        // fallback: 기존 knowledge 파일 통째 주입
        const legacy = loadDbKnowledge();
        if (legacy) {
          ctx = "[참고: 원티드 DB 구조 (fallback)]\n" + legacy;
          console.log(`[db-context] legacy fallback 주입: ${ctx.length}자`);
        }
      }
      if (ctx) {
        apiMessages[lastIdx] = { ...last, content: last.content + "\n\n---\n\n" + ctx };
      }
    }
  }

  // Confluence 컨텍스트 주입 (Phase 3: 결정 비교 기반 파이프라인)
  if (includeConfluenceContext && apiMessages.length > 0) {
    const lastIdx = apiMessages.length - 1;
    const last = apiMessages[lastIdx];
    if (last?.role === "user" && typeof last.content === "string") {
      const ctx = await gatherConfluenceContext(last.content);
      if (ctx) {
        apiMessages[lastIdx] = { ...last, content: last.content + "\n\n---\n\n" + ctx };
        console.log(`[confluence] 컨텍스트 주입: ${ctx.length}자`);
      }
    }
  }

  try {
    const stream = anthropic.messages.stream({
      model: useModel,
      max_tokens: 64000,
      system,
      messages: apiMessages,
    });

    stream.on("text", (text) => {
      fullResponse += text;
      res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
    });

    stream.on("error", (error) => {
      console.error("[api/chat/stream] Stream error:", error.message);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    });

    stream.on("end", async () => {
      if (res.writableEnded) return;
      let finalMsg: any = null;
      try { finalMsg = await stream.finalMessage(); } catch { /* ignore */ }
      const u: any = finalMsg?.usage ?? stream.currentMessageSnapshot?.usage;
      const stopReason = finalMsg?.stop_reason ?? stream.currentMessageSnapshot?.stop_reason ?? "unknown";
      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log(`[api/chat/stream] duration: ${duration}s | stop_reason: ${stopReason} | output_chars: ${fullResponse.length}`);
      console.log(`[api/chat/stream] input: ${u?.input_tokens ?? "?"} (cache write: ${u?.cache_creation_input_tokens ?? 0}, read: ${u?.cache_read_input_tokens ?? 0}) output: ${u?.output_tokens ?? "?"}`);
      if (duration > 120) console.warn(`[api/chat/stream] ⚠️ SLOW: ${duration}s`);
      pushMetric({
        duration_sec: duration,
        model: useModel,
        stop_reason: stopReason,
        output_chars: fullResponse.length,
        input_tokens: u?.input_tokens ?? 0,
        output_tokens: u?.output_tokens ?? 0,
        cache_read: u?.cache_read_input_tokens ?? 0,
        cache_write: u?.cache_creation_input_tokens ?? 0,
        endpoint: "chat/stream",
        include_db: !!includeDbContext,
        session_hash: hashSession(sessionId),
      });
      res.write("data: [DONE]\n\n");
      res.end();
    });
  } catch (error: any) {
    console.error("[api/chat/stream] Error:", error.message);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

// ── 에러 수정 전용 엔드포인트 ──

const FIX_ERRORS_SYSTEM_PROMPT = `당신은 HTML 프로토타입의 JavaScript 런타임 에러를 수정하는 전문가입니다.

## 규칙

1. 제공된 에러 분석을 읽고 **원인 코드만 최소한으로 수정**합니다.
2. 수정은 반드시 <prototype_delta> 형식으로 출력합니다:
   <prototype_delta>
   <search>기존 코드 (현재 HTML 원문 그대로)</search>
   <replace>수정된 코드</replace>
   </prototype_delta>
3. **절대 금지:**
   - 기존 기능, UI 요소, 입력 필드, 버튼을 제거하는 것
   - 에러와 무관한 코드를 변경하는 것
   - 전체 HTML을 다시 출력하는 것
   - CSS나 디자인을 변경하는 것
4. <search> 안의 텍스트는 [현재 Prototype HTML]에 **정확히 존재하는 원문**이어야 합니다.
5. 대화 텍스트는 최소한으로. 수정 내용만 간결하게 설명합니다.

## 흔한 에러 패턴

- "X is not defined" (인라인 onclick에서) → onclick="X()"를 onclick="인스턴스.X()"로 수정하거나, 전역 함수로 래핑
- "Cannot read properties of null" → DOM 로드 시점 문제. DOMContentLoaded 안으로 이동
- "X is not a function" → 함수 정의 스코프 확인 후 호출 방식 수정
- localStorage SecurityError (sandbox) → try-catch로 감싸기`;

app.post("/api/chat/fix-errors", async (req, res) => {
  const { html, errors, sessionId } = req.body as { html: string; errors: string; sessionId?: string };

  if (!html || !errors) {
    return res.status(400).json({ error: "html and errors are required" });
  }

  // SSE 스트리밍
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const startTime = Date.now();
  let fullResponse = "";

  try {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 8192,
      system: [{ type: "text", text: FIX_ERRORS_SYSTEM_PROMPT }],
      messages: [
        {
          role: "user",
          content: `[현재 Prototype HTML]\n${html}\n\n${errors}\n\n위 에러를 수정해주세요.`,
        },
      ],
    });

    stream.on("text", (text) => {
      fullResponse += text;
      res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
    });

    stream.on("error", (error) => {
      console.error("[api/chat/fix-errors] Stream error:", error.message);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    });

    stream.on("end", async () => {
      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log(`[api/chat/fix-errors] 완료: ${fullResponse.length}자 | ${duration}s`);
      let finalMsg: any = null;
      try { finalMsg = await stream.finalMessage(); } catch { /* ignore */ }
      const u: any = finalMsg?.usage ?? stream.currentMessageSnapshot?.usage;
      pushMetric({
        duration_sec: duration,
        model: DEFAULT_MODEL,
        stop_reason: finalMsg?.stop_reason ?? "unknown",
        output_chars: fullResponse.length,
        input_tokens: u?.input_tokens ?? 0,
        output_tokens: u?.output_tokens ?? 0,
        cache_read: u?.cache_read_input_tokens ?? 0,
        cache_write: u?.cache_creation_input_tokens ?? 0,
        endpoint: "chat/fix-errors",
        include_db: false,
        session_hash: hashSession(sessionId),
      });
      res.write("data: [DONE]\n\n");
      res.end();
    });
  } catch (error: any) {
    console.error("[api/chat/fix-errors] Error:", error.message);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

// ── Morph Fast Apply 엔드포인트 ──

app.post("/api/morph/apply", async (req, res) => {
  const { original, edit } = req.body as { original: string; edit: string };

  if (!original || !edit) {
    return res.status(400).json({ error: "original and edit are required" });
  }

  const morphApiKey = process.env.MORPH_API_KEY;
  if (!morphApiKey) {
    console.warn("[api/morph] MORPH_API_KEY not configured");
    return res.status(501).json({ error: "MORPH_API_KEY not configured" });
  }

  const startMs = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000); // 12초 타임아웃

    const morphRes = await fetch("https://api.morphllm.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${morphApiKey}`,
      },
      body: JSON.stringify({
        model: "morph-v3-fast",
        messages: [
          {
            role: "user",
            content: `<code>\n${original}\n</code>\n<update>\n${edit}\n</update>`,
          },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const elapsedMs = Date.now() - startMs;

    if (!morphRes.ok) {
      const errText = await morphRes.text();
      console.error(`[api/morph] API error ${morphRes.status} (${elapsedMs}ms):`, errText.slice(0, 200));
      return res.status(502).json({ error: `Morph API error: ${morphRes.status}` });
    }

    const data = (await morphRes.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const rawHtml = data.choices?.[0]?.message?.content?.trim();

    if (!rawHtml) {
      console.error(`[api/morph] Empty response (${elapsedMs}ms)`);
      return res.status(502).json({ error: "Empty Morph response" });
    }

    const sizeRatio = rawHtml.length / original.length;
    console.log(`[api/morph] OK: ${original.length} → ${rawHtml.length} chars (${sizeRatio.toFixed(1)}x, ${elapsedMs}ms)`);

    return res.json({ html: rawHtml });
  } catch (error: any) {
    const elapsedMs = Date.now() - startMs;
    const isTimeout = error.name === "AbortError" || error.message?.includes("aborted");
    console.error(`[api/morph] ${isTimeout ? "TIMEOUT" : "ERROR"} (${elapsedMs}ms):`, error.message);
    return res.status(isTimeout ? 504 : 500).json({ error: error.message });
  }
});

// ── Prototype 공유 (Cloudflare R2) ──

function getR2Client(): S3Client | null {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) return null;
  return new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

app.post("/api/share", async (req, res) => {
  const { html, sessionId } = req.body as { html: string; sessionId: string };

  if (!html || !sessionId) {
    return res.status(400).json({ error: "html and sessionId are required" });
  }

  const bucket = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL; // e.g. https://{bucket}.r2.dev
  const r2 = getR2Client();

  if (!r2 || !bucket || !publicUrl) {
    console.warn("[api/share] R2 not configured");
    return res.status(501).json({ error: "R2 not configured. Set R2_* env vars." });
  }

  const key = `prototypes/${sessionId}.html`;

  try {
    await r2.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: html,
        ContentType: "text/html; charset=utf-8",
        CacheControl: "public, max-age=0, must-revalidate",
      }),
    );

    const url = `${publicUrl.replace(/\/$/, "")}/${key}`;
    console.log(`[api/share] Uploaded: ${key} (${html.length} chars) → ${url}`);
    return res.json({ url });
  } catch (error: any) {
    console.error("[api/share] R2 upload error:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// Vercel 환경에서는 listen하지 않음 (serverless function으로 동작)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[server] API proxy running on http://localhost:${PORT}`);
    console.log(`[server] Model: ${DEFAULT_MODEL}`);
  });
}

export default app;
