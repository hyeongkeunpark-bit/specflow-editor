/**
 * Minified HTML을 기본 포맷팅하여 AI가 search 텍스트를 정확히 재현할 수 있게 함.
 * - 결정론적: 같은 입력 → 같은 출력 (idempotent)
 * - 브라우저 렌더링 결과는 동일
 * - delta 매칭 시 prettified 버전으로 비교
 */

/** HTML을 기본 포맷팅 (줄바꿈 + 들여쓰기) */
export function prettifyHtml(html: string): string {
  // 이미 포맷팅되어 있으면 그대로 반환 (줄 수 기준 판단)
  const lineCount = html.split("\n").length;
  if (lineCount > 10) return html;

  let result = html;

  // 1. <style> 블록 포맷팅
  result = result.replace(/<style>([\s\S]*?)<\/style>/gi, (_match, css: string) => {
    const formatted = formatCss(css.trim());
    return `<style>\n${formatted}\n</style>`;
  });

  // 2. <script> 블록 포맷팅
  result = result.replace(/<script>([\s\S]*?)<\/script>/gi, (_match, js: string) => {
    const formatted = formatJs(js.trim());
    return `<script>\n${formatted}\n</script>`;
  });

  // 3. HTML 태그 사이 줄바꿈 (> 뒤에 < 가 오면)
  result = result.replace(/>\s*</g, ">\n<");

  // 4. 기본 들여쓰기 적용
  result = indentHtml(result);

  return result;
}

/** CSS 기본 포맷팅: 각 규칙을 줄바꿈 */
function formatCss(css: string): string {
  let result = css;
  // } 뒤에 줄바꿈
  result = result.replace(/}\s*/g, "}\n");
  // { 앞에 공백, 뒤에 줄바꿈
  result = result.replace(/\s*\{\s*/g, " {\n  ");
  // ; 뒤에 줄바꿈 + 들여쓰기 (} 앞이 아닌 경우)
  result = result.replace(/;\s*(?!})/g, ";\n  ");
  // } 앞의 불필요한 공백 정리
  result = result.replace(/\s*}/g, "\n}");
  // 빈 줄 제거
  result = result.replace(/\n{3,}/g, "\n\n");
  return result.trim();
}

/** JS 기본 포맷팅: 세미콜론/중괄호 기준 줄바꿈 */
function formatJs(js: string): string {
  let result = js;
  // 이미 여러 줄이면 그대로
  if (js.split("\n").length > 5) return js;

  // ; 뒤에 줄바꿈 (문자열 안이 아닌 경우 — 간단한 휴리스틱)
  result = result.replace(/;(?=\s*[a-zA-Z\d_$}()[\]'"`])/g, ";\n");
  // { 뒤에 줄바꿈
  result = result.replace(/\{\s*/g, "{\n");
  // } 뒤에 줄바꿈
  result = result.replace(/}\s*/g, "}\n");
  // 빈 줄 제거
  result = result.replace(/\n{3,}/g, "\n\n");
  return result.trim();
}

/** 기본 HTML 들여쓰기 */
function indentHtml(html: string): string {
  const lines = html.split("\n");
  const result: string[] = [];
  let indent = 0;

  // 들여쓰기를 줄이는 태그
  const DEDENT = /^<\/(html|head|body|div|section|main|header|footer|nav|form|ul|ol|table|thead|tbody|tr|style|script)\b/i;
  // 들여쓰기를 늘리는 태그
  const INDENT = /^<(html|head|body|div|section|main|header|footer|nav|form|ul|ol|table|thead|tbody|tr|style|script)\b[^/]*>$/i;
  // self-closing이나 void 태그는 무시
  const VOID = /^<(meta|link|br|hr|img|input)\b/i;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (DEDENT.test(line)) {
      indent = Math.max(0, indent - 1);
    }

    result.push("  ".repeat(indent) + line);

    if (INDENT.test(line) && !line.endsWith("/>")) {
      indent++;
    }
    // void/self-closing은 indent 변경 없음
  }

  return result.join("\n");
}
