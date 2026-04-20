import { describe, it, expect } from "vitest";
import { tryClientPatch } from "../iframeErrors";
import type { IframeError } from "../iframeErrors";

/**
 * tryClientPatch — iframe 런타임 에러 자동 패치 순수 함수 테스트
 *
 * 지원 패턴:
 * 1. "X is not defined" — 클래스 메서드인 경우 인라인 핸들러에 인스턴스 접두사 추가
 *    onclick="addTodo()" → onclick="app.addTodo()"
 * 2. "X is not a function" — 비슷한 이름 메서드로 치환 (renderTodos → render 등)
 */

function makeErr(message: string): IframeError {
  return { message, source: "inline-handler", line: 0, col: 0 };
}

describe("tryClientPatch — 패턴 1: 클래스 메서드 인라인 핸들러", () => {
  it("단일 인라인 핸들러 패치", () => {
    const html = `
      <html><body>
        <button onclick="addTodo()">Add</button>
        <script>
          class TodoApp {
            addTodo() { console.log('added'); }
          }
          const app = new TodoApp();
        </script>
      </body></html>
    `;
    const result = tryClientPatch(html, [makeErr("addTodo is not defined")]);
    expect(result).not.toBeNull();
    expect(result!.html).toContain(`onclick="app.addTodo()"`);
    expect(result!.html).not.toContain(`onclick="addTodo()"`);
    expect(result!.applied.some((a) => a.includes("addTodo") && a.includes("app.addTodo"))).toBe(true);
  });

  it("Static prefix 에러도 처리", () => {
    const html = `
      <button onclick="save()">Save</button>
      <script>
        class Form { save() {} }
        const form = new Form();
      </script>
    `;
    const result = tryClientPatch(html, [makeErr('Static: save is not defined (called in onclick="save()")')]);
    expect(result).not.toBeNull();
    expect(result!.html).toContain(`onclick="form.save()"`);
  });

  it("여러 핸들러 같은 메서드 호출 — 모두 패치", () => {
    const html = `
      <button onclick="remove()">A</button>
      <button onclick="remove()">B</button>
      <input onchange="remove()">
      <script>
        class Mgr { remove() {} }
        const mgr = new Mgr();
      </script>
    `;
    const result = tryClientPatch(html, [makeErr("remove is not defined")]);
    expect(result).not.toBeNull();
    const matches = (result!.html.match(/mgr\.remove\(\)/g) || []).length;
    expect(matches).toBe(3);
    expect(result!.applied[0]).toContain("3곳");
  });

  it("여러 에러 동시 처리 (증가/감소)", () => {
    const html = `
      <button onclick="inc()">+</button>
      <button onclick="dec()">-</button>
      <script>
        class Counter {
          inc() {}
          dec() {}
        }
        const c = new Counter();
      </script>
    `;
    const result = tryClientPatch(html, [
      makeErr("inc is not defined"),
      makeErr("dec is not defined"),
    ]);
    expect(result).not.toBeNull();
    expect(result!.html).toContain(`onclick="c.inc()"`);
    expect(result!.html).toContain(`onclick="c.dec()"`);
    expect(result!.applied).toHaveLength(2);
  });

  it("이미 instance. 접두사 있는 호출은 건드리지 않음", () => {
    const html = `
      <button onclick="app.addTodo()">Already correct</button>
      <button onclick="addTodo()">Bare</button>
      <script>
        class TodoApp { addTodo() {} }
        const app = new TodoApp();
      </script>
    `;
    const result = tryClientPatch(html, [makeErr("addTodo is not defined")]);
    expect(result).not.toBeNull();
    // bare 호출만 패치되고 기존 app.addTodo()는 그대로
    const matches = (result!.html.match(/app\.addTodo\(\)/g) || []).length;
    expect(matches).toBe(2); // 기존 1 + 새로 패치 1
  });

  it("클래스 메서드가 아니면 null 반환", () => {
    const html = `
      <button onclick="undefinedFn()">X</button>
      <script>
        // class 없음
      </script>
    `;
    const result = tryClientPatch(html, [makeErr("undefinedFn is not defined")]);
    expect(result).toBeNull();
  });

  it("인스턴스 변수가 없으면 null 반환", () => {
    const html = `
      <button onclick="addTodo()">X</button>
      <script>
        class TodoApp { addTodo() {} }
        // new TodoApp() 호출 없음
      </script>
    `;
    const result = tryClientPatch(html, [makeErr("addTodo is not defined")]);
    expect(result).toBeNull();
  });
});

describe("tryClientPatch — 패턴 2: 비슷한 메서드명 치환", () => {
  it("renderTodos → render 치환", () => {
    const html = `
      <script>
        class TodoApp {
          render() {}
          addTodo() {
            this.renderTodos();
          }
        }
      </script>
    `;
    const result = tryClientPatch(html, [makeErr("this.renderTodos is not a function")]);
    expect(result).not.toBeNull();
    expect(result!.html).toContain("this.render()");
    expect(result!.html).not.toContain("this.renderTodos()");
  });

  it("완벽히 동일한 메서드 있으면 null (치환 대상 이미 존재)", () => {
    const html = `
      <script>
        class App {
          render() {
            this.render();
          }
        }
      </script>
    `;
    // render가 실제로 있으면 치환할 필요 없음
    const result = tryClientPatch(html, [makeErr("this.render is not a function")]);
    expect(result).toBeNull();
  });

  it("유사 후보가 여러 개고 동점이면 null (안전 폴백)", () => {
    const html = `
      <script>
        class App {
          saveA() {}
          saveB() {}
          run() {
            this.save();
          }
        }
      </script>
    `;
    // save와 유사한 saveA, saveB 둘 다 동일 점수 → 치환 안 함
    const result = tryClientPatch(html, [makeErr("this.save is not a function")]);
    expect(result).toBeNull();
  });
});

describe("tryClientPatch — 매칭 안 되는 케이스", () => {
  it("알 수 없는 에러 패턴 → null", () => {
    const html = `<html><body>ok</body></html>`;
    const result = tryClientPatch(html, [makeErr("Some unrelated error")]);
    expect(result).toBeNull();
  });

  it("에러 배열 비어있음 → null", () => {
    const html = `<html><body>ok</body></html>`;
    const result = tryClientPatch(html, []);
    expect(result).toBeNull();
  });

  it("에러는 있지만 HTML에 치환 대상 없음 → null", () => {
    const html = `<html><body>no scripts</body></html>`;
    const result = tryClientPatch(html, [makeErr("foo is not defined")]);
    expect(result).toBeNull();
  });
});
