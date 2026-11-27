#!/usr/bin/env node

import fs from 'node:fs';
import {
  XMLCAGE_VERSION,
  XMLCAGE_ERROR_CODES,
  auditXml
} from '../src/index.mjs';

const ERROR = XMLCAGE_ERROR_CODES;
const DEFAULT_MAX_BYTES = 1048576;
const DEFAULT_MAX_DEPTH = 32;

function usage() {
  return [
    'xmlcage ' + XMLCAGE_VERSION,
    '',
    'Usage:',
    '  xmlcage audit <file-or-dash> [--max-bytes N] [--max-depth N] [--json]',
    '  xmlcage --version',
    '  xmlcage --help',
    '',
    'Use - as the input path to read standard input.',
    'Exit codes: 0 safe, 1 unsafe findings, 2 usage or input error.'
  ].join('\n');
}

function failUsage(message) {
  process.stderr.write('xmlcage: ' + message + '\n\n' + usage() + '\n');
  process.exitCode = 2;
}

function parseLimit(value, flag) {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 4294967295) return null;
  return parsed;
}

function parseAuditArgs(args) {
  const result = {
    json: false,
    maxBytes: DEFAULT_MAX_BYTES,
    maxDepth: DEFAULT_MAX_DEPTH,
    input: null
  };
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === '--json') {
      if (result.json) return null;
      result.json = true;
      continue;
    }
    if (token === '--max-bytes' || token === '--max-depth') {
      if (index + 1 >= args.length) return null;
      const parsed = parseLimit(args[index + 1], token);
      if (parsed === null) return null;
      if (token === '--max-bytes') result.maxBytes = parsed;
      else result.maxDepth = parsed;
      index += 1;
      continue;
    }
    if (token.startsWith('--max-bytes=') || token.startsWith('--max-depth=')) {
      const equals = token.indexOf('=');
      const flag = token.slice(0, equals);
      const parsed = parseLimit(token.slice(equals + 1), flag);
      if (parsed === null) return null;
      if (flag === '--max-bytes') result.maxBytes = parsed;
      else result.maxDepth = parsed;
      continue;
    }
    if (token.startsWith('-') && token !== '-') return null;
    if (result.input !== null) return null;
    result.input = token;
  }
  return result.input === null ? null : result;
}

function zeroStats(bytes) {
  return {
    bytes,
    elements: 0,
    maxDepthObserved: 0,
    attributes: 0,
    textCharacters: 0,
    comments: 0,
    cdataSections: 0,
    processingInstructions: 0,
    entityReferences: 0,
    expandedTextBytes: 0
  };
}

function oversizedReport(actual, limit) {
  return {
    safe: false,
    findings: [{
      code: ERROR.MAX_BYTES,
      message: 'maximum XML byte length exceeded',
      limit,
      actual
    }],
    stats: zeroStats(actual)
  };
}

function readAllFromFd(fd, maxBytes) {
  const chunks = [];
  const scratch = Buffer.allocUnsafe(65536);
  let total = 0;
  for (;;) {
    const count = fs.readSync(fd, scratch, 0, scratch.length, null);
    if (count === 0) break;
    total += count;
    if (total > maxBytes) {
      return { oversized: true, actual: total, bytes: null };
    }
    chunks.push(Buffer.from(scratch.subarray(0, count)));
  }
  return { oversized: false, actual: total, bytes: Buffer.concat(chunks, total) };
}

function readInput(input, maxBytes) {
  if (input === '-') {
    return readAllFromFd(0, maxBytes);
  }
  let fd = null;
  try {
    const pathStat = fs.statSync(input);
    if (!pathStat.isFile()) {
      throw new Error('input is not a regular file');
    }
    fd = fs.openSync(input, 'r');
    const stat = fs.fstatSync(fd);
    if (!stat.isFile()) {
      throw new Error('input is not a regular file');
    }
    return readAllFromFd(fd, maxBytes);
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {
        // The read result is more important than a close failure here.
      }
    }
  }
}

function printReport(report, json) {
  if (json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    return;
  }
  if (report.safe) {
    process.stdout.write('xmlcage audit: safe\n');
    process.stdout.write('bytes: ' + report.stats.bytes + ', elements: ' + report.stats.elements + ', max depth: ' + report.stats.maxDepthObserved + '\n');
    return;
  }
  process.stdout.write('xmlcage audit: unsafe\n');
  for (const finding of report.findings) {
    const location = typeof finding.line === 'number'
      ? 'line ' + finding.line + ', column ' + finding.column + ': '
      : '';
    process.stdout.write('- ' + finding.code + ' ' + location + finding.message + '\n');
  }
}

function runAudit(args) {
  const parsed = parseAuditArgs(args);
  if (parsed === null) {
    failUsage('audit requires exactly one input and accepts only --max-bytes, --max-depth and --json');
    return;
  }
  let input;
  try {
    input = readInput(parsed.input, parsed.maxBytes);
  } catch {
    process.stderr.write('xmlcage: unable to read input as a regular file or standard input stream\n');
    process.exitCode = 2;
    return;
  }
  const report = input.oversized
    ? oversizedReport(input.actual, parsed.maxBytes)
    : auditXml(input.bytes, {
      maxBytes: parsed.maxBytes,
      maxDepth: parsed.maxDepth
    });
  printReport(report, parsed.json);
  process.exitCode = report.safe ? 0 : 1;
}

function main(argv) {
  const command = argv[0];
  if (command === '--help' || command === '-h') {
    process.stdout.write(usage() + '\n');
    return;
  }
  if (command === undefined) {
    failUsage('missing command');
    return;
  }
  if (command === '--version' || command === '-v') {
    process.stdout.write('xmlcage ' + XMLCAGE_VERSION + '\n');
    return;
  }
  if (command === 'audit') {
    runAudit(argv.slice(1));
    return;
  }
  failUsage('unknown command ' + JSON.stringify(command));
}

main(process.argv.slice(2));
