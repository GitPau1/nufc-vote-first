import type { Meta, StoryObj } from '@storybook/nextjs-vite'

/**
 * `navigation-loading.tsx`의 `SkeletonBlock`을 그대로 옮긴 것.
 * 원본은 export되지 않는 내부 함수이고, 감싸는 `NavigationLoading`은 라우팅 클릭을
 * 가로채야만 렌더되는 클라이언트 컴포넌트라 스토리에서 직접 띄울 수 없다.
 * 소스를 고치지 않기 위해 마크업만 동일하게 복제했다 — 아래 화면 스토리들과
 * 헬퍼(`PollRowSkeleton`·`PollTabsSkeleton`·`TeamSideSkeleton`·`PickOneCardSkeleton`)도
 * 전부 같은 이유의 복제이며, 원본이 바뀌면 여기도 같이 고친다.
 */
function SkeletonBlock({ className }: { className: string }) {
  return (
    <div className={`overflow-hidden bg-disabled ${className}`}>
      <div className="h-full w-full animate-skeleton" />
    </div>
  )
}

// 실제 스켈레톤은 max-w-shell(480px) 오버레이 안에서 px-5로 그려진다.
// 화면 스켈레톤 스토리는 그 폭 안에서만 비율이 맞으므로 모바일 폭으로 가둔다 —
// 원본의 `sm:` 분기(데스크탑 그리드·데스크탑 전용 카드)는 375px 캔버스에서 보이지 않는다.
const screenDecorator = [
  (Story: () => React.JSX.Element) => (
    <div className="w-[375px] border border-neutral-weak bg-page">
      <Story />
    </div>
  ),
]

/** PollCard(h-32, pl-3 pr-5 py-4) 실측 — `navigation-loading.tsx` `PollRowSkeleton` 복제 */
function PollRowSkeleton() {
  return (
    <div className="flex h-32 items-center gap-4 py-4 pl-3 pr-5">
      <SkeletonBlock className="h-24 w-24 shrink-0 rounded-md" />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <SkeletonBlock className="h-[21px] w-16 rounded-xs" />
        <SkeletonBlock className="h-4 w-4/5 rounded-xs" />
        <SkeletonBlock className="h-3.5 w-3/5 rounded-xs" />
      </div>
    </div>
  )
}

/** PollTabs(h-8 flex-1 border-b, 첫 탭 활성) 실측 — `PollTabsSkeleton` 복제 */
function PollTabsSkeleton() {
  return (
    <div className="flex w-full">
      {[0, 1, 2].map(index => (
        <div
          key={index}
          className={`flex h-8 flex-1 justify-center border-b ${index === 0 ? 'border-brand-solid' : 'border-neutral-weak'}`}
        >
          <SkeletonBlock className="h-[18px] w-9 rounded-xs" />
        </div>
      ))}
    </div>
  )
}

/** MatchInfoRow의 TeamSide(w-[84px], 48px 엠블럼) 실측 — `TeamSideSkeleton` 복제 */
function TeamSideSkeleton() {
  return (
    <div className="flex w-[84px] shrink-0 flex-col items-center gap-1.5">
      <SkeletonBlock className="h-12 w-12 rounded-xs" />
      <SkeletonBlock className="h-[18px] w-14 rounded-xs" />
    </div>
  )
}

/** PickOneCard: absolute left-0 top-5, w-[calc((100%-49px)/2)], slotClass의 translate까지 그대로 — `PickOneCardSkeleton` 복제 */
function PickOneCardSkeleton({ translate }: { translate: string }) {
  return (
    <div
      className={`absolute left-0 top-5 flex h-32 w-[calc((100%_-_49px)/2)] flex-col items-center justify-center gap-2.5 rounded-lg bg-neutral-strong p-3 ${translate}`}
    >
      <div className="h-14 w-14 overflow-hidden rounded-pill border border-neutral-weak bg-page">
        <div className="h-full w-full animate-skeleton bg-disabled" />
      </div>
      <SkeletonBlock className="h-5 w-20 rounded-xs" />
      <SkeletonBlock className="h-3.5 w-16 rounded-xs" />
    </div>
  )
}

const meta = {
  title: 'Primitives/Skeleton',
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
    <div className="w-80 rounded-lg border border-neutral-weak bg-surface p-4">
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
 * 히어로 영역만 `SkeletonBlock`을 쓰지 않고 `animate-skeleton`을 `bg-disabled` 카드에 직접 얹는다 —
 * 252px 미디어 전체가 한 덩어리 placeholder라서 안쪽 래퍼가 필요 없다.
 * 탭 3개 중 첫 번째만 `border-brand-solid`로 남겨 "탭은 이미 그려져 있고 목록만 비어 있는" 상태를 흉내낸다.
 * 데스크탑 카드 그리드 분기(`hidden sm:grid`)는 375px 캔버스에서 렌더되지 않는다.
 */
export const PollsScreen: Story = {
  decorators: screenDecorator,
  render: () => (
    <div aria-hidden="true" className="flex-1 px-5 pt-4 pb-24 sm:pb-10">
      {/* PollHeroCard: h-[252px] rounded-lg bg-disabled */}
      <div className="h-[252px] overflow-hidden rounded-lg bg-disabled">
        <div className="h-full w-full animate-skeleton" />
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-neutral-weak bg-surface p-px sm:overflow-visible sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0">
        <div className="px-3 pt-4 sm:px-0 sm:pt-0">
          <PollTabsSkeleton />
        </div>

        {/* 모바일: 한 줄 리스트 / 데스크탑: 카드 그리드 — PollListClient와 같은 분기 */}
        <div className="divide-y divide-neutral-weak sm:hidden">
          {[0, 1, 2].map(index => (
            <PollRowSkeleton key={index} />
          ))}
        </div>
        <div className="hidden sm:grid sm:grid-cols-2 sm:gap-4 sm:pt-4 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map(index => (
            <div key={index} className="overflow-hidden rounded-lg border border-neutral-weak bg-surface">
              <PollRowSkeleton />
            </div>
          ))}
        </div>
      </div>
    </div>
  ),
}

/**
 * 승부예측 목록(`/predictions`) 진입 로딩. `NavigationLoading`의 `PredictionsSkeleton`.
 * 월 네비게이션 + 주차 카드 2개. 데스크탑 전용 RankingCard 자리 2개는
 * `hidden sm:flex`라 375px 캔버스에서 렌더되지 않는다.
 */
export const PredictionsScreen: Story = {
  decorators: screenDecorator,
  render: () => (
    <div aria-hidden="true" className="flex-1 px-4 pt-4 pb-24 sm:px-10 sm:pb-10">
      <div className="sm:grid sm:grid-cols-[2fr_1fr] sm:items-start sm:gap-x-10">
        <div>
          {/* 월 네비게이션: mb-4, title-3 라벨 + h-8 w-8 원형 버튼 2개 */}
          <div className="mb-4 flex items-center justify-between">
            <SkeletonBlock className="h-8 w-16 rounded-xs" />
            <div className="flex gap-0.5">
              <SkeletonBlock className="h-8 w-8 rounded-xs" />
              <SkeletonBlock className="h-8 w-8 rounded-xs" />
            </div>
          </div>

          <div className="flex flex-col gap-6">
            {[0, 1].map(week => (
              <section key={week}>
                <SkeletonBlock className="mb-2 ml-0.5 h-5 w-14 rounded-xs" />
                <div className="overflow-hidden rounded-lg border border-neutral-weak bg-surface">
                  <div className="p-3.5">
                    <div className="mb-4 flex items-center justify-between">
                      <SkeletonBlock className="h-4 w-20 rounded-xs" />
                      <SkeletonBlock className="h-4 w-14 rounded-xs" />
                    </div>
                    <div className="flex items-center justify-center gap-4 py-1.5">
                      <TeamSideSkeleton />
                      <div className="flex min-w-16 flex-col items-center gap-0.5">
                        <SkeletonBlock className="h-3.5 w-8 rounded-xs" />
                        <SkeletonBlock className="h-[22px] w-14 rounded-xs" />
                      </div>
                      <TeamSideSkeleton />
                    </div>
                  </div>
                  {/* 상태줄: border-t p-3.5 pt-3 */}
                  <div className="flex items-center justify-between gap-2 border-t border-neutral-weak p-3.5 pt-3">
                    <SkeletonBlock className="h-5 w-12 rounded-xs" />
                    <SkeletonBlock className="h-[18px] w-16 rounded-xs" />
                  </div>
                </div>
              </section>
            ))}
          </div>
        </div>

        {/* RankingCard 2개 — 데스크탑에서만, 아직 entries가 비어 제목 + 안내문만 나온다 */}
        <div className="hidden flex-col gap-4 sm:flex">
          {[0, 1].map(card => (
            <div key={card} className="rounded-lg border border-neutral-weak bg-surface p-4">
              <SkeletonBlock className="mb-3 h-[22px] w-24 rounded-xs" />
              <SkeletonBlock className="h-4 w-40 max-w-full rounded-xs" />
            </div>
          ))}
        </div>
      </div>
    </div>
  ),
}

/**
 * 선수 목록(`/players`) 진입 로딩. `NavigationLoading`의 `PlayersSkeleton`.
 * Pick One 카드 2장(absolute + translate로 실제 `slotClass` 배치까지 재현) + VS 마커 +
 * 제출 버튼 자리 + 검색 입력 + 랭킹 리스트 — 실제 화면의 3개 섹션을 그대로 흉내낸다.
 */
export const PlayersScreen: Story = {
  decorators: screenDecorator,
  render: () => (
    <div aria-hidden="true" className="flex-1 px-5 pt-4 pb-24 sm:pb-10">
      {/* PickOneSection */}
      <section className="mb-3 overflow-hidden rounded-lg border border-neutral-weak bg-surface">
        <div className="flex justify-center border-b border-neutral-weak px-3.5 pb-3 pt-3">
          <SkeletonBlock className="h-6 w-28 rounded-xs" />
        </div>
        <div className="flex justify-center px-4 pt-3">
          <SkeletonBlock className="h-4 w-32 rounded-xs" />
        </div>

        <div className="relative h-[168px] overflow-hidden">
          <PickOneCardSkeleton translate="translate-x-[12.5px]" />
          <div className="absolute left-1/2 top-[72px] h-6 w-6 -translate-x-1/2 rounded-xs bg-disabled" />
          <PickOneCardSkeleton translate="translate-x-[calc(100%_+_36.5px)]" />
        </div>

        <div className="flex justify-center px-4 pb-4 pt-2">
          <SkeletonBlock className="h-4 w-56 max-w-full rounded-xs" />
        </div>
        <SkeletonBlock className="mx-4 mb-4 h-10 rounded-md" />
      </section>

      {/* 검색바 — PickOneSection의 mb-3이 위 간격을 이미 만든다 */}
      <div className="mb-3 flex h-10 items-center gap-2 rounded-md border border-neutral-weak bg-surface px-3">
        <SkeletonBlock className="h-4 w-4 rounded-xs" />
        <SkeletonBlock className="h-4 w-20 rounded-xs" />
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-weak bg-surface">
        <div className="flex items-center justify-between border-b border-neutral-weak px-3.5 pb-2 pt-3">
          <div className="flex items-center gap-[66px]">
            <SkeletonBlock className="h-3.5 w-7 rounded-xs" />
            <SkeletonBlock className="h-3.5 w-7 rounded-xs" />
          </div>
          <SkeletonBlock className="h-3.5 w-9 rounded-xs" />
        </div>
        <div className="divide-y divide-neutral-weak">
          {[0, 1, 2, 3, 4].map(index => (
            <div key={index} className="flex h-[68px] items-center gap-2.5 px-3.5 py-2.5">
              <SkeletonBlock className="h-6 w-6 shrink-0 rounded-xs" />
              <SkeletonBlock className="h-[42px] w-[42px] shrink-0 rounded-pill" />
              <div className="min-w-0 flex-1">
                <SkeletonBlock className="h-5 w-32 rounded-xs" />
                <SkeletonBlock className="mt-1 h-3.5 w-24 rounded-xs" />
              </div>
              <SkeletonBlock className="h-6 w-8 shrink-0 rounded-xs" />
            </div>
          ))}
        </div>
      </div>
    </div>
  ),
}

/**
 * 메뉴(`/menu`) 진입 로딩. `NavigationLoading`의 `MenuSkeleton`.
 * 제목 2줄 + h-12 버튼 행 3개 — 가장 단순한 스켈레톤이다.
 */
export const MenuScreen: Story = {
  decorators: screenDecorator,
  render: () => (
    <div aria-hidden="true" className="flex-1 px-5 pt-6 pb-24 sm:pb-10">
      {/* heading-2(20/28) + mt-1 label-2(13/18) */}
      <div className="mb-5">
        <SkeletonBlock className="h-7 w-16 rounded-xs" />
        <SkeletonBlock className="mt-1 h-[18px] w-64 max-w-full rounded-xs" />
      </div>

      {/* MenuActions: flex flex-col gap-2 + h-12 justify-start 버튼들(로그인 여부에 따라 2~4개) */}
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map(index => (
          <div key={index} className="flex h-12 items-center gap-2 rounded-sm border border-neutral-weak px-4">
            <SkeletonBlock className="h-4 w-4 rounded-sm" />
            <SkeletonBlock className="h-[22px] w-28 rounded-xs" />
          </div>
        ))}
      </div>
    </div>
  ),
}

/**
 * 위 4개 경로가 아닌 모든 화면의 로딩 — 스켈레톤 대신 상단 4px 진행 바만 뜬다.
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
