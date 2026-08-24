/**
 * 킥오프 시각 → 승부예측 주차 키("2026-35" = ISO 연도-ISO 주차, KST 기준).
 *
 * 이 파일은 origin/main의 승부예측 백엔드(PR #7 "sup/predict-backend" 이후 "예측 단위 주
 * 단위로 변경" 커밋들)에 있는 `lib/predictions/week.ts`의 `toKst`/`isoWeek`/`weekKey`를
 * 그대로 옮겨온 것이다. 이 브랜치(gun/design-system)는 그 PR이 머지되기 전에 갈라져서
 * 실제 파일이 없다 — MatchdayHero가 "/predictions/{weekKey}"로 링크하려면 같은 알고리즘이
 * 필요해서 이 최소 부분집합만 먼저 가져왔다. 두 브랜치가 합쳐지면 원본 파일(예측 제출 플로우
 * 전체를 포함한 233줄짜리)로 대체하면 된다 — 여기 세 함수는 그 파일과 1:1로 동일해야 한다.
 */
const KST_OFFSET_MS = 9 * 3_600_000

/** UTC 시각을 한국 기준 달력 날짜로 옮긴 Date(한국은 DST 없음). */
export function toKst(iso: string): Date {
  return new Date(new Date(iso).getTime() + KST_OFFSET_MS)
}

/** ISO 8601 주차 번호 (월요일 시작). */
export function isoWeek(kst: Date): number {
  const d = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()))
  // 목요일이 속한 해가 그 주의 ISO 연도 — 목요일로 옮긴 뒤 연초부터 몇 주째인지 센다.
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7)
}

/** 그룹 키이자 예측 세션 URL 파라미터 — 연도가 넘어가도 주차가 겹치지 않게 ISO 연도까지 포함. */
export function weekKey(kst: Date): string {
  const thursday = new Date(kst.getTime())
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7))
  return `${thursday.getUTCFullYear()}-${String(isoWeek(kst)).padStart(2, '0')}`
}
