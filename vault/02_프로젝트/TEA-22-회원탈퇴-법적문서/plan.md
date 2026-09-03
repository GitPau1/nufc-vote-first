# TEA-22 회원 탈퇴(24시간 유예 삭제) 완성 + 개인정보처리방침 페이지 신설 — plan.md

간소 사이클(단발 이슈, 소속 프로젝트 없음). spec은 Linear 이슈 본문(TEA-22)이 대신하며, 별도 feature-spec.md는 작성하지 않는다.

**이 문서는 사람 승인 전까지 구현하지 않는다.**

---

## 0. 범위 요약

이슈는 세 덩어리다.

1. 회원 탈퇴 완성: `deleted_at` 소프트 삭제 → 24시간 내 재로그인 시 취소 → pg_cron으로 익명화 + `auth.users` 하드 삭제
2. 개인정보처리방침 페이지 신설 (`/privacy`)
3. 이용약관 페이지 신설(`/terms`) + 로그인 시 동의 체크박스로 진행 차단

세 덩어리 모두 이슈 본문에 "확정된 동작(사용자 승인됨)"이 있어 큰 그림은 이미 정해져 있다. 이 plan은 그 큰 그림을 실제 파일/함수 단위로 쪼갠다.

---

## 1. 회원 탈퇴 — 아키텍처 결정

### 1-1. 탈퇴 버튼 → `deleted_at` 기록

`frontend/src/components/composition/my/MyPageClient.tsx:74-82`의 `handleDelete`가 지금은 `confirm()`만 하고 끝난다. 새 서버 액션 `submitDeleteAccount()`를 `frontend/src/lib/actions/auth.ts`에 추가한다 (기존 `mockLogin`/`mockLogout`과 같은 파일 — 이 파일이 이미 auth 관련 서버 액션의 유일한 장소).

```ts
export async function submitDeleteAccount(): Promise<{ error?: string }> {
  if (IS_MOCK) return {} // MyPageClient가 이미 이 분기 이전에 alert로 막지만 방어적으로 유지

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { error } = await supabase
    .from('users')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) return { error: '탈퇴 처리 중 오류가 발생했습니다.' }
  return {}
}
```

RLS "users: update own row"(`auth.uid() = id`)가 이미 있어 서비스 롤 없이 본인 세션 클라이언트로 충분하다.

**로그아웃은 서버 액션이 아니라 클라이언트에서 처리** — 이 리포의 기존 로그아웃 패턴(`MenuLogoutButton.tsx:20-24`, `UserMenu.tsx:45`)이 전부 `createClient()`(브라우저) + `supabase.auth.signOut()`을 클라이언트에서 부르고 있어, 서버 액션 안에서 signOut을 하면 이 리포에 없던 방식을 새로 만드는 셈이다. 기존 패턴을 그대로 따른다.

`MyPageClient.handleDelete`를 다음과 같이 바꾼다 (async 전환, `useLoadingRouter` 신규 import — `MenuLogoutButton.tsx`와 동일 훅):

```tsx
async function handleDelete() {
  if (isMockMode) {
    alert('데모 모드에서는 지원하지 않습니다.')
    return
  }
  if (!confirm('정말 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return

  const { submitDeleteAccount } = await import('@/lib/actions/auth')
  const result = await submitDeleteAccount()
  if (result.error) {
    alert(result.error)
    return
  }

  const { createClient } = await import('@/lib/supabase/client')
  const supabase = createClient()
  await supabase.auth.signOut()
  router.push('/')
  router.refresh()
}
```

### 1-2. 24시간 내 재로그인 → 탈퇴 취소

**결정: `getHeaderAuth()`(`frontend/src/lib/actions/auth.ts:21-64`)에 붙인다.** `AuthCodeHandler.tsx`가 아니라 여기를 선택한 이유:

- 탈퇴 시 `signOut()`으로 세션 쿠키가 지워지므로, 이후 어떤 페이지에서 `getHeaderAuth()`를 불러도 `data.user`가 없어 즉시 `null`을 반환한다 — 로그아웃 상태에서는 추가 쿼리 비용이 전혀 없다.
- 다시 로그인하려면 Google OAuth를 다시 타야 하고(`AuthCodeHandler`가 코드 교환 후 `router.refresh()`), 그 직후 렌더되는 서버 컴포넌트(헤더 포함)가 `getHeaderAuth()`를 부른다 — 로그인 경로(OAuth든 mock이든)와 무관하게 "로그인 세션이 있고 처음 확인하는 시점"을 자연히 잡아낸다.
- `AuthCodeHandler`에 별도 로직을 심으면 "OAuth 콜백을 반드시 거쳐야 취소된다"는 제약이 생기는데, 실제로는 세션이 있는 모든 첫 조회 시점에 취소되는 게 맞다.

재취소 조건은 **"`deleted_at`이 24시간 이내인지" 체크가 필요 없다** — pg_cron이 24시간 지난 계정은 `auth.users`를 하드 삭제하므로, 만약 유예가 지났다면애초에 같은 Google 계정으로 로그인해도 Supabase가 **새 `auth.users` 행**을 만들어 `handle_new_user()` 트리거가 새 `public.users` 행을 만든다(다른 id). 즉 "기존 id로 로그인에 성공했다" = "아직 안 지워졌다"가 항상 성립하므로, `deleted_at is not null`이면 무조건 취소로 처리하면 된다.

```ts
// getHeaderAuth() 내부, Promise.all 이후
const [{ data: profile }, mySeasonRow, iconThresholds] = await Promise.all([
  supabase.from('users').select('display_name, deleted_at').eq('id', data.user.id).single<HeaderProfile>(),
  getMySeasonRow(data.user.id),
  getProfileIconThresholdsSafe(),
])

if (profile?.deleted_at) {
  await supabase.from('users').update({ deleted_at: null }).eq('id', data.user.id)
}
```

`HeaderProfile` 타입에 `deleted_at: string | null` 추가.

> 참고(범위 밖, 참고만): `git status`에 이미 `frontend/src/lib/actions/auth.ts`가 커밋 전 상태로 수정돼 있다(프로필 아이콘 조회 병렬화 — `getProfileIconThresholdsSafe`/`resolveProfileIconUrl` 도입, TEA-21 관련으로 보임). 이번 변경은 그 위에 얹히므로 구현 시작 전 그 변경이 먼저 커밋/정리돼 있는지 확인한다.

### 1-3. pg_cron — 익명화 + `auth.users` 하드 삭제

**핵심 결정 지점**: `auth.users` 행을 실제로 지우는 방법. 두 가지를 검토했다.

**A안 — pg_cron 함수 안에서 `DELETE FROM auth.users` 직접 실행.** 이슈 본문이 예로 든 방식이지만, `auth` 스키마는 `supabase_auth_admin` 소유이고 pg_cron 잡은 스케줄한 롤(마이그레이션을 실행한 `postgres` 롤)로 돈다. 이 리포의 기존 마이그레이션 어디에도 `auth.users`를 직접 SELECT/UPDATE/DELETE한 전례가 없어(`grep` 확인 완료), 이 프로젝트의 `postgres` 롤이 실제로 `auth.users` DELETE 권한을 갖고 있는지 **정적 코드로는 검증 불가능** — 실제 Supabase 프로젝트에서 실행해보지 않으면 성공 여부를 알 수 없다. 실패하면 pg_cron 잡 자체가 조용히 실패해서 "익명화는 됐는데 계정은 안 지워짐" 상태가 영구화될 위험이 있다.

**B안(채택) — pg_cron은 `public.users` 익명화만 하고, 실제 삭제는 Supabase Admin API(`auth.admin.deleteUser()`)를 서버(Next.js) 쪽에서 호출.** 이 리포에 이미 있는 두 패턴을 그대로 합친 것:
- pg_cron + `pg_net.http_post`로 Next.js API 라우트를 호출하는 패턴 (`20260624123000_revalidate_player_pick_one_cache.sql:178-189`, `/api/revalidate`) — 시크릿 검증도 동일 패턴(`REVALIDATE_SECRET`, `frontend/src/app/api/revalidate/route.ts`).
- 서비스 롤 클라이언트로 관리자 작업을 수행하는 패턴 (`frontend/src/lib/supabase/admin.ts`).

`auth.admin.deleteUser()`는 Supabase가 공식 지원하는 API라 권한 문제가 없고(서비스 롤 키만 있으면 됨), 관련 `auth.identities`/세션 등 부속 테이블 정리도 Supabase가 알아서 한다 — A안처럼 raw SQL로 auth 스키마 부속 테이블까지 직접 정리할 필요가 없다.

이 선택은 이슈 본문의 "새로운 판단이 필요하면 세부사항 제외하고 확인받으라"는 기준에서 **"pg_cron 함수 재사용"이라는 큰 방향 안에서의 구현 세부사항**으로 보고 직접 결정했다 — 다만 새 테이블 1개(`account_purge_config`)와 새 API 라우트 1개가 추가되므로, 아래 내용째로 **이 plan.md 승인 시점에 같이 확인해달라.**

#### 마이그레이션 1: 설정 테이블 (`player_pick_one_revalidation_config`와 동일 모양)

파일: `supabase/migrations/<날짜>_account_purge_config.sql`

```sql
create table if not exists public.account_purge_config (
  id boolean primary key default true check (id),
  endpoint_url text,
  secret text,
  updated_at timestamptz not null default now()
);

alter table public.account_purge_config enable row level security;
-- 정책을 만들지 않는다 — RLS 활성 + 정책 없음 = anon/authenticated는 전부 차단,
-- SECURITY DEFINER 함수(postgres 소유)와 service_role만 접근 가능.
-- player_pick_one_revalidation_config와 동일한 방어 방식.
```

배포 후 수동 작업(코드 아님, 운영자 몫): Supabase SQL 에디터에서
```sql
insert into public.account_purge_config (endpoint_url, secret)
values ('https://<production-domain>', '<ACCOUNT_PURGE_SECRET와 동일 값>')
on conflict (id) do update set endpoint_url = excluded.endpoint_url, secret = excluded.secret, updated_at = now();
```
을 1회 실행해야 한다 — `player_pick_one_revalidation_config` 행도 마이그레이션에 INSERT가 없는 것으로 보아 같은 방식으로 수동 등록된 것으로 보인다(시크릿을 git에 남기지 않기 위함).

#### 마이그레이션 2: 익명화 + 삭제 트리거 함수 + 스케줄

파일: `supabase/migrations/<날짜>_purge_deleted_accounts.sql`

```sql
create or replace function public.purge_deleted_accounts()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_endpoint_url text;
  v_secret text;
  v_purged_ids uuid[];
begin
  with due as (
    select id from public.users
    where deleted_at is not null
      and deleted_at <= now() - interval '24 hours'
      and email not like 'deleted-%@deleted.local'  -- 이미 익명화된 행 재처리 방지
  ),
  anonymized as (
    update public.users u
    set email = 'deleted-' || u.id || '@deleted.local',
        display_name = '탈퇴한 사용자',
        avatar_url = null
    from due
    where u.id = due.id
    returning u.id
  )
  select array_agg(id) into v_purged_ids from anonymized;

  if v_purged_ids is null or array_length(v_purged_ids, 1) is null then
    return;
  end if;

  select endpoint_url, secret into v_endpoint_url, v_secret
  from public.account_purge_config
  where id = true;

  if v_endpoint_url is not null and v_secret is not null then
    perform net.http_post(
      url := v_endpoint_url || '/api/purge-deleted-accounts',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_secret,
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('userIds', to_jsonb(v_purged_ids))
    );
  end if;
end;
$$;

create extension if not exists pg_net;
create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('purge-deleted-accounts');
exception
  when others then null;
end;
$$;

select cron.schedule(
  'purge-deleted-accounts',
  '0 * * * *',  -- 매시 정각. 24시간 유예에 최대 1시간 오차 — 분 단위 정밀도가 필요한 기능이 아니라 충분하다고 판단
  $$select public.purge_deleted_accounts();$$
);
```

`votes`/`comments`는 손대지 않는다 — `public.users` 행 자체는 지우지 않으므로 `public_profiles`도 트리거(`sync_public_profile_on_user_change`, `20260529120000_public_profiles_storage_vote_guards.sql:34-37`)로 자동 동기화되어 표시 이름이 "탈퇴한 사용자"로 같이 바뀐다 — 댓글 작성자 표시도 별도 처리 없이 자연히 반영된다.

이메일 포맷은 `deleted-<uuid>@deleted.local`로 확정(유니크 제약은 없지만 uuid 기반이라 자연히 유일함, 도메인이 실존 도메인이 아니라 재사용/오발송 위험 없음).

#### 신규 API 라우트: `frontend/src/app/api/purge-deleted-accounts/route.ts`

`/api/revalidate/route.ts`와 동일한 시크릿 검증 구조.

```ts
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const secret = process.env.ACCOUNT_PURGE_SECRET
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!secret || token !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null) as { userIds?: unknown } | null
  const userIds = Array.isArray(body?.userIds) ? body.userIds.filter((id): id is string => typeof id === 'string') : []
  if (userIds.length === 0) {
    return NextResponse.json({ purged: 0 })
  }

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const results = await Promise.allSettled(userIds.map(id => supabase.auth.admin.deleteUser(id)))
  const failed = results.filter(r => r.status === 'rejected').length

  return NextResponse.json({ purged: userIds.length - failed, failed })
}
```

신규 env var: `ACCOUNT_PURGE_SECRET` — `.env.example`에 `REVALIDATE_SECRET` 옆에 추가. `REVALIDATE_SECRET`를 재사용하지 않는 이유: 용도가 다른 두 기능이 같은 시크릿을 공유하면 하나가 새면 둘 다 뚫린다.

### 1-4. mock 모드

기존 alert 그대로 유지(`isMockMode` 분기가 이미 `submitDeleteAccount` 호출 전에 막는다). `submitDeleteAccount` 자체도 방어적으로 `IS_MOCK`이면 아무것도 안 하고 반환(1-1 코드 참고) — 이중 방어이지 이번 범위에서 mock 동작을 바꾸는 건 아니다.

### 1-5. 재가입

`handle_new_user()` 트리거가 `auth.users` insert마다 `public.users`에 `ON CONFLICT (id) DO NOTHING`으로 새로 만든다. 계정이 하드 삭제된 뒤 같은 Google 계정으로 재로그인하면 Supabase가 새 `auth.users.id`를 발급하므로 자연히 새 `public.users` 행이 생긴다 — 코드 변경 불필요. 밴 로직은 이번 범위에서 명시적으로 제외(이슈 본문 확인됨).

---

## 2. 개인정보처리방침 페이지

### 2-1. 라우트

**`/privacy`** (`frontend/src/app/privacy/page.tsx`). 이슈 본문이 예시로 든 경로 그대로 채택 — 짧고 통상적인 관례고, `find src/app -maxdepth 1`로 확인한 결과 겹치는 라우트 없음.

로그인 여부와 무관하게 항상 공개(로그인 모달 안에서도 링크로 노출되므로 비로그인 접근이 필수). 인증 게이트 없이 `AppHeader mobileBack`만 씌운다 (`app/my/page.tsx`, `app/menu/page.tsx`와 동일한 서브 페이지 패턴).

### 2-2. 페이지 구조

```tsx
// frontend/src/app/privacy/page.tsx
import { AppHeader } from '@/components/composition/common/AppHeader'

export default function PrivacyPage() {
  return (
    <>
      <AppHeader mobileBack />
      <main className="mx-auto min-h-[calc(100vh-56px)] max-w-detail bg-page px-4 pt-6 pb-24">
        <h1 className="text-heading-2 sm:text-heading-1 font-semibold text-neutral mb-1">개인정보처리방침</h1>
        <p className="text-caption-1 text-neutral-muted mb-6">시행일자: 2026년 9월 3일</p>
        {/* 섹션들 — 아래 2-3 내용 */}
      </main>
    </>
  )
}
```

시행일자는 실제 배포일로 구현 시 갱신한다(플레이스홀더가 아니라 "발행일 기준"이라는 이슈 지침대로 배포 커밋 시점 날짜로 채움).

### 2-3. 본문 (최종 확정 — 대화에서 2차 검토까지 마침)

> 법률 자문을 거친 문서가 아니라 사실관계를 그대로 서술한 문서다. 문의 이메일만 확정되면 그대로 게시 가능한 수준으로 최종 확정했다. 아래 텍스트를 그대로 페이지에 반영한다(임의 수정 금지 — 표현을 바꿔야 할 사유가 생기면 구현 전에 에스컬레이션).

1. **운영자**: 본 서비스(NUFCVOTE)는 사업자 등록이 없는 비상업적 개인 프로젝트로 운영됩니다.
2. **수집하는 개인정보 항목**
   - Google 로그인 시: 이메일 주소, 프로필 사진, 이름
   - 서비스 이용 중 직접 입력: 댓글 내용, 투표 선택 내역, 승부예측 참여 내역
   - 서비스 이용 중 자동 수집: IP 주소, 접속 로그, 쿠키, 브라우저·기기 정보
3. **개인정보의 수집 및 이용 목적**: 회원 식별 및 로그인 유지, 투표·승부예측 참여 기록 제공, 댓글 작성자 표시, 서비스 이용 통계 분석 및 서비스 개선
4. **개인정보의 제3자 제공**: 서비스 이용 분석을 위해 Mixpanel(해외 서비스)에 이용자의 서비스 내 행동 데이터(접속 페이지, 클릭 등)와 식별자를 전송합니다. **당사는 수집된 이용 데이터를 서비스 개선 목적으로만 사용하며, 광고 등 다른 목적으로 이용하지 않습니다.** 이메일 등 식별 가능한 개인정보 원문은 전송하지 않습니다.
5. **개인정보 처리의 위탁**: 서비스 운영을 위해 데이터 저장 및 인증 인프라를 Supabase에 위탁하고 있습니다.
6. **개인정보의 보유 및 파기**
   - 회원 탈퇴 시 즉시 로그아웃되며, 24시간 이내 재로그인하면 탈퇴가 자동으로 취소됩니다.
   - 24시간이 지나면 이메일·이름·프로필 사진은 식별할 수 없는 값으로 자동 대체되고, 계정은 삭제됩니다.
   - 이미 작성한 투표·댓글 기록은 다른 이용자가 볼 수 있는 화면 구성을 위해 유지되며, 작성자 표시는 "탈퇴한 사용자"로 대체됩니다.
7. **정보주체의 권리와 행사 방법**
   - 닉네임(표시 이름)은 마이페이지에서 직접 수정할 수 있습니다.
   - 작성한 댓글은 직접 삭제할 수 있으며, **삭제된 댓글은 다른 이용자에게 더 이상 노출되지 않습니다.** (실제 구현은 `is_hidden` 소프트 삭제 — `comments.ts:225-229` — 이므로 "완전 삭제"라고 쓰지 않고 이 표현으로 확정함, 임의 변경 금지)
   - 회원 탈퇴(계정 및 개인정보 삭제)는 마이페이지에서 언제든지 요청할 수 있습니다.
   - 그 외 개인정보 열람·정정 요청은 아래 문의처를 통해 할 수 있습니다.
8. **쿠키의 사용**: 로그인 상태 유지를 위한 쿠키, 서비스 이용 분석을 위한 브라우저 저장소를 사용합니다. 브라우저 설정에서 쿠키 저장을 거부할 수 있으나, 이 경우 로그인 유지 등 일부 기능이 제한될 수 있습니다.
9. **만 14세 미만 이용 제한**: 본 서비스는 만 14세 이상만 이용할 수 있으며, 만 14세 미만 아동의 개인정보를 의도적으로 수집하지 않습니다. (실제 연령 확인 기능은 없음 — 관례적 정책 문구로 포함하기로 사용자 승인됨)
10. **개인정보의 안전성 확보조치**: 서비스는 Supabase가 제공하는 보안 인프라(전송 구간 암호화 등)를 통해 개인정보를 관리합니다.
11. **개인정보처리방침의 변경**: 이 방침은 필요 시 개정될 수 있으며, 변경 시 서비스 내 공지합니다.
12. **개인정보 보호책임자 및 문의처**: 서비스 운영자 / [문의 이메일 — 배포 전 직접 입력 예정. 실명은 넣지 않음, 사용자 승인됨]

Microsoft Clarity는 이번 방침에 포함하지 않는다(도입 미확정).

---

## 3. 이용약관 페이지 + 로그인 동의 UI

### 3-1. 라우트 및 구조

**`/terms`** (`frontend/src/app/terms/page.tsx`), `/privacy`와 동일한 구조(`AppHeader mobileBack`, 인증 게이트 없음).

### 3-2. 본문 (최종 확정 — 대화에서 2차 검토까지 마침)

> 마찬가지로 법률 자문 문서가 아니라 사실관계를 그대로 서술한 문서로 최종 확정했다. 실제로 없는 기능(신고·제재 등)은 과장하지 않고 원론적 유보 조항 수준으로만 썼다. 아래 텍스트를 그대로 반영한다(임의 수정 금지).

1. **목적**: 이 약관은 NUFCVOTE(이하 "서비스")의 이용 조건을 정합니다. 서비스는 사업자가 아닌 개인이 비상업적으로 운영하는 뉴캐슬 유나이티드 팬 투표 플랫폼입니다.
2. **이용계약의 성립**: Google 계정으로 로그인 시 본 약관 및 개인정보처리방침에 동의한 것으로 봅니다.
3. **이용 자격**: 본 서비스는 만 14세 이상만 이용할 수 있습니다. (실제 연령 확인 기능은 없음 — 관례적 정책 문구로 포함하기로 사용자 승인됨, 개인정보처리방침 9번과 동일 문구)
4. **이용자의 의무**: 이용자는 타인의 권리를 침해하거나 명예를 훼손하는 게시물을 작성하지 않아야 하며, 서비스를 부정한 방법으로 이용하지 않아야 합니다.
5. **게시물의 저작권**: 이용자가 작성한 게시물(댓글 등)의 저작권은 작성자 본인에게 있습니다. 서비스는 해당 게시물을 서비스 운영 목적 범위 내에서 사용할 수 있습니다.
6. **서비스의 운영, 변경 및 중단**: 운영자는 서비스 내용을 변경하거나 서비스 제공을 일시적·영구적으로 중단할 수 있으며, 이 경우 사전에 공지하기 위해 노력합니다.
7. **서비스 이용 제한**: 이용자가 이 약관을 위반한 경우, 운영자는 필요한 범위 내에서 서비스 이용을 제한할 수 있습니다. (실제 신고·제재 집행 기능은 없음 — 원론적 유보 조항)
8. **면책**: 서비스는 무상으로 제공되며, 운영자는 서비스 이용과 관련하여 발생하는 손해에 대해 법이 허용하는 한도 내에서 책임을 지지 않습니다.
9. **계정 관리**: 회원 탈퇴 절차는 개인정보처리방침에 따릅니다.
10. **약관의 변경**: 이 약관은 필요 시 개정될 수 있으며, 변경 시 서비스 내 공지합니다.
11. **준거법**: 이 약관은 대한민국 법령에 따라 해석됩니다.

### 3-3. 동의 절차 위치 변경 (2026-09-03 재설계 — 최초 구현 후 사용자 피드백 반영)

**최초 구현(커밋 `6b7fe0d`)은 `Login.tsx`에 체크박스를 넣었으나, 로그인할 때마다(재로그인 포함) 매번 눌러야 하는 문제가 발견되어 아래로 재설계함. 이 절이 기존 3-3/3-4 내용을 대체한다.**

#### 배경 — 발견된 버그

`frontend/src/app/auth/callback/route.ts:41-50`의 기존 "신규 가입자 판별" 로직(`!profile?.display_name`이면 `/onboarding`으로)은 사실상 죽은 코드였다. `handle_new_user()` 트리거(`initial_schema.sql:93-102`)가 가입 즉시 Google 이름 또는 이메일 앞부분으로 `display_name`을 항상 채우기 때문에, 실제 Google 로그인에서 `display_name`이 null인 경우가 없다 — 즉 온보딩 페이지에 실제로 도달하는 유저가 없었다.

#### 확정된 설계

1. **새 컬럼**: `public.users.terms_accepted_at timestamptz` (nullable, default null) 마이그레이션 추가.
2. **`Login.tsx`**: 체크박스·`agreed` state·`disabled={!agreed}`·`if (!agreed) return` 가드를 전부 제거하고 원래대로(원탭 로그인) 되돌린다.
3. **`/auth/callback/route.ts`**: 리다이렉트 조건을 `!profile?.display_name` → `!profile?.terms_accepted_at`로 변경. `select('display_name')`도 `select('display_name, terms_accepted_at')`로.
4. **온보딩을 2단계로 분리** (`frontend/src/app/onboarding/OnboardingForm.tsx` 또는 새 래퍼 컴포넌트에서 client state로 단계 관리):
   - **1단계 — 동의 화면**: `Login.tsx`에서 제거한 체크박스 UI(네이티브 `<input type="checkbox">`, `/terms`·`/privacy` `target="_blank"` 링크)를 그대로 옮겨온다. "동의하고 계속하기" 버튼(미체크 시 `disabled`). 이 단계는 서버 저장 없이 클라이언트 state만 넘긴다.
   - **2단계 — 닉네임 화면**: 기존 `OnboardingForm` 내용 그대로. **input의 초기값을 서버에서 내려준 현재 `display_name`으로 미리 채운다** — 신규/기존 유저를 구분하는 로직 없이, 기존 유저는 그냥 "계속하기"만 누르면 되고 신규 유저는 트리거가 채운 기본값(구글 이름/이메일 앞부분)이 미리 채워진 상태에서 원하면 바꾼다.
   - `OnboardingPage`(서버 컴포넌트, `frontend/src/app/onboarding/page.tsx`)가 현재 유저의 `display_name`을 조회해 `OnboardingForm`(또는 새 래퍼)에 prop으로 내려준다.
5. **`saveNickname()`** (`frontend/src/lib/actions/onboarding.ts`): 기존 `display_name` upsert에 `terms_accepted_at: new Date().toISOString()`을 함께 넣는다. mock 모드 분기는 건드리지 않는다(mock은 애초에 온보딩 리다이렉트 대상이 아님 — 범위 밖).
6. **기존 가입자 처리**: 별도 로직 불필요 — `terms_accepted_at`이 null인 모든 유저(기존+신규)가 다음 로그인 때 콜백에서 온보딩으로 보내지고, 2단계에서 현재 닉네임이 미리 채워진 채로 한 번만 거치면 끝난다.

#### `login-modal.test.mjs` 갱신
- `'login requires agreeing to terms/privacy before proceeding (TEA-22)'` 테스트를 **제거**한다(더 이상 유효하지 않은 동작 — 이 동작을 검증하던 테스트가 사라지는 게 맞다, 자리를 옮겨 재작성하지 않는다).
- 온보딩 쪽에 새 테스트 파일(`OnboardingForm.test.mjs` 등, 이 리포의 소스-문자열 검사 관례를 따름)을 추가해 1단계 동의 게이트 + 2단계 prefill 동작을 검증한다.

---

## 4. 검증 계획

각 단계 완료 시 해당 소스 옆 테스트만 우선 확인하고, 전체 게이트(`npm test`/`npm run lint`/`npm run build`)는 모든 구현이 끝난 뒤 1회 실행한다 (developer-agent-rules.md 6번 규칙).

| 단계 | 확인 명령 |
|---|---|
| `getHeaderAuth` 수정 | 관련 유닛 테스트 없음(문자열 검사 테스트도 이 함수 세부 로직은 안 봄) — 타입 확인은 `npx tsc --noEmit` |
| `Login.tsx` 동의 UI | `npm run test:header-auth`는 무관. `login-modal.test.mjs`는 `npm test`로만 커버(개별 script 목록에 없음, CLAUDE.md 명시) — 신규/기존 테스트 통과 확인 |
| 마이그레이션 SQL | `supabase db push` 전 로컬에서 `supabase db reset`(사용 가능하면)으로 문법 확인 — 실제 프로젝트 반영은 사람 승인 후 별도 실행 |
| 전체 게이트 (마지막 1회) | `npm test`, `npm run lint`, `npm run build` (frontend/에서) |

---

## 5. 확인 필요 — 전부 승인 완료 (구현 착수 가능)

1. **1-3절의 B안(pg_cron + Admin API) 채택** — ✅ 승인됨. A안은 검토하지 않는다.
2. **재시도 안전장치(익명화 성공·Auth 삭제 API 실패 시 원본 이메일/이름 영구 유실 가능)** — 오케스트레이터가 검토 중 발견해 추가로 확인함. ✅ **이번 범위에서는 추가하지 않기로 확정** (드문 네트워크 실패 시에만 발생하는 edge case로 감수하고 진행). 추후 실제로 문제가 생기면 별도 이슈로 재시도/추적 로직을 추가한다.
3. **문의 이메일** — ✅ 플레이스홀더 그대로 커밋. 배포 전 사용자가 직접 실제 값으로 교체한다. **구현 완료 보고 시 이 플레이스홀더가 아직 안 채워졌다는 점을 반드시 다시 상기시킬 것.**
4. **2-3/3-2절 본문** — ✅ 최종 확정(위 텍스트 그대로). 확정 과정에서 아래 3가지가 함께 반영됨:
   - 댓글 삭제는 실제로 `is_hidden` 소프트 삭제(`comments.ts:225-229`)라서 "완전 삭제"라고 쓰지 않고 "다른 이용자에게 더 이상 노출되지 않음"으로 표현.
   - Mixpanel 관련 문구는 주어를 "당사는"으로 명확히 해서, Mixpanel 자체의 정책까지 보장하는 것처럼 읽히지 않게 함.
   - 개인정보 보호책임자는 실명 없이 "서비스 운영자"로만 표기.

이 4가지 외의 세부사항(라우트 경로명, 이메일 익명화 포맷, 체크박스 네이티브 구현, 아이콘 선택 등)은 이슈 본문이 위임한 범위로 보고 이미 확정해 위에 반영했다.

**작업 브랜치**: `geonhaa/tea-22-회원-탈퇴24시간-유예-삭제-완성-개인정보처리방침` (origin/main 기준 생성 완료, Linear 자동 생성 브랜치명).

---

## 6. 작업 단계 순서 및 파일 목록

**주의: 아래는 사람 승인 이후 실행할 순서다. 이 plan.md 승인 전에는 착수하지 않는다.**

1. **선행 확인**: `git status`의 기존 미커밋 `frontend/src/lib/actions/auth.ts` 변경을 먼저 커밋/정리 (1-2절 참고 노트)
2. **마이그레이션**: `supabase/migrations/<날짜>_account_purge_config.sql`, `supabase/migrations/<날짜>_purge_deleted_accounts.sql` 신규 (1-3절)
3. **탈퇴 서버 액션**: `frontend/src/lib/actions/auth.ts`에 `submitDeleteAccount()` 추가 (1-1절)
4. **탈퇴 취소 로직**: `frontend/src/lib/actions/auth.ts`의 `getHeaderAuth()` 수정, `HeaderProfile` 타입에 `deleted_at` 추가 (1-2절)
5. **탈퇴 버튼 연결**: `frontend/src/components/composition/my/MyPageClient.tsx`의 `handleDelete` 비동기 전환 + `useLoadingRouter` 추가 (1-1절)
6. **삭제 API 라우트**: `frontend/src/app/api/purge-deleted-accounts/route.ts` 신규 (1-3절)
7. **env 문서화**: `.env.example`에 `ACCOUNT_PURGE_SECRET=` 추가
8. **개인정보처리방침 페이지**: `frontend/src/app/privacy/page.tsx` 신규 (2절)
9. **이용약관 페이지**: `frontend/src/app/terms/page.tsx` 신규 (3-1, 3-2절)
10. **로그인 동의 UI**: `frontend/src/components/primitives/modal/contents/Login.tsx` 수정 (3-3절)
11. **테스트 갱신**: `frontend/src/components/composition/polls/login-modal.test.mjs`에 동의 체크박스 관련 테스트 추가 (3-4절)
12. **메뉴 링크 추가**: `frontend/src/app/menu/MenuActions.tsx`에 "이용약관"/"개인정보처리방침" 링크 버튼 추가 — `피드백 남기기`와 같은 위치(로그인 여부 무관 항상 노출), 아이콘은 `FileText`(이용약관)/`Shield`(개인정보처리방침, `ShieldCheck`는 이미 관리자 링크에 사용 중이라 구분)
13. **검증(1회 게이트)**: `npm test`, `npm run lint`, `npm run build`

---

## 7. 완료 기준 대응

| 이슈 완료 기준 | 이 plan에서의 대응 |
|---|---|
| `npm test`/`npm run lint`/`npm run build` 통과 | 4절, 6단계 13번 |
| 위에 명시된 동작이 그대로 코드에 반영 | 1~3절 |
| plan.md는 사람 승인 전까지 구현 금지 | 이 문서 자체가 그 게이트 |
| 약관 미동의 상태에서 로그인 진행 안 됨 확인 | 3-3절 `disabled={!agreed}` + 방어 가드, 3-4절 테스트 |
| `login-modal.test.mjs` 갱신 필요 여부 확인 후 반영 | 3-4절 |
