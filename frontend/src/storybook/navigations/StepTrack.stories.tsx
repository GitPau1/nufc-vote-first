import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { STEP_META, StepHero, StepTrack, StepTrackVertical, type StepKey } from '@/components/composition/predict/steps'

const STEP_KEYS: StepKey[] = STEP_META.map(s => s.key)

// 모바일 예측 플로우의 콘텐츠 폭 축약 — 사용처는 `max-w-[560px] px-4`라서 폰에서는
// 뷰포트 폭 - 32px가 실제 폭이다. StepTrack이 `w-1/2`(부모의 절반)라 이 래퍼 폭이
// 트랙 길이를 그대로 결정하므로, 감싸지 않으면 Docs 폭 기준으로 과장돼 보인다.
const mobileColumn = {
  decorators: [(Story: () => React.JSX.Element) => <div style={{ maxWidth: 343 }}><Story /></div>],
}

// 데스크탑 사이드 컬럼 — 사용처의 `sm:grid-cols-[200px_1fr]` 첫 칸 폭.
// 세로 트랙의 활성 설명이 `max-w-[168px]`로 줄바꿈되는 모습이 이 폭에서만 실제와 같다.
const sideColumn = {
  decorators: [(Story: () => React.JSX.Element) => <div style={{ width: 200 }}><Story /></div>],
}

// render로 3스텝을 한 번에 그리는 스토리들 — 필수 prop인 current를 타입상 채워야 하지만
// 실제 렌더는 render 안에서 스텝을 직접 지정하므로 Controls에서는 감춘다.
function renderOnly(current: StepKey) {
  return { args: { current }, parameters: { controls: { include: [] } } }
}

/** 각 스토리에서 3스텝을 나란히 비교할 때 쓰는 라벨 + 슬롯. */
function StepRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-caption-1 font-bold text-neutral-muted">{label}</p>
      {children}
    </div>
  )
}

const meta = {
  title: 'Composition/Predict/StepTrack',
  component: StepTrack,
  argTypes: {
    current: { control: 'radio', options: STEP_KEYS },
  },
} satisfies Meta<typeof StepTrack>

export default meta
type Story = StoryObj<typeof meta>

/** 첫 스텝(`score`) — 1번 노드만 활성(테두리 `border-brand-solid` + 안쪽 점), 나머지는 `border-neutral-weak`. */
export const Default: Story = {
  ...mobileColumn,
  args: { current: 'score' },
}

/**
 * 3스텝 전체 — 이 컴포넌트의 회귀 포인트는 "완료/현재/진행 전이 시각적으로 구분되는가" 하나다.
 * 완료 노드는 `bg-brand-solid` 채움 + `text-on-solid` 체크, 현재는 테두리만 brand + 안쪽 점,
 * 진행 전은 `border-neutral-weak` 빈 원. 커넥터도 지나온 구간만 `bg-brand-solid`로 찬다.
 */
export const AllStates: Story = {
  ...renderOnly('score'),
  ...mobileColumn,
  render: () => (
    <div className="flex flex-col gap-5">
      {STEP_META.map(step => (
        <StepRow key={step.key} label={step.key}>
          <StepTrack current={step.key} />
        </StepRow>
      ))}
    </div>
  ),
}

/**
 * `StepHero` — 모바일에서 트랙 바로 아래 붙는 타이틀(`text-brand`)/설명(`text-neutral-muted`).
 * 트랙에는 라벨이 없으므로 "지금 어느 단계인가"를 글자로 알려주는 건 이쪽뿐이다.
 */
export const Hero: Story = {
  ...renderOnly('score'),
  ...mobileColumn,
  render: () => (
    <div className="flex flex-col gap-5">
      {STEP_META.map(step => (
        <StepHero key={step.key} current={step.key} />
      ))}
    </div>
  ),
}

/**
 * `multi` on/off 비교 — 더블 매치위크(한 주에 경기 2개)에서 설명 문구만 갈린다.
 * `STEP_META`에 `descMulti`가 있는 `score`·`pick`만 바뀌고, `confirm`은 `descMulti`가 없어
 * 같은 문장으로 폴백한다. 타이틀은 어느 스텝에서도 바뀌지 않는다.
 */
export const HeroMulti: Story = {
  ...renderOnly('score'),
  ...mobileColumn,
  render: () => (
    <div className="flex flex-col gap-7">
      {STEP_META.map(step => (
        <div key={step.key} className="flex flex-col gap-2">
          <StepRow label={`${step.key} · multi=false`}>
            <StepHero current={step.key} />
          </StepRow>
          <StepRow label={`${step.key} · multi=true`}>
            <StepHero current={step.key} multi />
          </StepRow>
        </div>
      ))}
    </div>
  ),
}

/**
 * `StepTrackVertical` — 데스크탑 사이드바용. 가로형과 달리 단계 이름이 노드 옆에 항상 붙고,
 * 설명은 **활성 단계에만** 나온다. 진행 전 이름만 `text-neutral-muted`로 죽고
 * 완료·현재는 `text-neutral`라, 완료와 현재는 이름 색으로는 구분되지 않고 노드 모양으로만 구분된다.
 */
export const Vertical: Story = {
  ...renderOnly('score'),
  ...sideColumn,
  render: () => (
    <div className="flex flex-col gap-7">
      {STEP_META.map(step => (
        <StepRow key={step.key} label={step.key}>
          <StepTrackVertical current={step.key} />
        </StepRow>
      ))}
    </div>
  ),
}

/** 세로형에서도 `multi`는 활성 단계 설명 한 줄에만 영향을 준다 — 폭이 좁아 줄 수가 늘어날 수 있다. */
export const VerticalMulti: Story = {
  ...renderOnly('pick'),
  render: () => (
    <div className="flex gap-10">
      <div style={{ width: 200 }}>
        <StepRow label="multi=false">
          <StepTrackVertical current="pick" />
        </StepRow>
      </div>
      <div style={{ width: 200 }}>
        <StepRow label="multi=true">
          <StepTrackVertical current="pick" multi />
        </StepRow>
      </div>
    </div>
  ),
}

/**
 * 모바일 실제 배치(`PredictionFlowClient`의 `sm:hidden` 분기) — 가로 트랙 위, 히어로 아래.
 * 두 컴포넌트는 항상 이 순서로 붙어 다니고 사이 여백은 `StepHero`의 `mt-5`가 만든다.
 */
export const MobileLayout: Story = {
  ...renderOnly('pick'),
  ...mobileColumn,
  render: () => (
    <div>
      <StepTrack current="pick" />
      <StepHero current="pick" />
      <div className="mt-7 rounded-lg border border-neutral-weak bg-surface px-4 py-5">
        <p className="text-label-1-normal font-bold text-neutral">스텝 본문 카드</p>
      </div>
    </div>
  ),
}

/**
 * 데스크탑 실제 배치(`sm:grid-cols-[200px_1fr] sm:gap-x-10`) — 세로 트랙이 왼쪽 200px 칸,
 * 본문이 오른쪽. 이 분기에서는 `StepTrack`·`StepHero`가 렌더되지 않는다(둘은 `sm:hidden` 안).
 */
export const DesktopLayout: Story = {
  ...renderOnly('pick'),
  render: () => (
    <div className="grid grid-cols-[200px_1fr] gap-x-10">
      <StepTrackVertical current="pick" />
      <div className="rounded-lg border border-neutral-weak bg-surface px-4 py-5">
        <p className="text-label-1-normal font-bold text-neutral">스텝 본문 카드</p>
        <p className="mt-1 text-caption-1 text-neutral-muted">
          왼쪽 트랙이 본문 높이와 무관하게 상단 정렬로 남는지 확인용
        </p>
      </div>
    </div>
  ),
}
