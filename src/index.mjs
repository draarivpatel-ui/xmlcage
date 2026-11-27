/*
 * xmlcage core.
 *
 * This file is the single source of truth for both module builds. It has no
 * static imports and no runtime dependencies. The CommonJS build is generated
 * by scripts/build-cjs.mjs.
 */

export const XMLCAGE_VERSION = '1.0.0';

export const XMLCAGE_ERROR_CODES = Object.freeze({
  DOCTYPE_FORBIDDEN: 'XMLCAGE_DOCTYPE_FORBIDDEN',
  ENTITY_FORBIDDEN: 'XMLCAGE_ENTITY_FORBIDDEN',
  EXTERNAL_ID_FORBIDDEN: 'XMLCAGE_EXTERNAL_ID_FORBIDDEN',
  NOTATION_FORBIDDEN: 'XMLCAGE_NOTATION_FORBIDDEN',
  ATTLIST_FORBIDDEN: 'XMLCAGE_ATTLIST_FORBIDDEN',
  ELEMENT_DECLARATION_FORBIDDEN: 'XMLCAGE_ELEMENT_DECLARATION_FORBIDDEN',
  UNKNOWN_ENTITY: 'XMLCAGE_UNKNOWN_ENTITY',
  ILLEGAL_CHAR_REF: 'XMLCAGE_ILLEGAL_CHAR_REF',
  XINCLUDE_FORBIDDEN: 'XMLCAGE_XINCLUDE_FORBIDDEN',
  PROCESSING_INSTRUCTION_FORBIDDEN: 'XMLCAGE_PROCESSING_INSTRUCTION_FORBIDDEN',
  EXTERNAL_SCHEMA_FORBIDDEN: 'XMLCAGE_EXTERNAL_SCHEMA_FORBIDDEN',
  DUPLICATE_ATTRIBUTE: 'XMLCAGE_DUPLICATE_ATTRIBUTE',
  PROTOTYPE_KEY: 'XMLCAGE_PROTOTYPE_KEY',
  MAX_DEPTH: 'XMLCAGE_MAX_DEPTH',
  MAX_BYTES: 'XMLCAGE_MAX_BYTES',
  MAX_ELEMENTS: 'XMLCAGE_MAX_ELEMENTS',
  MAX_ATTRIBUTES: 'XMLCAGE_MAX_ATTRIBUTES',
  MAX_TEXT_LENGTH: 'XMLCAGE_MAX_TEXT_LENGTH',
  MAX_ATTRIBUTE_VALUE_LENGTH: 'XMLCAGE_MAX_ATTRIBUTE_VALUE_LENGTH',
  MAX_NAME_LENGTH: 'XMLCAGE_MAX_NAME_LENGTH',
  MAX_COMMENTS: 'XMLCAGE_MAX_COMMENTS',
  MAX_ENTITY_REFERENCES: 'XMLCAGE_MAX_ENTITY_REFERENCES',
  MAX_EXPANDED_TEXT_BYTES: 'XMLCAGE_MAX_EXPANDED_TEXT_BYTES',
  MAX_PROCESSING_INSTRUCTIONS: 'XMLCAGE_MAX_PROCESSING_INSTRUCTIONS',
  INVALID_UTF8: 'XMLCAGE_INVALID_UTF8',
  MALFORMED_XML: 'XMLCAGE_MALFORMED_XML',
  ENCODING_MISMATCH: 'XMLCAGE_ENCODING_MISMATCH',
  INVALID_INPUT: 'XMLCAGE_INVALID_INPUT',
  INVALID_OPTIONS: 'XMLCAGE_INVALID_OPTIONS',
  UNSUPPORTED_VALUE: 'XMLCAGE_UNSUPPORTED_VALUE',
  CYCLE_DETECTED: 'XMLCAGE_CYCLE_DETECTED'
});

export const CODE = XMLCAGE_ERROR_CODES;

export class XmlCageError extends Error {
  constructor(code, message, details) {
    super(code + ': ' + message);
    this.name = 'XmlCageError';
    this.code = code;
    this.reason = message;
    if (details && typeof details === 'object') {
      for (const key of Object.keys(details)) {
        if (details[key] === undefined) continue;
        if (key === 'name') this.xmlName = details[key];
        else this[key] = details[key];
      }
    }
  }

  toJSON() {
    const output = {
      name: this.name,
      code: this.code,
      reason: this.reason
    };
    for (const key of ['position', 'line', 'column', 'xmlName', 'attribute', 'key', 'limit', 'actual', 'depth']) {
      if (this[key] !== undefined) output[key] = this[key];
    }
    return output;
  }
}

const ERROR = XMLCAGE_ERROR_CODES;
const XML_NAMESPACE = 'http://www.w3.org/XML/1998/namespace';
const XMLNS_NAMESPACE = 'http://www.w3.org/2000/xmlns/';
const XINCLUDE_NAMESPACE = 'http://www.w3.org/2001/XInclude';
const XSI_NAMESPACE = 'http://www.w3.org/2001/XMLSchema-instance';
const DANGEROUS_NAMES = new Set(['__proto__', 'constructor', 'prototype']);

const DEFAULT_OPTIONS = Object.freeze({
  allowDoctype: false,
  allowXInclude: false,
  allowProcessingInstructions: false,
  allowXmlStylesheet: false,
  allowExternalSchemaLocations: false,
  maxBytes: 1048576,
  maxDepth: 32,
  maxElements: 10000,
  maxAttributesPerElement: 64,
  maxTotalAttributes: 25000,
  maxTextLength: 65536,
  maxAttributeValueLength: 8192,
  maxNameLength: 256,
  maxComments: 1000,
  maxEntityReferences: 10000,
  maxExpandedTextBytes: 1048576,
  maxProcessingInstructions: 1000,
  maxFindings: 1024
});

const OPTION_KEYS = new Set(Object.keys(DEFAULT_OPTIONS));
const INTEGER_OPTION_KEYS = [
  'maxBytes',
  'maxDepth',
  'maxElements',
  'maxAttributesPerElement',
  'maxTotalAttributes',
  'maxTextLength',
  'maxAttributeValueLength',
  'maxNameLength',
  'maxComments',
  'maxEntityReferences',
  'maxExpandedTextBytes',
  'maxProcessingInstructions',
  'maxFindings'
];
const BOOLEAN_OPTION_KEYS = [
  'allowDoctype',
  'allowXInclude',
  'allowProcessingInstructions',
  'allowXmlStylesheet',
  'allowExternalSchemaLocations'
];

function invalidOptions(message, key) {
  throw new XmlCageError(ERROR.INVALID_OPTIONS, message, { key });
}

function normalizeOptions(input) {
  if (input === undefined || input === null) input = {};
  if (typeof input !== 'object' || Array.isArray(input)) {
    invalidOptions('options must be a plain object');
  }
  const output = { ...DEFAULT_OPTIONS };
  for (const key of Object.keys(input)) {
    if (!OPTION_KEYS.has(key)) invalidOptions('unknown option', key);
    if (input[key] !== undefined) output[key] = input[key];
  }
  for (const key of INTEGER_OPTION_KEYS) {
    const value = output[key];
    const minimum = key === 'maxBytes' || key === 'maxDepth' || key === 'maxElements' || key === 'maxNameLength' || key === 'maxFindings' ? 1 : 0;
    if (!Number.isSafeInteger(value) || value < minimum || value > 4294967295) {
      invalidOptions(key + ' must be a safe integer within the supported range', key);
    }
  }
  for (const key of BOOLEAN_OPTION_KEYS) {
    if (typeof output[key] !== 'boolean') invalidOptions(key + ' must be a boolean', key);
  }
  return output;
}

function mergeOptions(base, overrides) {
  if (overrides === undefined || overrides === null) return normalizeOptions(base);
  if (typeof overrides !== 'object' || Array.isArray(overrides)) {
    invalidOptions('options must be a plain object');
  }
  return normalizeOptions({ ...base, ...overrides });
}

function mergeSerializeOptions(base, overrides) {
  if (overrides === undefined || overrides === null) return normalizeSerializeOptions(base);
  if (typeof overrides !== 'object' || Array.isArray(overrides)) {
    invalidOptions('options must be a plain object');
  }
  return normalizeSerializeOptions({ ...base, ...overrides });
}

function normalizeSerializeOptions(input) {
  if (input === undefined || input === null) input = {};
  if (typeof input !== 'object' || Array.isArray(input)) {
    invalidOptions('options must be a plain object');
  }
  let xmlDeclaration = false;
  const parserOptions = {};
  for (const key of Object.keys(input)) {
    if (key === 'xmlDeclaration') {
      xmlDeclaration = input[key];
    } else if (OPTION_KEYS.has(key)) {
      parserOptions[key] = input[key];
    } else {
      invalidOptions('unknown option', key);
    }
  }
  if (typeof xmlDeclaration !== 'boolean') invalidOptions('xmlDeclaration must be a boolean', 'xmlDeclaration');
  const output = normalizeOptions(parserOptions);
  output.xmlDeclaration = xmlDeclaration;
  return output;
}

function isHighSurrogate(unit) {
  return unit >= 0xd800 && unit <= 0xdbff;
}

function isLowSurrogate(unit) {
  return unit >= 0xdc00 && unit <= 0xdfff;
}

function utf8ByteLength(text) {
  let bytes = 0;
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index);
    if (unit <= 0x7f) {
      bytes += 1;
    } else if (unit <= 0x7ff) {
      bytes += 2;
    } else if (isHighSurrogate(unit) && index + 1 < text.length && isLowSurrogate(text.charCodeAt(index + 1))) {
      bytes += 4;
      index += 1;
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

function makeFinding(code, message, details) {
  const finding = { code, message };
  if (details && typeof details === 'object') {
    for (const key of Object.keys(details)) {
      if (details[key] !== undefined) finding[key] = details[key];
    }
  }
  return finding;
}

function emptyStats() {
  return {
    bytes: 0,
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

function copyStats(stats) {
  return { ...stats };
}

function fail(code, message, details) {
  throw new XmlCageError(code, message, details);
}

function isXmlWhitespaceUnit(unit) {
  return unit === 0x20 || unit === 0x9 || unit === 0xa || unit === 0xd;
}

function isAsciiLetter(character) {
  return (character >= 'A' && character <= 'Z') || (character >= 'a' && character <= 'z');
}

function isLegalXmlCodePoint(codePoint) {
  return codePoint === 0x9 ||
    codePoint === 0xa ||
    codePoint === 0xd ||
    (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
    (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
    (codePoint >= 0x10000 && codePoint <= 0x10ffff);
}

function validateXmlCharacters(text) {
  for (let index = 0; index < text.length; index += 1) {
    const first = text.charCodeAt(index);
    let codePoint = first;
    if (isHighSurrogate(first)) {
      if (index + 1 >= text.length || !isLowSurrogate(text.charCodeAt(index + 1))) {
        fail(ERROR.MALFORMED_XML, 'lone UTF-16 surrogate is not a legal XML 1.0 character', {
          position: index,
          codePoint: first
        });
      }
      codePoint = 0x10000 + ((first - 0xd800) << 10) + text.charCodeAt(index + 1) - 0xdc00;
      index += 1;
    } else if (isLowSurrogate(first)) {
      fail(ERROR.MALFORMED_XML, 'lone UTF-16 surrogate is not a legal XML 1.0 character', {
        position: index,
        codePoint: first
      });
    }
    if (!isLegalXmlCodePoint(codePoint)) {
      fail(ERROR.MALFORMED_XML, 'character is outside the legal XML 1.0 character range', {
        position: index,
        codePoint
      });
    }
  }
}

function isXmlNameStartCodePoint(codePoint) {
  return codePoint === 0x3a ||
    codePoint === 0x5f ||
    (codePoint >= 0x41 && codePoint <= 0x5a) ||
    (codePoint >= 0x61 && codePoint <= 0x7a) ||
    (codePoint >= 0xc0 && codePoint <= 0xd6) ||
    (codePoint >= 0xd8 && codePoint <= 0xf6) ||
    (codePoint >= 0xf8 && codePoint <= 0x2ff) ||
    (codePoint >= 0x370 && codePoint <= 0x37d) ||
    (codePoint >= 0x37f && codePoint <= 0x1fff) ||
    (codePoint >= 0x200c && codePoint <= 0x200d) ||
    (codePoint >= 0x2070 && codePoint <= 0x218f) ||
    (codePoint >= 0x2c00 && codePoint <= 0x2fef) ||
    (codePoint >= 0x3001 && codePoint <= 0xd7ff) ||
    (codePoint >= 0xf900 && codePoint <= 0xfdcf) ||
    (codePoint >= 0xfdf0 && codePoint <= 0xfffd) ||
    (codePoint >= 0x10000 && codePoint <= 0xeffff);
}

function isXmlNameCodePoint(codePoint) {
  return isXmlNameStartCodePoint(codePoint) ||
    codePoint === 0x2d ||
    codePoint === 0x2e ||
    (codePoint >= 0x30 && codePoint <= 0x39) ||
    codePoint === 0xb7 ||
    (codePoint >= 0x300 && codePoint <= 0x36f) ||
    codePoint === 0x203f ||
    codePoint === 0x2040;
}

function codePointAt(text, index) {
  const first = text.charCodeAt(index);
  if (isHighSurrogate(first) && index + 1 < text.length && isLowSurrogate(text.charCodeAt(index + 1))) {
    return {
      codePoint: 0x10000 + ((first - 0xd800) << 10) + text.charCodeAt(index + 1) - 0xdc00,
      width: 2
    };
  }
  return { codePoint: first, width: 1 };
}

function splitQName(name) {
  const parts = name.split(':');
  if (parts.length > 2 || parts.some((part) => part.length === 0)) return null;
  if (parts.length === 1) return { prefix: null, localName: parts[0] };
  return { prefix: parts[0], localName: parts[1] };
}

function isDangerousXmlName(name) {
  const parts = splitQName(name);
  return DANGEROUS_NAMES.has(name) || (parts !== null && DANGEROUS_NAMES.has(parts.localName));
}

function validateQNameOrFail(name, position, options, kind) {
  if (name.length > options.maxNameLength) {
    fail(ERROR.MAX_NAME_LENGTH, 'maximum XML name length exceeded', {
      position,
      limit: options.maxNameLength,
      actual: name.length,
      name: name.slice(0, 80)
    });
  }
  const parts = splitQName(name);
  if (parts === null) {
    fail(ERROR.MALFORMED_XML, 'qualified XML name is malformed', { position, name });
  }
  if (isDangerousXmlName(name)) {
    fail(ERROR.PROTOTYPE_KEY, 'prototype pollution name rejected in XML ' + kind, {
      position,
      name,
      key: name
    });
  }
  return parts;
}

function readName(ctx) {
  const text = ctx.text;
  const start = ctx.pos;
  if (start >= text.length) return null;
  const first = codePointAt(text, start);
  if (!isXmlNameStartCodePoint(first.codePoint)) return null;
  let index = start + first.width;
  while (index < text.length) {
    if (index - start > ctx.options.maxNameLength) {
      fail(ERROR.MAX_NAME_LENGTH, 'maximum XML name length exceeded', {
        position: start,
        limit: ctx.options.maxNameLength,
        actual: index - start
      });
    }
    const next = codePointAt(text, index);
    if (!isXmlNameCodePoint(next.codePoint)) break;
    index += next.width;
  }
  const name = text.slice(start, index);
  if (name.length > ctx.options.maxNameLength) {
    fail(ERROR.MAX_NAME_LENGTH, 'maximum XML name length exceeded', {
      position: start,
      limit: ctx.options.maxNameLength,
      actual: name.length,
      name: name.slice(0, 80)
    });
  }
  ctx.pos = index;
  return name;
}

function skipWhitespace(ctx) {
  let moved = false;
  while (ctx.pos < ctx.text.length && isXmlWhitespaceUnit(ctx.text.charCodeAt(ctx.pos))) {
    ctx.pos += 1;
    moved = true;
  }
  return moved;
}

function expectCharacter(ctx, character, message) {
  if (ctx.text[ctx.pos] !== character) {
    fail(ERROR.MALFORMED_XML, message, { position: ctx.pos });
  }
  ctx.pos += 1;
}

function startsWithAt(text, position, value) {
  return text.startsWith(value, position);
}

function normalizeXmlText(input) {
  let text = input;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  if (text.includes('\r')) text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return text;
}

function createLineIndexer(text) {
  let starts = null;
  return (position) => {
    if (starts === null) {
      starts = [0];
      for (let index = 0; index < text.length; index += 1) {
        if (text.charCodeAt(index) === 10) starts.push(index + 1);
      }
    }
    const end = Math.max(0, Math.min(position, text.length));
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const middle = Math.floor((low + high + 1) / 2);
      if (starts[middle] <= end) low = middle;
      else high = middle - 1;
    }
    return { line: low + 1, column: end - starts[low] + 1 };
  };
}

function addPositionDetails(finding, lineIndexer) {
  if (typeof finding.position !== 'number' || lineIndexer === null || lineIndexer === undefined) return finding;
  const location = lineIndexer(finding.position);
  finding.line = location.line;
  finding.column = location.column;
  return finding;
}

function pushLimitedFinding(findings, text, options, code, message, details, lineIndexer) {
  if (findings.length >= options.maxFindings) return;
  findings.push(addPositionDetails(makeFinding(code, message, details), lineIndexer));
}

function readMarkupKeyword(text, position) {
  let index = position + 2;
  let exact = '';
  let folded = '';
  let distorted = false;
  let inspected = 0;
  while (index < text.length && inspected < 128 && folded.length < 24) {
    if (text.startsWith('<!--', index)) {
      const commentEnd = text.indexOf('-->', index + 4);
      if (commentEnd === -1) break;
      distorted = true;
      inspected += commentEnd + 3 - index;
      index = commentEnd + 3;
      continue;
    }
    const character = text[index];
    if (isAsciiLetter(character)) {
      exact += character;
      folded += character.toUpperCase();
      index += 1;
      inspected += 1;
      continue;
    }
    break;
  }
  return { exact, folded, distorted, end: index };
}

function findMarkupEnd(text, position, limit) {
  let quote = null;
  let bracketDepth = 0;
  const endLimit = limit === undefined ? text.length : Math.min(limit, text.length);
  for (let index = position + 2; index < endLimit; index += 1) {
    const character = text[index];
    if (quote !== null) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '[') {
      bracketDepth += 1;
      continue;
    }
    if (character === ']' && bracketDepth > 0) {
      bracketDepth -= 1;
      continue;
    }
    if (character === '>' && bracketDepth === 0) return index;
  }
  return -1;
}

function externalIdentifierPosition(text, start, end) {
  const length = Math.max(0, end - start + 1);
  const slice = text.slice(start, start + length);
  const match = /\b(?:SYSTEM|PUBLIC)\b/i.exec(slice);
  return match === null ? -1 : start + match.index;
}

function scanRawThreatRange(text, rangeStart, rangeEnd, options, findings, lineIndexer, depth) {
  let position = rangeStart;
  while (position < rangeEnd) {
    if (findings.length >= options.maxFindings) return;
    if (text.startsWith('<!--', position)) {
      const end = text.indexOf('-->', position + 4);
      if (end === -1 || end + 3 > rangeEnd) return;
      position = end + 3;
      continue;
    }
    if (text.startsWith('<![CDATA[', position)) {
      const end = text.indexOf(']]>', position + 9);
      if (end === -1 || end + 3 > rangeEnd) return;
      position = end + 3;
      continue;
    }
    if (text.charCodeAt(position) === 0x3c && text.charCodeAt(position + 1) === 0x21) {
      const keyword = readMarkupKeyword(text, position);
      const declarationKind = keyword.folded === 'DOCTYPE' || keyword.folded === 'ENTITY' || keyword.folded === 'NOTATION' || keyword.folded === 'ATTLIST' || keyword.folded === 'ELEMENT';
      if (declarationKind) {
        const end = findMarkupEnd(text, position, rangeEnd);
        const scanEnd = end === -1 ? rangeEnd : end + 1;
        const inclusiveEnd = scanEnd - 1;
        const canonical = !keyword.distorted && keyword.exact === keyword.folded;
        if (keyword.folded === 'DOCTYPE') {
          const externalPosition = externalIdentifierPosition(text, position, inclusiveEnd);
          const subsetStart = text.indexOf('[', position);
          const hasSubset = subsetStart !== -1 && subsetStart < scanEnd;
          if (!options.allowDoctype || !canonical || hasSubset) {
            const reason = hasSubset && options.allowDoctype
              ? 'DTD internal subsets are forbidden even when a simple DOCTYPE is allowed'
              : 'DOCTYPE declarations are forbidden by the XML security policy';
            pushLimitedFinding(findings, text, options, ERROR.DOCTYPE_FORBIDDEN, reason, { position }, lineIndexer);
          }
          if (externalPosition !== -1) {
            pushLimitedFinding(findings, text, options, ERROR.EXTERNAL_ID_FORBIDDEN, 'SYSTEM or PUBLIC external identifiers are forbidden', {
              position: externalPosition
            }, lineIndexer);
          }
          if (hasSubset && depth < 4) {
            scanRawThreatRange(text, subsetStart + 1, scanEnd, options, findings, lineIndexer, depth + 1);
          }
        } else if (keyword.folded === 'ENTITY') {
          const parameterProbe = text.slice(position, Math.min(scanEnd, position + 160));
          const parameter = /<!ENTITY\s+%/i.test(parameterProbe);
          pushLimitedFinding(findings, text, options, ERROR.ENTITY_FORBIDDEN, parameter
            ? 'parameter entity declarations are forbidden'
            : 'custom entity declarations are forbidden', { position, parameter }, lineIndexer);
          const externalPosition = externalIdentifierPosition(text, position, inclusiveEnd);
          if (externalPosition !== -1) {
            pushLimitedFinding(findings, text, options, ERROR.EXTERNAL_ID_FORBIDDEN, 'SYSTEM or PUBLIC external identifiers are forbidden', {
              position: externalPosition
            }, lineIndexer);
          }
        } else if (keyword.folded === 'NOTATION') {
          pushLimitedFinding(findings, text, options, ERROR.NOTATION_FORBIDDEN, 'NOTATION declarations are forbidden', { position }, lineIndexer);
          const externalPosition = externalIdentifierPosition(text, position, inclusiveEnd);
          if (externalPosition !== -1) {
            pushLimitedFinding(findings, text, options, ERROR.EXTERNAL_ID_FORBIDDEN, 'SYSTEM or PUBLIC external identifiers are forbidden', {
              position: externalPosition
            }, lineIndexer);
          }
        } else if (keyword.folded === 'ATTLIST') {
          pushLimitedFinding(findings, text, options, ERROR.ATTLIST_FORBIDDEN, 'ATTLIST declarations are forbidden', { position }, lineIndexer);
        } else if (keyword.folded === 'ELEMENT') {
          pushLimitedFinding(findings, text, options, ERROR.ELEMENT_DECLARATION_FORBIDDEN, 'ELEMENT declarations are forbidden', { position }, lineIndexer);
        }
        if (end === -1) return;
        position = end + 1;
        continue;
      }
    }
    position += 1;
  }
}

function scanRawThreats(text, options, lineIndexer) {
  const findings = [];
  scanRawThreatRange(text, 0, text.length, options, findings, lineIndexer, 0);
  return findings;
}

function throwFirstFinding(findings) {
  if (findings.length === 0) return;
  const first = findings[0];
  const details = {};
  for (const key of Object.keys(first)) {
    if (key !== 'code' && key !== 'message') details[key] = first[key];
  }
  throw new XmlCageError(first.code, first.message, details);
}

function scanAndThrow(text, options) {
  throwFirstFinding(scanRawThreats(text, { ...options, maxFindings: 1 }));
}

function createContext(text, options, byteLength, stats) {
  const context = {
    text,
    pos: 0,
    options,
    stats: stats || emptyStats(),
    nsBindings: Object.create(null),
    doctypeSeen: false
  };
  context.stats.bytes = byteLength;
  return context;
}

function newNode(type) {
  const node = Object.create(null);
  node.type = type;
  return node;
}

function addDocumentNode(ctx, documentNode, node, insideRoot) {
  if (insideRoot) {
    documentNode.epilog.push(node);
  } else {
    documentNode.prolog.push(node);
  }
  documentNode.children.push(node);
}

function countEntityReference(ctx, replacement, position) {
  ctx.stats.entityReferences += 1;
  if (ctx.stats.entityReferences > ctx.options.maxEntityReferences) {
    fail(ERROR.MAX_ENTITY_REFERENCES, 'maximum entity or character reference count exceeded', {
      position,
      limit: ctx.options.maxEntityReferences,
      actual: ctx.stats.entityReferences
    });
  }
  const expansionBytes = utf8ByteLength(replacement);
  if (ctx.stats.expandedTextBytes + expansionBytes > ctx.options.maxExpandedTextBytes) {
    fail(ERROR.MAX_EXPANDED_TEXT_BYTES, 'maximum expanded entity text byte count exceeded', {
      position,
      limit: ctx.options.maxExpandedTextBytes,
      actual: ctx.stats.expandedTextBytes + expansionBytes
    });
  }
  ctx.stats.expandedTextBytes += expansionBytes;
}

function isLegalXmlScalar(codePoint) {
  return isLegalXmlCodePoint(codePoint);
}

function decodeNumericReference(body, position) {
  let value = 0;
  let digits;
  let hexadecimal = false;
  if (body.startsWith('#x')) {
    hexadecimal = true;
    digits = body.slice(2);
  } else {
    digits = body.slice(1);
  }
  if (digits.length === 0) {
    fail(ERROR.ILLEGAL_CHAR_REF, 'numeric character reference has no digits', { position });
  }
  for (let index = 0; index < digits.length; index += 1) {
    const unit = digits.charCodeAt(index);
    let digit = -1;
    if (unit >= 0x30 && unit <= 0x39) digit = unit - 0x30;
    else if (hexadecimal && unit >= 0x41 && unit <= 0x46) digit = unit - 0x41 + 10;
    else if (hexadecimal && unit >= 0x61 && unit <= 0x66) digit = unit - 0x61 + 10;
    if (digit < 0) {
      fail(ERROR.ILLEGAL_CHAR_REF, 'numeric character reference contains a non-digit', { position });
    }
    value = value * (hexadecimal ? 16 : 10) + digit;
    if (value > 0x10ffff) {
      fail(ERROR.ILLEGAL_CHAR_REF, 'numeric character reference is outside the Unicode range', {
        position,
        actual: value
      });
    }
  }
  if (!isLegalXmlScalar(value)) {
    fail(ERROR.ILLEGAL_CHAR_REF, 'numeric character reference is not a legal XML 1.0 scalar', {
      position,
      actual: value
    });
  }
  return String.fromCodePoint(value);
}

function parseReference(ctx, position, end) {
  const text = ctx.text;
  let cursor = position + 1;
  if (cursor >= end) {
    fail(ERROR.MALFORMED_XML, 'unterminated entity reference', { position });
  }
  let semicolon = cursor;
  while (semicolon < end && text.charCodeAt(semicolon) !== 0x3b) {
    if (semicolon - cursor > ctx.options.maxNameLength) {
      fail(ERROR.MAX_NAME_LENGTH, 'maximum entity reference name length exceeded', {
        position,
        limit: ctx.options.maxNameLength,
        actual: semicolon - cursor
      });
    }
    semicolon += 1;
  }
  if (semicolon >= end) {
    fail(ERROR.MALFORMED_XML, 'unterminated entity reference', { position });
  }
  const body = text.slice(cursor, semicolon);
  if (body.length > ctx.options.maxNameLength) {
    fail(ERROR.MAX_NAME_LENGTH, 'maximum entity reference name length exceeded', {
      position,
      limit: ctx.options.maxNameLength,
      actual: body.length
    });
  }
  if (body.length === 0) {
    fail(ERROR.MALFORMED_XML, 'empty entity reference', { position });
  }
  let replacement;
  if (body.charCodeAt(0) === 0x23) {
    replacement = decodeNumericReference(body, position);
  } else if (body === 'amp') {
    replacement = '&';
  } else if (body === 'lt') {
    replacement = '<';
  } else if (body === 'gt') {
    replacement = '>';
  } else if (body === 'quot') {
    replacement = '"';
  } else if (body === 'apos') {
    replacement = "'";
  } else {
    fail(ERROR.UNKNOWN_ENTITY, 'unknown or custom entity reference rejected', {
      position,
      name: body.slice(0, 80)
    });
  }
  countEntityReference(ctx, replacement, position);
  return { replacement, end: semicolon + 1 };
}

function appendLimitedPart(parts, state, part, limit, position, code, message) {
  if (state.length + part.length > limit) {
    fail(code, message, {
      position,
      limit,
      actual: state.length + part.length
    });
  }
  state.length += part.length;
  parts.push(part);
}

function decodeTextRange(ctx, start, end, attributeMode) {
  const text = ctx.text;
  const parts = [];
  const state = { length: 0 };
  const limit = attributeMode ? ctx.options.maxAttributeValueLength : ctx.options.maxTextLength;
  const code = attributeMode ? ERROR.MAX_ATTRIBUTE_VALUE_LENGTH : ERROR.MAX_TEXT_LENGTH;
  const message = attributeMode ? 'maximum attribute value length exceeded' : 'maximum text node length exceeded';
  let chunkStart = start;
  let position = start;

  function flush(until) {
    if (until <= chunkStart) return;
    const rawLength = until - chunkStart;
    if (state.length + rawLength > limit) {
      fail(code, message, {
        position: chunkStart,
        limit,
        actual: state.length + rawLength
      });
    }
    let chunk = text.slice(chunkStart, until);
    if (attributeMode && (chunk.includes('\t') || chunk.includes('\n'))) {
      chunk = chunk.replace(/[\t\n]/g, ' ');
    }
    appendLimitedPart(parts, state, chunk, limit, chunkStart, code, message);
  }

  while (position < end) {
    const character = text[position];
    if (character === '&') {
      flush(position);
      const reference = parseReference(ctx, position, end);
      appendLimitedPart(parts, state, reference.replacement, limit, position, code, message);
      position = reference.end;
      chunkStart = position;
      continue;
    }
    if (attributeMode && character === '<') {
      fail(ERROR.MALFORMED_XML, 'raw less-than sign is forbidden in an attribute value', { position });
    }
    position += 1;
  }
  flush(end);
  return parts.join('');
}

function incrementElements(ctx, position) {
  if (ctx.stats.elements + 1 > ctx.options.maxElements) {
    fail(ERROR.MAX_ELEMENTS, 'maximum XML element count exceeded', {
      position,
      limit: ctx.options.maxElements,
      actual: ctx.stats.elements + 1
    });
  }
  ctx.stats.elements += 1;
}

function incrementAttributes(ctx, position) {
  if (ctx.stats.attributes + 1 > ctx.options.maxTotalAttributes) {
    fail(ERROR.MAX_ATTRIBUTES, 'maximum total XML attribute count exceeded', {
      position,
      limit: ctx.options.maxTotalAttributes,
      actual: ctx.stats.attributes + 1
    });
  }
  ctx.stats.attributes += 1;
}

function validateNamespaceUri(value, position) {
  if (value.length === 0) return;
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (isXmlWhitespaceUnit(unit) || unit < 0x20) {
      fail(ERROR.MALFORMED_XML, 'namespace URI contains whitespace or a control character', { position });
    }
  }
}

function applyNamespaceBindings(ctx, attributes) {
  const undo = [];
  for (const attribute of attributes) {
    let prefix = null;
    if (attribute.name === 'xmlns') prefix = '';
    else if (attribute.name.startsWith('xmlns:')) prefix = attribute.name.slice(6);
    if (prefix === null) continue;
    const value = attribute.value;
    validateNamespaceUri(value, attribute.position);
    if (prefix === 'xmlns') {
      fail(ERROR.MALFORMED_XML, 'the xmlns prefix must not be rebound', { position: attribute.position });
    }
    if (prefix === 'xml' && value !== XML_NAMESPACE) {
      fail(ERROR.MALFORMED_XML, 'the xml prefix must bind to its reserved namespace', { position: attribute.position });
    }
    if (prefix !== 'xml' && value === XML_NAMESPACE) {
      fail(ERROR.MALFORMED_XML, 'the reserved XML namespace must use the xml prefix', { position: attribute.position });
    }
    if (value === XMLNS_NAMESPACE) {
      fail(ERROR.MALFORMED_XML, 'the xmlns namespace URI must not be bound as a normal namespace', { position: attribute.position });
    }
    if (prefix !== '' && value.length === 0) {
      fail(ERROR.MALFORMED_XML, 'a prefixed namespace binding must not be empty', { position: attribute.position });
    }
    undo.push({
      prefix,
      had: Object.hasOwn(ctx.nsBindings, prefix),
      previous: ctx.nsBindings[prefix]
    });
    ctx.nsBindings[prefix] = value;
  }
  return undo;
}

function undoNamespaceBindings(ctx, undo) {
  for (let index = undo.length - 1; index >= 0; index -= 1) {
    const entry = undo[index];
    if (entry.had) ctx.nsBindings[entry.prefix] = entry.previous;
    else delete ctx.nsBindings[entry.prefix];
  }
}

function lookupNamespace(ctx, prefix) {
  if (prefix === 'xml') return XML_NAMESPACE;
  if (prefix === 'xmlns') return XMLNS_NAMESPACE;
  if (Object.hasOwn(ctx.nsBindings, prefix)) {
    const value = ctx.nsBindings[prefix];
    return value.length === 0 ? null : value;
  }
  return null;
}

function resolveElementNamespace(ctx, parts, position) {
  if (parts.prefix === null) {
    return lookupNamespace(ctx, '') || null;
  }
  if (parts.prefix === 'xmlns') {
    fail(ERROR.MALFORMED_XML, 'the xmlns prefix must not be used as an element prefix', { position });
  }
  const namespaceURI = lookupNamespace(ctx, parts.prefix);
  if (namespaceURI === null) {
    fail(ERROR.MALFORMED_XML, 'element namespace prefix is not bound', {
      position,
      name: parts.prefix
    });
  }
  return namespaceURI;
}

function resolveAttributeNamespaces(ctx, attributes) {
  const seen = new Set();
  for (const attribute of attributes) {
    if (attribute.name === 'xmlns' || attribute.name.startsWith('xmlns:')) {
      attribute.namespaceURI = XMLNS_NAMESPACE;
      continue;
    }
    const parts = splitQName(attribute.name);
    let namespaceURI = null;
    if (parts.prefix !== null) {
      if (parts.prefix === 'xmlns') {
        fail(ERROR.MALFORMED_XML, 'the xmlns prefix is reserved', { position: attribute.position });
      }
      namespaceURI = lookupNamespace(ctx, parts.prefix);
      if (namespaceURI === null) {
        fail(ERROR.MALFORMED_XML, 'attribute namespace prefix is not bound', {
          position: attribute.position,
          name: parts.prefix
        });
      }
    }
    attribute.namespaceURI = namespaceURI;
    const identity = (namespaceURI || '') + '\u0001' + parts.localName;
    if (seen.has(identity)) {
      fail(ERROR.DUPLICATE_ATTRIBUTE, 'duplicate attribute after namespace resolution', {
        position: attribute.position,
        attribute: attribute.name
      });
    }
    seen.add(identity);
  }
}

function isExternalSchemaReference(value) {
  const reference = value.trim();
  if (reference.length === 0) return false;
  if (reference.startsWith('//') || reference.startsWith('\\\\')) return true;
  if (reference.startsWith('/') || reference.startsWith('\\')) return true;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(reference)) return true;
  const segments = reference.split(/[\\/]+/);
  return segments.includes('..');
}

function schemaAttributeIsExternal(attribute) {
  const localName = attribute.localName.toLowerCase();
  const tokens = attribute.value.trim().length === 0 ? [] : attribute.value.trim().split(/\s+/);
  if (localName === 'nonamespaceschemalocation') {
    return tokens.some((token) => isExternalSchemaReference(token));
  }
  if (tokens.length % 2 === 1) return true;
  for (let index = 1; index < tokens.length; index += 2) {
    if (isExternalSchemaReference(tokens[index])) return true;
  }
  return false;
}

function checkExternalSchemaAttributes(ctx, attributes) {
  if (ctx.options.allowExternalSchemaLocations) return;
  for (const attribute of attributes) {
    const localName = attribute.localName.toLowerCase();
    const schemaName = localName === 'schemalocation' || localName === 'nonamespaceschemalocation';
    if (!schemaName) continue;
    const namespaceMatch = attribute.namespaceURI === XSI_NAMESPACE;
    const prefixMatch = attribute.prefix !== null && attribute.prefix.toLowerCase() === 'xsi';
    if (!namespaceMatch && !prefixMatch) continue;
    if (schemaAttributeIsExternal(attribute)) {
      fail(ERROR.EXTERNAL_SCHEMA_FORBIDDEN, 'external XML schema locations are forbidden', {
        position: attribute.position,
        attribute: attribute.name
      });
    }
  }
}

function parseAttribute(ctx, elementPosition) {
  const position = ctx.pos;
  const name = readName(ctx);
  if (name === null) {
    fail(ERROR.MALFORMED_XML, 'expected an attribute name', { position });
  }
  const parts = validateQNameOrFail(name, position, ctx.options, 'attribute');
  skipWhitespace(ctx);
  expectCharacter(ctx, '=', 'expected equals sign after attribute name');
  skipWhitespace(ctx);
  const quote = ctx.text[ctx.pos];
  if (quote !== '"' && quote !== "'") {
    fail(ERROR.MALFORMED_XML, 'attribute value must be quoted', { position: ctx.pos });
  }
  ctx.pos += 1;
  const valueStart = ctx.pos;
  let valueEnd = valueStart;
  while (valueEnd < ctx.text.length && ctx.text[valueEnd] !== quote) {
    valueEnd += 1;
  }
  if (valueEnd >= ctx.text.length) {
    fail(ERROR.MALFORMED_XML, 'unterminated attribute value', { position: valueStart });
  }
  const value = decodeTextRange(ctx, valueStart, valueEnd, true);
  ctx.pos = valueEnd + 1;
  if (isDangerousXmlName(name)) {
    fail(ERROR.PROTOTYPE_KEY, 'prototype pollution attribute name rejected', {
      position,
      attribute: name,
      key: name
    });
  }
  if (value.length > ctx.options.maxAttributeValueLength) {
    fail(ERROR.MAX_ATTRIBUTE_VALUE_LENGTH, 'maximum attribute value length exceeded', {
      position: valueStart,
      limit: ctx.options.maxAttributeValueLength,
      actual: value.length
    });
  }
  return {
    name,
    prefix: parts.prefix,
    localName: parts.localName,
    namespaceURI: null,
    value,
    position,
    elementPosition
  };
}

function parseStartTag(ctx) {
  const startPosition = ctx.pos;
  const depth = ctx.openElements.length + 1;
  if (depth > ctx.options.maxDepth) {
    fail(ERROR.MAX_DEPTH, 'maximum XML nesting depth exceeded', {
      position: startPosition,
      limit: ctx.options.maxDepth,
      actual: depth,
      depth
    });
  }
  incrementElements(ctx, startPosition);
  ctx.pos += 1;
  const namePosition = ctx.pos;
  const name = readName(ctx);
  if (name === null) {
    fail(ERROR.MALFORMED_XML, 'expected an element name after less-than sign', { position: namePosition });
  }
  const parts = validateQNameOrFail(name, namePosition, ctx.options, 'element');
  if (isDangerousXmlName(name)) {
    fail(ERROR.PROTOTYPE_KEY, 'prototype pollution element name rejected', {
      position: namePosition,
      name,
      key: name
    });
  }

  const attributes = [];
  const rawNames = new Set();
  let selfClosing = false;
  let hadWhitespace = false;
  for (;;) {
    const whitespace = skipWhitespace(ctx);
    hadWhitespace = hadWhitespace || whitespace;
    if (startsWithAt(ctx.text, ctx.pos, '/>')) {
      ctx.pos += 2;
      selfClosing = true;
      break;
    }
    if (ctx.text[ctx.pos] === '>') {
      ctx.pos += 1;
      break;
    }
    if (ctx.pos >= ctx.text.length) {
      fail(ERROR.MALFORMED_XML, 'unterminated start tag', { position: startPosition });
    }
    if (!hadWhitespace) {
      fail(ERROR.MALFORMED_XML, 'attributes must be separated by whitespace', { position: ctx.pos });
    }
    if (attributes.length >= ctx.options.maxAttributesPerElement) {
      fail(ERROR.MAX_ATTRIBUTES, 'maximum attributes per element exceeded', {
        position: ctx.pos,
        limit: ctx.options.maxAttributesPerElement,
        actual: attributes.length + 1
      });
    }
    const attribute = parseAttribute(ctx, startPosition);
    if (rawNames.has(attribute.name)) {
      fail(ERROR.DUPLICATE_ATTRIBUTE, 'duplicate attribute on element', {
        position: attribute.position,
        attribute: attribute.name
      });
    }
    rawNames.add(attribute.name);
    incrementAttributes(ctx, attribute.position);
    attributes.push(attribute);
    hadWhitespace = false;
  }

  const undo = applyNamespaceBindings(ctx, attributes);
  checkExternalSchemaAttributes(ctx, attributes);
  const loweredName = name.toLowerCase();
  if (!ctx.options.allowXInclude && loweredName.startsWith('xi:')) {
    undoNamespaceBindings(ctx, undo);
    fail(ERROR.XINCLUDE_FORBIDDEN, 'XInclude elements are forbidden by the XML security policy', {
      position: startPosition,
      name
    });
  }
  const namespaceURI = resolveElementNamespace(ctx, parts, namePosition);
  resolveAttributeNamespaces(ctx, attributes);
  checkExternalSchemaAttributes(ctx, attributes);
  if (!ctx.options.allowXInclude && namespaceURI === XINCLUDE_NAMESPACE) {
    undoNamespaceBindings(ctx, undo);
    fail(ERROR.XINCLUDE_FORBIDDEN, 'XInclude elements are forbidden by the XML security policy', {
      position: startPosition,
      name
    });
  }

  const element = newNode('element');
  element.name = name;
  element.localName = parts.localName;
  element.prefix = parts.prefix;
  element.namespaceURI = namespaceURI;
  element.attributes = Object.create(null);
  const attributeList = [];
  for (const attribute of attributes) {
    element.attributes[attribute.name] = attribute.value;
    const exposed = Object.create(null);
    exposed.name = attribute.name;
    exposed.localName = attribute.localName;
    exposed.prefix = attribute.prefix;
    exposed.namespaceURI = attribute.namespaceURI;
    exposed.value = attribute.value;
    attributeList.push(exposed);
  }
  element.attributeList = attributeList;
  element.children = [];
  element.depth = depth;

  if (depth > ctx.stats.maxDepthObserved) ctx.stats.maxDepthObserved = depth;
  return { element, selfClosing, undo, name, depth };
}

function parseEndTag(ctx) {
  const position = ctx.pos;
  ctx.pos += 2;
  const namePosition = ctx.pos;
  const name = readName(ctx);
  if (name === null) {
    fail(ERROR.MALFORMED_XML, 'expected an element name in end tag', { position: namePosition });
  }
  validateQNameOrFail(name, namePosition, ctx.options, 'element');
  skipWhitespace(ctx);
  expectCharacter(ctx, '>', 'expected greater-than sign at end of end tag');
  if (ctx.openElements.length === 0) {
    fail(ERROR.MALFORMED_XML, 'end tag has no matching start tag', { position, name });
  }
  const frame = ctx.openElements[ctx.openElements.length - 1];
  if (frame.name !== name) {
    fail(ERROR.MALFORMED_XML, 'end tag does not match the open element', {
      position,
      name,
      expected: frame.name
    });
  }
  ctx.openElements.pop();
  undoNamespaceBindings(ctx, frame.undo);
}

function parseComment(ctx) {
  const position = ctx.pos;
  if (ctx.stats.comments + 1 > ctx.options.maxComments) {
    fail(ERROR.MAX_COMMENTS, 'maximum XML comment count exceeded', {
      position,
      limit: ctx.options.maxComments,
      actual: ctx.stats.comments + 1
    });
  }
  ctx.stats.comments += 1;
  const contentStart = position + 4;
  let cursor = contentStart;
  for (;;) {
    const hyphen = ctx.text.indexOf('--', cursor);
    if (hyphen === -1) {
      fail(ERROR.MALFORMED_XML, 'unterminated XML comment', { position });
    }
    if (ctx.text[hyphen + 2] === '>') {
      const value = ctx.text.slice(contentStart, hyphen);
      ctx.pos = hyphen + 3;
      const node = newNode('comment');
      node.value = value;
      return node;
    }
    fail(ERROR.MALFORMED_XML, 'double hyphen is forbidden inside an XML comment', { position: hyphen });
  }
}

function parseCdata(ctx) {
  const position = ctx.pos;
  const contentStart = position + 9;
  const end = ctx.text.indexOf(']]>', contentStart);
  if (end === -1) {
    fail(ERROR.MALFORMED_XML, 'unterminated CDATA section', { position });
  }
  const length = end - contentStart;
  if (length > ctx.options.maxTextLength) {
    fail(ERROR.MAX_TEXT_LENGTH, 'maximum CDATA section length exceeded', {
      position: contentStart,
      limit: ctx.options.maxTextLength,
      actual: length
    });
  }
  ctx.stats.cdataSections += 1;
  ctx.stats.textCharacters += length;
  const node = newNode('cdata');
  node.value = ctx.text.slice(contentStart, end);
  ctx.pos = end + 3;
  return node;
}

function parseProcessingInstruction(ctx) {
  const position = ctx.pos;
  if (ctx.stats.processingInstructions + 1 > ctx.options.maxProcessingInstructions) {
    fail(ERROR.MAX_PROCESSING_INSTRUCTIONS, 'maximum processing instruction count exceeded', {
      position,
      limit: ctx.options.maxProcessingInstructions,
      actual: ctx.stats.processingInstructions + 1
    });
  }
  ctx.pos += 2;
  const targetPosition = ctx.pos;
  const target = readName(ctx);
  if (target === null) {
    fail(ERROR.MALFORMED_XML, 'processing instruction target is missing', { position: targetPosition });
  }
  validateQNameOrFail(target, targetPosition, ctx.options, 'processing instruction target');
  if (ctx.pos < ctx.text.length && !isXmlWhitespaceUnit(ctx.text.charCodeAt(ctx.pos)) && !ctx.text.startsWith('?>', ctx.pos)) {
    fail(ERROR.MALFORMED_XML, 'processing instruction target must be followed by whitespace or its terminator', {
      position: ctx.pos
    });
  }
  if (isXmlWhitespaceUnit(ctx.text.charCodeAt(ctx.pos))) skipWhitespace(ctx);
  const dataStart = ctx.pos;
  const end = ctx.text.indexOf('?>', dataStart);
  if (end === -1) {
    fail(ERROR.MALFORMED_XML, 'unterminated processing instruction', { position });
  }
  const data = ctx.text.slice(dataStart, end);
  const stylesheet = target.toLowerCase() === 'xml-stylesheet';
  const forbidden = stylesheet ? !ctx.options.allowXmlStylesheet : !ctx.options.allowProcessingInstructions;
  if (forbidden) {
    fail(ERROR.PROCESSING_INSTRUCTION_FORBIDDEN, stylesheet
      ? 'xml-stylesheet processing instructions are forbidden'
      : 'processing instructions are forbidden by the XML security policy', {
      position,
      name: target
    });
  }
  if (target.toLowerCase().startsWith('xml') && !stylesheet) {
    fail(ERROR.MALFORMED_XML, 'processing instruction targets beginning with xml are reserved', { position: targetPosition });
  }
  ctx.stats.processingInstructions += 1;
  ctx.pos = end + 2;
  const node = newNode('processing-instruction');
  node.target = target;
  node.data = data;
  return node;
}

function parseVersionOrValue(ctx, label, position) {
  if (!ctx.text.startsWith(label, ctx.pos)) {
    fail(ERROR.MALFORMED_XML, 'expected ' + label + ' in XML declaration', { position: ctx.pos });
  }
  ctx.pos += label.length;
  skipWhitespace(ctx);
  expectCharacter(ctx, '=', 'expected equals sign in XML declaration');
  skipWhitespace(ctx);
  const quote = ctx.text[ctx.pos];
  if (quote !== '"' && quote !== "'") {
    fail(ERROR.MALFORMED_XML, 'XML declaration values must be quoted', { position: ctx.pos });
  }
  ctx.pos += 1;
  const end = ctx.text.indexOf(quote, ctx.pos);
  if (end === -1) {
    fail(ERROR.MALFORMED_XML, 'unterminated XML declaration value', { position });
  }
  const value = ctx.text.slice(ctx.pos, end);
  ctx.pos = end + 1;
  return value;
}

function parseXmlDeclaration(ctx) {
  const position = ctx.pos;
  ctx.pos += 5;
  if (!skipWhitespace(ctx)) {
    fail(ERROR.MALFORMED_XML, 'XML declaration must have whitespace before version', { position });
  }
  const version = parseVersionOrValue(ctx, 'version', position);
  if (version !== '1.0') {
    fail(ERROR.MALFORMED_XML, 'only XML version 1.0 is accepted', { position, actual: version });
  }
  let encoding = null;
  let standalone = null;
  const whitespace = skipWhitespace(ctx);
  if (!ctx.text.startsWith('?>', ctx.pos)) {
    if (!whitespace) {
      fail(ERROR.MALFORMED_XML, 'XML declaration fields must be separated by whitespace', { position: ctx.pos });
    }
    if (ctx.text.startsWith('encoding', ctx.pos)) {
      encoding = parseVersionOrValue(ctx, 'encoding', position);
      if (!/^[A-Za-z][A-Za-z0-9._-]*$/.test(encoding)) {
        fail(ERROR.MALFORMED_XML, 'XML declaration encoding name is malformed', { position, actual: encoding });
      }
      const standaloneWhitespace = skipWhitespace(ctx);
      if (!ctx.text.startsWith('?>', ctx.pos)) {
        if (!standaloneWhitespace) {
          fail(ERROR.MALFORMED_XML, 'XML declaration fields must be separated by whitespace', { position: ctx.pos });
        }
        standalone = parseVersionOrValue(ctx, 'standalone', position);
      }
    } else {
      standalone = parseVersionOrValue(ctx, 'standalone', position);
    }
  }
  if (standalone !== null) {
    if (standalone !== 'yes' && standalone !== 'no') {
      fail(ERROR.MALFORMED_XML, 'standalone must be yes or no', { position, actual: standalone });
    }
    standalone = standalone === 'yes';
  }
  if (encoding !== null && encoding.toLowerCase() !== 'utf-8') {
    fail(ERROR.ENCODING_MISMATCH, 'xmlcage accepts UTF-8 input only; declared encoding does not match', {
      position,
      actual: encoding
    });
  }
  skipWhitespace(ctx);
  if (!ctx.text.startsWith('?>', ctx.pos)) {
    fail(ERROR.MALFORMED_XML, 'XML declaration is malformed or has trailing content', { position: ctx.pos });
  }
  ctx.pos += 2;
  const declaration = Object.create(null);
  declaration.version = '1.0';
  declaration.encoding = encoding === null ? null : 'UTF-8';
  declaration.standalone = standalone;
  return declaration;
}

function parseDoctype(ctx) {
  const position = ctx.pos;
  if (!ctx.text.startsWith('<!DOCTYPE', position)) {
    fail(ERROR.DOCTYPE_FORBIDDEN, 'DOCTYPE-like markup is forbidden or malformed', { position });
  }
  if (ctx.doctypeSeen || ctx.rootSeen) {
    fail(ERROR.MALFORMED_XML, 'DOCTYPE is only allowed once before the root element', { position });
  }
  ctx.pos += 9;
  if (!skipWhitespace(ctx)) {
    fail(ERROR.MALFORMED_XML, 'DOCTYPE must have whitespace before its name', { position });
  }
  const namePosition = ctx.pos;
  const name = readName(ctx);
  if (name === null) {
    fail(ERROR.MALFORMED_XML, 'DOCTYPE name is missing', { position: namePosition });
  }
  validateQNameOrFail(name, namePosition, ctx.options, 'DOCTYPE');
  skipWhitespace(ctx);
  if (ctx.text.startsWith('[', ctx.pos)) {
    fail(ERROR.DOCTYPE_FORBIDDEN, 'DTD internal subsets are forbidden', { position: ctx.pos });
  }
  if (/^(?:SYSTEM|PUBLIC)\b/i.test(ctx.text.slice(ctx.pos, ctx.pos + 16))) {
    fail(ERROR.EXTERNAL_ID_FORBIDDEN, 'SYSTEM or PUBLIC external identifiers are forbidden', { position: ctx.pos });
  }
  expectCharacter(ctx, '>', 'DOCTYPE declaration is malformed');
  ctx.doctypeSeen = true;
}

function appendElement(ctx, documentNode, element) {
  if (ctx.openElements.length === 0) {
    documentNode.root = element;
    documentNode.children.push(element);
  } else {
    ctx.openElements[ctx.openElements.length - 1].element.children.push(element);
  }
}

function appendContentNode(ctx, node) {
  ctx.openElements[ctx.openElements.length - 1].element.children.push(node);
}

function parseTextNode(ctx) {
  const position = ctx.pos;
  let end = ctx.text.indexOf('<', position);
  if (end === -1) end = ctx.text.length;
  const cdataTerminator = ctx.text.indexOf(']]>', position);
  if (cdataTerminator !== -1 && cdataTerminator < end) {
    fail(ERROR.MALFORMED_XML, 'CDATA terminator sequence is forbidden in ordinary text', {
      position: cdataTerminator
    });
  }
  const value = decodeTextRange(ctx, position, end, false);
  ctx.stats.textCharacters += value.length;
  ctx.pos = end;
  const node = newNode('text');
  node.value = value;
  return node;
}

function deepFreeze(value) {
  const seen = new Set();
  const stack = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === null || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);
    Object.freeze(current);
    for (const key of Object.keys(current)) {
      stack.push(current[key]);
    }
    if (Array.isArray(current)) {
      for (const item of current) stack.push(item);
    }
  }
  return value;
}

function parseXmlText(text, options, preScanned, stats) {
  validateXmlCharacters(text);
  if (!preScanned) scanAndThrow(text, options);
  const ctx = createContext(text, options, stats ? stats.bytes : utf8ByteLength(text), stats);
  ctx.openElements = [];
  ctx.rootSeen = false;
  const documentNode = newNode('document');
  documentNode.xmlDeclaration = null;
  documentNode.root = null;
  documentNode.prolog = [];
  documentNode.epilog = [];
  documentNode.children = [];

  if (ctx.text.startsWith('<?xml', 0) && isXmlWhitespaceUnit(ctx.text.charCodeAt(5))) {
    documentNode.xmlDeclaration = parseXmlDeclaration(ctx);
  }

  while (ctx.pos < ctx.text.length) {
    if (ctx.openElements.length === 0) {
      if (isXmlWhitespaceUnit(ctx.text.charCodeAt(ctx.pos))) {
        ctx.pos += 1;
        continue;
      }
      if (ctx.text.startsWith('<!--', ctx.pos)) {
        const comment = parseComment(ctx);
        addDocumentNode(ctx, documentNode, comment, ctx.rootSeen);
        continue;
      }
      if (ctx.text.startsWith('<?', ctx.pos)) {
        const pi = parseProcessingInstruction(ctx);
        addDocumentNode(ctx, documentNode, pi, ctx.rootSeen);
        continue;
      }
      if (ctx.text.startsWith('<!', ctx.pos)) {
        if (!ctx.rootSeen && !ctx.doctypeSeen && ctx.text.startsWith('<!DOCTYPE', ctx.pos) && ctx.options.allowDoctype) {
          parseDoctype(ctx);
          continue;
        }
        if (/^<!doctype/i.test(ctx.text.slice(ctx.pos, ctx.pos + 9))) {
          fail(ERROR.DOCTYPE_FORBIDDEN, 'DOCTYPE declarations are forbidden by the XML security policy', { position: ctx.pos });
        }
        fail(ERROR.MALFORMED_XML, 'markup declaration is not allowed here', { position: ctx.pos });
      }
      if (ctx.text[ctx.pos] !== '<') {
        fail(ERROR.MALFORMED_XML, 'character data is not allowed outside the root element', { position: ctx.pos });
      }
      if (ctx.rootSeen) {
        fail(ERROR.MALFORMED_XML, 'XML document must contain exactly one root element', { position: ctx.pos });
      }
      if (ctx.text.startsWith('</', ctx.pos)) {
        fail(ERROR.MALFORMED_XML, 'end tag has no matching start tag', { position: ctx.pos });
      }
      const opened = parseStartTag(ctx);
      ctx.rootSeen = true;
      appendElement(ctx, documentNode, opened.element);
      if (!opened.selfClosing) {
        ctx.openElements.push({ name: opened.name, element: opened.element, undo: opened.undo, depth: opened.depth });
      } else {
        undoNamespaceBindings(ctx, opened.undo);
      }
      continue;
    }

    if (ctx.text.startsWith('</', ctx.pos)) {
      parseEndTag(ctx);
      continue;
    }
    if (ctx.text.startsWith('<!--', ctx.pos)) {
      appendContentNode(ctx, parseComment(ctx));
      continue;
    }
    if (ctx.text.startsWith('<![CDATA[', ctx.pos)) {
      appendContentNode(ctx, parseCdata(ctx));
      continue;
    }
    if (ctx.text.startsWith('<?', ctx.pos)) {
      appendContentNode(ctx, parseProcessingInstruction(ctx));
      continue;
    }
    if (ctx.text.startsWith('<!', ctx.pos)) {
      if (/^<!doctype/i.test(ctx.text.slice(ctx.pos, ctx.pos + 9))) {
        fail(ERROR.DOCTYPE_FORBIDDEN, 'DOCTYPE declarations are forbidden inside the root element', { position: ctx.pos });
      }
      fail(ERROR.MALFORMED_XML, 'markup declaration is not allowed inside element content', { position: ctx.pos });
    }
    if (ctx.text[ctx.pos] === '<') {
      const opened = parseStartTag(ctx);
      appendElement(ctx, documentNode, opened.element);
      if (!opened.selfClosing) {
        ctx.openElements.push({ name: opened.name, element: opened.element, undo: opened.undo, depth: opened.depth });
      } else {
        undoNamespaceBindings(ctx, opened.undo);
      }
      continue;
    }
    appendContentNode(ctx, parseTextNode(ctx));
  }

  if (ctx.openElements.length > 0) {
    const frame = ctx.openElements[ctx.openElements.length - 1];
    fail(ERROR.MALFORMED_XML, 'document ended before the root element was closed', {
      position: ctx.text.length,
      name: frame.name
    });
  }
  if (!ctx.rootSeen || documentNode.root === null) {
    fail(ERROR.MALFORMED_XML, 'XML document must contain a root element', { position: ctx.text.length });
  }
  return { document: deepFreeze(documentNode), stats: ctx.stats };
}

function normalizeBytesInput(input) {
  if (input instanceof Uint8Array) return input;
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (typeof SharedArrayBuffer !== 'undefined' && input instanceof SharedArrayBuffer) return new Uint8Array(input);
  return null;
}

function looksLikeUtf16OrUtf32(view) {
  if (view.byteLength >= 4) {
    if (view[0] === 0xff && view[1] === 0xfe && view[2] === 0x00 && view[3] === 0x00) return true;
    if (view[0] === 0x00 && view[1] === 0x00 && view[2] === 0xfe && view[3] === 0xff) return true;
    if (view[0] === 0xff && view[1] === 0xfe) return true;
    if (view[0] === 0xfe && view[1] === 0xff) return true;
  }
  const sample = Math.min(view.byteLength, 64);
  if (sample < 8) return false;
  let evenZeros = 0;
  let oddZeros = 0;
  let pairs = 0;
  for (let index = 0; index + 1 < sample; index += 2) {
    pairs += 1;
    if (view[index] === 0) evenZeros += 1;
    if (view[index + 1] === 0) oddZeros += 1;
  }
  return evenZeros / pairs > 0.6 || oddZeros / pairs > 0.6;
}

function decodeXmlBytes(input, options) {
  if (typeof input === 'string') {
    fail(ERROR.INVALID_INPUT, 'parseSafeXmlBytes expects bytes, not a string');
  }
  const view = normalizeBytesInput(input);
  if (view === null) {
    fail(ERROR.INVALID_INPUT, 'expected a Uint8Array, ArrayBuffer, or ArrayBuffer view');
  }
  if (view.byteLength > options.maxBytes) {
    const error = new XmlCageError(ERROR.MAX_BYTES, 'maximum XML byte length exceeded', {
      limit: options.maxBytes,
      actual: view.byteLength
    });
    error.stats = { ...emptyStats(), bytes: view.byteLength };
    throw error;
  }
  if (looksLikeUtf16OrUtf32(view)) {
    const error = new XmlCageError(ERROR.INVALID_UTF8, 'input has a UTF-16 or UTF-32 byte pattern; UTF-8 bytes are required');
    error.stats = { ...emptyStats(), bytes: view.byteLength };
    throw error;
  }
  try {
    return {
      text: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(view),
      bytes: view.byteLength
    };
  } catch {
    const error = new XmlCageError(ERROR.INVALID_UTF8, 'input is not well-formed UTF-8');
    error.stats = { ...emptyStats(), bytes: view.byteLength };
    throw error;
  }
}

function prepareStringInput(input, options) {
  if (typeof input !== 'string') {
    fail(ERROR.INVALID_INPUT, 'expected an XML string input');
  }
  const bytes = utf8ByteLength(input);
  if (bytes > options.maxBytes) {
    const error = new XmlCageError(ERROR.MAX_BYTES, 'maximum XML byte length exceeded', {
      limit: options.maxBytes,
      actual: bytes
    });
    error.stats = { ...emptyStats(), bytes };
    throw error;
  }
  return { text: normalizeXmlText(input), bytes };
}

function parseStringWithOptions(input, options) {
  const prepared = prepareStringInput(input, options);
  return parseXmlText(prepared.text, options, false, emptyStatsWithBytes(prepared.bytes)).document;
}

function parseBytesWithOptions(input, options) {
  const decoded = decodeXmlBytes(input, options);
  const normalized = normalizeXmlText(decoded.text);
  return parseXmlText(normalized, options, false, emptyStatsWithBytes(decoded.bytes)).document;
}

function emptyStatsWithBytes(bytes) {
  const stats = emptyStats();
  stats.bytes = bytes;
  return stats;
}

function freezeFindings(findings) {
  for (const finding of findings) Object.freeze(finding);
  return Object.freeze(findings);
}

function freezeAuditReport(report) {
  Object.freeze(report.stats);
  report.findings = freezeFindings(report.findings);
  return Object.freeze(report);
}

function errorToFinding(error, text, lineIndexer) {
  const finding = makeFinding(error.code, error.reason, {
    position: error.position,
    limit: error.limit,
    actual: error.actual,
    depth: error.depth,
    xmlName: error.xmlName,
    attribute: error.attribute,
    key: error.key,
    expected: error.expected
  });
  if (typeof error.position === 'number') addPositionDetails(finding, lineIndexer);
  return finding;
}

function addErrorFinding(findings, error, text, options, lineIndexer) {
  if (findings.length >= options.maxFindings) return;
  const duplicate = findings.some((finding) => finding.code === error.code && finding.position === error.position);
  if (duplicate) return;
  findings.push(errorToFinding(error, text, lineIndexer));
}

function fallbackStatsForInput(input) {
  const stats = emptyStats();
  if (typeof input === 'string') stats.bytes = utf8ByteLength(input);
  else {
    const view = normalizeBytesInput(input);
    if (view !== null) stats.bytes = view.byteLength;
  }
  return stats;
}

function isByteInput(input) {
  return normalizeBytesInput(input) !== null;
}

export function auditXml(input, options) {
  const normalized = normalizeOptions(options);
  const findings = [];
  let stats = fallbackStatsForInput(input);
  let prepared = null;
  let lineIndexer = null;

  if (typeof input === 'string') {
    try {
      prepared = prepareStringInput(input, normalized);
    } catch (error) {
      if (!(error instanceof XmlCageError)) throw error;
      addErrorFinding(findings, error, '', normalized);
      stats = error.stats || stats;
    }
  } else if (isByteInput(input)) {
    try {
      const decoded = decodeXmlBytes(input, normalized);
      prepared = { text: normalizeXmlText(decoded.text), bytes: decoded.bytes };
    } catch (error) {
      if (!(error instanceof XmlCageError)) throw error;
      addErrorFinding(findings, error, '', normalized);
      stats = error.stats || stats;
    }
  } else {
    const error = new XmlCageError(ERROR.INVALID_INPUT, 'expected an XML string, Uint8Array, ArrayBuffer, or ArrayBuffer view');
    addErrorFinding(findings, error, '', normalized);
  }

  if (prepared !== null) {
    lineIndexer = createLineIndexer(prepared.text);
    stats = emptyStatsWithBytes(prepared.bytes);
    for (const finding of scanRawThreats(prepared.text, normalized, lineIndexer)) {
      if (findings.length < normalized.maxFindings) findings.push(finding);
    }
    try {
      const result = parseXmlText(prepared.text, normalized, true, stats);
      stats = result.stats;
    } catch (error) {
      if (!(error instanceof XmlCageError)) throw error;
      addErrorFinding(findings, error, prepared.text, normalized, lineIndexer);
      stats = error.stats || stats;
    }
  }

  return freezeAuditReport({
    safe: findings.length === 0,
    findings,
    stats: copyStats(stats)
  });
}

export function assertSafeXml(input, options) {
  const report = auditXml(input, options);
  if (report.safe) return report;
  const first = report.findings[0];
  const details = {};
  for (const key of Object.keys(first)) {
    if (key !== 'code' && key !== 'message') details[key] = first[key];
  }
  const error = new XmlCageError(first.code, first.message, details);
  error.findings = report.findings;
  error.stats = report.stats;
  throw error;
}

export function parseSafeXml(input, options) {
  const normalized = normalizeOptions(options);
  return parseStringWithOptions(input, normalized);
}

export function parseSafeXmlBytes(input, options) {
  const normalized = normalizeOptions(options);
  return parseBytesWithOptions(input, normalized);
}

function assertEscapableString(value, functionName) {
  if (typeof value !== 'string') {
    fail(ERROR.INVALID_INPUT, functionName + ' expects a string value');
  }
  for (let index = 0; index < value.length; index += 1) {
    const first = value.charCodeAt(index);
    let codePoint = first;
    if (isHighSurrogate(first)) {
      if (index + 1 >= value.length || !isLowSurrogate(value.charCodeAt(index + 1))) {
        fail(ERROR.INVALID_INPUT, 'lone UTF-16 surrogate cannot be represented in XML', { position: index });
      }
      codePoint = 0x10000 + ((first - 0xd800) << 10) + value.charCodeAt(index + 1) - 0xdc00;
      index += 1;
    } else if (isLowSurrogate(first)) {
      fail(ERROR.INVALID_INPUT, 'lone UTF-16 surrogate cannot be represented in XML', { position: index });
    }
    if (!isLegalXmlCodePoint(codePoint)) {
      fail(ERROR.INVALID_INPUT, 'character cannot be represented in XML 1.0', {
        position: index,
        actual: codePoint
      });
    }
  }
}

function escapeCommon(value) {
  return value.replace(/[&<>"']/g, (character) => {
    if (character === '&') return '&amp;';
    if (character === '<') return '&lt;';
    if (character === '>') return '&gt;';
    if (character === '"') return '&quot;';
    return '&apos;';
  });
}

export function escapeXmlText(value) {
  assertEscapableString(value, 'escapeXmlText');
  return escapeCommon(value).replace(/\r/g, '&#13;');
}

export function escapeXmlAttr(value) {
  assertEscapableString(value, 'escapeXmlAttr');
  return escapeCommon(value)
    .replace(/\t/g, '&#9;')
    .replace(/\n/g, '&#10;')
    .replace(/\r/g, '&#13;');
}

function validateSerializedName(name, options, kind) {
  if (typeof name !== 'string' || name.length === 0) {
    fail(ERROR.INVALID_INPUT, 'XML ' + kind + ' name must be a non-empty string');
  }
  if (name.length > options.maxNameLength) {
    fail(ERROR.MAX_NAME_LENGTH, 'maximum XML name length exceeded', {
      limit: options.maxNameLength,
      actual: name.length,
      name: name.slice(0, 80)
    });
  }
  let index = 0;
  const first = codePointAt(name, 0);
  if (!isXmlNameStartCodePoint(first.codePoint)) {
    fail(ERROR.INVALID_INPUT, 'XML ' + kind + ' name has an invalid first character', { name });
  }
  index += first.width;
  while (index < name.length) {
    const next = codePointAt(name, index);
    if (!isXmlNameCodePoint(next.codePoint)) {
      fail(ERROR.INVALID_INPUT, 'XML ' + kind + ' name has an invalid character', { name });
    }
    index += next.width;
  }
  const parts = splitQName(name);
  if (parts === null) {
    fail(ERROR.INVALID_INPUT, 'XML ' + kind + ' qualified name is malformed', { name });
  }
  if (isDangerousXmlName(name)) {
    fail(ERROR.PROTOTYPE_KEY, 'prototype pollution name rejected in XML ' + kind, { name, key: name });
  }
  return parts;
}

function readDataProperty(object, key) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor) return undefined;
  if (!Object.hasOwn(descriptor, 'value')) {
    fail(ERROR.UNSUPPORTED_VALUE, 'accessor properties are not XML data', { key });
  }
  return descriptor.value;
}

function serializedTypeOf(node) {
  if (typeof node === 'string') return 'text';
  if (node === null || typeof node !== 'object' || Array.isArray(node)) return null;
  const explicit = readDataProperty(node, 'type');
  if (explicit === 'element' || explicit === 'document' || explicit === 'text' || explicit === 'cdata' || explicit === 'comment' || explicit === 'processing-instruction') {
    return explicit;
  }
  if (readDataProperty(node, 'name') !== undefined || readDataProperty(node, 'tag') !== undefined || readDataProperty(node, 'tagName') !== undefined) {
    return 'element';
  }
  if (readDataProperty(node, 'root') !== undefined) return 'document';
  if (readDataProperty(node, 'value') !== undefined) return 'text';
  return null;
}

function serializedElementName(node) {
  const name = readDataProperty(node, 'name');
  if (name !== undefined) return name;
  const tag = readDataProperty(node, 'tag');
  if (tag !== undefined) return tag;
  return readDataProperty(node, 'tagName');
}

function serializedElementChildren(node) {
  const children = readDataProperty(node, 'children');
  if (children !== undefined) {
    if (!Array.isArray(children)) fail(ERROR.INVALID_INPUT, 'element children must be an array');
    return children;
  }
  const content = readDataProperty(node, 'content');
  if (typeof content === 'string') return [content];
  const text = readDataProperty(node, 'text');
  if (typeof text === 'string') return [text];
  return [];
}

function serializedAttributes(node) {
  const attributes = readDataProperty(node, 'attributes');
  if (attributes !== undefined) {
    if (attributes === null || typeof attributes !== 'object' || Array.isArray(attributes)) {
      fail(ERROR.INVALID_INPUT, 'element attributes must be an object');
    }
    return Object.keys(attributes).map((name) => ({ name, value: readDataProperty(attributes, name) }));
  }
  const attributeList = readDataProperty(node, 'attributeList');
  if (attributeList !== undefined) {
    if (!Array.isArray(attributeList)) fail(ERROR.INVALID_INPUT, 'attributeList must be an array');
    return attributeList.map((entry) => {
      if (entry === null || typeof entry !== 'object') fail(ERROR.INVALID_INPUT, 'attribute entries must be objects');
      return { name: readDataProperty(entry, 'name'), value: readDataProperty(entry, 'value') };
    });
  }
  return [];
}

function reserveSerialized(state, byteLength) {
  if (state.outputLength + byteLength > state.options.maxBytes) {
    fail(ERROR.MAX_BYTES, 'maximum serialized XML byte length exceeded', {
      limit: state.options.maxBytes,
      actual: state.outputLength + byteLength
    });
  }
  state.outputLength += byteLength;
}

function appendSerialized(state, part) {
  reserveSerialized(state, utf8ByteLength(part));
  state.parts.push(part);
}

function escapedXmlByteLength(value, attributeMode) {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit === 0x26) bytes += 5;
    else if (unit === 0x3c || unit === 0x3e) bytes += 4;
    else if (unit === 0x22 || unit === 0x27) bytes += 6;
    else if (unit === 0x0d) bytes += 5;
    else if (attributeMode && unit === 0x09) bytes += 4;
    else if (attributeMode && unit === 0x0a) bytes += 5;
    else if (unit <= 0x7f) bytes += 1;
    else if (unit <= 0x7ff) bytes += 2;
    else if (isHighSurrogate(unit) && index + 1 < value.length && isLowSurrogate(value.charCodeAt(index + 1))) {
      bytes += 4;
      index += 1;
    } else bytes += 3;
  }
  return bytes;
}

function appendEscapedSerialized(state, value, attributeMode) {
  assertEscapableString(value, 'serializeSafeXml');
  reserveSerialized(state, escapedXmlByteLength(value, attributeMode));
  const escaped = escapeCommon(value).replace(/\r/g, '&#13;');
  state.parts.push(attributeMode
    ? escaped.replace(/\t/g, '&#9;').replace(/\n/g, '&#10;')
    : escaped);
}

function appendWrappedSerialized(state, prefix, value, suffix) {
  reserveSerialized(state, prefix.length + suffix.length + utf8ByteLength(value));
  state.parts.push(prefix + value + suffix);
}

function serializeDeclaration(state, declaration, forced) {
  if (!forced && (declaration === null || declaration === undefined)) return;
  const source = declaration && typeof declaration === 'object' ? declaration : null;
  const encoding = source ? readDataProperty(source, 'encoding') : 'UTF-8';
  const standalone = source ? readDataProperty(source, 'standalone') : null;
  let text = '<?xml version="1.0"';
  if (encoding !== null && encoding !== undefined) text += ' encoding="UTF-8"';
  if (standalone === true) text += ' standalone="yes"';
  else if (standalone === false) text += ' standalone="no"';
  text += '?>';
  appendSerialized(state, text);
}

function serializeSimpleNode(state, node, type) {
  if (type === 'text') {
    const value = typeof node === 'string' ? node : readDataProperty(node, 'value');
    if (typeof value !== 'string') fail(ERROR.INVALID_INPUT, 'text node value must be a string');
    appendEscapedSerialized(state, value, false);
    return;
  }
  if (type === 'cdata') {
    const value = readDataProperty(node, 'value');
    if (typeof value !== 'string') fail(ERROR.INVALID_INPUT, 'CDATA value must be a string');
    assertEscapableString(value, 'serializeSafeXml');
    if (value.includes(']]>')) fail(ERROR.INVALID_INPUT, 'CDATA value must not contain its terminator');
    appendWrappedSerialized(state, '<![CDATA[', value, ']]>');
    return;
  }
  if (type === 'comment') {
    const value = readDataProperty(node, 'value');
    if (typeof value !== 'string') fail(ERROR.INVALID_INPUT, 'comment value must be a string');
    assertEscapableString(value, 'serializeSafeXml');
    if (value.includes('--') || value.endsWith('-')) {
      fail(ERROR.INVALID_INPUT, 'comment value must not contain a double hyphen or end with a hyphen');
    }
    appendWrappedSerialized(state, '<!--', value, '-->');
    return;
  }
  if (type === 'processing-instruction') {
    const target = readDataProperty(node, 'target');
    const data = readDataProperty(node, 'data');
    validateSerializedName(target, state.options, 'processing instruction target');
    if (target.toLowerCase().startsWith('xml') && target.toLowerCase() !== 'xml-stylesheet') fail(ERROR.INVALID_INPUT, 'processing instruction targets beginning with xml are reserved');
    if (typeof data !== 'string') fail(ERROR.INVALID_INPUT, 'processing instruction data must be a string');
    assertEscapableString(data, 'serializeSafeXml');
    if (data.includes('?>')) fail(ERROR.INVALID_INPUT, 'processing instruction data must not contain its terminator');
    const stylesheet = target.toLowerCase() === 'xml-stylesheet';
    if (stylesheet ? !state.options.allowXmlStylesheet : !state.options.allowProcessingInstructions) {
      fail(ERROR.PROCESSING_INSTRUCTION_FORBIDDEN, 'processing instruction is forbidden by the XML security policy', { name: target });
    }
    appendWrappedSerialized(state, '<?' + target + (data.length > 0 ? ' ' : ''), data, '?>');
    return;
  }
  fail(ERROR.INVALID_INPUT, 'unsupported XML node type');
}

export function serializeSafeXml(input, options) {
  const normalized = normalizeSerializeOptions(options);
  const initialType = serializedTypeOf(input);
  if (initialType !== 'element' && initialType !== 'document') {
    fail(ERROR.INVALID_INPUT, 'serializeSafeXml expects an element or document as its top-level input');
  }
  const state = {
    options: normalized,
    parts: [],
    outputLength: 0,
    elements: 0,
    attributes: 0,
    active: new Set()
  };
  const work = [{ node: input, depth: 0 }];
  let documentDeclarationWritten = false;

  while (work.length > 0) {
    const item = work.pop();
    if (item.close === 'document') {
      state.active.delete(item.source);
      continue;
    }
    if (item.close === true) {
      state.active.delete(item.source);
      appendSerialized(state, '</' + item.name + '>');
      continue;
    }

    const node = item.node;
    const type = serializedTypeOf(node);
    if (type === null) {
      fail(ERROR.INVALID_INPUT, 'serializeSafeXml expects an element, document, or XML node object');
    }

    if (type === 'document') {
      if (state.active.has(node)) fail(ERROR.CYCLE_DETECTED, 'cyclic XML document graph detected');
      state.active.add(node);
      const declaration = readDataProperty(node, 'xmlDeclaration');
      if (!documentDeclarationWritten) {
        serializeDeclaration(state, declaration, normalized.xmlDeclaration || declaration !== undefined && declaration !== null);
        documentDeclarationWritten = true;
      }
      const children = serializedElementChildren(node);
      const root = readDataProperty(node, 'root');
      const outputChildren = children.length > 0 ? children : root ? [root] : [];
      work.push({ close: 'document', source: node });
      for (let index = outputChildren.length - 1; index >= 0; index -= 1) {
        work.push({ node: outputChildren[index], depth: item.depth });
      }
      continue;
    }

    if (type !== 'element') {
      serializeSimpleNode(state, node, type);
      continue;
    }

    if (state.active.has(node)) fail(ERROR.CYCLE_DETECTED, 'cyclic XML element graph detected');
    const depth = item.depth + 1;
    if (depth > normalized.maxDepth) {
      fail(ERROR.MAX_DEPTH, 'maximum XML nesting depth exceeded', {
        limit: normalized.maxDepth,
        actual: depth,
        depth
      });
    }
    state.elements += 1;
    if (state.elements > normalized.maxElements) {
      fail(ERROR.MAX_ELEMENTS, 'maximum XML element count exceeded', {
        limit: normalized.maxElements,
        actual: state.elements
      });
    }
    const name = serializedElementName(node);
    validateSerializedName(name, normalized, 'element');
    const attributes = serializedAttributes(node);
    if (attributes.length > normalized.maxAttributesPerElement) {
      fail(ERROR.MAX_ATTRIBUTES, 'maximum attributes per element exceeded', {
        limit: normalized.maxAttributesPerElement,
        actual: attributes.length
      });
    }
    state.attributes += attributes.length;
    if (state.attributes > normalized.maxTotalAttributes) {
      fail(ERROR.MAX_ATTRIBUTES, 'maximum total XML attribute count exceeded', {
        limit: normalized.maxTotalAttributes,
        actual: state.attributes
      });
    }
    const seen = new Set();
    appendSerialized(state, '<' + name);
    for (const attribute of attributes) {
      validateSerializedName(attribute.name, normalized, 'attribute');
      if (seen.has(attribute.name)) {
        fail(ERROR.DUPLICATE_ATTRIBUTE, 'duplicate attribute on serialized element', { attribute: attribute.name });
      }
      seen.add(attribute.name);
      if (typeof attribute.value !== 'string') {
        fail(ERROR.INVALID_INPUT, 'attribute values must be strings', { attribute: attribute.name });
      }
      appendSerialized(state, ' ' + attribute.name + '="');
      appendEscapedSerialized(state, attribute.value, true);
      appendSerialized(state, '"');
    }
    const children = serializedElementChildren(node);
    state.active.add(node);
    if (children.length === 0) {
      state.active.delete(node);
      appendSerialized(state, '/>');
      continue;
    }
    appendSerialized(state, '>');
    work.push({ close: true, name, source: node });
    for (let index = children.length - 1; index >= 0; index -= 1) {
      work.push({ node: children[index], depth });
    }
  }

  const output = state.parts.join('');
  parseStringWithOptions(output, normalized);
  return output;
}

export function createXmlCage(defaultOptions) {
  const base = normalizeOptions(defaultOptions);
  return Object.freeze({
    options: Object.freeze({ ...base }),
    audit(input, overrides) {
      return auditXml(input, mergeOptions(base, overrides));
    },
    assert(input, overrides) {
      return assertSafeXml(input, mergeOptions(base, overrides));
    },
    parse(input, overrides) {
      const merged = mergeOptions(base, overrides);
      return parseStringWithOptions(input, merged);
    },
    parseBytes(input, overrides) {
      const merged = mergeOptions(base, overrides);
      return parseBytesWithOptions(input, merged);
    },
    escapeText(value) {
      return escapeXmlText(value);
    },
    escapeAttr(value) {
      return escapeXmlAttr(value);
    },
    serialize(value, overrides) {
      return serializeSafeXml(value, mergeSerializeOptions(base, overrides));
    }
  });
}

const xmlcage = Object.freeze({
  XMLCAGE_VERSION,
  XMLCAGE_ERROR_CODES,
  CODE,
  XmlCageError,
  auditXml,
  assertSafeXml,
  parseSafeXml,
  parseSafeXmlBytes,
  createXmlCage,
  escapeXmlText,
  escapeXmlAttr,
  serializeSafeXml
});

export default xmlcage;
