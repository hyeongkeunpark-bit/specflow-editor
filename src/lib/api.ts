import { parseResponse, stripConversational } from "./parser";
import { matchDummy } from "./dummyResponse";
import { generateSpecSummary } from "./specSummary";
import type { ChatMessage } from "./types";

export interface ChatResponse {
  text: string;
  spec: string | null;
  html: string | null;
  chatText: string;
}

// ── 대화 이력 최적화 ──

const MAX_HISTORY = 10;
const MAX_AI_LENGTH = 500;

function truncateHistory(history: ChatMessage[]): ChatMessage[] {
  return history
    .filter((m) => m.role === "user" || m.role === "ai")
    .slice(-MAX_HISTORY);
}

function formatHistoryLines(history: ChatMessage[]): string[] {
  return truncateHistory(history).map((m) => {
    const content =
      m.role === "ai" && m.content.length > MAX_AI_LENGTH
        ? m.content.slice(0, MAX_AI_LENGTH) + "...(생략)"
        : m.content;
    return m.role === "user" ? `사용자: ${content}` : `AI: ${content}`;
  });
}

function formatConversation(history: ChatMessage[], currentMessage: string, specContent?: string): string {
  const parts: string[] = [];

  if (specContent) {
    const summary = generateSpecSummary(specContent);
    if (summary) parts.push(summary);
  }

  const lines = formatHistoryLines(history);
  if (lines.length > 0) {
    parts.push(`[이전 대화]\n${lines.join("\n")}`);
  }

  parts.push(`[현재 메시지]\n${currentMessage}`);

  return parts.join("\n\n");
}

// ── API 호출 ──

function is504(err: unknown): boolean {
  return err instanceof Error && err.message.includes("504");
}

/** SSE 스트리밍 fetch — 토큰 단위로 수신, 완료 후 파싱된 ChatResponse 반환 */
async function fetchChatStream(
  message: string,
  onToken?: (token: string) => void,
): Promise<ChatResponse> {
  const res = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${res.status}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const event of events) {
      const trimmed = event.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      const data = trimmed.slice(6);
      if (data === "[DONE]") continue;

      let parsed: any;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }

      if (parsed.error) throw new Error(parsed.error);

      const content = parsed.content;
      if (content) {
        fullText += content;
        onToken?.(content);
      }
    }
  }

  const { spec, html, chatText } = parseResponse(fullText);
  return { text: fullText, spec, html, chatText };
}

/** 단일 호출 — 스트리밍 우선, 504 시 1회 재시도 */
async function callChat(message: string, onToken?: (token: string) => void): Promise<ChatResponse> {
  try {
    return await fetchChatStream(message, onToken);
  } catch (err) {
    if (!is504(err)) throw err;
  }
  return fetchChatStream(message, onToken);
}

// ── 공개 API ──

export async function sendMessage(
  userMessage: string,
  history: ChatMessage[] = [],
  specContent?: string,
  onToken?: (token: string) => void,
): Promise<ChatResponse> {
  const dummy = matchDummy(userMessage);
  if (dummy) return dummy;

  const message = formatConversation(history, userMessage, specContent);
  return callChat(message, onToken);
}
