import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadWeekModule() {
  const source = fs.readFileSync(path.join(__dirname, 'week.ts'), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, strict: true },
  }).outputText

  // week.ts를 소스 그대로 transpile해서 돌리는 harness라 모듈 해석기가 없다 —
  // 값으로 쓰는 import는 여기에 등록해줘야 한다(타입 전용 import는 컴파일에서 사라진다).
  const requireShim = (id) => {
    if (id === '@/lib/config') return { SUPABASE_URL: 'https://stub.supabase.co' }
    throw new Error(`week.test.mjs: 등록되지 않은 의존성 ${id}`)
  }

  const cjsModule = { exports: {} }
  new Function('exports', 'module', 'require', compiled)(cjsModule.exports, cjsModule, requireShim)
  return cjsModule.exports
}

const {
  groupFixturesByWeek,
  weekStatus,
  toMatchView,
  toPredictWeeks,
  findWeekSession,
  findWeekPrediction,
  submittableMatches,
  isoWeek,
  weekKey,
  weekLabel,
  currentWeekKey,
  toKst,
  NUFC_TEAM_ID,
} = loadWeekModule()

test('currentWeekKey: KST 자정 직후는 UTC 기준 전날이어도 새 주차로 잡힌다', () => {
  // 2026-08-23(일) 00:30 KST = 2026-08-22(토) 15:30 UTC.
  // 정규 시즌 앵커(2026-08-23)가 시작되는 바로 그 순간이다.
  const sundayEarlyKst = new Date('2026-08-22T15:30:00Z')

  assert.equal(currentWeekKey(sundayEarlyKst), '2627-1')
  // +9h 시프트를 빠뜨리면 UTC 달력(토요일, 프리시즌 마지막 주)으로 계산되어 지난 주차가 나온다
  // — 이게 막으려는 버그다.
  assert.equal(weekKey(sundayEarlyKst), '2627-0-4')
})

test('currentWeekKey: 주 중간은 UTC/KST 어느 쪽으로 계산해도 같은 주차다', () => {
  // 2026-08-20(목) 12:00 KST = 같은 날 03:00 UTC — 08/16주(프리시즌 4번째 주, 2627-0-4).
  const thursdayNoonKst = new Date('2026-08-20T03:00:00Z')

  assert.equal(currentWeekKey(thursdayNoonKst), '2627-0-4')
})

test('currentWeekKey: 연말 경계에서 시즌 앵커 순번이 계속 이어진다', () => {
  // 2026-12-28(월) 09:00 KST = 2026-12-28 00:00 UTC — sundayAnchorStart 2026-12-27, 19주차.
  assert.equal(currentWeekKey(new Date('2026-12-28T00:00:00Z')), '2627-19')
})

function fixture(overrides) {
  return {
    fixture_id: 1,
    competition_name: 'Premier League',
    kickoff_at: '2026-08-23T15:30:00+00:00',
    home_id: NUFC_TEAM_ID,
    home_name: 'Newcastle',
    home_score: null,
    away_id: 10260,
    away_name: 'Liverpool',
    away_score: null,
    started: false,
    finished: false,
    cancelled: false,
    ...overrides,
  }
}

const KICKOFF = new Date('2026-08-23T15:30:00Z').getTime()

test('같은 주 경기 2개는 한 예측 세션(주차)으로 묶인다 (더블 매치위크)', () => {
  // 일요일 경계에서는 08-23(리버풀)·08-29(토트넘) 조합은 서로 다른 주로 갈라진다
  // (feature-spec §2-3 실측) — 같은 주에 남는 실제 조합(리버풀 + 웨스트브롬 EFL컵)으로 교체.
  const weeks = groupFixturesByWeek(
    [
      fixture({ fixture_id: 1, kickoff_at: '2026-08-23T15:30:00+00:00' }),
      fixture({ fixture_id: 2, kickoff_at: '2026-08-26T18:45:00+00:00', competition_name: 'EFL Cup' }),
    ],
    KICKOFF - 86_400_000,
  )

  assert.equal(weeks.length, 1)
  assert.deepEqual(weeks[0].matches.map(m => m.id), ['1', '2'])
  assert.equal(weeks[0].monthKey, '2026-08')
  assert.equal(weeks[0].weekKey, '2627-1')
  // 상태는 주차 단위 하나. 마감은 그 주 마지막 경기 킥오프다.
  assert.equal(weeks[0].status, 'open')
  assert.equal(weeks[0].deadlineAt, '2026-08-26T18:45:00+00:00')
})

test('경기 없는 중간 주차는 빈 그룹으로 채워진다', () => {
  const weeks = groupFixturesByWeek(
    [
      fixture({ fixture_id: 1, kickoff_at: '2026-08-23T15:30:00+00:00' }),
      fixture({ fixture_id: 2, kickoff_at: '2026-09-14T19:00:00+00:00' }),
    ],
    KICKOFF,
  )

  assert.equal(weeks.length, 4)
  assert.deepEqual(weeks.map(w => w.matches.length), [1, 0, 0, 1])
  assert.deepEqual(weeks[1].deadlineAt, null)
  assert.equal(weeks[1].status, 'upcoming')
})

test('주차는 첫 경기 킥오프 7일 전에 열리고 마지막 경기 킥오프에 닫힌다', () => {
  const first = fixture({ fixture_id: 1, kickoff_at: '2026-08-23T15:30:00+00:00' })
  const second = fixture({ fixture_id: 2, kickoff_at: '2026-08-29T18:45:00+00:00' })
  const LAST_KICKOFF = new Date('2026-08-29T18:45:00Z').getTime()

  // 첫 킥오프 7일 이내 = 오픈, 그보다 이르면 예정
  assert.equal(weekStatus([first, second], KICKOFF - 86_400_000), 'open')
  assert.equal(weekStatus([first, second], KICKOFF - 30 * 86_400_000), 'upcoming')
  // 첫 경기가 시작·종료돼도 두 번째 경기가 남아 있으면 세션은 열려 있다
  assert.equal(weekStatus([{ ...first, started: true }, second], KICKOFF + 1), 'open')
  assert.equal(weekStatus([{ ...first, started: true, finished: true }, second], KICKOFF + 1), 'open')
  // 마지막 경기 킥오프이 지나면 닫힌다
  assert.equal(
    weekStatus([{ ...first, finished: true }, second], LAST_KICKOFF + 1),
    'upcoming',
  )
  // 그 주 경기가 전부 끝나야 결과
  assert.equal(
    weekStatus([{ ...first, finished: true }, { ...second, finished: true }], LAST_KICKOFF + 1),
    'result',
  )
})

test('submittableMatches: 이미 시작된 경기는 빠지고 남은 경기만 제출 대상이다', () => {
  // 일요일 경계에서 같은 주로 남는 조합(08-23·08-26)으로 교체 — 위 더블 매치위크 테스트와 동일 근거.
  const [week] = groupFixturesByWeek(
    [
      // 첫 경기는 이미 끝났고, 두 번째 경기는 아직 남아 있다
      fixture({ fixture_id: 1, kickoff_at: '2026-08-23T15:30:00+00:00', started: true, finished: true, home_score: 2, away_score: 0 }),
      fixture({ fixture_id: 2, kickoff_at: '2026-08-26T18:45:00+00:00' }),
    ],
    new Date('2026-08-26T00:00:00Z').getTime(),
  )

  assert.equal(week.status, 'open')
  assert.deepEqual(week.matches.map(m => m.locked), [true, false])
  assert.deepEqual(submittableMatches(week).map(m => m.id), ['2'])
})

test('원정 경기는 상대/스코어가 뒤집혀 우리 관점으로 나온다', () => {
  const view = toMatchView(
    fixture({
      home_id: 8586,
      home_name: 'Tottenham',
      away_id: NUFC_TEAM_ID,
      away_name: 'Newcastle',
      home_score: 1,
      away_score: 3,
      started: true,
      finished: true,
      kickoff_at: '2026-08-23T10:30:00+00:00',
    }),
    KICKOFF,
  )

  assert.equal(view.isHome, false)
  assert.equal(view.opponent, 'Tottenham')
  assert.deepEqual(view.actual, [3, 1])
  assert.equal(view.finished, true)
  // 한국시간(UTC+9) 기준 표기
  assert.equal(view.kickoff, '8월 23일')
  assert.equal(view.kickoffTime, '오후 7:30')
})

test('findWeekSession: weekKey로 주차 세션을 찾는다', () => {
  const weeks = groupFixturesByWeek(
    [
      fixture({ fixture_id: 1, kickoff_at: '2026-08-23T15:30:00+00:00' }),
      fixture({ fixture_id: 2, kickoff_at: '2026-08-26T18:45:00+00:00' }),
      fixture({ fixture_id: 3, kickoff_at: '2026-09-02T18:45:00+00:00' }),
    ],
    KICKOFF - 86_400_000,
  )

  // 1·2는 같은 주(2627-1), 3은 다음 주(2627-2) → 세션이 갈린다
  assert.deepEqual(findWeekSession(weeks, '2627-1').matches.map(m => m.id), ['1', '2'])
  const session = findWeekSession(weeks, '2627-2')
  assert.deepEqual(session.matches.map(m => m.id), ['3'])
  assert.equal(session.weekNo, 2)
  assert.equal(findWeekSession(weeks, '9999-1'), null)
})

test('toPredictWeeks: 원정 경기 스코어는 [홈, 원정] 순서로 되돌아간다', () => {
  const weeks = groupFixturesByWeek(
    [
      fixture({
        fixture_id: 1,
        home_id: 8586,
        home_name: 'Tottenham',
        away_id: NUFC_TEAM_ID,
        away_name: 'Newcastle',
        home_score: 1,
        away_score: 3,
        started: true,
        finished: true,
      }),
    ],
    KICKOFF + 86_400_000,
  )

  const [week] = toPredictWeeks(weeks)
  assert.equal(week.status, 'result')
  assert.equal(week.submitted, false)
  assert.equal(week.hasPending, false)
  assert.equal(week.matches[0].finished, true)
  // MatchView는 [우리, 상대] = [3, 1] → PredictWeekMatch는 [홈, 원정] = [1, 3]
  assert.deepEqual(week.matches[0].actual, [1, 3])
  assert.equal(week.matches[0].isHome, false)
  // 엠블럼은 Storage public 버킷(team-logos/{FotMob 팀 id}.png)에서 온다 — 팀 id가 곧 파일명이다.
  assert.match(week.matches[0].opponentLogoUrl, /\/player-photos\/team-logos\/8586\.png$/)
  assert.equal(week.matches[0].myResult, undefined)
})

const SUBMITTED_PICKS = {
  DEF: { playerId: 4, multiplier: 2.1 },
  MID: { playerId: 39, multiplier: 1.7 },
  FWD: { playerId: 14, multiplier: 1.3 },
}

test('findWeekPrediction: 주 단위 제출은 경기별 스코어 + 경기별 픽으로 읽힌다', () => {
  const [week] = groupFixturesByWeek(
    [
      fixture({ fixture_id: 1, kickoff_at: '2026-08-24T15:30:00+00:00' }),
      // 원정 경기 — 저장된 [홈, 원정]이 화면용 [우리, 상대]로 뒤집혀야 한다.
      fixture({
        fixture_id: 2,
        kickoff_at: '2026-08-27T18:45:00+00:00',
        home_id: 8586,
        home_name: 'Tottenham',
        away_id: NUFC_TEAM_ID,
        away_name: 'Newcastle',
      }),
    ],
    KICKOFF,
  )

  // 그 주 경기가 한 번에 들어가고, 픽은 경기별로 다를 수 있다.
  const otherPicks = { ...SUBMITTED_PICKS, FWD: { playerId: 10, multiplier: 1.6 } }
  const submitted = {
    1: { score: [2, 1], picks: SUBMITTED_PICKS },
    2: { score: [0, 3], picks: otherPicks },
  }
  const mine = findWeekPrediction(week, submitted)
  assert.deepEqual(mine.scores, { 1: [2, 1], 2: [3, 0] })
  assert.deepEqual(mine.picks, { 1: SUBMITTED_PICKS, 2: otherPicks })

  assert.equal(findWeekPrediction(week, {}), undefined)
})

test('toPredictWeeks: 제출 여부는 주차 단위, 예측 스코어는 경기별로 붙는다', () => {
  const weeks = groupFixturesByWeek(
    [
      fixture({ fixture_id: 1, kickoff_at: '2026-08-24T15:30:00+00:00' }),
      fixture({ fixture_id: 2, kickoff_at: '2026-08-27T18:45:00+00:00' }),
    ],
    KICKOFF,
  )

  const submitted = {
    1: { score: [2, 1], picks: SUBMITTED_PICKS },
    2: { score: [0, 0], picks: SUBMITTED_PICKS },
  }
  const [week] = toPredictWeeks(weeks, submitted)
  assert.equal(week.submitted, true)
  assert.equal(week.hasPending, false)
  assert.equal(week.weekKey, '2627-1')
  assert.deepEqual(week.matches[0].myResult, { predicted: [2, 1] })
  assert.deepEqual(week.matches[1].myResult, { predicted: [0, 0] })
})

test('toPredictWeeks: 첫 경기만 제출된 상태면 남은 경기가 pending으로 남는다', () => {
  // 일요일 경계에서 같은 주로 남는 조합(08-23·08-26)으로 교체 — 위 submittableMatches 테스트와 동일 근거.
  const weeks = groupFixturesByWeek(
    [
      fixture({ fixture_id: 1, kickoff_at: '2026-08-23T15:30:00+00:00', started: true, finished: true, home_score: 2, away_score: 0 }),
      fixture({ fixture_id: 2, kickoff_at: '2026-08-26T18:45:00+00:00' }),
    ],
    new Date('2026-08-26T00:00:00Z').getTime(),
  )

  // 첫 경기가 끝난 뒤 처음 들어온 사용자 = 아무것도 제출 안 함
  const [fresh] = toPredictWeeks(weeks)
  assert.equal(fresh.status, 'open')
  assert.equal(fresh.submitted, false)
  assert.equal(fresh.hasPending, true)

  // 남은 경기까지 제출하면 pending이 사라진다
  const [done] = toPredictWeeks(weeks, { 2: { score: [1, 1], picks: SUBMITTED_PICKS } })
  assert.equal(done.submitted, true)
  assert.equal(done.hasPending, false)
})

// --- 프리시즌(친선경기) 그룹핑 — feature-spec §7 "신규 추가 케이스" ---

test('groupFixturesByWeek: 친선경기 1건은 프리시즌 전용 weekKey로 묶인다', () => {
  const [week] = groupFixturesByWeek(
    [fixture({ fixture_id: 10, kickoff_at: '2026-07-25T11:30:00+00:00', competition_name: 'Club Friendlies' })],
    KICKOFF,
  )

  assert.equal(week.weekKey, '2627-0-1')
})

test('groupFixturesByWeek: 08/09주 친선경기 3개(트리플 매치위크)는 한 그룹으로 묶인다', () => {
  const [week] = groupFixturesByWeek(
    [
      fixture({ fixture_id: 20, kickoff_at: '2026-08-08T19:00:00+00:00', competition_name: 'Club Friendlies' }),
      fixture({ fixture_id: 21, kickoff_at: '2026-08-12T16:15:00+00:00', competition_name: 'Club Friendlies' }),
      fixture({ fixture_id: 22, kickoff_at: '2026-08-15T14:00:00+00:00', competition_name: 'Club Friendlies' }),
    ],
    KICKOFF,
  )

  assert.equal(week.weekKey, '2627-0-3')
  assert.equal(week.matches.length, 3)
})

test('groupFixturesByWeek: 친선경기 없는 빈 주(08/02주)는 크래시 없이 건너뛴다', () => {
  // 07/26주(2627-0-2)와 08/09주(2627-0-3) 사이의 08/02주는 친선경기 자체가 없다(feature-spec §6-3) —
  // 이 회귀 테스트가 없었을 때 weekKey()가 이 빈 주에서 throw해 목록 페이지가 배포 직후 크래시했다.
  const weeks = groupFixturesByWeek(
    [
      fixture({ fixture_id: 30, kickoff_at: '2026-07-29T18:30:00+00:00', competition_name: 'Club Friendlies' }),
      fixture({ fixture_id: 31, kickoff_at: '2026-08-08T19:00:00+00:00', competition_name: 'Club Friendlies' }),
    ],
    KICKOFF,
  )

  assert.deepEqual(
    weeks.map(w => w.weekKey),
    ['2627-0-2', '2627-0-3'],
  )
})

// --- 낙오 경기("2526-1") — feature-spec §9 ---

test('isoWeek/weekKey: 2025-26시즌 낙오 경기(fixture_id=4813748)는 "2526-1"로 명시 처리된다', () => {
  const kst = toKst('2026-05-24T15:00:00+00:00')
  assert.equal(isoWeek(kst), 1)
  assert.equal(weekKey(kst), '2526-1')
})

test('groupFixturesByWeek: 낙오 경기와 정규 시즌 1주차는 weekNo가 같아도 서로 다른 그룹이다', () => {
  const weeks = groupFixturesByWeek(
    [
      fixture({ fixture_id: 4813748, kickoff_at: '2026-05-24T15:00:00+00:00', competition_name: 'Premier League' }),
      fixture({ fixture_id: 1, kickoff_at: '2026-08-23T15:30:00+00:00' }),
    ],
    KICKOFF,
  )

  const strayWeek = weeks.find(w => w.weekKey === '2526-1')
  const regularWeek1 = weeks.find(w => w.weekKey === '2627-1')

  assert.ok(strayWeek, '2526-1 그룹이 있어야 한다')
  assert.equal(strayWeek.weekNo, 1)
  assert.deepEqual(strayWeek.matches.map(m => m.id), ['4813748'])

  assert.ok(regularWeek1, '2627-1 그룹이 있어야 한다')
  assert.notEqual(strayWeek, regularWeek1)
  assert.deepEqual(regularWeek1.matches.map(m => m.id), ['1'])
})

// --- 화이트리스트 밖 과거 날짜 — feature-spec §10 ---

test('isoWeek/weekKey: 세 화이트리스트 어디에도 없는 과거 날짜는 throw 대신 null을 반환한다', () => {
  const kst = toKst('2026-04-01T00:00:00+00:00')
  assert.equal(isoWeek(kst), null)
  assert.equal(weekKey(kst), null)
})

test('groupFixturesByWeek: 알 수 없는 날짜의 경기는 에러 없이 조용히 빠지고 나머지는 정상 그룹핑된다', () => {
  const weeks = groupFixturesByWeek(
    [
      // 세 화이트리스트(정규 시즌 앵커·프리시즌 앵커·낙오 경기 앵커) 어디에도 없는 날짜 — 앵커
      // 상수 갱신이 빠졌을 때를 흉내낸다(§9의 fixture_id=4813748이 방어 로직 추가 전 코드를
      // 만났다면 탔을 경로의 일반화된 회귀 테스트).
      fixture({ fixture_id: 66, kickoff_at: '2026-04-01T00:00:00+00:00', competition_name: 'Premier League' }),
      fixture({ fixture_id: 4813748, kickoff_at: '2026-05-24T15:00:00+00:00', competition_name: 'Premier League' }),
      fixture({ fixture_id: 1, kickoff_at: '2026-08-23T15:30:00+00:00' }),
    ],
    KICKOFF,
  )

  const allIds = weeks.flatMap(w => w.matches.map(m => m.id))
  assert.ok(!allIds.includes('66'), '알 수 없는 날짜의 경기는 어떤 그룹에도 나타나지 않아야 한다')
  assert.ok(allIds.includes('4813748'))
  assert.ok(allIds.includes('1'))
})

// --- weekLabel: 화면 표시 문구(프리시즌은 "프리시즌 N", 정규 시즌은 그대로) ---

test('weekLabel: 정규 시즌(양수 weekNo)은 기존과 같은 "N주차"/"N라운드"를 반환한다', () => {
  assert.equal(weekLabel(1, '주차'), '1주차')
  assert.equal(weekLabel(33, '라운드'), '33라운드')
})

test('weekLabel: 프리시즌(음수 weekNo)은 unit 없이 "프리시즌 N"을 반환한다', () => {
  assert.equal(weekLabel(-1, '주차'), '프리시즌 1')
  assert.equal(weekLabel(-4, '라운드'), '프리시즌 4')
})
