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
 */
export function extractSpec(text: string): string {
  let spec = text.replace(/```html\s*\n[\s\S]*?```/g, "");
  spec = spec.replace(/<!DOCTYPE html[\s\S]*?<\/html>/gi, "");
  return spec.trim();
}

export interface ParsedResponse {
  spec: string | null;
  html: string | null;
}

/**
 * AI 응답을 Spec과 HTML로 파싱
 * - HTML만 있으면 spec = null (이전 Spec 유지)
 * - Spec만 있으면 html = null (이전 Prototype 유지)
 */
export function parseResponse(text: string): ParsedResponse {
  const html = extractHtml(text);
  const spec = extractSpec(text);

  return {
    spec: spec || null,
    html: html || null,
  };
}
