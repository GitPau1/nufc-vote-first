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
    kickoff: '8월 2일',
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
          : '선택된 주차 없음 — 컨테이너가 아니라 하단 CTA 버튼만 진입점이다(예정 주차와 미참여 마감 주차는 disabled)'}
      </p>
    </div>
  )
}

// 예측 목록은 모바일 폭이 기준이다. 팀 칸은 고정폭이 아니라 그리드 트랙 `minmax(0,1fr)`이고
// 안에서 가운데 쪽으로 붙으므로(MatchWeekList.tsx:336, :426-430), 데스크탑 캔버스 그대로 두면
// 로고·팀명이 가운데로 뭉치고 좌우 여백만 늘어나 실제 화면과 달라진다.
// 넓은 폭에서 어떻게 보이는지는 아래 DesktopWidth 하나로 따로 본다.
const mobileWidth = { decorators: [(Story: () => React.JSX.Element) => <div style={{ maxWidth: 358 }}><Story /></div>] }

const meta = {
  title: 'Composition/Predict/MatchWeekList',
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
  // 모든 스토리에서 하단 CTA를 실제로 눌러볼 수 있게 — 진입점이 컨테이너가 아니라 그 버튼
  // 하나이고, 어느 단계에서 눌리는지(weekAction)가 이 컴포넌트의 핵심 규칙이다.
  render: args => <InteractiveWeekList {...args} />,
} satisfies Meta<typeof MatchWeekList>

export default meta
type Story = StoryObj<typeof meta>

/**
 * 진행중 — 제출할 경기가 남은 주차. 배지 `진행중` + "예측하기" 버튼.
 *
 * `weekPhase === 'open'`이므로 **주차 컨테이너에 라이트 브랜드 글로우가 붙는다** —
 * `.spotlight-glow-brand`(globals.css:178-204 — 위에서 내려오는 세로 linear 한 겹,
 * `--p-blue-700` 8%로 시작해 컨테이너 높이의 25%에서 소멸). 스톱이 퍼센트라 경기 카드
 * 수로 높이가 변해도 물드는 비율이 같고, 25%에서 끊어 아래쪽 경기 카드에는 틴트가
 * 걸리지 않는다. 위치로 끌어올리는 대신 색으로 강조하는
 * 방식이라, 예측 접수 중인 주차는 목록 어디에 있어도 이 색으로 찾을 수 있다.
 * 글로우가 가르는 건 **컨테이너 배경 하나뿐**이다 — 테두리(`border border-neutral-weak`)도,
 * 안쪽 경기 카드 표면(`bg-page`)도, 텍스트·구분선·CTA도 흰 컨테이너와 같은 토큰이다.
 * 글로우 베이스 자체가 `bg-surface`(흰색)라 안쪽 표면을 뒤집는 예외가 필요 없다.
 */
export const Open: Story = {
  args: {
    weeks: [mockWeek({ weekNo: 33, status: 'open', matches: [mockMatch({ id: 'w33', opponent: '아스날', isHome: false, kickoff: '7월 19일' })] })],
  },
}

/**
 * 참여 완료 — 제출 가능한 경기를 다 제출한 주차. 경기는 아직 안 끝났고 CTA 문구는 "내 예측 보기"다.
 * 이 주차도 `weekPhase === 'open'`이라 **글로우 컨테이너**다 — 글로우는 "참여할 수 있는 상태"가
 * 아니라 "예측 접수 중인 주차"를 뜻하므로 `진행중`·`참여 완료` 둘 다 포함한다(MatchWeekList.tsx:220).
 * CTA는 `weekAction`이 정한 outline 그대로 렌더된다.
 */
export const Submitted: Story = {
  args: {
    weeks: [
      mockWeek({
        weekNo: 33,
        status: 'open',
        matches: [mockMatch({ id: 'w33s', opponent: '아스날', kickoff: '7월 19일', myResult: { predicted: [2, 1] } })],
      }),
    ],
  },
}

/**
 * 부분 제출 — 첫 경기는 킥오프가 지나 잠기고(`locked`) 둘째 경기만 남은 상태.
 * `submitted`이면서 동시에 `hasPending`이라 배지는 `진행중`, CTA는 미제출 주차와 같은 "예측하기"다.
 * 이 주차도 `open`이라 컨테이너에 글로우가 붙는다.
 *
 * 잠긴 첫 경기와 남은 둘째 경기의 **카드 배경은 같다**(컨테이너 종류와도 무관하게 둘 다 `bg-page`).
 * 잠긴 쪽은 **팀명과 킥오프 시각 톤만** `text-neutral-muted`로 내려간다(MatchWeekList.tsx:341,
 * :369, :359) — 대회명·일자는 `dimmed`와 무관하게 늘 muted다(:323, :353). 로고 흑백은 `finished`
 * 전용이라 여기선 아직 안 걸린다.
 */
export const PartiallySubmitted: Story = {
  args: {
    weeks: [
      mockWeek({
        weekNo: 40,
        status: 'open',
        matches: [
          mockMatch({ id: 'w40a', competition: '프리미어리그', opponent: '첼시', kickoff: '8월 30일', locked: true, myResult: { predicted: [1, 2] } }),
          mockMatch({ id: 'w40b', competition: '카라바오컵', opponent: '브라이튼', isHome: false, kickoff: '9월 2일' }),
        ],
      }),
    ],
  },
}

/**
 * 결과 반영중 — 킥오프는 지났는데 `finished`가 아직 안 적재된 주차(`status: 'upcoming'`인데
 * 경기가 `locked`). 참여자는 "내 예측 보기"로 들어갈 수 있고, 미참여자는 "예측 마감"으로 막힌다.
 */
export const Settling: Story = {
  args: {
    weeks: [
      mockWeek({
        weekNo: 34,
        status: 'upcoming',
        matches: [mockMatch({ id: 'w34p', opponent: '리버풀', kickoff: '8월 24일', locked: true, myResult: { predicted: [2, 1] } })],
      }),
      mockWeek({
        weekNo: 34,
        weekKey: '2026-34-none',
        status: 'upcoming',
        matches: [mockMatch({ id: 'w34n', opponent: '리버풀', kickoff: '8월 24일', locked: true })],
      }),
    ],
  },
}

/**
 * 종료 — 그 주 경기가 다 끝난 주차. 배지는 참여 여부와 무관하게 `종료` 하나이고,
 * 참여 여부는 카드 아래 "예측 2-1 · +7점" 유무로만 드러난다. 로고는 흑백이 된다.
 */
export const Result: Story = {
  args: {
    weeks: [
      mockWeek({
        weekNo: 30,
        status: 'result',
        matches: [finishedMatch({ id: 'w30', opponent: '맨체스터시티', isHome: false, kickoff: '6월 28일', kickoffTime: '오후 9:00', actual: [2, 1] })],
      }),
      mockWeek({
        weekNo: 32,
        status: 'result',
        matches: [finishedMatch({ id: 'w32', opponent: '리버풀', kickoff: '7월 12일', actual: [2, 0], myResult: { predicted: [2, 1], totalPoints: 7 } })],
      }),
    ],
  },
}

/**
 * 예정 — 아직 안 열린 주차. 배지 `예정` + disabled "예측 오픈 전" 버튼.
 * `open`이 아니므로 컨테이너는 **흰 카드**(`border border-neutral-weak bg-surface`)이고,
 * 경기 카드는 글로우 컨테이너 안에서와 똑같은 `bg-page`다 — 가라앉는 건 팀명·시각 텍스트 톤뿐이다
 * (`isDimmed`가 `weekPhase === 'upcoming'`을 포함한다, MatchWeekList.tsx:140).
 */
export const Upcoming: Story = {
  args: {
    weeks: [mockWeek({ weekNo: 34, status: 'upcoming', matches: [mockMatch({ id: 'w34', opponent: '토트넘', kickoff: '7월 26일', kickoffTime: '오후 9:00' })] })],
  },
}

/**
 * 경기 2개인 주차 — 카드 두 장이 폭 전체를 쓰며 **세로로 쌓인다**(가로 배치 폐기, 2026-08-25).
 * 어느 폭에서도 같다 — MatchWeekList.tsx에 `sm:`/`md:` 분기가 하나도 없다(:252 `flex flex-col`).
 * 주차 단위로 배지 하나, CTA 하나다 — 경기마다 배지를 붙이지 않는다.
 */
export const TwoMatches: Story = {
  args: {
    weeks: [
      mockWeek({
        weekNo: 39,
        status: 'open',
        matches: [
          mockMatch({ id: 'w39a', competition: '프리미어리그', opponent: '에버튼', kickoff: '8월 23일' }),
          mockMatch({ id: 'w39b', competition: '카라바오컵', opponent: '브렌트포드', isHome: false, kickoff: '8월 26일' }),
        ],
      }),
    ],
  },
}

/**
 * `isHome`이 좌우 배치를 바꾼다 — 좌측은 항상 홈이라, 원정 경기(`isHome: false`)는 우리 팀이
 * 우측으로 간다. `actual`은 `isHome`과 무관하게 항상 [홈, 원정] 순서라서, 아래 원정 경기의
 * "1 – 3"은 상대가 1, 우리가 3이다(좌측=상대). 이 순서를 헷갈리면 결과가 반대로 보인다.
 *
 * 팀명은 로고 **옆**에 온다 — 좌측 칸은 `[팀명][로고]`, 우측 칸은 `[로고][팀명]`으로 둘 다
 * 가운데(일자·스코어) 쪽으로 붙는다(`TeamSide`의 `side` prop, MatchWeekList.tsx:404-445).
 * 두 주차 모두 `result`라 흰 컨테이너 + 흑백 로고다.
 */
export const HomeAndAway: Story = {
  args: {
    weeks: [
      mockWeek({ weekNo: 32, status: 'result', matches: [finishedMatch({ id: 'h', opponent: '리버풀', isHome: true, kickoff: '7월 12일', actual: [2, 0] })] }),
      mockWeek({ weekNo: 33, status: 'result', matches: [finishedMatch({ id: 'a', opponent: '리버풀', isHome: false, kickoff: '7월 19일', actual: [1, 3] })] }),
    ],
  },
}

/** 경기 없는 주 — 컨테이너와 "N주차" 타이틀은 다른 주차와 같고, 경기 카드 자리에 회색 안내 박스가 들어간다. 배지·버튼은 없다. */
export const NoMatches: Story = {
  args: {
    weeks: [mockWeek({ weekNo: 35, status: 'upcoming', matches: [] })],
  },
}

/**
 * 실제 목록 — 한 달 안에 결과·진행중·예정·경기 없는 주가 섞인다.
 * 상태별 스토리에서 못 보이는 것 세 가지를 여기서 본다.
 *
 * 1. **흰 컨테이너와 글로우 컨테이너가 한 화면에 같이 보인다.** 39주차만 `open`이라 글로우
 *    (`.spotlight-glow-brand`)이고 나머지는 흰 카드다 — 활성 주차를 위로 끌어올리는
 *    정렬(`openWeeksFirst`)이 폐기된 뒤 "지금 예측할 수 있는 주"를 가리키는 건 이 색뿐이다.
 * 2. 위→아래로 "결과 → 진행중 → 예정"으로 흐르는 **킥오프 오름차순** 그대로의 순서. 부모가
 *    재정렬하지 않는다(PredictListClient.tsx:47, :60 — 달 필터 + `toPredictWeeks` map뿐).
 * 3. 주차마다 55ms씩 밀리는 `animate-enter` 순차 등장.
 */
export const FullMonth: Story = {
  args: {
    weeks: [
      mockWeek({
        weekNo: 36,
        status: 'result',
        matches: [
          finishedMatch({ id: 'w36a', competition: '프리미어리그', opponent: '첼시', kickoff: '8월 2일', actual: [1, 2] }),
          finishedMatch({ id: 'w36b', competition: '카라바오컵', opponent: '브렌트포드', isHome: false, kickoff: '8월 5일', actual: [0, 0] }),
        ],
      }),
      mockWeek({
        weekNo: 37,
        status: 'result',
        matches: [finishedMatch({ id: 'w37', opponent: '브라이튼', kickoff: '8월 9일', actual: [1, 1], myResult: { predicted: [1, 0] } })],
      }),
      mockWeek({
        weekNo: 38,
        status: 'result',
        matches: [finishedMatch({ id: 'w38', opponent: '풀럼', isHome: false, kickoff: '8월 16일', actual: [2, 1], myResult: { predicted: [2, 1], totalPoints: 10 } })],
      }),
      mockWeek({
        weekNo: 39,
        status: 'open',
        matches: [mockMatch({ id: 'w39', opponent: '에버튼', kickoff: '8월 23일' })],
      }),
      mockWeek({ weekNo: 40, status: 'upcoming', matches: [mockMatch({ id: 'w40', opponent: '토트넘', kickoff: '8월 30일', kickoffTime: '오후 9:00' })] }),
      mockWeek({ weekNo: 41, status: 'upcoming', matches: [] }),
    ],
  },
}

/**
 * 데스크탑 목록 열 폭 — **넓은 폭에서 세로 카드가 어떻게 보이는지** 확인한다.
 * (가로 배치 회귀를 잡던 `NarrowTwoColumnWidth`는 가로 배치가 폐기되면서 삭제했다. 폭이 좁을
 * 때의 하한은 meta 데코레이터의 358px이 이미 다른 모든 스토리에서 상시로 밟고 있다.)
 *
 * 실제 페이지의 목록 열은 데스크탑에서 전체 폭의 2/3다(`PredictListClient.tsx:57`,
 * `sm:grid sm:grid-cols-[2fr_1fr] sm:gap-x-10` + `sm:px-10`). `--content-w`가 1140px이므로
 * (globals.css:29) 열 폭 상한은 `2/3 × (1140 − 80 − 40) ≈ 680px`다 — 720px 데코레이터가 그
 * 상한 구간이다. meta의 358px 데코레이터가 이 스토리도 감싸므로(스토리 데코레이터는 meta를
 * 대체하지 않는다) `maxWidth`가 아니라 `width`로 지정해 그 폭을 벗어난다.
 *
 * 확인 포인트: 경기 카드는 폭이 넓어져도 가로로 갈라지지 않고 세로로 쌓인 채 폭만 늘어난다.
 * 대신 팀 칸이 `minmax(0,1fr)` 트랙 안에서 가운데 쪽으로 붙어 있어(`side`별 `justify-end`/
 * `justify-start`, MatchWeekList.tsx:426-430) 로고·팀명 덩어리가 가운데에 모이고 카드 좌우
 * 바깥쪽에 빈 여백이 생긴다 — 폭이 커질수록 이 여백만 커진다.
 * 위 39주차(`open`)는 글로우 컨테이너, 아래 38주차(`result`)는 흰 컨테이너라 두 표면을 나란히 본다.
 */
export const DesktopWidth: Story = {
  decorators: [(Story: () => React.JSX.Element) => <div style={{ width: 720 }}><Story /></div>],
  args: {
    weeks: [
      mockWeek({
        weekNo: 39,
        status: 'open',
        matches: [
          // 긴 팀명과 짧은 팀명을 섞어, 좌우 칸이 서로 다른 폭으로 갈라지지 않는지
          // (= 가운데 일자·시각이 한쪽으로 쏠리지 않는지)까지 같이 본다.
          mockMatch({ id: 'd39a', competition: '프리미어리그', opponent: '맨체스터시티', kickoff: '8월 23일' }),
          mockMatch({ id: 'd39b', competition: '카라바오컵', opponent: '브렌트포드', isHome: false, kickoff: '8월 26일' }),
        ],
      }),
      mockWeek({
        weekNo: 38,
        status: 'result',
        matches: [finishedMatch({ id: 'd38', opponent: '풀럼', isHome: false, kickoff: '8월 16일', actual: [2, 1], myResult: { predicted: [2, 1], totalPoints: 10 } })],
      }),
    ],
  },
}
