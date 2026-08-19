# Lighthouse 분석 리포트 — nufc-fan-poll.vercel.app

- **측정일시**: 2026-08-19 01:51 UTC (10:51 KST)
- **대상 URL**: https://nufc-fan-poll.vercel.app/ (메인)
- **환경**: Lighthouse 13.4.0 / 모바일 / 4x CPU 스로틀 / 1,474 kbps · RTT 150ms
- **원본**: `nufc-fan-poll.vercel.app-20260819T105107.json`

## 1. 점수 요약

| 카테고리           | 점수      | 판정       |
| -------------- | ------- | -------- |
| Performance    | **55**  | 🔴 개선 필요 |
| Accessibility  | **96**  | 🟡 거의 통과 |
| Best Practices | **100** | 🟢       |
| SEO            | **100** | 🟢       |

### Core Web Vitals

| 지표 | 값 | 점수 |
|---|---|---|
| FCP | **11.9 s** | 0 |
| LCP | **14.2 s** | 0 |
| Speed Index | **11.9 s** | 0.04 |
| TTI | 14.3 s | 0.09 |
| TBT | 0 ms | 1 🟢 |
| CLS | 0 | 1 🟢 |
| 서버 응답 시간 | 10 ms | 1 🟢 |

**해석**: 서버·JS 실행·레이아웃 안정성은 모두 만점이다. 성능 점수 55는 전적으로 **화면이 처음 그려지기까지 11.9초가 걸린다**는 한 가지 문제에서 나온다. 즉 "느린 앱"이 아니라 "첫 페인트를 막고 있는 리소스 하나"의 문제다.

## 2. 근본 원인 — Pretendard 전체 가변 폰트 2MB

크리티컬 렌더링 체인이 4단계로 이어지고, 마지막 단계가 2MB짜리 폰트다.

```
문서 (13KB, 254ms)
 └─ /_next/static/css/d2a6b8ede122ef72.css (8KB)
     └─ cdn.jsdelivr.net … pretendardvariable.min.css (648B)   ← 외부 도메인, @import
         └─ PretendardVariable.woff2  ★ 2,060,271 B (2,012 KiB)
```

- 페이지 전체 전송량 2,618 KiB 중 **폰트 하나가 2,012 KiB (77%)**.
- 스로틀 대역폭 1,474 kbps 기준 이 폰트 하나의 다운로드 시간 ≈ **11.2초**. 측정된 FCP 11.9초와 정확히 일치한다.
- 렌더 차단 감사(`render-blocking-insight`)가 추정한 절감 가능 시간도 **10,920ms**로 같은 값을 가리킨다.
- 게다가 CSS가 `jsdelivr` 외부 도메인을 경유하는데 **preconnect 힌트가 하나도 없다** (Lighthouse: "no origins were preconnected"). DNS+TLS 왕복이 체인에 그대로 추가된다.

### 조치안 (우선순위 1)

1. **`next/font/local`로 폰트 셀프 호스팅 + 서브셋** — 한글 상용 2,350자 + 라틴 서브셋이면 2MB → 200~400KB 수준. `next/font`는 `font-display: swap`과 preload를 자동 처리하므로 렌더 차단 자체가 사라진다.
2. 셀프 호스팅이 당장 어렵다면 최소한 **가변 폰트 전체 대신 정적 웨이트(400/700)만** 로드하고, `<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>`을 추가한다.

> 이 하나만 해결하면 FCP/LCP/SI/TTI 4개 지표가 동시에 정상권으로 들어간다. 성능 점수 55 → 90+ 예상.

## 3. 이미지 (우선순위 2)

`image-delivery-insight` 절감 추정 **230 KiB**.

| 문제 | 대상 | 내용 |
|---|---|---|
| 과대 원본 | `contentfulproxy.stadion.io/…UCL_v_USG_match_report_25-26.jpg` (192 KiB) | 1440×1440 원본을 **96×96**으로 표시. 191 KiB가 순수 낭비 — 리스트 썸네일에 기사 원본 이미지를 그대로 쓰고 있다. |
| 압축 부족 + 과대 | Supabase Storage `poll-thumbnails/*.webp` 6장 (총 ~160 KiB) | 400×400 파일을 96×96 슬롯에 표시. |
| LCP 이미지 | `player-photos/…` (메인 상단 372×252 배너) | `fetchpriority="high"` 미적용 — Lighthouse LCP 체크리스트 3개 중 유일한 실패 항목. |

**조치안**

- LCP 배너 `<img>`에 `fetchpriority="high"` 추가 (또는 `next/image`의 `priority`). 한 줄 수정.
- 외부 이미지(`contentfulproxy`)는 URL 쿼리의 `w=1920&h=1440`을 실제 표시 크기에 맞춰 축소. 프록시가 이미 리사이즈를 지원하므로 파라미터만 바꾸면 된다.
- 썸네일 업로드 파이프라인(`lib/images/optimize`)에서 리스트용 96px 변형을 별도 생성하거나 품질을 낮춘다.

## 4. 캐시 정책 (우선순위 3)

`cache-insight` 절감 추정 **317 KiB**.

| 리소스 | 현재 max-age | 문제 |
|---|---|---|
| `contentfulproxy.stadion.io` 이미지 | **15초** | 사실상 캐시 없음. 재방문마다 192 KiB 재다운로드. |
| Supabase Storage 이미지 6장 | 1시간 | 콘텐츠 해시가 파일명에 있으므로 훨씬 길게 가능. |

**조치안**: Supabase Storage 업로드 시 `cacheControl: '31536000'` (1년) 지정. 파일명에 타임스탬프가 이미 포함돼 있어 무효화 걱정이 없다. 외부 프록시 이미지는 캐시 정책 제어권이 없으므로 자체 Storage로 옮기거나 Next.js Image Optimization을 경유시킨다.

## 5. JavaScript

- **앱 자체 미사용 JS**: `chunks/c857e369-*.js` 95 KiB 중 **72 KiB 미사용**. 다만 TBT가 0ms이므로 실사용 체감 영향은 없다 — 우선순위 낮음.
- **레거시 폴리필**: `chunks/117-*.js`에 `Array.prototype.at/flat/flatMap`, `Object.fromEntries` 폴리필 19 KiB. `browserslist`를 최신 기준으로 좁히면 제거 가능.
- ⚠️ **측정 노이즈**: `unminified-javascript` 111 KiB와 `unused-javascript` 493 KiB의 대부분은 `chrome-extension://` 스크립트다. **측정 시 Chrome 확장 프로그램이 켜져 있었다** — 이 두 감사 항목의 수치는 실제 앱과 무관하니 무시할 것. 다음 측정은 시크릿 모드/확장 비활성 상태로 진행 권장.

## 6. 접근성 96점 — 색상 대비 (유일한 실패 항목)

`color-contrast` 위반 **32건**. WCAG AA 기준(일반 텍스트 4.5:1) 미달.

| 색상 조합 | 대비 | 사용처 |
|---|---|---|
| `#41b5e6` on `#ffffff` | **2.33** | 탭 버튼 활성 상태 (13px bold) |
| `#53b7df` on `#eef8fd` | **2.11** | 배지 `bg-primary-dim` (11px) |
| `#a8a8a8` on `#ffffff` | **2.37** | 탭 버튼 비활성 상태 |
| `#8c8c8c` on `#ffffff` | **3.36** | `text-gray-2` 캡션 (11~12px) |

**조치안**: 개별 컴포넌트가 아니라 **디자인 토큰 레벨에서 한 번에 고친다**. Tailwind 설정의 `primary`/`gray-2` 값을 조정하면 32건이 동시에 해결된다.

- `#41b5e6` → `#1a7fa8` 수준(대비 4.5+)으로 어둡게. NUFC 하늘색 정체성은 배경·보더에 남기고 **텍스트에만** 진한 변형을 쓴다.
- `#8c8c8c` → `#6b6b6b` (대비 5.0+).
- 배지는 전경색을 어둡게 하거나 `bg-primary-dim` 배경을 더 진하게.

## 7. 실행 순서

| # | 작업 | 예상 효과 | 난이도 |
|---|---|---|---|
| 1 | Pretendard 셀프 호스팅 + 서브셋 (`next/font/local`) | **FCP/LCP −11초**, 성능 55 → 90+ | 중 |
| 2 | LCP 이미지에 `fetchpriority="high"` | LCP 추가 개선 | 하 (1줄) |
| 3 | 외부/Storage 썸네일 크기 정합 | −230 KiB | 중 |
| 4 | Storage `cacheControl` 1년 | 재방문 −317 KiB | 하 |
| 5 | 색상 토큰 대비 조정 | 접근성 96 → 100 | 하 |
| 6 | `browserslist` 정리 | −19 KiB | 하 |

1번만으로 성능 문제의 대부분이 해결된다. 2·4·5번은 각각 몇 줄짜리 수정이므로 함께 처리해도 부담이 없다.

## 8. 재측정 시 주의

- Chrome 확장 프로그램을 끈 상태(시크릿 모드 + 확장 차단)로 측정할 것. 이번 결과의 JS 관련 수치가 오염됐다.
- Vercel 콜드 스타트 영향을 배제하려면 2회 이상 측정 후 중앙값을 쓴다. (이번 측정의 서버 응답 10ms는 이미 웜 상태였다.)
