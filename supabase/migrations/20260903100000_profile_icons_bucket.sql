insert into storage.buckets (id, name, public)
values ('profile-icons', 'profile-icons', true)
on conflict (id) do update set public = true;
