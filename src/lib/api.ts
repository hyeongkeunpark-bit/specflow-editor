import { parseResponse } from "./parser";
import { matchDummy } from "./dummyResponse";
import type { ChatMessage } from "./types";

export interface ChatResponse {
  text: string;
  spec: string | null;
  html: string | null;
  chatText: string;
  partialUpdate?: boolean;
  /** delta 매칭 실패 → Morph 폴백이 시도되었는지 */
  morphApplied?: boolean;
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
  /** 현재 Prototype HTML (partial update merge용 + str_replace tool용) */
  existingHtml?: string;
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

// ── Morph Fast Apply ──

const MORPH_TIMEOUT = 15_000; // 15초
const MORPH_MAX_RETRIES = 1;

/** delta에서 search+replace 쌍 추출 */
function extractDeltaPairs(fullText: string): { search: string; replace: string }[] {
  const regex =
    /<prototype_delta>\s*<search>([\s\S]*?)<\/search>\s*<replace>([\s\S]*?)<\/replace>\s*<\/prototype_delta>/g;
  const pairs: { search: string; replace: string }[] = [];
  let match;
  while ((match = regex.exec(fullText)) !== null) {
    const search = match[1].replace(/^\n/, "").replace(/\n$/, "");
    const replace = match[2].replace(/^\n/, "").replace(/\n$/, "");
    if (search || replace) pairs.push({ search, replace });
  }
  return pairs;
}

/** Morph abbreviated edit 구성: search+replace 쌍으로 맥락 포함 */
function buildMorphEdit(pairs: { search: string; replace: string }[]): string {
  const parts = pairs.map((p) =>
    `// ... existing code ...\n// [FIND SIMILAR TO:] ${p.search.split("\n")[0]}\n${p.replace}`,
  );
  return parts.join("\n") + "\n// ... existing code ...";
}

/** Morph 출력 유효성 검증 */
function validateMorphOutput(html: string, originalLength: number): string | null {
  const sizeRatio = html.length / originalLength;
  if (sizeRatio > 2) {
    console.warn(`[morphApply] 거부: 크기 비율 ${sizeRatio.toFixed(1)}x`);
    return null;
  }
  if (!html.includes("<!DOCTYPE html") && !html.includes("<html")) {
    console.warn("[morphApply] 거부: HTML 구조 없음");
    return null;
  }
  if (!html.includes("</html>")) {
    console.warn("[morphApply] 거부: </html> 없음");
    return null;
  }
  return html;
}

/** 단일 Morph 호출 (타임아웃 포함) */
async function callMorph(original: string, edit: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MORPH_TIMEOUT);

  try {
    const res = await fetch("/api/morph/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ original, edit }),
      signal: controller.signal,
    });

    if (!res.ok) return null;
    const data = await res.json();
    return (data.html as string) || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** delta 실패 시 Morph에 원본 HTML + AI 변경 스니펫을 보내 재조립 (타임아웃 + 재시도) */
async function morphApply(existingHtml: string, fullText: string): Promise<string | null> {
  const pairs = extractDeltaPairs(fullText);
  if (pairs.length === 0) return null;

  const edit = buildMorphEdit(pairs);

  for (let attempt = 0; attempt <= MORPH_MAX_RETRIES; attempt++) {
    if (attempt > 0) console.warn(`[morphApply] 재시도 ${attempt}/${MORPH_MAX_RETRIES}`);

    const raw = await callMorph(existingHtml, edit);
    if (!raw) continue;

    const validated = validateMorphOutput(raw, existingHtml.length);
    if (validated) return validated;
  }

  return null;
}

// ── 최종 폴백: Claude에게 전체 HTML 재출력 요청 ──

/** delta + Morph 모두 실패 시, Claude에게 전체 HTML 재출력을 요청 */
async function requestFullHtmlFallback(
  messages: ApiMessage[],
  aiDeltaResponse: string,
  existingHtml: string,
): Promise<string | null> {
  const followUpMessages: ApiMessage[] = [
    ...messages,
    { role: "assistant", content: aiDeltaResponse },
    {
      role: "user",
      content:
        `[수정 적용 실패 — 전체 HTML 재출력 필요]\n` +
        `위 수정사항을 반영하여 전체 HTML을 \`\`\`html 코드 블록으로 출력해주세요. 대화 텍스트 없이 HTML만 출력합니다.\n\n` +
        `[현재 Prototype HTML]\n${existingHtml}`,
    },
  ];

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: followUpMessages }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text = data.text as string;
    if (!text) return null;

    const reParsed = parseResponse(text);
    return reParsed.html;
  } catch {
    return null;
  }
}

// ── API 호출 ──

function is504(err: unknown): boolean {
  return err instanceof Error && err.message.includes("504");
}

/** SSE 스트리밍 fetch — messages 배열 전송, 토큰 단위로 수신 */
async function fetchChatStream(
  messages: ApiMessage[],
  onToken?: (token: string) => void,
  existingHtml?: string,
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

  // delta 파싱 시도 (exact → fuzzy) → 실패 시 Morph 폴백
  const parsed = parseResponse(fullText, existingHtml);
  let { html } = parsed;
  const { spec, chatText, partialUpdate, deltaFailed } = parsed;
  let morphApplied = false;

  // Delta 실패 + full HTML도 없음 + existingHtml 존재 → 폴백 체인
  if (deltaFailed && !html && existingHtml) {
    // 1차 폴백: Morph
    const morphResult = await morphApply(existingHtml, fullText);
    if (morphResult) {
      html = morphResult;
      morphApplied = true;
    } else {
      // 2차 폴백: Claude에게 전체 HTML 재출력 요청
      console.warn("[fetchChatStream] Morph 실패 → Claude 전체 HTML 재출력 요청");
      const fullHtml = await requestFullHtmlFallback(messages, fullText, existingHtml);
      if (fullHtml) {
        html = fullHtml;
      }
    }
  }

  return { text: fullText, spec, html, chatText, partialUpdate: partialUpdate || morphApplied, morphApplied };
}

/** 단일 호출 — 스트리밍 우선, 504 시 1회 재시도 */
async function callChat(messages: ApiMessage[], onToken?: (token: string) => void, existingHtml?: string): Promise<ChatResponse> {
  try {
    return await fetchChatStream(messages, onToken, existingHtml);
  } catch (err) {
    if (!is504(err)) throw err;
  }
  return fetchChatStream(messages, onToken, existingHtml);
}

// ── 공개 API ──

export async function sendMessage(
  userMessage: string,
  history: ChatMessage[] = [],
  options: SendOptions = {},
): Promise<ChatResponse> {
  const dummy = matchDummy(userMessage);
  if (dummy) return dummy;

  const { onToken, existingHtml, ...buildOpts } = options;
  const messages = buildMessages(history, userMessage, buildOpts);
  return callChat(messages, onToken, existingHtml);
}
