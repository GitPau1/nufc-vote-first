# 보안 수정 롤백 SQL (긴급 원복용)

`supabase/migrations/2026082612*` 5건(RLS 보안 수정, 커밋 790b6e4)을 되돌리는 복원 SQL이다.

## ⚠️ 주의

- **이 파일들은 `supabase/migrations/`에 두면 안 된다.** 거기 두면 다음 `supabase db push`/`db reset` 때
  자동 적용돼서 막았던 취약점(이메일·투표 공개 등)이 도로 열린다. 그래서 일부러 이 폴더에 격리해 둔다.
- 롤백을 적용하는 순간 해당 취약점이 **다시 노출된다.** 진짜 급할 때만 쓴다.

## 쓰는 법

되돌리려는 파일만 골라 아래 중 한 방법으로 적용한다.

- **즉시 원복 (마이그레이션 이력 안 남김)** — Supabase Studio의 SQL Editor나 psql에 파일 내용을 붙여 실행.
- **이력 남기며 원복 (권장)** — 파일을 `supabase/migrations/`로 복사하되 **더 최신 타임스탬프**로 이름을 바꾸고
  (예: `20260827090000_revert_users_email.sql`) 리포 루트에서 `supabase db push`.

코드 변경(폴리시가 아니라 polls.ts·comments.ts의 service-role 이관)까지 되돌리려면 `git revert 790b6e4`.
단, DB 폴리시를 원복하면 service-role 코드는 그대로도 정상 동작하므로, 코드까지 되돌릴 필요는 대개 없다.

## 대응표

| 원복 파일 | 되돌리는 수정 |
|---|---|
| `revert_users_email.sql` | Vuln 1 — users 이메일 공개 차단 해제 |
| `revert_votes_public_read.sql` | Vuln 2 — votes 공개 읽기 복원 |
| `revert_seasons_anon_write.sql` | Vuln 3 — seasons 익명 쓰기 복원 |
| `revert_player_season_stats_anon_write.sql` | Vuln 4 — player_season_stats 익명 쓰기 복원 |
| `revert_predictions_pre_kickoff.sql` | Vuln 5 — predictions 전체 공개 읽기 복원 |
