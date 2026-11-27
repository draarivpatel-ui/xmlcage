import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const cliPath = path.join(repoRoot, 'bin', 'xmlcage.mjs');

export function codes(report) {
  return report.findings.map((finding) => finding.code);
}

export function expectUnsafe(xml, code, options) {
  return { xml, code, options };
}

export function assertReportHasCode(report, code) {
  assert.equal(report.safe, false, 'report should be unsafe');
  assert.ok(
    report.findings.some((finding) => finding.code === code),
    'expected ' + code + ', got ' + codes(report).join(', ')
  );
}

export function assertThrowsCode(fn, code) {
  assert.throws(fn, (error) => {
    assert.equal(error.code, code, 'expected ' + code + ', got ' + (error && error.code));
    return true;
  });
}

export function nestedXml(depth, name = 'a') {
  return ('<' + name + '>').repeat(depth) + ('</' + name + '>').repeat(depth);
}

export function runCli(args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    input: options.input,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, ...(options.env || {}) }
  });
}

export function makeTempDir(prefix = 'xmlcage-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function cleanupTempDir(directory) {
  fs.rmSync(directory, { recursive: true, force: true });
}

export function utf8(text) {
  return Buffer.from(text, 'utf8');
}

export function concatBytes(...parts) {
  return Buffer.concat(parts.map((part) => Buffer.isBuffer(part) ? part : Buffer.from(part)));
}
