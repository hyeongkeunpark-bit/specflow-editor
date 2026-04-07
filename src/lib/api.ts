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

/** 전송 시 포함할 컨텍스트 옵션 */
export interface SendOptions {
  /** 현재 Spec 전문 (dirty 상태일 때만 전달) */
  specContent?: string;
  /** 현재 Prototype HTML (dirty 상태일 때만 전달) */
  htmlContent?: string;
  /** Spec 문서 업데이트 모드 — Spec + HTML + 변경이력을 함께 전송 */
  specUpdateMode?: {
    specContent: string;
    htmlContent: string;
    changeLog: string[];
  };
  /** 스트리밍 토큰 콜백 */
  onToken?: (token: string) => void;
}

/**
 * 대화 이력을 Ennoia API용 messages 배열로 변환
 * - system 메시지 제외
 * - AI 응답에서 <spec> 태그 내용 제거 (현재 Spec을 별도로 보내므로 중복 방지)
 * - 최근 MAX_HISTORY개만 유지
 */
function buildMessages(
  history: ChatMessage[],
  currentMessage: string,
  options: Omit<SendOptions, "onToken"> = {},
): ApiMessage[] {
  const messages: ApiMessage[] = [];

  const { specContent, htmlContent, specUpdateMode } = options;

  // Spec 업데이트 모드에서는 대화 이력을 최소화 (Prototype 생성 맥락이 방해)
  // 일반 모드에서는 최근 N개 대화 이력 포함
  if (!specUpdateMode) {
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
  }

  if (specUpdateMode) {
    // [Spec 문서 업데이트] 버튼 모드: Spec + HTML + 변경이력
    const changeLogText = specUpdateMode.changeLog.length > 0
      ? specUpdateMode.changeLog.map((c, i) => `${i + 1}. ${c}`).join("\n")
      : "(변경 이력 없음)";

    const parts = [
      `[Spec 문서 업데이트 요청]`,
      specUpdateMode.specContent
        ? `[현재 Spec 전문]\n${specUpdateMode.specContent}`
        : `[현재 Spec 전문]\n(아직 생성되지 않음)`,
      `[현재 Prototype HTML]\n${specUpdateMode.htmlContent}`,
      `[Prototype 변경 이력]\n${changeLogText}`,
      `위 내용을 기반으로 Spec을 생성/업데이트해 주세요.`,
    ];
    messages.push({ role: "user", content: parts.join("\n\n") });
  } else {
    // 일반 채팅 모드: dirty 상태인 컨텍스트만 포함
    const contextParts: string[] = [];
    if (specContent) {
      contextParts.push(`[현재 Spec 전문]\n${specContent}`);
    }
    if (htmlContent) {
      contextParts.push(`[현재 Prototype HTML]\n${htmlContent}`);
    }

    let userContent = currentMessage;
    if (contextParts.length > 0) {
      userContent = contextParts.join("\n\n") + `\n\n[요청]\n${currentMessage}`;
    }
    messages.push({ role: "user", content: userContent });
  }

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
  options: SendOptions = {},
): Promise<ChatResponse> {
  const dummy = matchDummy(userMessage);
  if (dummy) return dummy;

  const { onToken, ...buildOpts } = options;
  const messages = buildMessages(history, userMessage, buildOpts);
  return callChat(messages, onToken);
}
