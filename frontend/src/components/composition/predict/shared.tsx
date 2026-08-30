'use client'

import { useState } from 'react'
import * as Progress from '@radix-ui/react-progress'
import { Coins } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/primitives/avatar'
import { Button } from '@/components/primitives/button'
import { badgeVariants } from '@/components/primitives/badge'
import { cn } from '@/lib/utils'

/**
 * 팀 엠블럼(Storage public URL은 lib/predictions/week.ts의 teamLogoUrl이 만든다). 없거나 실패하면 이니셜 원형으로 폴백.
 * `grayscale`은 "이 경기는 끝났다"는 표시다 — 판정은 경기 단위(`match.finished`)라, 한 주차 안에
 * 끝난 경기와 안 끝난 경기가 섞이면 로고 톤도 경기마다 갈린다.
 */
export function TeamBadge({
  logoUrl,
  name,
  size = 48,
  grayscale = false,
}: {
  logoUrl?: string | null
  name: string
  size?: number
  grayscale?: boolean
}) {
  const [failed, setFailed] = useState(false)

  if (failed || !logoUrl) {
    return (
      <span
        aria-hidden
        className={cn(
          'flex shrink-0 items-center justify-center rounded-pill bg-disabled text-label-1-normal font-black text-neutral-muted',
          grayscale && 'grayscale'
        )}
        style={{ width: size, height: size }}
      >
        {name.slice(0, 1)}
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoUrl}
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={cn('shrink-0 object-contain', grayscale && 'grayscale')}
      style={{ width: size, height: size }}
    />
  )
}

/**
 * `PlayerPhoto` 폴백 전용 아이콘. **이 SVG를 직접 원으로 감싸 쓰지 마라** — 예측 화면 세 곳이
 * 각자 같은 원 클래스를 복제해 두는 바람에 폴백 톤을 바꿀 때 네 곳을 함께 고쳐야 했다.
 * "선수가 없다"는 자리에는 `<PlayerPhoto url={null} size={...} />`를 쓴다.
 */
export function Silhouette({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <circle cx="12" cy="8" r="4" fill="currentColor" />
      <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="currentColor" />
    </svg>
  )
}

/**
 * 선수 사진 자리 — 사진이 없거나 **로드에 실패해도** 실루엣 원형으로 떨어진다.
 * `ui/avatar.tsx`(Radix Avatar)를 쓰므로 onError 핸들러가 필요 없다: 버킷에 파일이 없어
 * Storage가 400을 주는 선수(사진이 아직 없는 신입·유스)도 깨진 이미지 대신 실루엣이 남는다.
 * 크기는 Avatar 기본값(h-10 w-10)을 인라인 스타일로 덮어써서 임의 px를 그대로 받는다.
 */
export function PlayerPhoto({ url, size = 64 }: { url: string | null; size?: number }) {
  return (
    <Avatar className="shrink-0" style={{ width: size, height: size }}>
      {url && <AvatarImage src={url} alt="" className="object-cover" />}
      <AvatarFallback className="bg-disabled text-neutral-subtle">
        <Silhouette />
      </AvatarFallback>
    </Avatar>
  )
}

/** 공유하기 = 현재 주소 링크 복사(2026-08-22 결정). 퍼블리싱은 라벨만 있고 동작이 없었다. */
export function ShareButton() {
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 클립보드 권한이 없거나 보안 컨텍스트가 아니면 조용히 넘긴다 — 주소창에서 직접 복사할 수 있다.
    }
  }

  return (
    <Button className="w-40" onClick={copyLink}>
      {copied ? '링크 복사 완료' : '↗ 공유하기'}
    </Button>
  )
}

/**
 * 툰 비용 배지 — Coins 아이콘 + 숫자. 픽 카드·픽 모달에서 옛 배당(×N.N) 자리를 대체한다.
 * 색은 기존 Badge default(brand-weak/brand)를 그대로 쓴다.
 */
export function ToonCost({ cost, className }: { cost: number; className?: string }) {
  return (
    <span
      aria-label={`${cost}툰`}
      className={cn(badgeVariants(), 'inline-flex items-center gap-1', className)}
    >
      <Coins size={12} aria-hidden />
      {cost}
    </span>
  )
}

/**
 * 5툰 예산 사용량 바(가로 프로그레스). spent/total 비율로 채운다.
 * 초과는 선택 단계에서 막으므로(초과 선수 선택 불가) 여기서 over 상태는 그리지 않는다 — 최대 100%.
 */
export function BudgetBar({ spent, total = 5 }: { spent: number; total?: number }) {
  const percent = total > 0 ? Math.min(100, (spent / total) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-caption-1 font-bold text-neutral-muted">예산</span>
      <Progress.Root
        value={percent}
        className="relative h-2 flex-1 overflow-hidden rounded-pill bg-disabled"
      >
        <Progress.Indicator
          className="h-full rounded-pill bg-brand-solid transition-transform duration-micro"
          style={{ transform: `translateX(-${100 - percent}%)` }}
        />
      </Progress.Root>
      <span className="shrink-0 text-caption-1 font-bold text-brand tabular-nums">
        {spent}/{total}툰
      </span>
    </div>
  )
}
