-- Private user-scoped attachment storage. Tasks retain only the object path;
-- browser clients request short-lived signed URLs when rendering a preview.
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict (id) do update set public = false;

drop policy if exists "uploads_select_own" on storage.objects;
create policy "uploads_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'uploads'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "uploads_insert_own" on storage.objects;
create policy "uploads_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'uploads'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "uploads_update_own" on storage.objects;
create policy "uploads_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'uploads'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'uploads'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "uploads_delete_own" on storage.objects;
create policy "uploads_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'uploads'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
