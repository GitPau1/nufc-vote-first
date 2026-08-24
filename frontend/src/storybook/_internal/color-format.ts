/**
 * computed style 문자열을 사람이 읽기 좋은 형태로 바꾸는 공용 헬퍼.
 *
 * `ColorSwatch`(색상 스와치)와 `TokenList`의 `BoxValue`(그림자 값)가 함께 쓴다 —
 * 한쪽만 헥스로 바꾸고 다른 쪽은 원시 rgba를 그대로 보여주면 문서 안에서
 * 표기 방식이 갈린다.
 */

/** `rgb(...)`/`rgba(...)` 하나를 헥스(+ 불투명도)로 바꾼다. 매치 안 되면 원본을 그대로 돌려준다. */
export function toDisplayValue(computed: string): string {
  const match = computed.match(/^rgba?\(([^)]+)\)$/)
  if (!match) return computed

  const parts = match[1].split(',').map((s) => s.trim())
  const [r, g, b] = parts.slice(0, 3).map(Number)
  const alpha = parts[3] === undefined ? 1 : Number(parts[3])

  const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`
  return alpha === 1 ? hex : `${hex} · ${Math.round(alpha * 100)}%`
}

/**
 * `box-shadow`의 computed 값(예: `rgba(0, 0, 0, 0.06) 0px 1px 4px 0px`) 안에 섞여 있는
 * rgba(...) 색상 부분만 헥스로 바꾼다. 겹(,)이 여러 개여도(w100처럼 이중 그림자)
 * 등장하는 만큼 전부 바꾼다.
 */
export function hexifyShadowColors(shadow: string): string {
  if (!shadow || shadow === 'none') return shadow
  return shadow.replace(/rgba?\([^)]+\)/g, (match) => toDisplayValue(match))
}
