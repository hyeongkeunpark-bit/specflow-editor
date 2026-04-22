/**
 * Spec 업데이트 진단 로거
 * AI 원시 응답, <spec> 추출 결과, mergeSpec 전후를 localStorage에 저장 + console 출력.
 * 목적: AI가 "업데이트 완료"라 선언했지만 실제 반영되지 않는 사고의 원인 캡처.
 *
 * 브라우저 콘솔에서 이력 조회: `dumpSpecEvents()`
 * 특정 이벤트 상세: `dumpSpecEvents()[0]`
 * 이력 초기화: `clearSpecEvents()`
 */

const KEY = "specflow_spec_debug";
const MAX = 20;

export type SpecEvent = {
  timestamp: string;
  trigger: "handleSpecUpdate" | "handleSend" | "handleProtoFromSpec" | "handleConsistencyCheck";
  sessionId?: string;
  /** AI가 스트리밍으로 보낸 전체 raw text */
  rawStream: string;
  /** parseResponse가 <spec> 태그에서 추출한 내용 (null이면 <spec> 태그 없음) */
  responseSpec: string | null;
  /** merge 전 Spec (= activeSession.specContent) */
  existingSpec: string;
  /** merge 후 Spec (= setSpecContent에 전달된 값) */
  mergedSpec: string;
  /** 길이·섹션 수 비교 */
  stats: {
    existingLength: number;
    mergedLength: number;
    lengthDelta: number;
    existingSections: number; // ## 헤더 개수
    incomingSections: number;
    mergedSections: number;
    existingSubSections: number; // ### 헤더 개수
    incomingSubSections: number;
    mergedSubSections: number;
  };
};

function countHeaders(text: string, level: 2 | 3): number {
  const regex = level === 2 ? /^##\s+/gm : /^###\s+/gm;
  return (text.match(regex) || []).length;
}

export function recordSpecEvent(params: {
  trigger: SpecEvent["trigger"];
  sessionId?: string;
  rawStream: string;
  responseSpec: string | null;
  existingSpec: string;
  mergedSpec: string;
}) {
  const { trigger, sessionId, rawStream, responseSpec, existingSpec, mergedSpec } = params;
  const ev: SpecEvent = {
    timestamp: new Date().toISOString(),
    trigger,
    sessionId,
    rawStream,
    responseSpec,
    existingSpec,
    mergedSpec,
    stats: {
      existingLength: existingSpec.length,
      mergedLength: mergedSpec.length,
      lengthDelta: mergedSpec.length - existingSpec.length,
      existingSections: countHeaders(existingSpec, 2),
      incomingSections: responseSpec ? countHeaders(responseSpec, 2) : 0,
      mergedSections: countHeaders(mergedSpec, 2),
      existingSubSections: countHeaders(existingSpec, 3),
      incomingSubSections: responseSpec ? countHeaders(responseSpec, 3) : 0,
      mergedSubSections: countHeaders(mergedSpec, 3),
    },
  };

  // localStorage 저장 (용량 보호: rawStream 너무 크면 잘라서 저장)
  try {
    const rawLimit = 40_000;
    const trimmed: SpecEvent = {
      ...ev,
      rawStream: ev.rawStream.length > rawLimit
        ? ev.rawStream.slice(0, rawLimit) + `\n...(${ev.rawStream.length - rawLimit}자 생략)`
        : ev.rawStream,
    };
    const raw = localStorage.getItem(KEY);
    const events: SpecEvent[] = raw ? JSON.parse(raw) : [];
    events.push(trimmed);
    while (events.length > MAX) events.shift();
    localStorage.setItem(KEY, JSON.stringify(events));
  } catch (err) {
    console.warn("[specDebug] localStorage 저장 실패:", err);
  }

  // 콘솔 즉시 출력
  const s = ev.stats;
  const isAnomaly = s.lengthDelta < -100 || (s.existingSections > 0 && s.mergedSections < s.existingSections);
  const prefix = isAnomaly ? "🚨" : "🔬";
  console.group(`${prefix} Spec 이벤트 [${ev.trigger}] ${ev.timestamp}${isAnomaly ? " (이상 감지)" : ""}`);
  console.log("stats:", s);
  console.log("rawStream (전체):");
  console.log(ev.rawStream);
  console.log("response.spec (<spec> 추출):");
  console.log(ev.responseSpec);
  console.log("existingSpec (merge 전):");
  console.log(ev.existingSpec);
  console.log("mergedSpec (merge 후):");
  console.log(ev.mergedSpec);
  console.groupEnd();

  if (isAnomaly) {
    console.warn(
      `[specDebug] 🚨 이상 감지: 길이 ${s.lengthDelta > 0 ? "+" : ""}${s.lengthDelta}, ` +
      `섹션 ${s.existingSections}→${s.mergedSections}. ` +
      `\`dumpSpecEvents()\` 로 상세 확인.`
    );
  }
}

export function dumpSpecEvents(): SpecEvent[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearSpecEvents(): void {
  try {
    localStorage.removeItem(KEY);
    console.log("[specDebug] 이벤트 이력 초기화됨");
  } catch (err) {
    console.warn("[specDebug] 초기화 실패:", err);
  }
}

// 브라우저 콘솔에서 호출 가능하도록 window에 노출
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).dumpSpecEvents = dumpSpecEvents;
  (window as unknown as Record<string, unknown>).clearSpecEvents = clearSpecEvents;
}
