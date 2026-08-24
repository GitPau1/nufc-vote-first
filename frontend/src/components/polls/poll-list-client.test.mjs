import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

// 히어로 배너는 원래 `/polls`(PollListClient)에 있었고, 우선순위 버킷에서 무작위로 하나를
// 골랐다. 지금은 홈(`/`)으로 옮겨졌고 선정 방식도 무작위가 아니라 "가장 급한 것 하나"로
// 바뀌었다. 아래 테스트는 그 이후 구조를 기준으로 한다.

test('poll list has no hero banner — the hero belongs to the home screen', () => {
  const list = source('components/polls/PollListClient.tsx')

  // 목록 화면은 탭 + 카드 리스트뿐이다. 히어로 마크업이나 선정 로직이 여기로 돌아오면
  // 탭을 바꿀 때 배너가 같이 흔들리는 예전 문제가 재발한다.
  assert.doesNotMatch(list, /h-\[252px\]/)
  assert.doesNotMatch(list, /banner-text-overlay/)
  assert.doesNotMatch(list, /featuredPoll|getFeaturedPollCandidates/)
  // 탭으로 걸러낸 목록을 그대로 보여준다(히어로를 빼려고 다시 filter하지 않는다).
  assert.match(list, /const listPolls = visiblePolls/)
})

test('home hero prefers the fixture and otherwise picks the most urgent poll deterministically', () => {
  const home = source('components/composition/common/HomeClient.tsx')
  const page = source('app/page.tsx')

  // 경기 정보가 있으면 MatchdayHero, 없을 때만 투표 배너로 대체한다.
  assert.match(home, /fixture \? <MatchdayHero fixture=\{fixture\} \/> : heroPoll && <PollHeroCard poll=\{heroPoll\} \/>/)
  // 진행중 → 예정 → 종료 순으로 하나. 무작위 선정이 아니라 이 순서가 계약이다 —
  // 새로고침마다 배너가 바뀌면 "지금 뭘 해야 하는지"가 흐려진다.
  assert.match(home, /const heroPoll = active\[0\] \?\? scheduled\[0\] \?\? closed\[0\] \?\? null/)
  assert.doesNotMatch(home, /Math\.random/)
  // 히어로로 뽑힌 투표는 아래 섹션 목록에서 빠지지 않는다.
  assert.doesNotMatch(home, /filter\([^)]*heroPoll/)
  // 두 데이터 소스는 서로 독립이라 페이지가 병렬로 받아 각각 넘긴다.
  assert.match(page, /<HomeClient sections=\{sections\} fixture=\{fixture\} \/>/)
})

test('poll list and home hero apply the mobile layout foundation', () => {
  const listPage = source('app/polls/page.tsx')
  const list = source('components/polls/PollListClient.tsx')
  const hero = source('components/polls/PollHeroCard.tsx')

  assert.match(listPage, /bg-page/)
  assert.doesNotMatch(listPage, /bg-\[#f4f4f5\]/)
  // 데스크탑 1140px 그리드 도입으로 mx-auto max-w-content가 앞에 붙었다(모바일 여백 자체는 그대로).
  assert.match(list, /className="mx-auto max-w-content px-5 pt-4 pb-10 animate-enter"/)
  assert.match(list, /className="px-5 pt-4 animate-enter"/)
  assert.match(list, /overflow-hidden rounded-lg border border-neutral-weak bg-surface/)
  // 히어로 배너 규격은 옮겨간 자리(PollHeroCard)에서 지킨다.
  assert.match(hero, /relative block h-\[252px\] overflow-hidden rounded-lg/)
  assert.match(hero, /banner-text-overlay absolute inset-0/)
  assert.doesNotMatch(hero, /from-transparent to-black\/85/)
})
