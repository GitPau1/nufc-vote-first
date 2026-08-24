import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { CroppedImageInput } from '@/components/images/CroppedImageInput'

// 투표 만들기 폼(모바일 퍼스트) 안에 들어가는 입력이라, 데스크탑 캔버스 폭 그대로 두면
// 크롭 슬라이더 3개가 실제보다 훨씬 넓게 보인다 — 실제 폼 폭으로 감싼다.
const formWidth = {
  decorators: [(Story: () => React.JSX.Element) => <div style={{ maxWidth: 358 }}><Story /></div>],
}

const meta = {
  title: 'Selection and Input/ImageInput',
  component: CroppedImageInput,
  args: { name: 'thumbnail_image_file', label: '대표 이미지 크롭' },
} satisfies Meta<typeof CroppedImageInput>

export default meta
type Story = StoryObj<typeof meta>

/**
 * 파일을 고르기 전의 기본 상태. 캔버스·확대·위치 슬라이더는 파일이 선택된 뒤에만 렌더되므로
 * 초기 상태는 라벨 + `<input type="file">` 두 줄뿐이다(점선 테두리 박스).
 * 기본 출력 크기는 1400×600(21:9)이다.
 */
export const Default: Story = {
  ...formWidth,
}

/** 실제 사용처 1 — `UserPollCreateForm`의 대표 이미지(1200×400, `aspect-[3/1]`, `poll-thumbnail.webp`). */
export const PollThumbnailPreset: Story = {
  ...formWidth,
  args: {
    name: 'thumbnail_image_file',
    label: '대표 이미지 크롭',
    outputWidth: 1200,
    outputHeight: 400,
    previewClassName: 'aspect-[3/1]',
    fileName: 'poll-thumbnail.webp',
  },
}

/** 실제 사용처 2 — 자유 선택지 카드 이미지(1000×1300, `aspect-[10/13]`, 세로형). 같은 컴포넌트로 세로 비율도 만든다. */
export const OptionCardPreset: Story = {
  ...formWidth,
  args: {
    name: 'free_option_image_0',
    label: '선택지 카드 이미지 크롭',
    outputWidth: 1000,
    outputHeight: 1300,
    previewClassName: 'aspect-[10/13]',
    fileName: 'poll-option.webp',
  },
}

/**
 * `label`은 필수 prop이라 "라벨 없음"을 표현할 방법이 빈 문자열뿐이다.
 * 빈 `<p>`가 그대로 렌더되어 위쪽에 한 줄 높이가 남는다 — 라벨 없이 쓸 자리가 생기면
 * 소스에서 label을 optional로 만들고 조건 렌더로 바꿔야 한다.
 */
export const WithoutLabel: Story = {
  ...formWidth,
  args: { name: 'thumbnail_image_file', label: '' },
}

/**
 * 파일이 선택된 뒤의 크롭 상태. 실제 컴포넌트는 사용자가 직접 파일을 골라야 이 상태에 들어가고
 * 미리보기가 `<canvas>`라 스토리에서 재현할 수 없어서, 마크업만 그대로 옮긴 정적 복제다
 * (canvas 자리에 placehold.co 이미지). 슬라이더 범위는 소스와 같다 — 확대 1~2.2(step 0.05),
 * 가로/세로 위치 0~100.
 */
export const CropControlsMarkup: Story = {
  ...formWidth,
  render: () => <CropControlsReplica />,
}

function CropControlsReplica() {
  const [crop, setCrop] = useState({ zoom: 1, x: 50, y: 50 })
  return (
    <div className="rounded-lg border border-dashed border-border px-3 py-2">
      <p className="text-label-1-normal font-semibold text-muted-foreground">대표 이미지 크롭</p>
      <input type="file" accept="image/*" className="mt-2 block w-full text-caption-1" />
      <div className="mt-3 space-y-2">
        {/* 원본은 <canvas>. 실데이터 없이 비율만 보여주면 되므로 다른 스토리와 같은 placehold.co를 쓴다. */}
        <img
          src="https://placehold.co/1200x400/2a2f36/8a929c?text=%20"
          alt=""
          className="aspect-[3/1] w-full rounded-lg bg-brand-solid object-cover"
        />
        <label className="block text-label-1-normal font-bold text-foreground">
          확대
          <input
            type="range"
            min="1"
            max="2.2"
            step="0.05"
            value={crop.zoom}
            onChange={event => setCrop(current => ({ ...current, zoom: Number(event.target.value) }))}
            className="mt-1 w-full"
          />
        </label>
        <label className="block text-label-1-normal font-bold text-foreground">
          가로 위치
          <input
            type="range"
            min="0"
            max="100"
            value={crop.x}
            onChange={event => setCrop(current => ({ ...current, x: Number(event.target.value) }))}
            className="mt-1 w-full"
          />
        </label>
        <label className="block text-label-1-normal font-bold text-foreground">
          세로 위치
          <input
            type="range"
            min="0"
            max="100"
            value={crop.y}
            onChange={event => setCrop(current => ({ ...current, y: Number(event.target.value) }))}
            className="mt-1 w-full"
          />
        </label>
      </div>
    </div>
  )
}
