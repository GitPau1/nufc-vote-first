# Lighthouse 분석 리포트 (3차) — 폰트 서브셋 적용 후

- **측정일시**: 2026-08-25 20:16 KST
- **대상 URL**: https://nufc-fan-poll.vercel.app/ (메인)
- **환경**: 모바일 / 4x CPU 스로틀 / 1,474 kbps · RTT 150ms (1·2차와 동일 설정)
- **원본**: `nufc-fan-poll.vercel.app-20260825T201630_lighthouse.json`
- **비교 대상**: `20260819_lighthouse_분석.md`(1차), `20260819_lighthouse_분석_리전변경후.md`(2차)

## 1. 점수 비교

| 카테고리 | 1차 | 2차 | **3차** | 변화(2차→3차) |
|---|---|---|---|---|
| Performance | 55 🔴 | 73 🟡 | **80** 🟡 | ▲ 7 |
| Accessibility | 96 🟡 | 96 🟡 | **96** 🟡 | 변화 없음 |
| Best Practices | 100 🟢 | 100 🟢 | **73** 🔴 | ▼ 27 **회귀** |
| SEO | 100 🟢 | 100 🟢 | **100** 🟢 | 변화 없음 |

### Core Web Vitals 비교

| 지표 | 1차 | 2차 | **3차** | 판정 |
|---|---|---|---|---|
| FCP | 11.9 s | 1.9 s | **2.3 s** | 🟡 |
| Speed Index | 11.9 s | 2.9 s | **2.3 s** | 🟢 |
| LCP | 14.2 s | 14.4 s | **4.9 s** | 🟡 (▲ 9.5s 개선) |
| TTI | 14.3 s | 14.5 s | **5.2 s** | 🟡 |
| TBT | 0 ms | 2 ms | **18 ms** | 🟢 |
| CLS | 0 | 0 | **0.0001** | 🟢 |
| TTFB | 613 ms | 854 ms | **611 ms** | 🟢 |

**2차 리포트의 최우선 과제(Pretendard 셀프호스팅 + 서브셋)는 적용됐다.** jsdelivr에서 받던 2,060KB 단일 폰트가 Vercel 자체 호스팅 `woff2-dynamic-subset` 조각으로 바뀌었고, LCP가 14.4초 → 4.9초로 내려왔다. 2차에서 지목한 "대역폭 문제"가 실제로 풀린 것이다.

**대신 새 문제 두 개가 생겼다.**

- Best Practices 100 → 73 회귀 (hydration 에러)
- 폰트는 여전히 전송량 1위 (262KB, 요청 10개) — 서브셋화가 절반만 된 상태

### 서버·JS는 이제 병목이 아니다

TTFB 611ms(그중 서버 처리 6ms), TBT 18ms, CLS 0.0001. 백엔드 응답·JS 실행·레이아웃 안정성은 전부 정상 범위다. **남은 건 전송 바이트와 회귀 2건**이며, 이번 리포트는 그것만 다룬다.

---

## 2. [최우선] Best Practices 회귀 — hydration mismatch

### 증상

콘솔에 React 에러 3개가 찍힌다. `errors-in-console`(score 0)과 `inspector-issues`(score 0)가 여기서 온다.

| 에러 | 의미 |
|---|---|
| **#425** | Text content does not match server-rendered HTML — 텍스트 노드가 다르다 (**원인**) |
| **#418** | Hydration failed because the initial UI does not match — 하이드레이션 실패 (**결과**) |
| **#423** | Suspense 경계 밖 에러라 **root 전체가 클라이언트 렌더링으로 전환** (**대가**) |

\#423이 핵심이다. **서버가 만들어 보낸 HTML을 통째로 버리고 브라우저가 처음부터 다시 그린다.** SSR을 켜둔 채로 CSR 비용을 내고 있는 상태다.

### 원인 — 서버는 UTC, 브라우저는 KST

Vercel 서버 런타임의 기본 타임존은 UTC고 브라우저는 사용자 로컬(KST)이다. `toLocaleString`/`toLocaleDateString`에 `timeZone`을 지정하지 않으면 **각자의 기본 타임존**을 쓴다. 실측:

```
formatKickoff('2026-08-30T11:30:00Z')
  서버(UTC)    → "8월 30일 (일) 오전 11:30"
  브라우저(KST) → "8월 30일 (일) 오후 8:30"     ← 9시간 차이, 100% 불일치

formatDate('2026-06-01T16:20:00Z')
  서버(UTC)    → "2026.06.01"
  브라우저(KST) → "2026.06.02"                  ← 날짜가 하루 밀림
```

### 고쳐야 할 지점

#### ① `components/composition/predict/MatchdayHero.tsx:23-31` — `formatKickoff()` ← 최우선

```js
function formatKickoff(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'long', day: 'numeric', weekday: 'short',
    hour: 'numeric', minute: '2-digit',
    // timeZone 없음 ← 여기
  })
}
```

`MatchdayHero.tsx:200`에서 홈 히어로 카드에 렌더된다. 즉 **첫 화면 최상단, LCP 영역**이다. 시각(시:분)까지 찍으므로 UTC↔KST 9시간 차이가 **매번 예외 없이** 어긋난다. Lighthouse가 잡은 #425는 사실상 이 한 곳이다.

> 같은 파일 `MatchdayHero.tsx:34-42`의 `useCountdown`은 `now === null` 가드로 이 문제를 이미 올바르게 막고 있고 주석까지 달려 있다("서버 렌더 시점엔 now가 없어 hydration mismatch가 나므로"). 카운트다운에서는 인지했는데 **두 줄 위 `formatKickoff`에서는 놓쳤다.**

#### ② `lib/utils.ts:55-59` — `formatDate()`

```js
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',   // timeZone 없음
  }).replace(/\. /g, '.').replace(/\.$/, '')
}
```

`PollCard.tsx:117,165`에서 투표 카드마다 `created_at`을 찍는다. UTC 15:00 이후 생성된 데이터는 KST 기준 하루 뒤라 날짜가 밀린다. 홈에 보이는 "2026.06.01"이 실제로는 06.02일 수 있다 — **mismatch 이전에 그냥 표시가 틀린 것**이다.

같은 함수가 **3곳에 각각 복사돼 있다**:

| 위치 | 컴포넌트 종류 | 영향 |
|---|---|---|
| `lib/utils.ts:55` | 공용 (PollCard가 사용) | hydration mismatch + 표시 오류 |
| `components/composition/my/MyPageClient.tsx:22` | `'use client'` | hydration mismatch + 표시 오류 |
| `app/players/changes/page.tsx:9` | 서버 컴포넌트 | hydration은 무관, **날짜가 UTC로 틀리게 표시됨** |

`components/composition/polls/CommentsSection.tsx:38`도 같은 패턴(`toLocaleDateString('ko-KR', ...)`, timeZone 없음)이다.

#### ③ `components/composition/polls/PollCard.tsx:36-55` — `formatTimeLeft()` / `getStatusTone()`

이건 타임존이 아니라 **`Date.now()`를 렌더 중에 호출하는 것** 자체가 문제다.

```js
export function formatTimeLeft(closesAt: string): string {
  const diff = new Date(closesAt).getTime() - Date.now()   // ← 렌더마다 값이 달라짐
  ...
}
```

`app/page.tsx:8`에 `export const revalidate = 30`이 걸려 있다. 서버가 만든 HTML은 **최대 30초 묵은 것**이고 브라우저는 지금 시각으로 다시 계산한다. D-day 경계를 넘는 순간 서버는 `D-1`, 브라우저는 `D-Day`를 그린다. `getStatusTone`(PollCard.tsx:49-55)도 같은 계산으로 뱃지 색(`default` ↔ `destructive`)이 갈린다.

영향 지점: `PollCard.tsx:101,102,144,145`(뱃지), `PollHeroCard.tsx:32`. `lib/utils.ts:47`의 `formatScheduled()`도 동일 패턴이다.

**산발적으로만 재현되는 종류의 버그**라 더 나쁘다.

### 고치면 뭐가 좋아지나

1. **Best Practices 73 → 100 복구.** `errors-in-console`·`inspector-issues`가 사라진다. 08-19까지 100이던 게 떨어진 회귀라 원상복구다.
2. **LCP 개선 (실질 이득).** 지금 #423 때문에 SSR HTML을 버리고 root 전체를 재렌더한다. LCP 세부는 `TTFB 9.8ms` / `elementRenderDelay 201ms` — **서버는 이미 빠른데 화면에 그려지는 게 늦다.** 그 지연의 상당 부분이 "그렸다 지우고 다시 그리기"다. 아래 3·4번(폰트/이미지) 개선 효과도 지금은 이 재렌더에 먹히고 있다.
3. **표시 오류가 실제로 고쳐진다.** 성능과 별개로, **지금 화면의 날짜와 킥오프 시각이 틀리게 보이고 있다.** 킥오프 "오후 8:30" 경기가 첫 페인트에 "오전 11:30"으로 떴다가 바뀐다. 축구 경기 시각을 보여주는 서비스에서 이건 성능 이슈가 아니라 기능 버그다.
4. **깜빡임 제거.** 클라이언트 재렌더 시 텍스트가 한 번 바뀌는 게 눈에 보인다. 레이아웃은 그대로라 CLS로는 안 잡힌다.

### 조치안

**①②는 방향이 명확하다** — `timeZone: 'Asia/Seoul'` 지정. 서비스가 한국어 전용이고 KST 경기 시각을 다루므로 브라우저 로컬 추종이 아니라 KST 고정이 맞다. `formatDate`는 각 사본을 따로 고치지 말고 **`lib/utils.ts` 것으로 합치고 나머지 2곳을 삭제**해야 같은 사고가 재발하지 않는다.

**③은 결정이 필요하다 — 임의 진행하지 않음.** 두 방향이 갈린다:

- **(가)** 서버 쿼리 시점(`getPollHomeSections`)에서 D-day 문자열/톤을 계산해 `PollListItem`에 실어 내린다. 서버·클라가 같은 값을 본다. 30초 캐시 동안 D-day가 안 움직이지만 실사용상 문제없음. 대신 `PollListItem` 타입·쿼리·`types/database.ts`를 건드린다.
- **(나)** `useCountdown`처럼 마운트 전엔 D-day를 안 그린다. 첫 페인트에 뱃지가 비거나 톤이 한 번 바뀐다.

(가)가 깔끔해 보이지만 타입과 쿼리를 건드리는 일이라 **사용자 확인 후 진행**한다.

### 검증

- 수정 후 프로덕션 빌드에서 콘솔에 React #418/#423/#425가 안 뜨는지 확인.
- `npm test`의 기존 94개 통과 확인 (이 테스트들은 소스 문자열 정규식 검사라 함수 시그니처가 바뀌면 깨질 수 있음).
- 타임존 회귀 방지 단위 테스트는 현재 없다 — ②를 합치는 김에 `formatDate`에 KST 고정을 단정하는 테스트 한 개를 붙이는 것이 값싸다.

---

## 3. 폰트 262KB / 요청 10개 — 전송량 1위

### 현황

2차의 2,060KB 단일 파일 문제는 해결됐지만, 현재도 **폰트가 전체에서 가장 무겁다**.

| 리소스 | 요청 수 | 전송량 |
|---|---|---|
| **Font** | **10** | **262 KB** |
| Script | 17 | 312 KB |
| Image | 13 | 211 KB |
| Stylesheet | 2 | 24 KB |
| 기타 | 9 | 25 KB |

실제로 받아온 조각: `PretendardVariable.subset.82 ~ 91` 10개 (21~38KB씩).

### 원인

`src/app/fonts/pretendard/pretendardvariable-dynamic-subset.css`는 **unicode-range 기반 동적 서브셋** 방식이다. 200여 개 조각으로 쪼개고 브라우저가 필요한 범위만 받는 구조인데:

- 한글 상용 음절 구간(subset 82~91)은 **어느 페이지에서나 거의 다 필요**하다. 결국 10개를 다 받는다.
- `network-dependency-tree-insight`(score 0) 확인 결과 체인이 이렇다:

  ```
  문서(13KB) → _next/static/css/104b7551....css(13KB) → woff2 조각 10개(262KB)
  ```

  **CSS 파싱이 끝나야 폰트 요청이 시작된다.** `render-blocking-insight`가 추정한 **1,230ms 절감 여지**의 실체가 이 체인이다.

동적 서브셋은 여러 언어를 섞어 쓰는 사이트를 위한 방식이고, **한국어 전용 서비스에서는 요청 수만 늘리는 손해**다.

### 고쳐야 할 지점 / 조치안

- **(단기)** 매번 뜨는 상위 서브셋 3~4개(82~85)를 `app/layout.tsx`에 `<link rel="preload" as="font" type="font/woff2" crossorigin>`으로 선언. CSS 파싱을 기다리지 않고 병렬로 착수한다. 파일 하나 몇 줄, 되돌리기 쉬움.
- **(근본)** `woff2-dynamic-subset` 200여 조각 대신 **KS X 1001 상용 2,350자 단일 서브셋 1개(약 80~100KB)**로 교체. 요청 10개 → 1개, 전송량 262KB → 100KB 수준. `src/app/fonts/pretendard/` 전체 교체 + CSS 재작성이라 작업량이 있다.

### 고치면 뭐가 좋아지나

- 폰트 전송량 **262KB → 약 100KB**, 요청 10개 → 1개.
- 크리티컬 체인 단축으로 **FCP·LCP 직접 개선** (render-blocking 추정 절감 1,230ms).
- `font-display: swap`이라 텍스트 자체는 이미 먼저 뜨지만, 폰트 전환(FOUT) 시점이 앞당겨져 체감 완성도가 올라간다.

---

## 4. 이미지 — `next/image`가 설정만 되고 한 번도 안 쓰인다

### 현황

`next.config.mjs`에 `images.remotePatterns`가 이미 있는데(`placehold.co`, `*.supabase.co`, `lh3.googleusercontent.com`), **`next/image` import는 코드베이스 전체에 0건**이다. 전부 raw `<img>` 태그이고 18개 파일에 퍼져 있다.

`image-delivery-insight`(score 0.5, 63KB 절감 여지)가 지목한 것:

| 문제 | 실측 |
|---|---|
| poll 썸네일 원본 과대 | 509×400 원본을 **112×88로 표시** → 44KB 중 **28KB 낭비** |
| fotmob 로고/선수 사진이 PNG 원본 | 44×44로 표시하는 팀 로고가 **17KB PNG** (WebP/AVIF 미사용) |
| `images.fotmob.com`이 remotePatterns에 없음 | `next/image`로 바꾸려면 호스트 추가 필요 |

`cache-insight`(score 0.5, 86KB 절감 여지):

| URL | 현재 Cache-Control | 문제 |
|---|---|---|
| Supabase Storage 썸네일 3건 | **1시간** | 파일명에 타임스탬프가 있어 사실상 불변인데 1시간마다 재다운로드 |

최근 커밋 `3798a6a`("업로드에 cacheControl: '31536000' 추가")로 **신규 업로드는 고쳐졌지만 기존 파일에는 미적용**이다.

### 고쳐야 할 지점

- `components/composition/polls/PollCard.tsx` — 홈 목록 썸네일. **여기 하나만 `next/image`로 바꿔도 63KB 중 대부분을 회수**한다. 우선순위 1.
- `components/composition/predict/MatchdayHero.tsx` — 첫 화면 팀 로고 2개(각 17KB, 9KB). `images.fotmob.com`을 `next.config.mjs` remotePatterns에 추가해야 함.
- 기존 Supabase Storage 썸네일의 `Cache-Control` 재설정 (일회성 스크립트 또는 재업로드).

나머지 16개 파일은 첫 화면 밖이라 급하지 않다.

### 고치면 뭐가 좋아지나

- **초회 방문 63KB 절감** — `next/image`가 표시 크기에 맞춰 리사이즈하고 AVIF/WebP로 변환해 전달한다.
- **재방문 86KB 절감** — 캐시 수명 정상화.
- 이미지 211KB가 폰트 다음으로 무거우므로, 3번과 합치면 **전체 전송량의 30% 이상**이 줄어든다.
- 부수 효과: fotmob 이미지를 Vercel이 프록시하게 되면 아래 6번의 서드파티 쿠키 문제도 절반이 자동 해결된다.

---

## 5. 접근성 — 대비 실패 3건, 원인은 `opacity-70` 한 줄

### 현황

Accessibility 96점의 유일한 감점 항목이 `color-contrast`(score 0, 가중치 7). 실패 노드 3개가 **전부 "종료됨" 상태의 투표 카드 안**에 있다.

```
"종료됨" 뱃지  : #949494 on #f0f0f0 → 대비 2.66:1  (기준 4.5:1)
"0명"          : #949494 on #ffffff → 대비 3.03:1
날짜 텍스트     : 동일
```

### 원인

`components/composition/polls/PollCard.tsx:92`, `:136`

```js
className={`... ${poll.status === 'closed' ? 'opacity-70' : ''}`}
```

카드 컨테이너 전체에 `opacity-70`을 걸어서, **AA 통과하도록 손으로 맞춰둔 토큰 색이 화면상에서 무너진다.**

`app/globals.css:118`의 `--sem-fg-neutral-muted: #666666`은 그냥 팔레트 단계가 아니다. 바로 위 주석(globals.css:112-117)에 이렇게 적혀 있다:

> 팔레트 단계(neutral-700 #6e7277)가 아니라 손으로 맞춘 값이다 — neutral-700은 흰 배경에서는 4.84:1로 통과하지만 옅은 틴트 배경 위에서 무너진다

**옅은 배경 위에서 무너지는 걸 막으려고 손으로 맞춘 값을, 컨테이너 opacity가 무효화하고 있다.** #666666 × 0.7 = 화면상 #949494.

### 고쳐야 할 지점 / 조치안

`PollCard.tsx:92,136`의 컨테이너 `opacity-70`을 제거하고, "종료됨" 표현은 텍스트 색을 건드리지 않는 수단으로 옮긴다 — 예를 들어 썸네일 `<img>`에만 `grayscale`/opacity 적용(Lighthouse가 캡처한 스니펫을 보면 썸네일에는 이미 `grayscale`이 걸려 있다).

> 다만 "종료됨을 어떤 시각 언어로 표현할지"는 디자인 결정이라, 구체 방식은 확인 후 진행한다.

### 고치면 뭐가 좋아지나

- **Accessibility 96 → 100** (가중치 7짜리 유일한 실패 항목).
- 실사용 이득이 더 크다: 종료된 투표 카드의 날짜·참여자 수가 **저시력 사용자에게 사실상 안 보이는 상태**다. 모바일 야외 환경에서는 일반 사용자에게도 마찬가지다.
- Foundation 토큰이 의도대로 동작하게 된다 — 지금은 globals.css의 대비 계산 노력이 컴포넌트 한 줄에 무력화되고 있다.

---

## 6. 나머지 (저순위)

| 항목 | 내용 | 판단 |
|---|---|---|
| `legacy-javascript` | 19KB — `Array.at`, `Object.hasOwn`, `String.trimStart` 등 폴리필 | browserslist 상향으로 사라지지만 **체감 없음**. 미룬다. |
| `third-party-cookies` | 7건 — `images.fotmob.com`이 Hotjar 쿠키를, Mixpanel이 자체 쿠키를 심는다 | **4번(fotmob 이미지 프록시)으로 절반 자동 해결.** Mixpanel 쪽은 분석 도구라 유지 판단. |
| `unused-javascript` | 538KB 절감 표시 | **대부분 크롬 확장 프로그램**(`chrome-extension://...` 446KB + 60KB)이다. 시크릿 창에서 재측정하면 사라진다. **실제 자사 낭비는 `c857e369` 청크 44KB뿐**이고 이건 무시 가능. |
| `duplicated-javascript` / `font-display` / `modern-http` | 전부 통과 (score 1) | 조치 없음 |

> **측정 방법 개선**: 이번 측정은 확장 프로그램이 켜진 프로필에서 돌아갔다. 서드파티 항목(`third-parties-insight`)도 상위 3개가 전부 확장 프로그램이고 메인스레드 87ms를 먹었다. 다음 측정부터는 **시크릿 창 또는 `--chrome-flags="--disable-extensions"`**로 돌려야 자사 코드의 실제 비용이 보인다.

---

## 7. 권장 순서

| 순위 | 항목 | 규모 | 기대 효과 |
|---|---|---|---|
| 1 | **2번 ①② — timeZone 지정** | 파일 4개, 한 줄씩 | BP 73→100, LCP 개선, **표시 오류 수정** |
| 2 | **5번 — `opacity-70` 제거** | 한 줄 (+디자인 확인) | A11y 96→100 |
| 3 | **2번 ③ — `Date.now()` 렌더** | 타입·쿼리 변경 (**방향 확인 필요**) | 산발적 mismatch 근절 |
| 4 | **4번 — `next/image` 전환** | PollCard부터 점진 | 초회 63KB + 재방문 86KB |
| 5 | **3번 — 폰트 단일 서브셋** | 폰트 자산 전체 교체 | 262KB→100KB, 요청 10→1 |

**1·2번은 원인이 특정돼 있고 되돌리기 쉬워 바로 착수 가능하다.**
**3·4·5번은 전 화면에 걸치거나 타입·자산을 건드리므로, 착수 전에 범위를 먼저 합의한다.**

---

## 8. 2차 리포트 대비 요약

- ✅ **해결**: 2차 최우선 과제였던 Pretendard 2MB 단일 폰트 → 셀프호스팅 서브셋. LCP 14.4s → 4.9s.
- ⚠️ **남음**: 폰트가 여전히 전송량 1위(262KB). 서브셋화가 절반만 됐다.
- 🔴 **새 문제**: hydration mismatch로 Best Practices 100 → 73 회귀. 성능뿐 아니라 **날짜·킥오프 시각이 틀리게 표시되는 기능 버그**를 동반한다.
- 🆕 **새로 드러남**: LCP가 내려가면서 그동안 폰트에 가려져 있던 이미지 최적화 부재(`next/image` 미사용)가 다음 병목으로 올라왔다.
