import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { userEvent, within } from 'storybook/test'

import { ShareButton } from '@/components/predict/shared'

const meta = {
  title: 'Actions/ShareButton',
  component: ShareButton,
} satisfies Meta<typeof ShareButton>

export default meta
type Story = StoryObj<typeof meta>

/**
 * 기본 상태 — 라벨은 `'↗ 공유하기'`(화살표는 아이콘 컴포넌트가 아니라 텍스트 글리프다).
 *
 * props가 없는 컴포넌트라 Controls로 바꿀 게 없다. 직접 눌러보는 것이 유일한 확인 방법이고,
 * 누르면 `navigator.clipboard.writeText(window.location.href)`가 도는데 Storybook에서는
 * 그 주소가 예측 결과 페이지가 아니라 Storybook iframe 주소라는 점만 감안하면 된다.
 */
export const Default: Story = {}

/**
 * 복사 성공 직후 상태 — 라벨만 `'링크 복사 완료'`로 바뀌고 크기·색은 그대로다.
 *
 * 소스의 `setTimeout(..., 2000)` 때문에 **2초 뒤 원래 라벨로 되돌아간다** — 캔버스에서
 * 잠깐만 보이는 게 정상이고 스토리 버그가 아니다. 다시 보려면 스토리를 리로드한다.
 *
 * 실제 `navigator.clipboard`는 보안 컨텍스트·권한에 따라 실패할 수 있고, 실패하면 소스가
 * catch에서 조용히 넘기기 때문에 라벨이 아예 바뀌지 않는다. 여기서 보려는 건 "복사됨" 표시
 * 자체이므로 이 스토리가 도는 동안만 writeText를 스텁으로 덮어 결과를 고정한다.
 */
export const Copied: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => {} },
    })

    await userEvent.click(canvas.getByRole('button', { name: /공유하기/ }))
    await canvas.findByRole('button', { name: '링크 복사 완료' })

    if (original) Object.defineProperty(navigator, 'clipboard', original)
    else delete (navigator as unknown as { clipboard?: unknown }).clipboard
  },
}

/**
 * 실제 배치 축약 — 예측 결과(`PredictionResult`)·제출 완료(`PredictionDone`) 화면 본문 맨 아래에
 * `mt-7 flex justify-center`로 가운데 놓인다. 버튼 자체가 `w-40` 고정폭이라 컨테이너가 넓어져도
 * 늘어나지 않는다는 점(모바일 폭 CTA처럼 `w-full`이 아니다)을 확인하는 스토리다.
 */
export const CenteredInResultFooter: Story = {
  render: () => (
    <div style={{ maxWidth: 358 }}>
      <div className="rounded-lg border border-neutral-weak bg-surface px-4 py-5">
        <p className="text-label-1-normal font-bold text-neutral">예측 결과 카드</p>
        <p className="mt-1 text-caption-1 text-neutral-muted">
          버튼이 이 블록 아래 가운데에 놓이는지 확인하기 위한 더미 콘텐츠
        </p>
      </div>
      <div className="mt-7 flex justify-center">
        <ShareButton />
      </div>
    </div>
  ),
}
