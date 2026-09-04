import type { PlayerRow, PollOptionRow } from '@/types/database'

/** 투표 상세(PollClient)도 같은 포맷을 쓴다 — 제출 전후로 날짜 표기가 달라지지 않게. */
export function formatPollDate(dateStr?: string | null): string | null {
  if (!dateStr) return null
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Seoul',
  }).format(new Date(dateStr))
}

/**
 * 선택지 썸네일 판정. 투표 상세(PollClient)도 같은 판정을 쓴다 —
 * 투표할 때 본 썸네일과 결과에서 보는 썸네일이 어긋나면 안 되기 때문.
 */
export function getOptionThumb(option: PollOptionRow, optionPlayers?: Record<string, PlayerRow>) {
  const player = option.player_id ? optionPlayers?.[option.player_id] ?? null : null
  if (option.image_url) {
    return { url: option.image_url, label: option.label, fallback: option.label.slice(0, 1) }
  }
  if (player) {
    return { url: player.photo_url, label: player.name, fallback: player.name.slice(0, 1) }
  }
  return null
}
