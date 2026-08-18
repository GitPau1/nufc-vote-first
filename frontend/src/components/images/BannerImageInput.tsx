'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  name: string
  label: string
  outputWidth?: number
  outputHeight?: number
  previewClassName?: string
  fileName?: string
}

type CropState = {
  zoom: number
  x: number
  y: number
}

function setInputFile(input: HTMLInputElement, file: File) {
  const data = new DataTransfer()
  data.items.add(file)
  input.files = data.files
}

export function CroppedImageInput({
  name,
  label,
  outputWidth = 1400,
  outputHeight = 600,
  previewClassName = 'aspect-[21/9]',
  fileName = 'cropped.webp',
}: Props) {
  const previewRef = useRef<HTMLCanvasElement>(null)
  const hiddenFileRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [crop, setCrop] = useState<CropState>({ zoom: 1, x: 50, y: 50 })

  useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl)
    }
  }, [sourceUrl])

  useEffect(() => {
    const image = imageRef.current
    const canvas = previewRef.current
    if (!image || !canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    canvas.width = outputWidth
    canvas.height = outputHeight
    context.clearRect(0, 0, outputWidth, outputHeight)

    const scale = Math.max(outputWidth / image.naturalWidth, outputHeight / image.naturalHeight) * crop.zoom
    const drawWidth = image.naturalWidth * scale
    const drawHeight = image.naturalHeight * scale
    const maxX = Math.max(0, drawWidth - outputWidth)
    const maxY = Math.max(0, drawHeight - outputHeight)
    const offsetX = -maxX * (crop.x / 100)
    const offsetY = -maxY * (crop.y / 100)

    context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight)
    canvas.toBlob(blob => {
      const input = hiddenFileRef.current
      if (!blob || !input) return
      setInputFile(input, new File([blob], fileName, { type: 'image/webp' }))
    }, 'image/webp', 0.72)
  }, [crop, fileName, outputHeight, outputWidth, sourceUrl])

  function handleSourceChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    if (!file) return
    if (sourceUrl) URL.revokeObjectURL(sourceUrl)
    const nextUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      imageRef.current = image
      setCrop({ zoom: 1, x: 50, y: 50 })
      setSourceUrl(nextUrl)
    }
    image.src = nextUrl
  }

  return (
    <div className="rounded-lg border border-dashed border-border px-3 py-2 text-caption-1 font-semibold text-muted-foreground">
      <p>{label}</p>
      <input type="file" accept="image/*" onChange={handleSourceChange} className="mt-2 block w-full text-caption-1" />
      <input ref={hiddenFileRef} name={name} type="file" accept="image/webp" className="hidden" tabIndex={-1} />
      {sourceUrl && (
        <div className="mt-3 space-y-2">
          <canvas ref={previewRef} className={`${previewClassName} w-full rounded-lg bg-primary-dark object-cover`} />
          <label className="block text-caption-2 font-bold text-foreground">
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
          <label className="block text-caption-2 font-bold text-foreground">
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
          <label className="block text-caption-2 font-bold text-foreground">
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
      )}
    </div>
  )
}

export function BannerImageInput({ name, label }: Pick<Props, 'name' | 'label'>) {
  return (
    <CroppedImageInput
      name={name}
      label={label}
      outputWidth={1400}
      outputHeight={600}
      previewClassName="aspect-[21/9]"
      fileName="banner.webp"
    />
  )
}
