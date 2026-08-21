alter table "public"."player_comments" drop constraint "player_comments_public_profiles_user_id_fkey";

alter table "public"."player_comments" add constraint "player_comments_public_profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.public_profiles(id) ON DELETE CASCADE NOT VALID not valid;

alter table "public"."player_comments" validate constraint "player_comments_public_profiles_user_id_fkey";


