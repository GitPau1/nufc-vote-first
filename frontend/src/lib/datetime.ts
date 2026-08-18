const KOREA_OFFSET = '+09:00'

export function datetimeLocalToKoreaIso(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(trimmed)) return new Date(trimmed).toISOString()

  const withSeconds = trimmed.length === 16 ? `${trimmed}:00` : trimmed
  return new Date(`${withSeconds}${KOREA_OFFSET}`).toISOString()
}
