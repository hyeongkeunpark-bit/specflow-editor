/**
 * AI 응답 텍스트에서 HTML과 Spec을 분리하는 파서
 */

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

/**
 * 기존 Spec에 새 응답을 섹션 단위로 merge
 * - 새 응답의 각 섹션을 기존에서 찾아 교체, 없으면 올바른 위치에 삽입
 * - 새 응답에 없는 섹션은 그대로 유지
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
        // 교체
        existingSections[existing.idx] = inc;
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
  return SECTION_ORDER.some((pattern) => pattern.test(text));
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

  for (const line of lines) {
    // ## 헤더 시작 → Spec 블록 진입
    if (/^##\s+/.test(line)) {
      inSpecBlock = true;
    }
    // Spec 블록 중 빈 줄 다음에 ## 아닌 텍스트가 오면 → 대화 블록으로 전환
    // 단, ### 이하 서브헤딩이나 테이블/리스트/코드블록은 Spec 블록 유지
    else if (inSpecBlock && line.trim() === "") {
      // 빈 줄은 일단 Spec에 넣고 다음 줄에서 판단
      specLines.push(line);
      continue;
    } else if (inSpecBlock && line.trim() !== "") {
      // Spec 블록 내부로 유지하는 패턴들
      const isSpecContent =
        /^###?\s+/.test(line) ||      // ### 서브헤딩
        /^\|/.test(line.trim()) ||     // 테이블
        /^[-*]\s/.test(line.trim()) || // 리스트
        /^>\s/.test(line.trim()) ||    // 인용
        /^```/.test(line.trim()) ||    // 코드블록
        /^\d+\.\s/.test(line.trim()); // 번호 리스트

      if (!isSpecContent) {
        // --- 구분선 뒤의 대화형 텍스트
        if (/^---\s*$/.test(line.trim())) {
          inSpecBlock = false;
          continue; // --- 자체는 버림
        }
        // Spec 블록 끝, 대화 블록으로 전환
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
  const rawSpec = extractSpec(text);

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
