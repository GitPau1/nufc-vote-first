'use client'

import { MatchdayHero, type MatchdayFixture } from '@/components/predict/MatchdayHero'
import { toKst, weekKey } from '@/lib/predictions/week'

// 실제 선수 photoUrl은 lib/predictions/candidates.ts의 playerPhotoUrl(fotmobPlayerId)로 조립되는데,
// 그건 실제 시즌 스쿼드에 존재하는 진짜 FotMob 선수 ID가 있어야 200이 온다(임의 숫자는 403).
// 여기선 실존 ID를 지어내는 대신 다른 mock 사진과 같은 placehold.co를 쓴다.
const PLACEHOLDER_PLAYER_PHOTO = 'https://placehold.co/88x88/2a2f36/8a929c?text=%20'

// 실데이터(Supabase fixtures 테이블) 연동 전, 홈 히어로 교체 후보를 눈으로 확인하기 위한
// 임시 프리뷰 페이지. 실제 쿼리는 lib/queries/fixtures.ts(getHomeMatchdayFixture)에 있고
// 이미 HomeClient에 연결돼 있다 — 여기는 상태별(예정/진행중/종료/긴 팀명) 모양만 확인한다.
//
// home_name/away_name은 실제로는 FotMob 원본(영문)이 그대로 들어오므로 lib/predict/team-names.ts가
// 한글화한다 — 여기선 프로토타입 확인용으로 한글 라벨을 직접 넣었다.

function withWeekKey(kickoffAt: string) {
  return weekKey(toKst(kickoffAt))
}

// 히어로는 킥오프 24시간 전부터 뜨므로(lib/queries/fixtures.ts PRE_MATCH_WINDOW_MS),
// 프리뷰 mock도 그 창 안의 시각만 쓴다.
const UPCOMING_KICKOFF = new Date(Date.now() + 2 * 3_600_000 + 40 * 60_000 + 59_000).toISOString()

const UPCOMING: MatchdayFixture = {
  fixtureId: 1,
  competitionName: '프리미어리그',
  kickoffAt: UPCOMING_KICKOFF,
  homeId: 10261, // Newcastle
  homeName: '뉴캐슬',
  awayId: 8650, // Liverpool
  awayName: '리버풀',
  homeScore: null,
  awayScore: null,
  started: false,
  finished: false,
  weekKey: withWeekKey(UPCOMING_KICKOFF),
  topDefender: null,
  topMidfielder: null,
  topForward: null,
  scoreStr: null,
  shootoutScore: null,
}

// 진행 중 — 예측 제출이 잠긴 상태라 "승부예측 하러 가기" 버튼이 아예 없어야 한다.
const LIVE: MatchdayFixture = {
  ...UPCOMING,
  fixtureId: 2,
  started: true,
  finished: false,
}

const FINISHED_KICKOFF = new Date(Date.now() - 2 * 86_400_000).toISOString()

const FINISHED: MatchdayFixture = {
  fixtureId: 3,
  competitionName: '프리미어리그',
  kickoffAt: FINISHED_KICKOFF,
  homeId: 10261,
  homeName: '뉴캐슬',
  awayId: 9825, // Arsenal
  awayName: '아스날',
  homeScore: 2,
  awayScore: 1,
  started: true,
  finished: true,
  weekKey: withWeekKey(FINISHED_KICKOFF),
  // 셋 중 최고 평점(미드필더 브루노 8.4)이 골드로 강조된다.
  topDefender: {
    playerId: 0,
    name: '스벤 보트만',
    rating: 7.6,
    photoUrl: PLACEHOLDER_PLAYER_PHOTO,
    position: 'DEF',
  },
  topMidfielder: {
    playerId: 0,
    name: '브루노 기마랑이스',
    rating: 8.4,
    photoUrl: PLACEHOLDER_PLAYER_PHOTO,
    position: 'MID',
  },
  topForward: {
    playerId: 0,
    name: '알렉산더 이사크',
    rating: 8.1,
    photoUrl: PLACEHOLDER_PLAYER_PHOTO,
    position: 'FWD',
  },
  scoreStr: '2-1',
  shootoutScore: null,
}

// 0-0 무승부 — 스코어가 "없는 것"과 "0-0인 것"은 다르다. 0-0도 정상적으로 결과+평점 카드가 떠야 한다.
const DRAW_0_0: MatchdayFixture = {
  ...FINISHED,
  fixtureId: 5,
  awayId: 8650, // Liverpool
  awayName: '리버풀',
  homeScore: 0,
  awayScore: 0,
  // 셋 중 최고 평점이 수비수(보트만 7.6)라 골드가 첫 번째 카드에 붙는 경우.
  topDefender: {
    playerId: 0,
    name: '스벤 보트만',
    rating: 7.6,
    photoUrl: PLACEHOLDER_PLAYER_PHOTO,
    position: 'DEF',
  },
  topMidfielder: {
    playerId: 0,
    name: '산드로 토날리',
    rating: 7.3,
    photoUrl: PLACEHOLDER_PLAYER_PHOTO,
    position: 'MID',
  },
  topForward: {
    playerId: 0,
    name: '앤서니 고든',
    rating: 7.1,
    photoUrl: PLACEHOLDER_PLAYER_PHOTO,
    position: 'FWD',
  },
  scoreStr: '0-0',
}

// 승부차기 — FotMob 동기화가 승부차기 스코어를 home_score/away_score에 넣어버리는 엣지 케이스.
// 실제 결과(연장 포함 정규 스코어)는 score_str("1-1")을 그대로 쓰고, home/away_score(5, 4)는
// "승부차기(5-4)" 캡션으로만 보여준다.
const PENALTY_SHOOTOUT: MatchdayFixture = {
  ...FINISHED,
  fixtureId: 6,
  competitionName: 'EFL Cup',
  awayId: 8650, // Liverpool
  awayName: '리버풀',
  homeScore: 5,
  awayScore: 4,
  scoreStr: '1-1',
  // 셋 중 최고 평점이 미드필더(조엘린통 7.7)라 골드가 가운데 카드에 붙는 경우.
  topDefender: {
    playerId: 0,
    name: '파비안 스하르',
    rating: 7.5,
    photoUrl: PLACEHOLDER_PLAYER_PHOTO,
    position: 'DEF',
  },
  topMidfielder: {
    playerId: 0,
    name: '조엘린통',
    rating: 7.7,
    photoUrl: PLACEHOLDER_PLAYER_PHOTO,
    position: 'MID',
  },
  topForward: {
    playerId: 0,
    name: '칼럼 윌슨',
    rating: 7.2,
    photoUrl: PLACEHOLDER_PLAYER_PHOTO,
    position: 'FWD',
  },
}

// 홈/원정 팀명 길이가 크게 다를 때 VS가 한쪽으로 쏠리지 않는지 확인용.
const LONG_NAME: MatchdayFixture = {
  ...UPCOMING,
  fixtureId: 4,
  competitionName: 'EFL Cup',
  awayId: 8659,
  awayName: '웨스트브롬위치',
}

export default function MatchdayHeroPreviewPage() {
  return (
    <div className="min-h-screen bg-page px-4 py-8">
      <h1 className="mb-1 text-title-3 font-black">홈 히어로(승부예측) 프리뷰</h1>
      <p className="mb-8 text-caption-1 text-neutral-muted">
        실데이터 연동 전 임시 확인용 페이지 — /dev/matchday-hero-preview.
        모바일 폭(358px) 섹션은 브라우저 창 폭과 무관하게 고정, 맨 아래 &ldquo;넓은 화면&rdquo; 섹션만 창 폭을 그대로 쓴다.
      </p>

      <div className="mx-auto flex w-full max-w-[358px] flex-col gap-6">
        <section>
          <p className="mb-2 text-label-1-normal font-bold text-neutral-muted">예정 경기 (카운트다운)</p>
          <MatchdayHero fixture={UPCOMING} />
        </section>

        <section>
          <p className="mb-2 text-label-1-normal font-bold text-neutral-muted">진행 중 (버튼 없음)</p>
          <MatchdayHero fixture={LIVE} />
        </section>

        <section>
          <p className="mb-2 text-label-1-normal font-bold text-neutral-muted">종료 (결과 + 포지션별 최고 평점)</p>
          <MatchdayHero fixture={FINISHED} />
        </section>

        <section>
          <p className="mb-2 text-label-1-normal font-bold text-neutral-muted">종료 (0-0 무승부 + 포지션별 최고 평점)</p>
          <MatchdayHero fixture={DRAW_0_0} />
        </section>

        <section>
          <p className="mb-2 text-label-1-normal font-bold text-neutral-muted">종료 (승부차기 — 결과는 1-1, 캡션에 5-4)</p>
          <MatchdayHero fixture={PENALTY_SHOOTOUT} />
        </section>

        <section>
          <p className="mb-2 text-label-1-normal font-bold text-neutral-muted">팀명 길이 차이 큰 경우 (모바일 폭)</p>
          <MatchdayHero fixture={LONG_NAME} />
        </section>

        <hr className="my-2 border-neutral-weak" />

        <section>
          <p className="mb-2 text-label-1-normal font-bold text-neutral-muted">
            아래 진행 중인 투표 섹션까지 스크롤 없이 살짝 보이는지 확인용 더미
          </p>
          <div className="h-[120px] rounded-lg bg-disabled" />
        </section>
      </div>

      <hr className="my-10 border-neutral-weak" />

      <section>
        <p className="mb-2 text-label-1-normal font-bold text-neutral-muted">
          넓은 화면에서도 팀 배지가 VS 근처에 붙어 있는지 확인 (창 폭 그대로 — 좁히거나 넓혀서 확인)
        </p>
        <MatchdayHero fixture={LONG_NAME} />
      </section>

      <hr className="my-10 border-neutral-weak" />

      <section>
        <p className="mb-2 text-label-1-normal font-bold text-neutral-muted">
          종료 경기 — 넓은 화면(창 폭 그대로): 평점 카드가 md~에서 가로로 나란히 펼쳐지는지 확인
        </p>
        <MatchdayHero fixture={FINISHED} />
      </section>
    </div>
  )
}
