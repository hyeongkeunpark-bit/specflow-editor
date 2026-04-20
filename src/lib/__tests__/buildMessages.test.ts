import { describe, it, expect } from "vitest";
import { buildMessages } from "../api";
import type { ChatMessage } from "../types";

const emptyHistory: ChatMessage[] = [];

interface TextBlock { type: "text"; text: string }
interface ImageBlock { type: "image"; source: { type: "base64"; media_type: string; data: string } }
type Block = TextBlock | ImageBlock;

function asBlocks(content: unknown): Block[] {
  if (!Array.isArray(content)) throw new Error("expected array content");
  return content as Block[];
}
function asText(block: Block): TextBlock {
  if (block.type !== "text") throw new Error("expected text block");
  return block;
}

describe("buildMessages — 일반 모드 state 주입", () => {
  it("첫 턴 (Spec/HTML 없음): string content로 단순화", () => {
    const msgs = buildMessages(emptyHistory, "새 프로토타입 만들어줘", {});
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe("user");
    expect(msgs[0].content).toBe("새 프로토타입 만들어줘");
  });

  it("Spec + HTML 있음: 단일 string에 둘 다 prepend + [요청] 포맷", () => {
    const msgs = buildMessages(emptyHistory, "버튼 색 바꿔줘", {
      specContent: "## 기능\n- 버튼 클릭",
      htmlContent: "<html><body><button>X</button></body></html>",
    });
    expect(msgs).toHaveLength(1);
    expect(typeof msgs[0].content).toBe("string");
    const text = msgs[0].content as string;
    expect(text).toContain("[현재 Spec 전문]");
    expect(text).toContain("## 기능");
    expect(text).toContain("[현재 Prototype HTML]");
    expect(text).toContain("<button>X</button>");
    expect(text).toContain("[요청]\n버튼 색 바꿔줘");
    // Spec이 HTML보다 앞
    expect(text.indexOf("[현재 Spec 전문]")).toBeLessThan(text.indexOf("[현재 Prototype HTML]"));
    expect(text.indexOf("[현재 Prototype HTML]")).toBeLessThan(text.indexOf("[요청]"));
  });

  it("HTML만 있음 (Spec 없음)", () => {
    const msgs = buildMessages(emptyHistory, "수정해줘", {
      htmlContent: "<html></html>",
    });
    const text = msgs[0].content as string;
    expect(text).toContain("[현재 Prototype HTML]");
    expect(text).not.toContain("[현재 Spec 전문]");
    expect(text).toContain("[요청]\n수정해줘");
  });

  it("Spec만 있음 (HTML 없음)", () => {
    const msgs = buildMessages(emptyHistory, "뭐가 있어?", {
      specContent: "# Spec\n- 로그인",
    });
    const text = msgs[0].content as string;
    expect(text).toContain("[현재 Spec 전문]");
    expect(text).not.toContain("[현재 Prototype HTML]");
    expect(text).toContain("[요청]\n뭐가 있어?");
  });

  it("이미지 + Spec + HTML: block 배열로 구성, 마지막 text에 state + 요청 포함", () => {
    const msgs = buildMessages(emptyHistory, "이대로 바꿔", {
      specContent: "spec content",
      htmlContent: "html content",
      images: [{ base64: "AAAA", mediaType: "image/png" }],
    });
    const blocks = asBlocks(msgs[0].content);
    // 이미지 라벨 + 이미지 + 통합 텍스트 = 3개
    expect(blocks).toHaveLength(3);
    expect(asText(blocks[0]).text).toBe("[첨부 이미지 1]");
    expect(blocks[1].type).toBe("image");
    const finalText = asText(blocks[2]).text;
    expect(finalText).toContain("[현재 Spec 전문]");
    expect(finalText).toContain("spec content");
    expect(finalText).toContain("[현재 Prototype HTML]");
    expect(finalText).toContain("html content");
    expect(finalText).toContain("[요청]\n이대로 바꿔");
  });

  it("이미지 첨부 + state 없음: block 배열, 요청 prefix 없이 원본 텍스트", () => {
    const msgs = buildMessages(emptyHistory, "이 이미지 봐줘", {
      images: [{ base64: "AAAA", mediaType: "image/jpeg" }],
    });
    const blocks = asBlocks(msgs[0].content);
    expect(blocks).toHaveLength(3);
    expect(asText(blocks[0]).text).toBe("[첨부 이미지 1]");
    expect(blocks[1].type).toBe("image");
    expect(asText(blocks[2]).text).toBe("이 이미지 봐줘");
  });

  it("base64 data URI prefix 제거", () => {
    const msgs = buildMessages(emptyHistory, "test", {
      images: [{ base64: "data:image/png;base64,AAAA", mediaType: "image/png" }],
    });
    const blocks = asBlocks(msgs[0].content);
    const imgBlock = blocks.find((b) => b.type === "image");
    expect(imgBlock).toBeDefined();
    if (imgBlock && imgBlock.type === "image") {
      expect(imgBlock.source.data).toBe("AAAA");
    }
  });
});

describe("buildMessages — 히스토리 스트립 (누적 방지)", () => {
  it("이전 user 메시지에서 [요청]\\n 이전 제거", () => {
    const history: ChatMessage[] = [
      {
        id: "1",
        role: "user",
        content: "[현재 Prototype HTML]\n<old>OLD</old>\n\n[요청]\n버튼 만들어줘",
      },
      { id: "2", role: "ai", content: "만들었습니다." },
    ];
    const msgs = buildMessages(history, "색 바꿔", {
      htmlContent: "<new>NEW</new>",
    });
    const userHistoryMsg = msgs[0];
    expect(userHistoryMsg.content).toBe("버튼 만들어줘");
    expect(userHistoryMsg.content).not.toContain("OLD");
  });

  it("이전 AI 응답에서 <spec>, <prototype_delta>, HTML 코드블록 제거", () => {
    const history: ChatMessage[] = [
      { id: "1", role: "user", content: "만들어줘" },
      {
        id: "2",
        role: "ai",
        content:
          "생성했습니다.\n<spec>\nSPEC-CONTENT\n</spec>\n<prototype_delta><search>A</search><replace>B</replace></prototype_delta>\n```html\n<html>X</html>\n```",
      },
    ];
    const msgs = buildMessages(history, "수정", {});
    const aiHistoryMsg = msgs[1];
    expect(aiHistoryMsg.role).toBe("assistant");
    expect(aiHistoryMsg.content).toBe("생성했습니다.");
    expect(aiHistoryMsg.content).not.toContain("SPEC-CONTENT");
    expect(aiHistoryMsg.content).not.toContain("prototype_delta");
  });

  it("빈 메시지는 스킵", () => {
    const history: ChatMessage[] = [
      { id: "1", role: "ai", content: "<spec>Only spec</spec>" },
      { id: "2", role: "user", content: "다음 요청" },
    ];
    const msgs = buildMessages(history, "이번 요청", {});
    expect(msgs.filter((m) => m.role === "assistant")).toHaveLength(0);
  });
});

describe("buildMessages — specUpdateMode/protoUpdateMode 미변경 (회귀)", () => {
  it("specUpdateMode는 단일 string content", () => {
    const msgs = buildMessages(emptyHistory, "", {
      specUpdateMode: {
        specContent: "spec",
        htmlContent: "html",
        changeLog: ["변경1"],
      },
    });
    expect(msgs).toHaveLength(1);
    expect(typeof msgs[0].content).toBe("string");
    expect(msgs[0].content).toContain("[Spec 문서 업데이트 요청]");
    expect(msgs[0].content).toContain("[Prototype 변경 이력]");
  });

  it("protoUpdateMode는 단일 string content", () => {
    const msgs = buildMessages(emptyHistory, "", {
      protoUpdateMode: {
        specContent: "spec",
        htmlContent: "html",
      },
    });
    expect(msgs).toHaveLength(1);
    expect(typeof msgs[0].content).toBe("string");
    expect(msgs[0].content).toContain("[Prototype 업데이트 요청]");
  });

  it("specUpdateMode에서는 대화 이력 미포함", () => {
    const history: ChatMessage[] = [
      { id: "1", role: "user", content: "과거 메시지" },
      { id: "2", role: "ai", content: "과거 응답" },
    ];
    const msgs = buildMessages(history, "", {
      specUpdateMode: { specContent: "s", htmlContent: "h", changeLog: [] },
    });
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe("user");
  });
});

describe("buildMessages — 긴 메시지 잘라내기 (회귀)", () => {
  it("3000자 초과 user 이력 메시지는 1500자 + 생략 표시", () => {
    const longText = "x".repeat(4000);
    const history: ChatMessage[] = [{ id: "1", role: "user", content: longText }];
    const msgs = buildMessages(history, "next", {});
    const historyMsg = msgs[0];
    expect((historyMsg.content as string).length).toBeLessThan(longText.length);
    expect(historyMsg.content as string).toContain("(이하 생략)");
  });
});
