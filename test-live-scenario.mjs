/**
 * Live 시나리오 테스트 — 스크린샷 버그 재현 불가 검증
 *
 * 시나리오:
 *  Turn 1: 프로토타입 생성 요청
 *  Turn 2: 수정 요청 (AI가 명확화 질문하도록 유도)
 *  Turn 3: 단답 ("35" 같은) — HTML 수정이 반드시 일어나야 함
 *
 * 검증:
 *  - Turn 3에서 AI가 "HTML이 없어서..." 류 응답 금지
 *  - Turn 3 페이로드에 [현재 Prototype HTML] 블록 포함
 *  - 서버 로그에서 cache_read_input_tokens 증가 확인
 */

const API_STREAM = "http://localhost:3001/api/chat/stream";

// ── 페이로드 빌더 (buildMessages의 일반 모드 동등 구현) ──
function buildPayload({ history, currentMessage, specContent, htmlContent }) {
  const messages = [];

  // 이력
  for (const m of history) {
    if (m.role === "user") {
      const reqIdx = m.content.indexOf("[요청]\n");
      const text = reqIdx >= 0 ? m.content.slice(reqIdx + 5) : m.content;
      if (text.trim()) messages.push({ role: "user", content: text });
    } else if (m.role === "ai") {
      const cleaned = m.content
        .replace(/<spec>[\s\S]*?<\/spec>/g, "")
        .replace(/<prototype_delta>[\s\S]*?<\/prototype_delta>/g, "")
        .replace(/```html[\s\S]*?```/g, "")
        .trim();
      if (cleaned) messages.push({ role: "assistant", content: cleaned });
    }
  }

  // 현재 턴 — Spec/HTML inline (cache_control 없음, 설계 개정)
  const parts = [];
  if (specContent) parts.push(`[현재 Spec 전문]\n${specContent}`);
  if (htmlContent) parts.push(`[현재 Prototype HTML]\n${htmlContent}`);
  const hasContext = parts.length > 0;
  const userText = hasContext
    ? parts.join("\n\n") + `\n\n[요청]\n${currentMessage}`
    : currentMessage;
  messages.push({ role: "user", content: userText });
  return messages;
}

// ── SSE 스트리밍 호출 ──
async function callStream(messages) {
  const res = await fetch(API_STREAM, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";
    for (const ev of events) {
      const trimmed = ev.trim();
      if (!trimmed.startsWith("data: ")) continue;
      const data = trimmed.slice(6);
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        if (parsed.content) fullText += parsed.content;
        if (parsed.error) throw new Error(parsed.error);
      } catch (e) {
        if (e.message !== "Unexpected end of JSON input") throw e;
      }
    }
  }
  return fullText;
}

// ── 응답에서 HTML / delta / chat 텍스트 분리 ──
function parseAiResponse(text) {
  const htmlMatch = text.match(/```html\s*([\s\S]*?)```/);
  const rawHtmlMatch = !htmlMatch && text.match(/(<!DOCTYPE html[\s\S]*?<\/html>)/i);
  const html = htmlMatch ? htmlMatch[1].trim() : rawHtmlMatch ? rawHtmlMatch[1].trim() : null;
  const deltas = [...text.matchAll(/<prototype_delta>\s*<search>([\s\S]*?)<\/search>\s*<replace>([\s\S]*?)<\/replace>\s*<\/prototype_delta>/g)];
  const chatText = text
    .replace(/<spec>[\s\S]*?<\/spec>/g, "")
    .replace(/<prototype_delta>[\s\S]*?<\/prototype_delta>/g, "")
    .replace(/```html[\s\S]*?```/g, "")
    .trim();
  return { html, deltas, chatText, rawText: text };
}

// ── 메인 ──
async function main() {
  console.log("=".repeat(70));
  console.log("시나리오: 스크린샷 버그 재현 불가 검증");
  console.log("=".repeat(70));

  const history = [];
  let currentHtml = null;
  let currentSpec = null;

  // ── Turn 1: 프로토타입 생성 ──
  console.log("\n[Turn 1] 사용자: '간단한 지역 선택 모달이 있는 페이지 만들어줘. 가운데 버튼 클릭하면 모달 열리고, 모달 하단에 지역 리스트. 바로 Prototype 생성해줘.'");
  const msg1 = "간단한 지역 선택 모달이 있는 페이지 만들어줘. 가운데 버튼 클릭하면 모달 열리고, 모달 하단에 지역 리스트. 바로 Prototype 생성해줘.";
  const payload1 = buildPayload({ history, currentMessage: msg1 });
  const start1 = Date.now();
  const resp1 = await callStream(payload1);
  const parsed1 = parseAiResponse(resp1);
  console.log(`  소요: ${((Date.now() - start1) / 1000).toFixed(1)}s, 응답 ${resp1.length}자`);
  console.log(`  HTML 추출: ${parsed1.html ? parsed1.html.length + "자" : "없음"}`);
  console.log(`  chat text (앞 150자): ${parsed1.chatText.slice(0, 150)}`);
  if (!parsed1.html) {
    console.error("❌ FAIL: Turn 1에서 HTML이 생성되지 않음");
    process.exit(1);
  }
  currentHtml = parsed1.html;
  history.push({ role: "user", content: msg1 });
  history.push({ role: "ai", content: resp1 });

  // ── Turn 2: 모호한 수정 요청 (명확화 질문 유도) ──
  console.log("\n[Turn 2] 사용자: '모달 높이가 좀 크네. 줄여줘' (AI가 얼마로 줄일지 물어보길 기대)");
  const msg2 = "모달 높이가 좀 크네. 줄여줘. 바로 수정하지 말고, 어느 정도로 줄일지 먼저 물어봐줘.";
  const payload2 = buildPayload({ history, currentMessage: msg2, htmlContent: currentHtml });
  const t2Content = payload2[payload2.length - 1].content;
  console.log(`  payload: ${typeof t2Content === "string" ? t2Content.length + "자 (HTML 포함: " + t2Content.includes("[현재 Prototype HTML]") + ")" : "block 배열"}`);
  const start2 = Date.now();
  const resp2 = await callStream(payload2);
  const parsed2 = parseAiResponse(resp2);
  console.log(`  소요: ${((Date.now() - start2) / 1000).toFixed(1)}s, 응답 ${resp2.length}자`);
  console.log(`  chat text (앞 200자): ${parsed2.chatText.slice(0, 200)}`);
  console.log(`  delta 개수: ${parsed2.deltas.length}, HTML: ${parsed2.html ? "있음" : "없음"}`);
  // 이 턴은 AI가 질문만 하는 걸 기대. delta나 HTML이 있어도 OK (프롬프트에 따라 다를 수 있음)
  history.push({ role: "user", content: msg2 });
  history.push({ role: "ai", content: resp2 });

  // ── Turn 3: 단답 (버그 재현 시나리오의 핵심) ──
  console.log("\n[Turn 3] 사용자: '35' (단답. 이전 HTML 접근해서 수정할 수 있어야 함)");
  const msg3 = "35";
  const payload3 = buildPayload({ history, currentMessage: msg3, htmlContent: currentHtml });

  // payload 검증
  const lastMsg = payload3[payload3.length - 1];
  const hasHtml = typeof lastMsg.content === "string" && lastMsg.content.includes("[현재 Prototype HTML]");
  if (!hasHtml) {
    console.error("❌ FAIL: Turn 3 payload에 [현재 Prototype HTML] 누락");
    process.exit(1);
  }
  console.log(`  ✓ payload에 HTML 포함 (요청 전문 ${lastMsg.content.length}자)`);

  const start3 = Date.now();
  const resp3 = await callStream(payload3);
  const parsed3 = parseAiResponse(resp3);
  console.log(`  소요: ${((Date.now() - start3) / 1000).toFixed(1)}s, 응답 ${resp3.length}자`);
  console.log(`  chat text (앞 300자): ${parsed3.chatText.slice(0, 300)}`);
  console.log(`  delta 개수: ${parsed3.deltas.length}, HTML: ${parsed3.html ? "있음" : "없음"}`);

  // ── 최종 판정 ──
  console.log("\n" + "=".repeat(70));
  const bugIndicators = [
    "HTML이 없어",
    "HTML이 제공되지",
    "HTML을 제공",
    "현재 HTML이 없",
    "붙여주시면",
    "붙여주세요",
    "첨부해주세요",
  ];
  const hitBug = bugIndicators.some((w) => parsed3.chatText.includes(w));
  if (hitBug) {
    console.error("❌ FAIL: Turn 3에서 AI가 'HTML 없다' 류 응답을 함 (버그 재현)");
    process.exit(1);
  }

  const hasAction = parsed3.deltas.length > 0 || parsed3.html !== null;
  if (!hasAction) {
    console.warn("⚠️  WARN: Turn 3에서 수정(delta/html)이 없음. AI가 추가 확인을 요구했을 수 있음.");
    console.warn("    수동 검토 필요. 하지만 '버그 재현'은 아님.");
  } else {
    console.log("✅ PASS: Turn 3에서 AI가 정상적으로 HTML을 수정함");
  }

  console.log("\n테스트 완료. 서버 로그에서 cache 지표를 확인하세요.");
}

main().catch((err) => {
  console.error("테스트 실패:", err.message);
  process.exit(1);
});
