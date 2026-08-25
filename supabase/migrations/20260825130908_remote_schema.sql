drop policy "predictions: insert own while week open" on "public"."predictions";

alter table "public"."player_comments" drop constraint "player_comments_public_profiles_user_id_fkey";

alter table "public"."fixtures" add column "ai_hint" text;

alter table "public"."player_comments" add constraint "player_comments_public_profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.public_profiles(id) ON DELETE CASCADE NOT VALID not valid;

alter table "public"."player_comments" validate constraint "player_comments_public_profiles_user_id_fkey";

grant delete on table "public"."fixture_player_ratings" to "anon";

grant insert on table "public"."fixture_player_ratings" to "anon";

grant select on table "public"."fixture_player_ratings" to "anon";

grant update on table "public"."fixture_player_ratings" to "anon";

grant delete on table "public"."fixture_player_ratings" to "authenticated";

grant insert on table "public"."fixture_player_ratings" to "authenticated";

grant select on table "public"."fixture_player_ratings" to "authenticated";

grant update on table "public"."fixture_player_ratings" to "authenticated";

grant delete on table "public"."fixture_player_ratings" to "service_role";

grant insert on table "public"."fixture_player_ratings" to "service_role";

grant select on table "public"."fixture_player_ratings" to "service_role";

grant update on table "public"."fixture_player_ratings" to "service_role";

grant delete on table "public"."predictions" to "anon";

grant insert on table "public"."predictions" to "anon";

grant select on table "public"."predictions" to "anon";

grant update on table "public"."predictions" to "anon";

grant delete on table "public"."predictions" to "authenticated";

grant insert on table "public"."predictions" to "authenticated";

grant select on table "public"."predictions" to "authenticated";

grant update on table "public"."predictions" to "authenticated";

grant delete on table "public"."predictions" to "service_role";

grant insert on table "public"."predictions" to "service_role";

grant select on table "public"."predictions" to "service_role";

grant update on table "public"."predictions" to "service_role";


  create policy "predictions: insert own while week open"
  on "public"."predictions"
  as permissive
  for insert
  to authenticated
with check (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.fixtures f
  WHERE ((f.fixture_id = predictions.fixture_id) AND (f.cancelled = false) AND (f.started = false)))) AND (public.prediction_week_first_kickoff(fixture_id) > now()) AND (public.prediction_week_first_kickoff(fixture_id) < (now() + '7 days'::interval))));



