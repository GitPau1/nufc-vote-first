-- 보안 정리: player-photos(공개 버킷)의 광범위한 SELECT 정책 제거.
--
-- 문제: "player_photos_public_read"(storage.objects FOR SELECT USING bucket_id='player-photos')는
--   공개 버킷엔 불필요하고, 클라이언트가 버킷 전체 파일 '목록'을 나열할 수 있게 한다(파일명 열거).
-- 근거: 공개 버킷의 파일은 /storage/v1/object/public/... 경로가 RLS를 우회해 그대로 서빙하므로
--   이 SELECT 정책 없이도 사진 표시는 정상이다. 앱은 목록(.list) 조회를 어디서도 쓰지 않는다.
--   업로드/동기화는 service_role이라 RLS 무관.
-- 영향: 사진·팀로고 표시 정상, 업로드 정상. 사라지는 건 anon의 파일 '나열' 능력뿐(미사용).

drop policy if exists "player_photos_public_read" on storage.objects;
