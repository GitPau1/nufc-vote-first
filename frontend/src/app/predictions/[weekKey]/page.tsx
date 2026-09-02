import { notFound } from 'next/navigation'
import { AppHeader } from '@/components/composition/common/AppHeader'
import { PredictionFlowClient } from '@/components/composition/predict/PredictionFlowClient'
import { PredictionResult } from '@/components/composition/predict/PredictionResult'
import { getFixturePositionTop3, getFixtureWeeks, type FixturePositionTop3 } from '@/lib/queries/fixtures'
import { findWeekPrediction, findWeekSession, submittableMatches } from '@/lib/predictions/week'
import { getPickCandidates } from '@/lib/queries/squads'
import { getMyPredictions, getMyResults, getWeekRanking } from '@/lib/queries/predictions'

export default async function PredictionFlowPage({ params }: { params: { weekKey: string } }) {
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

  // 남은(아직 안 잠긴) 경기 중 미제출이 있으면 그것만 입력받고, 없으면 완료 화면.
  const pending = submittableMatches(week).filter(match => !myPredictions[match.id])

  return (
    <>
      <AppHeader mobileBack />
      <main className="min-h-[calc(100vh-62px)] bg-page">
        <PredictionFlowClient
          week={week}
          pending={pending}
          candidates={candidates}
          submitted={pending.length === 0 ? findWeekPrediction(week, myPredictions) : undefined}
        />
      </main>
    </>
  )
}
