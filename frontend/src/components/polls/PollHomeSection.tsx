'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PollCard } from './PollCard'
import type { PollListItem } from '@/lib/queries/polls'

// 모바일: 세로 리스트로 3개씩 더 불러온다(스크롤/스와이프 아님, "더보기" 버튼).
const MOBILE_STEP = 3
// 데스크탑 그리드의 lg 브레이크포인트(1024px) — tailwind.config.ts 기본값과 맞춰둔다.
const DESKTOP_LG_BREAKPOINT_QUERY = '(min-width: 1024px)'

/** 지금 그리드가 몇 열(2 또는 3)인지 — 페이지당 정확히 한 줄만 보여주려면 열 수를 알아야 한다. */
function useDesktopColumnCount(): number {
  const [columns, setColumns] = useState(3)

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_LG_BREAKPOINT_QUERY)
    const update = () => setColumns(mql.matches ? 3 : 2)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  return columns
}

interface PollHomeSectionProps {
  title: string
  polls: PollListItem[]
  /** 있으면 섹션 우측에 "전체보기" 같은 이동 링크를 붙인다. */
  action?: { label: string; href: string }
}

/**
 * 홈 화면의 "진행중/예정/종료" 섹션. polls가 비어 있으면 섹션 자체를 렌더하지 않는다
 * (예: 예정 투표가 없으면 이 섹션이 안 보여야 한다는 요구사항).
 *
 * 모바일: 세로로 쌓이는 리스트 — 카드는 horizontal(썸네일 좌측), `/polls` 모바일 리스트와 동일 형태.
 * 데스크탑: 캐러셀(스크롤)이 아니라 일반 그리드 — 카드는 vertical(썸네일 상단), 한 페이지에 딱
 * 한 줄(2단이면 2개, 3단이면 3개)만 보여주고 좌우 버튼으로 페이지를 넘긴다. 두 레이아웃 다
 * 렌더해두고 브레이크포인트로 하나만 보여주는 건 PollListClient와 같은 방식이다.
 */
export function PollHomeSection({ title, polls, action }: PollHomeSectionProps) {
  const [mobileVisible, setMobileVisible] = useState(MOBILE_STEP)
  const [desktopPage, setDesktopPage] = useState(0)
  const columns = useDesktopColumnCount()

  if (polls.length === 0) return null

  const mobileItems = polls.slice(0, mobileVisible)
  const canShowMore = mobileVisible < polls.length

  const desktopPageCount = Math.ceil(polls.length / columns)
  // 리사이즈로 열 수가 바뀌면 이전 페이지 번호가 범위 밖일 수 있어 clamp — page 상태 자체는
  // 그대로 두고 렌더링에서만 보정한다(리사이즈 중 페이지가 튀는 걸 막는다).
  const safeDesktopPage = Math.min(desktopPage, desktopPageCount - 1)
  const desktopItems = polls.slice(safeDesktopPage * columns, safeDesktopPage * columns + columns)
  const canGoPrev = safeDesktopPage > 0
  const canGoNext = safeDesktopPage < desktopPageCount - 1

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-heading-2 font-bold text-neutral">{title}</h2>
        <div className="flex items-center gap-3">
          {action && (
            <Link
              href={action.href}
              prefetch={false}
              className="text-label-2 font-semibold text-neutral-muted transition-opacity hover:opacity-70"
            >
              {action.label}
            </Link>
          )}
          {desktopPageCount > 1 && (
            <div className="hidden items-center gap-1 sm:flex">
              <button
                type="button"
                aria-label="이전 페이지"
                disabled={!canGoPrev}
                onClick={() => setDesktopPage(p => p - 1)}
                className="flex h-7 w-7 items-center justify-center rounded-pill border border-neutral-weak text-neutral-muted transition-opacity hover:opacity-70 disabled:opacity-70"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="다음 페이지"
                disabled={!canGoNext}
                onClick={() => setDesktopPage(p => p + 1)}
                className="flex h-7 w-7 items-center justify-center rounded-pill border border-neutral-weak text-neutral-muted transition-opacity hover:opacity-70 disabled:opacity-70"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 모바일: 세로 리스트(horizontal 카드) — 리스트 전체를 하나의 surface 카드로 감싸
          바깥 테두리+radius를 준다. `/polls`(PollListClient)의 리스트 래핑과 같은 처리 —
          이 컴포넌트를 새로 만들 때 빠뜨렸던 부분. */}
      <div className="overflow-hidden rounded-lg border border-neutral-weak bg-surface sm:hidden">
        <div className="divide-y divide-border">
          {mobileItems.map(poll => <PollCard key={poll.id} poll={poll} />)}
        </div>
      </div>
      {canShowMore && (
        <button
          type="button"
          onClick={() => setMobileVisible(v => v + MOBILE_STEP)}
          className="mt-3 w-full rounded-md border border-neutral-weak py-2.5 text-label-2 font-semibold text-neutral-muted transition-opacity hover:opacity-70 sm:hidden"
        >
          더보기
        </button>
      )}

      {/* 데스크탑: 2단(≥640px)/3단(≥1024px) 그리드(vertical 카드), 한 줄만 — 좌우 버튼으로 페이지 전환 */}
      <div className="hidden sm:grid sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {desktopItems.map(poll => <PollCard key={poll.id} poll={poll} variant="vertical" />)}
      </div>
    </section>
  )
}
