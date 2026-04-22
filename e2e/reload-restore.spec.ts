import { test, expect } from "@playwright/test";
import { clickNewSession, freshLoad, getActiveId, getSessions } from "./helpers";

test.describe("Reload restore (AI-free)", () => {
  test.beforeEach(async ({ page }) => {
    await freshLoad(page);
  });

  test("세션 2개 생성 → 새로고침 → 세션 목록 + active 보존", async ({ page }) => {
    await clickNewSession(page);
    await expect.poll(async () => (await getSessions(page)).length).toBe(2);

    const beforeSessions = await getSessions(page);
    const beforeActive = await getActiveId(page);

    await page.reload();
    await page.waitForSelector('[aria-haspopup="menu"]');

    expect(await getActiveId(page)).toBe(beforeActive);
    const afterSessions = await getSessions(page);
    expect(afterSessions).toHaveLength(beforeSessions.length);
    expect(afterSessions.map((s) => s.id).sort()).toEqual(beforeSessions.map((s) => s.id).sort());
  });

  test("localStorage 주입 → 새로고침 → spec/html/snapshots 라운드트립", async ({ page }) => {
    const injectedId = "test-session-round-trip";
    const specText = "# Injected Spec\n\n## Screen: Test\n내용";
    const htmlText = "<html><body>injected</body></html>";
    const snapshot = {
      spec: "## Screen: old\n이전",
      html: "<p>old</p>",
      timestamp: Date.now() - 60_000,
      summary: "이전 스냅샷",
      userMessage: "",
    };

    await page.evaluate(
      (args) => {
        const session = {
          id: args.injectedId,
          title: "Round trip",
          createdAt: Date.now(),
          messages: [],
          specContent: args.specText,
          htmlContent: args.htmlText,
          snapshots: [args.snapshot],
        };
        localStorage.setItem("specbot_sessions", JSON.stringify([session]));
        localStorage.setItem("specbot_active_session", args.injectedId);
      },
      { injectedId, specText, htmlText, snapshot }
    );

    await page.reload();
    await page.waitForSelector('[aria-haspopup="menu"]');

    const after = await getSessions(page);
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe(injectedId);
    expect(after[0].specContent).toBe(specText);
    expect(after[0].htmlContent).toBe(htmlText);
    expect(after[0].snapshots).toHaveLength(1);
    expect(after[0].snapshots[0].summary).toBe("이전 스냅샷");
    expect(await getActiveId(page)).toBe(injectedId);
  });

  test("active id가 존재하지 않는 세션 가리킬 때 — 앱이 첫 세션으로 폴백, 깨지지 않음", async ({ page }) => {
    const sessions = await getSessions(page);
    expect(sessions).toHaveLength(1);
    const realId = sessions[0].id;

    await page.evaluate(() => localStorage.setItem("specbot_active_session", "nonexistent-id-xyz"));
    await page.reload();
    await page.waitForSelector('[aria-haspopup="menu"]');

    const afterSessions = await getSessions(page);
    expect(afterSessions).toHaveLength(1);
    expect(afterSessions[0].id).toBe(realId);
    await expect(page.locator('[aria-haspopup="menu"]').first()).toBeVisible();
  });
});
