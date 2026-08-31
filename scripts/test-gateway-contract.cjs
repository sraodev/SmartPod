// Exercise a real process, validate actual response bodies, and verify graceful restart.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const yaml = require('../interface/node_modules/js-yaml');

const root = path.resolve(__dirname, '..');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'smartpod-gateway-test-'));
const binary = path.join(scratch, 'smartpod-gateway');
const token = randomBytes(32).toString('hex');
const spec = yaml.safeLoad(fs.readFileSync(path.join(root, 'docs/openapi-v2.yaml'), 'utf8'));
let exampleCount = 0;

async function start() {
  const child = spawn(binary, ['-listen', '127.0.0.1:0', '-db', path.join(scratch, 'state.db')], {
    env: { ...process.env, SMARTPOD_GATEWAY_TOKEN: token }, stdio: ['ignore', 'ignore', 'pipe']
  });
  const exited = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
  let logs = '';
  const address = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Gateway startup timed out')); }, 10000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', () => { clearTimeout(timeout); reject(new Error('Gateway exited before ready')); });
    child.stderr.on('data', chunk => {
      logs += chunk.toString();
      for (const line of logs.split('\n')) {
        try {
          const record = JSON.parse(line);
          if (record.msg === 'gateway listening') { clearTimeout(timeout); resolve(record.address); }
        } catch { /* An incomplete JSON log line is not ready yet. */ }
      }
    });
  });
  return {
    url: `http://${address}`,
    async stop() {
      child.kill('SIGTERM');
      const timeout = setTimeout(() => child.kill('SIGKILL'), 7000);
      const result = await exited;
      clearTimeout(timeout);
      assert.equal(result.code, 0, 'Gateway must stop gracefully');
      assert.ok(!logs.includes(token), 'Gateway must never log its token');
    }
  };
}

async function request(service, endpoint, status, options = {}) {
  const response = await fetch(`${service.url}/api${endpoint}`, {
    ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers },
    signal: AbortSignal.timeout(5000)
  });
  assert.equal(response.status, status);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json();
  // Attach the actual body as a media-type example, then validate it with the same
  // OpenAPI linter used by CI. No hand-written subset of JSON Schema validation.
  const key = endpoint.startsWith('/v1/ports/') ? '/v1/ports/{portId}' : endpoint;
  let declared = spec.paths[key].get.responses[String(status)];
  if (declared.$ref) declared = spec.components.responses[declared.$ref.split('/').pop()];
  const mediaType = status === 200 ? 'application/json' : 'application/problem+json';
  assert.equal(response.headers.get('content-type'), mediaType);
  const media = declared.content[mediaType];
  media.examples ??= {};
  media.examples[`response${++exampleCount}`] = { value: body };
  return body;
}

async function main() {
  execFileSync('go', ['build', '-o', binary, '.'], { cwd: path.join(root, 'gateway'), stdio: 'inherit' });
  let service = await start();
  let latest;
  try {
    const list = await request(service, '/v1/ports', 200);
    assert.equal(list.ports.length, 1);
    const deadline = Date.now() + 5000;
    do {
      latest = await request(service, '/v1/ports/sim-port-1', 200);
      if (latest.measurement.sequence >= 2) break;
      await new Promise(resolve => setTimeout(resolve, 200));
    } while (Date.now() < deadline);
    assert.ok(latest.measurement.sequence >= 2, 'Readings must advance');
    assert.equal(latest.measurement.energy_wh, Math.floor(latest.measurement.sequence / 10));
    assert.equal(latest.measurement.quality, 'estimated');
    await request(service, '/v1/ports/missing', 404);
    await request(service, '/v1/ports', 401, { headers: { Authorization: '' } });
    await request(service, '/v1/ports', 403, { headers: { Origin: 'https://example.com' } });
    await request(service, '/v1/ports', 405, { method: 'POST' });
  } finally { await service.stop(); }
  service = await start();
  try {
    const resumed = await request(service, '/v1/ports/sim-port-1', 200);
    assert.ok(resumed.measurement.sequence >= latest.measurement.sequence, 'Restart must preserve sequence');
    assert.equal(resumed.id, latest.id);
  } finally { await service.stop(); }
  const contract = path.join(scratch, 'actual-responses.json');
  fs.writeFileSync(contract, JSON.stringify(spec));
  execFileSync('npx', ['--yes', '@redocly/cli@2.49.0', 'lint', contract, '--config', path.join(root, 'redocly.yaml')], { cwd: root, stdio: 'inherit' });
  console.log(`Gateway lifecycle and ${exampleCount} actual response examples passed.`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
});
