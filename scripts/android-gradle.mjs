import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const spec = JSON.parse(readFileSync(path.join(root, 'scripts/toolchain.json')));
const tools = path.resolve(root, '../.tools');
const environment = { ...process.env };
environment.JAVA_HOME ||= path.join(tools, spec.jdk.directory);
environment.ANDROID_HOME ||= path.join(tools, 'android-sdk');
environment.GRADLE_USER_HOME ||= path.join(tools, 'gradle-cache');
if (!existsSync(path.join(environment.JAVA_HOME, 'bin/javac'))) throw new Error('JDK missing. Run python scripts/setup-android.py first.');
const javaOptions = [];
if (environment.HTTPS_PROXY) {
  const proxy = new URL(environment.HTTPS_PROXY);
  javaOptions.push(`-Dhttps.proxyHost=${proxy.hostname}`, `-Dhttps.proxyPort=${proxy.port || 80}`, `-Dhttp.proxyHost=${proxy.hostname}`, `-Dhttp.proxyPort=${proxy.port || 80}`, '-Dhttp.nonProxyHosts=localhost|127.*');
}
if (existsSync('/etc/ssl/certs/java/cacerts')) javaOptions.push('-Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts');
environment.JAVA_TOOL_OPTIONS = [environment.JAVA_TOOL_OPTIONS, ...javaOptions].filter(Boolean).join(' ');
const args = process.argv.slice(2);
const child = spawn('./gradlew', ['--no-daemon', '--max-workers=2', ...(args.length ? args : ['assembleDebug', 'testDebugUnitTest'])], {
  cwd: path.join(root, 'apps/android'), env: environment, stdio: 'inherit',
});
child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
