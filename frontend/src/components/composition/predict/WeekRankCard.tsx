'use client'

import { useState } from 'react'
import { User } from 'lucide-react'
import type { RankingRow } from '@/lib/queries/predictions'
import { cn } from '@/lib/utils'

/** 데스크탑은 10명까지만 보여주고 "전체보기"로 펼친다(퍼블리싱 `WEEK_RANK_CAP`). */
const DESKTOP_CAP = 10

/**
 * 주차 랭킹 카드 — 결과 화면 "전체 결과". 시즌 누적 랭킹(`RankingCard`)과 달리 예측/선수픽/종합
 * 3컬럼이고, 참여자 전체를 펼쳐볼 수 있다.
 *
 * 자르는 방식이 화면 폭에 따라 다르다(퍼블리싱 `resultRankCardHtml`):
 * - 데스크탑(`capped`): 10명까지만 그리고, 내 순위가 10위 밖이면 `⋯` 뒤에 내 행을 따로 붙인다.
 * - 모바일: 전체 행을 다 그린 뒤 CSS max-height로 기기 화면 높이만큼만 노출한다(하단 페이드).
 */
export function WeekRankCard({
  weekNo,
  entries,
  capped = false,
  className,
}: {
  weekNo: number
  entries: RankingRow[]
  capped?: boolean
  className?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const overLimit = entries.length > DESKTOP_CAP

  let rows = entries
  let myRowBelow: RankingRow | undefined
  if (capped && !expanded && overLimit) {
    rows = entries.slice(0, DESKTOP_CAP)
    const me = entries.find(entry => entry.isMe)
    if (me && !rows.includes(me)) myRowBelow = me
  }

  return (
    <div className={cn('rounded-lg border border-neutral-weak bg-surface p-4 text-left', className)}>
      <p className="mb-3 text-body-2-normal font-bold text-neutral">{weekNo}주차 랭킹</p>

      {entries.length === 0 ? (
        <p className="text-caption-1 text-neutral-muted">아직 이 주차에 채점된 예측이 없어요</p>
      ) : (
        <>
          <div
            className={cn(
              'relative',
              // 모바일은 기기 화면 높이만큼만 — 잘린 아래쪽은 페이드로 "더 있음"을 암시한다.
              !capped && !expanded && 'max-h-[46vh] overflow-hidden',
              !capped && !expanded && overLimit &&
                'after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-10 after:bg-gradient-to-b after:from-transparent after:to-surface',
            )}
          >
            <HeaderRow />
            {rows.map(entry => (
              <RankRow key={entry.userId} entry={entry} />
            ))}
            {myRowBelow && (
              <>
                <div className="py-1 text-center text-label-2 text-neutral-subtle">⋯</div>
                <RankRow entry={myRowBelow} />
              </>
            )}
          </div>

          {!expanded && overLimit && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mt-3 flex w-full items-center justify-center rounded-md border border-neutral-weak p-2.5 text-label-2 font-bold text-neutral-muted transition-colors duration-micro hover:border-neutral-strong"
            >
              전체보기 · {entries.length}명
            </button>
          )}
        </>
      )}
    </div>
  )
}

function HeaderRow() {
  return (
    <div className="sticky top-0 z-[1] flex items-center gap-2 bg-surface px-1 pb-2.5">
      <span className="w-8 shrink-0 text-center text-caption-2 font-bold text-neutral-muted">순위</span>
      <span className="h-7 w-7 shrink-0" />
      <span className="min-w-0 flex-1" />
      <span className="w-[42px] shrink-0 text-center text-caption-2 font-bold text-neutral-muted">예측</span>
      <span className="w-[42px] shrink-0 text-center text-caption-2 font-bold text-neutral-muted">선수픽</span>
      <span className="w-12 shrink-0 text-center text-caption-2 font-bold text-neutral-muted">종합</span>
    </div>
  )
}

function RankRow({ entry }: { entry: RankingRow }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 border-b border-neutral-weak px-1 py-2.5 last:border-b-0',
        entry.isMe && 'rounded-md border-b-0 bg-brand-weak px-2',
      )}
    >
      <span
        className={cn(
          'w-8 shrink-0 text-center text-body-1-normal font-black text-neutral',
          entry.isMe && 'text-brand',
        )}
      >
        {entry.rank}
      </span>

      <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-pill bg-disabled text-neutral-subtle">
        {entry.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entry.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <User className="h-3.5 w-3.5" />
        )}
      </span>

      <span className="min-w-0 flex-1 truncate text-label-2 font-bold text-neutral">{entry.name}</span>

      <span className="w-[42px] shrink-0 text-center text-body-2-normal font-semibold text-neutral-muted">
        {entry.matchPoints ?? 0}
      </span>
      <span className="w-[42px] shrink-0 text-center text-body-2-normal font-semibold text-neutral-muted">
        {entry.pickPoints ?? 0}
      </span>
      {/* 옛 시스템은 isMe만 더 밝은 primary였는데, 새 brand 앵커는 배경·텍스트가 하나로
          합쳐져(Foundations/Color) 두 분기가 같은 text-brand가 된다 — 분기를 없앴다. */}
      <span className="w-12 shrink-0 text-center text-body-2-normal font-black text-brand">
        {entry.totalPoints}
      </span>
    </div>
  )
}
