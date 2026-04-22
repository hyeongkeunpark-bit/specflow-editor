// 로컬 서버에 같은 (specContent+htmlContent)로 두 번 호출 → cache_write → cache_read 전환 확인
// 사용: node scripts/test-cache-behavior.mjs

const API = "http://localhost:3001/api/chat/stream";

// 유니크 Spec (과거 캐시 오염 방지)
const UNIQ = `cache-test-${Date.now()}`;
const specContent = `# 테스트 Spec ${UNIQ}
## 기능
- 버튼 클릭 시 다이얼로그 노출
- 닫기 버튼 눌렀을 때 다이얼로그 닫힘
- ESC 키로도 닫힘

## 데이터
- 유저 이름 필드
- 이메일 필드
`;
const htmlContent = `<!DOCTYPE html>
<html>
  <body id="${UNIQ}">
    <button id="open">Open Dialog</button>
    <div id="dialog" hidden><p>Hi</p><button id="close">Close</button></div>
    <script>
      document.getElementById('open').addEventListener('click', () => {
        document.getElementById('dialog').hidden = false;
      });
    </script>
  </body>
</html>`;

async function callOnce(label) {
  const body = {
    messages: [{ role: "user", content: `${label}: 이 화면 기능을 한 줄로 요약해줘.` }],
    systemPromptMode: "full",
    model: "claude-sonnet-4-6",
    sessionId: `test-session-${UNIQ}`,
    clientId: `test-client-${UNIQ}`,
    specContent,
    htmlContent,
  };

  const t0 = Date.now();
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

  // SSE drain
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let output = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n\n")) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") continue;
      try {
        const obj = JSON.parse(data);
        if (obj.content) output += obj.content;
      } catch {}
    }
  }

  const elapsed = Math.round((Date.now() - t0) / 1000);
  console.log(`\n=== ${label} (${elapsed}s) ===`);
  console.log(`응답 길이: ${output.length}자`);
  console.log(`응답 snippet: "${output.slice(0, 80).replace(/\n/g, " ")}..."`);
}

console.log(`[테스트 ID] ${UNIQ}`);
console.log("\n서버 콘솔에서 '[api/chat/stream]' 로그 2건을 비교하세요:");
console.log("- 1st: cache_write > 0, cache_read = 0");
console.log("- 2nd: cache_write = 0, cache_read > 0 (>= 1st의 cache_write 크기)\n");

await callOnce("1st call");
console.log("\n--- 2초 대기 후 동일 Spec/HTML로 재호출 ---");
await new Promise((r) => setTimeout(r, 2000));
await callOnce("2nd call");

console.log("\n=== 완료 ===");
console.log("서버 로그의 cache_write / cache_read 수치를 확인하세요.");
