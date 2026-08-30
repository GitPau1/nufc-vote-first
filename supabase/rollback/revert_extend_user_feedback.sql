-- revert 20260830170000_extend_user_feedback.sql
ALTER TABLE public.user_feedback
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS rating,
  DROP COLUMN IF EXISTS page_path;
