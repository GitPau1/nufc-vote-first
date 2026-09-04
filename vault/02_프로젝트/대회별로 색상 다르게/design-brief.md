# design-brief — 대회별로 색상 다르게

작성: 2026-09-04 · 작성자: designer 에이전트
개정: 2026-09-04 · 6번 "확정 필요" 5개 항목 전부 사람 승인 완료(그중 MatchdayHero 방향은 초안에서 변경됨, 3-1번 참고) — `intent.md` "design-brief 승인 결과" 섹션 반영
개정 2: 2026-09-05 · 시안(`시안.html`) 검토 후 MatchWeekList 주차 컨테이너 글로우 삭제 확정(3-2번 변경, 초안 "건드리지 않는다"에서 변경됨) — `intent.md` "시안 검토 후 추가 확정" 섹션 반영, 오케스트레이터가 직접 갱신
개정 3: 2026-09-05 · **친선경기 색상이 orange 대체 → 정식 `--p-yellow-*` 팔레트 신설로 전면 교체됨.** 시안 위에서 실측 비교하며 배지 공식(12%+700 → 100+800, 3색 공통)·다크 글로우 공식(오렌지 예외 폐기, 3색 다 표준 공식)까지 재확정 — 2번·3-1번·3-3번·4번·5번·6번·7번 전부 갱신. `intent.md` "최종 색상 확정" 섹션 반영, 오케스트레이터가 직접 갱신. 팔레트 계산 근거는 `노란-팔레트-제안.md` 참고.
입력: `intent.md`(단일 소스) · `노란-팔레트-제안.md` · `시안.html` · `MatchdayHero.tsx` · `MatchWeekList.tsx` · `PredictionFlowClient.tsx` · `PredictionDone.tsx` · `shared.tsx` · `PredictionResult.tsx` · `globals.css` · `tailwind.config.ts` · `badge.tsx` 실제 코드 확인
승인권자: 사용자 (프로덕트 디자이너) — 전부 승인 완료, 추가 확인 불필요

이 문서는 개발자 에이전트의 `feature-spec.md` 입력 자료로 그대로 전달된다. 코드는 포함하지 않는다(클래스명·구현 방식은 개발자 재량).

---

## 1. 문제 정의 (intent.md에서 이어받음)

승부예측 화면 3곳(`MatchdayHero`, `MatchWeekList`, `PredictionFlowClient`)이 대회명을 텍스트로만 노출하고 있어 어떤 대회 경기인지 한눈에 구분되지 않는다. Linear 요청은 "약한 그라디언트"로 3개 버킷(프리미어리그=보라·기타 컵 대회=초록·친선경기=노랑)을 구분하는 것이나, intent.md에 그라디언트 적용 위치·정확한 색상값·다크 카드 대비·활성화 조건·완료 화면 처리 5가지가 "근거 미확인"으로 남아 있다(intent.md L51-58). 이 문서가 그 5가지를 확정(제안)한다.

---

## 2. 색상 값 — 왜 기존 semantic 토큰을 재사용하지 않는지 (2026-09-05 전면 개정 — orange 대체 폐기)

### 2-1. 결론

**팔레트(`--p-*`) 값을 컴포넌트 레벨에서 직접 참조하는 새 전용 유틸리티**로 간다. 새 semantic 토큰(`--sem-*`)은 만들지 않고, 기존 `magic`/`positive`/`warning` semantic도 재사용하지 않는다.

- 프리미어리그: `--p-violet-700` (#9130e7) 계열
- 기타 컵 대회: `--p-green-700` (#008728) 계열
- 친선경기: **`--p-yellow-*` (신규 팔레트 계열, 11단계)** — 애초 안이었던 "orange로 대체"는 폐기됐다. 이 팔레트에 순수 노란색이 없다는 공백을 임시 대체가 아니라 **정식 8번째 팔레트 계열 신설**로 해결했다. 색상각·11단계 생성·대비 검증은 `노란-팔레트-제안.md`에 별도로 정리돼 있고(이 문서가 값의 근거), 사람이 그 위에서 여러 후보를 시안(`시안.html`)으로 실측 비교한 뒤 최종 확정했다.

근거가 되는 기존 선례는 `globals.css`의 `.spotlight-glow-brand*`/`.award-gold`다 — 둘 다 "다크/색 면 전용 semantic 토큰이 없을 때 팔레트 값을 컴포넌트 레벨에서 직접 쓰는" 예외로 이미 명시적으로 허용돼 있다(`globals.css` L210-230 주석). 이번 3색도 세 번째 사례로 같은 패턴을 따른다.

### 2-2. semantic 재사용을 배제한 실측 근거 (충돌 사례)

처음엔 이미 AA 검증까지 끝난 `magic`(보라)/`positive`(초록)/`warning`(주황) semantic 토큰을 그대로 쓰는 안을 검토했다 — `bg-magic-weak text-magic` 등은 이미 Tailwind에 노출돼 있고(`tailwind.config.ts` L61-110) 대비도 통과된 값이라 새로 계산할 게 없어 매력적이었다. 하지만 실제 코드를 보니 이 세 토큰은 **같은 승부예측 화면군 안에서 이미 다른 의미로 쓰이고 있다**:

| 토큰 | 기존 의미 | 사용처 |
|---|---|---|
| `bg-magic-weak text-magic` (보라) | **3툰(고비용 선수) 배지** | `shared.tsx` L114-117 `TOON_TIER`, `PredictionFlowClient`의 '픽' 단계에서 `ToonCost`로 실제 렌더됨 |
| `bg-warning-weak`/`text-warning` (주황) | **평점 "중간" 등급 배지**, `MatchdayHero`의 "최우수 선수" 골드 카드 배경 | `PredictionResult.tsx` L418 `TIER_BADGE.mid`, `MatchdayHero.tsx` L114 `RatingCard` award variant |
| `bg-positive-weak text-positive` (초록) | **적중/득점 배지("+N점", "정확히 적중")** | `PredictionResult.tsx` L417,439,456, `PredictionDone.tsx` L306 `HitBadge` |

즉 `PredictionFlowClient`의 '픽' 단계 화면 하나에 "프리미어리그=보라 배지"와 "3툰 선수=보라 배지"가 동시에 뜰 수 있고, `MatchdayHero`는 이미 "최우수 선수" 카드에 주황/골드를 잔뜩 쓰고 있어 "친선경기=주황 글로우"를 얹으면 한 카드 안에서 주황이 두 가지 뜻(대회 구분 vs 최우수 선수)으로 겹친다. 이게 CLAUDE.md 4번 원칙("근거 없이 결정하지 않는다")이 말하는 실재 근거이자, 이번 3색이 새 전용 유틸리티로 가야 하는 이유다 — 기존 토큰을 재사용하면 같은 화면 안에서 같은 색이 서로 다른 뜻을 가지게 된다.

### 2-3. 제안 값 (2026-09-05 갱신 — 배지 공식이 바뀌었다)

라이트 카드 약한 배경(기존 `.spotlight-glow-brand` 그대로, 베이스만 카드에 맞게) — **변경 없음**:
```
linear-gradient(to bottom, color-mix(in srgb, var(--p-{색}-700) 8%, transparent) 0%, transparent 25%), {카드 베이스}
```
다크 카드 강한 배경(기존 `.spotlight-glow-brand-strong` 그대로, 색만 교체) — **변경 없음, 3색 공통(노랑도 예외 없이 같은 공식)**:
```
radial-gradient(250px at 0% 0%,   color-mix(in srgb, var(--p-{색}-700) 15%, transparent) 0%, transparent 70%),
radial-gradient(250px at 100% 0%, color-mix(in srgb, var(--p-{색}-600) 15%, transparent) 0%, transparent 70%),
var(--sem-bg-neutral-strong)
```
**배지 — 공식이 바뀌었다.** 초안("12% 섞은 배경 + 700 텍스트")은 노랑의 700단계(`#7d7400`)가 올리브/카키로 보이는 문제를 시안 위에서 실측하다가 **폐기**됐다. 배경을 옅게 섞지 않고 **팔레트 100단계를 그대로 배경으로 쓰고, 텍스트를 800단계로 올리는** 쪽이 3색 다 더 선명하고 일관되게 보인다는 게 실측(시안 비교)으로 확인돼 이 쪽으로 확정했다:
```
background: var(--p-{색}-100);
color: var(--p-{색}-800);
```
| 색 | 배경(100) | 텍스트(800) | 대비 |
|---|---|---|---|
| 프리미어리그(violet) | `#fceaff` | `#6924a9` | 7.565 |
| 기타 컵 대회(green) | `#e2fce5` | `#0a642a` | 6.723 |
| 친선경기(yellow) | `#fff58e` | `#5c5500` | 6.790 |

**이 공식으로 바꾼 이유가 노랑만의 문제가 아니라는 점이 중요하다**: 100단계 배경 위에서 700 텍스트를 그대로 쓰면 노랑(4.280)·초록(4.290) 둘 다 AA(4.5) 미달이고 보라(4.854)만 통과한다 — 즉 애초 "12%+700" 공식이 배경을 더 진하게(원시 100단계로) 바꾸는 순간 3색 다 같이 깨진다. 그래서 텍스트를 800으로 올려 3색을 다시 통일시켰다. (참고로 50/200단계 배경도 같은 방식으로 실측했으나 100단계로 최종 확정.)

클래스명 자체는 개발자 재량이다(예: `.comp-glow-violet` 등 제안 가능하지만 강제하지 않음).

---

## 3. 컴포넌트별 적용 시안

세 곳 모두 "카드 배경 전체"가 기본값이 아니라, **각 컴포넌트의 기존 구조가 이미 뭘 갖고 있는지에 따라 답이 갈린다** — 구조를 무시하고 세 곳에 같은 처리를 강제하지 않는다.

### 3-1. MatchdayHero (다크 카드) — 카드 배경 전체 교체, 파랑 글로우 완전 제거 (2026-09-04 사람 확정 — 초안에서 방향 변경됨)

> 이 절은 초안(`isUpcoming`일 때만 색, 그 외엔 기존 파랑 글로우 유지)에서 사람이 대화 중 방향을 바꿔 확정한 최종 규칙으로 다시 썼다. intent.md "design-brief 승인 결과" 2번 참고.

- **어디**: 카드 전체를 감싸는 `.spotlight-glow-brand-strong`(`MatchdayHero.tsx` L179)을 대회 색 버전으로 **교체**한다. 상시 켜져 있던 파랑(`--p-blue-700`/`--p-blue-600`) 글로우는 완전히 제거된다 — 이제 이 카드에 파랑이 남는 자리는 없다. 텍스트(대회명·팀명·스코어)는 색을 입히지 않는다.
- **왜 배경 전체인가, 배지가 아닌가**: (변경 없음) 이 카드는 이미 "카드 배경 전체로 상태를 말하는" 유일한 방식을 쓰고 있어, 새 배지를 얹기보다 기존 배경 레이어의 색만 바꾸는 게 가장 낮은 리스크다.
- **활성화 조건 (확정, 초안과 다름)**: 기준이 "예측 가능 여부"(`isUpcoming`)가 아니라 **경기 종료 여부**로 바뀌었다.
  - **진행 중**(`fixture.started && !fixture.finished`): 대회색 유지. "예측 가능할 때만 색이 나온다"는 총칙(intent.md L41)의 명시적 예외다 — 예측은 이미 마감됐어도 지금 뛰고 있는 경기라 대회 정체성을 계속 보여주는 게 자연스럽다는 게 확정 근거(intent.md L66).
  - **예정**(`isUpcoming = !fixture.started && !fixture.finished`): 대회색.
  - **종료**(`fixture.finished`): 무채색.
  - 즉 실질적으로 **`!fixture.finished`** 하나가 "색이 있는지"를 전부 결정한다 — `isUpcoming`/`isLive`를 따로 분기할 필요가 없다.
- **무채색(종료) 처리**: 그라디언트 레이어를 걷어내고 **`--sem-bg-neutral-strong` 평면색**(이미 Tailwind `bg-neutral-strong`으로 노출된 기존 토큰)만 남긴다. 새 "회색 글로우" 포뮬러를 따로 만들지 않는다.
  - 근거: 이 기능의 다른 무채색 지점(MatchWeekList의 `bg-page`)도 전부 그라디언트가 아니라 평면 시맨틱 배경이다 — 종료 카드에만 별도 회색 그라디언트를 만들면 같은 기능 안에서 컴포넌트마다 "무채색"의 구현 방식이 갈린다. `bg-neutral-strong`은 애초에 `.spotlight-glow-brand-strong`이 베이스로 쓰던 값이라(`globals.css` L220 `var(--sem-bg-neutral-strong)`) 그라디언트 레이어만 빼면 이 색이 그대로 남아 — 새 값을 정할 필요조차 없다.
  - 종료 상태에서도 최우수 선수 카드(`RatingCard`의 `award-gold`, `MatchRatingsRow` L221)는 이번 기능과 무관하므로 그대로 유지한다 — 카드 배경(이제 무채색)과 최우수 선수 배지(골드)는 서로 다른 레이어라 충돌하지 않는다.

### 3-2. MatchWeekList (라이트 카드) — 경기 카드(`MatchInfoCard`) 배경 + 주차 컨테이너 글로우 삭제 (2026-09-05 사람 확정, 초안에서 변경됨)

> 이 절의 "주차 컨테이너는 건드리지 않는다"는 초안 판단은 시안 검토 후 사람이 기각했다. 최종 확정은 컨테이너 글로우를 **삭제**하는 것이다. intent.md "시안 검토 후 추가 확정" 참고.

- **어디**: 경기 하나짜리 카드(`MatchInfoCard`, `bg-page` 평면색, `MatchWeekList.tsx` L317)의 배경을 대회색 라이트 버전으로 바꾼다. **주차 컨테이너(`WeekSessionCard`)의 기존 `spotlight-glow-brand`(L229, "예측 접수 중" 파랑 강조)는 삭제한다** — `highlighted ? 'spotlight-glow-brand' : 'bg-surface'` 분기 자체를 없애고 컨테이너는 항상 `bg-surface`로 간다.
  - **왜 삭제해도 되는가**: "예측 접수 중" 정보는 이 글로우가 유일한 표시가 아니다 — 같은 카드의 "N주차" 옆에 이미 독립적인 `Badge`(`weekBadge(week)`, "진행중"/"참여 완료" 등, `MatchWeekList.tsx` L222-231)가 같은 정보를 텍스트로 보여준다. 글로우는 그 정보의 배경 강조 하나였을 뿐이라 지워도 정보 손실이 없다.
  - **왜 삭제하기로 했는가(경기 카드 색과의 관계)**: 경기 카드(`MatchInfoCard`)가 이제 대회색을 갖게 되면서, 그 위 컨테이너까지 파란 글로우를 유지하면 한 화면에 "주차 단위 파랑 글로우"와 "경기 단위 대회색 글로우"가 겹쳐 층이 두 개로 보인다 — 컨테이너 글로우를 지우면 색이 온전히 "이 경기가 무슨 대회인가" 하나의 질문에만 답하게 된다.
  - 더블 매치위크에서 한 주에 프리미어리그+컵 경기가 같이 뜨는 게 정상이라(`MatchWeekList.tsx` L19 주석) 대회 색은 애초에 주차 단위가 아니라 경기 단위여야 한다는 원래 근거도 여전히 유효하다.
- **배지·테두리를 쓰지 않는 이유**: 배지는 이미 주차 단위(`weekBadge`, L91-104)로 다른 뜻("진행중"/"종료" 등)에 쓰이고 있어 경기 카드에 또 다른 배지를 얹으면 배지가 두 종류로 섞인다. 테두리는 `MatchInfoCard`에 애초에 없다 — 코드 주석이 "테두리는 없다"(L291)고 명시한 기존 결정이라, 이번 기능만을 위해 테두리를 새로 만드는 건 기존 결정을 뒤집는 일이라 하지 않는다.
- **활성화 조건**: `!isDimmed(week, match)` — intent.md 표는 `!match.locked`로 적어뒀지만(L47), 실제로는 `isDimmed`가 `match.locked || weekPhase(week) === 'upcoming'`(L139-141)이라 `match.locked`만 보면 "아직 시즌 예측 세션이 열리지도 않은 먼 미래 주차"(`weekPhase === 'upcoming'`)의 안 잠긴 경기까지 색이 켜진다 — 이 경기들은 실제로 지금 예측할 수 없는데 색만 켜지는 모순이 생긴다. `isDimmed`는 이미 이 화면에서 "지금 할 수 있는지"를 텍스트 톤으로 말하는 데 쓰이고 있으므로(L134-138 주석) 색도 같은 게이트를 쓰는 게 텍스트와 색이 항상 같은 결론을 내리게 만드는 유일한 방법이다. **이 부분은 intent.md 표의 축약 표현을 실측으로 보정한 것이라 명시적으로 확인받는다(6번 참고).**
- **비활성 상태**: 지금 그대로 `bg-page` 평면색. 새 "비활성 회색조"를 만들지 않는다 — `bg-page`가 이미 이 카드의 기본값이라 손댈 이유가 없다.
- **텍스트는 그대로 회색**: 대회명 라벨(`match.competition ?? '프리미어리그'`, L323-325)은 색을 입히지 않는다. 배경이 이미 옅게 물들어 있어 텍스트까지 색을 입히면 중복이고, `bg-page` 위 대비를 새로 검증해야 하는 부담도 생긴다.

### 3-3. PredictionFlowClient (구조가 다름) — 배지

- **왜 배경 전체가 아닌가**: 앞의 두 컴포넌트와 달리 이 화면은 대회명이 뜨는 자리(`MatchMeta`, `PredictionFlowClient.tsx` L573-584)에 **애초에 카드가 없다** — 흰 배경 `Card` 하나 위에 텍스트만 있는 구조다(L419 `<Card>`). 배경을 물들이려면 새 카드 컨테이너를 만들어야 하는데, 그건 이 기능 하나를 위해 레이아웃 구조를 바꾸는 일이라 과하다.
- **어디**: `MatchMeta`가 그리는 "`{대회명} · {N}라운드`" 문구(L577) 중 **대회명만** 배지로 감싼다. 라운드 숫자는 대회와 무관한 정보라 계속 평문으로 둔다. 배지 공식은 2-3번(100단계 배경 + 800단계 텍스트) 그대로.
- **활성화 조건**: 없음(항상 색) — 이 컴포넌트에 들어오는 `pending` 목록 자체가 이미 상위 페이지에서 "지금 제출 가능한 경기"만 필터링해 넘어온 것이라(intent.md L49, `app/predictions/[weekKey]/page.tsx:58`) 이 화면 안의 경기 카드는 전부 예측 가능 상태다. 별도 무채색 분기가 필요 없다.

### 3-4. 세 곳 비교 요약

| 컴포넌트 | 카드 톤 | 색 적용 위치 | 활성 조건 | 비활성 시 |
|---|---|---|---|---|
| MatchdayHero | 다크 | 카드 배경 전체 (기존 파랑 글로우 완전 대체) | `!fixture.finished` (진행 중 + 예정) | 평면 `bg-neutral-strong` (그라디언트 없음) |
| MatchWeekList | 라이트 | 경기 카드(`MatchInfoCard`) 배경 (주차 컨테이너 파랑 글로우는 삭제) | `!isDimmed(week, match)` | 기존 `bg-page` 그대로 |
| PredictionFlowClient | 카드 없음 | 대회명 배지 | 항상 (진입 조건상 이미 예측 가능한 경기만 옴) | 해당 없음 |

---

## 4. 다크 카드 위 노란색 대비 문제 — 폐기 (2026-09-05, 오렌지 대체가 없어지며 무의미해짐)

이 절은 원래 "친선경기=orange 대체"였을 때, 오렌지 700/600단계가 다크 배경에서 탁한 갈색으로 보이는 문제와 그 보정값(400/300 @24~26%)을 다뤘다. **친선경기 색이 정식 노란 팔레트로 바뀌면서 이 문제 자체가 없어졌다** — 오렌지가 아니라 노랑이므로 "오렌지가 갈색으로 보인다"는 전제가 더 이상 성립하지 않는다.

**노랑에 대해 같은 검토를 다시 했고, 결론은 "보정 없음, 3색 다 표준 공식"이다.** `시안.html`에서 노랑 다크 글로우를 A(700/600 @15%, 표준 공식)와 B(400/300 @25%, 오렌지 때 방식을 그대로 가져온 보정안) 둘 다 만들어 실제로 비교했고, **사람이 A(표준 공식)를 선택했다.** 즉 `--p-yellow-700`/`--p-yellow-600`을 15%로 그대로 쓴다 — 보라·초록과 완전히 같은 공식, 노랑만의 예외 없음.

---

## 5. PredictionDone("제출 완료" 화면) — 색 적용 확정 (2026-09-04 사람 확정)

intent.md가 미확정으로 남긴 질문(L53)에 대해 아래 추천안 그대로 **확정**됐다(intent.md "design-brief 승인 결과" 4번).

**확정: 색 적용(연속성 유지)** — `PredictionFlowClient`에서 쓴 것과 같은 방식(대회명 배지, 3-3번·2-3번 참고 — 100단계 배경 + 800단계 텍스트)을 `PredictionDone.tsx`의 경기별 카드 헤더(L131 `<div className="rounded-lg border border-neutral-weak bg-surface px-4 py-5">`)에도 그대로 적용한다.

**근거**: 사용자는 방금 전 단계(`PredictionFlowClient`)에서 대회색 배지를 보고 예측을 제출했다. 제출 직후 화면에서 그 색이 갑자기 사라지면 "내가 무슨 경기를 예측했더라"를 다시 찾아야 하는 단절이 생긴다 — 같은 배지가 이어지면 하나의 흐름으로 읽힌다.

이 화면은 이미 제출이 끝나(더 이상 "예측 가능"은 아닌) 상태라 intent.md의 "예측 가능할 때만 색이 나온다"는 총칙과 문자 그대로는 상충하지만(intent.md L53이 짚은 지점), 사람이 "제출 시점까지 진행 중이던 예측 세션"으로 총칙을 넓게 해석해 색 유지 쪽으로 확정했다 — 이제 열린 질문이 아니다.

---

## 6. 확정됨 (2026-09-04 사람 승인 완료)

아래 5개 전부 사람이 확정했다 — intent.md "design-brief 승인 결과" 섹션(L60-74) 참고. 더 이상 열린 질문이 아니다.

1. **친선경기 색 = orange 대체 확정**: 이 리포 팔레트에 노란색 계열이 없다(`--p-blue/red/green/orange/cyan/violet/neutral`뿐 — `globals.css` L53-59). 가장 가까운 orange 계열을 "노랑"으로 쓰기로 확정, 별도 노란 팔레트 신설은 하지 않는다(intent.md L64).
2. **MatchdayHero 방향 확정 — 초안에서 변경됨**: "무채색 상태에서도 기존 파랑 글로우를 유지한다"는 초안 제안은 **기각**됐다. 최종 확정은 파랑 글로우를 완전히 제거하고, `!fixture.finished`(진행 중+예정)일 때 대회색, `fixture.finished`일 때만 무채색(`bg-neutral-strong` 평면)으로 가는 것이다 — 3-1번 참고(intent.md L65-69).
3. **MatchWeekList 활성화 조건 보정 확정**: intent.md 표의 `!match.locked` 대신 `!isDimmed(week, match)`를 쓴다(intent.md L70).
4. **PredictionDone 색 적용 확정**: 색 유지(연속성) — 5번 참고(intent.md L71).
5. **semantic 토큰 대신 팔레트 직접 참조 방식 확정**: 새 semantic 토큰 신설도, 기존 `magic`/`positive`/`warning` semantic 재사용도 하지 않고, 팔레트(`--p-*`) 원시값을 이 기능 전용으로 직접 참조하는 새 패턴을 도입한다 — `.spotlight-glow-brand*`/`.award-gold`에 이은 세 번째 예외 사례로 확정(intent.md L72).

### 6-2. 2026-09-05 추가 확정 (색상 최종 라운드) — `intent.md` "최종 색상 확정" 참고

6. **친선경기 색 = orange 대체 → `--p-yellow-*` 정식 팔레트 신설로 번복**: 1번 항목은 이제 유효하지 않다. 근거·계산은 `노란-팔레트-제안.md`, 값은 2-1번.
7. **배지 공식 변경**: "12% 섞은 배경 + 700 텍스트" → "**100단계 배경 + 800단계 텍스트**"(2-3번). 3색 공통 — 노랑만이 아니라 보라·초록도 이 공식으로 바뀐다.
8. **다크 카드 글로우 — 오렌지 보정 폐기**: 4번의 400/300 @25% 보정안은 쓰지 않는다. 노랑도 3색과 같은 표준 공식(700/600 @15%)을 그대로 쓴다.

---

## 7. 개발자 제약사항 요약

- **`globals.css`의 Palette 블록에 `--p-yellow-50`~`--p-yellow-950` 11개를 신규 추가한다.** 값은 `노란-팔레트-제안.md` 4번의 표를 그대로 쓴다(직접 계산하지 말고 그 문서 값을 복사). 이건 이번 기능 하나가 아니라 앱 전체 디자인시스템에 8번째 팔레트 계열이 영구히 추가되는 것이다.
- 색 값은 `--p-violet-*`/`--p-green-*`/`--p-yellow-*` 팔레트를 컴포넌트 레벨에서 직접 참조한다. 새 `--sem-*` 토큰을 만들지 않는다(2번 근거).
- **배지(PredictionFlowClient·PredictionDone) 배경/텍스트 공식**: `background: var(--p-{색}-100); color: var(--p-{색}-800);` — 3색 공통, 12% 섞기/700 텍스트 방식 아님(2-3번 표 참고).
- **다크 카드(MatchdayHero) 글로우**: 노랑도 예외 없이 `--p-yellow-700`/`--p-yellow-600` @15%(다른 두 색과 동일 공식). 오렌지 시절의 400/300 @25% 보정은 적용하지 않는다.
- `bg-magic-weak`/`text-magic`, `bg-warning-weak`/`text-warning`, `bg-positive-weak`/`text-positive`는 **이번 기능에 재사용하지 않는다** — 같은 화면군에서 이미 다른 의미(3툰 배지·평점 등급·적중 배지)로 쓰이고 있다(2-2번 표).
- 색상 버킷 매핑은 `fixtures.competition_name` 원문 문자열 기준이다 — `MatchdayHero.competitionName`/`MatchWeekList.match.competition`/`PredictionFlowClient.match.competition` 셋 다 이미 이 원문을 그대로 노출 중이라(번역/가공 없음, `week.ts` L159,320, `fixtures.ts` L104) 별도 매핑 데이터 가공 없이 문자열 그대로 버킷 판정에 쓸 수 있다.
- 그라디언트/배지는 배경(또는 배지 자체)만 물들이고, 기존 텍스트 색 체계(`text-neutral-muted` 등)는 그대로 둔다 — 3번 각 항목 참고.
- **`MatchdayHero`는 기존 `.spotlight-glow-brand-strong`(상시 파랑)을 완전히 대체·삭제한다** — "무채색일 때만 기존 스타일 유지"가 아니라 파랑 자체가 사라지고, 색 유무는 `fixture.finished` 하나로 갈린다: `!fixture.finished`(진행 중+예정) → 대회색, `finished` → `bg-neutral-strong` 평면(그라디언트 레이어 없음). `isUpcoming`/`isLive`를 별도로 분기할 필요 없다 — 3-1번 참고.
- **`MatchWeekList`의 `WeekSessionCard`도 기존 `spotlight-glow-brand`(상시 파랑)를 삭제한다** — `highlighted ? 'spotlight-glow-brand' : 'bg-surface'` 분기를 없애고 컨테이너는 항상 `bg-surface`. "예측 접수 중" 정보는 옆의 `Badge`가 계속 담당하므로 정보 손실 없음 — 3-2번 참고.
- 클래스명·구현 위치(유틸리티 vs 컴포넌트 인라인)는 개발자 재량.

---

## 참고 자료

- `vault/02_프로젝트/대회별로 색상 다르게/intent.md`
- `vault/02_프로젝트/대회별로 색상 다르게/노란-팔레트-제안.md` — 노란 팔레트 11단계 계산·색상각 선정·대비 검증 근거
- `vault/02_프로젝트/대회별로 색상 다르게/시안.html` — 최종 색상 확정에 쓰인 시각 비교(배지 100+800, 다크 글로우 A/B 등)
- `frontend/src/components/composition/predict/MatchdayHero.tsx` (L114 award bg-warning-weak, L165 isUpcoming, L179 spotlight-glow-brand-strong, L180-183 competitionName)
- `frontend/src/components/composition/predict/MatchWeekList.tsx` (L134-141 isDimmed, L202-230 WeekSessionCard/spotlight-glow-brand, L286-325 MatchInfoCard)
- `frontend/src/components/composition/predict/PredictionFlowClient.tsx` (L573-584 MatchMeta)
- `frontend/src/components/composition/predict/PredictionDone.tsx` (L131 카드, L290-312 HitBadge)
- `frontend/src/components/composition/predict/shared.tsx` (L109-118 ToonCost/TOON_TIER)
- `frontend/src/components/composition/predict/PredictionResult.tsx` (L416-420 TIER_BADGE, L433-448 PointsBadge)
- `frontend/src/components/primitives/badge.tsx` (badgeVariants shape)
- `frontend/src/app/globals.css` (L53-59 팔레트, L61-144 semantic, L202-230 다크/색 면 직접 참조 예외 선례)
- `frontend/tailwind.config.ts` (L61-110 backgroundColor/textColor 노출 현황)
- `frontend/src/lib/predictions/week.ts` (L159,320 competition 원문 전달), `frontend/src/lib/queries/fixtures.ts` (L104 competitionName 원문 전달)
