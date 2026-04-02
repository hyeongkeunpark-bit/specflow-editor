import { parseResponse } from "./parser";

export interface ChatResponse {
  text: string;
  spec: string | null;
  html: string | null;
}

/**
 * /api/chat 엔드포인트를 호출하고 응답을 파싱
 */
export async function sendMessage(userMessage: string): Promise<ChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: userMessage }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${res.status}`);
  }

  const data = await res.json();
  const fullText: string = data.text ?? "";
  const { spec, html } = parseResponse(fullText);

  return { text: fullText, spec, html };
}
