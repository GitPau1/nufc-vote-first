-- 원복: 20260830160000_drop_player_photos_list_policy.sql. 수동 실행 전용(migrations 밖).
-- player-photos 공개 read(목록) 정책을 다시 만든다 — 나중에 anon 목록/SDK 조회가 필요해지면 실행.
create policy "player_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'player-photos');
