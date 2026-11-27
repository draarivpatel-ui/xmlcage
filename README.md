# xmlcage

[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/draarivpatel-ui/xmlcage/badge)](https://scorecard.dev/viewer/?uri=github.com/draarivpatel-ui/xmlcage)

Zero-dependency XML security parsing, auditing and generation for Node.js.

`xmlcage` is a fail-closed XML 1.0 security boundary for untrusted XML. It is
built for services that accept SAML, SOAP, RSS, Atom, SVG, configuration XML or
workflow payloads and must not inherit the dangerous behavior of a general XML
parser. It blocks XML external entities, entity-expansion bombs, DTD smuggling,
XInclude and stylesheet injection, external schema fetching, depth and attribute
bombs, duplicate-attribute parser differentials and unsafe output generation.

The library ships ESM, CommonJS and hand-written TypeScript definitions from
one audited source of truth. It has zero runtime dependencies and zero
devDependencies. The 1.0.0 deterministic suite contains exactly 748 tests.

## Publication status

This repository is prepared for npm publication, but publication is a separate
release step. Do not assume that the npm name is live merely because this
README exists. From a source checkout, verify the package with:

```sh
npm test
node scripts/build-cjs.mjs --check
node scripts/cli-smoke.mjs
npm pack --dry-run
```

Node 18 or newer is required.

## Threat model

XML attacks often exploit features that application code never intended to
enable. A standards-compliant general parser may resolve external entities or
process inclusion mechanisms unless every resolver and feature flag is set
correctly. Other parsers fail in the opposite direction and accept different
documents than the downstream parser accepts. That difference is dangerous when
one parser performs security review and another performs business logic.

`xmlcage` therefore uses one strict lexer and iterative parser for both audit
and parse operations. It never resolves external resources, never executes
stylesheets and never expands custom entities.

### Covered attacks

| Attack | CWE | Defense |
| --- | --- | --- |
| XML external entities, including `file:`, `http:`, `php:` and `expect:` payloads | CWE-611 | DOCTYPE and custom entity declarations are rejected. External `SYSTEM` and `PUBLIC` identifiers are separately rejected. |
| Billion Laughs, quadratic entity expansion and repeated character-reference abuse | CWE-776 | Custom entities never expand. Entity and character references are counted. Expanded reference bytes are capped. |
| DTD smuggling through mixed case, comments or a UTF BOM | CWE-611 | A pre-parse scanner recognizes declaration keywords case-insensitively and after comment removal. A leading UTF-8 BOM does not hide the prolog. |
| XInclude SSRF or local file inclusion | CWE-918 | Elements in the XInclude namespace and prefix-obfuscated `xi:` names are rejected by default. |
| XSLT and stylesheet injection | CWE-611 | `xml-stylesheet` and other processing instructions are rejected by default. |
| External schema fetching through `xsi:schemaLocation` or `xsi:noNamespaceSchemaLocation` | CWE-918 | External URL, absolute-path, protocol-relative and parent-traversal schema locations are rejected by default, including traversal or scheme text hidden with percent-encoded unreserved characters. |
| Depth, element, attribute, text, comment and processing-instruction bombs | CWE-400 | Every resource is capped before output allocation where output is produced. The parser uses an explicit heap stack rather than recursive JavaScript calls. |
| XML Signature Wrapping and parser differentials | CWE-347 | Strict well-formedness, exact tag matching, single-root validation, duplicate-attribute detection and namespace-resolved duplicate detection. |
| Prototype pollution in object representations | CWE-1321 | Exact and local `__proto__`, `constructor` and `prototype` names are rejected. Attribute maps and AST nodes are null-prototype objects. |
| Encoding confusion | CWE-116 | `parseSafeXmlBytes` requires fatal UTF-8 decoding, rejects UTF-16 and UTF-32 byte patterns, and rejects declarations for non-UTF-8 encodings. |
| XML injection during output generation | CWE-91 | `escapeXmlText`, `escapeXmlAttr` and `serializeSafeXml` escape metacharacters and reject illegal XML characters and names. |

## Quick start

```js
import {
  auditXml,
  assertSafeXml,
  parseSafeXml,
  parseSafeXmlBytes,
  escapeXmlText,
  escapeXmlAttr,
  serializeSafeXml
} from 'xmlcage';

const xml = '<root id="a"><message>Hello &amp; welcome</message></root>';

const report = auditXml(xml);
if (!report.safe) {
  console.error(report.findings);
}

const documentNode = parseSafeXml(xml);
console.log(documentNode.root.name);
console.log(documentNode.root.attributes.id);
console.log(documentNode.root.children[0].children[0].value);
```

When imported from a source checkout rather than an installed package, use a
relative path to `src/index.mjs` or `cjs/index.cjs`.

## Audit reports

`auditXml` accepts a string, `Uint8Array`, `ArrayBuffer` or another ArrayBuffer
view. Hostile input normally produces findings rather than an exception. Caller
configuration errors, such as unknown option keys, still throw immediately.

```js
import { auditXml } from 'xmlcage';

const report = auditXml(untrustedXml, {
  maxBytes: 256 * 1024,
  maxDepth: 16
});

report.safe;
report.findings[0]?.code;
report.findings[0]?.line;
report.findings[0]?.column;
report.stats.elements;
report.stats.maxDepthObserved;
```

The report, findings array, finding objects and stats object are frozen.
`safe` is true only when there are no findings.

## Strict assertion

```js
import { assertSafeXml } from 'xmlcage';

try {
  const report = assertSafeXml(untrustedXml);
  console.log(report.stats.elements);
} catch (error) {
  console.log(error.name, error.code, error.reason);
  console.log(error.findings);
}
```

`assertSafeXml` returns the audit report when input is safe. When it is unsafe,
it throws `XmlCageError` for the first finding and attaches all findings.

## Parsing to a safe AST

```js
import { parseSafeXml } from 'xmlcage';

const documentNode = parseSafeXml('<root a="1"><child>text</child></root>');

console.log(documentNode.type);
console.log(documentNode.xmlDeclaration);
console.log(documentNode.root.attributeList);
console.log(documentNode.root.children[0].name);
```

The document shape is intentionally small and explicit:

- `document.root` is the single root element or null when parsing failed.
- `document.prolog` and `document.epilog` contain comments and allowed
  processing instructions outside the root.
- `document.children` preserves top-level nodes in order.
- Element nodes contain `name`, `localName`, `prefix`, `namespaceURI`,
  `attributes`, `attributeList`, `children` and `depth`.
- Text, CDATA, comment and processing-instruction nodes use explicit `type`
  fields.
- Attribute maps and AST nodes are null-prototype objects. The output tree is
  deeply frozen.

Namespace prefixes must be bound. The fixed `xml` prefix is supported. Namespace
declarations are scoped correctly as elements close. Attributes without a prefix
are not put in the default namespace, matching XML namespace rules.

## Bytes and encoding

```js
import { parseSafeXmlBytes } from 'xmlcage';

const documentNode = parseSafeXmlBytes(new Uint8Array(bytes));
```

Byte input is decoded with `TextDecoder('utf-8', { fatal: true, ignoreBOM: true })`.
UTF-16 and UTF-32 byte patterns are rejected even when they technically contain
enough information for another decoder to interpret them. If an XML declaration
names an encoding other than UTF-8, parsing fails with
`XMLCAGE_ENCODING_MISMATCH`.

## Safe output generation

```js
import { escapeXmlText, escapeXmlAttr, serializeSafeXml } from 'xmlcage';

escapeXmlText('Tom & Jerry <3');
escapeXmlAttr('line one\nline two');

const xml = serializeSafeXml({
  name: 'feed',
  attributes: { version: '1.0' },
  children: [
    {
      name: 'title',
      children: ['Security <update>']
    }
  ]
}, { xmlDeclaration: true });
```

Output generation rejects invalid names, illegal XML 1.0 characters, duplicate
attributes, prototype-pollution names, cyclic object graphs, malformed comments,
malformed CDATA, forbidden processing instructions, XInclude markup and external
schema locations unless those features are explicitly enabled. The top-level
input must be one element or document, and the finished output is validated with
the same strict parser policy before it is returned. It writes output through an
explicit work stack rather than recursive JavaScript calls.

A parsed document can be serialized again. Processing instructions remain
forbidden unless the matching documented option is enabled.

## Reusable guard

```js
import { createXmlCage } from 'xmlcage';

const cage = createXmlCage({
  maxBytes: 128 * 1024,
  maxDepth: 12,
  maxElements: 1000
});

const report = cage.audit(untrustedXml);
const documentNode = cage.parse(trustedSubsetXml);
```

The guard and its copied options are frozen. Per-call overrides are validated
and copied; the guard itself never changes.

## CLI

```sh
xmlcage audit payload.xml
xmlcage audit payload.xml --json
xmlcage audit - --max-bytes 65536 --max-depth 16 < payload.xml
```

The CLI reads `-` as standard input. Regular-file input is opened by file
descriptor and checked with `fstat`. Where the platform supports it, the open
also uses no-follow and nonblocking flags. Directories, symlinks, FIFOs,
devices and other non-regular files are input errors. Oversized input is an
unsafe finding rather than a silent truncation.

Exit codes:

| Exit | Meaning |
| --- | --- |
| 0 | Input is safe under the selected policy. |
| 1 | One or more security or well-formedness findings exist. |
| 2 | CLI usage or input/output error. |

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `allowDoctype` | `false` | Allow a simple, uppercase, external-identifier-free and subset-free DOCTYPE. DTD subsets remain forbidden. |
| `allowXInclude` | `false` | Permit XInclude syntax as inert data. xmlcage never fetches includes. |
| `allowProcessingInstructions` | `false` | Permit ordinary processing instructions. |
| `allowXmlStylesheet` | `false` | Permit `xml-stylesheet` as inert data. xmlcage never fetches or executes it. |
| `allowExternalSchemaLocations` | `false` | Permit external schema locations as inert data. |
| `maxBytes` | `1048576` | Maximum input byte length. |
| `maxDepth` | `32` | Maximum element nesting depth, with the root at depth 1. |
| `maxElements` | `10000` | Maximum element count. |
| `maxAttributesPerElement` | `64` | Maximum attributes on one element. |
| `maxTotalAttributes` | `25000` | Maximum attributes in the whole document. |
| `maxTextLength` | `65536` | Maximum characters in one text or CDATA node after reference decoding. |
| `maxAttributeValueLength` | `8192` | Maximum characters in one attribute value after normalization and reference decoding. |
| `maxNameLength` | `256` | Maximum element, attribute, target or reference name length. |
| `maxComments` | `1000` | Maximum comments. |
| `maxEntityReferences` | `10000` | Maximum predefined entity and numeric character references. |
| `maxExpandedTextBytes` | `1048576` | Maximum UTF-8 bytes produced by decoded references. |
| `maxProcessingInstructions` | `1000` | Maximum processing instructions. |
| `maxFindings` | `1024` | Maximum audit findings retained. |

Unknown option keys are rejected. Integer options must be safe integers in the
supported range. Boolean options must be booleans.

Raising limits increases the amount of attacker-controlled work your process
accepts. Prefer application-specific limits close to the size of real payloads.

## Finding codes

| Code | Meaning |
| --- | --- |
| `XMLCAGE_DOCTYPE_FORBIDDEN` | A DOCTYPE, mixed-case DOCTYPE-like declaration or forbidden DTD subset was found. |
| `XMLCAGE_ENTITY_FORBIDDEN` | A general or parameter entity declaration was found. |
| `XMLCAGE_EXTERNAL_ID_FORBIDDEN` | A `SYSTEM` or `PUBLIC` external identifier was found. |
| `XMLCAGE_NOTATION_FORBIDDEN` | A NOTATION declaration was found. |
| `XMLCAGE_ATTLIST_FORBIDDEN` | An ATTLIST declaration was found. |
| `XMLCAGE_ELEMENT_DECLARATION_FORBIDDEN` | An ELEMENT declaration was found. |
| `XMLCAGE_UNKNOWN_ENTITY` | An entity other than the five predefined XML entities was referenced. |
| `XMLCAGE_ILLEGAL_CHAR_REF` | A numeric reference was malformed or did not denote a legal XML 1.0 scalar. |
| `XMLCAGE_XINCLUDE_FORBIDDEN` | XInclude syntax was found. |
| `XMLCAGE_PROCESSING_INSTRUCTION_FORBIDDEN` | A processing instruction was forbidden by policy. |
| `XMLCAGE_EXTERNAL_SCHEMA_FORBIDDEN` | An external schema location was found. |
| `XMLCAGE_DUPLICATE_ATTRIBUTE` | The same attribute appeared twice, either exactly or after namespace resolution. |
| `XMLCAGE_PROTOTYPE_KEY` | An element, attribute or serialized name could pollute object prototypes. |
| `XMLCAGE_MAX_DEPTH` | Nesting depth exceeded the configured cap. |
| `XMLCAGE_MAX_BYTES` | Input or serialized output exceeded the byte cap. |
| `XMLCAGE_MAX_ELEMENTS` | Element count exceeded the configured cap. |
| `XMLCAGE_MAX_ATTRIBUTES` | A per-element or total attribute cap was exceeded. |
| `XMLCAGE_MAX_TEXT_LENGTH` | A text or CDATA node exceeded the configured cap. |
| `XMLCAGE_MAX_ATTRIBUTE_VALUE_LENGTH` | An attribute value exceeded the configured cap. |
| `XMLCAGE_MAX_NAME_LENGTH` | A name exceeded the configured cap. |
| `XMLCAGE_MAX_COMMENTS` | Comment count exceeded the configured cap. |
| `XMLCAGE_MAX_ENTITY_REFERENCES` | Reference count exceeded the configured cap. |
| `XMLCAGE_MAX_EXPANDED_TEXT_BYTES` | Decoded reference output exceeded the configured byte cap. |
| `XMLCAGE_MAX_PROCESSING_INSTRUCTIONS` | Processing-instruction count exceeded the configured cap. |
| `XMLCAGE_INVALID_UTF8` | Byte input was not valid UTF-8 or had a UTF-16/UTF-32 pattern. |
| `XMLCAGE_MALFORMED_XML` | Input violated strict XML well-formedness or namespace rules. |
| `XMLCAGE_ENCODING_MISMATCH` | The XML declaration named a non-UTF-8 encoding. |
| `XMLCAGE_INVALID_INPUT` | The caller supplied an unsupported input or serialization value. |
| `XMLCAGE_INVALID_OPTIONS` | The caller supplied an unknown or invalid option. |
| `XMLCAGE_UNSUPPORTED_VALUE` | Serialization encountered a non-data accessor property. |
| `XMLCAGE_CYCLE_DETECTED` | Serialization encountered a cyclic object graph. |

## Deliberate non-goals

`xmlcage` is not a validating XML parser, XPath engine, XSLT processor, XML
Signature implementation or schema validator. It does not fetch external
resources. It does not support custom entities even when a caller tries to
allow a simple DOCTYPE. It does not attempt to preserve the exact lexical form
of the input; it preserves safe semantic nodes.

## Security reports

Read `SECURITY.md` before reporting a vulnerability. Please do not open a
public issue with a working exploit payload.
