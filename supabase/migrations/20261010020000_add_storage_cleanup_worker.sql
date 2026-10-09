create extension if not exists pg_cron;
create extension if not exists pg_net;

alter table app_private.storage_cleanup_jobs
  add column if not exists status text not null default 'pending',
  add column if not exists next_attempt_at timestamptz not null default timezone('utc', now()),
  add column if not exists lease_token uuid,
  add column if not exists lease_expires_at timestamptz;

alter table app_private.storage_cleanup_jobs
  drop constraint if exists storage_cleanup_jobs_status_check;
alter table app_private.storage_cleanup_jobs
  add constraint storage_cleanup_jobs_status_check
  check (status in ('pending', 'processing'));

create index if not exists storage_cleanup_jobs_ready_idx
  on app_private.storage_cleanup_jobs (next_attempt_at, created_at, job_id)
  where status = 'pending';

create or replace function public.claim_storage_cleanup_jobs(p_limit integer default 50)
returns table (
  job_id bigint,
  user_id uuid,
  storage_path text,
  local_storage_key text,
  lease_token uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, auth
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Cleanup batch size must be between 1 and 100'
      using errcode = '22023';
  end if;

  return query
  with selected as (
    select job.job_id
      from app_private.storage_cleanup_jobs job
     where (
       (job.status = 'pending' and job.next_attempt_at <= timezone('utc', now()))
       or (job.status = 'processing' and job.lease_expires_at <= timezone('utc', now()))
     )
     order by job.next_attempt_at, job.created_at, job.job_id
     for update skip locked
     limit p_limit
  )
  update app_private.storage_cleanup_jobs job
     set status = 'processing',
         attempts = job.attempts + 1,
         lease_token = gen_random_uuid(),
         lease_expires_at = timezone('utc', now()) + interval '5 minutes'
    from selected
   where job.job_id = selected.job_id
  returning job.job_id, job.user_id, job.storage_path, job.local_storage_key, job.lease_token;
end;
$$;

create or replace function public.storage_cleanup_job_is_safe_for_worker(
  p_job_id bigint,
  p_user_id uuid,
  p_lease_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, auth
as $$
declare
  v_job app_private.storage_cleanup_jobs%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  select * into v_job
    from app_private.storage_cleanup_jobs job
   where job.job_id = p_job_id
     and job.user_id = p_user_id
     and job.status = 'processing'
     and job.lease_token = p_lease_token
     and job.lease_expires_at > timezone('utc', now())
   for update;
  if not found then
    return jsonb_build_object('status', 'missing_or_unleased');
  end if;
  if v_job.storage_path is not null then
    if left(v_job.storage_path, length(p_user_id::text) + 1) <> p_user_id::text || '/'
       or split_part(v_job.storage_path, '/', 2) !~ '^[0-9]+$'
       or not exists (
         select 1 from app_private.retired_upload_paths retired
          where retired.user_id = p_user_id
            and retired.storage_path = v_job.storage_path
       ) then
      return jsonb_build_object('status', 'unsafe');
    end if;
    perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || v_job.storage_path, 0));
    if exists (
      select 1 from public.todos todo
       where todo.user_id = p_user_id
         and not todo.is_deleted
         and todo.payload->>'uploadedFileStoragePath' = v_job.storage_path
    ) then
      return jsonb_build_object('status', 'still_referenced');
    end if;
  end if;
  if v_job.local_storage_key is not null then
    if left(v_job.local_storage_key, length('upload:' || p_user_id::text || ':'))
       <> 'upload:' || p_user_id::text || ':' then
      return jsonb_build_object('status', 'unsafe');
    end if;
    if exists (
      select 1 from public.todos todo
       where todo.user_id = p_user_id
         and not todo.is_deleted
         and todo.payload->>'uploadedFileStorageKey' = v_job.local_storage_key
    ) then
      return jsonb_build_object('status', 'still_referenced');
    end if;
  end if;
  return jsonb_build_object('status', 'safe');
end;
$$;

create or replace function public.finish_storage_cleanup_job(
  p_job_id bigint,
  p_user_id uuid,
  p_lease_token uuid,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, app_private, auth
as $$
declare
  v_job app_private.storage_cleanup_jobs%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  select * into v_job
    from app_private.storage_cleanup_jobs job
   where job.job_id = p_job_id
     and job.user_id = p_user_id
     and job.status = 'processing'
     and job.lease_token = p_lease_token
     and job.lease_expires_at > timezone('utc', now())
   for update;
  if not found then
    return false;
  end if;

  if p_error is null then
    delete from app_private.storage_cleanup_jobs where job_id = p_job_id;
  else
    update app_private.storage_cleanup_jobs
       set status = 'pending',
           next_attempt_at = timezone('utc', now())
             + make_interval(secs => least(86400, (30 * power(2, least(v_job.attempts, 11)))::integer)),
           lease_token = null,
           lease_expires_at = null,
           last_error = left(coalesce(nullif(p_error, ''), 'Storage cleanup failed'), 500)
     where job_id = p_job_id;
  end if;
  return true;
end;
$$;

create or replace function app_private.invoke_storage_cleanup_worker()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, app_private, vault, net
as $$
declare
  v_url text;
  v_service_key text;
  v_request_id bigint;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets
   where name = 'storage_cleanup_worker_url';
  select decrypted_secret into v_service_key
    from vault.decrypted_secrets
   where name = 'storage_cleanup_worker_service_role_key';
  if v_url is null or v_service_key is null then
    raise warning 'Storage cleanup worker is not configured in Supabase Vault.';
    return null;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'apikey', v_service_key,
      'authorization', 'Bearer ' || v_service_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  ) into v_request_id;
  return v_request_id;
end;
$$;

create or replace function app_private.configure_storage_cleanup_schedule(
  p_worker_url text,
  p_service_role_key text
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, app_private, vault, cron
as $$
declare
  v_job_id bigint;
  v_secret_id uuid;
begin
  if session_user <> 'postgres' then
    raise exception 'Only the database postgres role can configure the cleanup schedule'
      using errcode = '42501';
  end if;
  if p_worker_url !~ '^https://[^[:space:]]+/functions/v1/storage-cleanup-worker$'
     and p_worker_url !~ '^http://(kong:8000|edge_runtime:8082)/functions/v1/storage-cleanup-worker$' then
    raise exception 'Worker URL must be HTTPS, or the local Supabase Kong endpoint'
      using errcode = '22023';
  end if;
  if nullif(p_service_role_key, '') is null then
    raise exception 'A service role key is required' using errcode = '22023';
  end if;

  select id into v_secret_id from vault.secrets
   where name = 'storage_cleanup_worker_url';
  if v_secret_id is null then
    perform vault.create_secret(p_worker_url, 'storage_cleanup_worker_url', 'Storage cleanup Edge Function URL');
  else
    perform vault.update_secret(v_secret_id, p_worker_url, 'storage_cleanup_worker_url', 'Storage cleanup Edge Function URL');
  end if;

  select id into v_secret_id from vault.secrets
   where name = 'storage_cleanup_worker_service_role_key';
  if v_secret_id is null then
    perform vault.create_secret(p_service_role_key, 'storage_cleanup_worker_service_role_key', 'Service key for the Storage cleanup Edge Function');
  else
    perform vault.update_secret(v_secret_id, p_service_role_key, 'storage_cleanup_worker_service_role_key', 'Service key for the Storage cleanup Edge Function');
  end if;

  perform cron.unschedule(jobid) from cron.job
   where jobname = 'into-day-storage-cleanup-worker';
  select cron.schedule(
    'into-day-storage-cleanup-worker',
    '* * * * *',
    'select app_private.invoke_storage_cleanup_worker();'
  ) into v_job_id;
  return v_job_id;
end;
$$;

revoke all on function public.claim_storage_cleanup_jobs(integer) from public, anon, authenticated;
revoke all on function public.storage_cleanup_job_is_safe_for_worker(bigint, uuid, uuid) from public, anon, authenticated;
revoke all on function public.finish_storage_cleanup_job(bigint, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.ack_storage_cleanup_job(bigint) from public, anon, authenticated;
revoke all on function public.fail_storage_cleanup_job(bigint, text) from public, anon, authenticated;
revoke all on function app_private.invoke_storage_cleanup_worker() from public, anon, authenticated, service_role;
revoke all on function app_private.configure_storage_cleanup_schedule(text, text) from public, anon, authenticated, service_role;

grant execute on function public.claim_storage_cleanup_jobs(integer) to service_role;
grant execute on function public.storage_cleanup_job_is_safe_for_worker(bigint, uuid, uuid) to service_role;
grant execute on function public.finish_storage_cleanup_job(bigint, uuid, uuid, text) to service_role;

comment on table app_private.storage_cleanup_jobs is
  'Retryable Storage cleanup outbox. A service-role Edge Function claims leased jobs, validates ownership and references, removes objects idempotently, and acknowledges or reschedules failures.';
