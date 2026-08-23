-- 승부예측 선수 픽 화면은 name_ko를 먼저 쓰고 없으면 영문명으로 폴백한다.
-- 폴백에 걸려 영문으로 노출되던 선수들의 한국어 표기를 채운다.
-- name_ko가 이미 있는 행은 관리자 수동 입력값이므로 건드리지 않는다(is null 조건).
update public.season_squads as s
set name_ko = v.name_ko
from (values
  (958010,  '아마르 데디치'),
  (1624586, '바주마나 투레'),
  (1186978, '루카시 호르니체크'),
  (1643770, '션 스퇴르'),
  (1695681, '알라지 밤바')
) as v(fotmob_player_id, name_ko)
where s.fotmob_player_id = v.fotmob_player_id
  and s.name_ko is null;
