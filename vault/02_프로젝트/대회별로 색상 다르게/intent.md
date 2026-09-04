# intent — 대회별로 색상 다르게

작성: 2026-09-04 · 작성자: Fable(오케스트레이터), 사용자와의 대화 기록
승인권자: 사용자 (프로덕트 디자이너)

## Linear 프로젝트 원문

> 약한 그라디언트 넣어서 수정할 예정.
> 프리미어리그는 보라색
> 기타 컵 대회는 초록색
> 친선경기는 노란색

(Linear "대회별로 색상 다르게", TEA 팀, Backlog, 아직 연결된 이슈 없음)

## 조사 결과 (구현 전 확인한 근거)

- "대회 종류" 개념은 **`polls`(투표) 데이터엔 존재하지 않는다.** 존재하는 곳은 승부예측용 `fixtures` 테이블뿐 — `fixtures.competition_name`(자유 문자열, enum 아님). `frontend/src/types/database.ts:217-219`, `supabase/migrations/20260821100000_create_fixtures.sql:4-5`.
- 값은 외부 API(Fotmob)에서 그대로 받아온다 — `supabase/functions/sync-fixture/index.ts:289` (`fixture.tournament?.name`). 코드 안에 정해진 목록(enum)이 없다.
- 이미 텍스트로만 노출 중인 지점 3곳 (색상 구분 없음):
  - `frontend/src/components/composition/predict/MatchdayHero.tsx:180-183`
  - `frontend/src/components/composition/predict/MatchWeekList.tsx:20,324`
  - `frontend/src/components/composition/predict/PredictionFlowClient.tsx:577`
- 색상 시스템: Palette(`--p-*`) → Semantic(`--sem-*`) 2계층 CSS 변수(`frontend/src/app/globals.css`) + Tailwind가 그 변수만 참조하는 구조. 컴포넌트가 팔레트 원시값을 직접 쓰는 건 예외로만 존재(`globals.css`의 `.spotlight-glow-brand*`, `.award-gold` 그라디언트 유틸리티).
- 참고 선례: 투싹컵 스코어링(`supabase/migrations/20260830150000_toon_cup_scoring.sql:5`)에서 "PL이 아니면 컵"이라는 2분류 하드코딩을 이미 쓴 적 있다. 이번 3분류엔 그대로 재사용 못하지만 참고 사례로 남긴다.

## 확정된 것 (사용자 답변)

**적용 범위**: 승부예측 화면만 (MatchdayHero, MatchWeekList, PredictionFlowClient 등 `fixtures.competition_name`을 이미 노출 중인 지점). 투표(poll)엔 대회 구분 데이터 자체가 없어 이번 스코프에서 제외.

**색상 매핑** (실제 `competition_name` 값 기준, 사용자 확인):

| `competition_name` (원문) | 버킷 | 색상 |
|---|---|---|
| `Premier League` | 프리미어리그 | 보라색 |
| `Club Friendlies` | 친선경기 | 노란색 |
| `EFL Cup`, `FA Cup`, `Europa League`, `Europa Conference League`, `Champions League` | 기타 컵 대회 | 초록색 |
| 위 목록에 없는 새 값 (미래 대응) | 기타 컵 대회 (fallback) | 초록색 |

- fallback 근거: "기타 컵 대회"라는 이름 자체가 프리미어리그도 친선경기도 아닌 걸 받는 자리라는 사용자 확인.

**활성화 조건 (사용자 확정, 2026-09-04 추가)**: 대회별 색상은 **경기 예측이 가능한 상태일 때만** 나온다. 예측이 불가능하면 기본(무채색) 카드로 표시한다.

"예측 가능 여부"는 이미 각 컴포넌트가 자기 버튼/문구 노출에 쓰고 있는 기준을 그대로 재사용한다 (새로 발명하지 않음):

| 컴포넌트 | 예측 가능 조건 (기존 코드 그대로) | 근거 |
|---|---|---|
| `MatchdayHero.tsx` | `isUpcoming = !fixture.started && !fixture.finished` — "예측 하러 가기" 버튼과 동일 조건 | `MatchdayHero.tsx:165-166,223-233` |
| `MatchWeekList.tsx` | 경기별 `!match.locked` — `isDimmed`/`weekAction`이 이미 이 값으로 텍스트를 가라앉히고 버튼을 비활성화하는 것과 동일 조건 | `MatchWeekList.tsx:78-141` (`lib/predictions/week.ts:125-128` `isMatchLocked` 유래) |
| `PredictionFlowClient.tsx` | 이 컴포넌트에 들어오는 `pending` 목록 자체가 상위 페이지에서 이미 "제출 가능한 경기"만 필터링해 넘어온 것(`submittableMatches(week)`) — 즉 이 컴포넌트 안에서 보이는 매치 카드는 항상 예측 가능 상태 | `app/predictions/[weekKey]/page.tsx:58`, `lib/predictions/week.ts:260-262` |

## 근거 미확인 (구현 전 반드시 확인)

- **PredictionFlowClient의 "제출 완료" 화면(`PredictionDone`)에도 대회 색상이 필요한지** — 이 화면은 예측이 이미 끝난(더 이상 "예측 가능"은 아닌) 상태라, 위 표의 "쭉 예측 가능"과 상충 가능성 있음 → design-brief에서 확인.
- 기본(무채색) 카드의 정확한 톤 — 현재 텍스트 표시와 완전히 동일하게 둘지, 아니면 별도 "비활성 회색조" 스타일을 새로 정의할지 미정.

- **정확히 무엇에 그라디언트를 넣을지** — 카드 배경 전체, 텍스트/배지 색, 테두리 강조 중 어디인지는 Linear 설명("약한 그라디언트")만으론 안 정해짐. 3개 노출 지점(MatchdayHero/MatchWeekList/PredictionFlowClient)이 각각 다크/라이트 카드라 적용 방식이 갈릴 수 있음 → **design-brief에서 시안으로 확정, 사람 승인 필요**.
- 라이트/다크 카드 각각에 대한 보라/초록/노랑 3색의 정확한 팔레트 단계(예: violet-700 몇 %) 미정 → design-brief에서 기존 `.spotlight-glow-brand*`/`.award-gold` 패턴 참고해 제안.
- 다크 카드 위 초록/노랑 대비(WCAG) 확인 필요 — 특히 노란색은 다크 배경에서 흐릿하게 보일 위험.

## design-brief 승인 결과 (2026-09-04, 사람 확정)

designer 에이전트가 작성한 `design-brief.md`의 "확정 필요" 5개 항목 + 대화 중 추가로 나온 MatchdayHero 방향 변경, 전부 사람이 확정했다.

1. **친선경기 색 = orange 대체**: 이 팔레트에 순수 노란색 계열이 없어 `--p-orange-*`로 대체. 별도 노란 팔레트 신설은 하지 않는다.
2. **MatchdayHero 방향 변경 (design-brief 3-1번 수정)**: 기존 상시 파랑 글로우(`spotlight-glow-brand-strong`)를 **완전히 제거**하고 대회색 그라디언트로 교체한다. 활성화 조건이 design-brief 초안(`isUpcoming`만 색, 그 외엔 파랑 유지)에서 아래로 바뀐다:
   - **진행 중(`started && !finished`)**: 대회색 유지 — "예측 가능할 때만 색" 총칙의 예외로, 사람이 명시적으로 확정.
   - **예정(`isUpcoming`)**: 대회색.
   - **종료(`finished`)**: 무채색(회색).
   - 즉 이 카드에서는 "경기가 아직 안 끝났으면 대회색, 끝났으면 무채색"이 최종 규칙이다 (예측 가능 여부가 아니라 경기 종료 여부가 기준).
3. **MatchWeekList 활성화 조건 보정**: intent.md 표의 `!match.locked` 대신 `!isDimmed(week, match)`로 확정 (텍스트 톤과 색 결론이 항상 일치하도록).
4. **PredictionDone 색 유지**: 제출 완료 화면도 `PredictionFlowClient`와 같은 배지 방식으로 대회색 유지(연속성).
5. **색상 구현 패턴 승인**: 새 semantic 토큰 신설/기존 semantic(magic·positive·warning) 재사용 대신, 팔레트(`--p-*`) 원시값을 이 기능 전용으로 직접 참조하는 새 패턴 도입 확정 (`.spotlight-glow-brand*`/`.award-gold`와 같은 예외 패턴 3번째 사례).

**design-brief.md는 위 2번 변경사항을 반영해 designer 에이전트가 개정했다 (완료).**

## 시안 검토 후 추가 확정 (2026-09-05, 사람 확정)

- **MatchWeekList 주차 컨테이너(`WeekSessionCard`)의 기존 파란 글로우(`spotlight-glow-brand`, `MatchWeekList.tsx:229`)를 삭제한다.** design-brief 3-2번 초안은 "건드리지 않는다"였으나 사용자가 시안 검토 중 방향을 바꿨다.
  - 확인한 것: 이 글로우를 지워도 "예측 접수 중" 정보 자체는 사라지지 않는다 — 같은 카드의 "N주차" 옆에 별도 `Badge`(`weekBadge(week)`, "진행중"/"참여 완료" 등)가 이미 독립적으로 그 정보를 보여주고 있다(`MatchWeekList.tsx:222-231`). 글로우는 그 정보의 유일한 표시가 아니라 배경 강조 하나였을 뿐이다.
  - `highlighted ? 'spotlight-glow-brand' : 'bg-surface'` 분기(`MatchWeekList.tsx:229`) 자체를 없애고 컨테이너는 항상 `bg-surface`로 간다.
  - design-brief.md 3-2번·3-4 비교표·7번을 이 결정으로 갱신 (오케스트레이터가 직접 반영, 코드 근거는 위와 같이 확인 완료된 단순 수정이라 별도 에이전트 재확인 생략).

## 스코프 확장 — 노란 팔레트 신설 (2026-09-05, 사람 확정)

시안 검토 중 사용자가 "오렌지가 오렌지색으로 안 보인다"는 문제를 짚었고, 애초에 검토했던 두 옵션(orange 대체 vs 노란 팔레트 신설) 중 **노란 팔레트 신설로 방향을 바꿨다.**

- 조사 결과: 이 리포 팔레트는 OKLCH 11단계 생성 + 색상각/대비 정밀 검증을 거친 시스템이다(`vault/10_gun/디자인시스템-스토리북-실행계획.md` §3.5·§3.6·§3.16) — 과거 red↔orange 색상각이 24.3°로 너무 가까워 75°로 재조정한 사례, 700단계 대비를 흰 배경만 검증하고 자기 weak 배경 검증을 빠뜨렸던 버그 사례가 실제로 있었다. 새 계열 추가는 이 기능 하나를 넘어서는 **디자인시스템 전체 영향 작업**이라는 근거로 사람에게 확인을 구했다.
- 사용자 결정: 그럼에도 **지금 이 프로젝트에서 바로 노란 팔레트까지 만들고 진행**하기로 확정.
- designer 에이전트가 같은 방법론(OKLCH 계산 + 색상각 검증 + 이중 대비 검증)으로 `노란-팔레트-제안.md` 작성 중 — 완료되면 사람 승인 후 developer가 `globals.css`에 실제로 추가.
- 이 결정으로 design-brief.md 2번(색상 값)의 "친선경기=orange 대체" 부분은 **번복된다** — 승인된 팔레트 제안이 나오면 design-brief.md도 함께 갱신한다.

## 최종 색상 확정 (2026-09-05, 시안 위 실측 비교 후 사람 확정)

`노란-팔레트-제안.md`가 나온 뒤, 시안(`시안.html`) 위에 실제 여러 단계 조합을 올려보고 대비까지 매번 계산해가며 좁혀나간 결과다. **이 섹션이 색상 관련 최종 확정이고, 위의 중간 라운드(orange 대체, 12%+700 배지 공식 등)는 전부 이 섹션으로 대체된다.**

1. **`노란-팔레트-제안.md`의 11단계 값 승인.** `--p-yellow-50`~`--p-yellow-950`, 색상각 103.8°. "친선경기=orange 대체"는 폐기.
2. **배지 공식 변경 (PredictionFlowClient·PredictionDone, 3색 공통)**: 기존 확정("12% 섞은 배경 + 700 텍스트")을 **폐기**하고 **"팔레트 100단계 배경 그대로 + 800단계 텍스트"**로 바꾼다.
   - 계기: 노랑의 700단계(`#7d7400`)가 올리브/카키로 보이는 문제를 확인하다가, 배경을 팔레트 원시 단계(200→100 순으로 실측)로 바꾸고 텍스트를 800으로 올리는 쪽이 3색 다 더 쨍하고 일관되게 보인다는 게 실측으로 확인됨.
   - 대비 실측(100단계 배경 기준, 전부 AA 4.5 이상 여유 통과): 보라 7.565, 초록 6.723, 노랑 6.790. (참고로 700 텍스트로는 100단계 배경에서 노랑 4.280·초록 4.290이 AA 미달이라 800으로 통일해야 했음 — 노랑만의 문제가 아니라 공식 자체를 바꿔야 하는 문제였음.)
   - 값: 보라(bg `#fceaff`/text `#6924a9`), 초록(bg `#e2fce5`/text `#0a642a`), 노랑(bg `#fff58e`/text `#5c5500`).
3. **MatchdayHero 다크 카드 글로우**: `design-brief.md` 4번이 제안했던 "노랑만 400/300 @25% 오렌지식 보정"은 채택하지 않는다. **3색 다 기본 공식(700/600 단계 @15%) 그대로 간다** — 노랑도 `--p-yellow-700`/`--p-yellow-600` @15%.
4. **MatchWeekList 라이트 카드 배경(8% wash)**: 재검토 대상이 아니었다 — 기존 확정(700단계 @8%, 3색 공통) 그대로 유지.

**design-brief.md 갱신 대상**: 2번(색상 값 전체 재작성 — orange 대체 삭제, 배지 공식 교체), 3-1번(다크 글로우 — 오렌지 예외 삭제, 3색 공통 공식으로 통일), 3-3/3-4/5번(배지 적용 부분 — 12%+700 → 100+800), 4번(다크 카드 대비 문제 — 오렌지 보정 섹션 전체 폐기, 노랑도 표준 공식 쓴다는 결론으로 대체), 6번(확정됨 목록 갱신).

## plan 승인 (2026-09-05, 사람 확정)

developer 에이전트가 쓴 `feature-spec.md`·`plan.md`의 "사람 확정 필요" 9개 + 파생 1개를 전부 확정했다 (값은 `plan.md` 0번 표). 코드 실측에서 design-brief 전제와 어긋난 5건(`-strong` 글로우가 PredictionResult에서도 사용 중 → 정의 유지 / `.spotlight-glow-brand`는 실사용 0건이 됨 → 삭제+Storybook 갱신 / PredictionDone은 대회명 미표시 → 배지 신규 추가, 마감 카드 포함 / null 대회명 텍스트 기본값 삭제 / mock에 친선경기 추가)도 여기서 결정됐다. **구현 착수 승인.**

## 다음 단계

1. ~~designer → `design-brief.md`~~ · ~~designer → `노란-팔레트-제안.md`~~ · ~~design-brief 최종 갱신~~ · ~~developer → `feature-spec.md` + `plan.md`~~ · ~~plan 승인~~ (전부 완료)
2. ~~linear-ops → 이슈 생성~~ (완료: **TEA-30**, 브랜치 `geonhaa/tea-30-승부예측-화면-대회별-색상-적용-노란-팔레트-신설`). 프로젝트 설명 갱신은 linear-ops 도구에 `save_project`가 없어 미처리 — 처리 방식 사람 확인
3. ~~worktree 생성 + 문서 커밋~~ (완료: `.claude/worktrees/tea-30`, 첫 커밋 cc54754)
4. ~~①② → ③④⑤ → ⑥~~ (완료. ⑥은 세션 한도로 2회에 나눠 실행, DesignToken.mdx 추가 갱신) → ~~⑦ 검증~~ (완료 2026-09-05: test 226/0 · lint 0 · build 0 · build-storybook 0, 새 경고 0건) → ⑧ 화면 검수: Chrome 확장 미연결로 사람이 `localhost:4300` 직접 확인 (진행 중)
5. ~~코드 리뷰(`medium` 1회)~~ (완료: CRITICAL/HIGH/MEDIUM 없음, 머지 가능. 관찰: 대회명 원문 정확 일치 — 공백/대소문자 변형은 green fallback, 사람 확정으로 유지)
6. ~~origin/main 머지~~ (완료 1fea98e: main에 #18 TEA-23·#19·#20/#21 TEA-31이 먼저 들어와 머지. 충돌은 PredictionFlowClient 2곳만, 배지 유지 + `weekLabel` 채택. 273 tests pass, build·build-storybook 통과. `PredictionMatchSelect`는 대회명 미표시 → 추가 적용 지점 없음)
7. ⑧ 화면 검수(사람, localhost:4300) → 지적 반영 → push → PR (`Fixes TEA-30`) → 사람 머지
