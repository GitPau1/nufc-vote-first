import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { INITIAL_VIEWPORTS } from 'storybook/viewport'

import { PageContainer } from '@/components/layout/PageContainer'

// PageContainer는 min-h-screen이라 캔버스를 한 화면 높이로 채운다. Docs 페이지에서
// 스토리 4개가 각각 100vh를 먹으면 읽을 수 없어서, 상단만 보이도록 잘라서 보여준다.
const clipHeight = [
  (Story: () => React.JSX.Element) => (
    <div style={{ height: 320, overflow: 'hidden' }}>
      <Story />
    </div>
  ),
]

/**
 * 폭 경계를 눈으로 확인하기 위한 더미 콘텐츠.
 * PageContainer 자체는 폭을 제한하지 않으므로, 실제 화면들이 하는 것처럼
 * 자식이 직접 max-w-* 토큰을 걸어야 경계가 생긴다.
 */
function WidthProbe() {
  return (
    <div className="py-4">
      <div className="mx-auto max-w-content border-x border-dashed border-brand-solid bg-brand-weak px-4 py-3">
        <p className="text-label-2 text-neutral">max-w-content · 1140px — 목록 화면</p>
      </div>
      <div className="mx-auto mt-3 max-w-detail border-x border-dashed border-brand-solid bg-brand-weak px-4 py-3">
        <p className="text-label-2 text-neutral">max-w-detail · 680px — 투표 상세</p>
      </div>
      <div className="mx-auto mt-3 max-w-shell border-x border-dashed border-brand-solid bg-brand-weak px-4 py-3">
        <p className="text-label-2 text-neutral">max-w-shell · 480px — 모바일 전용 UI</p>
      </div>
    </div>
  )
}

/** 셸 분기(온보딩)용 더미. 카드 폭 자체가 480px이라 안에서 폭을 더 제한할 게 없다. */
function ShellProbe() {
  return (
    <div className="px-5 py-10">
      <p className="text-heading-2 text-neutral">온보딩</p>
      <p className="mt-2 text-label-1-normal text-neutral-muted">
        헤더가 없는 독립 화면. 데스크탑에서는 이 카드가 480px로 고정되고 좌우는 body 배경이 드러난다.
      </p>
      <div className="mt-6 h-32 rounded-lg border border-neutral-weak bg-surface" />
    </div>
  )
}

const meta = {
  title: 'Presentation/PageContainer',
  component: PageContainer,
  parameters: {
    // usePathname()으로 셸/패스스루 분기를 결정하므로 navigation.pathname이 사실상 이 컴포넌트의
    // 유일한 입력이다. appDirectory가 없으면 "invariant expected app router to be mounted"로 죽는다.
    nextjs: { appDirectory: true, navigation: { pathname: '/polls' } },
    // 셸 분기의 sm:border-x는 640px 경계에서만 갈리므로 뷰포트를 좁혀 봐야 확인된다.
    viewport: { options: INITIAL_VIEWPORTS },
    layout: 'fullscreen',
  },
  decorators: clipHeight,
} satisfies Meta<typeof PageContainer>

export default meta
type Story = StoryObj<typeof meta>

/**
 * 온보딩을 제외한 모든 경로 — 폭 제한 없이 그대로 통과시킨다(`min-h-screen w-full bg-page`).
 * 점선이 자식이 직접 건 폭 경계다. 컨테이너가 아니라 화면이 폭을 고르는 구조라는 게 핵심.
 */
export const Default: Story = {
  args: { children: <WidthProbe /> },
}

/**
 * 셸 분기(`SHELL_PATHS = ['/onboarding']`) 데스크탑. 480px 카드가 중앙에 놓이고
 * 좌우 여백에 `sm:border-x sm:border-neutral-weak/60` 세로선이 생긴다.
 */
export const ShellDesktop: Story = {
  args: { children: <ShellProbe /> },
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/onboarding' } },
  },
}

/** 같은 셸 분기의 모바일(<640px) — 카드가 화면 폭을 다 쓰고 좌우 세로선이 사라진다. */
export const ShellMobile: Story = {
  args: { children: <ShellProbe /> },
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/onboarding' } },
  },
  globals: { viewport: { value: 'iphone12' } },
}

/**
 * 자식이 폭 토큰을 걸지 않으면 어떻게 되는지 — 데스크탑에서 콘텐츠가 화면 끝까지 늘어난다.
 * PageContainer가 막아주지 않는다는 걸 보여주는 회귀 참조용 스토리다.
 */
export const NoWidthConstraint: Story = {
  args: {
    children: (
      <div className="border-y border-dashed border-neutral-strong px-4 py-6">
        <p className="text-label-1-normal text-neutral">
          max-w-*를 걸지 않은 콘텐츠. 1920px 모니터에서도 이만큼 늘어난다.
        </p>
      </div>
    ),
  },
}
