import { useEffect, useRef, useState } from 'react'

/**
 * 원시 팔레트(--p-{family}-{step}) 스와치.
 *
 * 팔레트 단계는 Tailwind 유틸리티로 노출하지 않는다(의도적으로 semantic 이름만 노출) —
 * 그래서 className이 아니라 inline style로 CSS 변수를 직접 참조하고, 표시되는 값은
 * ColorSwatch와 같은 방식으로 getComputedStyle에서 읽어 하드코딩하지 않는다.
 */
function toHex(computed: string): string {
  const match = computed.match(/^rgba?\(([^)]+)\)$/)
  if (!match) return computed
  const [r, g, b] = match[1].split(',').map((s) => Number(s.trim()))
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`
}

function Step({ family, step }: { family: string; step: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState('')
  const varName = `--p-${family}-${step}`

  useEffect(() => {
    if (!ref.current) return
    setValue(toHex(getComputedStyle(ref.current).backgroundColor))
  }, [varName])

  return (
    <div className="w-16 font-sans">
      <div ref={ref} className="h-12 w-full rounded-sm" style={{ backgroundColor: `var(${varName})` }} />
      <div className="mt-1 text-center text-caption-2 text-muted-foreground">{step}</div>
      <div className="text-center font-mono text-caption-2 text-muted-foreground">{value || '—'}</div>
    </div>
  )
}

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]

/** 한 계열의 11단계를 나란히 보여준다. */
export function PaletteRow({ family, label }: { family: string; label: string }) {
  return (
    <div className="my-4 font-sans">
      <div className="mb-1.5 text-label-2 font-bold text-foreground">{label}</div>
      <div className="flex gap-1.5">
        {STEPS.map((step) => (
          <Step key={step} family={family} step={step} />
        ))}
      </div>
    </div>
  )
}
