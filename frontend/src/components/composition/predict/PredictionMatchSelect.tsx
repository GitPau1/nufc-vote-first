import Link from 'next/link'
import { TeamBadge } from './shared'
import { NUFC_LABEL, NUFC_TEAM_ID, teamLogoUrl, type MatchView, type WeekPrediction, type WeekSession } from '@/lib/predictions/week'

/**
 * 더블 매치위크에서 "어느 경기부터 할지" 고르는 화면 — 제출 문맥과 수정 문맥 공용
 * (feature-spec.md §3.5, 2026-09-04 사용자 승인 카피 그대로).
 *
 * - submit: 아직 안 낸 경기(`matches` = pending) 중 하나만 고르거나 "둘 다"를 고른다.
 *   "둘 다 예측하기" 버튼은 경기가 정확히 2개일 때만 보인다 — 3개 이상(트리플 매치위크)에
 *   대응하는 카피가 확정되지 않았다(근거 미확인, feature-spec §3.5).
 * - edit: 이미 낸 경기(`matches` = submittedMatches) 중 하나를 고른다. 수정은 항상 경기
 *   하나 단위라(design-brief §9 질문3=B) "둘 다 수정하기" 버튼은 없다.
 */
export function PredictionMatchSelect({
  week,
  matches,
  mode,
  prediction,
}: {
  week: WeekSession
  /** submit: pending 경기 목록(2개 이상). edit: submittedMatches 목록(2개 이상). */
  matches: MatchView[]
  mode: 'submit' | 'edit'
  /** edit 모드에서 각 경기 카드에 기존 제출 스코어를 같이 보여줄 때 쓴다 */
  prediction?: WeekPrediction
}) {
  const copy =
    mode === 'submit'
      ? {
          title: '어느 경기부터 예측할까요?',
          subtitle: '한 경기만 먼저 해도 되고, 둘 다 지금 해도 돼요',
        }
      : {
          title: '어느 경기를 수정할까요?',
          subtitle: '수정할 경기를 하나 골라주세요',
        }

  return (
    <div className="mx-auto max-w-[560px] px-4 pb-16 pt-6 sm:max-w-content sm:px-10">
      <div className="mb-6 text-center">
        <h1 className="text-headline-1 font-semibold text-neutral">{copy.title}</h1>
        <p className="mt-1 text-label-2 text-neutral-muted">{copy.subtitle}</p>
      </div>

      <div className="flex flex-col gap-3">
        {matches.map(match => (
          <MatchSelectCard key={match.id} week={week} match={match} mode={mode} prediction={prediction} />
        ))}
      </div>

      {mode === 'submit' && matches.length === 2 && (
        <Link
          href={`/predictions/${week.weekKey}?match=both`}
          className="mt-3 flex h-12 items-center justify-center rounded-lg border border-neutral-weak text-label-1-normal font-medium text-neutral"
        >
          둘 다 예측하기
        </Link>
      )}
    </div>
  )
}

function MatchSelectCard({
  week,
  match,
  mode,
  prediction,
}: {
  week: WeekSession
  match: MatchView
  mode: 'submit' | 'edit'
  prediction?: WeekPrediction
}) {
  const href =
    mode === 'submit'
      ? `/predictions/${week.weekKey}?match=${match.id}`
      : `/predictions/${week.weekKey}?edit=${match.id}`
  const buttonLabel = mode === 'submit' ? `${match.opponent}전만 하기` : `${match.opponent}전 수정하기`
  const existing = prediction?.scores[match.id]

  return (
    <div className="rounded-lg border border-neutral-weak bg-surface p-4">
      <div className="mb-3 flex items-center justify-center gap-4">
        <MatchSide logoUrl={teamLogoUrl(NUFC_TEAM_ID)} name={NUFC_LABEL} />
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-caption-2 text-neutral-muted">{match.kickoff}</span>
          <span className="text-label-1-normal font-medium text-neutral">{match.kickoffTime}</span>
        </div>
        <MatchSide logoUrl={teamLogoUrl(match.opponentId)} name={match.opponent} />
      </div>

      {existing && (
        <p className="mb-3 text-center text-caption-1 text-neutral-muted">
          현재 예측 {existing[0]} – {existing[1]}
        </p>
      )}

      <Link
        href={href}
        className="flex h-11 items-center justify-center rounded-md bg-brand-solid text-label-1-normal font-medium text-on-solid"
      >
        {buttonLabel}
      </Link>
    </div>
  )
}

function MatchSide({ logoUrl, name }: { logoUrl: string | null; name: string }) {
  return (
    <div className="flex w-[72px] flex-col items-center gap-1.5">
      <TeamBadge logoUrl={logoUrl} name={name} />
      <span className="truncate text-label-2 font-medium text-neutral-muted">{name}</span>
    </div>
  )
}
