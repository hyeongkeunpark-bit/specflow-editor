/**
 * iframe 내 JS 에러를 캡처하여 부모 프레임에 전달하는 유틸리티.
 *
 * 프로덕션 안전 설계:
 * - 캡처 스크립트 전체를 try-catch로 방어 (스크립트 오류가 프로토타입에 영향 없음)
 * - 에러 최대 MAX_ERRORS개까지만 수집 (폭주 방지)
 * - 주입 위치: <head> 직후 (모든 스크립트보다 먼저 실행)
 * - 인라인 핸들러 정적 검증: load 시 onclick 등의 함수 존재 여부 체크
 */

const MAX_ERRORS = 5;

/** postMessage로 전달되는 에러 형태 */
export interface IframeError {
  message: string;
  source?: string;
  line?: number;
  col?: number;
  /** 에러 발생 위치 주변 코드 조각 (col 기반 추출) */
  codeSnippet?: string;
  /** 정적 검증으로 발견된 에러인지 */
  isStatic?: boolean;
}

/** postMessage 이벤트 데이터 형태 */
export interface IframeErrorEvent {
  type: "iframe-error";
  errors: IframeError[];
}

/**
 * iframe에 주입할 에러 캡처 + 정적 검증 스크립트.
 * <head> 직후에 주입되어 모든 스크립트보다 먼저 실행됨.
 *
 * 기능:
 * 1. window.onerror — 런타임 에러 캡처 + col 기반 코드 조각 추출
 * 2. unhandledrejection — Promise 에러 캡처
 * 3. load 시 인라인 핸들러 정적 검증 (onclick 등 → 전역 함수 존재 체크)
 * 4. 에러 발생/load 완료 시 parent.postMessage로 전달
 */
const ERROR_CAPTURE_SCRIPT = `<script>try{
var __errs=[],__MAX=${MAX_ERRORS},__src="";
try{__src=document.documentElement.outerHTML||"";}catch(e){}
function __snip(c){if(!c||!__src)return"";var r=40,s=Math.max(0,c-r),e=Math.min(__src.length,c+r);return __src.slice(s,e);}
function __send(){if(__errs.length>0){try{parent.postMessage({type:"iframe-error",errors:__errs},"*");}catch(e){}}}
function __skip(m){return/sandboxed|SecurityError|localStorage|sessionStorage|cross-origin/.test(String(m));}
window.onerror=function(m,s,l,c){if(!__skip(m)&&__errs.length<__MAX){__errs.push({message:String(m),source:s||"",line:l||0,col:c||0,codeSnippet:__snip(c)});}clearTimeout(window.__et);window.__et=setTimeout(__send,300);return false;};
window.addEventListener("unhandledrejection",function(e){var m=e.reason&&e.reason.message||String(e.reason);if(!__skip(m)&&__errs.length<__MAX){__errs.push({message:"Unhandled Promise: "+m,source:"",line:0,col:0});}clearTimeout(window.__et);window.__et=setTimeout(__send,300);});
window.addEventListener("load",function(){
try{__src=document.documentElement.outerHTML||"";}catch(e){}
var attrs=["onclick","oninput","onchange","onsubmit","onkeypress","onkeydown","onkeyup"];
try{attrs.forEach(function(a){var els=document.querySelectorAll("["+a+"]");els.forEach(function(el){var code=el.getAttribute(a)||"";var fns=code.match(/\\b([a-zA-Z_$][a-zA-Z0-9_$]*)\\s*\\(/g);if(fns){fns.forEach(function(f){var name=f.replace(/\\s*\\($/,"");if(["if","for","while","switch","return","typeof","new","delete","void","throw","catch","function","alert","confirm","prompt","console","setTimeout","setInterval","clearTimeout","clearInterval","parseInt","parseFloat","isNaN","Math","Date","JSON","Object","Array","String","Number","Boolean","RegExp","Error","Map","Set","Promise","event","this","true","false","null","undefined"].indexOf(name)===-1){try{var exists=typeof window[name]==="function"||typeof window[name]==="object";if(!exists&&__errs.length<__MAX){__errs.push({message:"Static: "+name+" is not defined (called in "+a+'="'+code+'")',source:"inline-handler",line:0,col:0,codeSnippet:'<'+el.tagName.toLowerCase()+" "+a+'="'+code+'">'});}}catch(e){}}});}});});}catch(e){}
__send();
});
}catch(e){}</script>`;

/**
 * HTML에 에러 캡처 스크립트를 주입한다.
 * <head> 직후에 주입하여 모든 스크립트보다 먼저 실행되도록 한다.
 * 원본 HTML이 없거나 비어있으면 그대로 반환.
 */
export function injectErrorCapture(html: string): string {
  if (!html || !html.trim()) return html;

  // 이미 주입된 경우 중복 방지
  if (html.includes("__errs")) return html;

  // 주입 위치 폴백 체인: <head> 직후 → <head> 뒤 → <html> 뒤 → 맨 앞
  const headOpenIdx = html.indexOf("<head>");
  if (headOpenIdx !== -1) {
    const insertIdx = headOpenIdx + "<head>".length;
    return html.slice(0, insertIdx) + ERROR_CAPTURE_SCRIPT + html.slice(insertIdx);
  }

  const headWithAttr = html.indexOf("<head ");
  if (headWithAttr !== -1) {
    const closeIdx = html.indexOf(">", headWithAttr);
    if (closeIdx !== -1) {
      const insertIdx = closeIdx + 1;
      return html.slice(0, insertIdx) + ERROR_CAPTURE_SCRIPT + html.slice(insertIdx);
    }
  }

  const htmlOpenIdx = html.indexOf("<html");
  if (htmlOpenIdx !== -1) {
    const closeIdx = html.indexOf(">", htmlOpenIdx);
    if (closeIdx !== -1) {
      const insertIdx = closeIdx + 1;
      return html.slice(0, insertIdx) + ERROR_CAPTURE_SCRIPT + html.slice(insertIdx);
    }
  }

  return ERROR_CAPTURE_SCRIPT + html;
}

/**
 * postMessage 이벤트가 iframe 에러인지 확인
 */
export function isIframeErrorEvent(data: unknown): data is IframeErrorEvent {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as any).type === "iframe-error" &&
    Array.isArray((data as any).errors)
  );
}

/**
 * 에러 목록에서 중복 제거 (같은 message는 1회만)
 */
function deduplicateErrors(errors: IframeError[]): IframeError[] {
  const seen = new Set<string>();
  return errors.filter((e) => {
    if (seen.has(e.message)) return false;
    seen.add(e.message);
    return true;
  });
}

/**
 * 에러 목록을 AI 요청에 포함할 텍스트로 포맷팅.
 * htmlContent가 제공되면 부모 측 코드 분석도 수행.
 */
export function formatErrorsForAI(errors: IframeError[], htmlContent?: string): string {
  if (errors.length === 0) return "";

  const unique = deduplicateErrors(errors);
  const lines = unique.map((e, i) => {
    const parts: string[] = [];
    parts.push(`${i + 1}. ${e.message}`);

    // 코드 조각이 있으면 포함
    if (e.codeSnippet) {
      parts.push(`   발생 위치: ...${e.codeSnippet}...`);
    }

    // 부모 측 코드 분석: htmlContent에서 미정의 심볼 검색
    if (htmlContent) {
      const analysis = analyzeError(e, htmlContent);
      if (analysis) {
        parts.push(`   분석: ${analysis}`);
      }
    }

    return parts.join("\n");
  });

  return `[Prototype 런타임 에러]\n${lines.join("\n")}\n\n[수정 규칙] 위 에러의 원인 코드만 최소한으로 수정하세요. 기능 제거 금지. UI 구조 변경 금지.`;
}

/**
 * 부모 측 코드 분석: 에러 메시지에서 심볼을 추출하고 htmlContent에서 정의 위치 검색
 */
function analyzeError(error: IframeError, html: string): string | null {
  const msg = error.message;

  // "X is not defined" 패턴
  const notDefined = msg.match(/(?:ReferenceError:\s*)?(\w+) is not defined/);
  if (notDefined) {
    const symbol = notDefined[1];
    return analyzeUndefinedSymbol(symbol, html);
  }

  // "Cannot read properties of null (reading 'X')" 패턴
  const nullProp = msg.match(/Cannot read propert(?:y|ies) of null(?: \(reading '(\w+)'\))?/);
  if (nullProp) {
    const prop = nullProp[1];
    if (prop) {
      // getElementById 등으로 찾은 요소가 null
      const idMatch = html.match(new RegExp(`getElementById\\s*\\(\\s*['"]([^'"]+)['"]\\s*\\).*?${prop}`, "s"));
      if (idMatch) {
        const targetId = idMatch[1];
        const exists = html.includes(`id="${targetId}"`) || html.includes(`id='${targetId}'`);
        return exists
          ? `id="${targetId}" 요소는 존재하나, 스크립트 실행 시점에 DOM이 아직 로드되지 않았을 가능성. DOMContentLoaded 내부로 이동 필요.`
          : `id="${targetId}" 요소가 HTML에 존재하지 않음.`;
      }
    }
    return "DOM 요소가 null. 스크립트 실행 시점보다 해당 요소가 아래에 있거나, id/선택자가 잘못되었을 가능성.";
  }

  return null;
}

/**
 * 미정의 심볼 분석: htmlContent에서 해당 심볼이 어디에 정의되어 있는지 검색
 */
function analyzeUndefinedSymbol(symbol: string, html: string): string {
  const findings: string[] = [];

  // 클래스 메서드로 존재하는지 (minified HTML에서 중첩 {}를 넘어가야 하므로 [\s\S]*? 사용)
  const classMethodRe = new RegExp(`class\\s+(\\w+)[\\s\\S]*?${symbol}\\s*\\(`);
  const classMatch = classMethodRe.exec(html);
  if (classMatch) {
    findings.push(`${symbol}은 ${classMatch[1]} 클래스의 메서드로 정의됨 (전역 함수 아님)`);

    // 클래스 인스턴스 변수 찾기
    const instanceRe = new RegExp(`(?:const|let|var)\\s+(\\w+)\\s*=\\s*new\\s+${classMatch[1]}`, "g");
    const instMatch = instanceRe.exec(html);
    if (instMatch) {
      findings.push(`인스턴스: ${instMatch[1]}. 올바른 호출: ${instMatch[1]}.${symbol}()`);
    }
  }

  // function 선언으로 존재하는지 (전역이 아닌 스코프)
  if (!classMatch) {
    const funcRe = new RegExp(`function\\s+${symbol}\\s*\\(`);
    if (funcRe.test(html)) {
      findings.push(`${symbol} 함수가 정의되어 있으나, 스코프 문제로 전역에서 접근 불가할 수 있음`);
    }
  }

  // 인라인 핸들러에서 호출하는지
  const handlerRe = new RegExp(`on\\w+\\s*=\\s*["'][^"']*${symbol}\\s*\\(`, "g");
  const handlerMatch = handlerRe.exec(html);
  if (handlerMatch) {
    findings.push(`인라인 이벤트 핸들러에서 ${symbol}()을 호출하고 있음`);
  }

  if (findings.length === 0) {
    return `${symbol}이 HTML 내 어디에도 정의되어 있지 않음. 함수 정의가 누락됨.`;
  }

  return findings.join(". ");
}

// ── 클라이언트 직접 패치 ──

interface PatchResult {
  html: string;
  applied: string[];
}

/**
 * AI 없이 클라이언트에서 직접 에러를 패치한다.
 * 지원하는 패턴:
 * 1. 인라인 핸들러의 "X is not defined" → 클래스 인스턴스로 수정
 *    onclick="addTodo()" → onclick="app.addTodo()"
 *
 * @returns 패치된 HTML + 적용된 수정 목록, 또는 패치 불가 시 null
 */
export function tryClientPatch(html: string, errors: IframeError[]): PatchResult | null {
  let patched = html;
  const applied: string[] = [];

  for (const error of errors) {
    const msg = error.message;

    // 패턴 1: "X is not defined" — 클래스 메서드 스코프 문제
    const notDefined = msg.match(/(?:Static:\s*|(?:Uncaught )?ReferenceError:\s*)?(\w+) is not defined/);
    if (notDefined) {
      const symbol = notDefined[1];
      const fix = patchUndefinedSymbol(patched, symbol);
      if (fix) {
        patched = fix.html;
        applied.push(fix.description);
        continue;
      }
    }

    // 패턴 2: "X is not a function" — 메서드명 오류 (renderTodos → render 등)
    const notAFunction = msg.match(/(?:Uncaught TypeError:\s*)?(?:this\.)?(\w+) is not a function/);
    if (notAFunction) {
      const symbol = notAFunction[1];
      const fix = patchWrongMethodName(patched, symbol);
      if (fix) {
        patched = fix.html;
        applied.push(fix.description);
        continue;
      }
    }
  }

  if (applied.length === 0) return null;
  return { html: patched, applied };
}

/**
 * "X is not defined" 에러를 직접 패치:
 * - 클래스 메서드인 경우: 인라인 핸들러에서 인스턴스 접두사 추가
 *   onclick="X(...)" → onclick="instance.X(...)"
 */
function patchUndefinedSymbol(html: string, symbol: string): { html: string; description: string } | null {
  // 클래스 메서드인지 확인
  const classMethodRe = new RegExp(`class\\s+(\\w+)[\\s\\S]*?${symbol}\\s*\\(`);
  const classMatch = classMethodRe.exec(html);
  if (!classMatch) return null;

  const className = classMatch[1];

  // 인스턴스 변수 찾기
  const instanceRe = new RegExp(`(?:const|let|var)\\s+(\\w+)\\s*=\\s*new\\s+${className}`);
  const instMatch = instanceRe.exec(html);
  if (!instMatch) return null;

  const instance = instMatch[1];

  // 인라인 핸들러에서 symbol( 호출을 instance.symbol( 로 치환
  // 이미 instance. 접두사가 있으면 건드리지 않음
  const handlerAttrs = ["onclick", "oninput", "onchange", "onsubmit", "onkeypress", "onkeydown", "onkeyup"];
  let result = html;
  let count = 0;

  for (const attr of handlerAttrs) {
    // 예: onclick="addTodo()" 또는 onclick="addTodo(x,y)"
    // 단, onclick="app.addTodo()" 는 건드리지 않음
    const re = new RegExp(
      `(${attr}\\s*=\\s*["'])` +           // attr=" 시작
      `([^"']*?)` +                         // 앞 부분 (다른 코드)
      `(?<!\\w\\.)\\b${symbol}\\s*\\(` +    // symbol( — 앞에 .이 없을 때만
      `([^"']*)` +                          // 뒤 부분
      `(["'])`,                             // 닫는 따옴표
      "g",
    );

    result = result.replace(re, (match, prefix, before, after, quote) => {
      count++;
      return `${prefix}${before}${instance}.${symbol}(${after}${quote}`;
    });
  }

  if (count === 0) return null;

  return {
    html: result,
    description: `${attr_list(handlerAttrs)}에서 ${symbol}() → ${instance}.${symbol}() (${count}곳)`,
  };
}

function attr_list(_attrs: string[]): string {
  return "인라인 핸들러";
}

/**
 * "X is not a function" 에러를 직접 패치:
 * - 클래스 내에서 this.X()를 호출하지만 X 메서드가 없는 경우
 * - 비슷한 이름의 메서드가 있으면 치환 (renderTodos → render 등)
 */
function patchWrongMethodName(html: string, wrongName: string): { html: string; description: string } | null {
  // HTML 내 <script> 영역에서 클래스 메서드 목록 추출
  const methodRe = /\b(\w+)\s*\(\s*\)\s*\{/g;
  const methods = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = methodRe.exec(html)) !== null) {
    const name = m[1];
    if (name !== "function" && name !== "if" && name !== "for" && name !== "while" && name !== "catch") {
      methods.add(name);
    }
  }
  // 파라미터가 있는 메서드도 추출
  const methodRe2 = /\b(\w+)\s*\([^)]+\)\s*\{/g;
  while ((m = methodRe2.exec(html)) !== null) {
    const name = m[1];
    if (name !== "function" && name !== "if" && name !== "for" && name !== "while" && name !== "catch") {
      methods.add(name);
    }
  }

  // wrongName이 실제로 없는지 확인
  if (methods.has(wrongName)) return null;

  // 유사한 메서드 찾기 — 가장 가까운 1개만
  const candidates: { name: string; score: number }[] = [];
  const wLower = wrongName.toLowerCase();
  for (const method of methods) {
    const mLower = method.toLowerCase();
    if (wLower === mLower) continue; // 동일하면 skip
    // 부분 문자열 관계
    if (wLower.includes(mLower) || mLower.includes(wLower)) {
      // 길이 차이가 작을수록 높은 점수
      const score = 1 - Math.abs(wrongName.length - method.length) / Math.max(wrongName.length, method.length);
      candidates.push({ name: method, score });
    }
  }

  if (candidates.length === 0) return null;

  // 점수 내림차순, 최고점이 유일하지 않으면 포기
  candidates.sort((a, b) => b.score - a.score);
  if (candidates.length > 1 && candidates[0].score === candidates[1].score) return null;

  const correctName = candidates[0].name;

  // this.wrongName( → this.correctName( 치환
  const callRe = new RegExp(`this\\.${wrongName}\\s*\\(`, "g");
  let count = 0;
  const result = html.replace(callRe, () => {
    count++;
    return `this.${correctName}(`;
  });

  if (count === 0) return null;

  return {
    html: result,
    description: `this.${wrongName}() → this.${correctName}() (${count}곳)`,
  };
}
