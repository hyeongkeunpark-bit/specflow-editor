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

  // 수정 모드: Spec이 존재하면 목차 요약 추가
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

/** 비스트리밍 fetch (폴백용) */
async function fetchChat(message: string): Promise<ChatResponse> {
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
  // 재시도 1회
  return fetchChatStream(message, onToken);
}

// ── 공개 API ──

export async function sendMessage(
  userMessage: string,
  history: ChatMessage[] = [],
  specContent?: string,
  onToken?: (token: string) => void,
): Promise<ChatResponse> {
  // 테스트용 더미 매칭 (API 호출 없음)
  const dummy = matchDummy(userMessage);
  if (dummy) return dummy;

  const message = formatConversation(history, userMessage, specContent);
  return callChat(message, onToken);
}

// ── Spec 생성 트리거 ──

export function isSpecGenerationTrigger(text: string): boolean {
  return text.includes("Spec 생성") || text.includes("Spec을 생성");
}

// ── Spec 11단계 분할 생성 ──

const SECTION_LABELS: string[] = [
  "메타 정보",
  "1번 문제 정의",
  "2번 가설",
  "3번 해결책·기능 설계",
  "4번 시나리오",
  "4번 구현 규칙",
  "5번 성공 기준",
  "6번 제약 조건",
  "7번 향후 방향",
  "8번 리뷰 로그",
  "확인이 필요한 항목",
];

const SECTION_SUFFIXES: string[] = [
  "메타 정보와 스코프 요약을 생성해줘.",
  "1번을 생성해줘.",
  "2번을 생성해줘.",
  "3번을 생성해줘.",
  "4번 시나리오만 생성해줘.",
  "4번 구현 규칙만 생성해줘.",
  "5번을 생성해줘.",
  "6번을 생성해줘.",
  "7번을 생성해줘.",
  "8번을 생성해줘.",
  "확인이 필요한 항목을 생성해줘.",
];

export interface SpecChunkedResult {
  fullSpec: string;
  failedSteps: number[];
}

/**
 * Spec 11단계 분할 생성 (각 단계는 스트리밍으로 호출)
 * onStart(step, label): 단계 시작
 * onChunk(step, chunk): Spec 본문 수신
 * onSkip(step, label): 504로 건너뛴 단계
 */
export async function sendSpecChunked(
  history: ChatMessage[],
  onStart: (step: number, label: string) => void,
  onChunk: (step: number, chunk: string) => void,
  onSkip: (step: number, label: string) => void,
): Promise<SpecChunkedResult> {
  // 분할 호출용 이력: Spec 내용 제외, 최근 10개, AI 500자 제한
  const baseLines = truncateHistory(history).map((m) => {
    const content =
      m.role === "ai" && m.content.length > MAX_AI_LENGTH
        ? m.content.slice(0, MAX_AI_LENGTH) + "...(생략)"
        : m.content;
    return m.role === "user" ? `사용자: ${content}` : `AI: ${content}`;
  });

  let fullSpec = "";
  const failedSteps: number[] = [];
  const completedSections: string[] = [];

  for (let i = 0; i < SECTION_SUFFIXES.length; i++) {
    const label = `📝 Spec 생성 중... (${i + 1}/${SECTION_SUFFIXES.length}) ${SECTION_LABELS[i]}`;
    onStart(i, label);

    // 이력 구성: 원본 대화 + 완료 요약 (Spec 본문 미포함)
    const contextLines = [...baseLines];
    if (completedSections.length > 0) {
      contextLines.push(`AI: [이전 호출에서 ${completedSections.join(", ")}을 생성 완료]`);
    }

    const instruction = " 해당 섹션 본문만 출력해. '다음 섹션을 생성할까요?' 같은 안내는 붙이지 마.";
    const message =
      `[이전 대화]\n${contextLines.join("\n")}\n\n[현재 메시지]\nSpec 생성을 계속합니다. ${SECTION_SUFFIXES[i]}${instruction}`;

    try {
      // 각 단계도 스트리밍으로 호출 (504 방지), 토큰 UI 표시는 안 함
      const response = await callChat(message);
      // Spec 섹션 헤더가 없는 응답은 대화형 텍스트 → Spec에 넣지 않음
      const rawChunk = response.spec;
      if (!rawChunk) {
        // Spec 헤더 없는 대화형 응답 → Spec에 넣지 않고 넘어감
        completedSections.push(SECTION_LABELS[i]);
        continue;
      }
      const chunk = stripConversational(rawChunk);
      fullSpec += (fullSpec ? "\n\n" : "") + chunk;
      completedSections.push(SECTION_LABELS[i]);
      onChunk(i, chunk);
    } catch (err) {
      if (is504(err)) {
        failedSteps.push(i);
        onSkip(i, SECTION_LABELS[i]);
      } else {
        throw err;
      }
    }
  }

  return { fullSpec, failedSteps };
}

/** 실패한 섹션에 대한 재시도 안내 메시지 생성 */
export function buildFailureSummary(failedSteps: number[]): string {
  const total = SECTION_SUFFIXES.length;
  const success = total - failedSteps.length;

  if (failedSteps.length === 0) {
    return "✅ Spec 생성 완료";
  }

  const lines = [
    `✅ Spec 생성 완료 (${success}/${total} 섹션)`,
    `⚠️ 아래 섹션은 응답 시간 초과로 생성하지 못했습니다. 내용이 길어서 발생한 문제이므로, 나눠서 요청하면 해결됩니다.`,
  ];

  for (const idx of failedSteps) {
    const label = SECTION_LABELS[idx];
    const suffix = SECTION_SUFFIXES[idx];
    lines.push(`- ${label}: '${suffix}' 로 입력`);
  }

  return lines.join("\n");
}
