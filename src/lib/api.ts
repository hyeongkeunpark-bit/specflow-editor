import { parseResponse, stripConversational } from "./parser";
import { matchDummy } from "./dummyResponse";
import { generateSpecSummary } from "./specSummary";
import type { ChatMessage } from "./types";

export interface ChatResponse {
  text: string;
  spec: string | null;
  html: string | null;
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
    parts.push(`[\uC774\uC804 \uB300\uD654]\n${lines.join("\n")}`);
  }

  parts.push(`[\uD604\uC7AC \uBA54\uC2DC\uC9C0]\n${currentMessage}`);

  return parts.join("\n\n");
}

// ── API 호출 ──

function is504(err: unknown): boolean {
  return err instanceof Error && err.message.includes("504");
}

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
  const { spec, html } = parseResponse(fullText);
  return { text: fullText, spec, html };
}

/** 단일 호출 — 504 시 1회 자동 재시도 후 throw */
async function callChat(message: string): Promise<ChatResponse> {
  try {
    return await fetchChat(message);
  } catch (err) {
    if (!is504(err)) throw err;
  }
  // 재시도 1회
  return fetchChat(message);
}

// ── 공개 API ──

export async function sendMessage(
  userMessage: string,
  history: ChatMessage[] = [],
  specContent?: string,
): Promise<ChatResponse> {
  // 테스트용 더미 매칭 (API 호출 없음)
  const dummy = matchDummy(userMessage);
  if (dummy) return dummy;

  const message = formatConversation(history, userMessage, specContent);
  return callChat(message);
}

// ── Spec 생성 트리거 ──

export function isSpecGenerationTrigger(text: string): boolean {
  return text.includes("Spec 생성") || text.includes("Spec을 생성");
}

// ── Spec 10단계 분할 생성 ──

const SECTION_LABELS: string[] = [
  "\uBA54\uD0C0 \uC815\uBCF4",
  "1\uBC88 \uBB38\uC81C \uC815\uC758",
  "2\uBC88 \uAC00\uC124",
  "3\uBC88 \uD574\uACB0\uCC45\xB7\uAE30\uB2A5 \uC124\uACC4",
  "4\uBC88 \uC2DC\uB098\uB9AC\uC624",
  "4\uBC88 \uAD6C\uD604 \uADDC\uCE59",
  "5\uBC88 \uC131\uACF5 \uAE30\uC900",
  "6\uBC88 \uC81C\uC57D \uC870\uAC74",
  "7\uBC88 \uD5A5\uD6C4 \uBC29\uD5A5",
  "8\uBC88 \uB9AC\uBDF0 \uB85C\uADF8",
  "\uD655\uC778\uC774 \uD544\uC694\uD55C \uD56D\uBAA9",
];

const SECTION_SUFFIXES: string[] = [
  "\uBA54\uD0C0 \uC815\uBCF4\uC640 \uC2A4\uCF54\uD504 \uC694\uC57D\uC744 \uC0DD\uC131\uD574\uC918.",
  "1\uBC88\uC744 \uC0DD\uC131\uD574\uC918.",
  "2\uBC88\uC744 \uC0DD\uC131\uD574\uC918.",
  "3\uBC88\uC744 \uC0DD\uC131\uD574\uC918.",
  "4\uBC88 \uC2DC\uB098\uB9AC\uC624\uB9CC \uC0DD\uC131\uD574\uC918.",
  "4\uBC88 \uAD6C\uD604 \uADDC\uCE59\uB9CC \uC0DD\uC131\uD574\uC918.",
  "5\uBC88\uC744 \uC0DD\uC131\uD574\uC918.",
  "6\uBC88\uC744 \uC0DD\uC131\uD574\uC918.",
  "7\uBC88\uC744 \uC0DD\uC131\uD574\uC918.",
  "8\uBC88\uC744 \uC0DD\uC131\uD574\uC918.",
  "\uD655\uC778\uC774 \uD544\uC694\uD55C \uD56D\uBAA9\uC744 \uC0DD\uC131\uD574\uC918.",
];

export interface SpecChunkedResult {
  fullSpec: string;
  failedSteps: number[];
}

/**
 * Spec 11단계 분할 생성
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

    const instruction = " \uD574\uB2F9 \uC139\uC158 \uBCF8\uBB38\uB9CC \uCD9C\uB825\uD574. '\uB2E4\uC74C \uC139\uC158\uC744 \uC0DD\uC131\uD560\uAE4C\uC694?' \uAC19\uC740 \uC548\uB0B4\uB294 \uBD99\uC774\uC9C0 \uB9C8.";
    const message =
      `[이전 대화]\n${contextLines.join("\n")}\n\n[현재 메시지]\nSpec \uC0DD\uC131\uC744 \uACC4\uC18D\uD569\uB2C8\uB2E4. ${SECTION_SUFFIXES[i]}${instruction}`;

    try {
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
    return "\u2705 Spec \uC0DD\uC131 \uC644\uB8CC";
  }

  const lines = [
    `\u2705 Spec \uC0DD\uC131 \uC644\uB8CC (${success}/${total} \uC139\uC158)`,
    `\u26A0\uFE0F \uC544\uB798 \uC139\uC158\uC740 \uC751\uB2F5 \uC2DC\uAC04 \uCD08\uACFC\uB85C \uC0DD\uC131\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uB0B4\uC6A9\uC774 \uAE38\uC5B4\uC11C \uBC1C\uC0DD\uD55C \uBB38\uC81C\uC774\uBBC0\uB85C, \uB098\uB220\uC11C \uC694\uCCAD\uD558\uBA74 \uD574\uACB0\uB429\uB2C8\uB2E4.`,
  ];

  for (const idx of failedSteps) {
    const label = SECTION_LABELS[idx];
    const suffix = SECTION_SUFFIXES[idx];
    lines.push(`- ${label}: '${suffix}' \uB85C \uC785\uB825`);
  }

  return lines.join("\n");
}
