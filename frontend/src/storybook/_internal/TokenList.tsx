import { useEffect, useRef, useState } from 'react'

import type { CSSProperties, ReactNode } from 'react'

import { hexifyShadowColors } from './color-format'

/**
 * Foundations 문서 공용 표.
 *
 * 값을 문자열로 옮겨 적지 않고 **실제 CSS 변수를 참조해 렌더**하는 것이 요점이다.
 * 토큰 값이 바뀌면 이 표의 샘플도 자동으로 따라가므로 문서가 코드와 어긋날 수 없다.
 */

export type TokenItem = {
  /** 토큰 이름 또는 Tailwind 클래스명 */
  name: string
  /** 언제 쓰는가. 판단이 필요한 항목에만 쓴다 — 자명하면 비워둔다 */
  usage?: string
  /** 샘플 칸에 렌더할 시각 예시. 여기엔 값 텍스트를 넣지 않는다 — 값은 `value` 칸으로 분리한다 */
  sample?: ReactNode
  /**
   * 값 칸. 하나면(radius·shadow처럼 속성이 하나) 그대로 한 칸, 배열이면(타이포처럼
   * 속성이 여러 개) `valueColumns`와 같은 순서로 칸을 나눠 각각 한 속성씩 보여준다.
   */
  value?: ReactNode | Array<ReactNode>
}

export function TokenList({ items, valueColumns = ['값'] }: { items: Array<TokenItem>; valueColumns?: Array<string> }) {
  return (
    <div className="my-4 overflow-x-auto font-sans">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-neutral-weak">
            <th className="w-32 py-2 pr-3 text-label-2 font-medium text-neutral-muted">샘플</th>
            {valueColumns.map((label) => (
              <th key={label} className="w-32 py-2 pr-3 text-label-2 font-medium text-neutral-muted">
                {label}
              </th>
            ))}
            <th className="w-56 py-2 pr-3 text-label-2 font-medium text-neutral-muted">이름</th>
            <th className="py-2 text-label-2 font-medium text-neutral-muted">언제 쓰는가</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const values = Array.isArray(item.value) ? item.value : [item.value]
            return (
              // vertical-align은 table-row(<tr>)에는 적용되지 않고 table-cell(<td>)에만 먹는다.
              // 그래서 각 <td>에 align-middle을 준다 — <tr>에 주면 무시돼 셀이 baseline 정렬로
              // 떨어지고, 큰 샘플 글자가 작은 값 텍스트 밑선에 맞춰져 위로 쏠려 보인다.
              <tr key={item.name} className="border-b border-neutral-weak">
                <td className="py-2.5 pr-3 align-middle">{item.sample}</td>
                {valueColumns.map((label, i) => (
                  <td key={label} className="py-2.5 pr-3 align-middle font-mono text-caption-2 text-neutral-muted">
                    {values[i] ?? '—'}
                  </td>
                ))}
                <td className="py-2.5 pr-3 align-middle">
                  <code className="text-label-2 text-neutral">{item.name}</code>
                </td>
                <td className="py-2.5 align-middle text-label-1-reading text-neutral-muted">{item.usage ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** radius·shadow 등 도형 샘플. 시각 예시만 그린다 — 값은 `BoxValue`가 "값" 칸에서 따로 보여준다. */
export function Box({ style, className }: { style?: CSSProperties; className?: string }) {
  return <span className={`inline-block h-10 w-16 bg-surface ${className ?? ''}`} style={style} />
}

/**
 * `Box`와 같은 className을 적용한 요소의 computed style을 읽어 "값" 칸에 텍스트로
 * 보여준다. 화면에 보이지 않는 0크기 요소로 측정한다 — border-radius·box-shadow·폰트
 * 메트릭은 요소 크기와 무관하게 결정되는 값이라 크기를 0으로 줄여도 값이 달라지지 않는다.
 */
export function BoxValue({ className, readProperty }: { className: string; readProperty: 'borderRadius' | 'boxShadow' }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [value, setValue] = useState('')

  useEffect(() => {
    if (!ref.current) return
    const computed = getComputedStyle(ref.current)[readProperty]
    setValue(readProperty === 'boxShadow' ? hexifyShadowColors(computed) : computed)
  }, [className, readProperty])

  return (
    <>
      <span ref={ref} aria-hidden className={`absolute h-0 w-0 overflow-hidden opacity-0 ${className}`} />
      {value || '—'}
    </>
  )
}

/**
 * Storybook addon-docs가 `.sbdocs-content span { font-size, font-family, margin, ... }`을
 * 클래스+태그 선택자(우선순위 0,1,1)로 주입한다 — 우리 Tailwind 클래스 하나짜리 선택자
 * (0,1,0)로는 못 이긴다. `!important`는 우선순위와 무관하게 항상 이기므로, **폰트 크기
 * 클래스에만** `!` 접두사를 강제한다.
 *
 * 주의: `absolute`/`h-0`/`w-0`/`overflow-hidden`/`opacity-0` 같은 레이아웃·숨김 클래스에는
 * 적용하면 안 된다 — 이 리셋이 그 속성들을 안 건드려서 원래도 이길 필요가 없고,
 * `!absolute` 같은 이름은 `safelist`에 없어 Tailwind가 CSS 자체를 안 만들어준다.
 * (한 번 이 버그로 측정용 숨김 span이 화면에 그대로 노출된 적이 있다 — §3.24)
 */
function important(className: string): string {
  return className
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((c) => (c.startsWith('!') ? c : `!${c}`))
    .join(' ')
}

/** 타이포 샘플. 시각 예시만 그린다 — 값은 `TypeMetric`이 각 값 칸에서 따로 보여준다. */
export function TypeSample({ className }: { className: string }) {
  return <span className={`${important(className)} font-sans text-neutral`}>가나다 Ag 123</span>
}

/** px 문자열을 `16px(1rem)`처럼 rem과 함께 보여준다. 루트(`html`)의 font-size를 기준으로 계산한다 — 16 고정값을 가정하지 않는다(사용자 브라우저 확대 설정을 반영). */
function withRem(px: string, rootPx: number): string {
  const n = parseFloat(px)
  if (Number.isNaN(n) || !rootPx) return px
  const rem = Number((n / rootPx).toFixed(3))
  return `${px}(${rem}rem)`
}

export type TypeMetricKind = 'size' | 'lineHeight' | 'letterSpacing'

/**
 * `TypeSample`과 같은 className을 적용한(화면엔 안 보이는 0크기 요소) computed
 * font-size · line-height · letter-spacing 중 하나를 읽어 "크기"/"행간"/"자간"
 * 칸에 각각 보여준다. 세 속성을 한 칸에 합치지 않는다 — 라벨 없는 숫자 나열은
 * 어떤 값이 뭘 뜻하는지 구분이 안 된다(§3.19에서 발견된 문제).
 */
export function TypeMetric({ className, metric }: { className: string; metric: TypeMetricKind }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [value, setValue] = useState('')

  useEffect(() => {
    if (!ref.current) return
    const computed = getComputedStyle(ref.current)
    if (metric === 'size') {
      const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize)
      setValue(withRem(computed.fontSize, rootPx))
    } else if (metric === 'lineHeight') {
      setValue(computed.lineHeight)
    } else {
      setValue(computed.letterSpacing)
    }
  }, [className, metric])

  return (
    <>
      {/* absolute/h-0/w-0/overflow-hidden/opacity-0에는 !를 붙이지 않는다 — className(폰트 크기)에만 붙인다 */}
      <span ref={ref} aria-hidden className={`absolute h-0 w-0 overflow-hidden opacity-0 ${important(className)}`} />
      {value || '—'}
    </>
  )
}
