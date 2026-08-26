import { unstable_cache } from 'next/cache'
import { IS_MOCK } from '@/lib/config'
import { NUFC_LABEL, type WeekGroup } from './week'

/**
 * 예측 플로우 스코어 단계에 띄우는 "경기 통찰력" 한 문장.
 *
 * 근거는 fixtures에 이미 들어 있는 **뉴캐슬 경기**뿐이다 — 동기화가 FotMob의 뉴캐슬 팀
 * 엔드포인트 하나만 긁어오므로(supabase/functions/sync-fixture/index.ts) 상대팀이 뉴캐슬 없이
 * 치른 경기는 DB에 없다. 그래서 문장도 상대팀 폼이 아니라 **뉴캐슬 폼**만 말한다.
 *
 * 문장은 주 단위 1개다(경기별이 아니다). 더블 매치위크여도 카드는 하나만 뜬다.
 */

/** 문장 근거로 쓰는 최근 종료 경기 수. */
export const RECENT_FORM_COUNT = 5

/**
 * 2026-08-26 실측으로 고른 모델. 후보 셋을 같은 프롬프트로 3회씩 돌려 비교했다:
 * - gemini-3.6-flash: 문장은 같은데 4.6~10.5초 — 아래 8초 타임아웃을 넘긴다.
 * - gemini-3.5-flash-lite: "양 팀 모두"를 빠뜨려("최근 5경기 전부 득점했다") 뜻이 달라졌다.
 * - gemini-3.1-flash-lite: 0.8~1.2초, 문장 정확. thinkingConfig도 받는다.
 *
 * 참고로 gemini-2.5-flash는 신규 프로젝트에서 404다("no longer available to new users").
 */
const MODEL = 'gemini-3.1-flash-lite'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

export type FormMatch = {
  /** 킥오프 ISO — 정렬 기준이자 프롬프트에 넣는 날짜 */
  kickoffAt: string
  opponent: string
  isHome: boolean
  /** 우리 득점 */
  our: number
  /** 상대 득점 */
  their: number
}

/**
 * 최근 종료 경기를 새 것부터 골라낸다. 페이지가 이미 들고 있는 `getFixtureWeeks()` 결과를
 * 그대로 받으므로 DB 조회가 추가로 나가지 않는다.
 *
 * 킥오프 시각이 없는 경기(일정 미정)는 정렬 기준이 없어 제외한다 — 종료된 경기에는 보통
 * 시각이 붙어 있으므로 실제로 빠지는 건 거의 없다.
 */
export function recentForm(weeks: WeekGroup[], limit: number = RECENT_FORM_COUNT): FormMatch[] {
  return weeks
    .flatMap(week => week.matches)
    .filter(match => match.finished && match.actual !== null && match.kickoffAt !== null)
    .sort((a, b) => (b.kickoffAt as string).localeCompare(a.kickoffAt as string))
    .slice(0, limit)
    .map(match => ({
      kickoffAt: match.kickoffAt as string,
      opponent: match.opponent,
      isHome: match.isHome,
      our: (match.actual as [number, number])[0],
      their: (match.actual as [number, number])[1],
    }))
}

/**
 * 프롬프트에 넣는 경기 기록. 캐시 키로도 그대로 쓰이므로(아래 unstable_cache 인자)
 * 같은 경기 결과면 같은 문자열이어야 한다 — 시각이나 난수를 섞지 않는다.
 */
export function formLines(form: FormMatch[]): string {
  return form
    .map(match => {
      const date = match.kickoffAt.slice(0, 10)
      const place = match.isHome ? '홈' : '원정'
      const result = match.our > match.their ? '승' : match.our < match.their ? '패' : '무'
      return `${date} ${place} vs ${match.opponent} ${match.our}-${match.their} ${result}`
    })
    .join('\n')
}

/**
 * 프롬프트에 넣을 **미리 센 사실들**. 숫자를 LLM에게 세게 하면 안 된다 —
 * 2026-08-25 실측에서 gemini-2.5-flash에 원시 기록만 주고 문장을 시켰더니 5회 중 3회가
 * 개수를 틀렸다("2실점 이상 4경기" ← 실제 3경기). 그래서 세는 일은 전부 여기서 하고,
 * 모델에게는 **고르고 다듬는 일만** 남긴다.
 */
export function formFacts(form: FormMatch[]): string {
  const total = form.length
  const win = form.filter(m => m.our > m.their).length
  const draw = form.filter(m => m.our === m.their).length
  const loss = form.filter(m => m.our < m.their).length
  const scored = form.reduce((sum, m) => sum + m.our, 0)
  const conceded = form.reduce((sum, m) => sum + m.their, 0)

  /** 최신 경기부터 조건이 이어지는 길이. 전부 이어지면 total이 된다. */
  const streak = (predicate: (match: FormMatch) => boolean) => {
    const index = form.findIndex(match => !predicate(match))
    return index === -1 ? total : index
  }
  /** 연속 길이를 사람이 읽는 말로 — 기록 전체가 이어졌으면 "N경기 전부"라고 못박는다. */
  const streakText = (count: number) =>
    count === 0 ? '없음' : count === total ? `최근 ${total}경기 전부` : `최근 ${count}경기`

  const side = (isHome: boolean) => {
    const matches = form.filter(match => match.isHome === isHome)
    if (matches.length === 0) return '없음'
    const w = matches.filter(m => m.our > m.their).length
    const d = matches.filter(m => m.our === m.their).length
    return `${matches.length}경기 ${w}승 ${d}무 ${matches.length - w - d}패`
  }

  const perGame = (value: number) => (value / total).toFixed(1)

  return [
    `최근 ${total}경기 전적: ${win}승 ${draw}무 ${loss}패`,
    `연속 무승: ${streakText(streak(m => m.our <= m.their))}`,
    `연속 승리: ${streakText(streak(m => m.our > m.their))}`,
    `연속 득점: ${streakText(streak(m => m.our > 0))}`,
    `연속 무득점: ${streakText(streak(m => m.our === 0))}`,
    `연속 실점: ${streakText(streak(m => m.their > 0))}`,
    `연속 무실점: ${streakText(streak(m => m.their === 0))}`,
    `총 득점 ${scored}골(경기당 ${perGame(scored)}), 총 실점 ${conceded}골(경기당 ${perGame(conceded)})`,
    `2골 이상 실점한 경기: ${form.filter(m => m.their >= 2).length}경기`,
    `2골 이상 넣은 경기: ${form.filter(m => m.our >= 2).length}경기`,
    `양 팀 모두 득점한 경기: ${form.filter(m => m.our > 0 && m.their > 0).length}경기`,
    `홈: ${side(true)}`,
    `원정: ${side(false)}`,
  ].join('\n')
}

const PROMPT = `${NUFC_LABEL}의 최근 경기 기록과, 거기서 계산해둔 사실 목록이다.

[경기 기록] (최신순, "우리 득점-상대 득점")
{{RECORD}}

[계산된 사실]
{{FACTS}}

다음 경기 스코어를 예측하는 팬에게 가장 도움이 될 사실 **하나**를 골라, 한국어 한 문장으로 써라.

규칙:
- [계산된 사실]에서 **항목 하나만** 고른다. 두 항목을 한 문장에 합치지 않는다.
- 고른 항목의 **숫자를 반드시 문장에 넣는다**. 숫자 없는 뭉뚱그린 문장은 쓰지 않는다.
- 숫자는 [계산된 사실]에 적힌 값을 그대로 옮긴다. 직접 세거나 계산하지 않는다.
- 한 문장, 45자 이내, "~했다" 평서체. 주어는 "${NUFC_LABEL}은".
- [계산된 사실]에 없는 정보(상대팀 상태, 순위, 부상, 이적)는 절대 지어내지 않는다.
- "없음"이거나 0인 항목은 고르지 않는다.
- 밋밋한 전적 나열보다, 흐름이 뚜렷한 것(연속 기록, 눈에 띄는 득실 편차, 홈원정 차이)을 고른다.
- 다음 경기 결과를 예상하거나 조언하지 않는다. 사실만 말한다.
- 문장만 출력한다. 따옴표, 머리말, 설명을 붙이지 않는다.

좋은 예: "${NUFC_LABEL}은 최근 5경기 전부 양 팀 모두 득점했다"
좋은 예: "${NUFC_LABEL}은 최근 4경기 연속 승리가 없었다"
나쁜 예(숫자 없음, 두 항목을 합침): "${NUFC_LABEL}은 최근 경기에서 연속 득점과 연속 실점을 기록했다"`

/** 생성 실패. 빈 문자열도 캐시해서 재호출을 막는다(아래 CACHE_TTL 주석 참고). */
const FAILED = ''

/**
 * 무료 티어 안에서만 돈다. 한도를 넘기지 않기 위한 장치가 셋이다:
 *
 * 1. 성공이든 실패든 `unstable_cache`에 남는다 — 실패를 캐시하지 않으면 429가 한 번 난 뒤로
 *    페이지가 열릴 때마다 재호출이 나가 한도를 계속 태운다.
 * 2. 그래서 반환값은 예외가 아니라 문자열이다. 실패는 FAILED(빈 문자열)로 캐시된다.
 * 3. 429(한도 초과)는 **재시도하지 않는다** — 다시 두드려봐야 한도만 더 쓴다.
 *    일시적 과부하(503/5xx)만 한 번 더 시도한다.
 *
 * 무료 티어 일일 한도는 `GenerateRequestsPerDayPerProjectPerModel-FreeTier`로 걸린다
 * (2026-08-25 gemini-2.5-flash 실측값은 20회였다 — 모델마다 다르므로 현재 모델의 한도는 미확인).
 * CACHE_TTL이 6시간이라 같은 기록 기준 하루 최대 4회만 나간다.
 */
async function generateInsight(record: string, facts: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return FAILED

  const body = JSON.stringify({
    contents: [{ parts: [{ text: PROMPT.replace('{{RECORD}}', record).replace('{{FACTS}}', facts) }] }],
    generationConfig: {
      maxOutputTokens: 200,
      // 한 문장 요약에 추론 단계가 필요 없다. 켜두면 무료 티어 한도만 빨리 닳는다.
      thinkingConfig: { thinkingBudget: 0 },
    },
  })

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 1200))

    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body,
        // 예측 화면 렌더를 오래 붙잡지 않도록 끊는다.
        signal: AbortSignal.timeout(8000),
      })

      if (response.ok) {
        const parsed = await response.json()
        const text: unknown = parsed?.candidates?.[0]?.content?.parts?.[0]?.text
        if (typeof text === 'string' && text.trim()) return text.trim()
        console.error('generateInsight: 빈 응답')
        return FAILED
      }

      console.error('generateInsight error:', response.status, (await response.text().catch(() => '')).slice(0, 300))
      // 429는 한도 초과라 재시도가 곧 추가 소모다. 4xx도 다시 보내야 같은 답이다.
      if (response.status < 500) return FAILED
    } catch (error) {
      // 타임아웃·네트워크 오류. 남은 시도가 있으면 한 번 더.
      console.error('generateInsight error:', error)
    }
  }

  return FAILED
}

/**
 * 6시간. 짧게 잡으면 무료 한도를 태우고, 길게 잡으면 실패가 그만큼 오래 굳는다.
 * 경기 결과는 크론이 하루 한 번(KST 08:00) 넣으므로 6시간이면 신선도에도 문제가 없다.
 */
const CACHE_TTL = 21600

/**
 * 경기 기록이 같으면 같은 문장을 재사용한다 — 인자가 unstable_cache의 캐시 키에 들어가므로
 * 결과가 새로 적재될 때만 새 문장이 생성된다. 호출은 사실상 주 1회라 무료 티어로 충분하다.
 */
const getCachedInsight = unstable_cache(generateInsight, ['prediction-insight'], {
  revalidate: CACHE_TTL,
})

/**
 * 스코어 단계 카드에 넣을 문장. 키가 없거나(로컬·mock) 한도를 넘겼거나 생성에 실패하면 null —
 * 호출부는 null이면 카드를 그리지 않는다. 예측 자체는 이 기능 없이도 그대로 동작해야 한다.
 */
export async function getWeekInsight(weeks: WeekGroup[]): Promise<string | null> {
  if (IS_MOCK) return null

  const form = recentForm(weeks)
  // 근거가 두 경기도 안 되면 "흐름"이라고 부를 게 없다 — 시즌 초에 억지 문장이 나오는 걸 막는다.
  if (form.length < 3) return null

  // 생성에 실패했으면(키 없음·한도 초과·과부하) 빈 문자열이 온다 — 카드를 아예 안 그린다.
  return (await getCachedInsight(formLines(form), formFacts(form))) || null
}
