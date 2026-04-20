/**
 * 캐시 동작 관찰 테스트
 * 서버 로그에서 cache_creation / cache_read 지표 추적
 */

const API = "http://localhost:3001/api/chat/stream";

function buildPayload({ history, currentMessage, specContent, htmlContent }) {
  const messages = [];
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

async function callStream(messages) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let full = "", buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const events = buf.split("\n\n");
    buf = events.pop() || "";
    for (const ev of events) {
      const t = ev.trim();
      if (!t.startsWith("data: ")) continue;
      const d = t.slice(6);
      if (d === "[DONE]") continue;
      try {
        const p = JSON.parse(d);
        if (p.content) full += p.content;
        if (p.error) throw new Error(p.error);
      } catch {}
    }
  }
  return full;
}

function parse(text) {
  const html = text.match(/```html\s*([\s\S]*?)```/)?.[1]?.trim() ||
    text.match(/(<!DOCTYPE html[\s\S]*?<\/html>)/i)?.[1]?.trim() || null;
  return { html };
}

async function main() {
  const history = [];

  // Turn 1: 프로토타입 생성 (HTML이 없으므로 캐시 없음)
  console.log("\n[Turn 1] 간단한 todo 앱 생성 (context 없음 → cache 미작동 예상)");
  const m1 = "간단한 todo 앱 만들어줘. 입력창, 추가 버튼, 목록, 삭제. 바로 생성.";
  const r1 = await callStream(buildPayload({ history, currentMessage: m1 }));
  const html1 = parse(r1).html;
  console.log(`  HTML: ${html1 ? html1.length : 0}자`);
  history.push({ role: "user", content: m1 });
  history.push({ role: "ai", content: r1 });

  // Turn 2: HTML 첨부된 질문 (캐시 쓰기 턴)
  console.log("\n[Turn 2] HTML 첨부 질문 (cache write 턴 예상)");
  const m2 = "이 todo앱에서 완료 표시 기능은 어떻게 만들까? 구현하지 말고 설계만 설명해줘.";
  const r2 = await callStream(buildPayload({ history, currentMessage: m2, htmlContent: html1 }));
  console.log(`  응답 ${r2.length}자`);
  history.push({ role: "user", content: m2 });
  history.push({ role: "ai", content: r2 });

  // Turn 3: 같은 HTML 상태로 다시 질문 (캐시 히트 기대)
  console.log("\n[Turn 3] HTML 동일, 다른 질문 (cache read 턴 예상)");
  const m3 = "완료 표시 대신 우선순위 기능을 넣는다면 어디에 추가할까? 설명만.";
  const r3 = await callStream(buildPayload({ history, currentMessage: m3, htmlContent: html1 }));
  console.log(`  응답 ${r3.length}자`);

  console.log("\n테스트 완료. 서버 로그에서 cache 지표 확인하세요.");
}

main().catch((e) => { console.error(e); process.exit(1); });
