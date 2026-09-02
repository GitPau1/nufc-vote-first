'use client'

import { useState } from 'react'
import { User } from 'lucide-react'
import type { RankingRow } from '@/lib/queries/predictions'
import { cn } from '@/lib/utils'

/** 모바일/데스크탑 공통 캡 — 여기까지만 그리고 "더보기"로 펼친다(퍼블리싱 `WEEK_RANK_CAP`). */
const DESKTOP_CAP = 10

/**
 * 주차 랭킹 테이블 — 결과 화면 피날레(다크 카드) 안에 얹힌다. 시즌 누적 랭킹(`RankingCard`)과
 * 달리 예측/선수픽/종합 3컬럼이고, 참여자 전체를 펼쳐볼 수 있다.
 *
 * 자체 카드 컨테이너(배경·테두리)는 없다 — 이 컴포넌트를 감싸는 피날레의 `spotlight-glow-brand-strong`
 * 다크 카드 위에 투명하게 얹히므로, 색 토큰은 전부 온솔리드 계열이다.
 *
 * 자르는 방식은 모바일/데스크탑 공통이다: `DESKTOP_CAP`까지만 그리고, 내 순위가 그 밖이면
 * `⋯` 뒤에 내 행을 따로 붙인 채로 "더보기" 버튼을 보여준다(시안-v9.html 카피 "더보기 ▾").
 * 예전에는 모바일이 `capped=false`로 전체 행을 그린 뒤 `max-h-[46vh]` 페이드로 잘랐는데,
 * 새 결과 화면은 모바일/데스크탑 레이아웃이 동일해 화면 폭별 분기 자체가 필요 없어졌다.
 */
export function WeekRankCard({
  weekNo,
  entries,
  className,
}: {
  weekNo: number
  entries: RankingRow[]
  className?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const overLimit = entries.length > DESKTOP_CAP

  let rows = entries
  let myRowBelow: RankingRow | undefined
  if (!expanded && overLimit) {
    rows = entries.slice(0, DESKTOP_CAP)
    const me = entries.find(entry => entry.isMe)
    if (me && !rows.includes(me)) myRowBelow = me
  }

  return (
    <div className={cn('text-left', className)}>
      <p className="mb-3 text-headline-1 font-semibold text-on-solid">{weekNo}주차 랭킹</p>

      {entries.length === 0 ? (
        <p className="text-caption-1 text-on-solid-muted">아직 이 주차에 채점된 예측이 없어요</p>
      ) : (
        <>
          <HeaderRow />
          {rows.map(entry => (
            <RankRow key={entry.userId} entry={entry} />
          ))}
          {myRowBelow && (
            <>
              <div className="py-1 text-center text-label-2 text-on-solid-muted">⋯</div>
              <RankRow entry={myRowBelow} />
            </>
          )}

          {!expanded && overLimit && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mt-1.5 flex w-full items-center justify-center border-t border-on-solid-weak pb-0.5 pt-2.5 text-label-2 text-on-solid-muted"
            >
              더보기 ▾
            </button>
          )}
        </>
      )}
    </div>
  )
}

function HeaderRow() {
  return (
    <div className="flex items-center gap-2 px-1 pb-2">
      <span className="w-8 shrink-0 text-center text-caption-2 font-medium text-on-solid-muted">순위</span>
      <span className="h-7 w-7 shrink-0" />
      <span className="min-w-0 flex-1" />
      <span className="w-[42px] shrink-0 text-center text-caption-2 font-medium text-on-solid-muted">예측</span>
      <span className="w-[42px] shrink-0 text-center text-caption-2 font-medium text-on-solid-muted">선수픽</span>
      <span className="w-12 shrink-0 text-center text-caption-2 font-medium text-on-solid-muted">종합</span>
    </div>
  )
}

function RankRow({ entry }: { entry: RankingRow }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 border-t border-on-solid-weak px-1 py-3 first:border-t-0',
        entry.isMe && 'rounded-md border-t-0 bg-on-solid-strong px-2',
      )}
    >
      <span
        className={cn(
          'w-8 shrink-0 text-center text-body-1-normal font-semibold text-on-solid',
          entry.isMe && 'text-on-solid-brand',
        )}
      >
        {entry.rank}
      </span>

      <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-pill bg-on-solid-strong text-on-solid-muted">
        {entry.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entry.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <User className="h-3.5 w-3.5" />
        )}
      </span>

      <span className="min-w-0 flex-1 truncate text-label-1-normal font-medium text-on-solid">{entry.name}</span>

      <span className="w-[42px] shrink-0 text-center text-body-2-normal font-semibold text-on-solid-muted">
        {entry.matchPoints ?? 0}
      </span>
      <span className="w-[42px] shrink-0 text-center text-body-2-normal font-semibold text-on-solid-muted">
        {entry.pickPoints ?? 0}
      </span>
      {/* 옛 시스템은 isMe만 더 밝은 primary였는데, 새 brand 앵커는 배경·텍스트가 하나로
          합쳐져(Foundations/Color) 두 분기가 같은 색이 된다 — 분기를 없앴다. 다크 면 전용
          강조색(text-on-solid-brand)은 라이트의 text-brand와 다른 토큰이다. */}
      <span className="w-12 shrink-0 text-center text-body-2-normal font-semibold text-on-solid-brand">
        {entry.totalPoints}
      </span>
    </div>
  )
}
