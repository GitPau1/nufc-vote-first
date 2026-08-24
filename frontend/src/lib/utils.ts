import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// tailwind-merge는 기본 fontSize 스케일(xs/sm/base/lg/...)만 알고 우리 커스텀 Foundation
// 타이포 스케일(caption-2, headline-1 등)은 모른다. 그래서 `text-caption-2` 같은 클래스를
// "font-size"가 아니라 "text 색상" 그룹으로 오인해서, `text-brand`처럼 진짜 색상 클래스와
// 같이 cn()에 넣으면(예: badge.tsx의 `cn(badgeVariants({variant}), className)`) 같은 그룹
// 충돌로 취급돼 나중 클래스에 밀려 조용히 지워진다 — Badge가 항상 16px(브라우저 기본값)로
// 렌더되던 원인이 이거였다. tailwind.config.ts의 FONT_SIZE_SCALE와 키가 1:1로 대응해야
// 하니, 스케일에 항목을 추가/삭제하면 이 배열도 같이 갱신할 것.
const FOUNDATION_FONT_SIZE_SCALE = [
  'display-1', 'display-2',
  'title-1', 'title-2', 'title-3',
  'heading-1', 'heading-2',
  'headline-1', 'headline-2',
  'body-1-normal', 'body-1-reading',
  'body-2-normal', 'body-2-reading',
  'label-1-normal', 'label-1-reading', 'label-2',
  'caption-1', 'caption-2',
]

// 같은 이유로 border-radius/box-shadow 커스텀 스케일도 등록해둔다. `rounded-pill`/`rounded-xs`는
// tailwind.config.ts의 borderRadius 확장(xs/pill, sm/md/lg는 기본 스케일과 이름이 같아 원래도
// 인식됨)에서, `shadow-w100~g300`는 boxShadow 확장에서 온 이름이다 — tailwind.config.ts와
// 키가 1:1로 대응해야 한다. (실측 결과 shadow-*는 기존 twMerge도 우연히 같은 그룹으로 묶어
// 버그가 없었지만, rounded-pill/rounded-xs는 서로 다른 rounded-* 클래스를 병합할 때 dedup이
// 전혀 안 되고 있었다 — 명시해서 확실히 고정한다.)
const FOUNDATION_RADIUS_SCALE = ['xs', 'pill']
const FOUNDATION_SHADOW_SCALE = ['w100', 'w200', 'w300', 'g100', 'g200', 'g300']

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: FOUNDATION_FONT_SIZE_SCALE,
      radius: FOUNDATION_RADIUS_SCALE,
      shadow: FOUNDATION_SHADOW_SCALE,
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
