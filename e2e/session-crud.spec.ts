import { test, expect } from "@playwright/test";
import {
  clickNewSession,
  deleteSessionAtIndex,
  freshLoad,
  getActiveId,
  getSessions,
  openSessionMenu,
} from "./helpers";

test.describe("Session CRUD (AI-free)", () => {
  test.beforeEach(async ({ page }) => {
    await freshLoad(page);
  });

  test("초기 로드 — 빈 세션 1개 자동 생성 + active 설정", async ({ page }) => {
    await expect.poll(async () => (await getSessions(page)).length).toBe(1);
    const sessions = await getSessions(page);
    expect(sessions[0].title).toBe("새 세션");
    expect(sessions[0].messages).toEqual([]);
    expect(sessions[0].specContent).toBe("");
    expect(sessions[0].htmlContent).toBe("");
    expect(sessions[0].snapshots).toEqual([]);
    expect(await getActiveId(page)).toBe(sessions[0].id);
  });

  test("새 세션 생성 — 목록 +1, 새 세션이 active, 헤드에 추가", async ({ page }) => {
    const before = await getSessions(page);
    const beforeActive = await getActiveId(page);

    await clickNewSession(page);

    await expect.poll(async () => (await getSessions(page)).length).toBe(before.length + 1);
    const after = await getSessions(page);
    const afterActive = await getActiveId(page);

    expect(afterActive).not.toBe(beforeActive);
    expect(after[0].id).toBe(afterActive);
    expect(after.some((s) => s.id === beforeActive)).toBe(true);
  });

  test("현재 active 세션 삭제 — 새 빈 세션 자동 생성, 총 개수 유지", async ({ page }) => {
    const initialSessions = await getSessions(page);
    const initialActiveId = initialSessions[0].id;
    expect(initialSessions).toHaveLength(1);

    await openSessionMenu(page);
    await deleteSessionAtIndex(page, 0);

    await expect.poll(async () => await getActiveId(page)).not.toBe(initialActiveId);
    const after = await getSessions(page);
    expect(after).toHaveLength(1);
    expect(after.some((s) => s.id === initialActiveId)).toBe(false);
  });

  test("비-active 세션 삭제 — 개수 감소, active 유지", async ({ page }) => {
    await clickNewSession(page);
    await expect.poll(async () => (await getSessions(page)).length).toBe(2);

    const sessions = await getSessions(page);
    const activeId = await getActiveId(page);
    const oldId = sessions[1].id;
    expect(sessions[0].id).toBe(activeId);

    await openSessionMenu(page);
    await deleteSessionAtIndex(page, 1);

    await expect.poll(async () => (await getSessions(page)).length).toBe(1);
    expect(await getActiveId(page)).toBe(activeId);
    const after = await getSessions(page);
    expect(after.some((s) => s.id === oldId)).toBe(false);
  });
});
