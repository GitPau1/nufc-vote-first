import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** closes_at → "D-N" 또는 "HH:MM:SS" */
export function formatDeadline(closesAt: string): string {
  const diff = new Date(closesAt).getTime() - Date.now()
  if (diff <= 0) return '종료'

  const totalSec = Math.floor(diff / 1000)
  const days = Math.floor(totalSec / 86400)

  if (days >= 1) return `D-${days}`

  const h = String(Math.floor(totalSec / 3600)).padStart(2, '0')
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0')
  const s = String(totalSec % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}

/** scheduled_at → "D-N 공개 예정" */
export function formatScheduled(scheduledAt: string): string {
  const diff = new Date(scheduledAt).getTime() - Date.now()
  if (diff <= 0) return '곧 공개'
  const days = Math.floor(diff / 86400000)
  return days >= 1 ? `D-${days} 공개 예정` : '오늘 공개 예정'
}

/** 날짜 → "YYYY.MM.DD" */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).replace(/\. /g, '.').replace(/\.$/, '')
}

/** 투표 수 배열 → 퍼센트 배열 */
export function calcPercents(counts: number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0)
  if (total === 0) return counts.map(() => 0)
  return counts.map(c => Math.round((c / total) * 100))
}
