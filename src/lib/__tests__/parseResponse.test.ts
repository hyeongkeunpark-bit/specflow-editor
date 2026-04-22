import { describe, it, expect } from "vitest";
import { parseResponse } from "../parser";

describe("parseResponse — <spec> 태그 추출", () => {
  it("단일 <spec> 태그: 내용 추출", () => {
    const input = `설명 문구.\n\n<spec>\n## 3. 해결책\n- 내용\n</spec>\n\n추가 설명.`;
    const r = parseResponse(input);
    expect(r.spec).toContain("## 3. 해결책");
    expect(r.spec).toContain("- 내용");
  });

  it("다중 <spec> 태그: 모든 섹션 추출 후 이어붙임 (회귀 방지)", () => {
    // 2026-04-22 실제 재현: AI가 4개의 <spec> 블록을 출력했을 때
    // 이전 버그: 첫 번째만 추출 → 섹션 4, 5, 확인이 필요한 항목 silent loss
    const input = `변경 이력을 분석합니다.

<spec>
## 3. 해결책
- section 3 update
</spec>

---

<spec>
## 4. 시나리오
- section 4 update
</spec>

<spec>
## 5. 성공 기준
- section 5 update
</spec>

<spec>
## 확인이 필요한 항목
- confirm update
</spec>

최종 안내.`;
    const r = parseResponse(input);
    expect(r.spec).toBeTruthy();
    expect(r.spec).toContain("## 3. 해결책");
    expect(r.spec).toContain("## 4. 시나리오");
    expect(r.spec).toContain("## 5. 성공 기준");
    expect(r.spec).toContain("## 확인이 필요한 항목");
    expect(r.spec).toContain("section 3 update");
    expect(r.spec).toContain("section 4 update");
    expect(r.spec).toContain("section 5 update");
    expect(r.spec).toContain("confirm update");
  });

  it("<spec> 태그 없음: null 반환 (폴백은 별도)", () => {
    const input = `그냥 대화 문구입니다.`;
    const r = parseResponse(input);
    expect(r.spec).toBeNull();
  });

  it("빈 <spec> 태그는 무시", () => {
    const input = `<spec></spec>\n\n<spec>\n## 3. 해결책\n내용\n</spec>`;
    const r = parseResponse(input);
    expect(r.spec).toContain("## 3. 해결책");
    expect(r.spec).toContain("내용");
  });

  it("chatText: <spec> 태그만 제거 (내용은 유지)", () => {
    const input = `설명 앞.\n\n<spec>\n## 3\n내용\n</spec>\n\n설명 뒤.`;
    const r = parseResponse(input);
    expect(r.chatText).toContain("설명 앞");
    expect(r.chatText).toContain("설명 뒤");
    // <spec> 태그 자체는 제거 (내용은 스트리밍 시 사용자에게 보여주기 위해 남김)
    expect(r.chatText).not.toContain("<spec>");
    expect(r.chatText).not.toContain("</spec>");
  });
});
