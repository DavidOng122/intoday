# Storage cleanup worker

This Edge Function consumes `app_private.storage_cleanup_jobs` independently of browser sessions. It requires the Supabase Edge Runtime's `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` secrets and accepts requests only when the bearer token exactly matches that service key. Keep JWT verification enabled.

The lifecycle migration installs the PostgreSQL lease, ownership-check, retry, and scheduling RPCs. After deploying the function and migration, configure the scheduler once as the database `postgres` role:

```sql
select app_private.configure_storage_cleanup_schedule(
  'https://<project-ref>.supabase.co/functions/v1/storage-cleanup-worker',
  '<service-role-key>'
);
```

The service key is stored in Supabase Vault; the scheduled `pg_cron` job calls the function every minute through `pg_net`. Run the configuration call through the approved secure database-admin channel, and do not save the service key in source control or shared query logs. Never use production project values in local tests.
