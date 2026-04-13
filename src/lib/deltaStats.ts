/**
 * Delta 매칭 성공률 추적
 *
 * 활성화: localStorage.setItem('debug', 'true')
 * 통계 조회: 콘솔에서 window.__deltaStats()
 * 초기화: 콘솔에서 window.__deltaStatsReset()
 */

interface DeltaRecord {
  timestamp: number;
  deltaCount: number;
  /** 최종 적용 방법. "none"이면 전부 실패 */
  resolvedBy: "exact" | "fuzzy" | "normalized" | "morph" | "claude_fallback" | "full_html_in_response" | "none";
  /** exact/fuzzy/normalized 각 단계별 성공 개수 (parser 내부) */
  matchCounts?: { exact: number; fuzzy: number; normalized: number };
}

const STORAGE_KEY = "specflow_delta_stats";
const MAX_RECORDS = 200;

function load(): DeltaRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(records: DeltaRecord[]) {
  try {
    const trimmed = records.slice(-MAX_RECORDS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // quota exceeded — skip
  }
}

/** delta 매칭 결과 1건 기록 */
export function recordDelta(
  deltaCount: number,
  resolvedBy: DeltaRecord["resolvedBy"],
  matchCounts?: { exact: number; fuzzy: number; normalized: number },
) {
  const records = load();
  records.push({ timestamp: Date.now(), deltaCount, resolvedBy, matchCounts });
  save(records);
}

/** 통계 요약 출력 */
function printStats() {
  const records = load();
  if (records.length === 0) {
    console.log("[DeltaStats] 데이터 없음");
    return;
  }

  const total = records.length;
  const byMethod: Record<string, number> = {};
  for (const r of records) {
    byMethod[r.resolvedBy] = (byMethod[r.resolvedBy] || 0) + 1;
  }

  const directSuccess = (byMethod["exact"] || 0) + (byMethod["fuzzy"] || 0) + (byMethod["normalized"] || 0);
  const fallbackSuccess = (byMethod["morph"] || 0) + (byMethod["claude_fallback"] || 0) + (byMethod["full_html_in_response"] || 0);
  const failed = byMethod["none"] || 0;

  console.group("[DeltaStats] 요약");
  console.log(`총 ${total}건`);
  console.log(`직접 매칭 성공: ${directSuccess}건 (${pct(directSuccess, total)})`);
  console.log(`  - exact: ${byMethod["exact"] || 0}`);
  console.log(`  - fuzzy: ${byMethod["fuzzy"] || 0}`);
  console.log(`  - normalized: ${byMethod["normalized"] || 0}`);
  console.log(`폴백 성공: ${fallbackSuccess}건 (${pct(fallbackSuccess, total)})`);
  console.log(`  - morph: ${byMethod["morph"] || 0}`);
  console.log(`  - claude_fallback: ${byMethod["claude_fallback"] || 0}`);
  console.log(`  - full_html_in_response: ${byMethod["full_html_in_response"] || 0}`);
  console.log(`실패 (변경 없음): ${failed}건 (${pct(failed, total)})`);
  console.log(`---`);
  console.log(`직접 매칭률: ${pct(directSuccess, total)}`);
  console.log(`전체 성공률: ${pct(directSuccess + fallbackSuccess, total)}`);
  console.groupEnd();

  console.table(records.map((r) => ({
    시각: new Date(r.timestamp).toLocaleTimeString(),
    deltas: r.deltaCount,
    결과: r.resolvedBy,
    ...(r.matchCounts || {}),
  })));
}

function pct(n: number, total: number): string {
  return total === 0 ? "0%" : `${Math.round((n / total) * 100)}%`;
}

// 글로벌 접근용
if (typeof window !== "undefined") {
  (window as any).__deltaStats = printStats;
  (window as any).__deltaStatsReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    console.log("[DeltaStats] 초기화 완료");
  };
}
