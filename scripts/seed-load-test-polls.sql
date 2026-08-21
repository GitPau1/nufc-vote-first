-- polls 정렬 병목(계획서 5장 3순위) 측정용 시드.
-- getPollListUncached는 WHERE 없이 polls 전체를 created_at DESC로 정렬한 뒤
-- 페이지를 자르므로, 행 수가 늘어야 Sort 비용이 드러난다.
--
-- created_at을 과거 2년에 무작위로 흩어 실제 정렬 작업이 발생하게 한다.
-- (연속 삽입 순서 그대로면 이미 정렬된 입력이라 비용이 과소평가된다)
INSERT INTO public.polls (id, type, title, status, closes_at, created_at)
SELECT
  gen_random_uuid(),
  'selection',
  '[LOAD TEST] 더미 투표 ' || i,
  'active',
  now() + interval '30 days',
  now() - (random() * interval '730 days')
FROM generate_series(1, 5000) AS i;
