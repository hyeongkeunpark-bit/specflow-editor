import { test, expect } from "@playwright/test";
import { freshLoad, getActiveSession } from "./helpers";

test.describe("Spec file upload (AI-free)", () => {
  test.beforeEach(async ({ page }) => {
    await freshLoad(page);
  });

  test("빈 Spec 상태 → md 업로드 → specContent 반영 + snapshot 생성", async ({ page }) => {
    await expect(page.getByText("Spec 불러오기")).toBeVisible();

    const specText = "# Product Spec\n\n## 1. 문제 정의\n업로드 내용";

    await page.setInputFiles('input[type="file"][accept=".md,.txt"]', {
      name: "uploaded-spec.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(specText, "utf-8"),
    });

    await expect.poll(async () => (await getActiveSession(page))?.specContent).toBe(specText);

    const session = await getActiveSession(page);
    expect(session).toBeTruthy();
    expect(session!.snapshots.length).toBeGreaterThanOrEqual(1);
    expect(session!.snapshots.some((s) => s.summary.includes("uploaded-spec.md"))).toBe(true);

    await expect(page.locator(".markdown-body")).toBeVisible();
  });

  test("기존 Spec 있는 상태 → 덮어쓰기 업로드 → 이전 상태 + 새 업로드 snapshot 2개", async ({ page }) => {
    const originalSpec = "## 1. 문제 정의\n원본";
    const originalHtml = "<p>original html</p>";
    const sessionId = "upload-overwrite-session";

    await page.evaluate(
      (args) => {
        const session = {
          id: args.sessionId,
          title: "Overwrite test",
          createdAt: Date.now(),
          messages: [],
          specContent: args.originalSpec,
          htmlContent: args.originalHtml,
          snapshots: [],
        };
        localStorage.setItem("specbot_sessions", JSON.stringify([session]));
        localStorage.setItem("specbot_active_session", args.sessionId);
      },
      { sessionId, originalSpec, originalHtml }
    );
    await page.reload();
    await page.waitForSelector('[aria-haspopup="menu"]');

    page.once("dialog", async (dialog) => {
      expect(dialog.type()).toBe("confirm");
      await dialog.accept();
    });

    const newSpec = "## 2. 사용자 시나리오\n새 내용";
    await page.setInputFiles('input[type="file"][accept=".md,.txt"]', {
      name: "new-spec.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(newSpec, "utf-8"),
    });

    await expect.poll(async () => (await getActiveSession(page))?.specContent).toBe(newSpec);

    const session = await getActiveSession(page);
    expect(session!.snapshots).toHaveLength(2);
    const summaries = session!.snapshots.map((s) => s.summary);
    expect(summaries).toContain("Spec 업로드 직전 상태");
    expect(summaries.some((s) => s.includes("new-spec.md"))).toBe(true);

    const prevSnapshot = session!.snapshots.find((s) => s.summary === "Spec 업로드 직전 상태");
    expect(prevSnapshot?.spec).toBe(originalSpec);
    expect(prevSnapshot?.html).toBe(originalHtml);
  });

  test("1MB 초과 파일 — 거부되어 specContent 변하지 않음", async ({ page }) => {
    const initial = await getActiveSession(page);
    const initialSpec = initial!.specContent;

    const bigBuffer = Buffer.alloc(1024 * 1024 + 10, "a");
    await page.setInputFiles('input[type="file"][accept=".md,.txt"]', {
      name: "too-big.md",
      mimeType: "text/markdown",
      buffer: bigBuffer,
    });

    await page.waitForTimeout(500);
    const after = await getActiveSession(page);
    expect(after!.specContent).toBe(initialSpec);
  });
});
