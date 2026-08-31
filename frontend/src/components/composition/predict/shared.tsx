'use client'

import { useState } from 'react'
import { Coins, Wallet, CircleHelp } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/primitives/avatar'
import { Button } from '@/components/primitives/button'
import { cn } from '@/lib/utils'
import { badgeVariants } from '@/components/primitives/badge'

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
          'flex shrink-0 items-center justify-center rounded-pill bg-disabled text-label-1-normal font-medium text-neutral-muted',
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
 * 가격마다 색이 다르다: 1툰 회색(neutral) · 2툰 파랑(brand) · 3툰 보라(magic).
 * 배지 형태(rounded-pill/px/py/caption-2)는 primitives/badge와 같게 맞춘다.
 */
const TOON_TIER: Record<number, string> = {
  1: 'bg-neutral-weak text-neutral-muted',
  2: 'bg-brand-weak text-brand',
  3: 'bg-magic-weak text-magic',
}

export function ToonCost({ cost, className }: { cost: number; className?: string }) {
  return (
    <span
      aria-label={`${cost}툰`}
      className={cn(
        badgeVariants({ variant: 'bare' }),
        'gap-1',
        TOON_TIER[cost] ?? TOON_TIER[2],
        className,
      )}
    >
      <Coins size={12} aria-hidden />
      {cost}
    </span>
  )
}

/**
 * 5툰 예산 게이지 — 좌측 예산(지갑) 아이콘 · 5칸 세그먼트(툰만큼 채움) · 우측 도움말(?).
 * 도움말은 호버(데스크탑)나 탭(모바일)으로 열린다. 숫자 텍스트는 두지 않는다 — 채워진 칸으로 읽는다.
 * 초과는 선택 단계에서 막으므로 여기서 over 상태는 없다.
 */
export function BudgetBar({ spent, total = 5 }: { spent: number; total?: number }) {
  const [helpOpen, setHelpOpen] = useState(false)
  return (
    <div className="flex items-center gap-2.5">
      <Wallet size={16} aria-hidden className="shrink-0 text-neutral-muted" />
      <div className="flex flex-1 gap-1.5" role="img" aria-label={`${total}툰 중 ${spent}툰 사용`}>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cn('h-2 flex-1 rounded-pill', i < spent ? 'bg-brand-solid' : 'bg-disabled')}
          />
        ))}
      </div>
      <div className="group relative shrink-0">
        <button
          type="button"
          aria-label="예산 도움말"
          onClick={() => setHelpOpen(open => !open)}
          className="flex h-5 w-5 items-center justify-center text-neutral-subtle transition-colors duration-micro hover:text-brand"
        >
          <CircleHelp size={16} aria-hidden />
        </button>
        <span
          role="tooltip"
          className={cn(
            'pointer-events-none absolute right-0 top-full z-10 mt-2 w-52 rounded-md bg-neutral-strong px-3 py-2 text-caption-2 font-medium text-on-solid shadow-w200 transition-opacity duration-micro group-hover:opacity-100',
            helpOpen ? 'opacity-100' : 'opacity-0',
          )}
        >
          선수마다 1~3툰의 가격이 있어요. 한 경기에서 5툰 예산 안으로 세 명을 골라요.
        </span>
      </div>
    </div>
  )
}
