'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** 팀 엠블럼(FotMob CDN URL은 lib/predictions/week.ts의 teamLogoUrl이 만든다). 실패하면 이니셜 원형으로 폴백. */
export function TeamBadge({ logoUrl, name, size = 48 }: { logoUrl?: string; name: string; size?: number }) {
  const [failed, setFailed] = useState(false)

  if (failed || !logoUrl) {
    return (
      <span
        aria-hidden
        className="flex shrink-0 items-center justify-center rounded-pill bg-disabled text-label-1-normal font-black text-gray-2"
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
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  )
}

export function Silhouette({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <circle cx="12" cy="8" r="4" fill="currentColor" />
      <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="currentColor" />
    </svg>
  )
}

/** 선수 사진 자리 — photoUrl이 없으면 실루엣 원형. */
export function PlayerPhoto({ url, size = 64 }: { url: string | null; size?: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="rounded-pill object-cover" style={{ width: size, height: size }} />
  }
  return (
    <span
      className={cn('flex shrink-0 items-center justify-center rounded-pill bg-disabled text-gray-3')}
      style={{ width: size, height: size }}
    >
      <Silhouette />
    </span>
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
