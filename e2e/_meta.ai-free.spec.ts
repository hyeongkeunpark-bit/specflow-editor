import { test, expect } from "@playwright/test";
import { clickNewSession, deleteSessionAtIndex, freshLoad, getActiveSession, openSessionMenu } from "./helpers";

/**
 * Phase 1 시나리오가 실제로 AI-free인지 검증 (C3).
 * /api/chat, /api/chat/stream, /api/chat/fix-errors, /api/morph/apply, /api/share 호출 0회여야 함.
 * /api/health는 dev 서버 레디니스 용이라 허용.
 */
test.describe("Meta: Phase 1 AI-free 검증", () => {
  test("세션 CRUD + 파일 업로드 — AI 엔드포인트 호출 0회", async ({ page }) => {
    const forbidden = ["/api/chat", "/api/chat/stream", "/api/chat/fix-errors", "/api/morph/apply", "/api/share"];
    const captured: string[] = [];

    page.on("request", (req) => {
      const url = req.url();
      for (const path of forbidden) {
        if (url.includes(path)) {
          captured.push(`${req.method()} ${url}`);
        }
      }
    });

    await freshLoad(page);

    // session-crud 유사 플로우
    await clickNewSession(page);
    await openSessionMenu(page);
    await deleteSessionAtIndex(page, 1);

    // file-upload 플로우
    await page.setInputFiles('input[type="file"][accept=".md,.txt"]', {
      name: "meta-test.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Product Spec\n\n## 1. 문제 정의\n내용", "utf-8"),
    });
    await expect.poll(async () => (await getActiveSession(page))?.specContent).toContain("## 1. 문제 정의");

    expect(captured, `금지된 AI 엔드포인트 호출 감지:\n${captured.join("\n")}`).toEqual([]);
  });
});
