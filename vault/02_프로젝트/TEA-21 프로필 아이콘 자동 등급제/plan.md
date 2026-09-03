# TEA-21 프로필 아이콘 자동 등급제 — plan.md

간소 사이클(단발 이슈, 소속 프로젝트 없음). spec은 Linear 이슈 본문(TEA-21, 2026-09-02 갱신본)이 대신하며, 별도 feature-spec.md는 작성하지 않는다.

**이 문서는 사람 승인 전까지 구현하지 않는다.**

---

## 0. 사전 조사에서 실측으로 바로잡은 전제 (중요 — 승인 전 반드시 확인)

작업 지시에 담긴 "사전 조사 결과"를 최신 main 기준으로 재검증한 결과, **3가지가 실제와 달랐다.** 아키텍처 결정에 직접 영향을 주므로 먼저 정리한다.

1. **"마이페이지 아바타 탭 → 기존엔 수동 선택 UI, 이제 등급 모달로 교체"는 사실이 아니다.**
   `frontend/src/components/composition/my/MyPageClient.tsx`의 아바타(88-93행)에는 `onClick`도, 모달 상태(`useState`)도, `Modal` import도 전혀 없다 — 탭해도 아무 일도 안 일어나는 정적 아바타다. 즉 이번 작업은 "교체"가 아니라 "신규 추가"다. 결과물은 동일(등급 모달이 뜨면 됨)하므로 계획에는 영향 없지만, PR 설명에 "교체"라고 쓰면 틀린 서술이 된다.

2. **avatar_url 소비 6곳 중 3곳(마이페이지/헤더/댓글 중 마이페이지·헤더 2곳 + UserMenu)은 DB를 전혀 안 본다.**
   - `frontend/src/app/my/page.tsx:54` — `avatarUrl = user.user_metadata?.avatar_url ?? null` (Supabase Auth 세션 메타데이터, DB 아님)
   - `frontend/src/lib/actions/auth.ts:48` (`getHeaderAuth()`) — `avatarUrl: data.user.user_metadata?.avatar_url ?? undefined` (역시 Auth 메타데이터). `UserMenu.tsx`/`HeaderAuthStatus.tsx`는 이 값을 그대로 전달받아 렌더링할 뿐이다.
   - 이 사실은 아래 "핵심 아키텍처 결정"에서 A안/B안 선택에 직접 영향을 준다. 원래 사전 조사는 "B안이면 6곳 전부 안 고쳐도 된다"고 가정했는데, 이 2곳(마이페이지·헤더)은 **B안을 택해도 어차피 고쳐야 한다** (DB를 안 보고 있으므로, DB에 등급 URL을 아무리 잘 저장해도 이 두 곳은 여전히 Auth 메타데이터를 읽어 소셜 로그인 사진을 보여준다).

3. **`profile-icons` 버킷을 "player-photos 버킷 생성 마이그레이션을 그대로 미러링"하면 최근에 고친 보안 정책을 역행하게 된다.**
   `supabase/migrations/20260830160000_drop_player_photos_list_policy.sql`에서 `player_photos_public_read`(공개 버킷의 광범위 SELECT 정책)를 **의도적으로 삭제**했다. 이유(마이그레이션 주석 그대로): "공개 버킷은 `/storage/v1/object/public/...` 경로가 RLS를 우회해 서빙되므로 SELECT 정책 없이도 사진 표시는 정상이고, 이 정책은 anon이 버킷 파일 목록을 나열(enumerate)할 수 있게 하는 부작용만 있었다. 앱은 `.list()`를 어디서도 쓰지 않는다."
   그런데 이번 기능의 핵심 메커니즘 자체가 **`profile-icons` 버킷을 `.list()`로 나열해서 파일명(임계점수)을 파싱**하는 것이다 — 즉 이 리포에서 처음으로 `.list()`가 필요한 케이스가 생긴다. 아래 "Storage 리스팅 방식"에서 이 상충을 어떻게 푸는지 다룬다.

---

## 1. 핵심 아키텍처 결정 — avatar_url을 언제/어떻게 계산하는가

### 결론: **A안(렌더링 시점 계산)을 채택**

### 근거

**B안(정산 시점에 DB avatar_url을 등급 URL로 갱신)이 성립하기 어려운 이유:**

- `total_points`는 저장 컬럼이 아니라 **뷰 위의 뷰**로 완전히 파생 계산된다. `season_leaderboard`/`week_leaderboard`(`supabase/migrations/20260827130000_fix_leaderboards_public_profiles.sql:42,57` — `sum(r.total_points)`)는 `prediction_results` 뷰(`supabase/migrations/20260824120000_prediction_results_week_settled.sql:47` — `... as total_points`)를 다시 합산한 것이고, `prediction_results` 자체도 `predictions`+`fixtures`+`fixture_player_ratings`를 조인해 매 조회마다 계산된다. **"정산이 완료됐다"는 이벤트나 저장된 상태가 DB 어디에도 없다** — `fixtures.finished`가 true가 되고 그 주 나머지 경기도 다 끝나는 순간부터 다음 조회 시 자동으로 값이 달라질 뿐이다(같은 마이그레이션 53행, 58-65행 게이트 조건). 이 설계는 마이그레이션 주석에 "산식이 바뀌면 과거 경기 점수도 소급 반영되게 하려는 의도"로 명시돼 있다 — 즉 이 리포는 의도적으로 "저장 대신 매번 재계산"하는 방향으로 설계돼 있고, B안(스냅샷을 저장)은 이 설계 철학과 어긋난다.
- 이런 이유로 "정산 시점에 실행되는 배치"라는 게 애초에 존재하지 않는다. `frontend/src/lib/actions/sync-fixtures.ts:36`의 `syncFixtureData()`가 유일하게 "관리자 동기화"라 부를 만한 서버 액션인데, 이 함수는 Edge Function 2개를 호출하고 캐시 태그 2개를 무효화할 뿐(68·71행) **users/avatar_url을 전혀 건드리지 않는다.** 전체 유저를 순회하며 필드를 일괄 갱신하는 기존 배치 패턴도 `lib/actions/`, `supabase/functions/` 어디에도 없다(grep 확인, `forEach`/`for...of users`/`batch` 패턴 0건). B안을 택하면 이런 배치를 **새로 발명**해야 한다.
- avatar_url 자체도 이중 간접 구조다: 랭킹 뷰는 `public.users.avatar_url`이 아니라 **`public.public_profiles.avatar_url`**을 읽는다(`20260827130000_...:39,44,56,61` — RLS 강화로 `public.users`가 본인 행만 보이게 막혀서 전원 공개인 `public_profiles`로 갈아탄 이력, 같은 파일 상단 코멘트). `public_profiles.avatar_url`은 `public.users.avatar_url`이 **UPDATE될 때만** 트리거로 동기화된다(`20260529120000_public_profiles_storage_vote_guards.sql`의 `sync_public_profile_on_user_change`). B안을 택하면 배치가 `public.users`를 UPDATE해서 트리거를 태워야 하고, RLS 우회를 위해 서비스 롤 클라이언트가 필요하다.
- 결정적으로, 위 0번 항목에서 확인했듯 **B안을 택해도 마이페이지·헤더 2곳은 어차피 고쳐야 한다** (Auth 메타데이터를 보고 있어서 DB 값 자체를 안 읽음). 즉 B안의 유일한 셀링포인트("컴포넌트 6곳 안 고쳐도 됨")가 실측 결과 절반만 사실이라, B안이 A안 대비 갖는 이점이 "새 배치 인프라를 안 만들어도 된다"는 것뿐인데 그마저 배치 자체를 새로 만들어야 하니 이점이 사라진다.

**A안(렌더링/쿼리 시점 계산)의 장점:**

- `total_points`가 이미 계산돼 있는 지점(쿼리 결과 row)에서 그 자리에서 `avatarUrl`을 등급 URL로 바꿔치기하면 되는 곳이 6곳 중 3곳(`RankingCard`/`WeekRankCard`가 쓰는 `getWeekRanking`/`getSeasonRanking`)이나 된다 — 이 3곳은 **컴포넌트를 전혀 안 고쳐도 된다** (쿼리 파일에서 매핑만 바꾸면 컴포넌트는 기존처럼 `entry.avatarUrl`을 그대로 렌더링).
- 리포의 기존 설계 철학(저장 대신 매번 재계산)과 일치한다.
- DB 마이그레이션이나 RLS 변경이 전혀 필요 없다(신규 `profile-icons` 버킷 생성 제외).

### 트레이드오프로 인정할 부분

- A안은 avatar_url을 새로 읽어야 하는 지점(마이페이지·헤더·댓글)에서 `total_points`도 함께 조회해야 한다 — 쿼리가 하나 더 필요하거나(마이페이지·헤더) join을 추가해야 한다(댓글). 아래 5절에서 지점별로 구체화한다.
- Storage 버킷을 매 렌더마다 `.list()`하면 비용이 크므로 캐싱이 필수다(3절).

이 결정이 이 리포 기존 구조에 더 맞는다고 판단해 A안으로 진행하되, **위 근거에 이견이 있으면 구현 착수 전에 알려달라.**

---

## 2. Storage 리스팅 방식 — `.list()` 보안 정책 상충 해결

0-3번에서 확인한 대로, `profile-icons` 버킷에 anon이 `.list()`할 수 있는 SELECT 정책을 다시 만들면 팀이 의도적으로 닫은 "버킷 파일 나열" 구멍을 재현하게 된다.

**해결 방향**: `.list()` 호출은 **서비스 롤 클라이언트로만, 서버 컴포넌트/서버 액션 안에서** 수행한다. anon/브라우저는 이 목록을 절대 직접 부르지 않고, 서버가 계산해서 내려주는 **최종 아이콘 URL 1개**만 클라이언트에 전달된다. 이렇게 하면:
- `storage.objects`에 새 SELECT/LIST 정책을 추가하지 않는다 (드롭 마이그레이션의 취지 유지).
- `frontend/src/lib/actions/images.ts`가 업로드에 이미 서비스 롤 클라이언트를 쓰는 것과 같은 패턴(파일 내 동적 import `@supabase/supabase-js`)이라 리포에 새로운 신뢰 경계를 만들지 않는다.
- 공개 버킷이라 `getPublicUrl()`로 만든 최종 이미지 URL 자체는 여전히 RLS 우회로 정상 서빙된다(마이그레이션 주석 그대로) — 목록 열람만 막혀 있으면 된다.

이건 RLS 정책을 새로 추가/완화하는 게 아니라 "서버 전용 서비스 롤 호출"이라는 이미 있는 패턴을 재사용하는 것이라 별도 승인 없이 진행하되, Storage 보안 성격상 **plan에 명시적으로 남기고 리뷰 시 재확인받는다.**

---

## 3. 신규 유틸: `frontend/src/lib/images/profile-icons.ts`

`PLAYER_PHOTOS_BUCKET` 상수가 `frontend/src/lib/images/storage-cleanup.ts`에 있는 것과 같은 폴더 컨벤션을 따른다.

```ts
export const PROFILE_ICONS_BUCKET = 'profile-icons'

// 버킷을 리스팅해 "{숫자}.webp" 파일명만 파싱, 오름차순 정렬한 임계점수 배열을 반환.
// 서비스 롤 클라이언트로 .list() 호출 (2절 근거). mock 모드에서는 하드코딩 [0, 500, 2000] 반환.
async function getProfileIconThresholdsUncached(): Promise<number[]>

// squads.ts의 getPickCandidatesCached와 동일 패턴: revalidate 3600 (자산 갱신이 드묾),
// 실패 시 던져서 빈 배열이 캐시에 굳지 않게 한다.
export const getProfileIconThresholds = unstable_cache(
  getProfileIconThresholdsUncached,
  ['profile-icon-thresholds'],
  { revalidate: 3600 },
)

// 순수 함수 — I/O 없음. thresholds 중 totalPoints 이하인 것 중 최댓값을 골라 공개 URL 조립.
// thresholds가 비어있으면 null.
export function resolveProfileIconUrl(totalPoints: number, thresholds: number[]): string | null

// 위 두 개를 합친 편의 함수 — 대부분의 호출부는 이것만 쓰면 됨.
export async function getProfileIconUrl(totalPoints: number): Promise<string | null> {
  const thresholds = await getProfileIconThresholds()
  return resolveProfileIconUrl(totalPoints, thresholds)
}
```

`resolveProfileIconUrl`을 별도 순수 함수로 분리하는 이유: `*.test.mjs`가 이 리포 관례상 소스 문자열 정규식 검사 위주라 실제 로직 유닛 테스트를 쓰기 어려운데, 이 함수만은 입출력이 순수해서 `node --test`로 진짜 로직 테스트가 가능하다(8절).

캐시 정합성: `predictions.ts`의 `getMySeasonRow`처럼 "사용자별 데이터는 캐시하지 않는다" 원칙과 충돌하지 않는다 — `getProfileIconThresholds()`는 유저 무관, "지금 등록된 등급 파일 목록"이라는 전역 설정값이라 캐싱 대상으로 적합하다.

---

## 4. 마이그레이션: `profile-icons` 버킷 생성

0-3번 근거에 따라 **SELECT/LIST 정책은 만들지 않는다.** `player-photos`의 *현재*(드롭 이후) 상태, 즉 "public=true 버킷만 있고 별도 정책 없음"을 미러링한다.

신규 파일: `supabase/migrations/<날짜>_profile_icons_bucket.sql`

```sql
insert into storage.buckets (id, name, public)
values ('profile-icons', 'profile-icons', true)
on conflict (id) do update set public = true;
```

업로드는 앱 코드가 아니라 운영자가 Supabase Studio/CLI로 수동 업로드하는 흐름(이슈 본문 그대로: "파일 업로드/교체만으로 끝난다")이라 INSERT/UPDATE 정책도 만들지 않는다 — Studio 콘솔 업로드는 서비스 롤 권한이라 RLS 무관.

---

## 5. avatar_url 소비 6곳 반영 방식

| # | 소비처 | 현재 avatarUrl 출처 | total_points 보유 여부 | 반영 방식 |
|---|---|---|---|---|
| 1 | `RankingCard.tsx` (`predict/PredictListClient.tsx:160`) | `getSeasonRanking()` 결과(`predictions.ts:239` `avatarUrl: row.avatar_url`) | 이미 있음(`predictions.ts:240` `totalPoints: row.total_points`) | **컴포넌트 무수정.** `predictions.ts:239`의 매핑을 `avatarUrl: await getProfileIconUrl(row.total_points)`로 교체 |
| 2 | `WeekRankCard.tsx` (`predict/PredictionResult.tsx:268`) | `getWeekRanking()` 결과(`predictions.ts:179` `avatarUrl: row.avatar_url`) | 이미 있음(`predictions.ts:182`) | **컴포넌트 무수정.** `predictions.ts:179` 매핑을 동일하게 교체 |
| 3 | `MyPageClient.tsx` (마이페이지) | `app/my/page.tsx:54` — Auth `user_metadata.avatar_url` | 없음 | `predictions.ts`의 (현재 비공개) `getMySeasonRow`를 `export`하고, `app/my/page.tsx`에서 `getMySeasonRow(user.id)` 호출 → `total_points` 얻어 `getProfileIconUrl()`로 치환. `avatarUrl` prop 자체는 안 바뀌지만 **출처가 Auth 메타데이터 → DB 파생값으로 바뀜** |
| 4 | `UserMenu.tsx` / `HeaderAuthStatus.tsx` (헤더) | `lib/actions/auth.ts:48` `getHeaderAuth()` — Auth `user_metadata.avatar_url` | 없음 | `getHeaderAuth()` 안에서 `getMySeasonRow(data.user.id)` 호출 후 `getProfileIconUrl()`로 `avatarUrl` 계산. `UserMenu`/`HeaderAuthStatus` **컴포넌트 무수정** |
| 5 | `CommentsSection.tsx` (댓글) | `comments.ts:127` `avatar_url: row.user?.avatar_url ?? null` (public_profiles 조인) | 없음 (select 안 함) | **결정됨(사람 승인, 6-1) — 포함.** `comments.ts`가 댓글 작성자별 `total_points`도 함께 조회하도록 확장(예: `season_leaderboard`를 `user_id`로 조인 또는 추가 쿼리)하고, `CommentsSection.tsx`가 현재 미사용 상태인 `AvatarImage`를 실제로 사용해 `getProfileIconUrl(total_points)` 결과를 렌더링하도록 고친다 |
| 6 | `primitives/avatar.tsx` | — | — | 순수 프리미티브(radix wrapper), 데이터 무관. 수정 없음 |

3·4번에서 `getMySeasonRow`를 재사용하려면 `frontend/src/lib/queries/predictions.ts:212`의 `async function getMySeasonRow(...)` 앞에 `export`를 붙여야 한다(현재 비공개 함수, `getSeasonRanking` 내부에서만 쓰임).

---

## 6. 확인 필요 항목 처리 결과 (2026-09-03 사람 승인)

### 6-1. 댓글(CommentsSection)에 아바타 이미지를 이번에 처음 노출할 것인가 — **결정됨: 포함(b)**

실측 결과 `CommentsSection.tsx`는 **현재 avatar_url을 전혀 렌더링하지 않는다** — `AvatarImage`는 import만 되고 미사용, 실제로는 `AvatarFallback`(이니셜)만 그린다(250-254행). 쿼리(`comments.ts`)는 avatar_url을 이미 select하고 있지만 화면에 안 쓰인다.

사람 승인: **(b) 이번 기회에 댓글에도 등급 아이콘을 새로 노출한다.** `comments.ts`가 댓글 작성자별 `total_points`도 함께 조회하도록 확장(`season_leaderboard`를 `user_id`로 조인 또는 추가 조회)하고, `CommentsSection.tsx`가 `AvatarImage`를 실제로 사용해 `getProfileIconUrl(total_points)` 결과를 렌더링하도록 고친다. 확정된 작업 항목이므로 5절 표(5번 행)와 9절(7번 단계)에 반영했다.

### 6-2. 등급 안내 모달에서 각 등급을 어떤 "이름"으로 보여줄 것인가 — **결정됨: 이름 없이 점수/아이콘만(a, 추천안 채택)**

사람 승인: **(a) 이름 없이 등급 번호/아이콘만 보여준다.** `ProfileGradeContentProps`에 `name?: string` 필드를 넣지 않고 `threshold`+`iconUrl`만으로 확정한다. 향후 등급이 추가/변경돼도 코드 변경이 전혀 필요 없다는 이슈 원래 취지에 맞춘 결정. 7절에 반영했다.

### 6-3. mock 모드에서 실제 저지 이미지가 없다 — **결정됨: 폴백(이니셜)만으로 충분(추천안 채택)**

사람 승인: mock 모드에서는 `getProfileIconUrl`이 `null`을 반환해 기존 아바타 폴백 UI(이니셜)로 떨어지는 방식으로 확정한다. `frontend/src/lib/predictions/week.ts:81-85`의 `teamLogoUrl`이 mock에서 `null`을 반환하는 것과 동일한 패턴이며, 플레이스홀더 이미지 자산을 추가로 만들지 않는다. 9절(9번 단계)에 반영했다.

### 6-4. `getMySeasonRow`가 예측 미참여 유저(0점)도 행을 반환하는지

이슈는 "예측을 한 번도 안 한 유저도 0점부터 즉시 아이콘 적용"을 요구한다. `getMySeasonRow(userId)`가 `season_leaderboard`를 `user_id` 단건 조회하는데(`predictions.ts:212-221`), 이 뷰가 **한 번도 예측하지 않은 유저는 아예 행 자체가 없을 수도 있다**(뷰가 `predictions`/`prediction_results`를 조인해서 만들어지므로, 예측 기록이 없으면 조인 결과가 비어 row 자체가 안 생길 가능성). 이 경우 `getMySeasonRow`가 `null`을 반환하면 `getProfileIconUrl`도 호출할 total_points가 없다 — **이때는 `totalPoints = 0`으로 간주해서 기본 등급(0점 이상, 서드 저지)을 적용**하는 처리가 필요하다. 이건 구현 세부사항이라 임의로 진행해도 되는 범위로 보이지만(이슈 문구에 이미 명시된 동작), 구현 단계에서 뷰 실제 동작을 실측 확인 후 `total_points ?? 0` 형태로 방어 코드를 넣는다는 점만 여기 기록해둔다 — 승인 대상은 아니고 참고용.

---

## 7. 등급 안내 모달

새 컨텐츠 컴포넌트: `frontend/src/components/primitives/modal/contents/ProfileGrade.tsx`

기존 네이밍 컨벤션(`Confirm.tsx`→`ConfirmContent`/`ConfirmContentProps`, `Feedback.tsx`→`FeedbackContent`/`FeedbackContentProps`)을 그대로 따른다:
- export 함수명: `ProfileGradeContent`
- props 인터페이스: `ProfileGradeContentProps` — 현재 총점(`totalPoints: number`), 등급 목록(`grades: { threshold: number; iconUrl: string }[]`)으로 확정(6-2 결정 — `name?: string` 필드 없음, 이름 없이 점수/아이콘만 표시).
- 파일 상단에 "사용 도메인: 마이페이지 아바타 탭" 주석
- `SheetHeader`/`SheetTitle`/`SheetDescription`을 `../sheet`에서 import해 헤더 구성

호출부(`MyPageClient.tsx`)는 아바타에 `onClick`을 추가하고 `useState`로 모달 open 상태를 관리, `<Modal open={...} onOpenChange={...}>`(기본 `form="responsive"` 유지)로 `ProfileGradeContent`를 감싼다. 0-1절에서 확인했듯 이 인터랙션 자체가 신규 추가다.

모달에 필요한 데이터(전체 등급 목록 + 현재 점수)는 `getProfileIconThresholds()` + 마이페이지에서 이미 조회한 `total_points`를 조합해서 서버 컴포넌트(`app/my/page.tsx`)에서 만들어 `MyPageClient`에 넘긴다.

---

## 8. `npm test` 영향

- 5절 표에서 확인한 대로, `RankingCard.tsx`/`WeekRankCard.tsx`/`UserMenu.tsx`/`HeaderAuthStatus.tsx`/`MyPageClient.tsx` 5개 파일 모두 **avatar_url을 직접 검사하는 테스트가 없다**(각 대응 테스트는 순서·렌더 흐름·디자인 토큰만 검사). 이 파일들을 계획대로만 고치면 기존 테스트가 깨질 근거는 없다.
- `src/lib/queries/cache-policy.test.mjs:14`는 `polls.ts`/`player-pick-one.ts`/`fixtures.ts`/`predictions.ts` 4개 파일에 대해서만 `unstable_cache` 사용을 강제하는 고정 목록이라, 신규 `profile-icons.ts`는 이 목록에 없어도 실패하지 않는다. 다만 새 유틸도 캐시 정책 테스트 대상에 넣는 게 일관성 있다고 판단되면 이 파일에 `'profile-icons.ts'` 항목을 추가하는 걸 구현 단계에서 제안한다(선택 사항, 승인 필요 없음 — 기존 테스트 패턴을 그대로 확장하는 것뿐).
- 신규 테스트 파일: `frontend/src/lib/images/profile-icons.test.mjs` — `resolveProfileIconUrl(totalPoints, thresholds)` 순수 함수를 `node --test`로 실제 로직 검증(예: 499점→0.webp, 500점→500.webp, thresholds 비어있으면 null, 정렬 안 된 입력도 처리되는지 등). 이 파일은 `npm test`에 자동 포함되고, 개별 script(`test:*`)에는 추가하지 않는다(CLAUDE.md 기준 개별 script는 7개뿐, 이 파일은 나머지 목록에 들어가지 않는 신규 파일이므로 스크립트 추가 여부도 확인 필요 항목이지만 사소해서 구현 시 자연스럽게 `npm test`로만 커버되게 둔다).

---

## 9. 작업 단계 순서 및 파일 목록

**주의: 아래는 사람 승인 이후 실행할 순서다. 이 plan.md 승인 전에는 착수하지 않는다.**

1. **마이그레이션**: `supabase/migrations/<날짜>_profile_icons_bucket.sql` 신규 (4절)
2. **에셋 업로드**: `0.webp`/`500.webp`/`2000.webp`를 실제 `profile-icons` 버킷에 업로드 — 이 작업은 디자인 자산이 필요해 사람/운영자 몫. 개발자 에이전트는 업로드 스크립트만 준비(기존 `images.ts` 업로드 헬퍼 패턴 참고, `cacheControl: '31536000'` 명시)하고 실제 파일은 못 만든다.
3. **등급 계산 유틸**: `frontend/src/lib/images/profile-icons.ts` 신규 (3절) + `frontend/src/lib/images/profile-icons.test.mjs` 신규 (8절)
4. **`getMySeasonRow` export**: `frontend/src/lib/queries/predictions.ts:212` 앞에 `export` 추가
5. **쿼리 레벨 반영 (컴포넌트 무수정 2곳)**: `predictions.ts:179`, `predictions.ts:239`의 `avatarUrl` 매핑을 `getProfileIconUrl(row.total_points)` 호출로 교체
6. **호출부 반영 (컴포넌트 무수정, 서버 쪽만 수정)**:
   - `frontend/src/app/my/page.tsx` — `getMySeasonRow` 호출 추가, `avatarUrl` 계산 로직 교체
   - `frontend/src/lib/actions/auth.ts` (`getHeaderAuth()`) — 동일
7. **댓글 반영 (6-1 결정 확정)**: `comments.ts`가 댓글 작성자별 `total_points`도 함께 조회하도록 확장 + `CommentsSection.tsx`가 `AvatarImage`를 실제로 사용해 `getProfileIconUrl(total_points)` 결과를 렌더링하도록 수정
8. **등급 안내 모달**: `frontend/src/components/primitives/modal/contents/ProfileGrade.tsx` 신규, `MyPageClient.tsx`에 탭 인터랙션 추가 (7절, 6-2 결정 반영 — 이름 없이 점수/아이콘만)
9. **mock 모드 (6-3 결정 확정)**: `getProfileIconUrl`이 mock 모드(`IS_MOCK`)에서 `null`을 반환하도록 구현 — 기존 아바타 폴백(이니셜) UI로 떨어진다. `teamLogoUrl`과 동일 패턴, 플레이스홀더 이미지 자산은 추가하지 않는다
10. **검증**: `npm test`, `npm run lint`, `npm run build` (frontend/에서, 1회 게이트로)

---

## 10. 완료 기준 대응

| 이슈 완료 기준 | 이 plan에서의 대응 |
|---|---|
| 시즌 누적 점수에 따라 올바른 등급 아이콘이 마이페이지/헤더/댓글/랭킹카드에 일관 표시 | 5절 표 (댓글 포함, 6-1 결정으로 확정 — 6곳 전부 대상) |
| 신규 등급 파일을 버킷에 추가만 하면 코드 변경 없이 반영 | 3절 `getProfileIconThresholds`가 매번 버킷을 다시 읽음(캐시 TTL 1시간 이내 반영), 6-2 결정(이름 미표시)으로 완전히 코드 무변경 |
| mock/실연동 양쪽 동작 확인 | 6-3 결정 — mock은 `getProfileIconUrl` null 반환 → 폴백(이니셜) 표시로 확인, 실연동은 5절 매핑대로 등급 아이콘 표시 |
| `npm test` 통과 | 8절 |
