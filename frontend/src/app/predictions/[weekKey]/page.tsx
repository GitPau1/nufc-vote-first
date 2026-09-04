import { notFound } from 'next/navigation'
import { AppHeader } from '@/components/composition/common/AppHeader'
import { PredictionFlowClient } from '@/components/composition/predict/PredictionFlowClient'
import { PredictionMatchSelect } from '@/components/composition/predict/PredictionMatchSelect'
import { PredictionResult } from '@/components/composition/predict/PredictionResult'
import { getFixturePositionTop3, getFixtureWeeks, type FixturePositionTop3 } from '@/lib/queries/fixtures'
import { findWeekPrediction, findWeekSession, submittableMatches } from '@/lib/predictions/week'
import { getPickCandidates } from '@/lib/queries/squads'
import { getMyPredictions, getMyResults, getWeekRanking } from '@/lib/queries/predictions'

export default async function PredictionFlowPage({
  params,
  searchParams,
}: {
  params: { weekKey: string }
  /** edit=경기id(경기 단위 수정), editSelect=1(수정할 경기 선택 화면), match=경기id|'both'(제출 문맥 선택) */
  searchParams: { edit?: string; editSelect?: string; match?: string }
}) {
  const weeks = await getFixtureWeeks()
  const week = findWeekSession(weeks, decodeURIComponent(params.weekKey))

  // 아직 열리지 않은(예정) 주차는 보여줄 게 없다 — 오픈된 주차는 예측 플로우, 끝난 주차는 결과 화면.
  //
  // 'upcoming'에는 두 가지가 섞여 있다(week.ts의 weekStatus): 아직 안 열린 주차와, 킥오프이
  // 지났지만 fixtures.finished가 아직 적재되지 않은 주차. 후자를 막으면 경기가 끝난 새벽부터
  // 크론이 도는 아침까지 페이지가 사라진다 — 제출 내역을 확인하러 오는 시간대가 정확히 거기다.
  // 잠긴 경기가 하나도 없는 주차(= 정말 안 열린 주차)만 막는다.
  if (!week || (week.status === 'upcoming' && week.matches.every(match => !match.locked))) {
    notFound()
  }

  const [candidates, myPredictions] = await Promise.all([getPickCandidates(), getMyPredictions()])

  if (week.status === 'result') {
    // 랭킹은 참여 여부와 무관하게 공개된다 — 미참여 주차도 결과 화면으로 들어와 랭킹을 볼 수 있다.
    // 포지션별 평점 TOP3는 더블 매치위크면 경기마다 따로 조회해 fixture id(string) 키로 묶는다 —
    // results/predictions가 이미 fixture id 키 맵인 것과 같은 관례.
    const [results, ranking, top3PerMatch] = await Promise.all([
      getMyResults(),
      getWeekRanking(week.weekKey),
      Promise.all(week.matches.map(match => getFixturePositionTop3(Number(match.id)))),
    ])
    const topRatings: Record<string, FixturePositionTop3> = {}
    week.matches.forEach((match, i) => {
      topRatings[match.id] = top3PerMatch[i]
    })

    return (
      <>
        <AppHeader mobileBack />
        <main className="min-h-[calc(100vh-62px)] bg-page">
          <PredictionResult
            week={week}
            results={results}
            predictions={myPredictions}
            candidates={candidates}
            ranking={ranking}
            topRatings={topRatings}
          />
        </main>
      </>
    )
  }

  // 남은(아직 안 잠긴) 경기 중 미제출이 있으면 그것만 입력받고, 없으면 완료 허브.
  // findWeekPrediction은 부분 제출도 반영한다 — 이 주에 뭐라도 제출됐으면 truthy.
  const pending = submittableMatches(week).filter(match => !myPredictions[match.id])
  const prediction = findWeekPrediction(week, myPredictions)
  const submittedMatches = prediction ? week.matches.filter(match => prediction.scores[match.id]) : []
  // 제출된 경기 중 이미 킥오프돼 잠긴 경기는 수정 대상 선택 화면에서 뺀다(PredictionDone.tsx와 동일 규칙).
  const editableMatches = submittedMatches.filter(match => !match.locked)

  // 1) 경기 단위 수정 — 완료 허브의 "수정하기"(제출 1개) 또는 선택 화면에서 들어온다.
  const editTarget = searchParams.edit
    ? week.matches.find(match => match.id === searchParams.edit && !match.locked)
    : undefined
  const editExistingScore = editTarget && prediction?.scores[editTarget.id]

  // 2) 제출 문맥에서 경기를 이미 골랐음 — 매치 선택 화면 또는 완료 허브의 "지금 예측하기"에서 온다.
  const matchTargets = searchParams.match
    ? searchParams.match === 'both'
      ? pending
      : pending.filter(match => match.id === searchParams.match)
    : []

  let body: React.ReactNode
  if (editTarget && editExistingScore) {
    body = (
      <PredictionFlowClient
        // matchIds+mode로 키를 준다 — 같은 라우트에서 검색 파라미터만 바뀌는 클라이언트 내비게이션
        // (허브 ↔ 다른 경기 수정 ↔ 새 제출)마다 React가 리마운트하게 강제한다. key가 없으면
        // useState(scores/picks) 초기값이 최초 마운트 시점에 고정돼, 다른 경기로 다시 들어와도
        // initialValues가 무시되고 이전 세션 상태가 그대로 남는다("수정하기=초기화됨",
        // "제출 시 매번 incomplete"의 근본 원인, 2026-09-04 실사용 중 발견).
        key={`edit:${editTarget.id}`}
        week={week}
        pending={[editTarget]}
        candidates={candidates}
        matchIds={[editTarget.id]}
        mode="edit"
        initialValues={{ score: editExistingScore, picks: prediction!.picks[editTarget.id] }}
      />
    )
  } else if (searchParams.editSelect && editableMatches.length >= 2) {
    // 완료 허브의 "수정하기"(수정 가능한 제출 경기 2개 이상)에서 들어오는 수정 대상 선택 화면.
    body = <PredictionMatchSelect week={week} matches={editableMatches} mode="edit" prediction={prediction} />
  } else if (matchTargets.length > 0) {
    body = (
      <PredictionFlowClient
        key={`submit:${matchTargets.map(match => match.id).join(',')}`}
        week={week}
        pending={matchTargets}
        candidates={candidates}
        matchIds={matchTargets.map(match => match.id)}
        mode="submit"
      />
    )
  } else if (prediction) {
    // 이 주에 뭐라도 이미 제출됐으면 완료 허브(제출됨/유예됨/마감됨 3분류, PredictionDone).
    body = (
      <PredictionFlowClient
        key="done"
        week={week}
        pending={[]}
        candidates={candidates}
        matchIds={[]}
        submitted={prediction}
      />
    )
  } else if (pending.length > 1) {
    // 더블 매치위크에서 아무것도 제출 안 한 첫 진입 — 어느 경기부터 할지 고르는 화면.
    body = <PredictionMatchSelect week={week} matches={pending} mode="submit" />
  } else {
    // 싱글 매치위크(또는 더블 중 하나만 남음)는 선택 화면 없이 바로 그 경기 플로우로.
    body = (
      <PredictionFlowClient
        key={`submit:${pending.map(match => match.id).join(',')}`}
        week={week}
        pending={pending}
        candidates={candidates}
        matchIds={pending.map(match => match.id)}
        mode="submit"
      />
    )
  }

  return (
    <>
      <AppHeader mobileBack />
      <main className="min-h-[calc(100vh-62px)] bg-page">{body}</main>
    </>
  )
}
