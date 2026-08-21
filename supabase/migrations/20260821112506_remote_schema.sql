alter table "public"."player_comments" drop constraint "player_comments_public_profiles_user_id_fkey";

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

grant delete on table "public"."season_squads" to "anon";

grant insert on table "public"."season_squads" to "anon";

grant select on table "public"."season_squads" to "anon";

grant update on table "public"."season_squads" to "anon";

grant delete on table "public"."season_squads" to "authenticated";

grant insert on table "public"."season_squads" to "authenticated";

grant select on table "public"."season_squads" to "authenticated";

grant update on table "public"."season_squads" to "authenticated";

grant delete on table "public"."season_squads" to "service_role";

grant insert on table "public"."season_squads" to "service_role";

grant select on table "public"."season_squads" to "service_role";

grant update on table "public"."season_squads" to "service_role";


