/**
 * Delta 매칭 성공률 테스트 스크립트
 * 실행: npx tsx test-delta.ts
 *
 * 1) Prototype 생성 API 호출 → HTML 추출
 * 2) 수정 요청 API 호출 → delta 추출
 * 3) 원본 HTML에 delta 매칭 시도 (exact → fuzzy → normalized)
 * 4) 결과 집계
 */

const API = "http://localhost:3001/api/chat";

interface DeltaPair {
  search: string;
  replace: string;
}

// ── delta 추출 ──
function extractDeltas(text: string): DeltaPair[] {
  const regex =
    /<prototype_delta>\s*<search>([\s\S]*?)<\/search>\s*<replace>([\s\S]*?)<\/replace>\s*<\/prototype_delta>/g;
  const pairs: DeltaPair[] = [];
  let m;
  while ((m = regex.exec(text)) !== null) {
    pairs.push({
      search: m[1].replace(/^\n/, "").replace(/\n$/, ""),
      replace: m[2].replace(/^\n/, "").replace(/\n$/, ""),
    });
  }
  return pairs;
}

// ── HTML 추출 ──
function extractHtml(text: string): string | null {
  // ```html 코드 블록
  const fenceMatch = text.match(/```html\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  // raw HTML
  const rawMatch = text.match(/(<!DOCTYPE html[\s\S]*?<\/html>)/i);
  if (rawMatch) return rawMatch[1].trim();
  return null;
}

// ── fuzzy match (parser.ts 로직 복제) ──
function fuzzyMatch(html: string, search: string): boolean {
  const searchLines = search.split("\n").map((l) => l.trim()).filter(Boolean);
  if (searchLines.length === 0) return false;

  const htmlLines = html.split("\n").map((l) => l.trim());

  let matchCount = 0;
  for (let i = 0; i <= htmlLines.length - searchLines.length; i++) {
    let allMatch = true;
    for (let j = 0; j < searchLines.length; j++) {
      if (htmlLines[i + j] !== searchLines[j]) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) matchCount++;
  }
  return matchCount === 1;
}

// ── API 호출 ──
async function callApi(messages: { role: string; content: string }[]): Promise<string> {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  return data.text;
}

// ── 테스트 케이스 ──
interface TestCase {
  name: string;
  createMessages: { role: string; content: string }[];
  modifications: string[];
}

const testCases: TestCase[] = [
  {
    name: "카운터 앱 (연속 5턴)",
    createMessages: [
      { role: "user", content: "간단한 카운터 앱을 만들어줘. +1, -1 버튼이 있고 가운데 숫자가 표시돼. 핵심 Step: 버튼 클릭 → 숫자 변경. 플랫폼: Desktop. 구현 규칙: 없음. Prototype 바로 생성해줘." },
    ],
    modifications: [
      "버튼 색상을 빨간색으로 바꿔줘",
      "숫자 폰트 크기를 2배로 키워줘",
      "리셋 버튼을 추가해줘",
      "배경색을 검은색으로 바꾸고 글자를 흰색으로 해줘",
      "버튼을 둥글게 만들어줘 (border-radius 50%)",
    ],
  },
  {
    name: "할일 앱 (연속 6턴)",
    createMessages: [
      { role: "user", content: "할일 관리 앱. 핵심 Step: 1.할일 입력 2.목록 보기 3.완료 체크 4.삭제. 플랫폼: Both. 구현 규칙: 없음. Prototype 바로 생성해줘." },
    ],
    modifications: [
      "완료된 항목에 취소선을 넣어줘",
      "배경색을 다크 테마로 바꿔줘",
      "할일 항목 사이에 구분선을 추가해줘",
      "입력창 placeholder를 '새 할일을 입력하세요'로 바꿔줘",
      "삭제 버튼 색상을 빨간색으로 바꿔줘",
      "할일 항목에 호버 효과를 추가해줘. 마우스 올리면 배경색이 살짝 밝아지게",
    ],
  },
  {
    name: "대시보드 (복잡한 HTML, 연속 5턴)",
    createMessages: [
      { role: "user", content: "관리자 대시보드. 상단에 요약 카드 4개(매출, 주문수, 방문자, 전환율), 아래에 최근 주문 테이블, 오른쪽에 차트 placeholder. 핵심 Step: 대시보드 조회. 플랫폼: Desktop. 구현 규칙: 없음. Prototype 바로 생성해줘." },
    ],
    modifications: [
      "매출 카드의 숫자를 빨간색으로 표시해줘",
      "테이블 헤더 배경색을 파란색으로 바꿔줘",
      "카드에 아이콘을 추가해줘 (이모지로 대체 가능)",
      "테이블에 페이지네이션 UI를 추가해줘 (이전/다음 버튼만)",
      "전체 레이아웃을 다크 테마로 바꿔줘",
    ],
  },
];

// ── 결과 집계 ──
interface Result {
  testCase: string;
  modification: string;
  deltaCount: number;
  exactMatch: number;
  fuzzyMatch: number;
  failed: number;
  resolvedBy: string;
}

async function runTest(tc: TestCase): Promise<Result[]> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`테스트: ${tc.name}`);
  console.log(`${"=".repeat(60)}`);

  // Step 1: Prototype 생성
  console.log("  → Prototype 생성 중...");
  const createResponse = await callApi(tc.createMessages);
  const html = extractHtml(createResponse);

  if (!html) {
    console.log("  ❌ HTML 추출 실패. 응답 앞부분:", createResponse.slice(0, 200));
    return [];
  }
  console.log(`  ✅ HTML 생성 완료 (${html.length}자)`);

  const results: Result[] = [];
  let currentHtml = html;

  // 대화 이력 누적 (실제 앱처럼)
  const conversationHistory: { role: string; content: string }[] = [
    ...tc.createMessages,
    { role: "assistant", content: "생성했습니다." },
  ];

  // Step 2: 각 수정 요청 (이력 누적)
  for (const mod of tc.modifications) {
    console.log(`\n  수정 [이력 ${conversationHistory.length}턴]: "${mod}"`);

    const userContent = `[현재 Prototype HTML]\n${currentHtml}\n\n${mod}`;
    const modMessages = [
      ...conversationHistory,
      { role: "user", content: userContent },
    ];

    try {
      const modResponse = await callApi(modMessages);
      const deltas = extractDeltas(modResponse);

      // 대화 이력에 추가
      conversationHistory.push({ role: "user", content: userContent });
      conversationHistory.push({ role: "assistant", content: modResponse.slice(0, 500) });

      if (deltas.length === 0) {
        const fullHtml = extractHtml(modResponse);
        if (fullHtml) {
          console.log(`    📄 전체 HTML 출력 (delta 없음, ${fullHtml.length}자)`);
          currentHtml = fullHtml;
          results.push({
            testCase: tc.name,
            modification: mod,
            deltaCount: 0,
            exactMatch: 0,
            fuzzyMatch: 0,
            failed: 0,
            resolvedBy: "full_html",
          });
        } else {
          console.log(`    ❓ delta도 HTML도 없음. 응답:`, modResponse.slice(0, 150));
          results.push({
            testCase: tc.name,
            modification: mod,
            deltaCount: 0,
            exactMatch: 0,
            fuzzyMatch: 0,
            failed: 0,
            resolvedBy: "no_output",
          });
        }
        continue;
      }

      console.log(`    delta ${deltas.length}개 수신`);

      let exact = 0;
      let fuzzy = 0;
      let fail = 0;
      let tempHtml = currentHtml;
      let allSuccess = true;

      for (let i = 0; i < deltas.length; i++) {
        const d = deltas[i];
        if (tempHtml.includes(d.search)) {
          tempHtml = tempHtml.replace(d.search, d.replace);
          exact++;
          console.log(`    [${i + 1}] ✅ exact match`);
        } else if (fuzzyMatch(tempHtml, d.search)) {
          fuzzy++;
          console.log(`    [${i + 1}] ✅ fuzzy match`);
          // fuzzy는 실제 교체 로직이 복잡하므로 여기선 성공 카운트만
        } else {
          fail++;
          allSuccess = false;
          const snippet = d.search.slice(0, 80);
          console.log(`    [${i + 1}] ❌ FAIL — search: "${snippet}..."`);
          // 원본에서 비슷한 부분 찾기
          const firstToken = d.search.match(/[.#\w-]+\{/)?.[0] || d.search.slice(0, 20);
          const idx = tempHtml.indexOf(firstToken);
          if (idx >= 0) {
            console.log(`         원본: "${tempHtml.slice(idx, idx + 80)}..."`);
          }
        }
      }

      const resolvedBy = fail === 0
        ? (exact >= fuzzy ? "exact" : "fuzzy")
        : "failed";

      if (allSuccess) {
        currentHtml = tempHtml; // 성공한 경우 HTML 업데이트
      }

      results.push({
        testCase: tc.name,
        modification: mod,
        deltaCount: deltas.length,
        exactMatch: exact,
        fuzzyMatch: fuzzy,
        failed: fail,
        resolvedBy,
      });
    } catch (err) {
      console.log(`    ❌ API 에러:`, (err as Error).message);
      results.push({
        testCase: tc.name,
        modification: mod,
        deltaCount: 0,
        exactMatch: 0,
        fuzzyMatch: 0,
        failed: 0,
        resolvedBy: "api_error",
      });
    }
  }

  return results;
}

// ── 메인 ──
async function main() {
  console.log("Delta 매칭 성공률 테스트 시작");
  console.log(`API: ${API}`);

  const allResults: Result[] = [];

  for (const tc of testCases) {
    const results = await runTest(tc);
    allResults.push(...results);
  }

  // 최종 집계
  console.log(`\n\n${"=".repeat(60)}`);
  console.log("최종 결과");
  console.log(`${"=".repeat(60)}\n`);

  console.table(allResults.map((r) => ({
    테스트: r.testCase,
    수정: r.modification.slice(0, 25),
    deltas: r.deltaCount,
    exact: r.exactMatch,
    fuzzy: r.fuzzyMatch,
    실패: r.failed,
    결과: r.resolvedBy,
  })));

  const totalWithDeltas = allResults.filter((r) => r.deltaCount > 0);
  const directSuccess = totalWithDeltas.filter((r) => r.failed === 0).length;
  const totalFailed = totalWithDeltas.filter((r) => r.failed > 0).length;

  console.log(`\n--- 요약 ---`);
  console.log(`총 수정 요청: ${allResults.length}건`);
  console.log(`  delta 응답: ${totalWithDeltas.length}건`);
  console.log(`  전체 HTML 응답: ${allResults.filter((r) => r.resolvedBy === "full_html").length}건`);
  console.log(`  기타: ${allResults.filter((r) => r.resolvedBy === "no_output" || r.resolvedBy === "api_error").length}건`);
  console.log(`\ndelta 매칭 결과 (${totalWithDeltas.length}건 중):`);
  console.log(`  직접 매칭 성공: ${directSuccess}건 (${totalWithDeltas.length ? Math.round(directSuccess / totalWithDeltas.length * 100) : 0}%)`);
  console.log(`  매칭 실패: ${totalFailed}건 (${totalWithDeltas.length ? Math.round(totalFailed / totalWithDeltas.length * 100) : 0}%)`);

  const totalDeltas = totalWithDeltas.reduce((sum, r) => sum + r.deltaCount, 0);
  const totalExact = totalWithDeltas.reduce((sum, r) => sum + r.exactMatch, 0);
  const totalFuzzy = totalWithDeltas.reduce((sum, r) => sum + r.fuzzyMatch, 0);
  const totalFail = totalWithDeltas.reduce((sum, r) => sum + r.failed, 0);

  console.log(`\n개별 delta 단위 (총 ${totalDeltas}개):`);
  console.log(`  exact: ${totalExact} (${totalDeltas ? Math.round(totalExact / totalDeltas * 100) : 0}%)`);
  console.log(`  fuzzy: ${totalFuzzy} (${totalDeltas ? Math.round(totalFuzzy / totalDeltas * 100) : 0}%)`);
  console.log(`  실패:  ${totalFail} (${totalDeltas ? Math.round(totalFail / totalDeltas * 100) : 0}%)`);
}

main().catch(console.error);
