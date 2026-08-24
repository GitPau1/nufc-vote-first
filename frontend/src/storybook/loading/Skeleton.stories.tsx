import type { Meta, StoryObj } from '@storybook/nextjs-vite'

/**
 * `NavigationLoading.tsx`의 `SkeletonBlock`을 그대로 옮긴 것.
 * 원본은 export되지 않는 내부 함수이고, 감싸는 `NavigationLoading`은 라우팅 클릭을
 * 가로채야만 렌더되는 클라이언트 컴포넌트라 스토리에서 직접 띄울 수 없다.
 * 소스를 고치지 않기 위해 마크업만 동일하게 복제했다.
 */
function SkeletonBlock({ className }: { className: string }) {
  return (
    <div className={`overflow-hidden bg-disabled ${className}`}>
      <div className="h-full w-full animate-skeleton" />
    </div>
  )
}

// 실제 스켈레톤은 max-w-shell(480px) 오버레이 안에서 px-5로 그려진다.
// 화면 스켈레톤 스토리는 그 폭 안에서만 비율이 맞으므로 모바일 폭으로 가둔다.
const screenDecorator = [
  (Story: () => React.JSX.Element) => (
    <div className="w-[375px] border border-border bg-background">
      <Story />
    </div>
  ),
]

const meta = {
  title: 'Loading/Skeleton',
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/**
 * 스켈레톤을 구성하는 3가지 형상 — bar(텍스트 한 줄), circle(아바타), card(썸네일·미디어).
 * 형상 차이는 전부 radius로만 낸다. Radius foundation이 대상별로 정해둔 값을 그대로 따른다:
 * 텍스트·작은 배지 자리는 `rounded-xs`, 원형 아바타 자리는 `rounded-pill`, 썸네일은 `rounded-md`.
 */
export const Primitives: Story = {
  render: () => (
    <div className="w-80 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-col gap-3">
        <SkeletonBlock className="h-5 w-16 rounded-xs" />
        <SkeletonBlock className="h-4 w-4/5 rounded-xs" />
        <SkeletonBlock className="h-3 w-3/5 rounded-xs" />
      </div>

      <div className="mt-5 flex items-center gap-4">
        <SkeletonBlock className="h-14 w-14 rounded-pill" />
        <SkeletonBlock className="h-24 w-24 rounded-md" />
      </div>
    </div>
  ),
}

/**
 * 홈(`/`)·투표 목록(`/polls`) 진입 로딩. `NavigationLoading`의 `PollsSkeleton`.
 *
 * 히어로 영역만 `SkeletonBlock`을 쓰지 않고 `animate-skeleton bg-disabled`를 카드에 직접 얹는다 —
 * 252px 미디어 전체가 한 덩어리 placeholder라서 안쪽 래퍼가 필요 없다.
 * 탭 3개 중 첫 번째만 `border-brand-solid`로 남겨 "탭은 이미 그려져 있고 목록만 비어 있는" 상태를 흉내낸다.
 */
export const PollsScreen: Story = {
  decorators: screenDecorator,
  render: () => (
    <div aria-hidden="true" className="flex-1 px-5 pb-24 pt-4">
      <div className="h-[252px] overflow-hidden rounded-lg bg-surface shadow-w200">
        <div className="h-full animate-skeleton bg-disabled" />
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-border bg-surface p-px">
        <div className="flex px-3 pt-4">
          <div className="h-8 flex-1 border-b border-brand-solid" />
          <div className="h-8 flex-1 border-b border-border" />
          <div className="h-8 flex-1 border-b border-border" />
        </div>

        <div className="divide-y divide-border">
          {[0, 1, 2].map(index => (
            <div key={index} className="flex h-32 items-center gap-4 py-4 pl-3 pr-5">
              <SkeletonBlock className="h-24 w-24 shrink-0 rounded-md" />
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <SkeletonBlock className="h-5 w-16 rounded-xs" />
                <SkeletonBlock className="h-4 w-4/5 rounded-xs" />
                <SkeletonBlock className="h-3 w-3/5 rounded-xs" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  ),
}

/**
 * 선수 목록(`/players`) 진입 로딩. `NavigationLoading`의 `MenuSkeleton`보다 구조가 깊다 —
 * 상단 MVP 2칸 카드 + 검색 입력 + 랭킹 리스트까지 실제 화면의 3개 섹션을 그대로 흉내낸다.
 */
export const PlayersScreen: Story = {
  decorators: screenDecorator,
  render: () => (
    <div aria-hidden="true" className="flex-1 px-5 pb-24 pt-4">
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="flex justify-center border-b border-border px-3.5 pb-[13px] pt-3">
          <SkeletonBlock className="h-6 w-32 rounded-xs" />
        </div>
        <div className="flex justify-center px-4 pt-3">
          <SkeletonBlock className="h-4 w-36 rounded-xs" />
        </div>
        <div className="relative h-[168px] px-4 pt-5">
          <div className="grid grid-cols-2 gap-5">
            {[0, 1].map(index => (
              <div
                key={index}
                className="flex h-32 flex-1 flex-col items-center justify-center gap-2.5 rounded-lg bg-disabled/70 p-3"
              >
                <SkeletonBlock className="h-14 w-14 rounded-pill" />
                <SkeletonBlock className="h-4 w-20 rounded-xs" />
                <SkeletonBlock className="h-3 w-16 rounded-xs" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-3 mt-3 flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-3">
        <SkeletonBlock className="h-4 w-4 rounded-xs" />
        <SkeletonBlock className="h-4 flex-1 rounded-xs" />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="flex h-10 items-center justify-between border-b border-border px-3.5">
          <SkeletonBlock className="h-3 w-20 rounded-xs" />
          <SkeletonBlock className="h-3 w-12 rounded-xs" />
        </div>
        {[0, 1, 2, 3].map(index => (
          <div
            key={index}
            className="flex h-[68px] items-center gap-2.5 border-b border-border px-3.5 py-2.5 last:border-b-0"
          >
            <SkeletonBlock className="h-6 w-6 shrink-0 rounded-xs" />
            <SkeletonBlock className="h-[42px] w-[42px] shrink-0 rounded-pill" />
            <div className="min-w-0 flex-1">
              <SkeletonBlock className="h-4 w-32 rounded-xs" />
              <SkeletonBlock className="mt-2 h-3 w-24 rounded-xs" />
            </div>
            <SkeletonBlock className="h-5 w-8 shrink-0 rounded-xs" />
          </div>
        ))}
      </div>
    </div>
  ),
}

/**
 * 메뉴(`/menu`) 진입 로딩. 제목 2줄 + 균일한 56px 행 5개 — 가장 단순한 스켈레톤이다.
 */
export const MenuScreen: Story = {
  decorators: screenDecorator,
  render: () => (
    <div aria-hidden="true" className="flex-1 px-5 pb-24 pt-6">
      <div className="mb-5">
        <SkeletonBlock className="h-7 w-16 rounded-xs" />
        <SkeletonBlock className="mt-2 h-4 w-64 max-w-full rounded-xs" />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        {[0, 1, 2, 3, 4].map(index => (
          <div
            key={index}
            className="flex h-14 items-center gap-3 border-b border-border px-4 last:border-b-0"
          >
            <SkeletonBlock className="h-8 w-8 shrink-0 rounded-md" />
            <SkeletonBlock className="h-4 flex-1 rounded-xs" />
            <SkeletonBlock className="h-4 w-4 shrink-0 rounded-xs" />
          </div>
        ))}
      </div>
    </div>
  ),
}

/**
 * 위 3개 경로가 아닌 모든 화면의 로딩 — 스켈레톤 대신 상단 4px 진행 바만 뜬다.
 * 원본은 `fixed top-0 z-[100]`이라 스토리에서는 `relative`로 바꿔야 캔버스 안에 보인다.
 */
export const TopBar: Story = {
  decorators: screenDecorator,
  render: () => (
    <div
      role="status"
      aria-label="페이지를 불러오는 중"
      className="pointer-events-none relative h-1 w-full overflow-hidden bg-disabled"
    >
      <div className="h-full w-1/2 animate-[loading-bar_1s_ease-in-out_infinite] rounded-r-pill bg-brand-solid" />
    </div>
  ),
}
