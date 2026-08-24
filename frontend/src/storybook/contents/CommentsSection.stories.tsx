import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { CommentsSection } from '@/components/composition/polls/CommentsSection'
import type { CommentItem } from '@/lib/queries/comments'

function mockComment(overrides: Partial<CommentItem>): CommentItem {
  return {
    id: 'c1',
    poll_id: 'poll-1',
    content: '이건 진짜 고민되네요. 그래도 최근 폼 보면 답이 하나뿐인 것 같습니다.',
    created_at: new Date(Date.now() - 40 * 60_000).toISOString(),
    user: { display_name: '툰아미', avatar_url: null },
    like_count: 3,
    is_liked: false,
    is_mine: false,
    voted_option_label: '브루노 기마랑이스',
    ...overrides,
  }
}

const COMMENTS: CommentItem[] = [
  mockComment({ id: 'c1' }),
  mockComment({
    id: 'c2',
    user: { display_name: '세인트제임스', avatar_url: null },
    created_at: new Date(Date.now() - 5 * 3_600_000).toISOString(),
    // 긴 본문 — 줄바꿈 시 아바타/이름 줄과 좋아요 버튼 정렬이 안 무너지는지 본다.
    content: '전반전만 보면 확실히 미드필드가 경기를 지배했다고 생각합니다. 다만 후반에 체력이 떨어지면서 뒷공간을 계속 내줬고, 그때 수비진이 버텨준 게 결과적으로 승점 3점을 지킨 결정적인 장면이었다고 봅니다. 그래서 저는 최우수 선수를 수비쪽에서 골랐어요.',
    voted_option_label: '스벤 보트만',
    like_count: 27,
    is_liked: true,
  }),
  mockComment({
    id: 'c3',
    user: { display_name: null, avatar_url: null },
    created_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    content: '노코멘트',
    // display_name이 null이면 '익명' + 이니셜 '?'로 떨어진다.
    voted_option_label: null,
    like_count: 0,
  }),
]

const meta = {
  title: 'Composition/Polls/CommentsSection',
  component: CommentsSection,
  // 실제로는 결과 화면(max-w-detail 680px, px-4) 안에 들어가는 블록이라 그 폭으로 맞춘다.
  decorators: [(Story: () => React.JSX.Element) => <div style={{ maxWidth: 648 }}><Story /></div>],
  args: {
    pollId: 'poll-1',
    pollType: 'selection',
    pollStatus: 'active',
    creatorType: 'admin',
    initialComments: COMMENTS,
    // 좋아요는 mock 모드에서 서버 액션을 건너뛰고 로컬 상태만 바꾼다 —
    // Storybook에서 유일하게 실제로 눌러볼 수 있는 상호작용이다.
    isMockMode: true,
    myVotedOptionLabel: '브루노 기마랑이스',
    canComment: true,
  },
} satisfies Meta<typeof CommentsSection>

export default meta
type Story = StoryObj<typeof meta>

/** 기본 — 입력창 + 목록. 각 댓글에 작성자의 투표 항목 칩이 붙는다(이 서비스 댓글의 특징). */
export const Default: Story = {}

/** 댓글이 없을 때 — 목록 카드는 그대로 두고 "첫 번째 댓글을 남겨보세요"만 보여준다(입력창은 계속 노출). */
export const Empty: Story = {
  args: { initialComments: [] },
}

/**
 * 내 댓글 — `is_mine`이 true인 항목만 우측에 수정/삭제가 붙는다. 남의 댓글에는 좋아요만 있다.
 * (수정 폼 자체는 이 스토리에서 "수정"을 눌러 열 수 있지만, 저장은 서버 액션이라 동작하지 않는다.)
 */
export const MineAndOthers: Story = {
  args: {
    initialComments: [
      mockComment({
        id: 'mine',
        user: { display_name: '나', avatar_url: null },
        content: '저는 골키퍼요. 그 선방 없었으면 이겼다는 말도 못 했을 겁니다.',
        created_at: new Date(Date.now() - 30_000).toISOString(),
        is_mine: true,
        voted_option_label: '닉 포프',
        like_count: 5,
      }),
      ...COMMENTS,
    ],
  },
}

/**
 * 투표에 참여하지 않은 상태 — `canComment: false`면 **입력창이 렌더되지 않고**,
 * "댓글" 제목 아래에 왜 쓸 수 없는지 한 줄이 붙는다. 이 값은 DB RLS
 * (`comments: insert for voters`)와 같은 조건이라, 여기서 막지 않으면 제출이 서버에서
 * 조용히 실패한다(막기 전에는 실제로 그랬다).
 */
export const WithoutMyVote: Story = {
  args: { canComment: false, myVotedOptionLabel: null },
}

/**
 * 마감된 투표 + 비참여자 — 비참여자가 이 UI를 보게 되는 유일한 경로다
 * (결과 화면이 `isClosed || hasVoted`로 열리므로). 이때는 앞으로도 참여할 수 없으니
 * 안내 문구가 "참여하면 쓸 수 있다"가 아니라 "참여하지 않아 쓸 수 없다"로 바뀐다.
 */
export const ClosedPollWithoutVote: Story = {
  args: { pollStatus: 'closed', canComment: false, myVotedOptionLabel: null },
}

/**
 * 마감된 투표 + 참여자 — **마감 후에도 참여자는 댓글을 쓸 수 있다.** 입력 가능 여부는
 * 마감이 아니라 참여로만 갈린다(RLS도 `votes` 존재만 확인하고 `polls.status`는 보지 않는다).
 */
export const ClosedPollAsVoter: Story = {
  args: { pollStatus: 'closed' },
}
