import { Container } from '@cloudflare/containers';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { imageHeader, MAX_INPUT_BYTES, MAX_OUTPUT_BYTES, MAX_PIXELS, parseOptions, type Job, type Options } from '../shared/conversion';

export class ImageEngine extends Container {
  defaultPort = 8080;
  sleepAfter = '30s';
  enableInternet = false;
}
export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  JOBS: Queue<{ id: string }>;
  ENGINE: DurableObjectNamespace<ImageEngine>;
  ASSETS: Fetcher;
  APP_ENV: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  LOCAL_ENGINE_URL?: string;
}
type RecordJob = Job & Options & {
  owner: string; created_at: number; idempotency_key: string;
  lease_token: string | null; lease_until: number | null; attempts: number;
};
class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const DAY = 86_400_000;
const allowedId = /^[0-9a-f-]{36}$/;
const publicColumns = 'id,state,format,input_bytes,output_bytes,output_width,output_height,error,expires_at';
const inputKey = (id: string) => `jobs/${id}/input`;
const outputKey = (id: string, token: string) => `jobs/${id}/outputs/${token}`;
const json = (value: unknown, status = 200, headers: HeadersInit = {}) => Response.json(value, { status, headers });

function isLocal(request: Request, env: Env) {
  return env.APP_ENV === 'development' && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname);
}
async function digest(value: string) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map((n) => n.toString(16).padStart(2, '0')).join('');
}
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
function capabilities(request: Request, env: Env) {
  return json({
    inputs: ['image/png', 'image/jpeg'], outputs: ['jpeg', 'png', 'webp'],
    maxInputBytes: MAX_INPUT_BYTES, maxPixels: MAX_PIXELS, retentionHours: 24,
    serverAuth: isLocal(request, env) ? 'local' : env.ACCESS_AUD && env.ACCESS_TEAM_DOMAIN ? 'access' : 'unconfigured',
  });
}
async function owner(request: Request, env: Env): Promise<string> {
  if (isLocal(request, env)) {
    const cookie = request.headers.get('cookie')?.match(/(?:^|;\s*)mce_session=([a-f0-9]{64})(?:;|$)/)?.[1];
    if (!cookie) throw new ApiError(401, 'Yerel oturumu başlatın.');
    return digest(cookie);
  }
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN)) {
    throw new ApiError(503, 'Sunucu dönüşümleri hesap erişimi yapılandırılınca açılacak. Cihazda dönüştürmeyi kullanabilirsiniz.');
  }
  const assertion = request.headers.get('cf-access-jwt-assertion');
  if (!assertion) throw new ApiError(401, 'Sunucu dönüşümü için oturum açın.');
  const issuer = `https://${env.ACCESS_TEAM_DOMAIN}`;
  let jwks = jwksCache.get(issuer);
  if (!jwks) { jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`)); jwksCache.set(issuer, jwks); }
  try {
    const { payload } = await jwtVerify(assertion, jwks, { issuer, audience: env.ACCESS_AUD, algorithms: ['RS256'] });
    if (!payload.sub || !payload.exp) throw new Error('Missing identity claims');
    return digest(`${issuer}:${payload.sub}`);
  } catch { throw new ApiError(401, 'Oturum doğrulanamadı.'); }
}

export async function readLimited(body: ReadableStream<Uint8Array> | null, maximum: number) {
  if (!body) throw new ApiError(400, 'Dosya bulunamadı.');
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) { await reader.cancel(); throw new ApiError(413, 'Dosya boyutu sınırı aşıldı.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

async function lookup(env: Env, id: string, user: string) {
  if (!allowedId.test(id)) throw new ApiError(404, 'İş bulunamadı.');
  const job = await env.DB.prepare(`SELECT ${publicColumns} FROM jobs WHERE id=? AND owner=?`).bind(id, user).first<Job>();
  if (!job) throw new ApiError(404, 'İş bulunamadı.');
  if (job.expires_at <= Date.now() || job.state === 'expired' || job.state === 'deleted') {
    throw new ApiError(410, 'Dosyanın saklama süresi dolmuş veya dosya silinmiş.');
  }
  return job;
}

async function api(request: Request, env: Env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!['GET', 'HEAD'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
      throw new ApiError(403, 'İstek kaynağı doğrulanamadı.');
    }
  }
  if (path === '/api/health' && request.method === 'GET') return json({ ok: true, version: '0.1.0' });
  if (path === '/api/capabilities' && request.method === 'GET') return capabilities(request, env);
  if (path === '/api/login' && request.method === 'GET') { await owner(request, env); return Response.redirect(url.origin + '/', 303); }
  if (path === '/api/session' && request.method === 'POST') {
    if (!isLocal(request, env)) { await owner(request, env); return json({ authenticated: true }); }
    try { await owner(request, env); return json({ authenticated: true }); } catch { /* Issue a new local-only session. */ }
    const token = [...crypto.getRandomValues(new Uint8Array(32))].map((n) => n.toString(16).padStart(2, '0')).join('');
    return json({ authenticated: true }, 200, { 'Set-Cookie': `mce_session=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=86400` });
  }
  const user = await owner(request, env);
  if (path === '/api/jobs' && request.method === 'POST') {
    let options: Options;
    try { options = parseOptions(url.searchParams); } catch (error) { throw new ApiError(400, (error as Error).message); }
    const key = request.headers.get('Idempotency-Key');
    if (!key || !allowedId.test(key)) throw new ApiError(400, 'Geçerli bir işlem anahtarı gerekiyor.');
    const previous = await env.DB.prepare(`SELECT ${publicColumns} FROM jobs WHERE owner=? AND idempotency_key=?`).bind(user, key).first<Job>();
    if (previous) return json(previous, 200);
    const bytes = await readLimited(request.body, MAX_INPUT_BYTES);
    let header;
    try { header = imageHeader(bytes); } catch (error) { throw new ApiError(422, (error as Error).message); }
    const id = crypto.randomUUID();
    const now = Date.now();
    const startOfDay = Math.floor(now / DAY) * DAY;
    const inserted = await env.DB.prepare(`INSERT INTO jobs
      (id,owner,idempotency_key,state,format,quality,width,input_bytes,created_at,expires_at)
      SELECT ?,?,?,'uploading',?,?,?,?,?,? WHERE
      (SELECT COUNT(*) FROM jobs WHERE owner=? AND created_at>=? AND state!='failed') < 5
      AND (SELECT COUNT(*) FROM jobs WHERE owner=? AND created_at>=?) < 20
      ON CONFLICT(owner,idempotency_key) DO NOTHING`)
      .bind(id, user, key, options.format, options.quality, options.width, bytes.length, now, now + DAY, user, startOfDay, user, startOfDay).run();
    if (!inserted.meta.changes) {
      const raced = await env.DB.prepare(`SELECT ${publicColumns} FROM jobs WHERE owner=? AND idempotency_key=?`).bind(user, key).first<Job>();
      if (raced) return json(raced);
      throw new ApiError(429, 'Günlük ücretsiz sunucu kotasına ulaştınız. Cihazda dönüştürmeye devam edebilirsiniz.');
    }
    try {
      await env.FILES.put(inputKey(id), bytes, { httpMetadata: { contentType: header.mime } });
      await env.DB.prepare("UPDATE jobs SET state='queued' WHERE id=? AND state='uploading'").bind(id).run();
    } catch {
      await env.DB.prepare("UPDATE jobs SET state='failed',error='upload_failed' WHERE id=?").bind(id).run();
      await env.FILES.delete(inputKey(id));
      throw new ApiError(503, 'Yükleme tamamlanamadı.');
    }
    try {
      await env.JOBS.send({ id });
      await env.DB.prepare('UPDATE jobs SET queue_sent_at=? WHERE id=?').bind(Date.now(), id).run();
    } catch { /* The scheduled outbox recovery publishes this queued job. */ }
    return json(await lookup(env, id, user), 202);
  }
  const match = path.match(/^\/api\/jobs\/([^/]+)(\/download)?$/);
  if (!match) throw new ApiError(404, 'İşlem bulunamadı.');
  if (request.method === 'DELETE' && !match[2]) {
    if (!allowedId.test(match[1])) throw new ApiError(404, 'İş bulunamadı.');
    const job = await env.DB.prepare('SELECT id FROM jobs WHERE id=? AND owner=?').bind(match[1], user).first<{ id: string }>();
    if (!job) throw new ApiError(404, 'İş bulunamadı.');
    await env.DB.prepare("UPDATE jobs SET state='deleted',lease_token=NULL,lease_until=NULL WHERE id=? AND owner=?").bind(job.id, user).run();
    await deleteFiles(env, job.id);
    return new Response(null, { status: 204 });
  }
  const job = await lookup(env, match[1], user);
  if (request.method === 'GET' && !match[2]) return json(job);
  if (request.method === 'GET' && match[2]) {
    if (job.state !== 'succeeded') throw new ApiError(409, 'Çıktı henüz hazır değil.');
    const stored = await env.DB.prepare('SELECT output_key FROM jobs WHERE id=? AND owner=?').bind(job.id, user).first<{ output_key: string }>();
    const object = stored?.output_key ? await env.FILES.get(stored.output_key) : null;
    if (!object) throw new ApiError(410, 'Çıktı artık mevcut değil.');
    return new Response(object.body, { headers: {
      'Content-Type': `image/${job.format}`, 'Content-Length': String(object.size),
      'Content-Disposition': `attachment; filename="converter-mce.${job.format === 'jpeg' ? 'jpg' : job.format}"`,
    } });
  }
  throw new ApiError(405, 'Bu yöntem desteklenmiyor.');
}

export async function processJob(env: Env, id: string) {
  const now = Date.now();
  const token = crypto.randomUUID();
  const job = await env.DB.prepare(`UPDATE jobs SET state='processing',lease_token=?,lease_until=?,attempts=attempts+1
    WHERE id=? AND expires_at>? AND attempts<3 AND (state='queued' OR (state='processing' AND lease_until<?)) RETURNING *`)
    .bind(token, now + 120_000, id, now, now).first<RecordJob>();
  if (!job) return;
  try {
    const source = await env.FILES.get(inputKey(id));
    if (!source) throw new Error('input_missing');
    const params = new URLSearchParams({ format: job.format, quality: String(job.quality) });
    if (job.width) params.set('width', String(job.width));
    const shard = parseInt(id.slice(0, 8), 16) % 2;
    const localEngine = env.APP_ENV === 'development' && env.LOCAL_ENGINE_URL === 'http://127.0.0.1:8788';
    const engineRequest = new Request(`${localEngine ? env.LOCAL_ENGINE_URL : 'http://engine'}/convert?${params}`, {
      method: 'POST', body: source.body, headers: { 'Content-Length': String(source.size) }, signal: AbortSignal.timeout(60_000),
    });
    const response = localEngine ? await fetch(engineRequest) : await env.ENGINE.getByName(`image-${shard}`).fetch(engineRequest);
    if (!response.ok) throw new Error(response.status === 422 ? 'invalid_image' : 'engine_unavailable');
    const bytes = await readLimited(response.body, MAX_OUTPUT_BYTES);
    const width = Number(response.headers.get('X-Image-Width'));
    const height = Number(response.headers.get('X-Image-Height'));
    if (!bytes.length || response.headers.get('Content-Type') !== `image/${job.format}` || !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > MAX_PIXELS) {
      throw new Error('invalid_output');
    }
    const key = outputKey(id, token);
    await env.FILES.put(key, bytes, { httpMetadata: { contentType: `image/${job.format}` } });
    const updated = await env.DB.prepare(`UPDATE jobs SET state='succeeded',output_key=?,output_bytes=?,output_width=?,output_height=?,lease_token=NULL,lease_until=NULL
      WHERE id=? AND state='processing' AND lease_token=? AND expires_at>?`).bind(key, bytes.length, width, height, id, token, Date.now()).run();
    if (!updated.meta.changes) await env.FILES.delete(key);
  } catch (error) {
    const known = ['input_missing', 'invalid_image', 'invalid_output'];
    const reason = error instanceof Error && known.includes(error.message) ? error.message : 'processing_failed';
    const retry = reason === 'processing_failed' && job.attempts < 3;
    await env.DB.prepare('UPDATE jobs SET state=?,error=?,lease_token=NULL,lease_until=NULL WHERE id=? AND state=\'processing\' AND lease_token=?').bind(retry ? 'queued' : 'failed', retry ? null : reason, id, token).run();
    await env.FILES.delete(outputKey(id, token));
    if (retry) throw new Error('retry_processing');
  }
}

async function deleteFiles(env: Env, id: string) {
  let cursor: string | undefined;
  do {
    const listed = await env.FILES.list({ prefix: `jobs/${id}/`, cursor });
    if (listed.objects.length) await env.FILES.delete(listed.objects.map((object) => object.key));
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
}

export async function maintenance(env: Env) {
  const now = Date.now();
  const expired = await env.DB.prepare("SELECT id,expires_at FROM jobs WHERE (expires_at<=? AND state!='expired') OR state='deleted' LIMIT 100").bind(now).all<{ id: string; expires_at: number }>();
  for (const { id, expires_at } of expired.results) {
    await env.DB.prepare("UPDATE jobs SET state='deleted',lease_token=NULL,lease_until=NULL WHERE id=?").bind(id).run();
    await deleteFiles(env, id);
    if (expires_at <= now) await env.DB.prepare("UPDATE jobs SET state='expired' WHERE id=?").bind(id).run();
  }
  await env.DB.prepare("UPDATE jobs SET state='failed',error='upload_interrupted' WHERE state='uploading' AND created_at<?").bind(now - 120_000).run();
  await env.DB.prepare("UPDATE jobs SET state='failed',error='retry_exhausted' WHERE state='processing' AND lease_until<? AND attempts>=3").bind(now).run();
  const pending = await env.DB.prepare(`SELECT id FROM jobs WHERE expires_at>? AND
    ((state='queued' AND (queue_sent_at IS NULL OR queue_sent_at<?)) OR (state='processing' AND lease_until<? AND attempts<3)) LIMIT 100`)
    .bind(now, now - 300_000, now).all<{ id: string }>();
  for (const { id } of pending.results) {
    await env.JOBS.send({ id });
    await env.DB.prepare('UPDATE jobs SET queue_sent_at=? WHERE id=?').bind(now, id).run();
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    let response: Response;
    const pathname = new URL(request.url).pathname;
    if (pathname === '/.well-known/converter-capabilities' && request.method === 'GET') response = capabilities(request, env);
    else if (!pathname.startsWith('/api/')) response = await env.ASSETS.fetch(request);
    else {
      try { response = await api(request, env); }
      catch (error) {
        if (error instanceof ApiError) response = json({ error: error.message }, error.status);
        else { console.error('api_request_failed'); response = json({ error: 'İşlem tamamlanamadı. Yeniden deneyin.' }, 500); }
      }
    }
    const secured = new Response(response.body, response);
    secured.headers.set('X-Content-Type-Options', 'nosniff');
    secured.headers.set('Referrer-Policy', 'no-referrer');
    secured.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    secured.headers.set('Content-Security-Policy', "default-src 'self'; img-src 'self' blob: data:; style-src 'self'; script-src 'self'; connect-src 'self'; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    if (new URL(request.url).pathname.startsWith('/api/')) secured.headers.set('Cache-Control', 'no-store');
    return secured;
  },
  async queue(batch: MessageBatch<{ id: string }>, env: Env) {
    for (const message of batch.messages) {
      try { await processJob(env, message.body.id); message.ack(); }
      catch { message.retry({ delaySeconds: 30 }); }
    }
  },
  async scheduled(_event: ScheduledController, env: Env) { await maintenance(env); },
} satisfies ExportedHandler<Env, { id: string }>;
