const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const jsonResponse = (body: unknown, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { 'content-type': 'application/json' } },
);

const rpc = async (name: string, body: Record<string, unknown>) => {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey!,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const responseBody = await response.text();
  if (!response.ok) {
    throw new Error(`${name} failed (${response.status}): ${responseBody.slice(0, 500)}`);
  }
  return responseBody ? JSON.parse(responseBody) : null;
};

const removeStorageObject = async (path: string) => {
  const response = await fetch(`${supabaseUrl}/storage/v1/object/uploads`, {
    method: 'DELETE',
    headers: {
      apikey: serviceRoleKey!,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ prefixes: [path] }),
  });
  const responseBody = await response.text();
  if (!response.ok) {
    throw new Error(`Storage removal failed (${response.status}): ${responseBody.slice(0, 500)}`);
  }
};

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Storage cleanup worker is missing its Supabase service configuration.');
    return jsonResponse({ error: 'Worker configuration is incomplete.' }, 500);
  }
  if (request.headers.get('authorization') !== `Bearer ${serviceRoleKey}`) {
    return jsonResponse({ error: 'Service authorization required.' }, 401);
  }

  try {
    const jobs = await rpc('claim_storage_cleanup_jobs', { p_limit: 50 });
    let completed = 0;
    let retried = 0;

    for (const job of jobs || []) {
      try {
        const safety = await rpc('storage_cleanup_job_is_safe_for_worker', {
          p_job_id: job.job_id,
          p_user_id: job.user_id,
          p_lease_token: job.lease_token,
        });
        if (safety?.status !== 'safe') {
          if (safety?.status === 'missing_or_unleased') continue;
          throw new Error(`Cleanup job ${job.job_id} is ${safety?.status || 'invalid'}.`);
        }

        if (job.storage_path) await removeStorageObject(job.storage_path);

        const acknowledged = await rpc('finish_storage_cleanup_job', {
          p_job_id: job.job_id,
          p_user_id: job.user_id,
          p_lease_token: job.lease_token,
          p_error: null,
        });
        if (acknowledged !== true) {
          throw new Error(`Cleanup job ${job.job_id} lease expired before acknowledgement.`);
        }
        completed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Storage cleanup failed.';
        console.error(`Storage cleanup job ${job.job_id} failed:`, message);
        try {
          const recorded = await rpc('finish_storage_cleanup_job', {
            p_job_id: job.job_id,
            p_user_id: job.user_id,
            p_lease_token: job.lease_token,
            p_error: message,
          });
          if (recorded === true) retried += 1;
        } catch (recordError) {
          console.error(`Could not record retry for cleanup job ${job.job_id}:`, recordError);
        }
      }
    }

    return jsonResponse({ claimed: jobs?.length || 0, completed, retried });
  } catch (error) {
    console.error('Storage cleanup worker failed to claim jobs:', error);
    return jsonResponse({ error: 'Unable to process Storage cleanup jobs.' }, 500);
  }
});
