import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { TeamBadge } from '@/components/composition/predict/shared'

// 실제 logoUrl은 lib/predictions/week.ts의 teamLogoUrl(teamId)이 Supabase Storage public 주소
// (.../player-photos/team-logos/{teamId}.png)로 조립한다. 스토리에서 그 주소를 그대로 쓰면
// 스토리 결과가 프로젝트 env에 묶이므로, 다른 예측 mock과 같은 placehold.co를 쓴다.
const PLACEHOLDER_LOGO = 'https://placehold.co/48x48/2a2f36/8a929c?text=NU'

// grayscale 스토리 전용. 위 PLACEHOLDER_LOGO는 회청색(#2a2f36 / #8a929c)이라 채도가 거의 없어서
// filter: grayscale을 걸어도 Default와 눈으로 구분되지 않는다 — 실제 엠블럼은 팀 컬러라
// 채도가 높으니, 효과를 실제 크기로 보여주려면 유채색 샘플이 따로 필요하다.
const SATURATED_PLACEHOLDER_LOGO = 'https://placehold.co/48x48/d81920/f5d000?text=NU'

// `.invalid`는 예약 TLD(RFC 2606)라 어떤 환경에서도 절대 해석되지 않는다 — 네트워크 상태와 무관하게
// onError가 반드시 한 번 뜨므로 폴백 경로를 결정적으로 보여줄 수 있다.
const BROKEN_LOGO = 'https://storage.invalid/storage/v1/object/public/player-photos/team-logos/999999.png'

const meta = {
  title: 'Composition/Predict/TeamBadge',
  component: TeamBadge,
  argTypes: {
    logoUrl: {
      description: '없으면(undefined) 곧바로 이니셜 원형. 실제로는 teamLogoUrl(teamId) 결과가 들어온다.',
    },
    name: {
      description: '폴백 이니셜은 이 값의 첫 글자(name.slice(0, 1))다. 이미지가 뜨면 쓰이지 않는다.',
    },
    size: {
      control: { type: 'number', min: 16 },
      description:
        'px. 실사용처 5곳 중 MatchWeekList만 32를 넘기고(목록의 작은 배지), 나머지 4곳은 기본값(48)이다.',
    },
    grayscale: {
      description:
        '종료된 경기(match.finished)의 로고를 흑백으로 가라앉힌다. 폴백 이니셜 원형에도 클래스가 같이 붙지만, 그쪽은 이미 무채색이라 보이는 변화는 없다(GrayscaleFallback 참고).',
    },
  },
  args: {
    name: '뉴캐슬',
    logoUrl: PLACEHOLDER_LOGO,
  },
} satisfies Meta<typeof TeamBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** logoUrl 자체가 없는 경우 — MatchWeekList의 `opponentLogoUrl`이 optional이라 실제로 도달할 수 있는 상태다. */
export const NoLogo: Story = {
  args: { logoUrl: undefined },
}

/**
 * **이 컴포넌트의 핵심 동작.** URL은 있는데 요청이 실패하는 경우(버킷에 그 팀 ID 파일이 없거나
 * CDN이 죽은 경우)를 실제로 재현한다 — `onError`가 `failed` 상태를 세워서 깨진 이미지 아이콘이 아니라
 * 이니셜 원형으로 떨어져야 한다. 위 NoLogo와 결과가 같아야 정상이다.
 */
export const LoadFailed: Story = {
  args: { logoUrl: BROKEN_LOGO },
}

/**
 * size를 키워도 폴백 이니셜의 글자 크기는 `text-label-1-normal` 고정이라 같이 커지지 않는다
 * (원만 커지고 글자는 그대로) — 큰 자리에 폴백을 쓸 때 알아둘 것. 실사용처는 전부 48이다.
 */
export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-end gap-4">
      {[32, 48, 64, 88].map((size) => (
        <div key={size} className="flex flex-col items-center gap-2">
          <TeamBadge {...args} size={size} />
          <TeamBadge {...args} logoUrl={undefined} size={size} />
          <span className="text-caption-2 text-neutral-muted">{size}</span>
        </div>
      ))}
    </div>
  ),
}

/**
 * 긴 팀명 — 폴백은 첫 글자만 쓰므로 원 크기가 이름 길이에 영향받지 않는다.
 * 배지 자체는 `aria-hidden`이고 폭 제한도 없다(팀 이름 줄바꿈/truncate는 호출하는 쪽 책임).
 */
export const LongTeamName: Story = {
  args: { name: '웨스트브롬위치', logoUrl: undefined },
}

/**
 * 종료된 경기의 로고 — `grayscale`로 채도를 없애 "끝난 경기"를 표시한다. 판정 단위는 경기(`match.finished`)라,
 * 한 주차에 끝난 경기와 안 끝난 경기가 섞이면 로고 톤도 경기마다 갈린다. 차이가 보이도록 같은 로고를
 * 컬러/흑백으로 나란히 놓았고, 로고는 유채색 샘플(`SATURATED_PLACEHOLDER_LOGO`)을 쓴다 — 위 상수 주석 참고.
 */
export const Grayscale: Story = {
  render: (args) => (
    <div className="flex items-end gap-4">
      {[false, true].map((grayscale) => (
        <div key={String(grayscale)} className="flex flex-col items-center gap-2">
          <TeamBadge {...args} logoUrl={SATURATED_PLACEHOLDER_LOGO} grayscale={grayscale} />
          <span className="text-caption-2 text-neutral-muted">
            {grayscale ? 'grayscale (종료)' : '기본 (예정)'}
          </span>
        </div>
      ))}
    </div>
  ),
}

/**
 * 폴백 이니셜 원형에도 `grayscale` 클래스가 함께 걸린다. 다만 **눈에 보이는 변화는 없다** —
 * 폴백 원은 `bg-disabled`(#e9e9ea) + `text-neutral-muted`(#666666)로 이미 무채색이라
 * `filter: grayscale`이 바꿀 채도가 없다. 그래서 이 스토리는 효과를 보여주는 게 아니라
 * **prop을 넘겨도 폴백이 깨지지 않는다**는 것을 고정하는 확인용이다(위 NoLogo와 같아야 정상).
 */
export const GrayscaleFallback: Story = {
  args: { grayscale: true, logoUrl: undefined },
}
