import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cwd = fileURLToPath(new URL('../', import.meta.url));
const env = { ...process.env, WRANGLER_SEND_METRICS: 'false' };
function run(command, args) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run('npm', ['run', 'prepare:engine']);
run('npm', ['run', 'build:web']);
run('npm', ['run', 'db:local']);
const native = env.CONVERTER_NATIVE_CONTAINERS === '1';
if (!native) run('docker', ['--host=unix:///var/run/docker.sock', 'build', '-t', 'converter-mce-engine:dev', '.']);
const children = [];
if (!native) children.push(spawn('python3', ['scripts/local-engine.py'], { cwd, env, stdio: 'inherit' }));
const args = ['dev', '--ip', '127.0.0.1', '--port', '8787', '--test-scheduled', '--var', 'APP_ENV:development'];
if (!native) args.push('--var', 'LOCAL_ENGINE_URL:http://127.0.0.1:8788');
children.push(spawn('./node_modules/.bin/wrangler', args, { cwd, env, stdio: 'inherit' }));
let stopping = false;
function stop(code = 0) {
  if (stopping) return; stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop());
for (const child of children) {
  child.on('error', (error) => { console.error(error.message); stop(1); });
  child.on('exit', (code) => { if (!stopping) stop(code ?? 1); });
}
