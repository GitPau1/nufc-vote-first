// 목표 규모 시드 — "서비스 사용자 100명" 가정을 데이터로 만든다.
//
//   사용자 100명 × 투표 10개(선택형 5 + 평점형 5) × 1표
//     선택형: votes         = 100 × 5              =   500행 (poll당 100행)
//     평점형: rating_votes  = 100 × 14선수 × 5     = 7,000행 (poll당 1,400행)
//
// 평점 투표는 제출 1회가 선수 수만큼 행을 만든다(lib/actions/ratings.ts:75,
// UNIQUE(poll_id, user_id, target_player_id)). 그래서 같은 "1인 1표"인데도
// 행 수가 14배로 증폭된다 — 이 시드의 요점이다.
//
// psql/supabase CLI 없이 PostgREST(service_role)로 직접 넣는다.
//
// 실행:
//   SUPA_URL=https://<staging-ref>.supabase.co SUPA_KEY=<service_role> \
//     node scripts/seed-target-scale.mjs
//
// 안전장치: STAGING_REF와 SUPA_URL이 일치하지 않으면 즉시 중단한다.
// prod에 이 스크립트를 돌리면 기존 데이터가 지워진다.

const URL = process.env.SUPA_URL
const KEY = process.env.SUPA_KEY
const STAGING_REF = 'ykjfcreiufgrvffmvtxf'

if (!URL || !KEY) throw new Error('SUPA_URL / SUPA_KEY 필요')
if (!URL.includes(STAGING_REF)) {
  throw new Error(`staging(${STAGING_REF})이 아니다: ${URL} — 중단한다`)
}

const USERS = 100
const PLAYERS = 14
const SELECTION_POLLS = 5
const RATING_POLLS = 5
const OPTIONS_PER_SELECTION = 5

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
}

async function rest(method, path, body, prefer) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    method,
    headers: prefer ? { ...headers, Prefer: prefer } : headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

// PostgREST는 필터 없는 DELETE를 거부한다. 전 행 삭제는 항상 참인 필터를 준다.
const ALL = 'id=not.is.null'

async function count(table) {
  const res = await fetch(`${URL}/rest/v1/${table}?select=id&limit=1`, {
    headers: { ...headers, Prefer: 'count=exact' },
  })
  return res.headers.get('content-range')?.split('/')[1] ?? '?'
}

// 삽입은 한 번에 다 보내면 요청이 커져 타임아웃 난다. 왕복은 늘지만 청크로 나눈다.
async function insert(table, rows, chunk = 500) {
  for (let i = 0; i < rows.length; i += chunk) {
    await rest('POST', table, rows.slice(i, i + chunk), 'return=minimal')
  }
}

async function main() {
  console.log(`대상: ${URL}`)
  console.log('삭제 전:', {
    users: await count('users'),
    polls: await count('polls'),
    votes: await count('votes'),
    rating_votes: await count('rating_votes'),
  })

  // 1) 삭제 — FK 순서대로. votes/comments는 polls에 CASCADE가 없어 먼저 지워야 한다.
  console.log('\n[1/2] 기존 시드 삭제')
  for (const t of [
    'rating_vote_likes',
    'comment_likes',
    'comments',
    'votes',
    'rating_votes',
    'poll_options',
    'polls',
  ]) {
    process.stdout.write(`  ${t} ... `)
    await rest('DELETE', `${t}?${ALL}`, null, 'return=minimal')
    console.log('완료')
  }
  // 실제 Auth 테스트 계정은 남긴다 — 부하용으로 넣은 행만 지운다.
  // 10만 행을 한 번에 지우면 statement timeout이 난다(public_profiles CASCADE 포함).
  // PostgREST는 DELETE에 LIMIT을 못 걸으므로 id를 페이지로 읽어 나눠 지운다.
  process.stdout.write('  users(load%) ')
  for (let deleted = 0; ; ) {
    const page = await rest('GET', 'users?select=id&email=like.load*@test.local&limit=500')
    if (!page.length) break
    const ids = page.map((r) => r.id).join(',')
    await rest('DELETE', `users?id=in.(${ids})`, null, 'return=minimal')
    deleted += page.length
    process.stdout.write(`\r  users(load%) ${deleted}개 삭제`)
  }
  console.log(' 완료')
  process.stdout.write('  players ... ')
  await rest('DELETE', `players?${ALL}`, null, 'return=minimal')
  console.log('완료')

  // 2) 시드
  console.log('\n[2/2] 목표 규모 시드')

  const players = Array.from({ length: PLAYERS }, (_, i) => ({
    id: crypto.randomUUID(),
    name: `선수 ${i + 1}`,
    position: ['GK', 'DEF', 'MID', 'FWD'][Math.min(3, Math.floor(i / 4))],
    squad_number: i + 1,
    is_active: true,
  }))
  await insert('players', players)
  console.log(`  players ${players.length}`)

  const users = Array.from({ length: USERS }, (_, i) => ({
    id: crypto.randomUUID(),
    email: `load${String(i + 1).padStart(3, '0')}@test.local`,
    display_name: `테스터${i + 1}`,
  }))
  await insert('users', users)
  console.log(`  users ${users.length} (public_profiles는 트리거가 채운다)`)

  const closesAt = new Date(Date.now() + 30 * 864e5).toISOString()
  const polls = []
  // created_at을 흩어서 목록 정렬이 실제로 일어나게 한다.
  const createdAt = (i) => new Date(Date.now() - (i + 1) * 36e5).toISOString()

  for (let i = 0; i < SELECTION_POLLS; i++) {
    polls.push({
      id: crypto.randomUUID(),
      type: 'selection',
      title: `[TARGET] 이주의 선수 ${i + 1}R`,
      status: 'active',
      closes_at: closesAt,
      created_at: createdAt(i),
    })
  }
  for (let i = 0; i < RATING_POLLS; i++) {
    polls.push({
      id: crypto.randomUUID(),
      type: 'overall_rating',
      title: `[TARGET] 경기 평점 ${i + 1}R`,
      status: 'active',
      closes_at: closesAt,
      created_at: createdAt(SELECTION_POLLS + i),
    })
  }
  await insert('polls', polls)
  const selectionPolls = polls.filter((p) => p.type === 'selection')
  const ratingPolls = polls.filter((p) => p.type === 'overall_rating')
  console.log(`  polls ${polls.length} (selection ${selectionPolls.length} / overall_rating ${ratingPolls.length})`)

  const options = []
  for (const p of selectionPolls) {
    for (let i = 0; i < OPTIONS_PER_SELECTION; i++) {
      options.push({
        id: crypto.randomUUID(),
        poll_id: p.id,
        label: players[i].name,
        player_id: players[i].id,
        display_order: i + 1,
      })
    }
  }
  // 평점 투표의 선택지 = 평가 대상 선수 전원. 이 수가 곧 제출당 행 수다.
  for (const p of ratingPolls) {
    players.forEach((pl, i) => {
      options.push({
        id: crypto.randomUUID(),
        poll_id: p.id,
        label: pl.name,
        player_id: pl.id,
        display_order: i + 1,
      })
    })
  }
  await insert('poll_options', options)
  console.log(`  poll_options ${options.length}`)

  // 선택형: 1인 1표. 선택지는 결정적으로 분배한다(random()이면 재현이 안 된다).
  const votes = []
  for (const p of selectionPolls) {
    const opts = options.filter((o) => o.poll_id === p.id)
    users.forEach((u, ui) => {
      votes.push({ poll_id: p.id, user_id: u.id, option_id: opts[ui % opts.length].id })
    })
  }
  await insert('votes', votes)
  console.log(`  votes ${votes.length} (poll당 ${votes.length / selectionPolls.length})`)

  // 평점형: 1인 1표지만 행은 선수 수만큼 생긴다.
  const ratingVotes = []
  for (const p of ratingPolls) {
    for (const u of users) {
      players.forEach((pl, pi) => {
        ratingVotes.push({
          poll_id: p.id,
          user_id: u.id,
          target_player_id: pl.id,
          score: (pi + users.indexOf(u)) % 6, // 0~5, 결정적
        })
      })
    }
  }
  await insert('rating_votes', ratingVotes, 1000)
  console.log(`  rating_votes ${ratingVotes.length} (poll당 ${ratingVotes.length / ratingPolls.length})`)

  console.log('\n최종:', {
    users: await count('users'),
    players: await count('players'),
    polls: await count('polls'),
    poll_options: await count('poll_options'),
    votes: await count('votes'),
    rating_votes: await count('rating_votes'),
  })

  console.log('\nk6용 POLL_ID:')
  console.log(`  선택형 상세: ${selectionPolls[0].id}`)
  console.log(`  평점형 상세: ${ratingPolls[0].id}`)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
