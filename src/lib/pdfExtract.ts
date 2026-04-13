/**
 * PDF 텍스트 추출 유틸리티
 * pdfjs-dist를 동적 import하여 번들 크기 최소화
 */

// Vite가 워커 파일을 static asset으로 서빙
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

let workerInitialized = false;

/** PDF 파일에서 텍스트 추출 */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");

  if (!workerInitialized) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
    workerInitialized = true;
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: any) => item.str)
      .join(" ");
    if (text.trim()) {
      pages.push(`[페이지 ${i}]\n${text.trim()}`);
    }
  }

  return pages.join("\n\n");
}

/** 파일이 PDF인지 확인 */
export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}
