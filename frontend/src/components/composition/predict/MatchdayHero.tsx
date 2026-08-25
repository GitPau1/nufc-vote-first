'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/primitives/button'
import { Badge } from '@/components/primitives/badge'
import { teamLogoUrl } from '@/lib/predictions/week'
import type { MatchdayFixture, MatchdayRatedPlayer, MatchdayPositionLeader } from '@/lib/queries/fixtures'

/**
 * 홈 히어로 — `fixtures` 테이블(FotMob 동기화) 한 건을 받아 다음/최근 경기를 보여주고
 * "승부예측 하러 가기"로 유도한다. `PollHeroCard`를 완전히 대체하는 자리다.
 * 킥오프 24시간 전부터만 뜬다 — 그 전엔 lib/queries/fixtures.ts가 null을 돌려줘서
 * HomeClient가 예전 방식(투표 배너)으로 대체한다.
 *
 * 타입 정의는 `lib/queries/fixtures.ts`가 갖고 있다(polls.ts/PollListItem과 같은 관례) —
 * 여기서는 재수출만 해서 기존 임포트 지점을 안 건드린다.
 * home_id/away_id는 FotMob 팀 ID고, 엠블럼 파일명이 그 id라 `teamLogoUrl`로 Storage 주소를
 * 그대로 조립한다(별도 로고 테이블/매핑 불필요).
 */
export type { MatchdayFixture }

function formatKickoff(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** 초 단위로 째깍이는 카운트다운. 마감(diff<=0) 이후엔 계속 0으로 고정. */
function useCountdown(targetIso: string) {
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // 서버 렌더 시점엔 now가 없어 hydration mismatch가 나므로, 마운트 전엔 null을 돌려준다.
  if (now === null) return null

  const diff = Math.max(0, new Date(targetIso).getTime() - now)
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1000),
    done: diff <= 0,
  }
}

/**
 * align="end"(홈)/"start"(원정)로 VS 쪽 가장자리에 붙인다. grid-cols-[1fr_auto_1fr]와 짝을 이루는
 * 부분 — 컬럼 폭 자체(1fr)는 그대로 좌우 대칭이라 VS는 항상 정중앙에 남고, 카드가 넓어져도
 * 팀 배지만 VS에 가깝게 붙어서 "화면이 넓어지면 VS에서 너무 멀어지는" 문제가 없다.
 *
 * 너비도 팀명 길이와 무관하게 고정(w-[88px])이다 — 폭을 컨텐츠에 맡기면(hug) 짧은 팀명은
 * 엠블럼 너비(44px)만큼만 차지하고 긴 팀명은 truncate 한도(88px)까지 차지해서, 양쪽 박스
 * 너비가 서로 달라지고 그 안에서 items-center로 가운데 정렬된 엠블럼도 VS로부터 서로 다른
 * 거리에 놓인다(시각적 무게 비대칭). 두 박스를 같은 너비로 고정해야 엠블럼이 항상 VS로부터
 * 같은 거리에 온다.
 */
function TeamBadge({ id, name, align }: { id: number; name: string; align: 'start' | 'end' }) {
  const logoUrl = teamLogoUrl(id)
  return (
    <div
      className={`flex w-[88px] flex-col items-center gap-1.5 ${align === 'end' ? 'justify-self-end' : 'justify-self-start'}`}
    >
      {logoUrl && <img src={logoUrl} alt="" className="h-11 w-11 object-contain" />}
      <p className="max-w-[88px] truncate text-caption-1 font-semibold text-on-solid">{name}</p>
    </div>
  )
}

function CountdownBox({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex w-14 flex-col items-center gap-0.5 rounded-sm bg-on-solid-strong py-1.5">
      <p className="text-headline-1 font-black tabular-nums text-on-solid">{String(value).padStart(2, '0')}</p>
      <p className="text-caption-2 text-on-solid-muted">{label}</p>
    </div>
  )
}

/**
 * 평점 카드 한 장 — 가로형(사진 | 라벨·이름 | 평점). 기존 최우수 선수 카드와 같은 anatomy다.
 * variant="award"는 셋 중 최고 평점 카드 전용으로, 다크 카드 위에 골드 배경(.award-gold)을
 * 깔고 그 위엔 어두운 텍스트(text-neutral*)를 올린다(대비 AA).
 */
function RatingCard({
  player,
  label,
  variant = 'default',
}: {
  player: MatchdayRatedPlayer
  label: string
  variant?: 'default' | 'award'
}) {
  const isAward = variant === 'award'
  return (
    <div
      className={`flex items-center gap-3 rounded-lg p-3 md:flex-1 ${
        isAward ? 'award-gold' : 'bg-on-solid-weak'
      }`}
    >
      <div
        className={`h-11 w-11 shrink-0 overflow-hidden rounded-pill ${
          isAward ? 'bg-warning-weak' : 'bg-on-solid-strong'
        }`}
      >
        {player.photoUrl && <img src={player.photoUrl} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-caption-2 ${isAward ? 'text-neutral-strong' : 'text-on-solid-muted'}`}>{label}</p>
        <p className={`truncate text-label-1-normal font-bold ${isAward ? 'text-neutral' : 'text-on-solid'}`}>
          {player.name}
        </p>
      </div>
      <p className={`text-headline-1 font-black tabular-nums ${isAward ? 'text-neutral' : 'text-on-solid'}`}>
        {player.rating.toFixed(1)}
      </p>
    </div>
  )
}

/**
 * 포지션별(수비수·미드필더·공격수) 최고 평점 선수를 나열한다. 셋 중 평점이 가장 높은 한 장을
 * 골드(.award-gold)로 강조한다 — 동점이면 표시 순서(수비수→미드필더→공격수)상 먼저 나오는
 * 카드만 골드로 준다. 데스크탑(md~)은 가로로 나란히 화면을 넓게 쓰고, 모바일은 세로로 쌓는다.
 * 평점이 없는 포지션 카드는 생략한다.
 */
function MatchRatingsRow({ fixture }: { fixture: MatchdayFixture }) {
  const leaders = (
    [
      fixture.topDefender && { player: fixture.topDefender, label: '수비수' },
      fixture.topMidfielder && { player: fixture.topMidfielder, label: '미드필더' },
      fixture.topForward && { player: fixture.topForward, label: '공격수' },
    ] as ({ player: MatchdayPositionLeader; label: string } | null | undefined)[]
  ).filter(Boolean) as { player: MatchdayPositionLeader; label: string }[]

  if (leaders.length === 0) return null

  const topRating = Math.max(...leaders.map((l) => l.player.rating))
  let goldGiven = false

  return (
    <div className="mt-4 flex flex-col gap-2 md:flex-row">
      {leaders.map(({ player, label }) => {
        const isTop = !goldGiven && player.rating === topRating
        if (isTop) goldGiven = true
        return <RatingCard key={label} player={player} label={label} variant={isTop ? 'award' : 'default'} />
      })}
    </div>
  )
}

export function MatchdayHero({ fixture, href }: { fixture: MatchdayFixture; href?: string }) {
  const countdown = useCountdown(fixture.kickoffAt)
  const isUpcoming = !fixture.started && !fixture.finished
  const isLive = fixture.started && !fixture.finished
  // 경기 결과 표기는 score_str이 기준이다(FotMob 표시용 문자열) — home/away_score 조합은
  // 승부차기 경기에서 승부차기 스코어가 들어있을 수 있어 믿지 않는다. score_str이 아예 없을
  // 때만(동기화 지연 등) home/away_score 조합으로 대체한다.
  const displayScore =
    fixture.scoreStr ??
    (fixture.finished && fixture.homeScore !== null && fixture.awayScore !== null
      ? `${fixture.homeScore}–${fixture.awayScore}`
      : null)
  // /predictions/[weekKey] — 승부예측 세션 화면(main 병합으로 이 브랜치에 존재한다).
  const targetHref = href ?? `/predictions/${fixture.weekKey}`

  return (
    <div className="spotlight-glow-brand-strong relative overflow-hidden rounded-lg px-4 pb-4 pt-5">
      {fixture.competitionName && (
        <p className="text-center text-caption-2 font-semibold text-on-solid-muted">
          {fixture.competitionName}
        </p>
      )}

      {/* 팀명 길이가 서로 달라도(예: "뉴캐슬" vs "웨스트브롬위치") VS/스코어가 항상 카드 정중앙에
          오도록 좌우를 flex 대신 동일 폭(1fr) grid 컬럼으로 고정한다 — flex justify-center는
          내용 전체 블록을 가운데 정렬할 뿐, 좌우 폭이 다르면 가운데 마커가 어느 한쪽으로 쏠린다. */}
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <TeamBadge id={fixture.homeId} name={fixture.homeName} align="end" />
        <div className="flex flex-col items-center gap-0.5">
          {fixture.shootoutScore && (
            <p className="text-caption-2 text-on-solid-muted">승부차기({fixture.shootoutScore})</p>
          )}
          {displayScore ? (
            <p className="text-title-3 font-black tabular-nums text-on-solid">{displayScore}</p>
          ) : (
            <p className="text-headline-1 font-bold text-on-solid-muted">{fixture.finished ? '종료' : 'VS'}</p>
          )}
        </div>
        <TeamBadge id={fixture.awayId} name={fixture.awayName} align="start" />
      </div>

      <p className="mt-3 text-center text-caption-1 text-on-solid-muted">{formatKickoff(fixture.kickoffAt)}</p>

      {isUpcoming && countdown && !countdown.done && (
        <div className="mt-3 flex justify-center gap-2">
          <CountdownBox value={countdown.days} label="일" />
          <CountdownBox value={countdown.hours} label="시간" />
          <CountdownBox value={countdown.minutes} label="분" />
          <CountdownBox value={countdown.seconds} label="초" />
        </div>
      )}

      {isLive && (
        <div className="mt-3 flex justify-center">
          <Badge variant="destructive">진행 중</Badge>
        </div>
      )}

      {fixture.finished && <MatchRatingsRow fixture={fixture} />}

      {/* 예측 제출은 킥오프 전까지만 가능하다 — 진행중/종료 둘 다 이미 잠긴 상태라 버튼을 아예 없앤다.
          킥오프를 기다리는 중(isUpcoming)일 때만 보여준다. */}
      {isUpcoming && (
        <div className="mt-4 flex justify-center">
          <Button asChild size="lg" className="w-52">
            {/* 홈 히어로에 하나뿐인 주 CTA다 — 목록 반복 링크(PollCard)나 상시 네비(BottomNav)와 달리
                클릭 확률이 높아 prefetch를 켜둔다(라우트는 이제 존재). prefetch-policy 테스트 대상 아님. */}
            <Link href={targetHref}>승부예측 하러 가기</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
