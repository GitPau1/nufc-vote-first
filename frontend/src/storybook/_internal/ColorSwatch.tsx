import { useEffect, useRef, useState } from 'react'

import type { ReactNode } from 'react'

import { toDisplayValue } from './color-format'

/**
 * 색상 스와치.
 *
 * 값을 문자열로 적어두지 않는다. Tailwind 클래스를 실제로 적용한 요소의
 * **계산된 색(computed style)** 을 읽어서 표시하므로, 토큰이 바뀌면 표시되는
 * 값도 따라간다. `--c-*`(hex/rgba)와 shadcn `--primary`(HSL 삼중값)처럼
 * 정의 형식이 달라도 한 방식으로 다룰 수 있다. 헥스 변환 로직은 `color-format.ts`에
 * 있다 — `TokenList`의 `BoxValue`(그림자 값)도 같은 로직을 쓴다.
 */

type ColorSwatchProps = {
  /** 실제로 적용할 Tailwind 배경(또는 테두리) 클래스. 예: "bg-brand-solid" */
  className: string
  /** 코드에서 쓰는 이름. 예: "bg-brand-solid" */
  name: string
  /** 한 줄 메모. 판단이 필요한 항목에만 쓴다 */
  note?: string
  /** 흰색·거의 흰색이면 경계가 안 보이므로 테두리를 준다 */
  bordered?: boolean
  /** border-* 토큰을 보여줄 때 'borderColor'로 바꾼다 — 기본은 배경색을 읽는다 */
  readProperty?: 'backgroundColor' | 'borderColor'
}

export function ColorSwatch({ className, name, note, bordered, readProperty = 'backgroundColor' }: ColorSwatchProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState('')

  useEffect(() => {
    if (!ref.current) return
    setValue(toDisplayValue(getComputedStyle(ref.current)[readProperty]))
  }, [className, readProperty])

  const isBorder = readProperty === 'borderColor'

  return (
    <div className="w-32 font-sans">
      <div
        ref={ref}
        className={`h-20 w-full rounded-md ${className} ${
          isBorder ? 'bg-surface' : bordered ? 'border border-border' : ''
        }`}
      />
      <div className="mt-2 text-label-2 font-bold text-foreground">{name}</div>
      <div className="mt-0.5 font-mono text-caption-2 text-muted-foreground">{value || '—'}</div>
      {note ? <div className="mt-1 text-caption-2 text-muted-foreground">{note}</div> : null}
    </div>
  )
}

/** 스와치를 나란히 배치해 서로 비교할 수 있게 한다. */
export function SwatchGrid({ children }: { children: ReactNode }) {
  return <div className="my-5 flex flex-wrap gap-4 font-sans">{children}</div>
}

/**
 * 텍스트 색상 스와치. 배경이 아니라 글자 색이 대상이라
 * 실제 텍스트를 표면 위에 얹어 보여준다.
 */
export function TextSwatch({ className, name, note }: Omit<ColorSwatchProps, 'bordered'>) {
  const ref = useRef<HTMLSpanElement>(null)
  const [value, setValue] = useState('')

  useEffect(() => {
    if (!ref.current) return
    setValue(toDisplayValue(getComputedStyle(ref.current).color))
  }, [className])

  return (
    <div className="w-32 font-sans">
      <div className="flex h-20 w-full items-center justify-center rounded-md border border-border bg-surface">
        <span ref={ref} className={`text-heading-2 font-bold ${className}`}>
          Ag 가
        </span>
      </div>
      <div className="mt-2 text-label-2 font-bold text-foreground">{name}</div>
      <div className="mt-0.5 font-mono text-caption-2 text-muted-foreground">{value || '—'}</div>
      {note ? <div className="mt-1 text-caption-2 text-muted-foreground">{note}</div> : null}
    </div>
  )
}
