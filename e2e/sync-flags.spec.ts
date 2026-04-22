import { test, expect, type Page } from "@playwright/test";
import { freshLoad } from "./helpers";

/**
 * sync flag (specNeedsSync / protoNeedsSync) 전환 로직 검증.
 *
 * /api/chat/stream을 mock해서 AI 응답 조합별 UI 반응을 확인:
 *   - HTML만    → Spec 뱃지 ON
 *   - Spec만    → Prototype 반영 버튼 ON (HTML 있을 때)
 *   - Spec+HTML → 둘 다 OFF (이번 버그의 회귀 방지)
 *   - 연쇄     : HTML만 응답으로 뱃지 켠 후, Spec+HTML 응답으로 해소
 */

type MockArgs = { spec?: string; html?: string; chat?: string };

async function mockChatStream(page: Page, opts: MockArgs) {
  await page.route("**/api/chat/stream", async (route) => {
    const parts: string[] = [];
    if (opts.chat) parts.push(opts.chat);
    if (opts.spec) parts.push(`<spec>\n${opts.spec}\n</spec>`);
    if (opts.html) parts.push(opts.html);
    const fullText = parts.join("\n\n");
    const sse =
      `data: ${JSON.stringify({ content: fullText })}\n\n` +
      `data: [DONE]\n\n`;
    await route.fulfill({
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
      body: sse,
    });
  });
}

async function sendChat(page: Page, text: string) {
  const textarea = page.locator("textarea").first();
  await textarea.fill(text);
  await textarea.press("Enter");
  // 로딩 중엔 placeholder가 "다음 메시지를 미리 작성하세요..."
  // 완료되면 "메시지를 입력하세요..."로 돌아옴
  await expect(textarea).toHaveAttribute("placeholder", /메시지를 입력/);
}

const SAMPLE_SPEC = `# Product Spec

## 1. 문제 정의
E2E 테스트용 샘플 스펙.`;

const SAMPLE_HTML = `<!DOCTYPE html><html><head><title>t</title></head><body><h1>sample</h1></body></html>`;

const SAMPLE_HTML_V2 = `<!DOCTYPE html><html><head><title>t2</title></head><body><h1>sample v2</h1></body></html>`;

const specBadge = (page: Page) =>
  page.locator('button[title="Spec"] span.bg-amber-500');

const protoSyncBtn = (page: Page) =>
  page.getByRole("button", { name: "Prototype에 반영하기" });

const specSyncBtn = (page: Page) =>
  page.getByRole("button", { name: "Spec에 반영하기" });

test.describe("Sync flags (specNeedsSync / protoNeedsSync)", () => {
  test("HTML만 응답 → Spec 뱃지 표시", async ({ page }) => {
    await freshLoad(page);
    await mockChatStream(page, { chat: "ok", html: SAMPLE_HTML });

    await sendChat(page, "프로토타입 만들어줘");

    await expect(specBadge(page)).toBeVisible();
    await expect(protoSyncBtn(page)).toBeHidden();
  });

  test("Spec+HTML 동시 응답 → Spec 뱃지 사라짐 (회귀 방지)", async ({ page }) => {
    await freshLoad(page);
    await mockChatStream(page, {
      chat: "ok",
      spec: SAMPLE_SPEC,
      html: SAMPLE_HTML,
    });

    await sendChat(page, "둘 다 만들어줘");

    await expect(specBadge(page)).toBeHidden();
    await expect(protoSyncBtn(page)).toBeHidden();
  });

  test("Spec만 응답 (Prototype 존재 세션) → Prototype 반영 버튼 표시 (대칭 픽스)", async ({ page }) => {
    await freshLoad(page);

    // 1턴: HTML+Spec 생성해서 두 콘텐츠 모두 존재하는 상태로 만듦
    await mockChatStream(page, {
      chat: "init",
      spec: SAMPLE_SPEC,
      html: SAMPLE_HTML,
    });
    await sendChat(page, "둘 다 만들어줘");
    await expect(specBadge(page)).toBeHidden();
    await expect(protoSyncBtn(page)).toBeHidden();

    // 2턴: Spec만 갱신 → Prototype이 뒤처져 버튼 떠야 함
    await page.unroute("**/api/chat/stream");
    await mockChatStream(page, {
      chat: "spec only",
      spec: SAMPLE_SPEC + "\n\n추가 섹션",
    });
    await sendChat(page, "스펙만 수정해줘");

    await expect(protoSyncBtn(page)).toBeVisible();
    await expect(specBadge(page)).toBeHidden();
  });

  test("연쇄: HTML만 → Spec+HTML → 두 플래그 모두 해소", async ({ page }) => {
    await freshLoad(page);

    // 1턴: HTML만 → spec 뱃지 ON
    await mockChatStream(page, { chat: "step1", html: SAMPLE_HTML });
    await sendChat(page, "프로토타입 만들어줘");
    await expect(specBadge(page)).toBeVisible();

    // 2턴: Spec+HTML → 뱃지 해소
    await page.unroute("**/api/chat/stream");
    await mockChatStream(page, {
      chat: "step2",
      spec: SAMPLE_SPEC,
      html: SAMPLE_HTML_V2,
    });
    await sendChat(page, "이제 spec도 같이 만들어줘");

    await expect(specBadge(page)).toBeHidden();
    await expect(protoSyncBtn(page)).toBeHidden();
    await expect(specSyncBtn(page)).toBeHidden();
  });

  test("Prototype 있는 빈 세션에 Spec 최초 생성 → Proto 버튼 안 뜸", async ({ page }) => {
    await freshLoad(page);

    // 1턴: HTML만 → Spec 뱃지 ON (Prototype만 존재, Spec 없음)
    await mockChatStream(page, { chat: "step1", html: SAMPLE_HTML });
    await sendChat(page, "프로토타입 만들어줘");
    await expect(specBadge(page)).toBeVisible();

    // 2턴: Spec만 응답 (Prototype 기반 Spec "최초 생성") → Spec 원본은 Prototype이므로
    // Proto는 뒤처지지 않음. 버튼 뜨면 안 됨.
    await page.unroute("**/api/chat/stream");
    await mockChatStream(page, { chat: "step2", spec: SAMPLE_SPEC });
    await sendChat(page, "스펙도 만들어줘");

    await expect(specBadge(page)).toBeHidden();
    await expect(protoSyncBtn(page)).toBeHidden();
  });

  test("Spec 있는 빈 세션에 Prototype 최초 생성 → Spec 뱃지 안 뜸", async ({ page }) => {
    await freshLoad(page);

    // 1턴: Spec만 → 초기 생성 (Proto는 없음)
    await mockChatStream(page, { chat: "step1", spec: SAMPLE_SPEC });
    await sendChat(page, "스펙 만들어줘");
    await expect(specBadge(page)).toBeHidden();
    await expect(protoSyncBtn(page)).toBeHidden();

    // 2턴: HTML만 응답 (Spec 기반 Prototype "최초 생성") → Prototype 원본은 Spec이므로
    // Spec은 뒤처지지 않음. 뱃지 뜨면 안 됨.
    await page.unroute("**/api/chat/stream");
    await mockChatStream(page, { chat: "step2", html: SAMPLE_HTML });
    await sendChat(page, "프로토타입도 만들어줘");

    await expect(specBadge(page)).toBeHidden();
    await expect(protoSyncBtn(page)).toBeHidden();
  });
});
