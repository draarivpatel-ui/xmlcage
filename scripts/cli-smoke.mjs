import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(root, 'bin', 'xmlcage.mjs');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'xmlcage-smoke-'));

function run(args, input) {
  return spawnSync(process.execPath, [bin, ...args], {
    input,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024
  });
}

function assert(condition, message) {
  if (!condition) throw new Error('CLI smoke failed: ' + message);
}

try {
  const safeFile = path.join(scratch, 'safe.xml');
  const unsafeFile = path.join(scratch, 'unsafe.xml');
  fs.writeFileSync(safeFile, '<root><ok value="yes"/></root>\n', 'utf8');
  fs.writeFileSync(unsafeFile, '<!DOCTYPE r [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><r>&xxe;</r>\n', 'utf8');

  const safe = run(['audit', safeFile]);
  assert(safe.status === 0, 'safe file should exit 0, got ' + safe.status + ' stderr ' + safe.stderr);

  const unsafe = run(['audit', unsafeFile, '--json']);
  assert(unsafe.status === 1, 'unsafe file should exit 1, got ' + unsafe.status);
  const parsed = JSON.parse(unsafe.stdout);
  assert(parsed.safe === false, 'unsafe JSON report should be unsafe');
  assert(parsed.findings.some((finding) => finding.code === 'XMLCAGE_ENTITY_FORBIDDEN'), 'unsafe report should identify the entity declaration');

  const stdin = run(['audit', '-'], '<root/>');
  assert(stdin.status === 0, 'stdin safe input should exit 0, got ' + stdin.status + ' stderr ' + stdin.stderr);

  const missing = run(['audit', path.join(scratch, 'missing.xml')]);
  assert(missing.status === 2, 'missing input should exit 2, got ' + missing.status);

  const version = run(['--version']);
  assert(version.status === 0 && version.stdout.includes('xmlcage '), '--version should print the version');

  process.stdout.write('xmlcage CLI smoke passed\n');
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
