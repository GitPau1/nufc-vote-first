import type { PlayerRow, PollOptionRow } from '@/types/database'
import type { PollDetail, PollListItem, VoteCountMap } from '@/lib/queries/polls'

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

// ── 더미 투표 목록 ───────────────────────────────────────────
export const MOCK_POLL_LIST: PollListItem[] = [
  {
    id: 'poll-1',
    type: 'evaluation',
    title: '이삭 맨시티전 활약 평가',
    status: 'active',
    closes_at: new Date(Date.now() + 5 * 86400_000).toISOString(),
    scheduled_at: null,
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
    scheduled_at: null,
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
    scheduled_at: null,
    created_at: new Date(Date.now() - 4 * 86400_000).toISOString(),
    player_id: bruno.id,
    player: bruno,
    poll_options: evalOptions('poll-2'),
    vote_count: 1534,
  },
  {
    id: 'poll-3',
    type: 'evaluation',
    title: '고든 아스날전 측면 돌파 평점',
    status: 'scheduled',
    closes_at: new Date(Date.now() + 9 * 86400_000).toISOString(),
    scheduled_at: new Date(Date.now() + 3 * 86400_000).toISOString(),
    created_at: new Date(Date.now() - 1 * 86400_000).toISOString(),
    player_id: gordon.id,
    player: gordon,
    poll_options: evalOptions('poll-3'),
    vote_count: 0,
  },
  {
    id: 'poll-4',
    type: 'evaluation',
    title: '트리피어 이번 시즌 종합 평가',
    status: 'closed',
    closes_at: new Date(Date.now() - 3 * 86400_000).toISOString(),
    scheduled_at: null,
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
    scheduled_at: null,
    created_at: new Date(Date.now() - 20 * 86400_000).toISOString(),
    player_id: null,
    player: null,
    poll_options: [
      { id: 'poll-6-opt1', poll_id: 'poll-6', label: '닉 포프',         player_id: pope.id,    display_order: 1 },
      { id: 'poll-6-opt2', poll_id: 'poll-6', label: '마틴 두브라브카', player_id: null,       display_order: 2 },
    ],
    vote_count: 3187,
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
  'poll-3': {
    id: 'poll-3', type: 'evaluation', status: 'scheduled',
    title: '고든 아스날전 측면 돌파 평점',
    description: '아스날 원정에서 앤서니 고든의 측면 활동량과 돌파력을 평가해주세요.',
    closes_at: new Date(Date.now() + 9 * 86400_000).toISOString(),
    player_id: gordon.id, player: gordon,
    poll_options: evalOptions('poll-3'),
  },
  'poll-4': {
    id: 'poll-4', type: 'evaluation', status: 'closed',
    title: '트리피어 이번 시즌 종합 평가',
    description: '키어런 트리피어의 이번 시즌 오른쪽 측면 수비 및 공격 가담을 종합 평가해주세요. 세트피스 기여도도 고려해 선택해주세요.',
    closes_at: new Date(Date.now() - 3 * 86400_000).toISOString(),
    player_id: trippier.id, player: trippier,
    poll_options: evalOptions('poll-4'),
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
}

// ── 투표 집계 ─────────────────────────────────────────────────
export const MOCK_VOTE_COUNTS: Record<string, VoteCountMap> = {
  'poll-1': { 'poll-1-opt1': 1124, 'poll-1-opt2': 982, 'poll-1-opt3': 521, 'poll-1-opt4': 220 },
  'poll-2': { 'poll-2-opt1': 743,  'poll-2-opt2': 489, 'poll-2-opt3': 213, 'poll-2-opt4': 89  },
  'poll-4': { 'poll-4-opt1': 1842, 'poll-4-opt2': 1397,'poll-4-opt3': 712, 'poll-4-opt4': 268 },
  'poll-5': { 'poll-5-opt1': 1203, 'poll-5-opt2': 876, 'poll-5-opt3': 412 },
  'poll-6': { 'poll-6-opt1': 2614, 'poll-6-opt2': 573 },
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
  pollStatus: 'scheduled' | 'active' | 'closed'
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
