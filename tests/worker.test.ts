/// <reference types="@cloudflare/vitest-plugin/types" />
import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import worker, { maintenance, processJob, readLimited, type Env } from '../worker';
import type { Job } from '../shared/conversion';

const runtime = env as unknown as Env & { TEST_MIGRATIONS: Parameters<typeof applyD1Migrations>[1] };
const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg=='), (s) => s.charCodeAt(0));
const cookieA = `mce_session=${'a'.repeat(64)}`;
const cookieB = `mce_session=${'b'.repeat(64)}`;
const send = vi.fn(async (_message: unknown) => {});
const engineFetch = vi.fn(async () => new Response(new Uint8Array([255, 216, 255, 217]), { headers: { 'Content-Type': 'image/jpeg', 'X-Image-Width': '1', 'X-Image-Height': '1' } }));
const bindings = { ...runtime, JOBS: { send }, ENGINE: { getByName: () => ({ fetch: engineFetch }) } } as unknown as Env;

function request(path: string, init: RequestInit = {}, cookie = cookieA, local = true) {
  return worker.fetch(new Request(`${local ? 'http://localhost' : 'https://converter.example'}${path}`, {
    ...init, headers: { Cookie: cookie, ...init.headers },
  }), bindings);
}
async function create(key = crypto.randomUUID()) {
  return request('/api/jobs?format=jpeg&quality=85', { method: 'POST', body: png, headers: { 'Idempotency-Key': key } });
}
beforeAll(async () => { await applyD1Migrations(runtime.DB, runtime.TEST_MIGRATIONS); });
beforeEach(async () => {
  await runtime.DB.prepare('DELETE FROM jobs').run();
  const objects = await runtime.FILES.list();
  if (objects.objects.length) await runtime.FILES.delete(objects.objects.map((object) => object.key));
  send.mockClear(); engineFetch.mockClear();
});

describe('Cloudflare job lifecycle', () => {
  it('uploads, deduplicates, processes once, authorizes downloads and deletes all objects', async () => {
    const key = crypto.randomUUID();
    const created = await create(key); expect(created.status).toBe(202);
    const job = await created.json<Job>();
    const duplicate = await create(key); expect((await duplicate.json<Job>()).id).toBe(job.id);
    expect(send).toHaveBeenCalledTimes(1);
    expect((await request(`/api/jobs/${job.id}`, {}, cookieB)).status).toBe(404);
    expect((await request(`/api/jobs/${job.id}/download`, {}, cookieB)).status).toBe(404);
    expect((await request(`/api/jobs/${job.id}`, { method: 'DELETE' }, cookieB)).status).toBe(404);
    await processJob(bindings, job.id); await processJob(bindings, job.id);
    expect(engineFetch).toHaveBeenCalledTimes(1);
    const completed = await (await request(`/api/jobs/${job.id}`)).json<Job>();
    expect(completed.state).toBe('succeeded');
    const download = await request(`/api/jobs/${job.id}/download`);
    expect(download.status).toBe(200); expect(download.headers.get('Content-Type')).toBe('image/jpeg');
    expect(await download.arrayBuffer()).toHaveProperty('byteLength', 4);
    expect((await request(`/api/jobs/${job.id}`, { method: 'DELETE' })).status).toBe(204);
    expect((await request(`/api/jobs/${job.id}`, { method: 'DELETE' })).status).toBe(204);
    expect((await request(`/api/jobs/${job.id}/download`)).status).toBe(410);
    expect((await runtime.FILES.list({ prefix: `jobs/${job.id}/` })).objects).toHaveLength(0);
  });
  it('enforces the daily quota atomically under concurrent submissions', async () => {
    const responses = await Promise.all(Array.from({ length: 8 }, () => create()));
    expect(responses.filter((r) => r.status === 202)).toHaveLength(5);
    expect(responses.filter((r) => r.status === 429)).toHaveLength(3);
  });
  it('recovers failed queue publication and expires stored input', async () => {
    send.mockRejectedValueOnce(new Error('queue unavailable'));
    const job = await (await create()).json<Job>();
    expect(job.state).toBe('queued');
    await maintenance(bindings); expect(send).toHaveBeenCalledTimes(2);
    await runtime.DB.prepare('UPDATE jobs SET expires_at=0 WHERE id=?').bind(job.id).run();
    expect((await request(`/api/jobs/${job.id}`)).status).toBe(410);
    await maintenance(bindings);
    expect((await runtime.FILES.list({ prefix: `jobs/${job.id}/` })).objects).toHaveLength(0);
    expect((await runtime.DB.prepare('SELECT state FROM jobs WHERE id=?').bind(job.id).first<{ state: string }>())?.state).toBe('expired');
  });
  it('retries transient failures but never publishes a canceled attempt', async () => {
    const job = await (await create()).json<Job>();
    engineFetch.mockRejectedValueOnce(new Error('temporary failure'));
    await expect(processJob(bindings, job.id)).rejects.toThrow('retry_processing');
    expect((await (await request(`/api/jobs/${job.id}`)).json<Job>()).state).toBe('queued');
    engineFetch.mockImplementationOnce(async () => {
      await request(`/api/jobs/${job.id}`, { method: 'DELETE' });
      return new Response(new Uint8Array([255, 216]), { headers: { 'Content-Type': 'image/jpeg', 'X-Image-Width': '1', 'X-Image-Height': '1' } });
    });
    await processJob(bindings, job.id);
    expect((await request(`/api/jobs/${job.id}`)).status).toBe(410);
    expect((await runtime.FILES.list({ prefix: `jobs/${job.id}/` })).objects).toHaveLength(0);
  });
  it('does not grant development authentication to public hosts or production requests', async () => {
    const publicCapabilities = await request('/.well-known/converter-capabilities', {}, cookieA, false);
    expect(publicCapabilities.status).toBe(200);
    expect((await publicCapabilities.json<{ serverAuth: string }>()).serverAuth).toBe('unconfigured');
    expect((await request('/api/jobs', { method: 'POST' }, cookieA, false)).status).toBe(503);
    const response = await worker.fetch(new Request('http://localhost/api/session', { method: 'POST' }), { ...bindings, APP_ENV: 'production' });
    expect(response.status).toBe(503);
    const spoofed = await worker.fetch(new Request('https://converter.example/api/jobs', { headers: { 'cf-access-jwt-assertion': 'forged' } }), { ...bindings, APP_ENV: 'production', ACCESS_TEAM_DOMAIN: 'example.cloudflareaccess.com', ACCESS_AUD: 'test' });
    expect(spoofed.status).toBe(401);
  });
  it('rejects cross-origin writes and body streams over the input limit', async () => {
    expect((await request('/api/session', { method: 'POST', headers: { Origin: 'https://attacker.example' } })).status).toBe(403);
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(11)); controller.close(); } });
    await expect(readLimited(stream, 10)).rejects.toThrow(/boyutu/);
  });
});
