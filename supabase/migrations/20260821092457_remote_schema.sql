drop extension if exists "pg_net";

create extension if not exists "pg_net" with schema "public";

drop policy "users: select own row" on "public"."users";

alter table "public"."user_feedback" drop constraint "user_feedback_content_check";

alter table "public"."user_feedback" drop constraint "user_feedback_user_id_fkey";

drop index if exists "public"."comment_likes_user_comment_idx";

drop index if exists "public"."comments_visible_poll_created_at_idx";

drop index if exists "public"."player_pick_one_rating_changes_run_delta_idx";

drop index if exists "public"."player_pick_one_weekly_runs_applied_week_end_idx";

drop index if exists "public"."rating_vote_likes_user_vote_idx";

drop index if exists "public"."rating_votes_poll_id_idx";

drop index if exists "public"."rating_votes_poll_user_idx";

drop index if exists "public"."votes_poll_id_idx";

drop index if exists "public"."votes_poll_id_user_id_idx";


  create table "public"."player_comments" (
    "id" uuid not null default gen_random_uuid(),
    "player_id" uuid not null,
    "user_id" uuid not null,
    "content" text not null,
    "is_hidden" boolean default false,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."player_comments" enable row level security;


  create table "public"."player_comparisons" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "player_a_id" uuid not null,
    "player_b_id" uuid not null,
    "winner_player_id" uuid not null,
    "loser_player_id" uuid not null,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."player_comparisons" enable row level security;


  create table "public"."player_season_stats" (
    "id" uuid not null default gen_random_uuid(),
    "player_id" uuid not null,
    "season" text not null,
    "appearances" integer not null default 0,
    "goals" integer not null default 0,
    "assists" integer not null default 0,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "season_id" uuid
      );


alter table "public"."player_season_stats" enable row level security;


  create table "public"."seasons" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "starts_at" date,
    "ends_at" date,
    "is_current" boolean not null default false,
    "display_order" integer not null default 0,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."seasons" enable row level security;

alter table "public"."players" add column "base_rating" integer not null default 50;

alter table "public"."players" add column "birth_date" date;

alter table "public"."players" add column "nationality" text;

alter table "public"."user_feedback" add column "updated_at" timestamp with time zone default now();

alter table "public"."user_feedback" alter column "created_at" drop not null;

CREATE UNIQUE INDEX player_comments_pkey ON public.player_comments USING btree (id);

CREATE INDEX player_comparisons_created_at_idx ON public.player_comparisons USING btree (created_at DESC);

CREATE INDEX player_comparisons_loser_player_id_idx ON public.player_comparisons USING btree (loser_player_id);

CREATE UNIQUE INDEX player_comparisons_pkey ON public.player_comparisons USING btree (id);

CREATE UNIQUE INDEX player_comparisons_user_id_player_a_id_player_b_id_key ON public.player_comparisons USING btree (user_id, player_a_id, player_b_id);

CREATE INDEX player_comparisons_winner_player_id_idx ON public.player_comparisons USING btree (winner_player_id);

CREATE UNIQUE INDEX player_season_stats_pkey ON public.player_season_stats USING btree (id);

CREATE UNIQUE INDEX player_season_stats_player_id_season_key ON public.player_season_stats USING btree (player_id, season);

CREATE UNIQUE INDEX player_season_stats_player_season_id_unique_idx ON public.player_season_stats USING btree (player_id, season_id) WHERE (season_id IS NOT NULL);

CREATE INDEX player_season_stats_season_id_idx ON public.player_season_stats USING btree (season_id);

CREATE UNIQUE INDEX seasons_name_key ON public.seasons USING btree (name);

CREATE UNIQUE INDEX seasons_pkey ON public.seasons USING btree (id);

CREATE UNIQUE INDEX seasons_single_current_idx ON public.seasons USING btree (is_current) WHERE (is_current = true);

CREATE INDEX user_feedback_created_at_idx ON public.user_feedback USING btree (created_at DESC);

CREATE INDEX user_feedback_user_id_created_at_idx ON public.user_feedback USING btree (user_id, created_at DESC);

alter table "public"."player_comments" add constraint "player_comments_pkey" PRIMARY KEY using index "player_comments_pkey";

alter table "public"."player_comparisons" add constraint "player_comparisons_pkey" PRIMARY KEY using index "player_comparisons_pkey";

alter table "public"."player_season_stats" add constraint "player_season_stats_pkey" PRIMARY KEY using index "player_season_stats_pkey";

alter table "public"."seasons" add constraint "seasons_pkey" PRIMARY KEY using index "seasons_pkey";

alter table "public"."player_comments" add constraint "player_comments_content_check" CHECK ((char_length(content) <= 500)) not valid;

alter table "public"."player_comments" validate constraint "player_comments_content_check";

alter table "public"."player_comments" add constraint "player_comments_player_id_fkey" FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE not valid;

alter table "public"."player_comments" validate constraint "player_comments_player_id_fkey";

alter table "public"."player_comments" add constraint "player_comments_public_profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.public_profiles(id) ON DELETE CASCADE NOT VALID not valid;

alter table "public"."player_comments" validate constraint "player_comments_public_profiles_user_id_fkey";

alter table "public"."player_comments" add constraint "player_comments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) not valid;

alter table "public"."player_comments" validate constraint "player_comments_user_id_fkey";

alter table "public"."player_comparisons" add constraint "player_comparisons_check" CHECK ((player_a_id <> player_b_id)) not valid;

alter table "public"."player_comparisons" validate constraint "player_comparisons_check";

alter table "public"."player_comparisons" add constraint "player_comparisons_check1" CHECK ((winner_player_id <> loser_player_id)) not valid;

alter table "public"."player_comparisons" validate constraint "player_comparisons_check1";

alter table "public"."player_comparisons" add constraint "player_comparisons_check2" CHECK (((winner_player_id = player_a_id) OR (winner_player_id = player_b_id))) not valid;

alter table "public"."player_comparisons" validate constraint "player_comparisons_check2";

alter table "public"."player_comparisons" add constraint "player_comparisons_check3" CHECK (((loser_player_id = player_a_id) OR (loser_player_id = player_b_id))) not valid;

alter table "public"."player_comparisons" validate constraint "player_comparisons_check3";

alter table "public"."player_comparisons" add constraint "player_comparisons_loser_player_id_fkey" FOREIGN KEY (loser_player_id) REFERENCES public.players(id) ON DELETE CASCADE not valid;

alter table "public"."player_comparisons" validate constraint "player_comparisons_loser_player_id_fkey";

alter table "public"."player_comparisons" add constraint "player_comparisons_player_a_id_fkey" FOREIGN KEY (player_a_id) REFERENCES public.players(id) ON DELETE CASCADE not valid;

alter table "public"."player_comparisons" validate constraint "player_comparisons_player_a_id_fkey";

alter table "public"."player_comparisons" add constraint "player_comparisons_player_b_id_fkey" FOREIGN KEY (player_b_id) REFERENCES public.players(id) ON DELETE CASCADE not valid;

alter table "public"."player_comparisons" validate constraint "player_comparisons_player_b_id_fkey";

alter table "public"."player_comparisons" add constraint "player_comparisons_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE not valid;

alter table "public"."player_comparisons" validate constraint "player_comparisons_user_id_fkey";

alter table "public"."player_comparisons" add constraint "player_comparisons_user_id_player_a_id_player_b_id_key" UNIQUE using index "player_comparisons_user_id_player_a_id_player_b_id_key";

alter table "public"."player_comparisons" add constraint "player_comparisons_winner_player_id_fkey" FOREIGN KEY (winner_player_id) REFERENCES public.players(id) ON DELETE CASCADE not valid;

alter table "public"."player_comparisons" validate constraint "player_comparisons_winner_player_id_fkey";

alter table "public"."player_season_stats" add constraint "player_season_stats_appearances_check" CHECK ((appearances >= 0)) not valid;

alter table "public"."player_season_stats" validate constraint "player_season_stats_appearances_check";

alter table "public"."player_season_stats" add constraint "player_season_stats_assists_check" CHECK ((assists >= 0)) not valid;

alter table "public"."player_season_stats" validate constraint "player_season_stats_assists_check";

alter table "public"."player_season_stats" add constraint "player_season_stats_goals_check" CHECK ((goals >= 0)) not valid;

alter table "public"."player_season_stats" validate constraint "player_season_stats_goals_check";

alter table "public"."player_season_stats" add constraint "player_season_stats_player_id_fkey" FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE not valid;

alter table "public"."player_season_stats" validate constraint "player_season_stats_player_id_fkey";

alter table "public"."player_season_stats" add constraint "player_season_stats_player_id_season_key" UNIQUE using index "player_season_stats_player_id_season_key";

alter table "public"."player_season_stats" add constraint "player_season_stats_season_id_fkey" FOREIGN KEY (season_id) REFERENCES public.seasons(id) not valid;

alter table "public"."player_season_stats" validate constraint "player_season_stats_season_id_fkey";

alter table "public"."seasons" add constraint "seasons_name_key" UNIQUE using index "seasons_name_key";

alter table "public"."user_feedback" add constraint "user_feedback_content_check" CHECK ((char_length(content) <= 500)) not valid;

alter table "public"."user_feedback" validate constraint "user_feedback_content_check";

alter table "public"."user_feedback" add constraint "user_feedback_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) not valid;

alter table "public"."user_feedback" validate constraint "user_feedback_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.set_posts_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.apply_player_pick_one_week(target_week_end_at timestamp with time zone DEFAULT now())
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  kst_offset interval := interval '9 hours';
  target_week_end timestamptz;
  target_week_start timestamptz;
  current_run_id uuid;
  run_status text;
  choice_record record;
  winner_rating numeric;
  loser_rating numeric;
  winner_previous numeric;
  loser_previous numeric;
  expected numeric;
  delta numeric;
  revalidate_endpoint_url text;
  revalidate_secret text;
BEGIN
  target_week_end := (
    date_trunc('week', target_week_end_at + kst_offset + interval '1 day')
    - interval '1 day'
    - kst_offset
  );
  target_week_start := target_week_end - interval '7 days';

  INSERT INTO public.player_pick_one_weekly_runs (week_start_at, week_end_at)
  VALUES (target_week_start, target_week_end)
  ON CONFLICT (week_start_at) DO NOTHING
  RETURNING id INTO current_run_id;

  IF current_run_id IS NULL THEN
    SELECT id, status INTO current_run_id, run_status
    FROM public.player_pick_one_weekly_runs
    WHERE week_start_at = target_week_start
      AND week_end_at = target_week_end;

    IF run_status = 'applied' THEN
      RETURN current_run_id;
    END IF;

    DELETE FROM public.player_pick_one_rating_changes
    WHERE player_pick_one_rating_changes.run_id = current_run_id;

    UPDATE public.player_pick_one_weekly_runs
    SET status = 'running',
        error_message = NULL,
        applied_at = NULL
    WHERE id = current_run_id;
  END IF;

  BEGIN
  FOR choice_record IN
    SELECT winner_player_id, loser_player_id
    FROM public.player_pick_one_choices
    WHERE created_at >= target_week_start
      AND created_at < target_week_end
    ORDER BY created_at, id
  LOOP
    INSERT INTO public.player_pick_one_ratings (player_id, rating)
    SELECT choice_record.winner_player_id, players.base_rating
    FROM public.players
    WHERE players.id = choice_record.winner_player_id
    ON CONFLICT (player_id) DO NOTHING;

    INSERT INTO public.player_pick_one_ratings (player_id, rating)
    SELECT choice_record.loser_player_id, players.base_rating
    FROM public.players
    WHERE players.id = choice_record.loser_player_id
    ON CONFLICT (player_id) DO NOTHING;

    SELECT rating INTO winner_rating
    FROM public.player_pick_one_ratings
    WHERE player_id = choice_record.winner_player_id
    FOR UPDATE;

    SELECT rating INTO loser_rating
    FROM public.player_pick_one_ratings
    WHERE player_id = choice_record.loser_player_id
    FOR UPDATE;

    winner_previous := winner_rating;
    loser_previous := loser_rating;
    expected := 1 / (1 + power(10, (loser_rating - winner_rating) / 12));
    delta := 1.2 * (1 - expected);

    UPDATE public.player_pick_one_ratings
    SET rating = winner_rating + delta,
        wins = wins + 1,
        choice_count = choice_count + 1,
        updated_at = now()
    WHERE player_id = choice_record.winner_player_id;

    UPDATE public.player_pick_one_ratings
    SET rating = loser_rating - delta,
        losses = losses + 1,
        choice_count = choice_count + 1,
        updated_at = now()
    WHERE player_id = choice_record.loser_player_id;

    INSERT INTO public.player_pick_one_rating_changes (
      run_id,
      player_id,
      previous_rating,
      new_rating,
      previous_overall,
      new_overall,
      delta,
      wins,
      losses
    )
    VALUES (
      current_run_id,
      choice_record.winner_player_id,
      winner_previous,
      winner_rating + delta,
      public.pick_one_overall(winner_previous),
      public.pick_one_overall(winner_rating + delta),
      public.pick_one_overall(winner_rating + delta) - public.pick_one_overall(winner_previous),
      1,
      0
    )
    ON CONFLICT (run_id, player_id) DO UPDATE SET
      new_rating = EXCLUDED.new_rating,
      new_overall = EXCLUDED.new_overall,
      delta = EXCLUDED.new_overall - player_pick_one_rating_changes.previous_overall,
      wins = player_pick_one_rating_changes.wins + 1;

    INSERT INTO public.player_pick_one_rating_changes (
      run_id,
      player_id,
      previous_rating,
      new_rating,
      previous_overall,
      new_overall,
      delta,
      wins,
      losses
    )
    VALUES (
      current_run_id,
      choice_record.loser_player_id,
      loser_previous,
      loser_rating - delta,
      public.pick_one_overall(loser_previous),
      public.pick_one_overall(loser_rating - delta),
      public.pick_one_overall(loser_rating - delta) - public.pick_one_overall(loser_previous),
      0,
      1
    )
    ON CONFLICT (run_id, player_id) DO UPDATE SET
      new_rating = EXCLUDED.new_rating,
      new_overall = EXCLUDED.new_overall,
      delta = EXCLUDED.new_overall - player_pick_one_rating_changes.previous_overall,
      losses = player_pick_one_rating_changes.losses + 1;
  END LOOP;

  WITH capped_changes AS (
    SELECT
      player_id,
      least(player_pick_one_rating_changes.previous_rating + 2, greatest(player_pick_one_rating_changes.previous_rating - 2, new_rating)) AS capped_rating
    FROM public.player_pick_one_rating_changes
    WHERE run_id = current_run_id
  )
  UPDATE public.player_pick_one_rating_changes
  SET new_rating = capped_changes.capped_rating,
      new_overall = public.pick_one_overall(capped_rating),
      delta = public.pick_one_overall(capped_rating) - previous_overall
  FROM capped_changes
  WHERE player_pick_one_rating_changes.run_id = current_run_id
    AND player_pick_one_rating_changes.player_id = capped_changes.player_id;

  UPDATE public.player_pick_one_ratings
  SET rating = player_pick_one_rating_changes.new_rating,
      updated_at = now()
  FROM public.player_pick_one_rating_changes
  WHERE player_pick_one_rating_changes.run_id = current_run_id
    AND player_pick_one_ratings.player_id = player_pick_one_rating_changes.player_id;

  UPDATE public.player_pick_one_weekly_runs
  SET status = 'applied',
      applied_at = now()
  WHERE id = current_run_id;

  SELECT endpoint_url, secret
  INTO revalidate_endpoint_url, revalidate_secret
  FROM public.player_pick_one_revalidation_config
  WHERE id = true;

  IF revalidate_endpoint_url IS NOT NULL AND revalidate_secret IS NOT NULL THEN
    PERFORM net.http_post(
      url := revalidate_endpoint_url || '/api/revalidate',
      headers := jsonb_build_object('Authorization', 'Bearer ' || revalidate_secret),
      body := jsonb_build_object('runId', current_run_id)
    );
  END IF;
  EXCEPTION
    WHEN OTHERS THEN
      UPDATE public.player_pick_one_weekly_runs
      SET status = 'failed',
          error_message = SQLERRM,
          applied_at = now()
      WHERE id = current_run_id;
      RAISE;
  END;

  RETURN current_run_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.pick_one_overall(input_rating numeric)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT least(99, greatest(40, round(input_rating)::integer));
$function$
;

CREATE OR REPLACE FUNCTION public.sync_public_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.public_profiles (id, display_name, avatar_url, updated_at)
  VALUES (NEW.id, NEW.display_name, NEW.avatar_url, now())
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = now();
  RETURN NEW;
END;
$function$
;

grant delete on table "public"."comment_likes" to "anon";

grant insert on table "public"."comment_likes" to "anon";

grant select on table "public"."comment_likes" to "anon";

grant update on table "public"."comment_likes" to "anon";

grant delete on table "public"."comment_likes" to "authenticated";

grant insert on table "public"."comment_likes" to "authenticated";

grant select on table "public"."comment_likes" to "authenticated";

grant update on table "public"."comment_likes" to "authenticated";

grant delete on table "public"."comment_likes" to "service_role";

grant insert on table "public"."comment_likes" to "service_role";

grant select on table "public"."comment_likes" to "service_role";

grant update on table "public"."comment_likes" to "service_role";

grant delete on table "public"."comments" to "anon";

grant insert on table "public"."comments" to "anon";

grant select on table "public"."comments" to "anon";

grant update on table "public"."comments" to "anon";

grant delete on table "public"."comments" to "authenticated";

grant insert on table "public"."comments" to "authenticated";

grant select on table "public"."comments" to "authenticated";

grant update on table "public"."comments" to "authenticated";

grant delete on table "public"."comments" to "service_role";

grant insert on table "public"."comments" to "service_role";

grant select on table "public"."comments" to "service_role";

grant update on table "public"."comments" to "service_role";













grant delete on table "public"."player_comments" to "anon";

grant insert on table "public"."player_comments" to "anon";

grant references on table "public"."player_comments" to "anon";

grant select on table "public"."player_comments" to "anon";

grant trigger on table "public"."player_comments" to "anon";

grant truncate on table "public"."player_comments" to "anon";

grant update on table "public"."player_comments" to "anon";

grant delete on table "public"."player_comments" to "authenticated";

grant insert on table "public"."player_comments" to "authenticated";

grant references on table "public"."player_comments" to "authenticated";

grant select on table "public"."player_comments" to "authenticated";

grant trigger on table "public"."player_comments" to "authenticated";

grant truncate on table "public"."player_comments" to "authenticated";

grant update on table "public"."player_comments" to "authenticated";

grant delete on table "public"."player_comments" to "service_role";

grant insert on table "public"."player_comments" to "service_role";

grant references on table "public"."player_comments" to "service_role";

grant select on table "public"."player_comments" to "service_role";

grant trigger on table "public"."player_comments" to "service_role";

grant truncate on table "public"."player_comments" to "service_role";

grant update on table "public"."player_comments" to "service_role";

grant delete on table "public"."player_comparisons" to "anon";

grant insert on table "public"."player_comparisons" to "anon";

grant references on table "public"."player_comparisons" to "anon";

grant select on table "public"."player_comparisons" to "anon";

grant trigger on table "public"."player_comparisons" to "anon";

grant truncate on table "public"."player_comparisons" to "anon";

grant update on table "public"."player_comparisons" to "anon";

grant delete on table "public"."player_comparisons" to "authenticated";

grant insert on table "public"."player_comparisons" to "authenticated";

grant references on table "public"."player_comparisons" to "authenticated";

grant select on table "public"."player_comparisons" to "authenticated";

grant trigger on table "public"."player_comparisons" to "authenticated";

grant truncate on table "public"."player_comparisons" to "authenticated";

grant update on table "public"."player_comparisons" to "authenticated";

grant delete on table "public"."player_comparisons" to "service_role";

grant insert on table "public"."player_comparisons" to "service_role";

grant references on table "public"."player_comparisons" to "service_role";

grant select on table "public"."player_comparisons" to "service_role";

grant trigger on table "public"."player_comparisons" to "service_role";

grant truncate on table "public"."player_comparisons" to "service_role";

grant update on table "public"."player_comparisons" to "service_role";

grant delete on table "public"."player_pick_one_choices" to "anon";

grant insert on table "public"."player_pick_one_choices" to "anon";

grant select on table "public"."player_pick_one_choices" to "anon";

grant update on table "public"."player_pick_one_choices" to "anon";

grant delete on table "public"."player_pick_one_choices" to "authenticated";

grant insert on table "public"."player_pick_one_choices" to "authenticated";

grant select on table "public"."player_pick_one_choices" to "authenticated";

grant update on table "public"."player_pick_one_choices" to "authenticated";

grant delete on table "public"."player_pick_one_choices" to "service_role";

grant insert on table "public"."player_pick_one_choices" to "service_role";

grant select on table "public"."player_pick_one_choices" to "service_role";

grant update on table "public"."player_pick_one_choices" to "service_role";

grant delete on table "public"."player_pick_one_rating_changes" to "anon";

grant insert on table "public"."player_pick_one_rating_changes" to "anon";

grant select on table "public"."player_pick_one_rating_changes" to "anon";

grant update on table "public"."player_pick_one_rating_changes" to "anon";

grant delete on table "public"."player_pick_one_rating_changes" to "authenticated";

grant insert on table "public"."player_pick_one_rating_changes" to "authenticated";

grant select on table "public"."player_pick_one_rating_changes" to "authenticated";

grant update on table "public"."player_pick_one_rating_changes" to "authenticated";

grant delete on table "public"."player_pick_one_rating_changes" to "service_role";

grant insert on table "public"."player_pick_one_rating_changes" to "service_role";

grant select on table "public"."player_pick_one_rating_changes" to "service_role";

grant update on table "public"."player_pick_one_rating_changes" to "service_role";

grant delete on table "public"."player_pick_one_ratings" to "anon";

grant insert on table "public"."player_pick_one_ratings" to "anon";

grant select on table "public"."player_pick_one_ratings" to "anon";

grant update on table "public"."player_pick_one_ratings" to "anon";

grant delete on table "public"."player_pick_one_ratings" to "authenticated";

grant insert on table "public"."player_pick_one_ratings" to "authenticated";

grant select on table "public"."player_pick_one_ratings" to "authenticated";

grant update on table "public"."player_pick_one_ratings" to "authenticated";

grant delete on table "public"."player_pick_one_ratings" to "service_role";

grant insert on table "public"."player_pick_one_ratings" to "service_role";

grant select on table "public"."player_pick_one_ratings" to "service_role";

grant update on table "public"."player_pick_one_ratings" to "service_role";

grant delete on table "public"."player_pick_one_revalidation_config" to "anon";

grant insert on table "public"."player_pick_one_revalidation_config" to "anon";

grant select on table "public"."player_pick_one_revalidation_config" to "anon";

grant update on table "public"."player_pick_one_revalidation_config" to "anon";

grant delete on table "public"."player_pick_one_revalidation_config" to "authenticated";

grant insert on table "public"."player_pick_one_revalidation_config" to "authenticated";

grant select on table "public"."player_pick_one_revalidation_config" to "authenticated";

grant update on table "public"."player_pick_one_revalidation_config" to "authenticated";

grant delete on table "public"."player_pick_one_revalidation_config" to "service_role";

grant insert on table "public"."player_pick_one_revalidation_config" to "service_role";

grant select on table "public"."player_pick_one_revalidation_config" to "service_role";

grant update on table "public"."player_pick_one_revalidation_config" to "service_role";

grant delete on table "public"."player_pick_one_weekly_runs" to "anon";

grant insert on table "public"."player_pick_one_weekly_runs" to "anon";

grant select on table "public"."player_pick_one_weekly_runs" to "anon";

grant update on table "public"."player_pick_one_weekly_runs" to "anon";

grant delete on table "public"."player_pick_one_weekly_runs" to "authenticated";

grant insert on table "public"."player_pick_one_weekly_runs" to "authenticated";

grant select on table "public"."player_pick_one_weekly_runs" to "authenticated";

grant update on table "public"."player_pick_one_weekly_runs" to "authenticated";

grant delete on table "public"."player_pick_one_weekly_runs" to "service_role";

grant insert on table "public"."player_pick_one_weekly_runs" to "service_role";

grant select on table "public"."player_pick_one_weekly_runs" to "service_role";

grant update on table "public"."player_pick_one_weekly_runs" to "service_role";

grant delete on table "public"."player_season_stats" to "anon";

grant insert on table "public"."player_season_stats" to "anon";

grant references on table "public"."player_season_stats" to "anon";

grant select on table "public"."player_season_stats" to "anon";

grant trigger on table "public"."player_season_stats" to "anon";

grant truncate on table "public"."player_season_stats" to "anon";

grant update on table "public"."player_season_stats" to "anon";

grant delete on table "public"."player_season_stats" to "authenticated";

grant insert on table "public"."player_season_stats" to "authenticated";

grant references on table "public"."player_season_stats" to "authenticated";

grant select on table "public"."player_season_stats" to "authenticated";

grant trigger on table "public"."player_season_stats" to "authenticated";

grant truncate on table "public"."player_season_stats" to "authenticated";

grant update on table "public"."player_season_stats" to "authenticated";

grant delete on table "public"."player_season_stats" to "service_role";

grant insert on table "public"."player_season_stats" to "service_role";

grant references on table "public"."player_season_stats" to "service_role";

grant select on table "public"."player_season_stats" to "service_role";

grant trigger on table "public"."player_season_stats" to "service_role";

grant truncate on table "public"."player_season_stats" to "service_role";

grant update on table "public"."player_season_stats" to "service_role";

grant delete on table "public"."players" to "anon";

grant insert on table "public"."players" to "anon";

grant select on table "public"."players" to "anon";

grant update on table "public"."players" to "anon";

grant delete on table "public"."players" to "authenticated";

grant insert on table "public"."players" to "authenticated";

grant select on table "public"."players" to "authenticated";

grant update on table "public"."players" to "authenticated";

grant delete on table "public"."players" to "service_role";

grant insert on table "public"."players" to "service_role";

grant select on table "public"."players" to "service_role";

grant update on table "public"."players" to "service_role";

grant delete on table "public"."poll_options" to "anon";

grant insert on table "public"."poll_options" to "anon";

grant select on table "public"."poll_options" to "anon";

grant update on table "public"."poll_options" to "anon";

grant delete on table "public"."poll_options" to "authenticated";

grant insert on table "public"."poll_options" to "authenticated";

grant select on table "public"."poll_options" to "authenticated";

grant update on table "public"."poll_options" to "authenticated";

grant delete on table "public"."poll_options" to "service_role";

grant insert on table "public"."poll_options" to "service_role";

grant select on table "public"."poll_options" to "service_role";

grant update on table "public"."poll_options" to "service_role";

grant delete on table "public"."polls" to "anon";

grant insert on table "public"."polls" to "anon";

grant select on table "public"."polls" to "anon";

grant update on table "public"."polls" to "anon";

grant delete on table "public"."polls" to "authenticated";

grant insert on table "public"."polls" to "authenticated";

grant select on table "public"."polls" to "authenticated";

grant update on table "public"."polls" to "authenticated";

grant delete on table "public"."polls" to "service_role";

grant insert on table "public"."polls" to "service_role";

grant select on table "public"."polls" to "service_role";

grant update on table "public"."polls" to "service_role";

grant delete on table "public"."public_profiles" to "anon";

grant insert on table "public"."public_profiles" to "anon";

grant select on table "public"."public_profiles" to "anon";

grant update on table "public"."public_profiles" to "anon";

grant delete on table "public"."public_profiles" to "authenticated";

grant insert on table "public"."public_profiles" to "authenticated";

grant select on table "public"."public_profiles" to "authenticated";

grant update on table "public"."public_profiles" to "authenticated";

grant delete on table "public"."public_profiles" to "service_role";

grant insert on table "public"."public_profiles" to "service_role";

grant select on table "public"."public_profiles" to "service_role";

grant update on table "public"."public_profiles" to "service_role";

grant delete on table "public"."rating_vote_likes" to "anon";

grant insert on table "public"."rating_vote_likes" to "anon";

grant select on table "public"."rating_vote_likes" to "anon";

grant update on table "public"."rating_vote_likes" to "anon";

grant delete on table "public"."rating_vote_likes" to "authenticated";

grant insert on table "public"."rating_vote_likes" to "authenticated";

grant select on table "public"."rating_vote_likes" to "authenticated";

grant update on table "public"."rating_vote_likes" to "authenticated";

grant delete on table "public"."rating_vote_likes" to "service_role";

grant insert on table "public"."rating_vote_likes" to "service_role";

grant select on table "public"."rating_vote_likes" to "service_role";

grant update on table "public"."rating_vote_likes" to "service_role";

grant delete on table "public"."rating_votes" to "anon";

grant insert on table "public"."rating_votes" to "anon";

grant select on table "public"."rating_votes" to "anon";

grant update on table "public"."rating_votes" to "anon";

grant delete on table "public"."rating_votes" to "authenticated";

grant insert on table "public"."rating_votes" to "authenticated";

grant select on table "public"."rating_votes" to "authenticated";

grant update on table "public"."rating_votes" to "authenticated";

grant delete on table "public"."rating_votes" to "service_role";

grant insert on table "public"."rating_votes" to "service_role";

grant select on table "public"."rating_votes" to "service_role";

grant update on table "public"."rating_votes" to "service_role";

grant delete on table "public"."seasons" to "anon";

grant insert on table "public"."seasons" to "anon";

grant references on table "public"."seasons" to "anon";

grant select on table "public"."seasons" to "anon";

grant trigger on table "public"."seasons" to "anon";

grant truncate on table "public"."seasons" to "anon";

grant update on table "public"."seasons" to "anon";

grant delete on table "public"."seasons" to "authenticated";

grant insert on table "public"."seasons" to "authenticated";

grant references on table "public"."seasons" to "authenticated";

grant select on table "public"."seasons" to "authenticated";

grant trigger on table "public"."seasons" to "authenticated";

grant truncate on table "public"."seasons" to "authenticated";

grant update on table "public"."seasons" to "authenticated";

grant delete on table "public"."seasons" to "service_role";

grant insert on table "public"."seasons" to "service_role";

grant references on table "public"."seasons" to "service_role";

grant select on table "public"."seasons" to "service_role";

grant trigger on table "public"."seasons" to "service_role";

grant truncate on table "public"."seasons" to "service_role";

grant update on table "public"."seasons" to "service_role";

grant delete on table "public"."user_feedback" to "anon";

grant insert on table "public"."user_feedback" to "anon";

grant select on table "public"."user_feedback" to "anon";

grant update on table "public"."user_feedback" to "anon";

grant delete on table "public"."user_feedback" to "authenticated";

grant insert on table "public"."user_feedback" to "authenticated";

grant select on table "public"."user_feedback" to "authenticated";

grant update on table "public"."user_feedback" to "authenticated";

grant delete on table "public"."user_feedback" to "service_role";

grant insert on table "public"."user_feedback" to "service_role";

grant select on table "public"."user_feedback" to "service_role";

grant update on table "public"."user_feedback" to "service_role";

grant delete on table "public"."users" to "anon";

grant insert on table "public"."users" to "anon";

grant select on table "public"."users" to "anon";

grant update on table "public"."users" to "anon";

grant delete on table "public"."users" to "authenticated";

grant insert on table "public"."users" to "authenticated";

grant select on table "public"."users" to "authenticated";

grant update on table "public"."users" to "authenticated";

grant delete on table "public"."users" to "service_role";

grant insert on table "public"."users" to "service_role";

grant select on table "public"."users" to "service_role";

grant update on table "public"."users" to "service_role";

grant delete on table "public"."votes" to "anon";

grant insert on table "public"."votes" to "anon";

grant select on table "public"."votes" to "anon";

grant update on table "public"."votes" to "anon";

grant delete on table "public"."votes" to "authenticated";

grant insert on table "public"."votes" to "authenticated";

grant select on table "public"."votes" to "authenticated";

grant update on table "public"."votes" to "authenticated";

grant delete on table "public"."votes" to "service_role";

grant insert on table "public"."votes" to "service_role";

grant select on table "public"."votes" to "service_role";

grant update on table "public"."votes" to "service_role";


  create policy "player_comments_insert_authenticated"
  on "public"."player_comments"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "player_comments_public_read"
  on "public"."player_comments"
  as permissive
  for select
  to public
using ((is_hidden = false));



  create policy "player_comparisons: insert authenticated"
  on "public"."player_comparisons"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "player_comparisons: public read"
  on "public"."player_comparisons"
  as permissive
  for select
  to public
using (true);



  create policy "player_season_stats_admin_write"
  on "public"."player_season_stats"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "player_season_stats_public_read"
  on "public"."player_season_stats"
  as permissive
  for select
  to public
using (true);



  create policy "seasons: admin write"
  on "public"."seasons"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "seasons: public read"
  on "public"."seasons"
  as permissive
  for select
  to public
using (true);



  create policy "users: insert own row"
  on "public"."users"
  as permissive
  for insert
  to public
with check ((auth.uid() = id));



  create policy "users: public read profile"
  on "public"."users"
  as permissive
  for select
  to public
using ((deleted_at IS NULL));



  create policy "votes: public read"
  on "public"."votes"
  as permissive
  for select
  to public
using (true);



