import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { cleanupTempDir, makeTempDir, runCli, repoRoot } from './helpers.mjs';

function cliResult(args, input) {
  const result = runCli(args, { input });
  assert.equal(result.error, undefined);
  return result;
}

for (const flag of ['--help', '-h']) {
  test('cli help exits zero: ' + flag, () => {
    const result = cliResult([flag]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage:/);
  });
}

for (const flag of ['--version', '-v']) {
  test('cli version exits zero: ' + flag, () => {
    const result = cliResult([flag]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /^xmlcage 1\.0\.0\n$/);
  });
}

test('cli no arguments is a usage error', () => {
  const result = cliResult([]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /missing command/);
});

test('cli unknown command is a usage error', () => {
  const result = cliResult(['inspect']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /unknown command/);
});

const invalidAuditArguments = [
  ['missing input', ['audit']],
  ['two inputs', ['audit', 'a.xml', 'b.xml']],
  ['unknown flag', ['audit', '-', '--verbose']],
  ['duplicate json flag', ['audit', '-', '--json', '--json']],
  ['max bytes missing value', ['audit', '-', '--max-bytes']],
  ['max depth missing value', ['audit', '-', '--max-depth']],
  ['max bytes zero', ['audit', '-', '--max-bytes', '0']],
  ['max bytes negative', ['audit', '-', '--max-bytes', '-1']],
  ['max bytes fractional', ['audit', '-', '--max-bytes', '1.5']],
  ['max bytes text', ['audit', '-', '--max-bytes', 'abc']],
  ['max depth zero', ['audit', '-', '--max-depth', '0']],
  ['bare double dash', ['audit', '--', '-']]
];
for (const [name, args] of invalidAuditArguments) {
  test('cli invalid audit arguments: ' + name, () => {
    const result = cliResult(args, '<r/>');
    assert.equal(result.status, 2);
  });
}

test('cli audits safe standard input with exit zero', () => {
  const result = cliResult(['audit', '-'], '<root><child/></root>');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /safe/);
  assert.match(result.stdout, /elements: 2/);
});

test('cli audits unsafe standard input with exit one', () => {
  const result = cliResult(['audit', '-'], '<!DOCTYPE r [<!ENTITY x SYSTEM "file:///etc/passwd">]><r/>');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /unsafe/);
  assert.match(result.stdout, /XMLCAGE_DOCTYPE_FORBIDDEN/);
});

test('cli json output is parseable and complete', () => {
  const result = cliResult(['audit', '-', '--json'], '<r>&bad;</r>');
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.safe, false);
  assert.equal(report.findings[0].code, 'XMLCAGE_UNKNOWN_ENTITY');
  assert.equal(typeof report.stats.bytes, 'number');
});

test('cli json output for safe input has zero findings', () => {
  const result = cliResult(['audit', '-', '--json'], '<r/>');
  assert.equal(result.status, 0);
  const report = JSON.parse(result.stdout);
  assert.equal(report.safe, true);
  assert.deepEqual(report.findings, []);
});

test('cli max depth flag tightens audit', () => {
  const result = cliResult(['audit', '-', '--max-depth', '1'], '<a><b/></a>');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /XMLCAGE_MAX_DEPTH/);
});

test('cli max depth equals syntax tightens audit', () => {
  const result = cliResult(['audit', '-', '--max-depth=1'], '<a><b/></a>');
  assert.equal(result.status, 1);
});

test('cli max depth flag permits document within cap', () => {
  const result = cliResult(['audit', '-', '--max-depth', '2'], '<a><b/></a>');
  assert.equal(result.status, 0, result.stdout);
});

test('cli max bytes rejects oversized input before parsing', () => {
  const result = cliResult(['audit', '-', '--max-bytes', '8', '--json'], '<r>xxxxxxx</r>');
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.findings[0].code, 'XMLCAGE_MAX_BYTES');
});

test('cli utf16 byte input is rejected as unsafe', () => {
  const result = cliResult(['audit', '-'], Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('<r/>', 'utf16le')]));
  assert.equal(result.status, 1);
  assert.match(result.stdout, /XMLCAGE_INVALID_UTF8/);
});

function withTempFile(name, content, callback) {
  const directory = makeTempDir();
  try {
    const filePath = path.join(directory, name);
    fs.writeFileSync(filePath, content);
    callback(filePath, directory);
  } finally {
    cleanupTempDir(directory);
  }
}

test('cli audits a safe regular file', () => {
  withTempFile('safe.xml', '<r/>', (filePath) => {
    const result = cliResult(['audit', filePath]);
    assert.equal(result.status, 0, result.stderr);
  });
});

test('cli audits an unsafe regular file', () => {
  withTempFile('unsafe.xml', '<!DOCTYPE r><r/>', (filePath) => {
    const result = cliResult(['audit', filePath]);
    assert.equal(result.status, 1);
  });
});

test('cli reports missing file as exit two', () => {
  const result = cliResult(['audit', path.join(makeTempDir(), 'missing.xml')]);
  assert.equal(result.status, 2);
});

test('cli rejects a directory input', () => {
  const directory = makeTempDir();
  try {
    const result = cliResult(['audit', directory]);
    assert.equal(result.status, 2);
  } finally {
    cleanupTempDir(directory);
  }
});

test('cli rejects fifo input on posix systems', { skip: process.platform === 'win32' }, () => {
  const directory = makeTempDir();
  try {
    const fifo = path.join(directory, 'input.fifo');
    const result = spawnSync('mkfifo', [fifo], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const audit = cliResult(['audit', fifo]);
    assert.equal(audit.status, 2);
  } finally {
    cleanupTempDir(directory);
  }
});

test('cli rejects symlink input on posix systems', { skip: process.platform === 'win32' }, () => {
  const directory = makeTempDir();
  try {
    const real = path.join(directory, 'real.xml');
    const link = path.join(directory, 'link.xml');
    fs.writeFileSync(real, '<r/>');
    fs.symlinkSync(real, link);
    const result = cliResult(['audit', link]);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.doesNotMatch(result.stderr, /at\s+/);
  } finally {
    cleanupTempDir(directory);
  }
});

test('cli rejects device input on posix systems', { skip: process.platform === 'win32' }, () => {
  const result = cliResult(['audit', '/dev/null']);
  assert.equal(result.status, 2);
});

test('cli rejects oversized regular files before reading them', () => {
  withTempFile('oversized.xml', '<r>xxxxx</r>', (filePath) => {
    const result = cliResult(['audit', filePath, '--max-bytes', '8', '--json']);
    assert.equal(result.status, 1);
    const report = JSON.parse(result.stdout);
    assert.equal(report.findings[0].code, 'XMLCAGE_MAX_BYTES');
    assert.equal(report.findings[0].actual, 12);
  });
});

test('cli stderr is empty for successful audit', () => {
  const result = cliResult(['audit', '-'], '<r/>');
  assert.equal(result.stderr, '');
});

test('cli stderr is empty for findings audit', () => {
  const result = cliResult(['audit', '-'], '<!DOCTYPE r><r/>');
  assert.equal(result.stderr, '');
});

function repositoryFiles(directory = repoRoot, prefix = '') {
  const output = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const absolute = path.join(directory, entry.name);
    const relative = prefix === '' ? entry.name : prefix + '/' + entry.name;
    if (entry.isDirectory()) output.push(...repositoryFiles(absolute, relative));
    else output.push(relative);
  }
  return output.sort();
}

test('repository has no node_modules directory content', () => {
  assert.equal(fs.existsSync(path.join(repoRoot, 'node_modules')), false);
});

test('repository text files use LF only', () => {
  for (const file of repositoryFiles()) {
    const content = fs.readFileSync(path.join(repoRoot, file));
    assert.equal(content.includes(13), false, file);
  }
});

test('repository text has no em or en dashes', () => {
  for (const file of repositoryFiles()) {
    const content = fs.readFileSync(path.join(repoRoot, file), 'utf8');
    assert.equal(content.includes('\u2014'), false, file);
    assert.equal(content.includes('\u2013'), false, file);
  }
});

test('repository has no local absolute paths or private email markers', () => {
  for (const file of repositoryFiles()) {
    const content = fs.readFileSync(path.join(repoRoot, file), 'utf8');
    assert.equal(content.includes('/Use' + 'rs/'), false, file);
    assert.equal(/@[A-Za-z0-9.-]+\.(com|net|org|edu)/.test(content.replace('users.noreply.github.com', '')), false, file);
  }
});

test('package metadata is npm ready with zero runtime dependencies', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'xmlcage');
  assert.equal(pkg.version, '1.0.0');
  assert.equal(pkg.license, 'MIT');
  assert.deepEqual(pkg.dependencies, {});
  assert.deepEqual(Object.keys(pkg.devDependencies), ['fast-check']);
  assert.equal(typeof pkg.devDependencies['fast-check'], 'string');
  assert.equal(pkg.devDependencies['fast-check'].startsWith('^'), false);
  assert.equal(pkg.devDependencies['fast-check'].startsWith('~'), false);
  assert.equal(pkg.engines.node, '>=18.0.0');
  assert.equal(pkg.sideEffects, false);
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.bin.xmlcage, 'bin/xmlcage.mjs');
  assert.equal(pkg.scripts.test, 'node scripts/run-tests.mjs');
});

test('test runner uses explicit cross platform file discovery', () => {
  const content = fs.readFileSync(path.join(repoRoot, 'scripts', 'run-tests.mjs'), 'utf8');
  assert.ok(content.includes('readdirSync'));
  assert.ok(content.includes('.test.mjs'));
  assert.ok(!content.includes('tests/*.test.mjs'));
});

test('package exports cover types esm cjs and package metadata', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.exports['.'].types, './types/index.d.ts');
  assert.equal(pkg.exports['.'].import, './src/index.mjs');
  assert.equal(pkg.exports['.'].require, './cjs/index.cjs');
  assert.equal(pkg.exports['./package.json'], './package.json');
  for (const file of ['src', 'cjs', 'types', 'bin', 'docs', 'README.md', 'SECURITY.md', 'CONTRIBUTING.md', 'LICENSE']) {
    assert.ok(pkg.files.includes(file), file);
  }
});

test('cli file is executable with a node shebang', () => {
  const content = fs.readFileSync(path.join(repoRoot, 'bin', 'xmlcage.mjs'), 'utf8');
  assert.ok(content.startsWith('#!/usr/bin/env node\n'));
  if (process.platform !== 'win32') {
    const mode = fs.statSync(path.join(repoRoot, 'bin', 'xmlcage.mjs')).mode;
    assert.notEqual(mode & 0o111, 0);
  }
});

test('gitattributes enforces LF for source and documentation formats', () => {
  const content = fs.readFileSync(path.join(repoRoot, '.gitattributes'), 'utf8');
  for (const pattern of ['.gitattributes', '.gitignore', 'LICENSE', '*.mjs', '*.cjs', '*.js', '*.ts', '*.json', '*.md', '*.yml']) {
    const escaped = pattern.replace(/[.*]/g, '\\$&');
    assert.match(content, new RegExp('^' + escaped + ' text eol=lf$', 'm'), pattern);
  }
});

test('ci matrix covers required operating systems and node versions', () => {
  const content = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'ci.yml'), 'utf8');
  for (const required of ['ubuntu-24.04', 'windows-latest', '18', '20', '22', '24', 'npm test', 'build-cjs.mjs --check', 'cli-smoke.mjs', 'npm pack --dry-run']) {
    assert.ok(content.includes(required), required);
  }
});

test('good first issues document contains ten starter specs', () => {
  const content = fs.readFileSync(path.join(repoRoot, 'docs', 'GOOD_FIRST_ISSUES.md'), 'utf8');
  assert.equal((content.match(/^## \d+\./gm) || []).length, 10);
});

test('readme documents threat model examples publication status and finding codes', () => {
  const content = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
  for (const required of ['## Threat model', '## Quick start', '## Finding codes', '## Publication status', 'CWE-611', 'CWE-776', 'xsi:schemaLocation', 'xml-stylesheet']) {
    assert.ok(content.includes(required), required);
  }
  assert.ok((content.match(/`XMLCAGE_[A-Z_]+`/g) || []).length >= 30);
  assert.equal(/already published/i.test(content), false);
});

test('security and community files exist and are nonempty', () => {
  for (const file of ['README.md', 'SECURITY.md', 'CONTRIBUTING.md', 'LICENSE', 'docs/GOOD_FIRST_ISSUES.md', '.github/PULL_REQUEST_TEMPLATE.md', '.github/ISSUE_TEMPLATE/bug_report.yml', '.github/ISSUE_TEMPLATE/feature_request.yml']) {
    const stat = fs.statSync(path.join(repoRoot, file));
    assert.ok(stat.size > 200, file);
  }
});

test('license is mit license', () => {
  const content = fs.readFileSync(path.join(repoRoot, 'LICENSE'), 'utf8');
  assert.match(content, /MIT License/);
});

test('typescript definitions exist and mention every public api', () => {
  const content = fs.readFileSync(path.join(repoRoot, 'types', 'index.d.ts'), 'utf8');
  for (const required of ['auditXml', 'assertSafeXml', 'parseSafeXml', 'parseSafeXmlBytes', 'escapeXmlText', 'escapeXmlAttr', 'serializeSafeXml', 'createXmlCage', 'XmlCageError']) {
    assert.ok(content.includes(required), required);
  }
});
