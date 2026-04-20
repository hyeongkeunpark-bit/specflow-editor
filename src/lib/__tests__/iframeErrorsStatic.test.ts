import { describe, it, expect, beforeEach } from "vitest";
import { injectErrorCapture } from "../iframeErrors";

/**
 * iframe에 주입되는 정적 검증 스크립트의 regex 로직을 Node에서 직접 재현해 검증.
 * 실제 iframe 대신 로직만 추출한 함수로 테스트.
 *
 * 목적: member access(`obj.method()`) false positive 제거 검증
 */

// ERROR_CAPTURE_SCRIPT 내부의 정적 검증 로직과 동일한 규칙
// 변경 후 로직: name 앞 char가 '.' 이면 skip (member access)
function staticCheckInlineHandler(code: string, definedGlobals: Set<string>): string[] {
  const SKIPLIST = new Set([
    "if", "for", "while", "switch", "return", "typeof", "new", "delete", "void", "throw",
    "catch", "function", "alert", "confirm", "prompt", "console",
    "setTimeout", "setInterval", "clearTimeout", "clearInterval",
    "parseInt", "parseFloat", "isNaN", "Math", "Date", "JSON",
    "Object", "Array", "String", "Number", "Boolean", "RegExp", "Error", "Map", "Set", "Promise",
    "event", "this", "true", "false", "null", "undefined",
  ]);

  const undefined_names: string[] = [];
  const re = /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(code)) !== null) {
    const name = mm[1];
    // member access: foo() 앞에 . 이 있으면 skip
    if (mm.index > 0 && code.charAt(mm.index - 1) === ".") continue;
    if (SKIPLIST.has(name)) continue;
    if (!definedGlobals.has(name)) {
      undefined_names.push(name);
    }
  }
  return undefined_names;
}

describe("iframeErrors 정적 검증 regex — member access skip", () => {
  const emptyGlobals = new Set<string>();

  it("bare 호출 (foo()) — 감지됨", () => {
    expect(staticCheckInlineHandler("foo()", emptyGlobals)).toEqual(["foo"]);
  });

  it("member access (obj.foo()) — skip (false positive 방지)", () => {
    expect(staticCheckInlineHandler("obj.foo()", emptyGlobals)).toEqual([]);
  });

  it("member access 2단계 (a.b.c()) — skip", () => {
    expect(staticCheckInlineHandler("a.b.c()", emptyGlobals)).toEqual([]);
  });

  it("member access + bare 혼합 (foo(); obj.bar())", () => {
    expect(staticCheckInlineHandler("foo(); obj.bar()", emptyGlobals)).toEqual(["foo"]);
  });

  it("window.method() — skip (기존 오탐)", () => {
    expect(staticCheckInlineHandler("window.fn()", emptyGlobals)).toEqual([]);
  });

  it("counter.decrement() — skip (이번 버그 재현 케이스)", () => {
    expect(staticCheckInlineHandler("counter.decrement()", emptyGlobals)).toEqual([]);
  });

  it("중첩 호출 (foo(bar()))", () => {
    expect(staticCheckInlineHandler("foo(bar())", emptyGlobals)).toEqual(["foo", "bar"]);
  });

  it("skiplist의 이름은 무조건 skip (alert, setTimeout 등)", () => {
    expect(staticCheckInlineHandler("alert('x')", emptyGlobals)).toEqual([]);
    expect(staticCheckInlineHandler("setTimeout(fn, 100)", emptyGlobals)).toEqual([]);
  });

  it("전역에 정의된 이름은 skip", () => {
    const globals = new Set(["increment"]);
    expect(staticCheckInlineHandler("increment()", globals)).toEqual([]);
  });

  it("빈 code — 매치 없음", () => {
    expect(staticCheckInlineHandler("", emptyGlobals)).toEqual([]);
  });

  it("공백 포함 (foo  ())", () => {
    expect(staticCheckInlineHandler("foo  ()", emptyGlobals)).toEqual(["foo"]);
  });

  it("파라미터 있는 호출 (foo(x, y))", () => {
    expect(staticCheckInlineHandler("foo(x, y)", emptyGlobals)).toEqual(["foo"]);
  });

  it("인라인 핸들러 전체 (JS 표현식)", () => {
    // onclick 속성값 전체 시뮬레이션
    const code = "if (confirm('삭제할까?')) { obj.remove(); render(); }";
    // confirm은 skiplist → skip
    // obj.remove는 member access → skip
    // render는 bare → 감지 (전역 없음)
    expect(staticCheckInlineHandler(code, emptyGlobals)).toEqual(["render"]);
  });
});

describe("injectErrorCapture — 스크립트가 정상 주입되는지", () => {
  beforeEach(() => {});

  it("<head>가 있으면 직후에 주입", () => {
    const input = "<!DOCTYPE html><html><head></head><body></body></html>";
    const result = injectErrorCapture(input);
    const headIdx = result.indexOf("<head>");
    const scriptIdx = result.indexOf("<script>");
    expect(scriptIdx).toBeGreaterThan(headIdx);
    expect(scriptIdx).toBe(headIdx + "<head>".length);
  });

  it("이미 주입된 HTML은 중복 주입 안 함", () => {
    const input = "<html><head></head><body>__errs</body></html>";
    const result = injectErrorCapture(input);
    expect(result).toBe(input);
  });

  it("빈 HTML은 그대로 반환", () => {
    expect(injectErrorCapture("")).toBe("");
    expect(injectErrorCapture("   ")).toBe("   ");
  });

  it("<head>가 없으면 <html> 뒤에 주입", () => {
    const input = "<html><body>hi</body></html>";
    const result = injectErrorCapture(input);
    expect(result).toContain("<script>");
    expect(result.indexOf("<script>")).toBeGreaterThan(result.indexOf("<html>"));
  });
});
