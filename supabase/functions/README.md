# Edge Functions

FotMob 비공식 API에서 경기·선수 데이터를 긁어 DB에 적재하는 수집 함수들이다.
채택 배경은 `vault/00_의사결정사항/02-adr/002-fotmob-api-채택.md`, 적재·정산 설계는
`vault/10_sup/20260824_승부예측_결과적재_정산_계획.md`.

**앱 코드는 이 함수들을 호출하지 않는다.** 크론과 관리자 수동 트리거 전용이고,
조회는 전부 클라이언트가 테이블/view를 직접 select 한다.

| 함수 | 하는 일 | 호출 |
|---|---|---|
| `sync-fixture` | 팀 API → `fixtures` 전 경기 upsert | 크론 (KST 08:00) |
| `sync-fixture-ratings` | 종료 경기의 `matchDetails` → `fixture_player_ratings` upsert. 배치 5경기 | 크론 (KST 08:00, `sync-fixture` 다음) |
| `sync-season-squad` | 스쿼드 → `season_squads` upsert | 시즌 시작·이적시장 때 수동 |
| `get-fotmob-fixture` | FotMob 응답 확인용 조회 | 수동 |
| `health-check` | 배포 확인 | 수동 |

## 크론

pg_cron 1건, **KST 08:00(= UTC 23:00)** 에 `sync-fixture` → `sync-fixture-ratings` 순차 호출.
EPL·컵 전 경기가 KST 07시 전에 끝나므로 하루 1회로 전 경기가 커버되고, FotMob 평점이
확정된 뒤에 읽는다. 두 함수 모두 할 일이 없으면 즉시 끝나므로 여러 번 돌아도 무해하다.

등록은 **Supabase 대시보드 Cron UI**에서 한다 — 두 함수가 `verify_jwt: true`라 호출에
service_role 키가 필요하고, 마이그레이션에 넣으면 키가 커밋된다.

## 배포

```bash
npx supabase functions deploy <name>
```

`config.toml`에 함수 항목은 두지 않는다(기본값으로 배포된다).
