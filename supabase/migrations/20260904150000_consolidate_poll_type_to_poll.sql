-- TEA-26: PollType 통합 — overall_rating을 제외한 모든 poll을 단일 값 'poll'로 통합.
-- 실행 전 사람이 직접 백업(플랜.md 위 §0-C): 아래 결과를 어딘가에 보관한다. 롤백 시 이 매핑으로
-- poll별 원래 type을 개별 복원해야 한다(일괄 롤백 SQL이 없다 — 원래 값이 poll마다 다르므로).
--   select id, type from polls where type in ('subject_options','question_targets','free_choice','selection','evaluation') order by type, id;

update polls
set type = 'poll'
where type in ('subject_options', 'question_targets', 'free_choice', 'selection', 'evaluation');

-- 실행 후 확인: select type, count(*) from polls group by type order by type;
-- 기대값: poll 13 / overall_rating 2
