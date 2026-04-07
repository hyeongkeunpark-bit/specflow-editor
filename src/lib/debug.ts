/**
 * 디버그 로거
 * 활성화: 브라우저 콘솔에서 localStorage.setItem('debug', 'true')
 * 비활성화: localStorage.removeItem('debug')
 */

function isDebug(): boolean {
  try {
    return localStorage.getItem("debug") === "true";
  } catch {
    return false;
  }
}

function truncate(text: string, max = 300): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + `... (${text.length}자)`;
}

export function debugLog(label: string, data: Record<string, unknown>) {
  if (!isDebug()) return;

  console.group(`[SpecFlow] ${label}`);
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string") {
      console.log(`${key}:`, truncate(value));
    } else if (typeof value === "boolean") {
      console.log(`${key}:`, value ? "YES" : "NO");
    } else {
      console.log(`${key}:`, value);
    }
  }
  console.groupEnd();
}
