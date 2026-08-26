import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadInsightModule() {
  const source = fs.readFileSync(path.join(__dirname, 'insight.ts'), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, strict: true },
  }).outputText

  // week.test.mjs와 같은 harness — 모듈 해석기가 없어서 값으로 쓰는 import를 직접 등록한다.
  const requireShim = (id) => {
    if (id === 'next/cache') return { unstable_cache: (fn) => fn }
    if (id === '@/lib/config') return { IS_MOCK: false }
    if (id === './week') return { NUFC_LABEL: '뉴캐슬' }
    throw new Error(`insight.test.mjs: 등록되지 않은 의존성 ${id}`)
  }

  const cjsModule = { exports: {} }
  new Function('exports', 'module', 'require', compiled)(cjsModule.exports, cjsModule, requireShim)
  return cjsModule.exports
}

const { recentForm, formLines, formFacts } = loadInsightModule()

/** getFixtureWeeks()가 돌려주는 WeekGroup 모양 중 recentForm이 실제로 보는 필드만 채운다. */
function week(matches) {
  return { weekNo: 1, weekKey: 'w', monthKey: 'm', deadlineAt: null, status: 'result', matches }
}

function match({ kickoffAt, opponent, isHome = true, actual, finished = true }) {
  return {
    id: `${opponent}-${kickoffAt}`,
    competition: 'Premier League',
    opponent,
    opponentId: 1,
    isHome,
    kickoff: '',
    kickoffTime: '',
    kickoffAt,
    locked: true,
    finished,
    actual,
  }
}

test('recentForm: 종료·스코어 있는 경기만 최신순으로 고른다', () => {
  const weeks = [
    week([
      match({ kickoffAt: '2026-08-01T18:00:00Z', opponent: 'Aston Villa', actual: [1, 0] }),
      // 아직 안 끝난 경기 — 제외
      match({ kickoffAt: '2026-08-30T18:00:00Z', opponent: 'Tottenham', actual: null, finished: false }),
    ]),
    week([
      match({ kickoffAt: '2026-08-15T18:00:00Z', opponent: 'Everton', actual: [2, 2] }),
      // finished인데 스코어가 아직 안 들어온 경기 — 제외
      match({ kickoffAt: '2026-08-20T18:00:00Z', opponent: 'Fulham', actual: null }),
      // 일정 미정(kickoffAt 없음)이라 정렬 기준이 없다 — 제외
      match({ kickoffAt: null, opponent: 'Brentford', actual: [0, 1] }),
    ]),
  ]

  const form = recentForm(weeks)

  assert.deepEqual(
    form.map(entry => entry.opponent),
    ['Everton', 'Aston Villa'],
  )
})

test('recentForm: limit만큼만 자른다', () => {
  const weeks = [
    week(
      ['2026-08-01', '2026-08-08', '2026-08-15', '2026-08-22', '2026-08-29', '2026-09-05'].map((day, i) =>
        match({ kickoffAt: `${day}T18:00:00Z`, opponent: `Team${i}`, actual: [i, 0] }),
      ),
    ),
  ]

  assert.equal(recentForm(weeks).length, 5)
  assert.equal(recentForm(weeks, 2).length, 2)
  // 최신순이므로 가장 나중 경기가 맨 앞
  assert.equal(recentForm(weeks, 1)[0].opponent, 'Team5')
})

test('recentForm: actual은 [우리, 상대]로 그대로 옮긴다', () => {
  const weeks = [week([match({ kickoffAt: '2026-08-01T18:00:00Z', opponent: 'Chelsea', isHome: false, actual: [3, 1] })])]
  const [entry] = recentForm(weeks)

  assert.equal(entry.our, 3)
  assert.equal(entry.their, 1)
  assert.equal(entry.isHome, false)
})

test('formLines: 승·무·패와 홈/원정을 한 줄씩 적는다', () => {
  const form = [
    { kickoffAt: '2026-08-22T18:00:00Z', opponent: 'Everton', isHome: true, our: 2, their: 1 },
    { kickoffAt: '2026-08-15T18:00:00Z', opponent: 'Chelsea', isHome: false, our: 0, their: 0 },
    { kickoffAt: '2026-08-08T18:00:00Z', opponent: 'Arsenal', isHome: false, our: 1, their: 3 },
  ]

  assert.equal(
    formLines(form),
    ['2026-08-22 홈 vs Everton 2-1 승', '2026-08-15 원정 vs Chelsea 0-0 무', '2026-08-08 원정 vs Arsenal 1-3 패'].join('\n'),
  )
})

test('formLines: 같은 결과면 같은 문자열이다(캐시 키로 쓰인다)', () => {
  const form = [{ kickoffAt: '2026-08-22T18:00:00Z', opponent: 'Everton', isHome: true, our: 2, their: 1 }]

  assert.equal(formLines(form), formLines(form.map(entry => ({ ...entry }))))
})

/** 2026-08-25 실제 DB 기록. LLM이 이 숫자들을 틀렸던 케이스라 실측값을 그대로 고정해둔다. */
const REAL_FORM = [
  { kickoffAt: '2026-08-23T18:00:00Z', opponent: 'Liverpool', isHome: true, our: 2, their: 2 },
  { kickoffAt: '2026-08-16T18:00:00Z', opponent: 'Strasbourg', isHome: true, our: 1, their: 1 },
  { kickoffAt: '2026-08-15T18:00:00Z', opponent: 'Leverkusen', isHome: true, our: 1, their: 2 },
  { kickoffAt: '2026-08-12T18:00:00Z', opponent: 'Everton', isHome: false, our: 1, their: 3 },
  { kickoffAt: '2026-08-08T18:00:00Z', opponent: 'Valencia', isHome: false, our: 2, their: 1 },
]

function fact(facts, label) {
  const line = facts.split('\n').find(entry => entry.startsWith(`${label}:`))
  assert.ok(line, `"${label}" 항목이 없다`)
  return line.slice(label.length + 2)
}

test('formFacts: 실측 기록의 전적·득실을 정확히 센다', () => {
  const facts = formFacts(REAL_FORM)

  assert.equal(fact(facts, '최근 5경기 전적'), '1승 2무 2패')
  assert.equal(fact(facts, '2골 이상 실점한 경기'), '3경기')
  assert.equal(fact(facts, '2골 이상 넣은 경기'), '2경기')
  assert.equal(fact(facts, '양 팀 모두 득점한 경기'), '5경기')
  assert.equal(fact(facts, '홈'), '3경기 0승 2무 1패')
  assert.equal(fact(facts, '원정'), '2경기 1승 0무 1패')
  assert.ok(facts.includes('총 득점 7골(경기당 1.4), 총 실점 9골(경기당 1.8)'))
})

test('formFacts: 연속 기록은 최신 경기부터 끊기는 지점까지 센다', () => {
  const facts = formFacts(REAL_FORM)

  // 최신부터 무-무-패-패, 그 앞이 승이라 4에서 끊긴다
  assert.equal(fact(facts, '연속 무승'), '최근 4경기')
  // 가장 최근 경기가 무승부라 연승은 시작도 못 했다
  assert.equal(fact(facts, '연속 승리'), '없음')
  assert.equal(fact(facts, '연속 무실점'), '없음')
  assert.equal(fact(facts, '연속 무득점'), '없음')
})

test('formFacts: 기록 전체가 이어지면 "전부"로 못박는다', () => {
  const facts = formFacts(REAL_FORM)

  // 5경기 모두 득점했고 5경기 모두 실점했다 — "5경기 연속"이 아니라 "전부"라고 써야
  // 모델이 "6경기 연속" 같은 확장을 하지 않는다
  assert.equal(fact(facts, '연속 득점'), '최근 5경기 전부')
  assert.equal(fact(facts, '연속 실점'), '최근 5경기 전부')
})

test('formFacts: 한쪽 경기가 없으면 "없음"으로 적는다', () => {
  const homeOnly = REAL_FORM.filter(match => match.isHome)
  assert.equal(fact(formFacts(homeOnly), '원정'), '없음')
})
