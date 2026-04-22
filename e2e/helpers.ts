import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export type E2ESession = {
  id: string;
  title: string;
  createdAt: number;
  messages: unknown[];
  specContent: string;
  htmlContent: string;
  snapshots: Array<{ summary: string; timestamp: number; spec: string; html: string; userMessage: string }>;
  shareUrl?: string;
};

export async function getSessions(page: Page): Promise<E2ESession[]> {
  return await page.evaluate(() => {
    const raw = localStorage.getItem("specbot_sessions");
    return raw ? JSON.parse(raw) : [];
  });
}

export async function getActiveId(page: Page): Promise<string | null> {
  return await page.evaluate(() => localStorage.getItem("specbot_active_session"));
}

export async function getActiveSession(page: Page): Promise<E2ESession | undefined> {
  const sessions = await getSessions(page);
  const activeId = await getActiveId(page);
  return sessions.find((s) => s.id === activeId) ?? sessions[0];
}

export async function freshLoad(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('[aria-haspopup="menu"]');
}

export async function openSessionMenu(page: Page) {
  const trigger = page.locator('[aria-haspopup="menu"]').first();
  await trigger.click();
  await expect(page.getByRole("menu")).toBeVisible();
}

export async function closeSessionMenu(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
}

export async function clickNewSession(page: Page) {
  await openSessionMenu(page);
  await page.getByRole("menuitem").last().click();
  await expect(page.getByRole("menu")).toBeHidden();
}

/** 메뉴 열려 있는 상태에서 index번째 세션의 trash 버튼 클릭 후 AlertDialog의 "삭제" 클릭. */
export async function deleteSessionAtIndex(page: Page, index: number) {
  await page.locator('[role="menuitem"] button').nth(index).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "삭제" }).click();
  await expect(dialog).toBeHidden();
}
