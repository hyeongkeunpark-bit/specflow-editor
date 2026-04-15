import { parseResponse, extractPrototypeDeltas } from "./parser";
import { matchDummy } from "./dummyResponse";
import { recordDelta } from "./deltaStats";
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
  content: string | ContentBlock[];
}

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

const MAX_HISTORY = 10;
const HISTORY_MSG_MAX_LENGTH = 3000;
const HISTORY_MSG_TRUNCATE_TO = 1500;

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
  /** Prototype 업데이트 모드 — Spec 변경을 Prototype에 반영 */
  protoUpdateMode?: {
    specContent: string;
    htmlContent: string;
  };
  /** 스트리밍 토큰 콜백 */
  onToken?: (token: string) => void;
  /** 현재 Prototype HTML (partial update merge용 + str_replace tool용) */
  existingHtml?: string;
  /** 첨부 이미지 배열 (최대 5장) — 현재 메시지에서만 사용, 저장 안 함 */
  images?: { base64: string; mediaType: string }[];
  /** 시스템 프롬프트 모드 — "none"이면 시스템 프롬프트 제외 (토큰 절감) */
  systemPromptMode?: "full" | "none";
  /** 취소 시그널 */
  signal?: AbortSignal;
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

  const { specContent, htmlContent, specUpdateMode, protoUpdateMode, images } = options;
  // runtimeErrors는 일반 채팅에 포함하지 않음 — 에러 수정은 자동 수정 버튼(/api/chat/fix-errors)으로만 처리
  // 이유: 에러 컨텍스트가 포함되면 AI가 에러 수정 + 수정 요청을 동시 처리하다가 delta search 텍스트를 부정확하게 작성

  // Spec/Prototype 업데이트 모드에서는 대화 이력을 최소화
  // 일반 모드에서는 최근 N개 대화 이력 포함
  if (!specUpdateMode && !protoUpdateMode) {
    const relevant = history
      .filter((m) => m.role === "user" || m.role === "ai")
      .slice(-MAX_HISTORY);

    for (const m of relevant) {
      if (m.role === "user") {
        // 사용자 메시지에서 컨텍스트(HTML/Spec) 제거 → 요청 텍스트만 유지
        let userContent = m.content;
        const reqIdx = userContent.indexOf("[요청]\n");
        if (reqIdx >= 0) {
          userContent = userContent.slice(reqIdx + "[요청]\n".length);
        }
        if (!userContent.trim()) continue; // 빈 메시지 스킵
        if (userContent.length > HISTORY_MSG_MAX_LENGTH) {
          userContent = userContent.slice(0, HISTORY_MSG_TRUNCATE_TO) + "\n...(이하 생략)";
        }
        messages.push({ role: "user", content: userContent });
      } else {
        // AI 응답에서 <spec>, delta, HTML 블록 제거 → 채팅 텍스트만 유지
        let cleaned = m.content
          .replace(/<spec>[\s\S]*?<\/spec>/g, "")
          .replace(/<prototype_delta>[\s\S]*?<\/prototype_delta>/g, "")
          .replace(/```html[\s\S]*?```/g, "")
          .trim();
        if (!cleaned) continue; // 빈 메시지 스킵 (cache_control 에러 방지)
        if (cleaned.length > HISTORY_MSG_MAX_LENGTH) {
          cleaned = cleaned.slice(0, HISTORY_MSG_TRUNCATE_TO) + "\n...(이하 생략)";
        }
        messages.push({ role: "assistant", content: cleaned });
      }
    }
  }

  if (specUpdateMode) {
    // [Spec 문서 업데이트] 버튼 모드: Spec + HTML + 변경이력
    const hasChangeLog = specUpdateMode.changeLog.length > 0;
    const changeLogText = hasChangeLog
      ? specUpdateMode.changeLog.map((c, i) => `${i + 1}. ${c}`).join("\n")
      : "";

    const parts = [
      `[Spec 문서 업데이트 요청]`,
      specUpdateMode.specContent
        ? `[현재 Spec 전문]\n${specUpdateMode.specContent}`
        : `[현재 Spec 전문]\n(아직 생성되지 않음)`,
      `[현재 Prototype HTML]\n${specUpdateMode.htmlContent}`,
    ];

    if (!specUpdateMode.specContent) {
      parts.push(`현재 Prototype HTML을 분석하여 Spec을 생성해 주세요. Prototype에 구현된 기능과 UI를 기준으로 작성해 주세요.`);
    } else if (hasChangeLog) {
      parts.push(`[Prototype 변경 이력]\n${changeLogText}`);
      parts.push(`위 내용을 기반으로 Spec을 업데이트해 주세요.\n\n**판단 기준:**\n- 새 데이터 필드 추가, 새 UI 요소 추가, 사용자 플로우 변경, 기능 추가/삭제 → Spec 업데이트 필요\n- 색상, 간격, 폰트 크기 등 순수 CSS 스타일만 변경 → Spec 업데이트 불필요\n\n업데이트가 필요하면 해당 섹션을 수정하세요. 불필요하면 안내만 해 주세요.`);
    } else {
      parts.push(`현재 Spec과 Prototype을 비교해 주세요. Spec에 반영되지 않은 차이가 있으면 업데이트하세요. 이미 일치하면 "업데이트할 내용이 없습니다."라고 안내만 해 주세요. Spec을 불필요하게 다시 작성하지 마세요.`);
    }
    messages.push({ role: "user", content: parts.join("\n\n") });
  } else if (protoUpdateMode) {
    // [Prototype 업데이트] 모드: Spec 변경을 Prototype에 반영
    const parts = [
      `[Prototype 업데이트 요청]`,
      `[현재 Spec 전문]\n${protoUpdateMode.specContent}`,
      `[현재 Prototype HTML]\n${protoUpdateMode.htmlContent}`,
      `Spec이 수정되었습니다. **Spec을 기준으로 Prototype을 수정해 주세요.** Spec에 명시된 정책, 수치, 규칙, 기능, 제목, 텍스트, UI 요소가 Prototype에 올바르게 반영되어야 합니다.\n\nPrototype이 Spec과 다른 부분이 있으면 수정하세요. 이미 일치하면 "업데이트할 내용이 없습니다."라고 안내만 해 주세요. 변경 시 <prototype_delta> 형식을 사용하세요. <spec> 태그는 출력하지 마세요.`,
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
    let userText = currentMessage;
    if (contextParts.length > 0) {
      userText = contextParts.join("\n\n") + `\n\n[요청]\n${currentMessage}`;
    }

    // 이미지가 있으면 multimodal content block으로 구성 (라벨 포함)
    if (images && images.length > 0) {
      const contentBlocks: ContentBlock[] = [];
      images.forEach((img, idx) => {
        const base64Data = img.base64.includes(",") ? img.base64.split(",")[1] : img.base64;
        contentBlocks.push({ type: "text", text: `[첨부 이미지 ${idx + 1}]` });
        contentBlocks.push({ type: "image", source: { type: "base64", media_type: img.mediaType || "image/jpeg", data: base64Data } });
      });
      contentBlocks.push({ type: "text", text: userText });
      messages.push({ role: "user", content: contentBlocks });
    } else {
      messages.push({ role: "user", content: userText });
    }
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

/** 퇴화 감지: 60자 서브스트링을 8곳에서 샘플링, 3회 이상 반복되면 LLM 루프 판정 */
function hasDegeneration(html: string): boolean {
  if (html.length < 500) return false;
  const LEN = 60;
  const SAMPLES = 8;
  const step = Math.floor((html.length - LEN) / SAMPLES);

  for (let i = 0; i < SAMPLES; i++) {
    const pos = i * step;
    const sub = html.slice(pos, pos + LEN);
    let count = 0;
    let idx = -1;
    while ((idx = html.indexOf(sub, idx + 1)) >= 0) {
      count++;
      if (count >= 3) return true;
    }
  }
  return false;
}

/** Morph 출력 유효성 검증 */
function validateMorphOutput(
  html: string,
  originalLength: number,
  replaceParts?: string[],
): string | null {
  // 1. 크기 비율 검사 (1.5x 이내)
  const sizeRatio = html.length / originalLength;
  if (sizeRatio > 1.5) {
    console.warn(`[morphApply] 거부: 크기 비율 ${sizeRatio.toFixed(1)}x`);
    return null;
  }
  // 극단적 축소도 거부 (0.5x 미만)
  if (sizeRatio < 0.5) {
    console.warn(`[morphApply] 거부: 과도한 축소 ${sizeRatio.toFixed(2)}x`);
    return null;
  }

  // 2. HTML 구조 검사
  if (!html.includes("<!DOCTYPE html") && !html.includes("<html")) {
    console.warn("[morphApply] 거부: HTML 구조 없음");
    return null;
  }
  if (!html.includes("</html>")) {
    console.warn("[morphApply] 거부: </html> 없음");
    return null;
  }

  // 3. 퇴화 감지 (반복 패턴)
  if (hasDegeneration(html)) {
    console.warn("[morphApply] 거부: 퇴화 감지 (반복 패턴)");
    return null;
  }

  // 4. 내용 검증: replace 텍스트의 핵심 부분이 출력에 포함되어야 함
  if (replaceParts && replaceParts.length > 0) {
    const missingCount = replaceParts.filter((part) => !html.includes(part)).length;
    if (missingCount === replaceParts.length) {
      console.warn(`[morphApply] 거부: replace 내용 ${missingCount}/${replaceParts.length}개 누락`);
      return null;
    }
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

  // replace 텍스트의 핵심 부분 추출 (내용 검증용, 각 replace의 첫 30자)
  const replaceParts = pairs
    .map((p) => p.replace.trim().slice(0, 30))
    .filter((p) => p.length >= 10);

  for (let attempt = 0; attempt <= MORPH_MAX_RETRIES; attempt++) {
    if (attempt > 0) console.warn(`[morphApply] 재시도 ${attempt}/${MORPH_MAX_RETRIES}`);

    const raw = await callMorph(existingHtml, edit);
    if (!raw) continue;

    const validated = validateMorphOutput(raw, existingHtml.length, replaceParts);
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
        `**중요:** 현재 HTML의 모든 기능, UI 요소, 입력 필드, 버튼을 그대로 유지하세요. 기존 요소를 제거하지 마세요. 요청된 수정사항만 반영하고 나머지는 원본 그대로 출력합니다.\n\n` +
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

function isRetryable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.message.includes("504") || err.message.toLowerCase().includes("overloaded");
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

/** SSE 스트리밍 fetch — messages 배열 전송, 토큰 단위로 수신 */
async function fetchChatStream(
  messages: ApiMessage[],
  onToken?: (token: string) => void,
  existingHtml?: string,
  signal?: AbortSignal,
  systemPromptMode?: "full" | "none",
): Promise<ChatResponse> {
  // existingHtml을 그대로 사용 — AI에게 보낸 포맷과 동일하게 delta 매칭
  const body: Record<string, unknown> = { messages };
  if (systemPromptMode) body.systemPromptMode = systemPromptMode;
  const res = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
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
  // existingHtml로 매칭 — buildMessages에서 AI에게 보낸 포맷과 일치
  const parsed = parseResponse(fullText, existingHtml);
  let { html } = parsed;
  const { spec, chatText, partialUpdate, deltaFailed } = parsed;
  let morphApplied = false;

  // Delta 실패 + full HTML도 없음 + existingHtml 존재 → 폴백 체인
  if (deltaFailed && !html && existingHtml) {
    const deltaCount = extractPrototypeDeltas(fullText)?.length ?? 0;

    // 1차 폴백: Morph (원본 HTML 기반)
    const morphResult = await morphApply(existingHtml, fullText);
    if (morphResult) {
      html = morphResult;
      morphApplied = true;
      recordDelta(deltaCount, "morph");
    } else {
      // 2차 폴백: Claude에게 전체 HTML 재출력 요청
      console.warn("[fetchChatStream] Morph 실패 → Claude 전체 HTML 재출력 요청");
      const fullHtml = await requestFullHtmlFallback(messages, fullText, existingHtml);
      if (fullHtml) {
        html = fullHtml;
        recordDelta(deltaCount, "claude_fallback");
      } else {
        recordDelta(deltaCount, "none");
      }
    }
  } else if (deltaFailed && html) {
    // delta는 실패했지만 응답에 전체 HTML이 포함되어 있었음
    const deltaCount = extractPrototypeDeltas(fullText)?.length ?? 0;
    recordDelta(deltaCount, "full_html_in_response");
  }

  return { text: fullText, spec, html, chatText, partialUpdate: partialUpdate || morphApplied, morphApplied };
}

/** 단일 호출 — 504/overloaded 시 2초 대기 후 1회 재시도 */
async function callChat(messages: ApiMessage[], onToken?: (token: string) => void, existingHtml?: string, signal?: AbortSignal, systemPromptMode?: "full" | "none"): Promise<ChatResponse> {
  try {
    return await fetchChatStream(messages, onToken, existingHtml, signal, systemPromptMode);
  } catch (err) {
    if (!isRetryable(err)) throw err;
    console.warn("[callChat] 재시도 (2초 대기):", err instanceof Error ? err.message : err);
    await sleep(2000);
  }
  try {
    return await fetchChatStream(messages, onToken, existingHtml, signal, systemPromptMode);
  } catch (err) {
    // 재시도도 실패 → 유저 친화적 메시지로 교체
    if (err instanceof Error && err.message.toLowerCase().includes("overloaded")) {
      throw new Error("서버가 일시적으로 혼잡합니다. 잠시 후 다시 시도해주세요.");
    }
    throw err;
  }
}

// ── 공개 API ──

export async function sendMessage(
  userMessage: string,
  history: ChatMessage[] = [],
  options: SendOptions = {},
): Promise<ChatResponse> {
  const dummy = matchDummy(userMessage);
  if (dummy) return dummy;

  const { onToken, existingHtml, signal, systemPromptMode, ...buildOpts } = options;
  const messages = buildMessages(history, userMessage, buildOpts);
  return callChat(messages, onToken, existingHtml, signal, systemPromptMode);
}

/**
 * Prototype 공유 URL 생성/업데이트 — R2에 HTML 업로드
 * 같은 sessionId로 호출하면 같은 URL에 내용만 갱신됨
 */
export async function sharePrototype(
  html: string,
  sessionId: string,
): Promise<{ url: string }> {
  const res = await fetch("/api/share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html, sessionId }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Share failed: ${res.status}`);
  }

  return res.json();
}

/**
 * 에러 수정 전용 API — 대화 이력 없이 현재 HTML + 에러 분석만 전송.
 * 전용 시스템 프롬프트를 사용하여 최소 수정만 수행.
 */
export async function fixErrors(
  html: string,
  errors: string,
  onToken?: (token: string) => void,
): Promise<ChatResponse> {
  const res = await fetch("/api/chat/fix-errors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html, errors }),
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

  // delta 파싱 (전용 프롬프트는 delta만 출력하므로 existingHtml 전달)
  const parsed = parseResponse(fullText, html);
  let { html: resultHtml } = parsed;
  const { spec, chatText, partialUpdate, deltaFailed } = parsed;

  // delta 실패 시 Morph 폴백만 시도 (Claude 전체 재출력은 안 함 — 기능 삭제 방지)
  if (deltaFailed && !resultHtml) {
    const morphResult = await morphApply(html, fullText);
    if (morphResult) {
      resultHtml = morphResult;
    }
  }

  return { text: fullText, spec, html: resultHtml, chatText, partialUpdate };
}
