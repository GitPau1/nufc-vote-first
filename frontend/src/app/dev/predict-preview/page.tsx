'use client'

import { useState } from 'react'
import { MatchWeekList, type PredictWeek } from '@/components/predict/MatchWeekList'
import { RankingCard, type RankingEntry } from '@/components/predict/RankingCard'
import { PlayerPickModal, type PlayerPickCandidate } from '@/components/predict/PlayerPickModal'

// 실제 데이터 연동 전, 컴포넌트들을 눈으로 확인하기 위한 임시 프리뷰 페이지.
// 승부예측 기능이 정식으로 붙으면 이 페이지는 지워도 된다.
//
// 클릭/예측 단위는 "주(week)"라서, 경기가 1개인 주/2개인 주(더블 매치위크) 각각에
// 미참여·참여(결과X)·참여(결과O)·진행중·예정 5가지 상태를 전부 만들어 확인한다.

const PLACEHOLDER_PHOTO = 'https://placehold.co/128x128/e1e7ef/666666?text=%20'

const WEEKS: PredictWeek[] = [
  // ── 경기 1개인 주 ──────────────────────────────────────────
  {
    weekNo: 30,
    status: 'result',
    matches: [{ id: 'w30', opponent: '맨체스터시티', isHome: false, kickoff: '6/28', kickoffTime: '오후 9:00', actual: [2, 1] }],
    // myResult 없음 = 미참여
  },
  {
    weekNo: 31,
    status: 'result',
    matches: [{ id: 'w31', opponent: '울버햄튼', isHome: true, kickoff: '7/5', kickoffTime: '오후 8:00', actual: [1, 1] }],
    myResult: { predicted: [[1, 0]] }, // 참여 - 결과 발표 전(totalPoints 없음)
  },
  {
    weekNo: 32,
    status: 'result',
    matches: [{ id: 'w32', opponent: '리버풀', isHome: true, kickoff: '7/12', kickoffTime: '오후 8:00', actual: [2, 0] }],
    myResult: { predicted: [[2, 1]], totalPoints: 7 }, // 참여 - 결과 발표됨
  },
  {
    weekNo: 33,
    status: 'open',
    matches: [{ id: 'w33', opponent: '아스날', isHome: false, kickoff: '7/19', kickoffTime: '오후 8:00' }],
  },
  {
    weekNo: 34,
    status: 'upcoming',
    matches: [{ id: 'w34', opponent: '토트넘', isHome: true, kickoff: '7/26', kickoffTime: '오후 9:00' }],
  },

  { weekNo: 35, status: 'upcoming', matches: [] }, // 경기 없는 주 엣지케이스

  // ── 경기 2개인 주 (더블 매치위크) — 두 경기 다 합쳐서 하나의 예측 세션 ──────────
  {
    weekNo: 36,
    status: 'result',
    matches: [
      { id: 'w36a', competition: '프리미어리그', opponent: '첼시', isHome: true, kickoff: '8/2', kickoffTime: '오후 9:00', actual: [1, 2] },
      { id: 'w36b', competition: '카라바오컵', opponent: '브렌트포드', isHome: false, kickoff: '8/5', kickoffTime: '오후 8:00', actual: [0, 0] },
    ],
    // myResult 없음 = 미참여
  },
  {
    weekNo: 37,
    status: 'result',
    matches: [
      { id: 'w37a', competition: '프리미어리그', opponent: '뉴캐슬 유나이티드 vs 브라이튼', isHome: true, kickoff: '8/9', kickoffTime: '오후 9:00', actual: [1, 1] },
      { id: 'w37b', competition: '카라바오컵', opponent: '루턴타운', isHome: true, kickoff: '8/12', kickoffTime: '오후 8:00', actual: [3, 0] },
    ],
    myResult: { predicted: [[1, 0], [2, 0]] }, // 참여 - 결과 발표 전
  },
  {
    weekNo: 38,
    status: 'result',
    matches: [
      { id: 'w38a', competition: '프리미어리그', opponent: '풀럼', isHome: false, kickoff: '8/16', kickoffTime: '오후 8:00', actual: [2, 1] },
      { id: 'w38b', competition: '카라바오컵', opponent: '입스위치', isHome: true, kickoff: '8/19', kickoffTime: '오후 8:00', actual: [4, 1] },
    ],
    myResult: { predicted: [[2, 0], [3, 1]], totalPoints: 10 }, // 참여 - 결과 발표됨 (합산 점수만)
  },
  {
    weekNo: 39,
    status: 'open',
    matches: [
      { id: 'w39a', competition: '프리미어리그', opponent: '에버튼', isHome: true, kickoff: '8/23', kickoffTime: '오후 8:00' },
      { id: 'w39b', competition: '카라바오컵', opponent: '왓포드', isHome: false, kickoff: '8/26', kickoffTime: '오후 8:00' },
    ],
  },
  {
    weekNo: 40,
    status: 'upcoming',
    matches: [
      { id: 'w40a', competition: '프리미어리그', opponent: '첼시', isHome: true, kickoff: '8/30', kickoffTime: '오후 9:00' },
      { id: 'w40b', competition: '카라바오컵', opponent: '브렌트포드', isHome: false, kickoff: '9/2', kickoffTime: '오후 8:00' },
    ],
  },
]

const NAME_POOL = ['김민준', '이서연', '정하윤', '박지훈', '최유진', '강태양', '윤소율', '임도현']

function buildLeaderboard(): RankingEntry[] {
  return Array.from({ length: 10 }, (_, i) => {
    const rank = i + 1
    const isMe = rank === 8
    return {
      rank,
      name: isMe ? '나' : NAME_POOL[i % NAME_POOL.length],
      totalPoints: Math.max(0, 62 - rank * 6),
      isMe,
      delta: isMe ? null : rank % 2 === 0 ? rank : -rank,
    }
  })
}

const MID_CANDIDATES: PlayerPickCandidate[] = [
  { id: 'mid-guimaraes', name: '기마랑이스', squadNumber: 39, photoUrl: PLACEHOLDER_PHOTO, nationality: '브라질', age: 28, multiplier: 1.7 },
  { id: 'mid-bruno', name: '브루노', squadNumber: 7, photoUrl: PLACEHOLDER_PHOTO, nationality: '포르투갈', age: 24, multiplier: 1.3 },
  { id: 'mid-willock', name: '윌록', squadNumber: 28, photoUrl: PLACEHOLDER_PHOTO, nationality: '잉글랜드', age: 26, multiplier: 1.5 },
]

export default function PredictPreviewPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const leaderboard = buildLeaderboard()

  return (
    <div className="mx-auto max-w-content px-4 py-8">
      <h1 className="mb-1 text-title-3 font-black">승부예측 컴포넌트 프리뷰</h1>
      <p className="mb-8 text-caption-1 text-neutral-muted">
        실데이터 연동 전 임시 확인용 페이지 — /dev/predict-preview
      </p>

      <div className="grid gap-10 sm:grid-cols-[2fr_1fr] sm:items-start">
        <MatchWeekList monthLabel="8월" weeks={WEEKS} onSelectWeek={w => alert(`클릭: ${w.weekNo}주차`)} />

        <div className="flex flex-col gap-4">
          <RankingCard variant="top3" entries={leaderboard} />
          <RankingCard variant="mine" entries={leaderboard} />
          <RankingCard variant="mine" entries={[]} />
        </div>
      </div>

      <hr className="my-10 border-neutral-weak" />

      <h2 className="mb-3 text-headline-1 font-bold">선수 픽 모달</h2>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="rounded-sm bg-brand-solid px-4 py-3 text-body-2-normal font-bold text-white"
      >
        미드필더 선택 모달 열기
      </button>

      <PlayerPickModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        positionLabel="미드필더"
        players={MID_CANDIDATES}
        selectedPlayerId={pickedId}
        onSelect={player => {
          setPickedId(player.id)
          setModalOpen(false)
        }}
      />
    </div>
  )
}
