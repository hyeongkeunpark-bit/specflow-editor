/**
 * AI 응답 텍스트에서 HTML과 Spec을 분리하는 파서
 */

// ── Spec 정규화: AI가 ## 헤더 없이 출력한 내용을 올바른 섹션에 배치 ──

/** 섹션별 서브 요소 패턴 — 고아 콘텐츠를 섹션에 매핑할 때 사용 */
const SECTION_SUB_ELEMENTS: { sectionHeader: string; patterns: RegExp[] }[] = [
  {
    sectionHeader: "## 1. 문제",
    patterns: [/^\*\*타겟\s*유저\*\*/, /^\*\*문제\s*정의\*\*/, /^\*\*근거\*\*/],
  },
  {
    sectionHeader: "## 2. 가설",
    patterns: [/^\*\*IF\*\*|^>\s*\*\*IF\*\*/, /^\*\*현재\s*데이터\*\*/, /^\*\*KR\*\*/, /^\*\*상위\s*KR\*\*/],
  },
  {
    sectionHeader: "## 3. 해결책",
    patterns: [/^\*\*Before.*After\*\*|^Before.*After/, /^###\s+사용자\s*플로우/, /^###\s+플랫폼별/, /^###\s+Prototype/, /^###\s+화면별\s+변경점/, /^###\s+UI\s+기획/],
  },
];

/**
 * AI 응답을 정규화: ## 헤더 없이 출력된 Spec 내용을 올바른 ## 섹션에 삽입
 * - AI가 정상적으로 ## 구조를 따랐으면 아무 것도 안 함
 * - # Product Spec 제목을 보존
 */
export function normalizeSpec(text: string): string {
  // ## 헤더가 하나도 없으면 정규화 불필요
  const firstH2 = text.search(/^##\s+/m);
  if (firstH2 < 0) return text;

  // 첫 ## 이전 고아 콘텐츠 추출
  const preamble = text.slice(0, firstH2);
  const rest = text.slice(firstH2);

  // 고아 콘텐츠에 Spec 서브 요소 패턴이 없으면 정규화 불필요
  const preambleLines = preamble.split("\n");
  const hasSpecPattern = preambleLines.some((line) =>
    SECTION_SUB_ELEMENTS.some((sec) =>
      sec.patterns.some((p) => p.test(line.trim())),
    ),
  );
  if (!hasSpecPattern) return text;

  // # Product Spec 제목 추출
  let titleLine = "";
  const nonTitleLines: string[] = [];
  for (const line of preambleLines) {
    if (!titleLine && /^#\s+(?!#)/.test(line)) {
      titleLine = line;
    } else {
      nonTitleLines.push(line);
    }
  }

  // 고아 콘텐츠를 섹션별로 분류
  const sectionBuckets = new Map<string, string[]>();
  let currentSection = "";

  for (const line of nonTitleLines) {
    const trimmed = line.trim();
    // 스코프 요약 관련 패턴 (영역, 시나리오 커버리지) — 스킵 (이미 ## 스코프 요약에 있음)
    if (/^\*\*영역\*\*|^>\s*\*\*영역\*\*|^시나리오\s*커버리지|^>\s*시나리오/.test(trimmed)) continue;
    // 주간 리뷰 안내 — 스킵
    if (/주간\s*리뷰\s*공유\s*범위/.test(trimmed)) continue;
    // 구현자 참조 안내 — 스킵
    if (/여기서부터는\s*구현자/.test(trimmed)) continue;

    // 서브 요소 패턴 매칭 → 섹션 전환
    for (const sec of SECTION_SUB_ELEMENTS) {
      if (sec.patterns.some((p) => p.test(trimmed))) {
        currentSection = sec.sectionHeader;
        break;
      }
    }

    if (currentSection) {
      if (!sectionBuckets.has(currentSection)) sectionBuckets.set(currentSection, []);
      sectionBuckets.get(currentSection)!.push(line);
    }
    // currentSection이 없으면 (매핑 불가) → 버림 (대화 텍스트)
  }

  // 빈 ## 헤더에 고아 콘텐츠 주입
  let result = rest;
  for (const [header, lines] of sectionBuckets) {
    const content = lines.join("\n").trim();
    if (!content) continue;

    // 해당 ## 헤더를 찾아서 내용 주입
    const headerPattern = header.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // 빈 헤더 또는 "거의 빈" 헤더 (태그 한 줄만 있는 경우) 감지
    // 태그 라인: "> 📝 초안", "> ⚠️ 확인 필요" 등 (emoji를 직접 매칭하지 않고 패턴으로)
    const nearEmptyRegex = new RegExp(
      `(^${headerPattern}[^\\n]*\\n)((?:[ \\t]*\\n|>\\s*.{0,4}(?:초안|확인|권장).*\\n|[ \\t]*\\n)*)(?=^##\\s|$)`,
      "m",
    );
    const match = result.match(nearEmptyRegex);
    if (match) {
      // 빈/거의 빈 헤더에 내용 주입 (기존 태그 한 줄은 교체)
      result = result.replace(nearEmptyRegex, `$1\n${content}\n\n`);
    } else {
      // 헤더가 아예 없으면 적절한 위치에 삽입
      if (!result.includes(header)) {
        const insertBefore = result.search(/^##\s+4[.\s]/m);
        if (insertBefore > 0) {
          result = result.slice(0, insertBefore) + `${header}\n\n${content}\n\n` + result.slice(insertBefore);
        }
      }
    }
  }

  // 제목 복원
  if (titleLine) {
    result = titleLine + "\n\n" + result;
  }

  return result;
}

/**
 * HTML 블록 추출
 * 1. ```html ... ``` 코드 블록
 * 2. <!DOCTYPE html> ... </html> raw HTML
 */
export function extractHtml(text: string): string | null {
  const fencedMatch = text.match(/```html\s*\n([\s\S]*?)```/);
  if (fencedMatch) return fencedMatch[1].trim();

  const rawMatch = text.match(/(<!DOCTYPE html[\s\S]*?<\/html>)/i);
  if (rawMatch) return rawMatch[1].trim();

  return null;
}

/**
 * HTML 블록을 제거한 나머지 = Spec 문서
 * 최초 ## 헤더 이전의 대화형 텍스트도 제거
 */
export function extractSpec(text: string): string {
  let spec = text.replace(/```html\s*\n[\s\S]*?```/g, "");
  spec = spec.replace(/<!DOCTYPE html[\s\S]*?<\/html>/gi, "");
  spec = spec.trim();

  // ## 헤더가 있으면, 그 이전의 대화형 텍스트를 제거
  // (# 제목은 유지 — "# Product Spec" 등)
  const firstSectionHeader = spec.search(/^##\s+/m);
  if (firstSectionHeader > 0) {
    const preamble = spec.slice(0, firstSectionHeader).trim();
    // # 으로 시작하는 제목이면 유지, 아니면 제거
    if (preamble && !preamble.startsWith("#")) {
      spec = spec.slice(firstSectionHeader);
    }
  }

  return spec.trim();
}

/**
 * Spec 본문에서 대화형 텍스트를 제거
 */
export function stripConversational(text: string): string {
  let result = text;

  // 대화형 마무리 제거
  const trailingPatterns = [
    /\n*---\n*다음 섹션을[^\n]*/g,
    /\n*다음 섹션을 이어서 생성할까요\?[^\n]*/g,
    /\n*이어서 \d+번을? 생성할까요\?[^\n]*/g,
    /\n*다음으로 넘어갈까요\?[^\n]*/g,
    /\n*계속 진행할까요\?[^\n]*/g,
    /\n*다른 섹션도 생성할까요\?[^\n]*/g,
    /\n*['"]\d+번 .*생성해줘['"][^\n]*/g,
  ];
  for (const p of trailingPatterns) {
    result = result.replace(p, "");
  }

  // 대화형 시작 문구 제거 (첫 줄만)
  result = result.replace(
    /^(좋습니다[.!,]?\s*|네[,.]?\s*|알겠습니다[.!,]?\s*|물론입니다[.!,]?\s*|이어서\s+)/,
    "",
  );

  return result.trim();
}

// ── Spec 섹션 merge ──

/**
 * 섹션 헤더 패턴 (순서대로)
 * "## 메타 정보" 또는 번호 있는 "## 1." ~ "## 8." 또는 "## 확인이 필요한 항목"
 */
const SECTION_ORDER = [
  /^##\s+메타\s*정보/m,
  /^##\s+스코프\s*요약/m,
  /^##\s+1[.\s]/m,
  /^##\s+2[.\s]/m,
  /^##\s+3[.\s]/m,
  /^##\s+4[.\s]/m,
  /^##\s+5[.\s]/m,
  /^##\s+6[.\s]/m,
  /^##\s+7[.\s]/m,
  /^##\s+8[.\s]/m,
  /^##\s+확인이\s+필요한\s+항목/m,
];

/** 텍스트에서 ## 헤더로 시작하는 섹션들을 분리 */
function splitSections(text: string): { key: number; header: string; body: string }[] {
  const sections: { key: number; header: string; body: string }[] = [];
  // 모든 ## 헤더 위치를 찾음
  const headerRegex = /^(##\s+.+)$/gm;
  const matches: { index: number; line: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = headerRegex.exec(text)) !== null) {
    matches.push({ index: m.index, line: m[1] });
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const body = text.slice(start, end).trim();
    const header = matches[i].line;

    // 어떤 섹션 순서에 해당하는지 찾기
    let key = -1;
    for (let k = 0; k < SECTION_ORDER.length; k++) {
      if (SECTION_ORDER[k].test(header)) {
        key = k;
        break;
      }
    }
    sections.push({ key, header, body });
  }

  // ## 헤더 이전의 프리앰블 (제목 등)
  if (matches.length > 0 && matches[0].index > 0) {
    const preamble = text.slice(0, matches[0].index).trim();
    if (preamble) {
      sections.unshift({ key: -1, header: "", body: preamble });
    }
  } else if (matches.length === 0 && text.trim()) {
    // 헤더가 없는 텍스트 (프리앰블만)
    sections.push({ key: -1, header: "", body: text.trim() });
  }

  return sections;
}

/** 섹션 body에서 헤더를 제외한 실질 내용이 있는지 판단 */
function hasSectionContent(body: string): boolean {
  const lines = body.split("\n");
  // 첫 줄(## 헤더)과 빈 줄, 태그 한 줄만 있으면 "내용 없음"
  const contentLines = lines.filter((line) => {
    const t = line.trim();
    if (!t) return false;
    if (/^##\s+/.test(t)) return false;
    // "> 📝 초안", "> ⚠️ 확인 필요" 등 태그만 있는 줄
    if (/^>\s*.{0,4}(?:초안|확인 필요|권장)/.test(t)) return false;
    return true;
  });
  return contentLines.length > 0;
}

/**
 * ## 섹션 내부의 ### 하위 섹션을 merge
 * incoming에 있는 ### 는 교체, incoming에 없는 ### 는 기존에서 유지
 */
function mergeSubSections(existingBody: string, incomingBody: string): string {
  // ### 헤더가 없으면 단순 교체
  if (!/^###\s+/m.test(existingBody) || !/^###\s+/m.test(incomingBody)) {
    return incomingBody;
  }

  // ### 헤더로 분리
  const splitBySub = (text: string) => {
    const parts: { header: string; content: string }[] = [];
    const regex = /^(###\s+.+)$/gm;
    const matches: { index: number; line: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      matches.push({ index: m.index, line: m[1] });
    }

    // ## 헤더 ~ 첫 ### 사이 (프리앰블)
    if (matches.length > 0 && matches[0].index > 0) {
      const pre = text.slice(0, matches[0].index).trim();
      if (pre) parts.push({ header: "", content: pre });
    } else if (matches.length === 0) {
      return [{ header: "", content: text.trim() }];
    }

    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index;
      const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
      parts.push({ header: matches[i].line, content: text.slice(start, end).trim() });
    }
    return parts;
  };

  const existingSubs = splitBySub(existingBody);
  const incomingSubs = splitBySub(incomingBody);

  // 기존 ### 를 Map으로 인덱싱
  const existingMap = new Map<string, string>();
  for (const s of existingSubs) {
    if (s.header) existingMap.set(s.header, s.content);
  }

  // incoming ### 로 교체
  const incomingHeaders = new Set<string>();
  for (const s of incomingSubs) {
    if (s.header) {
      existingMap.set(s.header, s.content);
      incomingHeaders.add(s.header);
    }
  }

  // 결과 조립: incoming의 프리앰블(## 헤더) + incoming ### + 기존에만 있는 ###
  const incomingPreamble = incomingSubs.find((s) => !s.header)?.content || "";
  const result: string[] = [];
  if (incomingPreamble) result.push(incomingPreamble);

  // incoming에 있는 ### 먼저 (incoming 순서 유지)
  for (const s of incomingSubs) {
    if (s.header) result.push(existingMap.get(s.header)!);
  }

  // 기존에만 있는 ### 추가 (incoming에 없는 것)
  for (const s of existingSubs) {
    if (s.header && !incomingHeaders.has(s.header)) {
      result.push(s.content);
    }
  }

  return result.join("\n\n");
}

/**
 * 기존 Spec에 새 응답을 섹션 단위로 merge
 * - 새 응답의 각 섹션을 기존에서 찾아 교체, 없으면 올바른 위치에 삽입
 * - 새 응답에 없는 섹션은 그대로 유지
 * - 빈/거의 빈 incoming 섹션은 기존 내용을 덮어쓰지 않음
 */
export function mergeSpec(existing: string, incoming: string): string {
  if (!existing.trim()) return incoming;
  if (!incoming.trim()) return existing;

  const existingSections = splitSections(existing);
  const incomingSections = splitSections(incoming);

  // 기존 섹션을 key로 인덱싱
  const sectionMap = new Map<number, { idx: number; body: string }>();
  existingSections.forEach((s, idx) => {
    if (s.key >= 0) sectionMap.set(s.key, { idx, body: s.body });
  });

  // 새 섹션 처리
  for (const inc of incomingSections) {
    if (inc.key >= 0) {
      // key가 있는 섹션: 교체 또는 삽입
      const existing = sectionMap.get(inc.key);
      if (existing) {
        // 기존에 내용이 있는데 incoming이 빈/거의 빈 섹션이면 → 기존 유지 (덮어쓰기 방지)
        if (hasSectionContent(existing.body) && !hasSectionContent(inc.body)) {
          continue;
        }
        // ### 하위 섹션 단위 merge: incoming에 없는 ### 하위 섹션은 기존에서 유지
        const mergedBody = mergeSubSections(existing.body, inc.body);
        existingSections[existing.idx] = { ...inc, body: mergedBody };
      } else {
        // 삽입: 올바른 위치 찾기
        let insertIdx = existingSections.length;
        for (let i = 0; i < existingSections.length; i++) {
          if (existingSections[i].key > inc.key) {
            insertIdx = i;
            break;
          }
        }
        existingSections.splice(insertIdx, 0, inc);
      }
      sectionMap.set(inc.key, { idx: 0, body: inc.body }); // idx는 이후 안 씀
    }
    // key === -1 (프리앰블/대화형 텍스트): incoming에서는 무시
    // 기존 프리앰블(# 제목 등)은 그대로 유지
  }

  return existingSections.map((s) => s.body).join("\n\n");
}

/**
 * 텍스트에 Spec 섹션 헤더가 포함되어 있는지 판별
 * 하나라도 매칭되면 Spec 본문으로 취급
 */
export function containsSpecSection(text: string): boolean {
  return SECTION_ORDER.some((pattern) => pattern.test(text))
    || /^#\s+Product\s+Spec/im.test(text);
}

/**
 * 이전 Spec과 새 Spec을 비교하여 변경 요약을 생성
 * 예: "1. 문제 정의, 4. 시나리오 수정 / 8. 메트릭 추가"
 */
export function generateChangeSummary(prevSpec: string, newSpec: string): string {
  if (!prevSpec.trim()) return "초기 생성";

  const prevSections = splitSections(prevSpec);
  const newSections = splitSections(newSpec);

  const prevMap = new Map<number, string>();
  for (const s of prevSections) {
    if (s.key >= 0) prevMap.set(s.key, s.body);
  }

  const modified: string[] = [];
  const added: string[] = [];

  for (const s of newSections) {
    if (s.key < 0) continue;
    const sectionName = s.header.replace(/^##\s+/, "").trim();
    const prev = prevMap.get(s.key);
    if (prev === undefined) {
      added.push(sectionName);
    } else if (prev !== s.body) {
      modified.push(sectionName);
    }
  }

  const parts: string[] = [];
  if (modified.length > 0) parts.push(modified.join(", ") + " 수정");
  if (added.length > 0) parts.push(added.join(", ") + " 추가");

  return parts.join(" / ") || "변경 없음";
}

export interface ParsedResponse {
  spec: string | null;
  html: string | null;
  chatText: string;
}

/**
 * 텍스트를 ## 헤딩 블록(Spec)과 나머지(대화)로 분리
 */
function splitSpecAndChat(text: string): { specPart: string; chatPart: string } {
  if (!text.trim()) return { specPart: "", chatPart: "" };

  const lines = text.split("\n");
  const specLines: string[] = [];
  const chatLines: string[] = [];
  let inSpecBlock = false;
  let inCodeBlock = false;

  for (const line of lines) {
    // 코드 블록 (```) 상태 추적
    if (/^```/.test(line.trim())) {
      inCodeBlock = !inCodeBlock;
    }

    // 코드 블록 안에서는 무조건 Spec 유지 (mermaid 등)
    if (inCodeBlock && inSpecBlock) {
      specLines.push(line);
      continue;
    }

    // ## 헤더 또는 # Product Spec 제목 → Spec 블록 진입
    if (/^##\s+/.test(line) || /^#\s+Product\s+Spec/i.test(line)) {
      inSpecBlock = true;
    }
    // Spec 블록 중 빈 줄 → 일단 Spec에 넣고 다음 줄에서 판단
    else if (inSpecBlock && line.trim() === "") {
      specLines.push(line);
      continue;
    } else if (inSpecBlock && line.trim() !== "") {
      // Spec 블록 내부로 유지하는 패턴들
      const isSpecContent =
        /^###?\s+/.test(line) ||      // ### 서브헤딩
        /^\|/.test(line.trim()) ||     // 테이블
        /^[-*]\s/.test(line.trim()) || // 리스트
        /^>\s/.test(line.trim()) ||    // 인용
        /^```/.test(line.trim()) ||    // 코드블록 시작/종료
        /^\d+\.\s/.test(line.trim()) || // 번호 리스트
        /^\*\*[^*]+\*\*/.test(line.trim()) || // **bold 라벨**
        /^☐|^✅|^❌|^⚠️|^📝|^💡/.test(line.trim()); // 태그/아이콘

      if (!isSpecContent) {
        if (/^---\s*$/.test(line.trim())) {
          inSpecBlock = false;
          continue;
        }
        inSpecBlock = false;
      }
    }

    if (inSpecBlock) {
      specLines.push(line);
    } else {
      chatLines.push(line);
    }
  }

  return {
    specPart: specLines.join("\n").trim(),
    chatPart: chatLines.join("\n").trim(),
  };
}

/**
 * AI 응답을 Spec, HTML, 대화 텍스트로 파싱
 * - spec: ## 헤딩 블록들만 (Spec 패널용)
 * - html: HTML 블록 (Prototype 패널용)
 * - chatText: 나머지 대화형 텍스트 (채팅 표시용)
 */
export function parseResponse(text: string): ParsedResponse {
  const html = extractHtml(text);
  const normalized = normalizeSpec(text);
  const rawSpec = extractSpec(normalized);

  const { specPart, chatPart } = splitSpecAndChat(rawSpec);
  const spec = specPart && containsSpecSection(specPart) ? specPart : null;

  // chatText: 대화 부분이 있으면 사용, 없으면 원본 text (Spec만 있는 경우)
  const chatText = chatPart || (spec ? "" : rawSpec);

  return {
    spec,
    html: html || null,
    chatText,
  };
}
