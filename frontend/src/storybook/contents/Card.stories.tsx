import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

// 이 앱의 Card는 전부 모바일 단일 컬럼(PageContainer) 안에서 쓰인다 —
// 데스크탑 와이드 캔버스 그대로 두면 실제 배치와 여백 느낌이 달라진다.
const mobileWidth = { decorators: [(Story: () => React.JSX.Element) => <div style={{ maxWidth: 358 }}><Story /></div>] }

const meta = {
  title: 'Contents/Card',
  component: Card,
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

/**
 * shadcn 원본이 제공하는 6개 서브 컴포넌트를 전부 조합한 형태.
 * 다만 앱 코드에서 실제로 쓰이는 건 `Card` + `CardContent` 뿐이다(MDX의 서브 컴포넌트 표 참고) —
 * 이 스토리는 "쓸 수 있는 슬롯이 뭔지"를 보여주기 위한 것이고, 새 화면의 기준 형태가 아니다.
 */
export const Default: Story = {
  ...mobileWidth,
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>이번 시즌 최고의 활약을 펼친 선수는?</CardTitle>
        <CardDescription>투표는 제출 후 수정할 수 없습니다.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-label-1-normal text-neutral">본문 슬롯. 기본 패딩은 `p-4 pt-0`이라 Header 아래에 붙는 것을 전제한다.</p>
      </CardContent>
      <CardFooter>
        <Button size="sm">투표하기</Button>
      </CardFooter>
    </Card>
  ),
}

/**
 * 실사용 형태 1 — 투표 상세의 선수 정보 카드(`polls/TypeAPollClient.tsx`).
 * `CardContent`에 `p-4`를 다시 명시해 기본값 `pt-0`을 덮는다. Header 없이 Content만 쓸 때
 * 이걸 빼면 카드 위쪽 패딩이 사라지는 게 이 컴포넌트의 가장 흔한 함정이다.
 */
export const ContentOnly: Story = {
  ...mobileWidth,
  render: () => (
    <Card className="mt-1">
      <CardContent className="p-4">
        <p className="mb-3 text-caption-1 font-semibold uppercase text-neutral-muted">선수 정보</p>
        <div className="flex items-center gap-3">
          <img
            src="https://placehold.co/44x44/0c2340/41b6e6?text=9"
            alt="알렉산더 이삭"
            className="h-11 w-11 flex-shrink-0 rounded-full object-cover ring-2 ring-border"
          />
          <div>
            <p className="text-label-1-normal font-bold text-neutral">알렉산더 이삭</p>
            <p className="mt-0.5 text-caption-1 text-neutral-muted">
              FW
              <span className="mx-1.5">·</span>
              <span className="font-semibold text-brand">#14</span>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  ),
}

/**
 * 실사용 형태 2 — 마이페이지 "참여한 투표" 목록(`my/MyPageClient.tsx`).
 * 목록을 담을 때는 `CardContent`에 `p-0`을 줘서 패딩을 각 행이 직접 갖고,
 * 행 사이는 [Separator](?path=/docs/presentation-separator--docs)로 나눈다 —
 * 이러면 눌리는 영역(Link)이 카드 폭 전체가 된다.
 */
export const ListContainer: Story = {
  ...mobileWidth,
  render: () => (
    <Card>
      <CardContent className="p-0">
        {['이번 시즌 최고의 활약을 펼친 선수는?', '다음 경기 선발 골키퍼는?'].map((title, i) => (
          <div key={title}>
            {i > 0 && <Separator />}
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-label-1-normal font-semibold text-neutral">{title}</p>
                <p className="mt-1 text-caption-2 text-neutral-muted">알렉산더 이삭 · 2026.08.20</p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  ),
}
