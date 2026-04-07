import { parseResponse } from "./parser";
import { matchDummy } from "./dummyResponse";
import type { ChatMessage } from "./types";

export interface ChatResponse {
  text: string;
  spec: string | null;
  html: string | null;
  chatText: string;
}

// ── messages 배열 구성 ──

interface ApiMessage {
  role: "user" | "assistant";
  content: string;
}

const MAX_HISTORY = 20;

/**
 * 대화 이력을 Ennoia API용 messages 배열로 변환
 * - system 메시지 제외
 * - AI 응답에서 <spec> 태그 내용 제거 (현재 Spec을 별도로 보내므로 중복 방지)
 * - 최근 MAX_HISTORY개만 유지
 */
function buildMessages(
  history: ChatMessage[],
  currentMessage: string,
  specContent?: string,
): ApiMessage[] {
  const messages: ApiMessage[] = [];

  // 대화 이력 (user/ai만, 최근 N개)
  const relevant = history
    .filter((m) => m.role === "user" || m.role === "ai")
    .slice(-MAX_HISTORY);

  for (const m of relevant) {
    if (m.role === "user") {
      messages.push({ role: "user", content: m.content });
    } else {
      // AI 응답에서 <spec> 블록 제거 → 대화 맥락만 유지
      const cleaned = m.content.replace(/<spec>[\s\S]*?<\/spec>/g, "(Spec 내용 — 현재 버전 참조)").trim();
      messages.push({ role: "assistant", content: cleaned });
    }
  }

  // 현재 Spec이 이미 이전 메시지에 포함되어 있는지 확인
  // → 포함되어 있으면 중복 전송하지 않음 (토큰 절감)
  // → Spec이 변경(merge, 복원 등)되었으면 새로 첨부
  const specAlreadySent = specContent && messages.some(
    (m) => m.role === "user" && m.content.includes(specContent),
  );

  let userContent = currentMessage;
  if (specContent && !specAlreadySent) {
    userContent = `[현재 Spec 전문]\n${specContent}\n\n[요청]\n${currentMessage}`;
  }
  messages.push({ role: "user", content: userContent });

  return messages;
}

// ── API 호출 ──

function is504(err: unknown): boolean {
  return err instanceof Error && err.message.includes("504");
}

/** SSE 스트리밍 fetch — messages 배열 전송, 토큰 단위로 수신 */
async function fetchChatStream(
  messages: ApiMessage[],
  onToken?: (token: string) => void,
): Promise<ChatResponse> {
  const res = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
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
async function callChat(messages: ApiMessage[], onToken?: (token: string) => void): Promise<ChatResponse> {
  try {
    return await fetchChatStream(messages, onToken);
  } catch (err) {
    if (!is504(err)) throw err;
  }
  return fetchChatStream(messages, onToken);
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

  const messages = buildMessages(history, userMessage, specContent);
  return callChat(messages, onToken);
}
