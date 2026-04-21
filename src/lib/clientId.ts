// 익명 client 식별자 — 같은 브라우저면 같은 ID.
// 서버가 sha1 hash해서 metrics에만 사용. 누군지 알아내는 용도 아님.
const KEY = "specflow_client_id";

export function getClientId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // localStorage 차단된 환경(시크릿 모드 등)에서는 빈 문자열 반환
    return "";
  }
}
