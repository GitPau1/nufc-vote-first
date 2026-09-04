// 날짜/시각 포맷은 전부 KST를 명시해야 한다.
//
// timeZone을 빼면 서버(Vercel 런타임 = UTC)와 브라우저(사용자 로컬)가 같은 코드로 다른 문자열을
// 만든다 → hydration mismatch(React #425 → #418 → #423: root 전체가 클라이언트 렌더로 전환).
// 성능 이전에 표시 자체가 틀리는 문제다 — 킥오프 "오후 8:30"이 첫 페인트에 "오전 11:30"으로 떴고,
// UTC 15:00 이후 생성 데이터는 날짜가 하루 밀렸다(2026-08-25 Lighthouse 3차에서 실제로 검출).
//
// 한 곳만 고치면 나머지 사본에서 재발하므로 소스 전체를 훑는다. 새 포맷터를 추가할 때
// timeZone을 빼먹으면 이 테스트가 깨진다.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const TZ = "timeZone: 'Asia/Seoul'"

// 날짜를 글자로 바꾸는 호출들. `count.toLocaleString()`(숫자 3자리 구분)은 로케일 인자가 없어
// 걸리지 않는다 — 날짜 포맷은 이 리포에서 항상 'ko-KR'을 넘긴다.
const CALLS = [
  '.toLocaleDateString(',
  '.toLocaleTimeString(',
  ".toLocaleString('",
  'new Intl.DateTimeFormat(',
]

function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === 'fonts' ? [] : sources(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })
}

/** 호출의 여는 괄호부터 짝이 맞는 닫는 괄호까지 — 인자 안에 중첩 괄호가 있어도 잘리지 않게. */
function callArgs(source, openParen) {
  let depth = 0
  for (let i = openParen; i < source.length; i++) {
    if (source[i] === '(') depth++
    else if (source[i] === ')' && --depth === 0) return source.slice(openParen, i + 1)
  }
  return source.slice(openParen)
}

test('날짜 포맷 호출은 모두 KST를 명시한다', () => {
  const offenders = []

  for (const path of sources(SRC)) {
    const source = readFileSync(path, 'utf8')
    for (const call of CALLS) {
      for (let at = source.indexOf(call); at !== -1; at = source.indexOf(call, at + 1)) {
        const args = callArgs(source, at + call.length - 1)
        if (!args.includes(TZ)) {
          const line = source.slice(0, at).split('\n').length
          offenders.push(`${path.slice(SRC.length)}:${line} — ${call}`)
        }
      }
    }
  }

  assert.deepEqual(offenders, [], `timeZone 누락:\n${offenders.join('\n')}`)
})

test('알려진 포맷터가 실제로 존재한다 (검사가 빈 통과로 썩지 않게)', () => {
  // 함수가 옮겨가면 여기서 먼저 깨진다 — 위 테스트가 0건을 훑고 통과하는 상태를 막는 장치다.
  const known = [
    ['lib/utils.ts', 'export function formatDate'],
    ['components/composition/predict/MatchdayHero.tsx', 'function formatKickoff'],
    ['lib/polls/format.ts', 'export function formatPollDate'],
  ]
  for (const [file, needle] of known) {
    assert.match(readFileSync(join(SRC, file), 'utf8'), new RegExp(needle), `${file}에 ${needle} 없음`)
  }
})
