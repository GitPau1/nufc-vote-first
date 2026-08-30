-- user_feedback에 카테고리/만족도/페이지 경로 추가.
-- FAB 피드백 모달이 쓰는 필드. 기존 insert-only RLS는 그대로 둔다(조회는 대시보드로).
-- category는 DEFAULT 'etc'로 둬 기존 행과 /my/feedback 경로(카테고리 미지정)가 깨지지 않게 한다.
ALTER TABLE public.user_feedback
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'etc'
    CHECK (category IN ('vote', 'prediction', 'player', 'etc')),
  ADD COLUMN IF NOT EXISTS rating smallint
    CHECK (rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS page_path text;

COMMENT ON COLUMN public.user_feedback.category IS '피드백 대상 영역: vote/prediction/player/etc';
COMMENT ON COLUMN public.user_feedback.rating IS '만족도 1~5(선택). 미입력 시 NULL';
COMMENT ON COLUMN public.user_feedback.page_path IS '피드백을 남긴 시점의 경로(자동 저장, 선택)';
