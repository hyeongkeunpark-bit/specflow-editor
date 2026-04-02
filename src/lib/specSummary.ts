/**
 * Spec 마크다운에서 섹션별 1줄 요약을 생성
 * 수정 모드에서 AI에게 현재 Spec 상태를 전달할 때 사용
 */

interface SectionInfo {
  key: string;   // "메타 정보", "1", "2", ... "8", "확인"
  label: string; // 표시용
  summary: string;
}

const SECTION_PATTERNS: { key: string; label: string; regex: RegExp }[] = [
  { key: "meta", label: "\uBA54\uD0C0 \uC815\uBCF4", regex: /^##\s+\uBA54\uD0C0\s*\uC815\uBCF4/m },
  { key: "scope", label: "\uC2A4\uCF54\uD504 \uC694\uC57D", regex: /^##\s+\uC2A4\uCF54\uD504\s*\uC694\uC57D/m },
  { key: "1", label: "1\uBC88", regex: /^##\s+1[.\s]/m },
  { key: "2", label: "2\uBC88", regex: /^##\s+2[.\s]/m },
  { key: "3", label: "3\uBC88", regex: /^##\s+3[.\s]/m },
  { key: "4", label: "4\uBC88", regex: /^##\s+4[.\s]/m },
  { key: "5", label: "5\uBC88", regex: /^##\s+5[.\s]/m },
  { key: "6", label: "6\uBC88", regex: /^##\s+6[.\s]/m },
  { key: "7", label: "7\uBC88", regex: /^##\s+7[.\s]/m },
  { key: "8", label: "8\uBC88", regex: /^##\s+8[.\s]/m },
  { key: "check", label: "\uD655\uC778\uC774 \uD544\uC694\uD55C \uD56D\uBAA9", regex: /^##\s+\uD655\uC778\uC774\s+\uD544\uC694\uD55C/m },
];

/** ## 헤더 위치를 모두 찾아서 섹션 텍스트로 분리 */
function extractSectionText(spec: string, regex: RegExp): string | null {
  const match = regex.exec(spec);
  if (!match) return null;

  const start = match.index;
  // 다음 ## 헤더까지
  const nextHeader = spec.indexOf("\n## ", start + 1);
  const end = nextHeader >= 0 ? nextHeader : spec.length;
  return spec.slice(start, end).trim();
}

/** 섹션 텍스트에서 첫 의미 있는 줄(헤더 제외) 추출 */
function firstContentLine(sectionText: string): string {
  const lines = sectionText.split("\n").slice(1); // 헤더 스킵
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("---") && !trimmed.startsWith("|--")) {
      return trimmed.length > 60 ? trimmed.slice(0, 60) + "..." : trimmed;
    }
  }
  return "(\uB0B4\uC6A9 \uC788\uC74C)";
}

/** 테이블 행 수 카운트 (| 로 시작하는 줄, 헤더/구분선 제외) */
function countTableRows(text: string): number {
  const lines = text.split("\n");
  let count = 0;
  let headerPassed = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|")) {
      if (trimmed.startsWith("|--") || trimmed.startsWith("| #") || trimmed.startsWith("| ---")) {
        headerPassed = true;
        continue;
      }
      if (headerPassed) count++;
    }
  }
  return count;
}

/** 4번 섹션 요약: 시나리오 N개, 구현 규칙 N개 */
function summarizeSection4(sectionText: string): string {
  const parts: string[] = [];

  // 시나리오 테이블
  const scenarioMatch = sectionText.match(/###.*\uC2DC\uB098\uB9AC\uC624[\s\S]*?(?=###|$)/);
  if (scenarioMatch) {
    const rows = countTableRows(scenarioMatch[0]);
    if (rows > 0) parts.push(`\uC2DC\uB098\uB9AC\uC624 ${rows}\uAC1C`);
  }

  // 구현 규칙 테이블
  const ruleMatch = sectionText.match(/###.*\uAD6C\uD604\s*\uADDC\uCE59[\s\S]*?(?=###|$)/);
  if (ruleMatch) {
    const rows = countTableRows(ruleMatch[0]);
    if (rows > 0) parts.push(`\uAD6C\uD604 \uADDC\uCE59 ${rows}\uAC1C`);
  }

  return parts.length > 0 ? parts.join(", ") : firstContentLine(sectionText);
}

/** 5번 섹션 요약: Primary 지표 추출 */
function summarizeSection5(sectionText: string): string {
  // 테이블에서 첫 데이터 행 추출
  const lines = sectionText.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("| 1") || trimmed.startsWith("| 1 ")) {
      // 첫 데이터 행에서 기준 열 추출
      const cells = trimmed.split("|").map((c) => c.trim()).filter(Boolean);
      if (cells.length >= 2) return cells[1]; // 기준 열
    }
  }
  return firstContentLine(sectionText);
}

/**
 * Spec 마크다운에서 목차 요약 생성
 * 500자 이내
 */
export function generateSpecSummary(spec: string): string {
  if (!spec.trim()) return "";

  const infos: SectionInfo[] = [];

  for (const pattern of SECTION_PATTERNS) {
    const sectionText = extractSectionText(spec, pattern.regex);
    if (!sectionText) continue;

    let summary: string;
    if (pattern.key === "4") {
      summary = summarizeSection4(sectionText);
    } else if (pattern.key === "5") {
      summary = summarizeSection5(sectionText);
    } else {
      summary = firstContentLine(sectionText);
    }

    infos.push({ key: pattern.key, label: pattern.label, summary });
  }

  if (infos.length === 0) return "";

  const lines = infos.map((i) => `- ${i.label}: ${i.summary}`);
  let result = lines.join("\n");

  // 500자 제한
  if (result.length > 500) {
    result = result.slice(0, 497) + "...";
  }

  return `[\uD604\uC7AC Spec \uC0C1\uD0DC]\n${result}`;
}
