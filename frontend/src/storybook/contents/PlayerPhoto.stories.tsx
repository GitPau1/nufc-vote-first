import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { PlayerPhoto } from '@/components/predict/shared'

// 실제 photoUrl은 lib/predictions/candidates.ts의 playerPhotoUrl(fotmobPlayerId)이 FotMob CDN 주소
// (images.fotmob.com/image_resources/playerimages/{id}.png)로 조립한다. 진짜 시즌 스쿼드의 FotMob
// 선수 ID여야 200이 오고 임의 숫자는 403이라, 다른 예측 mock과 같은 placehold.co를 쓴다.
const PLACEHOLDER_PHOTO = 'https://placehold.co/64x64/2a2f36/8a929c?text=%20'

// `.invalid`는 예약 TLD(RFC 2606)라 절대 해석되지 않는다 — 네트워크 상태와 무관하게 로드가 실패해서
// Radix Avatar의 fallback 전환을 결정적으로 보여준다.
const BROKEN_PHOTO = 'https://images.fotmob.invalid/image_resources/playerimages/999999.png'

const meta = {
  title: 'Contents/PlayerPhoto',
  component: PlayerPhoto,
  argTypes: {
    url: {
      description: 'null이면 이미지 노드를 아예 렌더하지 않고 실루엣 폴백만 남는다.',
    },
    size: {
      control: { type: 'number', min: 24 },
      description: 'px. Avatar 기본값(h-10 w-10)을 인라인 style로 덮어쓴다. 실사용처는 48과 64(기본값)뿐.',
    },
  },
  args: {
    url: PLACEHOLDER_PHOTO,
  },
} satisfies Meta<typeof PlayerPhoto>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** 사진 자체가 없는 선수(`photoUrl: null`) — 이니셜이 아니라 실루엣 원형이다. */
export const NoPhoto: Story = {
  args: { url: null },
}

/**
 * **URL은 있는데 로드가 실패하는 경우** — 사진이 없는 신입·유스라 FotMob 주소가 404/403인 상황이다.
 * Radix Avatar가 실패를 스스로 fallback으로 넘기므로 `onError` 없이도 위 NoPhoto와 같은 결과가 된다.
 * 생 `<img>`를 쓰던 이전 구현에서는 이 경우가 깨진 이미지로 남았다 — 이 스토리가 그 회귀를 잡는다.
 */
export const LoadFailed: Story = {
  args: { url: BROKEN_PHOTO },
}

/**
 * 실루엣 SVG는 20×20 고정이라 size를 키워도 원만 커지고 아이콘은 그대로다
 * (`Silhouette`이 width/height를 하드코딩한다). 실사용은 40(미선택 자리)·48(요약 줄)·64(기본, 선수 카드) 셋.
 */
export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-end gap-4">
      {[40, 48, 64, 88].map((size) => (
        <div key={size} className="flex flex-col items-center gap-2">
          <PlayerPhoto {...args} size={size} />
          <PlayerPhoto url={null} size={size} />
          <span className="text-caption-2 text-neutral-muted">{size}</span>
        </div>
      ))}
    </div>
  ),
}
