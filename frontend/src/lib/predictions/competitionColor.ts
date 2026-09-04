/**
 * fixtures.competition_name 원문 문자열 → 대회색 버킷 (순수 함수, DB 접근 없음). TEA-30.
 * Premier League 외 컵 대회(EFL Cup/FA Cup/Europa League/Europa Conference League/
 * Champions League)와 목록에 없는 새 값, 그리고 null/undefined/빈 문자열은 전부
 * green(기타 컵 대회) fallback이다 — 사람 확정(plan.md 0번 표 2번 B안).
 * 색 값·공식의 근거: vault/02_프로젝트/대회별로 색상 다르게/design-brief.md 2번.
 *
 * 2026-09-05 검수 반영(TEA-30 ⑧): 주차 컨테이너(open)는 그 주 경기의 대회색이 하나면 그
 * 색 대각 글로우, 둘 이상이면 브랜드 파랑 글로우 — weekGlowClass() 참고.
 * 경기 카드는 대회색 wash를 쓰지 않고 항상 bg-page다(색은 컨테이너 글로우가 담당).
 */
export type CompetitionColorBucket = 'violet' | 'green' | 'yellow'

const VIOLET_COMPETITIONS = new Set(['Premier League'])
const YELLOW_COMPETITIONS = new Set(['Club Friendlies'])

export function competitionColorBucket(name: string | null | undefined): CompetitionColorBucket {
  if (name && VIOLET_COMPETITIONS.has(name)) return 'violet'
  if (name && YELLOW_COMPETITIONS.has(name)) return 'yellow'
  return 'green'
}

/** globals.css의 .competition-* 유틸리티 클래스명 룩업 (컴포넌트는 팔레트를 직접 참조하지 않고 이 클래스명만 쓴다). */
export const COMPETITION_GLOW: Record<CompetitionColorBucket, string> = {
  violet: 'competition-glow-violet', green: 'competition-glow-green', yellow: 'competition-glow-yellow',
}
/** 주차 컨테이너 대각 글로우(open, 단일 대회색) — weekGlowClass()가 이 룩업을 쓴다. */
export const COMPETITION_WASH: Record<CompetitionColorBucket, string> = {
  violet: 'competition-wash-violet', green: 'competition-wash-green', yellow: 'competition-wash-yellow',
}
export const COMPETITION_BADGE: Record<CompetitionColorBucket, string> = {
  violet: 'competition-badge-violet', green: 'competition-badge-green', yellow: 'competition-badge-yellow',
}

/** MatchWeekList open 주차 컨테이너의 글로우 클래스 — 그 주 경기의 대회색 버킷이 하나면 그 색, 둘 이상(또는 경기 없음)이면 브랜드 파랑. */
export const WEEK_GLOW_BRAND = 'spotlight-glow-brand'
export function weekGlowClass(competitions: ReadonlyArray<string | null | undefined>): string {
  const buckets = Array.from(new Set(competitions.map(competitionColorBucket)))
  if (buckets.length === 1) return COMPETITION_WASH[buckets[0]]
  return WEEK_GLOW_BRAND
}
