import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

test('shared UI primitives use foundation radius and typography tokens', () => {
  const tailwind = fs.readFileSync(path.join(root, '../tailwind.config.ts'), 'utf8')
  const globals = source('app/globals.css')
  const card = source('components/primitives/card.tsx')
  const button = source('components/primitives/button.tsx')
  const badge = source('components/primitives/badge.tsx')
  const sheet = source('components/primitives/modal/sheet.tsx')

  assert.match(tailwind, /"headline-1": \["18px", \{ lineHeight: "26px", letterSpacing: "-0\.002em" \}\]/)
  assert.match(tailwind, /"label-2": \["13px", \{ lineHeight: "18px", letterSpacing: "0\.0194em" \}\]/)
  assert.match(tailwind, /"caption-2": \["11px", \{ lineHeight: "14px", letterSpacing: "0\.0311em" \}\]/)
  assert.doesNotMatch(tailwind, /"caption-3"/)

  assert.match(card, /rounded-lg border border-neutral-weak bg-surface/)
  assert.match(card, /text-headline-1/)
  assert.match(card, /text-label-1-reading/)
  assert.doesNotMatch(card, /rounded-md border border-neutral-weak bg-surface text-neutral/)
  assert.doesNotMatch(card, /text-\[16px\]|text-\[14px\]|leading-\[1\.3\]/)

  assert.match(button, /text-body-2-normal/)
  assert.match(button, /sm: "h-9 px-3 text-label-2"/)
  assert.doesNotMatch(button, /text-\[15px\]|text-\[13px\]/)

  assert.match(badge, /text-caption-2/)
  assert.doesNotMatch(badge, /text-\[11px\]/)

  assert.match(sheet, /text-headline-1/)
  assert.match(sheet, /text-label-1-reading/)
  assert.doesNotMatch(sheet, /text-\[18px\]|text-\[14px\]|leading-\[1\.25\]/)

  // globals.css에서 타이포 토큰을 쓰는 유틸리티는 이제 .input-field 하나뿐이다.
  // text-body-2-normal을 쓰던 .btn-primary/.btn-secondary는 ed4972a에서 삭제되고
  // 버튼 스타일이 components/primitives/button.tsx로 옮겨갔다 — 그쪽은 위에서 검증한다.
  assert.match(globals, /text-label-1-normal/)
  assert.doesNotMatch(globals, /text-\[14px\]|text-\[15px\]/)
})

test('app and poll headers use color and typography foundations', () => {
  const appHeader = source('components/composition/common/AppHeader.tsx')
  const pollHeader = source('components/composition/polls/PollPageHeader.tsx')

  assert.match(appHeader, /border-b border-neutral-weak/)
  assert.match(appHeader, /text-title-3/)
  assert.match(appHeader, /text-neutral/)
  assert.match(appHeader, /text-label-1-normal/) // 모바일 돌아가기 버튼
  assert.doesNotMatch(appHeader, /border-\[#e1e7ef\]|text-\[#2b2b2b\]|text-\[24px\]|leading-\[22\.5px\]/)

  // PollPageHeader는 이제 AppHeader(mobileBack 모드)의 얇은 래퍼다 — 색상/타이포는
  // AppHeader 쪽에서 이미 검증되므로, 여기서는 제대로 위임하는지만 확인한다.
  assert.match(pollHeader, /<AppHeader mobileBack/)
  assert.doesNotMatch(pollHeader, /border-\[#e1e7ef\]/)
})

test('loading skeletons mirror the mobile layout foundation', () => {
  const loading = source('components/primitives/navigation-loading.tsx')

  assert.match(loading, /className="flex-1 px-5 pt-4 pb-24 sm:pb-10"/)
  assert.match(loading, /className="flex-1 px-5 pt-6 pb-24 sm:pb-10"/)
  assert.match(loading, /overflow-hidden rounded-lg border border-neutral-weak bg-surface/)
  assert.match(loading, /hidden sm:grid sm:grid-cols-2 sm:gap-4 sm:pt-4 lg:grid-cols-3/)
  assert.doesNotMatch(loading, /gap-\[49px\]/)
})

test('poll form and carousel surfaces use card radius foundation', () => {
  const form = source('components/composition/polls/UserPollCreateForm.tsx')
  const carousel = source('components/composition/polls/TypeBPollClient.tsx')

  assert.match(form, /rounded-lg border border-neutral-weak bg-surface p-4 shadow-g200/)
  assert.doesNotMatch(form, /<section className="[^"]*rounded-md border border-neutral-weak bg-surface p-4 shadow-g200/)
  assert.match(form, /text-label-2/)
  assert.match(form, /text-caption-1/)

  assert.match(carousel, /rounded-lg border border-neutral-weak bg-surface text-left shadow-g200/)
  assert.match(carousel, /absolute inset-0 rounded-lg/)
  // bg-primary-dark → bg-brand-solid: semantic 토큰 이전(primary→brand)으로 이름이 바뀜.
  // 새 brand 앵커는 배경·텍스트 대비를 둘 다 통과해 -dark 변형이 필요 없어져 흡수됨.
  assert.match(carousel, /bg-brand-solid/)
  assert.match(carousel, /text-title-1/)
  assert.doesNotMatch(carousel, /rounded-md border border-neutral-weak bg-surface text-left shadow-g200|rounded-md ring-inset|#0c2340|text-\[38px\]/)
})

test('image banners use a readable dark overlay for white text', () => {
  const globals = source('app/globals.css')
  const files = [
    // PollHeroCard는 원래 PollListClient.tsx 안에 있던 걸 /(홈)과 /polls가 같이 쓰도록 뽑아낸 것.
    'components/composition/polls/PollHeroCard.tsx',
    'components/composition/polls/TypeAPollClient.tsx',
    'components/composition/polls/TypeBPollClient.tsx',
    'components/composition/polls/OverallRatingPollClient.tsx',
    'components/composition/polls/OverallRatingResultView.tsx',
  ]

  assert.match(globals, /\.banner-text-overlay/)
  assert.match(globals, /rgba\(0, 0, 0, 0\.52\)/)
  assert.match(globals, /rgba\(0, 0, 0, 0\.92\)/)

  for (const file of files) {
    const content = source(file)
    assert.match(content, /banner-text-overlay absolute inset-0/, `${file} should use a dark text overlay`)
    assert.doesNotMatch(content, /from-black\/10 via-black\/50 to-black\/90/, `${file} should not rely on black opacity utilities`)
    assert.doesNotMatch(content, /linear-gradient\(to bottom, rgba/, `${file} should not hide banner overlay in inline styles`)
  }
})

test('motion uses duration tokens, not numeric durations', () => {
  // duration은 tailwind.config.ts의 4개 토큰(micro/enter/exit/slow)으로만 쓴다.
  // 다른 검사들과 달리 파일 목록을 하드코딩하지 않고 src 전체를 훑는다 —
  // 새로 만든 일회성 컴포넌트도 목록에 추가하지 않아도 자동으로 걸린다.
  const entries = fs.readdirSync(root, { recursive: true })
  const offenders = []

  for (const entry of entries) {
    if (typeof entry !== 'string' || !/\.(tsx|ts|css)$/.test(entry)) continue
    const full = path.join(root, entry)
    if (!fs.statSync(full).isFile()) continue

    const hits = fs.readFileSync(full, 'utf8').match(/\bduration-\d+/g)
    if (hits) offenders.push(`${entry} → ${[...new Set(hits)].join(', ')}`)
  }

  assert.deepEqual(
    offenders,
    [],
    `숫자 duration을 쓰는 파일이 있다. micro / enter / exit / slow 중에서 골라라:\n${offenders.join('\n')}`
  )
})

test('state opacity stays on the documented scale', () => {
  // 상태 표현 opacity는 0 / 50 / 70 / 100 네 값만 쓴다.
  //   70 = hover, 비활성·마감 표시, 장식 요소 약화
  //   50 = pressed
  //   0 / 100 = 숨김 / 표시
  // duration 검사와 같이 src 전체를 훑는다.
  // 예외: PlayersPageClient의 Pick One 카드가 쓰는 opacity-[0.34]는
  // 카드 전용 애니메이션 값이라 스케일에서 제외한다 (State foundation 문서에 기록).
  const allowed = new Set(['0', '50', '70', '100'])
  const entries = fs.readdirSync(root, { recursive: true })
  const offenders = []

  for (const entry of entries) {
    if (typeof entry !== 'string' || !/\.(tsx|ts|css)$/.test(entry)) continue
    const full = path.join(root, entry)
    if (!fs.statSync(full).isFile()) continue

    const hits = fs.readFileSync(full, 'utf8').match(/\bopacity-\d+\b/g) ?? []
    const bad = [...new Set(hits)].filter((h) => !allowed.has(h.replace('opacity-', '')))
    if (bad.length) offenders.push(`${entry} → ${bad.join(', ')}`)
  }

  assert.deepEqual(
    offenders,
    [],
    `문서화되지 않은 opacity 값을 쓰는 파일이 있다. 0 / 50 / 70 / 100 중에서 골라라:\n${offenders.join('\n')}`
  )
})

test('primary tab surfaces do not use arbitrary typography classes', () => {
  const files = [
    'app/menu/page.tsx',
    'components/composition/common/BottomNav.tsx',
    'components/composition/players/PlayersPageClient.tsx',
    'components/composition/polls/PollListClient.tsx',
    'components/composition/polls/PollCard.tsx',
    'components/composition/polls/PollHeroCard.tsx',
    'components/composition/polls/PollHomeSection.tsx',
    'components/composition/common/HomeClient.tsx',
  ]

  for (const file of files) {
    const content = source(file)
    assert.doesNotMatch(
      content,
      /text-\[[0-9]+px\]|leading-\[[0-9.]+px\]|tracking-\[-?[0-9.]+px\]|text-(xs|sm|base|lg|xl|2xl|3xl|4xl)\b|leading-(tight|snug|normal|relaxed)\b|tracking-(tight|wide|wider)\b/,
      `${file} should use foundation typography tokens`
    )
  }
})

// 승부예측(predict) 화면 — main에서 병합돼 들어올 때 구세대 flat 토큰(--c-*)을 쓰고 있어서
// 이 화면만 옛 하늘색(#41b6e6)으로 튀었다. semantic 토큰으로 옮긴 뒤 되돌아가지 않게
// 아래 두 검사(임의값 금지 + 구세대 토큰 금지)에 이 목록을 함께 건다.
const PREDICT_FILES = [
  'app/predictions/page.tsx',
  'app/predictions/[weekKey]/page.tsx',
  'components/composition/predict/MatchWeekList.tsx',
  'components/composition/predict/MatchdayHero.tsx',
  'components/primitives/modal/contents/PlayerPick.tsx',
  'components/composition/predict/PredictListClient.tsx',
  'components/composition/predict/PredictionDone.tsx',
  'components/composition/predict/PredictionFlowClient.tsx',
  'components/composition/predict/PredictionResult.tsx',
  'components/composition/predict/RankingCard.tsx',
  'components/composition/predict/WeekRankCard.tsx',
  'components/composition/predict/shared.tsx',
  'components/composition/predict/steps.tsx',
]

test('application source does not use arbitrary typography or hardcoded visual colors', () => {
  const files = [
    'app/admin/page.tsx',
    'app/my/feedback/page.tsx',
    'app/onboarding/OnboardingForm.tsx',
    'app/players/changes/page.tsx',
    'app/polls/create/page.tsx',
    'components/composition/auth/RequireAuthModal.tsx',
    'components/composition/common/CroppedImageInput.tsx',
    'components/composition/common/UserMenu.tsx',
    'components/composition/common/LoginButton.tsx',
    'components/composition/my/MyFeedbackForm.tsx',
    'components/composition/my/MyPageClient.tsx',
    'components/composition/players/PlayersPageClient.tsx',
    'components/composition/polls/CommentsSection.tsx',
    'components/primitives/modal/contents/Confirm.tsx',
    'components/primitives/modal/contents/Login.tsx',
    'components/primitives/modal/contents/PollPicker.tsx',
    'components/primitives/accordion.tsx',
    'components/composition/polls/OverallRatingPollClient.tsx',
    'components/composition/polls/OverallRatingResultView.tsx',
    'components/composition/polls/PollCard.tsx',
    'components/composition/polls/PollHeroCard.tsx',
    'components/composition/polls/PollHomeSection.tsx',
    'components/composition/common/HomeClient.tsx',
    'components/composition/polls/PollListClient.tsx',
    'components/composition/polls/ResultView.tsx',
    'components/composition/polls/TypeAPollClient.tsx',
    'components/composition/polls/TypeBPollClient.tsx',
    ...PREDICT_FILES,
  ]

  for (const file of files) {
    const content = source(file)
    assert.doesNotMatch(
      content,
      /text-\[[^\]]+\]|leading-\[[^\]]+\]|tracking-\[[^\]]+\]|text-(xs|sm|base|lg|xl|2xl|3xl|4xl)\b|leading-(tight|snug|normal|relaxed)\b|tracking-(tight|wide|wider)\b/,
      `${file} should use foundation typography tokens`
    )
    assert.doesNotMatch(
      content,
      // bg-[var(--c-*)]는 임의 hex가 아니라 CSS 변수 직접 참조라 위 hex 패턴에 안 걸렸다 —
      // MatchWeekList의 disabled 카드 배경이 실제로 이 형태였다. 변수 참조도 함께 막는다.
      /bg-\[#|bg-\[rgba|bg-\[var\(|text-\[#|border-\[#|from-\[#|to-\[#|shadow-\[|ring-\[|rounded-\[/,
      `${file} should use foundation visual tokens`
    )
  }
})

test('retired legacy color tokens stay deleted', () => {
  // 색 토큰은 이제 Palette → Semantic 한 계층뿐이다. 구세대 두 세대(--c-* flat hex,
  // shadcn HSL)의 색 토큰은 사용처를 전부 옮긴 뒤 정의까지 삭제했다.
  // 정의가 되살아나면 Tailwind가 다시 유효한 클래스로 노출해서(bg-primary / text-gray-2 /
  // border-neutral-weak …) 아무 경고 없이 재유입된다 — 정의가 없는 상태 자체를 고정한다.
  //
  // 어느 쪽이 신버전인지는 git이 답한다: --sem-*는 디자인시스템 커밋(4602c15, origin/main에
  // 없음)에서 생겼고 --c-*·shadcn HSL은 그보다 앞선 a72b7b8(origin/main에 있음)에서 왔다.
  const globals = source('app/globals.css')
  const tailwind = fs.readFileSync(path.join(root, '../tailwind.config.ts'), 'utf8')

  const retiredVars = [
    // ① LDSG 이전 세대 flat hex
    '--c-primary', '--c-primary-dim', '--c-primary-dark', '--c-primary-on',
    '--c-gray-1', '--c-gray-2', '--c-gray-3', '--c-gray-4',
    '--c-positive', '--c-positive-dim', '--c-negative', '--c-negative-dim',
    '--c-warning', '--c-warning-dim', '--c-bg', '--c-surface', '--c-disabled',
    // ② shadcn/ui 세대 HSL
    '--background', '--foreground', '--card', '--card-foreground',
    '--popover', '--popover-foreground', '--primary', '--primary-foreground',
    '--secondary', '--secondary-foreground', '--muted', '--muted-foreground',
    '--accent', '--accent-foreground', '--destructive', '--destructive-foreground',
    '--border', '--input', '--ring', '--radius',
  ]
  for (const token of retiredVars) {
    assert.doesNotMatch(globals, new RegExp(`^\\s*\\${token}:`, 'm'), `${token} 정의가 되살아났다`)
  }

  // --c-black만 남는다: 이미지 위 스크림(from-black/35)이 `/알파` 수정자를 쓰려면
  // rgb 채널값 형태가 필요하고, 대응하는 sem 토큰이 아직 없다.
  assert.match(globals, /--c-black:/)

  // tailwind의 `colors` 블록(모든 색 유틸리티에 퍼지는 블록)에는 그 하나만 남아야 한다.
  const colorsBlock = tailwind.match(/colors: \{([\s\S]*?)\n {6}\}/)[1]
  assert.deepEqual(
    [...colorsBlock.matchAll(/^\s{8}"?([a-z-]+)"?:/gm)].map((m) => m[1]),
    ['black'],
    'colors 블록에는 알파 수정자가 필요한 black만 남는다 — 색은 역할별 블록에서만 정의한다',
  )

  // 포커스 링이 옛 하늘색(--ring)에서 신버전 토큰으로 넘어간 상태를 고정한다.
  assert.match(tailwind, /"focus-ring": "var\(--sem-stroke-focus-ring\)"/)
  // bg-surface는 이름을 유지하되 값이 ③ 계층으로 옮겨졌다.
  assert.match(tailwind, /surface: "var\(--sem-bg-surface\)"/)

  // 임의 알파 유틸리티를 대체한 신규 semantic 토큰 + 다크 면 2차 텍스트 토큰.
  for (const added of [
    '--sem-bg-surface', '--sem-bg-on-solid-weak', '--sem-bg-on-solid-strong',
    '--sem-bg-surface-translucent', '--sem-fg-on-solid-muted',
  ]) {
    assert.match(globals, new RegExp(`\\${added}:`), `${added} 정의가 없다`)
  }

  // text-neutral-muted는 팔레트 단계(neutral-700)가 아니라 손으로 맞춘 값이어야 한다 —
  // neutral-700은 bg-disabled(3.99:1) / bg-brand-weak(4.14:1) / bg-critical-weak(4.12:1)
  // 위에서 AA 미달이고, 이 토큰이 실제로 얹히는 자리가 바로 그 배경들이다.
  assert.match(globals, /--sem-fg-neutral-muted: #666666;/)
})

test('retired legacy color class names are gone repo-wide', () => {
  // 위 정의 삭제로 이 이름들은 이제 "존재하지 않는 클래스"다 — Tailwind는 알 수 없는
  // 클래스를 조용히 무시하므로, 남아 있으면 에러 없이 스타일만 사라진다. 그래서 소스도 훑는다.
  // 파일 목록을 하드코딩하지 않고 src 전체를 본다(duration/opacity 검사와 같은 방식).
  // 키는 폐기된 이름, 값은 대체 이름. 이 맵의 키를 일괄 치환 스크립트로 건드리지 마라 —
  // 키가 새 이름으로 바뀌면 검사가 자기 자신을 고발하면서 의미를 잃는다(실제로 한 번 그랬다).
  const renamed = {
    // ② shadcn/ui 세대
    'bg-background': 'bg-page',
    'text-foreground': 'text-neutral',
    'text-muted-foreground': 'text-neutral-muted',
    'text-card-foreground': 'text-neutral',
    'text-secondary-foreground': 'text-neutral-strong',
    'border-border': 'border-neutral-weak',
    'border-input': 'border-neutral-weak',
    'bg-border': 'bg-neutral-weak',
    // divide-border / ring-border는 폐기된 border 색 토큰을 참조해 조용히 무효화되던
    // 죽은 클래스다(divideColor/ringColor에 border 키 없음). divide는 neutral-weak로,
    // ring은 제거하는 게 원칙이나 재도입 시엔 brand-solid를 쓴다(ring-neutral-weak 토큰 없음).
    'divide-border': 'divide-neutral-weak',
    'ring-border': 'ring-brand-solid',
    'bg-secondary': 'bg-disabled',
    'bg-muted': 'bg-disabled',
    'ring-ring': 'ring-brand-solid',
    'bg-accent': 'bg-brand-weak',
    'bg-popover': 'bg-surface',
    'bg-destructive': 'bg-critical-solid',
    // 아래 넷은 삭제 당시 "실사용 0건"으로 잘못 집계돼 이 맵에서 빠졌던 이름들이다 —
    // 실제로는 에러 문구 3곳(text-destructive)·스피너(border-muted/border-t-primary)·
    // 라디오 미선택 링(border-muted-foreground/40)이 남아 조용히 무효화되고 있었다.
    'text-destructive': 'text-critical',
    'border-muted-foreground': 'border-neutral-weak',
    'border-muted': 'border-neutral-weak',
    // ① LDSG 이전 세대
    'bg-primary': 'bg-brand-solid',
    'border-t-primary': 'border-t-brand-solid',
    'text-primary': 'text-brand',
    'text-primary-dark': 'text-brand',
    'bg-primary-dim': 'bg-brand-weak',
    'text-gray-1': 'text-neutral-strong',
    'text-gray-2': 'text-neutral-muted',
    'text-gray-3': 'text-neutral-subtle',
    'border-gray-4': 'border-neutral-weak',
    'bg-gray-1': 'bg-neutral-strong',
    'bg-gray-4': 'bg-neutral-weak',
    'text-negative': 'text-critical',
    'bg-negative-dim': 'bg-critical-weak',
    'bg-positive-dim': 'bg-positive-weak',
    'bg-warning-dim': 'bg-warning-weak',
  }
  const pattern = new RegExp(`\\b(${Object.keys(renamed).join('|')})\\b`, 'g')
  const entries = fs.readdirSync(root, { recursive: true })
  const offenders = []

  for (const entry of entries) {
    if (typeof entry !== 'string' || !/\.(tsx|ts|css|mdx)$/.test(entry)) continue
    const full = path.join(root, entry)
    if (!fs.statSync(full).isFile()) continue
    if (entry.endsWith('design-foundation.test.mjs')) continue
    // 이 페이지의 존재 이유가 "무엇을 왜 걷어냈는지" 설명하는 것이라, 폐기된 이름을
    // 본문에서 인용하는 게 정상이다. 유일한 예외.
    // readdirSync는 플랫폼 구분자로 경로를 준다 — Windows에서는 역슬래시라 '/' 하드코딩
    // 비교가 빗나가고, 이 예외가 무력화돼 이 파일이 위반으로 잡혔다(Windows에서만 실패).
    if (entry.split(path.sep).join('/').endsWith('foundations/DesignToken.mdx')) continue

    const hits = fs.readFileSync(full, 'utf8').match(pattern)
    if (hits) {
      const uniq = [...new Set(hits)]
      offenders.push(`${entry} → ${uniq.map((h) => `${h} (→ ${renamed[h]})`).join(', ')}`)
    }
  }

  assert.deepEqual(offenders, [], `삭제된 구세대 색 클래스가 남아 있다:\n${offenders.join('\n')}`)
})

test('legacy flat color tokens are gone repo-wide', () => {
  // ①세대 flat 토큰(globals.css :root 상단의 --c-*)을 Tailwind가 유효한 클래스로 노출하기
  // 때문에(bg-primary / text-gray-2 …) 임의값 검사로는 못 잡힌다 — Foundations/Design Token의
  // "이름이 겹치는 함정" 항목이 지적하는 그 문제다. 그래서 이름을 직접 금지한다.
  //
  // 이 검사는 predict뿐 아니라 **src 전체**를 훑는다 — primary/gray-N/*-dim/negative는
  // 대응 semantic 토큰이 전부 갖춰졌고 리포 전체 실사용 0건이라, 어느 파일에서든 재유입을
  // 영구 차단한다. white/black은 배너·이미지 위 텍스트에 아직 정당하게 쓰이는 곳이 있어
  // 여기서 막지 않고, predict 화면에서만 아래 검사가 금지한다.
  const legacyFlat =
    /\b(?:bg|text|border|ring|divide|from|to|fill|stroke)-(?:primary(?:-dark|-dim|-on)?|gray-[1-4]|positive-dim|negative(?:-dim)?|warning-dim)\b/g
  const entries = fs.readdirSync(root, { recursive: true })
  const offenders = []
  for (const entry of entries) {
    if (typeof entry !== 'string' || !/\.(tsx|ts|css)$/.test(entry)) continue
    const full = path.join(root, entry)
    if (!fs.statSync(full).isFile()) continue
    if (entry.endsWith('design-foundation.test.mjs')) continue
    const hits = fs.readFileSync(full, 'utf8').match(legacyFlat)
    if (hits) offenders.push(`${entry} → ${[...new Set(hits)].join(', ')}`)
  }
  assert.deepEqual(offenders, [], `구세대 flat 색 토큰이 남아 있다:\n${offenders.join('\n')}`)
})

test('prediction screens do not fall back to legacy color tokens', () => {
  // ①세대 flat 토큰은 위 `legacy flat color tokens are gone repo-wide`가 리포 전체에서
  // 막는다. 이 검사가 추가로 하는 일은 predict 화면에서 **white/black까지** 금지하는 것이다 —
  // predict 밖에서는 배너·이미지 위 텍스트에 white/black이 정당하게 쓰여 리포 전체 금지가
  // 아직 불가하지만(대응 토큰은 있다: text-white→text-on-solid / bg-white/5·/10→
  // bg-on-solid-weak·-strong / bg-white/95→bg-surface-translucent / bg-black/45→bg-overlay),
  // predict 화면은 이미 semantic으로 정리돼 있어 여기서 재유입을 막는다.
  //
  // `bg-surface`만 예외로 남는다 — 이름은 그대로지만 값이 --sem-bg-surface로 옮겨져
  // 이제 ③ 계층 토큰이다.
  const legacyToken =
    /\b(?:bg|text|border|ring|divide|from|to|fill|stroke)-(?:primary(?:-dark|-dim|-on)?|gray-[1-4]|positive-dim|negative(?:-dim)?|warning-dim|black|white)\b/

  for (const file of PREDICT_FILES) {
    const hits = source(file).match(new RegExp(legacyToken.source, 'g'))
    assert.equal(
      hits,
      null,
      `${file}은 구세대 색 토큰을 쓴다(${[...new Set(hits ?? [])].join(', ')}). ` +
        'Foundations/Color·Semantic의 semantic 토큰으로 바꿔라 ' +
        '(예: bg-primary→bg-brand-solid, text-primary-dark→text-brand, text-gray-2→text-neutral-muted, text-white→text-on-solid).'
    )
  }
})
