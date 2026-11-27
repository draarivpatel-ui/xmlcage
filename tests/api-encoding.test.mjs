import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  XMLCAGE_VERSION,
  XMLCAGE_ERROR_CODES as ERROR,
  XmlCageError,
  assertSafeXml,
  auditXml,
  createXmlCage,
  escapeXmlAttr,
  escapeXmlText,
  parseSafeXml,
  parseSafeXmlBytes,
  serializeSafeXml
} from '../src/index.mjs';

const require = createRequire(import.meta.url);
const cjs = require('../cjs/index.cjs');
const encoder = new TextEncoder();
const bytes = (text) => encoder.encode(text);

function unsafeCode(input, options) {
  const report = auditXml(input, options);
  assert.equal(report.safe, false);
  return report.findings[0].code;
}

test('version constant is package major version', () => {
  assert.equal(XMLCAGE_VERSION, '1.0.0');
});

test('error code table is frozen and prefixed', () => {
  assert.ok(Object.isFrozen(ERROR));
  assert.ok(Object.keys(ERROR).length >= 20);
  for (const [key, value] of Object.entries(ERROR)) {
    assert.equal(value, 'XMLCAGE_' + key);
  }
});

test('audit report and nested fields are frozen', () => {
  const report = auditXml('<!DOCTYPE r><r/>');
  assert.equal(report.safe, false);
  assert.ok(Object.isFrozen(report));
  assert.ok(Object.isFrozen(report.findings));
  assert.ok(Object.isFrozen(report.stats));
  assert.ok(Object.isFrozen(report.findings[0]));
  assert.throws(() => {
    report.safe = true;
  }, TypeError);
});

test('audit finding includes stable diagnostic fields', () => {
  const finding = auditXml('<r>&bad;</r>').findings[0];
  assert.equal(finding.code, ERROR.UNKNOWN_ENTITY);
  assert.equal(typeof finding.message, 'string');
  assert.equal(typeof finding.position, 'number');
  assert.equal(typeof finding.line, 'number');
  assert.equal(typeof finding.column, 'number');
});

test('assertSafeXml returns the report for safe xml', () => {
  const report = assertSafeXml('<r/>');
  assert.equal(report.safe, true);
});

test('assertSafeXml error carries findings and stats', () => {
  assert.throws(() => assertSafeXml('<r>&bad;</r>'), (error) => {
    assert.equal(error.code, ERROR.UNKNOWN_ENTITY);
    assert.ok(Array.isArray(error.findings));
    assert.equal(error.stats.bytes, 12);
    return true;
  });
});

test('XmlCageError exposes name code reason and details', () => {
  assert.throws(() => parseSafeXml('<r>&bad;</r>'), (error) => {
    assert.ok(error instanceof XmlCageError);
    assert.ok(error instanceof Error);
    assert.equal(error.name, 'XmlCageError');
    assert.equal(error.code, ERROR.UNKNOWN_ENTITY);
    assert.equal(typeof error.reason, 'string');
    assert.equal(typeof error.position, 'number');
    return true;
  });
});

test('parseSafeXmlBytes accepts Uint8Array', () => {
  assert.equal(parseSafeXmlBytes(bytes('<r/>')).root.name, 'r');
});

test('parseSafeXmlBytes accepts Buffer', () => {
  assert.equal(parseSafeXmlBytes(Buffer.from('<r/>')).root.name, 'r');
});

test('parseSafeXmlBytes accepts ArrayBuffer', () => {
  const input = bytes('<r/>').buffer;
  assert.equal(parseSafeXmlBytes(input).root.name, 'r');
});

test('parseSafeXmlBytes accepts ArrayBuffer view', () => {
  const backing = new ArrayBuffer(16);
  const view = new DataView(backing);
  bytes('<r/>').forEach((value, index) => view.setUint8(index, value));
  const sized = new Uint8Array(backing, 0, 4);
  assert.equal(parseSafeXmlBytes(sized).root.name, 'r');
});

test('parseSafeXmlBytes accepts a byte subarray without copying outside data', () => {
  const backing = bytes('xx<r/>yy');
  const view = backing.subarray(2, 6);
  assert.equal(parseSafeXmlBytes(view).root.name, 'r');
});

for (const input of [null, undefined, 4, true, {}, [], '<r/>']) {
  test('parseSafeXmlBytes rejects non bytes input ' + String(input), () => {
    assert.throws(() => parseSafeXmlBytes(input), (error) => error.code === ERROR.INVALID_INPUT);
  });
}

for (const input of [bytes('<r/>'), Buffer.from('<r/>'), bytes('<r/>').buffer]) {
  test('auditXml accepts byte input type ' + Object.prototype.toString.call(input), () => {
    assert.equal(auditXml(input).safe, true);
  });
}

test('utf8 bom is stripped for bytes and strings', () => {
  assert.equal(parseSafeXmlBytes(new Uint8Array([0xef, 0xbb, 0xbf, ...bytes('<r/>')])).root.name, 'r');
  assert.equal(parseSafeXml('\ufeff<r/>').root.name, 'r');
});

function utf16Units(text, littleEndian) {
  const output = [];
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index);
    if (littleEndian) output.push(unit & 0xff, unit >> 8);
    else output.push(unit >> 8, unit & 0xff);
  }
  return output;
}

function utf32Units(text, littleEndian) {
  const output = [];
  for (const character of text) {
    const unit = character.codePointAt(0);
    if (littleEndian) output.push(unit & 0xff, (unit >> 8) & 0xff, (unit >> 16) & 0xff, unit >> 24);
    else output.push(unit >> 24, (unit >> 16) & 0xff, (unit >> 8) & 0xff, unit & 0xff);
  }
  return output;
}

const utf16Sequences = [
  ['utf16le bom', [0xff, 0xfe, ...utf16Units('<r/>', true)]],
  ['utf16be bom', [0xfe, 0xff, ...utf16Units('<r/>', false)]],
  ['utf16le no bom', utf16Units('<r/>', true)],
  ['utf16be no bom', utf16Units('<r/>', false)],
  ['utf32le bom', [0xff, 0xfe, 0, 0, ...utf32Units('<r/>', true)]],
  ['utf32be bom', [0, 0, 0xfe, 0xff, ...utf32Units('<r/>', false)]],
  ['utf32le no bom', utf32Units('<r/>', true)],
  ['utf32be no bom', utf32Units('<r/>', false)]
];
for (const [name, sequence] of utf16Sequences) {
  test('non utf8 byte pattern rejected: ' + name, () => {
    assert.equal(unsafeCode(new Uint8Array(sequence)), ERROR.INVALID_UTF8);
  });
}

const invalidUtf8Cases = [
  ['lone continuation', [0x80]],
  ['truncated two byte', [0xc3]],
  ['truncated three byte', [0xe2, 0x82]],
  ['truncated four byte', [0xf0, 0x9f, 0x98]],
  ['overlong slash', [0xc0, 0xaf]],
  ['overlong nul', [0xc0, 0x80]],
  ['surrogate half', [0xed, 0xa0, 0x80]],
  ['out of range', [0xf4, 0x90, 0x80, 0x80]],
  ['invalid second byte', [0xc3, 0x28]],
  ['valid prefix then invalid', [...bytes('<r>'), 0xff]]
];
for (const [name, sequence] of invalidUtf8Cases) {
  test('invalid utf8 rejected: ' + name, () => {
    assert.equal(unsafeCode(new Uint8Array(sequence)), ERROR.INVALID_UTF8);
  });
}

for (const encodingName of ['UTF-8', 'utf-8']) {
  test('xml declaration encoding accepted: ' + encodingName, () => {
    assert.equal(auditXml(bytes('<?xml version="1.0" encoding="' + encodingName + '"?><r/>')).safe, true);
  });
}

for (const encodingName of ['UTF-16', 'UTF16', 'ISO-8859-1', 'US-ASCII', 'Utf8']) {
  test('xml declaration encoding mismatch rejected: ' + encodingName, () => {
    assert.equal(unsafeCode(bytes('<?xml version="1.0" encoding="' + encodingName + '"?><r/>')), ERROR.ENCODING_MISMATCH);
  });
}

test('byte cap is input bytes not characters', () => {
  const input = bytes('<r>π</r>');
  assert.equal(auditXml(input, { maxBytes: input.byteLength }).safe, true);
  assert.equal(unsafeCode(input, { maxBytes: input.byteLength - 1 }), ERROR.MAX_BYTES);
});

test('bytes audit stats count original input bytes', () => {
  const input = new Uint8Array([0xef, 0xbb, 0xbf, ...bytes('<r/>')]);
  assert.equal(auditXml(input).stats.bytes, input.byteLength);
});

test('default export methods all exist in esm', async () => {
  const module = await import('../src/index.mjs');
  for (const key of ['auditXml', 'assertSafeXml', 'parseSafeXml', 'parseSafeXmlBytes', 'escapeXmlText', 'escapeXmlAttr', 'serializeSafeXml', 'createXmlCage']) {
    assert.equal(typeof module.default[key], 'function', key);
  }
});

test('cjs and esm named export parity', () => {
  for (const key of ['XMLCAGE_VERSION', 'XMLCAGE_ERROR_CODES', 'XmlCageError', 'auditXml', 'assertSafeXml', 'parseSafeXml', 'parseSafeXmlBytes', 'escapeXmlText', 'escapeXmlAttr', 'serializeSafeXml', 'createXmlCage']) {
    assert.ok(key in cjs, key);
  }
});

test('cjs parses and audits equivalently', () => {
  assert.equal(cjs.parseSafeXml('<r a="1"/>').root.attributes.a, '1');
  assert.equal(cjs.auditXml('<!DOCTYPE r><r/>').findings[0].code, ERROR.DOCTYPE_FORBIDDEN);
  assert.equal(cjs.escapeXmlText('<&>'), '&lt;&amp;&gt;');
});

test('factory exposes documented methods', () => {
  const cage = createXmlCage();
  for (const key of ['parse', 'parseBytes', 'audit', 'assert', 'escapeText', 'escapeAttr', 'serialize']) {
    assert.equal(typeof cage[key], 'function', key);
  }
});

test('factory applies default options and call options override them', () => {
  const cage = createXmlCage({ maxDepth: 2 });
  assert.throws(() => cage.parse('<a><b><c/></b></a>'), (error) => error.code === ERROR.MAX_DEPTH);
  assert.equal(cage.parse('<a><b><c/></b></a>', { maxDepth: 3 }).root.name, 'a');
});

test('factory parseBytes uses default options', () => {
  const cage = createXmlCage({ maxDepth: 1 });
  assert.throws(() => cage.parseBytes(bytes('<a><b/></a>')), (error) => error.code === ERROR.MAX_DEPTH);
});

test('factory audit uses default options', () => {
  const cage = createXmlCage({ allowDoctype: true });
  assert.equal(cage.audit('<!DOCTYPE r><r/>').safe, true);
});

test('factory escape helpers match top level helpers', () => {
  const cage = createXmlCage();
  assert.equal(cage.escapeText('<&>'), escapeXmlText('<&>'));
  assert.equal(cage.escapeAttr('a\nb'), escapeXmlAttr('a\nb'));
});

test('factory serialize uses parse safety options', () => {
  const cage = createXmlCage({ maxDepth: 2 });
  assert.throws(() => cage.serialize({ name: 'a', children: [{ name: 'b', children: [{ name: 'c' }] }] }), (error) => error.code === ERROR.MAX_DEPTH);
});

test('factory cannot be bypassed with frozen defaults', () => {
  const defaults = Object.freeze({ maxDepth: 1 });
  const cage = createXmlCage(defaults);
  assert.throws(() => cage.parse('<a><b/></a>'), (error) => error.code === ERROR.MAX_DEPTH);
});

test('two factories are isolated', () => {
  const strict = createXmlCage({ allowProcessingInstructions: false });
  const permissive = createXmlCage({ allowProcessingInstructions: true });
  assert.equal(strict.audit('<r><?pi x?></r>').safe, false);
  assert.equal(permissive.audit('<r><?pi x?></r>').safe, true);
});

test('serialize output parses safely by default', () => {
  const xml = serializeSafeXml({ name: 'r', attributes: { a: '<"&' }, children: ['<>&'] });
  const report = auditXml(xml);
  assert.equal(report.safe, true);
});
