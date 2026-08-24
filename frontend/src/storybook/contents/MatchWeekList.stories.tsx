import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { MatchWeekList, type PredictWeek, type PredictWeekMatch } from '@/components/composition/predict/MatchWeekList'

// 로고는 URL을 그대로 받는다(팀 ID가 아니다) — 안 넘기면 실루엣으로 떨어져서 양 팀이 똑같이
// 보이므로, 우리 팀 로고만 색을 달리해 좌우 배치를 눈으로 구분할 수 있게 한다.
// MatchdayHero처럼 FotMob 크레스트를 조립해주지는 않는다.
const OUR_LOGO = 'https://placehold.co/48x48/2a2f36/ffffff?text=NUFC'

// 상대 팀은 문자열로 그대로 받는다 — 실제 연동 시엔 부모가 lib/predict/team-names.ts의
// koreanTeamName(teamId, fallback)을 통과시킨 뒤 넘겨야 한다(여기 이름들은 그 매핑에 있는 팀).
function mockMatch(overrides: Partial<PredictWeekMatch>): PredictWeekMatch {
  return {
    id: 'm1',
    opponent: '리버풀',
    isHome: true,
    kickoff: '8/2',
    kickoffTime: '오후 8:00',
    // locked = 이 경기의 예측 마감(킥오프 지남), finished = 경기 종료. 둘은 별개다 —
    // 킥오프 직후 경기는 locked면서 아직 finished가 아니다.
    locked: false,
    finished: false,
    ...overrides,
  }
}

/** 종료된 경기 — 스코어가 있으면 locked·finished가 함께 켜져야 앞뒤가 맞는다. */
function finishedMatch(overrides: Partial<PredictWeekMatch> & { actual: [number, number] }): PredictWeekMatch {
  return mockMatch({ locked: true, finished: true, ...overrides })
}

function mockWeek(overrides: Partial<PredictWeek>): PredictWeek {
  const matches = overrides.matches ?? [mockMatch({})]
  return {
    weekNo: 33,
    // "2026-33" — 예측 세션 URL 파라미터(/predictions/{weekKey}).
    weekKey: `2026-${overrides.weekNo ?? 33}`,
    status: 'open',
    // submitted = 이 주차에 제출한 경기가 하나라도 있는지, hasPending = 아직 제출할 수 있는
    // 경기가 남았는지. 기본값은 mock 경기들의 myResult/locked에서 유도해 앞뒤를 맞춘다.
    submitted: matches.some(match => !!match.myResult),
    hasPending: matches.some(match => !match.locked && !match.myResult),
    matches,
    ...overrides,
  }
}

/**
 * 콜백 3개(onSelectWeek / onPrevMonth / onNextMonth)를 실제로 눌러볼 수 있게 감싼 래퍼.
 * 이 컴포넌트는 데이터를 소유하지 않는다 — 달 이동은 라벨만 바뀌고, 실제 앱에서는 부모가
 * 그 달의 `weeks`를 다시 받아 넘겨야 한다는 뜻이다(여기서 주차 목록이 안 바뀌는 게 정상).
 */
function InteractiveWeekList(props: React.ComponentProps<typeof MatchWeekList>) {
  const [monthOffset, setMonthOffset] = useState(0)
  const [picked, setPicked] = useState<PredictWeek | null>(null)

  const base = Number.parseInt(props.monthLabel, 10)
  const monthLabel = Number.isNaN(base) ? props.monthLabel : `${((base - 1 + monthOffset + 120) % 12) + 1}월`

  return (
    <div>
      <MatchWeekList
        {...props}
        monthLabel={monthLabel}
        onSelectWeek={setPicked}
        onPrevMonth={() => setMonthOffset(o => o - 1)}
        onNextMonth={() => setMonthOffset(o => o + 1)}
      />
      <p className="mt-4 text-caption-1 text-neutral-muted">
        {picked
          ? `선택: ${picked.weekNo}주차 (${picked.weekKey}, status=${picked.status}, 경기 ${picked.matches.length}개)`
          : '선택된 주차 없음 — 진행중/결과 주차만 눌린다(예정은 disabled)'}
      </p>
    </div>
  )
}

// 예측 목록은 모바일 폭이 기준이다(팀 84px×2 + 중앙 64px). 데스크탑 캔버스 그대로 두면 팀 배지가
// 가운데 뭉치고 좌우 여백만 늘어나 실제 화면과 달라진다.
const mobileWidth = { decorators: [(Story: () => React.JSX.Element) => <div style={{ maxWidth: 358 }}><Story /></div>] }

const meta = {
  title: 'Contents/MatchWeekList',
  component: MatchWeekList,
  ...mobileWidth,
  argTypes: {
    homeTeamName: { description: '우리 팀 이름(기본 "뉴캐슬"). isHome에 따라 좌/우 중 한쪽에 놓인다.' },
    homeTeamLogoUrl: { description: '매치마다 바뀌지 않으므로 리스트 단위로 한 번만 받는다.' },
  },
  args: {
    monthLabel: '8월',
    homeTeamLogoUrl: OUR_LOGO,
    weeks: [mockWeek({})],
  },
  // 모든 스토리를 실제로 눌러볼 수 있게 — 클릭 가능 여부(open/result만)가 이 컴포넌트의 핵심 규칙이다.
  render: args => <InteractiveWeekList {...args} />,
} satisfies Meta<typeof MatchWeekList>

export default meta
type Story = StoryObj<typeof meta>

/** 예측 접수 중 — `진행중` 배지 + "예측하기 ›". 클릭하면 예측 세션으로 들어간다. */
export const Open: Story = {
  args: {
    weeks: [mockWeek({ weekNo: 33, status: 'open', matches: [mockMatch({ id: 'w33', opponent: '아스날', isHome: false, kickoff: '7/19' })] })],
  },
}

/**
 * 제출을 끝낸 주차 — 아직 경기가 안 끝났어도 배지는 `진행중`이 아니라 `참여`다.
 * 남은 경기가 없으면(`hasPending: false`) 우측이 "예측하기"가 아니라 "제출완료 ›"로 바뀐다.
 */
export const Submitted: Story = {
  args: {
    weeks: [
      mockWeek({
        weekNo: 33,
        status: 'open',
        matches: [mockMatch({ id: 'w33s', opponent: '아스날', kickoff: '7/19', myResult: { predicted: [2, 1] } })],
      }),
    ],
  },
}

/**
 * 결과 발표 — 같은 `status: 'result'`인데 경기의 `myResult`에 따라 세 갈래로 갈린다.
 * 1) `myResult` 없음 → `미참여` 배지, 예측 줄 없음
 * 2) `predicted`만 → `참여` + "예측 1-0" (점수 집계 전)
 * 3) `totalPoints`까지 → 뒤에 "+7점"이 붙는다
 *
 * 미참여여도 버튼은 눌린다 — "예측을 안 했다"는 안내 자체가 결과 화면의 내용이라서다.
 * 세 경우 모두 킥오프 시각 대신 실제 스코어(`actual`)를 보여준다.
 */
export const Result: Story = {
  args: {
    weeks: [
      mockWeek({
        weekNo: 30,
        status: 'result',
        matches: [finishedMatch({ id: 'w30', opponent: '맨체스터시티', isHome: false, kickoff: '6/28', kickoffTime: '오후 9:00', actual: [2, 1] })],
      }),
      mockWeek({
        weekNo: 31,
        status: 'result',
        matches: [finishedMatch({ id: 'w31', opponent: '본머스', kickoff: '7/5', actual: [1, 1], myResult: { predicted: [1, 0] } })],
      }),
      mockWeek({
        weekNo: 32,
        status: 'result',
        matches: [finishedMatch({ id: 'w32', opponent: '리버풀', kickoff: '7/12', actual: [2, 0], myResult: { predicted: [2, 1], totalPoints: 7 } })],
      }),
    ],
  },
}

/**
 * 예측 오픈 전 — 자물쇠 아이콘 + `예정` 배지. 버튼이 `disabled`라 클릭·hover가 전부
 * 막히고 배경도 `bg-page`로 가라앉는다. 아래 상태 표시에 아무것도 안 잡히는 게 정상.
 */
export const Upcoming: Story = {
  args: {
    weeks: [mockWeek({ weekNo: 34, status: 'upcoming', matches: [mockMatch({ id: 'w34', opponent: '토트넘', kickoff: '7/26', kickoffTime: '오후 9:00' })] })],
  },
}

/**
 * 더블 매치위크 — 경기 2개가 카드 **하나**(= 예측 세션 하나)에 쌓인다. 단일 경기 주차와 달리
 * **배지가 카드 하단이 아니라 경기 행마다** 붙는다. 한 경기는 이미 끝났는데 다른 경기는 아직
 * 진행중일 수 있어서, 두 상태를 각각 보여줘야 하기 때문이다.
 * 점수도 세션 합산이 아니라 경기별로 붙는다.
 */
export const DoubleMatchWeek: Story = {
  args: {
    weeks: [
      mockWeek({
        weekNo: 39,
        status: 'open',
        matches: [
          mockMatch({ id: 'w39a', competition: '프리미어리그', opponent: '에버튼', kickoff: '8/23' }),
          mockMatch({ id: 'w39b', competition: '카라바오컵', opponent: '브렌트포드', isHome: false, kickoff: '8/26' }),
        ],
      }),
      mockWeek({
        weekNo: 38,
        status: 'result',
        matches: [
          finishedMatch({ id: 'w38a', competition: '프리미어리그', opponent: '풀럼', isHome: false, kickoff: '8/16', actual: [2, 1], myResult: { predicted: [1, 1], totalPoints: 3 } }),
          finishedMatch({ id: 'w38b', competition: '카라바오컵', opponent: '입스위치', kickoff: '8/19', actual: [4, 1] }),
        ],
      }),
    ],
  },
}

/**
 * 부분 제출 — 더블 매치위크에서 첫 경기는 이미 킥오프가 지나 잠기고(`locked`) 둘째 경기만
 * 남은 상태. 주차가 `submitted`이면서 동시에 `hasPending`이라, 우측 CTA가 "예측하기"가 아니라
 * **"남은 경기 예측하기 ›"**가 된다. 세션이 주차 단위여도 제출은 경기 단위로 쌓인다는 뜻이다.
 */
export const PartiallySubmitted: Story = {
  args: {
    weeks: [
      mockWeek({
        weekNo: 40,
        status: 'open',
        matches: [
          mockMatch({ id: 'w40a', competition: '프리미어리그', opponent: '첼시', kickoff: '8/30', locked: true, myResult: { predicted: [1, 2] } }),
          mockMatch({ id: 'w40b', competition: '카라바오컵', opponent: '브라이튼', isHome: false, kickoff: '9/2' }),
        ],
      }),
    ],
  },
}

/**
 * `isHome`이 좌우 배치를 바꾼다 — 좌측은 항상 홈이라, 원정 경기(`isHome: false`)는 우리 팀이
 * 우측으로 간다. `actual`은 `isHome`과 무관하게 항상 [홈, 원정] 순서라서, 아래 원정 경기의
 * "1 – 3"은 상대가 1, 우리가 3이다(좌측=상대). 이 순서를 헷갈리면 결과가 반대로 보인다.
 */
export const HomeAndAway: Story = {
  args: {
    weeks: [
      mockWeek({ weekNo: 32, status: 'result', matches: [finishedMatch({ id: 'h', opponent: '리버풀', isHome: true, kickoff: '7/12', actual: [2, 0] })] }),
      mockWeek({ weekNo: 33, status: 'result', matches: [finishedMatch({ id: 'a', opponent: '리버풀', isHome: false, kickoff: '7/19', actual: [1, 3] })] }),
    ],
  },
}

/** 경기 없는 주 — 카드가 아니라 안내 박스로 대체된다(버튼 자체가 렌더되지 않아 배지·자물쇠도 없다). */
export const NoMatches: Story = {
  args: {
    weeks: [mockWeek({ weekNo: 35, status: 'upcoming', matches: [] })],
  },
}

/**
 * 실제 목록 — 한 달 안에 결과·진행중·예정·경기 없는 주가 섞인다.
 * 상태별 스토리에서 못 보이는 것 두 가지를 여기서 본다: 주차마다 55ms씩 밀리는 `animate-enter`
 * 순차 등장, 그리고 위→아래로 "결과 → 진행중 → 예정"으로 흐르는 시간 순서.
 */
export const FullMonth: Story = {
  args: {
    weeks: [
      mockWeek({
        weekNo: 36,
        status: 'result',
        matches: [
          finishedMatch({ id: 'w36a', competition: '프리미어리그', opponent: '첼시', kickoff: '8/2', actual: [1, 2] }),
          finishedMatch({ id: 'w36b', competition: '카라바오컵', opponent: '브렌트포드', isHome: false, kickoff: '8/5', actual: [0, 0] }),
        ],
      }),
      mockWeek({
        weekNo: 37,
        status: 'result',
        matches: [finishedMatch({ id: 'w37', opponent: '브라이튼', kickoff: '8/9', actual: [1, 1], myResult: { predicted: [1, 0] } })],
      }),
      mockWeek({
        weekNo: 38,
        status: 'result',
        matches: [finishedMatch({ id: 'w38', opponent: '풀럼', isHome: false, kickoff: '8/16', actual: [2, 1], myResult: { predicted: [2, 1], totalPoints: 10 } })],
      }),
      mockWeek({
        weekNo: 39,
        status: 'open',
        matches: [mockMatch({ id: 'w39', opponent: '에버튼', kickoff: '8/23' })],
      }),
      mockWeek({ weekNo: 40, status: 'upcoming', matches: [mockMatch({ id: 'w40', opponent: '토트넘', kickoff: '8/30', kickoffTime: '오후 9:00' })] }),
      mockWeek({ weekNo: 41, status: 'upcoming', matches: [] }),
    ],
  },
}
