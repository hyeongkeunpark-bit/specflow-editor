import { parseResponse } from "./parser";
import type { ChatMessage } from "./types";

export interface ChatResponse {
  text: string;
  spec: string | null;
  html: string | null;
}

/**
 * 대화 이력을 Ennoia user_message 포맷으로 변환
 */
function formatConversation(history: ChatMessage[], currentMessage: string): string {
  const past = history.filter((m) => m.role === "user" || m.role === "ai");

  if (past.length === 0) return currentMessage;

  const lines = past.map((m) =>
    m.role === "user" ? `사용자: ${m.content}` : `AI: ${m.content}`
  );

  return `[이전 대화]\n${lines.join("\n")}\n\n[현재 메시지]\n${currentMessage}`;
}

/**
 * /api/chat 엔드포인트를 호출하고 응답을 파싱
 */
export async function sendMessage(
  userMessage: string,
  history: ChatMessage[] = [],
): Promise<ChatResponse> {
  const message = formatConversation(history, userMessage);

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
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
