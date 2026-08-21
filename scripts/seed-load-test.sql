-- 유저 10만 명
INSERT INTO public.users (id, email, display_name)
SELECT gen_random_uuid(), 'load' || i || '@test.local', 'tester' || i
FROM generate_series(1, 100000) AS i;

-- 부하 테스트용 투표 1건 + 선택지 5개
INSERT INTO public.polls (id, type, title, closes_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'selection',
        '[LOAD TEST] 최우수 선수', now() + interval '30 days');

INSERT INTO public.poll_options (poll_id, label, display_order)
SELECT '00000000-0000-0000-0000-000000000001', '선수 ' || i, i
FROM generate_series(1, 5) AS i;

-- 표 10만 개
INSERT INTO public.votes (poll_id, user_id, option_id)
SELECT '00000000-0000-0000-0000-000000000001',
       u.id,
       (SELECT id FROM public.poll_options
        WHERE poll_id = '00000000-0000-0000-0000-000000000001'
        ORDER BY random() LIMIT 1)
FROM public.users u
WHERE u.email LIKE 'load%@test.local';
