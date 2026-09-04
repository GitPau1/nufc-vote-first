import type { PlayerRow, PollOptionRow, SeasonSquadRow } from '@/types/database'
import type { PollDetail, PollListItem, VoteCountMap, RatingResultItem, RatingCommentItem } from '@/lib/queries/polls'
import type { FixtureRow } from '@/lib/predictions/week'
import { getRatingGrade } from '@/lib/polls/rating'

// ── 선수 ────────────────────────────────────────────────────
const isak: PlayerRow = {
  id: 'p-isak', name: '알렉산더 이삭', position: 'FWD',
  squad_number: 14, photo_url: null, base_rating: 90, is_active: true, squad_status: 'first_team',
}
const bruno: PlayerRow = {
  id: 'p-bruno', name: '브루노 기마랑이스', position: 'MID',
  squad_number: 39, photo_url: null, base_rating: 89, is_active: true, squad_status: 'first_team',
}
const trippier: PlayerRow = {
  id: 'p-trippier', name: '키어런 트리피어', position: 'DEF',
  squad_number: 2, photo_url: null, base_rating: 84, is_active: true, squad_status: 'first_team',
}
const gordon: PlayerRow = {
  id: 'p-gordon', name: '앤서니 고든', position: 'FWD',
  squad_number: 10, photo_url: null, base_rating: 86, is_active: true, squad_status: 'first_team',
}
const wilson: PlayerRow = {
  id: 'p-wilson', name: '캘럼 윌슨', position: 'FWD',
  squad_number: 9, photo_url: null, base_rating: 82, is_active: true, squad_status: 'first_team',
}
const pope: PlayerRow = {
  id: 'p-pope', name: '닉 포프', position: 'GK',
  squad_number: 22, photo_url: null, base_rating: 85, is_active: true, squad_status: 'first_team',
}

export const MOCK_PLAYERS = [isak, bruno, trippier, gordon, wilson, pope]

// ── 공통 평가 옵션 생성 헬퍼 ────────────────────────────────
function evalOptions(pollId: string): PollOptionRow[] {
  return [
    { id: `${pollId}-opt1`, poll_id: pollId, label: '시즌 베스트',   player_id: null, display_order: 1 },
    { id: `${pollId}-opt2`, poll_id: pollId, label: '훌륭한 경기',   player_id: null, display_order: 2 },
    { id: `${pollId}-opt3`, poll_id: pollId, label: '무난한 플레이', player_id: null, display_order: 3 },
    { id: `${pollId}-opt4`, poll_id: pollId, label: '아쉬운 모습',   player_id: null, display_order: 4 },
  ]
}

// ── 전체평점(overall_rating) 옵션 생성 헬퍼 ───────────────────
// 옵션 하나 = 선수 한 명(선택형과 같은 모양). GK/DEF/MID/FWD를 모두 포함해 결과 화면의
// 포지션 그룹 UI(OverallRatingResultView)와 평가 화면의 포지션별 스텝(OverallRatingPollClient)을
// 둘 다 목 모드에서 확인할 수 있게 한다.
const OVERALL_RATING_TARGETS = [pope, trippier, bruno, isak, gordon, wilson]

function overallRatingOptions(pollId: string): PollOptionRow[] {
  return OVERALL_RATING_TARGETS.map((player, index) => ({
    id: `${pollId}-opt${index + 1}`,
    poll_id: pollId,
    label: player.name,
    player_id: player.id,
    display_order: index + 1,
  }))
}

function overallRatingOptionPlayers(): Record<string, PlayerRow> {
  return Object.fromEntries(OVERALL_RATING_TARGETS.map(player => [player.id, player]))
}

// ── 더미 투표 목록 ───────────────────────────────────────────
export const MOCK_POLL_LIST: PollListItem[] = [
  {
    id: 'poll-1',
    type: 'evaluation',
    title: '이삭 맨시티전 활약 평가',
    status: 'active',
    closes_at: new Date(Date.now() + 5 * 86400_000).toISOString(),
    created_at: new Date(Date.now() - 2 * 86400_000).toISOString(),
    player_id: isak.id,
    player: isak,
    poll_options: evalOptions('poll-1'),
    vote_count: 2847,
  },
  {
    id: 'poll-5',
    type: 'selection',
    title: '이번 시즌 뉴캐슬 최고 공격수',
    status: 'active',
    closes_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
    created_at: new Date(Date.now() - 3 * 86400_000).toISOString(),
    player_id: null,
    player: null,
    poll_options: [
      { id: 'poll-5-opt1', poll_id: 'poll-5', label: '알렉산더 이삭', player_id: isak.id,   display_order: 1 },
      { id: 'poll-5-opt2', poll_id: 'poll-5', label: '앤서니 고든',   player_id: gordon.id, display_order: 2 },
      { id: 'poll-5-opt3', poll_id: 'poll-5', label: '캘럼 윌슨',     player_id: wilson.id, display_order: 3 },
    ],
    vote_count: 2491,
  },
  {
    id: 'poll-2',
    type: 'evaluation',
    title: '브루노 이번 시즌 미드필드 기여도',
    status: 'active',
    closes_at: new Date(Date.now() + 2 * 86400_000).toISOString(),
    created_at: new Date(Date.now() - 4 * 86400_000).toISOString(),
    player_id: bruno.id,
    player: bruno,
    poll_options: evalOptions('poll-2'),
    vote_count: 1534,
  },
  {
    id: 'poll-4',
    type: 'evaluation',
    title: '트리피어 이번 시즌 종합 평가',
    status: 'closed',
    closes_at: new Date(Date.now() - 3 * 86400_000).toISOString(),
    created_at: new Date(Date.now() - 14 * 86400_000).toISOString(),
    player_id: trippier.id,
    player: trippier,
    poll_options: evalOptions('poll-4'),
    vote_count: 4219,
  },
  {
    id: 'poll-6',
    type: 'selection',
    title: '24-25 시즌 최고의 수문장',
    status: 'closed',
    closes_at: new Date(Date.now() - 5 * 86400_000).toISOString(),
    created_at: new Date(Date.now() - 20 * 86400_000).toISOString(),
    player_id: null,
    player: null,
    poll_options: [
      { id: 'poll-6-opt1', poll_id: 'poll-6', label: '닉 포프',         player_id: pope.id,    display_order: 1 },
      { id: 'poll-6-opt2', poll_id: 'poll-6', label: '마틴 두브라브카', player_id: null,       display_order: 2 },
    ],
    vote_count: 3187,
  },
  {
    id: 'poll-7',
    type: 'overall_rating',
    title: '뉴캐슬 스쿼드 이번 시즌 전체평점',
    status: 'active',
    closes_at: new Date(Date.now() + 6 * 86400_000).toISOString(),
    created_at: new Date(Date.now() - 1 * 86400_000).toISOString(),
    player_id: null,
    player: null,
    poll_options: overallRatingOptions('poll-7'),
    vote_count: 1892,
  },
  {
    id: 'poll-8',
    type: 'overall_rating',
    title: '24-25 시즌 뉴캐슬 스쿼드 전체평점',
    status: 'closed',
    closes_at: new Date(Date.now() - 4 * 86400_000).toISOString(),
    created_at: new Date(Date.now() - 25 * 86400_000).toISOString(),
    player_id: null,
    player: null,
    poll_options: overallRatingOptions('poll-8'),
    vote_count: 3654,
  },
]

// ── 더미 투표 상세 ───────────────────────────────────────────
export const MOCK_POLL_DETAIL: Record<string, PollDetail> = {
  'poll-1': {
    id: 'poll-1', type: 'evaluation', status: 'active',
    title: '이삭 맨시티전 활약 평가',
    description: '지난 맨체스터 시티 원정에서 보여준 알렉산더 이삭의 활약을 평가해주세요. 선제골과 2회의 핵심 기회 창출을 포함한 전반적인 기여도를 고려해 선택해주세요.',
    closes_at: new Date(Date.now() + 5 * 86400_000).toISOString(),
    player_id: isak.id, player: isak,
    poll_options: evalOptions('poll-1'),
    created_by: 'mock-user',
  },
  'poll-5': {
    id: 'poll-5', type: 'selection', status: 'active',
    title: '이번 시즌 뉴캐슬 최고 공격수',
    description: '2024-25 시즌 뉴캐슬의 공격을 이끈 최고의 선수를 선택해주세요. 득점, 어시스트, 경기 장악력을 종합적으로 고려해주세요.',
    closes_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
    player_id: null, player: null,
    poll_options: [
      { id: 'poll-5-opt1', poll_id: 'poll-5', label: '알렉산더 이삭', player_id: isak.id,   display_order: 1 },
      { id: 'poll-5-opt2', poll_id: 'poll-5', label: '앤서니 고든',   player_id: gordon.id, display_order: 2 },
      { id: 'poll-5-opt3', poll_id: 'poll-5', label: '캘럼 윌슨',     player_id: wilson.id, display_order: 3 },
    ],
    option_players: { [isak.id]: isak, [gordon.id]: gordon, [wilson.id]: wilson },
  },
  'poll-2': {
    id: 'poll-2', type: 'evaluation', status: 'active',
    title: '브루노 이번 시즌 미드필드 기여도',
    description: '브루노 기마랑이스의 이번 시즌 전반적인 미드필드 장악력, 빌드업 기여, 수비 가담을 종합적으로 평가해주세요.',
    closes_at: new Date(Date.now() + 2 * 86400_000).toISOString(),
    player_id: bruno.id, player: bruno,
    poll_options: evalOptions('poll-2'),
  },
  'poll-4': {
    id: 'poll-4', type: 'evaluation', status: 'closed',
    title: '트리피어 이번 시즌 종합 평가',
    description: '키어런 트리피어의 이번 시즌 오른쪽 측면 수비 및 공격 가담을 종합 평가해주세요. 세트피스 기여도도 고려해 선택해주세요.',
    closes_at: new Date(Date.now() - 3 * 86400_000).toISOString(),
    player_id: trippier.id, player: trippier,
    poll_options: evalOptions('poll-4'),
    created_by: 'mock-user',
  },
  'poll-6': {
    id: 'poll-6', type: 'selection', status: 'closed',
    title: '24-25 시즌 최고의 수문장',
    description: '이번 시즌 뉴캐슬 골문을 지킨 최고의 골키퍼를 선택해주세요.',
    closes_at: new Date(Date.now() - 5 * 86400_000).toISOString(),
    player_id: null, player: null,
    poll_options: [
      { id: 'poll-6-opt1', poll_id: 'poll-6', label: '닉 포프',         player_id: pope.id, display_order: 1 },
      { id: 'poll-6-opt2', poll_id: 'poll-6', label: '마틴 두브라브카', player_id: null,    display_order: 2 },
    ],
    option_players: { [pope.id]: pope },
  },
  'poll-7': {
    id: 'poll-7', type: 'overall_rating', status: 'active',
    title: '뉴캐슬 스쿼드 이번 시즌 전체평점',
    description: '이번 시즌 뉴캐슬 스쿼드 전원의 활약을 포지션별로 평가해주세요. 골키퍼부터 공격수까지 전 포지션을 채워야 제출됩니다.',
    closes_at: new Date(Date.now() + 6 * 86400_000).toISOString(),
    player_id: null, player: null,
    poll_options: overallRatingOptions('poll-7'),
    option_players: overallRatingOptionPlayers(),
  },
  'poll-8': {
    id: 'poll-8', type: 'overall_rating', status: 'closed',
    title: '24-25 시즌 뉴캐슬 스쿼드 전체평점',
    description: '24-25 시즌이 끝난 지금, 뉴캐슬 스쿼드 전원의 시즌 활약을 되돌아보고 평가해주세요.',
    closes_at: new Date(Date.now() - 4 * 86400_000).toISOString(),
    player_id: null, player: null,
    poll_options: overallRatingOptions('poll-8'),
    option_players: overallRatingOptionPlayers(),
  },
}

// ── 투표 집계 ─────────────────────────────────────────────────
export const MOCK_VOTE_COUNTS: Record<string, VoteCountMap> = {
  'poll-1': { 'poll-1-opt1': 1124, 'poll-1-opt2': 982, 'poll-1-opt3': 521, 'poll-1-opt4': 220 },
  'poll-2': { 'poll-2-opt1': 743,  'poll-2-opt2': 489, 'poll-2-opt3': 213, 'poll-2-opt4': 89  },
  'poll-4': { 'poll-4-opt1': 1842, 'poll-4-opt2': 1397,'poll-4-opt3': 712, 'poll-4-opt4': 268 },
  'poll-5': { 'poll-5-opt1': 1203, 'poll-5-opt2': 876, 'poll-5-opt3': 412 },
  'poll-6': { 'poll-6-opt1': 2614, 'poll-6-opt2': 573 },
}

// ── 전체평점 결과 ─────────────────────────────────────────────
// getRatingResults(mock 경로)가 그대로 돌려주는 값. 실제 서버 로직처럼 grade는 average_score로부터
// getRatingGrade()로 계산해, 점수·등급이 따로 놀지 않게 한다.
type RatingResultSeed = {
  player: PlayerRow
  averageScore: number
  voteCount: number
  comments: Array<{ display_name: string; comment: string; likeCount: number; isLiked?: boolean }>
}

function buildRatingResults(pollId: string, seeds: RatingResultSeed[]): RatingResultItem[] {
  return seeds.map(seed => ({
    player: seed.player,
    average_score: seed.averageScore,
    grade: getRatingGrade(seed.averageScore),
    vote_count: seed.voteCount,
    top_comments: seed.comments.map((c, index): RatingCommentItem => ({
      id: `${pollId}-${seed.player.id}-comment${index + 1}`,
      player_id: seed.player.id,
      score: Math.round(seed.averageScore),
      grade: getRatingGrade(seed.averageScore),
      comment: c.comment,
      created_at: new Date(Date.now() - (index + 1) * 6 * 3600_000).toISOString(),
      like_count: c.likeCount,
      is_liked: c.isLiked ?? false,
      user: { display_name: c.display_name, avatar_url: null },
    })),
  }))
}

const OVERALL_RATING_SEEDS: RatingResultSeed[] = [
  {
    player: pope, averageScore: 3.6, voteCount: 1204,
    comments: [
      { display_name: '포프지지자', comment: '결정적인 순간마다 선방을 해줘서 안심하고 볼 수 있었어요.', likeCount: 26 },
      { display_name: 'ToonArmy88', comment: '가끔 빌드업 참여에서 아쉬운 장면이 있었지만 전체적으로 안정적이었습니다.', likeCount: 9 },
    ],
  },
  {
    player: trippier, averageScore: 3.1, voteCount: 1187,
    comments: [
      { display_name: 'NUFC2030', comment: '세트피스 정확도는 여전히 리그 최고 수준이었습니다.', likeCount: 17 },
    ],
  },
  {
    player: bruno, averageScore: 4.2, voteCount: 1256,
    comments: [
      { display_name: '뉴캐슬제다이', comment: '중원 장악력이 압도적이었어요. 이번 시즌 팀 내 최고입니다.', likeCount: 41, isLiked: true },
      { display_name: 'MagpieForever', comment: '패스 정확도와 수비 가담을 동시에 잡은 시즌이었습니다.', likeCount: 20 },
    ],
  },
  {
    player: isak, averageScore: 4.5, voteCount: 1301,
    comments: [
      { display_name: '이삭팬클럽', comment: '득점력이 진짜 리그 최상위권입니다. 시즌 MVP 후보 1순위!', likeCount: 58 },
    ],
  },
  {
    player: gordon, averageScore: 3.8, voteCount: 1163,
    comments: [
      { display_name: 'ToonArmy88', comment: '측면 돌파와 활동량이 눈에 띄게 늘었습니다.', likeCount: 15 },
    ],
  },
  {
    player: wilson, averageScore: 2.9, voteCount: 1092,
    comments: [
      { display_name: 'MagpieForever', comment: '부상 공백이 아쉬웠지만 나올 때마다 제 몫은 해줬어요.', likeCount: 11 },
    ],
  },
]

export const MOCK_RATING_RESULTS: Record<string, RatingResultItem[]> = {
  'poll-7': buildRatingResults('poll-7', OVERALL_RATING_SEEDS),
  'poll-8': buildRatingResults('poll-8', OVERALL_RATING_SEEDS),
}

// ── 댓글 ─────────────────────────────────────────────────────
export type MockComment = {
  id: string
  poll_id: string
  content: string
  created_at: string
  user: { display_name: string | null; avatar_url: string | null }
  like_count: number
  is_liked: boolean
  voted_option_label: string | null
}

export const MOCK_COMMENTS: Record<string, MockComment[]> = {
  'poll-4': [
    {
      id: 'c1', poll_id: 'poll-4',
      content: '트리피어 이번 시즌 정말 최고였습니다! 세트피스 정확도가 리그 최고 수준이었고 오른쪽 측면을 완벽하게 장악했어요.',
      created_at: new Date(Date.now() - 2 * 86400_000).toISOString(),
      user: { display_name: '뉴캐슬제다이', avatar_url: null },
      like_count: 31, is_liked: false, voted_option_label: '시즌 베스트',
    },
    {
      id: 'c2', poll_id: 'poll-4',
      content: '수비가 조금 불안했던 경기들도 있었지만 전체적으로 훌륭한 시즌이었습니다. 챔피언스리그에서의 활약이 특히 인상적이었어요.',
      created_at: new Date(Date.now() - 3 * 86400_000).toISOString(),
      user: { display_name: 'MagpieForever', avatar_url: null },
      like_count: 14, is_liked: true, voted_option_label: '훌륭한 경기',
    },
    {
      id: 'c3', poll_id: 'poll-4',
      content: '등번호 2번의 자존심을 지켜줬습니다. 다음 시즌도 기대됩니다 ⚫⚪',
      created_at: new Date(Date.now() - 5 * 86400_000).toISOString(),
      user: { display_name: 'NUFC2030', avatar_url: null },
      like_count: 8, is_liked: false, voted_option_label: '시즌 베스트',
    },
  ],
  'poll-1': [
    {
      id: 'c4', poll_id: 'poll-1',
      content: '이삭 진짜 ㄷㄷ 맨시티 수비진 상대로 선제골이라니! 이번 시즌 득점왕 노려볼 수 있을 것 같아요',
      created_at: new Date(Date.now() - 1 * 86400_000).toISOString(),
      user: { display_name: '이삭팬클럽', avatar_url: null },
      like_count: 47, is_liked: false, voted_option_label: '시즌 베스트',
    },
    {
      id: 'c5', poll_id: 'poll-1',
      content: '원정에서 이 정도 활약이면 홈에서는 기대 이상이겠네요. 시즌 베스트 맞습니다.',
      created_at: new Date(Date.now() - 18 * 3600_000).toISOString(),
      user: { display_name: 'ToonArmy88', avatar_url: null },
      like_count: 22, is_liked: false, voted_option_label: '훌륭한 경기',
    },
  ],
  'poll-6': [
    {
      id: 'c6', poll_id: 'poll-6',
      content: '닉 포프 올 시즌 선방률 리그 탑이었어요. 그 엄청난 코번트리 선방 기억나시나요?',
      created_at: new Date(Date.now() - 4 * 86400_000).toISOString(),
      user: { display_name: '포프지지자', avatar_url: null },
      like_count: 19, is_liked: false, voted_option_label: '닉 포프',
    },
  ],
}

// ── 마이페이지용 참여 투표 목록 ─────────────────────────────
export type ParticipatedPoll = {
  pollId: string
  pollTitle: string
  optionLabel: string
  votedAt: string
  pollStatus: 'active' | 'closed'
}

export const MOCK_PARTICIPATED: ParticipatedPoll[] = [
  {
    pollId: 'poll-1',
    pollTitle: '이삭 맨시티전 활약 평가',
    optionLabel: '시즌 베스트',
    votedAt: new Date(Date.now() - 1 * 86400_000).toISOString(),
    pollStatus: 'active',
  },
  {
    pollId: 'poll-4',
    pollTitle: '트리피어 이번 시즌 종합 평가',
    optionLabel: '훌륭한 경기',
    votedAt: new Date(Date.now() - 10 * 86400_000).toISOString(),
    pollStatus: 'closed',
  },
  {
    pollId: 'poll-6',
    pollTitle: '24-25 시즌 최고의 수문장',
    optionLabel: '닉 포프',
    votedAt: new Date(Date.now() - 18 * 86400_000).toISOString(),
    pollStatus: 'closed',
  },
]

// ── 승부예측: fixtures (mock 모드용) ─────────────────────────
// 실 스키마와 같은 모양의 행. 날짜는 오늘 기준 상대값이라 목록의 종료/진행중/예정이 항상 다 나온다.
const daysFromNow = (days: number, hour = 20) => {
  const d = new Date(Date.now() + days * 86400_000)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

const NUFC = { id: 10261, name: 'Newcastle' }

function mockFixture(
  fixtureId: number,
  opponent: { id: number; name: string },
  { days, isHome, competition, score }: { days: number; isHome: boolean; competition: string; score?: [number, number] },
): FixtureRow {
  const finished = score !== undefined
  const home = isHome ? NUFC : opponent
  const away = isHome ? opponent : NUFC
  const [ourScore, theirScore] = score ?? [null, null]

  return {
    fixture_id: fixtureId,
    competition_name: competition,
    kickoff_at: daysFromNow(days),
    home_id: home.id,
    home_name: home.name,
    home_score: isHome ? ourScore : theirScore,
    away_id: away.id,
    away_name: away.name,
    away_score: isHome ? theirScore : ourScore,
    started: finished,
    finished,
    cancelled: false,
  }
}

export const MOCK_FIXTURES: FixtureRow[] = [
  mockFixture(9001, { id: 8602, name: 'Wolves' },     { days: -19, isHome: true,  competition: 'Premier League', score: [1, 1] }),
  mockFixture(9002, { id: 8456, name: 'Man City' },   { days: -12, isHome: false, competition: 'Premier League', score: [0, 2] }),
  mockFixture(9003, { id: 8650, name: 'Liverpool' },  { days: -5,  isHome: true,  competition: 'Premier League', score: [2, 0] }),
  mockFixture(9004, { id: 9825, name: 'Arsenal' },    { days: 2,   isHome: false, competition: 'Premier League' }),
  // 9004와 같은 주 — 더블 매치위크(경기 2개 = 한 예측 세션) 확인용.
  // 오픈된 주차에 둬야 목 모드에서 주 단위 제출 플로우까지 밟을 수 있다.
  mockFixture(9006, { id: 9937, name: 'Brentford' },  { days: 3,   isHome: false, competition: 'EFL Cup' }),
  mockFixture(9005, { id: 8455, name: 'Chelsea' },    { days: 9,   isHome: true,  competition: 'Premier League' }),
  mockFixture(9007, { id: 8668, name: 'Everton' },    { days: 30,  isHome: true,  competition: 'Premier League' }),
  // 대회색(TEA-30) 확인용 — 유일한 'Club Friendlies'(yellow). 색이 켜지려면 open 주차(첫 킥오프 7일 이내, 미잠금)에 들어가야 한다.
  mockFixture(9008, { id: 8564, name: 'AC Milan' },   { days: 5,   isHome: false, competition: 'Club Friendlies' }),
]

// ── 승부예측 선수 픽 후보 (season_squads 행과 같은 모양) ─────────────────────
// FotMob player id는 실제 값이지만 옛 스쿼드라 Storage 버킷(players/{id}.png)에는 없다 —
// 목 모드는 애초에 NEXT_PUBLIC_SUPABASE_URL이 없어 photoUrl이 null이므로 전부 실루엣으로 뜬다.
const squadMember = (
  fotmobPlayerId: number,
  name: string,
  nameKo: string,
  position: SeasonSquadRow['position'],
  shirtNumber: number,
  nationality: string,
  dateOfBirth: string,
  multiplier: number,
  isActive = true,
): SeasonSquadRow => ({
  season_id: 'mock-season',
  fotmob_player_id: fotmobPlayerId,
  player_id: null,
  name,
  name_ko: nameKo,
  shirt_number: shirtNumber,
  position,
  position_ids_desc: null,
  nationality_code: null,
  nationality_name: nationality,
  date_of_birth: dateOfBirth,
  transfer_value: null,
  prediction_multiplier: multiplier,
  pick_cost: multiplier >= 2.0 ? 3 : multiplier >= 1.5 ? 2 : 1,
  synced_at: new Date().toISOString(),
  is_active: isActive,
})

export const MOCK_SQUAD: SeasonSquadRow[] = [
  squadMember(577175, 'Sven Botman',        '보트만',     'DEF', 4,  '네덜란드', '2000-01-12', 2.1),
  squadMember(180254, 'Kieran Trippier',    '트리피어',   'DEF', 2,  '잉글랜드', '1990-09-19', 1.4),
  squadMember(184644, 'Fabian Schär',       '스카르',     'DEF', 5,  '스위스',   '1991-12-20', 1.9),
  squadMember(1140067, 'Tino Livramento',   '리브라멘투', 'DEF', 21, '잉글랜드', '2002-11-12', 2.6),
  squadMember(869678, 'Bruno Guimarães',    '기마랑이스', 'MID', 39, '브라질',   '1997-11-16', 1.7),
  squadMember(1088651, 'Sandro Tonali',     '토날리',     'MID', 8,  '이탈리아', '2000-05-08', 1.5),
  squadMember(586826, 'Joe Willock',        '윌록',       'MID', 28, '잉글랜드', '1999-08-20', 1.9),
  squadMember(725364, 'Alexander Isak',     '이사크',     'FWD', 14, '스웨덴',   '1999-09-21', 1.3),
  squadMember(1146398, 'Anthony Gordon',    '고든',       'FWD', 10, '잉글랜드', '2001-02-24', 1.6),
  squadMember(487126, 'Harvey Barnes',      '반스',       'FWD', 15, '잉글랜드', '1997-12-09', 2.0),
  // GK는 픽 후보에서 걸러지는지 확인용
  squadMember(233450, 'Nick Pope',          '포프',       'GK',  22, '잉글랜드', '1992-04-19', 1.1),
  // 이적(떠난 선수) 필터 확인용 — 선수 픽 모달엔 안 보이지만 과거 픽 이름 표시는 그대로 유지돼야 한다
  squadMember(292462, 'Callum Wilson',      '윌슨',       'FWD', 9,  '잉글랜드', '1992-02-27', 1.8, false),
]

// ── 승부예측 랭킹 (week_leaderboard / season_leaderboard 결과와 같은 모양) ─────
// 목 모드는 로그인 사용자가 고정이라 isMe도 고정이다. 실제 view는 순위 변동을 내려주지 않으므로
// 여기에도 delta는 없다.
export const MOCK_RANKING = [
  { userId: 'mock-1', rank: 1, name: '김민준', avatarUrl: null, matchPoints: 3, pickPoints: 12, totalPoints: 15, isMe: false },
  { userId: 'mock-2', rank: 2, name: '이서연', avatarUrl: null, matchPoints: 2, pickPoints: 11, totalPoints: 13, isMe: false },
  { userId: 'mock-3', rank: 3, name: '정하윤', avatarUrl: null, matchPoints: 3, pickPoints: 9, totalPoints: 12, isMe: false },
  { userId: 'mock-me', rank: 4, name: '나', avatarUrl: null, matchPoints: 3, pickPoints: 5, totalPoints: 8, isMe: true },
  { userId: 'mock-5', rank: 5, name: '박지훈', avatarUrl: null, matchPoints: 0, pickPoints: 8, totalPoints: 8, isMe: false },
  { userId: 'mock-6', rank: 6, name: '최유진', avatarUrl: null, matchPoints: 2, pickPoints: 3, totalPoints: 5, isMe: false },
  { userId: 'mock-7', rank: 7, name: '강태양', avatarUrl: null, matchPoints: 0, pickPoints: 2, totalPoints: 2, isMe: false },
  { userId: 'mock-8', rank: 8, name: '윤소율', avatarUrl: null, matchPoints: 0, pickPoints: 0, totalPoints: 0, isMe: false },
]

// ── 승부예측 채점 결과 (prediction_results view 행과 같은 모양) ─────────────
// 목 모드에서 결과 화면의 "참여" 경로를 눌러볼 수 있게 종료된 경기 두 건에만 결과를 심는다.
// 9002(맨시티 원정)는 일부러 비워서 "마감돼서 참여하지 못한 경기" 경로도 같이 확인된다.
// 배당(×2.1 등)은 제출 스냅샷에서 오므로 여기 없다 — 목 모드에선 제출 쿠키가 없으면 배당 줄이 빠진다.
export const MOCK_RESULTS = {
  '9001': {
    predicted: [1, 1] as [number, number],
    matchPoints: 3,
    pickPoints: 5,
    totalPoints: 8,
    picks: {
      DEF: { playerId: 577175, rating: 7.8, points: 5 },
      MID: { playerId: 869678, rating: 6.3, points: 0 },
      FWD: { playerId: 725364, rating: 5.4, points: 0 },
    },
  },
  '9003': {
    predicted: [2, 1] as [number, number],
    matchPoints: 2,
    pickPoints: 8,
    totalPoints: 10,
    picks: {
      DEF: { playerId: 184644, rating: 6.2, points: 0 },
      MID: { playerId: 869678, rating: 7.4, points: 4 },
      FWD: { playerId: 725364, rating: 8.1, points: 4 },
    },
  },
}

// ── 포지션별 평점 TOP3 원본 (fixture_player_ratings 테이블과 같은 모양: player_id, rating) ──
// MOCK_SQUAD에 있는 선수 id만 재사용한다 — 새 id를 지어내지 않는다. MOCK_RESULTS의 내 픽과
// 같은 id·rating을 포함시켜(예: '9001' DEF 577175=7.8) 내 픽 강조(isMine)와 픽 카드에 이미
// 보이는 평점이 서로 어긋나지 않게 한다. 실제 조회(getFixturePositionTop3)와 같이 포지션별
// 상위 3명만 골라 쓰므로, 포지션당 후보가 3명 넘게 있어도 그대로 다 넣어둔다.
export const MOCK_FIXTURE_RATINGS: Record<string, { playerId: number; rating: number }[]> = {
  '9001': [
    { playerId: 577175, rating: 7.8 }, // DEF · 보트만 · 내 픽
    { playerId: 1140067, rating: 7.5 }, // DEF · 리브라멘투
    { playerId: 184644, rating: 6.9 }, // DEF · 스카르
    { playerId: 180254, rating: 6.1 }, // DEF · 트리피어
    { playerId: 586826, rating: 7.2 }, // MID · 윌록
    { playerId: 869678, rating: 6.3 }, // MID · 기마랑이스 · 내 픽
    { playerId: 1088651, rating: 5.8 }, // MID · 토날리
    { playerId: 487126, rating: 7.6 }, // FWD · 반스
    { playerId: 1146398, rating: 6.0 }, // FWD · 고든
    { playerId: 725364, rating: 5.4 }, // FWD · 이사크 · 내 픽
  ],
  '9003': [
    { playerId: 577175, rating: 7.9 }, // DEF · 보트만
    { playerId: 1140067, rating: 6.8 }, // DEF · 리브라멘투
    { playerId: 184644, rating: 6.2 }, // DEF · 스카르 · 내 픽
    { playerId: 180254, rating: 5.5 }, // DEF · 트리피어
    { playerId: 869678, rating: 7.4 }, // MID · 기마랑이스 · 내 픽
    { playerId: 1088651, rating: 6.5 }, // MID · 토날리
    { playerId: 586826, rating: 5.9 }, // MID · 윌록
    { playerId: 725364, rating: 8.1 }, // FWD · 이사크 · 내 픽
    { playerId: 1146398, rating: 7.0 }, // FWD · 고든
    { playerId: 487126, rating: 6.4 }, // FWD · 반스
  ],
}
