import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { MatchdayHero, type MatchdayFixture } from '@/components/composition/predict/MatchdayHero'
import { toKst, weekKey } from '@/lib/predictions/week'

// 실제 선수 photoUrl은 lib/predictions/candidates.ts의 playerPhotoUrl(fotmobPlayerId)로 조립되는데,
// 그건 실제 시즌 스쿼드에 있는 진짜 FotMob 선수 ID가 있어야 200이 온다(임의 숫자는 403) — 다른 mock
// 사진과 같은 placehold.co를 쓴다.
const PLACEHOLDER_PLAYER_PHOTO = 'https://placehold.co/88x88/2a2f36/8a929c?text=%20'

function mockFixture(overrides: Partial<MatchdayFixture>): MatchdayFixture {
  const kickoffAt = overrides.kickoffAt ?? new Date(Date.now() + 2 * 3_600_000 + 40 * 60_000).toISOString()
  return {
    fixtureId: 1,
    competitionName: '프리미어리그',
    kickoffAt,
    homeId: 10261, // Newcastle
    homeName: '뉴캐슬',
    awayId: 8650, // Liverpool
    awayName: '리버풀',
    homeScore: null,
    awayScore: null,
    started: false,
    finished: false,
    weekKey: weekKey(toKst(kickoffAt)),
    topDefender: null,
    topMidfielder: null,
    topForward: null,
    scoreStr: null,
    shootoutScore: null,
    ...overrides,
  }
}

// 홈 화면에서 모바일 폭 카드 하나로 쓰이는 컴포넌트라, 데스크탑 와이드 캔버스 그대로 두면
// 실제 배치와 느낌이 달라진다 — 대부분의 스토리는 실제 히어로 자리 폭으로 감싼다.
// (LongTeamNameWide만 예외 — 넓은 화면에서도 VS 정렬이 안 무너지는지 보려고 일부러 안 감싼다.)
const mobileWidth = { decorators: [(Story: () => React.JSX.Element) => <div style={{ maxWidth: 358 }}><Story /></div>] }

const meta = {
  title: 'Composition/Predict/MatchdayHero',
  component: MatchdayHero,
  parameters: {
    // appDirectory: true가 없으면 내부의 next/link가
    // "invariant expected app router to be mounted"로 죽는다.
    nextjs: { appDirectory: true, navigation: { pathname: '/' } },
  },
} satisfies Meta<typeof MatchdayHero>

export default meta
type Story = StoryObj<typeof meta>

export const Upcoming: Story = {
  ...mobileWidth,
  args: { fixture: mockFixture({}) },
}

export const Live: Story = {
  ...mobileWidth,
  args: { fixture: mockFixture({ started: true, finished: false }) },
}

export const Finished: Story = {
  ...mobileWidth,
  args: {
    fixture: mockFixture({
      kickoffAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      awayId: 9825, // Arsenal
      awayName: '아스날',
      homeScore: 2,
      awayScore: 1,
      started: true,
      finished: true,
      scoreStr: '2-1',
      // 셋 중 최고 평점(미드필더 브루노 8.4)이 골드로 강조된다.
      topDefender: { playerId: 0, name: '스벤 보트만', rating: 7.6, photoUrl: PLACEHOLDER_PLAYER_PHOTO, position: 'DEF' },
      topMidfielder: { playerId: 0, name: '브루노 기마랑이스', rating: 8.4, photoUrl: PLACEHOLDER_PLAYER_PHOTO, position: 'MID' },
      topForward: { playerId: 0, name: '알렉산더 이사크', rating: 8.1, photoUrl: PLACEHOLDER_PLAYER_PHOTO, position: 'FWD' },
    }),
  },
}

/** 0-0 무승부 — 스코어가 "없는 것"과 "0-0인 것"은 다르다. 0-0도 결과+평점 카드가 정상적으로 떠야 한다. */
export const Draw0to0: Story = {
  ...mobileWidth,
  args: {
    fixture: mockFixture({
      kickoffAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      awayId: 9825, // Arsenal
      awayName: '아스날',
      homeScore: 0,
      awayScore: 0,
      started: true,
      finished: true,
      scoreStr: '0-0',
      // 셋 중 최고 평점이 수비수(보트만 7.6)라 골드가 첫 번째 카드에 붙는 경우.
      topDefender: { playerId: 0, name: '스벤 보트만', rating: 7.6, photoUrl: PLACEHOLDER_PLAYER_PHOTO, position: 'DEF' },
      topMidfielder: { playerId: 0, name: '산드로 토날리', rating: 7.3, photoUrl: PLACEHOLDER_PLAYER_PHOTO, position: 'MID' },
      topForward: { playerId: 0, name: '앤서니 고든', rating: 7.1, photoUrl: PLACEHOLDER_PLAYER_PHOTO, position: 'FWD' },
    }),
  },
}

/**
 * 승부차기 — FotMob 동기화가 승부차기 스코어를 home_score/away_score에 넣어버리는 엣지 케이스.
 * 실제 결과(연장 포함 정규 스코어)는 score_str("1-1")을 그대로 쓰고, home/away_score(5, 4)는
 * "승부차기(5-4)" 캡션으로만 보여준다.
 */
export const PenaltyShootout: Story = {
  ...mobileWidth,
  args: {
    fixture: mockFixture({
      kickoffAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      competitionName: 'EFL Cup',
      homeScore: 5,
      awayScore: 4,
      started: true,
      finished: true,
      scoreStr: '1-1',
      shootoutScore: '5-4',
      // 셋 중 최고 평점이 미드필더(조엘린통 7.7)라 골드가 가운데 카드에 붙는 경우.
      topDefender: { playerId: 0, name: '파비안 스하르', rating: 7.5, photoUrl: PLACEHOLDER_PLAYER_PHOTO, position: 'DEF' },
      topMidfielder: { playerId: 0, name: '조엘린통', rating: 7.7, photoUrl: PLACEHOLDER_PLAYER_PHOTO, position: 'MID' },
      topForward: { playerId: 0, name: '칼럼 윌슨', rating: 7.2, photoUrl: PLACEHOLDER_PLAYER_PHOTO, position: 'FWD' },
    }),
  },
}

/** 홈/원정 팀명 길이가 크게 다를 때 VS가 한쪽으로 쏠리지 않는지 확인(모바일 폭) — grid_1fr_auto_1fr 레이아웃. */
export const LongTeamName: Story = {
  ...mobileWidth,
  args: {
    fixture: mockFixture({
      competitionName: 'EFL Cup',
      awayId: 8659, // West Brom
      awayName: '웨스트브롬위치',
    }),
  },
}

/** 위와 같은 fixture인데 폭 제한 없이(Storybook 캔버스 그대로) — 넓은 화면에서도 팀 배지가
 *  VS 근처에 붙어 있어야 한다(가운데 정렬이면 화면이 넓어질수록 VS에서 멀어진다). */
export const LongTeamNameWide: Story = {
  args: {
    fixture: mockFixture({
      competitionName: 'EFL Cup',
      awayId: 8659,
      awayName: '웨스트브롬위치',
    }),
  },
}
