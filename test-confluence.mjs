import dotenv from "dotenv";
dotenv.config();

const KO_STOPWORDS = new Set([
  "있다","없다","하는","되는","대한","기능","페이지","화면","사용자","유저","서비스",
  "기획","정책","다음","이후","이전","해당","또는","그리고","있음","없음","필요","가능",
  "경우","내용","설정","제공","표시","노출","버튼","영역","입력","선택","확인","클릭",
  "추가","삭제","변경","수정","상태","정보","대한","위한","통해","관련","항목","기본",
]);

function extractKeywords(text, topN = 5) {
  if (!text) return [];
  const tokens = text.match(/[가-힣]{2,10}|[A-Za-z]{3,15}/g) ?? [];
  const freq = new Map();
  for (const raw of tokens) {
    const tok = raw.toLowerCase();
    if (KO_STOPWORDS.has(raw)) continue;
    if (/^[a-z]+$/.test(tok) && tok.length < 4) continue;
    freq.set(tok, (freq.get(tok) ?? 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN).map(([w]) => w);
}

async function searchConfluence(specText, limit = 3) {
  const email = process.env.ATLASSIAN_EMAIL;
  const token = process.env.ATLASSIAN_API_TOKEN;
  const base = process.env.ATLASSIAN_BASE_URL;
  const spaceKeys = (process.env.CONFLUENCE_SPACE_KEYS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const rootPageId = (process.env.CONFLUENCE_ROOT_PAGE_ID ?? "").trim();

  const keywords = extractKeywords(specText, 5);
  console.log("[keywords]", keywords);

  const spaceClause = spaceKeys.length === 1 ? `space = "${spaceKeys[0]}"` : `space in (${spaceKeys.map((k) => `"${k}"`).join(",")})`;
  const ancestorClause = rootPageId ? ` AND ancestor = ${rootPageId}` : "";
  const textClause = keywords.map((k) => `text ~ "${k.replace(/"/g, '\\"')}"`).join(" OR ");
  const cql = `${spaceClause}${ancestorClause} AND type = page AND (${textClause})`;
  console.log("[cql]", cql);

  const auth = "Basic " + Buffer.from(`${email}:${token}`).toString("base64");
  const url = new URL(`${base}/rest/api/search`);
  url.searchParams.set("cql", cql);
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url.toString(), { headers: { Authorization: auth, Accept: "application/json" } });
  console.log("[status]", res.status);
  if (!res.ok) {
    console.error("[body]", await res.text());
    return;
  }
  const data = await res.json();
  const hits = (data.results ?? []).slice(0, limit).map((r) => ({
    id: r.content?.id ?? "",
    title: r.title ?? r.content?.title ?? "",
    url: `${base}${r.content?._links?.webui ?? ""}`,
    excerpt: (r.excerpt ?? "").replace(/@@@hl@@@/g, "").replace(/@@@endhl@@@/g, "").trim(),
  }));
  console.log("[hits]", JSON.stringify(hits, null, 2));
}

const sampleSpec = `
# 채용 공고 상세 페이지 기획

## 요구사항
- 비로그인 사용자도 공고 내용을 볼 수 있다.
- 지원 버튼 클릭 시 로그인 유도 팝업 노출.
- 온보딩을 완료하지 않은 사용자는 프로필 입력 화면으로 이동.
- 이력서 업로드 후 지원 완료.
- 매칭 점수에 따라 추천 공고 정렬.
`;

await searchConfluence(sampleSpec, 3);
