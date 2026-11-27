import test from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeXmlAttr,
  escapeXmlText,
  parseSafeXml,
  serializeSafeXml,
  XMLCAGE_ERROR_CODES as ERROR
} from '../src/index.mjs';

const escapeCases = [
  ['plain', 'plain', 'plain'],
  ['amp', 'a&b', 'a&amp;b'],
  ['lt', 'a<b', 'a&lt;b'],
  ['gt', 'a>b', 'a&gt;b'],
  ['quote', 'a"b', 'a&quot;b'],
  ['apos', "a'b", 'a&apos;b'],
  ['all', '&<>"\'', '&amp;&lt;&gt;&quot;&apos;'],
  ['unicode', 'π 😀', 'π 😀'],
  ['newline text', 'a\nb', 'a\nb'],
  ['tab text', 'a\tb', 'a\tb']
];

for (const [name, input, expected] of escapeCases) {
  test('escapeXmlText ' + name, () => {
    assert.equal(escapeXmlText(input), expected);
  });
}

test('escapeXmlText encodes carriage return to preserve it', () => {
  assert.equal(escapeXmlText('a\rb'), 'a&#13;b');
});

for (const [name, input, expected] of escapeCases) {
  test('escapeXmlAttr ' + name, () => {
    const attrExpected = input === 'a\nb' ? 'a&#10;b' : input === 'a\tb' ? 'a&#9;b' : expected;
    assert.equal(escapeXmlAttr(input), attrExpected);
  });
}

test('escapeXmlAttr encodes tab newline and carriage return', () => {
  assert.equal(escapeXmlAttr('a\tb\nc\rd'), 'a&#9;b&#10;c&#13;d');
});

const illegalCodePoints = [0, 1, 2, 7, 8, 11, 12, 14, 15, 31];
for (const codePoint of illegalCodePoints) {
  test('escape rejects illegal control ' + codePoint, () => {
    assert.throws(() => escapeXmlText(String.fromCodePoint(codePoint)), (error) => error.code === ERROR.INVALID_INPUT);
    assert.throws(() => escapeXmlAttr(String.fromCodePoint(codePoint)), (error) => error.code === ERROR.INVALID_INPUT);
  });
}

for (const value of ['\ud800', '\udc00', 'x\ud800', '\udc00x']) {
  test('escape rejects lone surrogate ' + JSON.stringify(value), () => {
    assert.throws(() => escapeXmlText(value), (error) => error.code === ERROR.INVALID_INPUT);
  });
}

for (const value of [undefined, null, 1, true, {}, []]) {
  test('escape rejects non-string ' + String(value), () => {
    assert.throws(() => escapeXmlText(value), (error) => error.code === ERROR.INVALID_INPUT);
  });
}

const validSerializationCases = [
  ['empty element', { name: 'root' }, '<root/>'],
  ['tag alias', { tag: 'root' }, '<root/>'],
  ['tagName alias', { tagName: 'root' }, '<root/>'],
  ['text child', { name: 'root', children: ['text'] }, '<root>text</root>'],
  ['text convenience', { name: 'root', text: 'text' }, '<root>text</root>'],
  ['content convenience', { name: 'root', content: 'text' }, '<root>text</root>'],
  ['attributes', { name: 'root', attributes: { a: '1', b: 'x&y' } }, '<root a="1" b="x&amp;y"/>'],
  ['nested elements', { name: 'a', children: [{ name: 'b', children: [{ name: 'c' }] }] }, '<a><b><c/></b></a>'],
  ['mixed nodes', { name: 'a', children: ['x', { name: 'b' }, 'y'] }, '<a>x<b/>y</a>'],
  ['cdata node', { name: 'a', children: [{ type: 'cdata', value: '<raw>&' }] }, '<a><![CDATA[<raw>&]]></a>'],
  ['comment node', { name: 'a', children: [{ type: 'comment', value: 'ok' }] }, '<a><!--ok--></a>'],
  ['text node object', { name: 'a', children: [{ type: 'text', value: '<x>' }] }, '<a>&lt;x&gt;</a>'],
  ['unicode output', { name: 'r', children: ['π 😀'] }, '<r>π 😀</r>'],
  ['attribute whitespace round trip escaping', { name: 'r', attributes: { a: 'x\ny\tz' } }, '<r a="x&#10;y&#9;z"/>'],
  ['namespace shaped names', { name: 'x:r', attributes: { 'xmlns:x': 'urn:x', 'x:a': '1' } }, '<x:r xmlns:x="urn:x" x:a="1"/>']
];

for (const [name, input, expected] of validSerializationCases) {
  test('serialize valid case: ' + name, () => {
    assert.equal(serializeSafeXml(input), expected);
  });
}

test('serialize document root shorthand with declaration', () => {
  const xml = serializeSafeXml({ root: { name: 'r', children: ['x'] } }, { xmlDeclaration: true });
  assert.equal(xml, '<?xml version="1.0" encoding="UTF-8"?><r>x</r>');
});

test('serialize explicit document children', () => {
  const xml = serializeSafeXml({ type: 'document', children: [{ type: 'comment', value: 'c' }, { name: 'r' }] });
  assert.equal(xml, '<!--c--><r/>');
});

test('serialize processing instruction when allowed', () => {
  const xml = serializeSafeXml({ name: 'r', children: [{ type: 'processing-instruction', target: 'pi', data: 'x' }] }, { allowProcessingInstructions: true });
  assert.equal(xml, '<r><?pi x?></r>');
});

test('serialized xml declaration can round trip', () => {
  const input = '<?xml version="1.0" encoding="UTF-8"?><r a="x&amp;y">text</r>';
  assert.equal(serializeSafeXml(parseSafeXml(input)), input);
});

const roundTripTexts = [
  'plain', '<tag>', '&amp;', 'quotes " and \'', 'line\nbreak', 'carriage\rreturn', 'π 😀', ']]&gt;'
];
for (const text of roundTripTexts) {
  test('serialize parse text round trip ' + JSON.stringify(text), () => {
    const xml = serializeSafeXml({ name: 'r', children: [text] });
    assert.equal(parseSafeXml(xml).root.children[0].value, text);
  });
}

const roundTripAttributes = [
  'plain', '<tag>', '&', 'quotes " and \'', 'line\nbreak', 'tab\tvalue', 'carriage\rreturn', 'π 😀'
];
for (const value of roundTripAttributes) {
  test('serialize parse attribute round trip ' + JSON.stringify(value), () => {
    const xml = serializeSafeXml({ name: 'r', attributes: { a: value } });
    assert.equal(parseSafeXml(xml).root.attributes.a, value);
  });
}

const invalidSerializationCases = [
  ['empty input object', {}, ERROR.INVALID_INPUT],
  ['null input', null, ERROR.INVALID_INPUT],
  ['array input', [], ERROR.INVALID_INPUT],
  ['number input', 4, ERROR.INVALID_INPUT],
  ['digit element name', { name: '1a' }, ERROR.INVALID_INPUT],
  ['space element name', { name: 'a b' }, ERROR.INVALID_INPUT],
  ['multiple colon element name', { name: 'a:b:c' }, ERROR.INVALID_INPUT],
  ['digit attribute name', { name: 'r', attributes: { '1a': 'x' } }, ERROR.INVALID_INPUT],
  ['cdata terminator', { name: 'r', children: [{ type: 'cdata', value: 'a]]>b' }] }, ERROR.INVALID_INPUT],
  ['comment double hyphen', { name: 'r', children: [{ type: 'comment', value: 'a--b' }] }, ERROR.INVALID_INPUT],
  ['comment ending hyphen', { name: 'r', children: [{ type: 'comment', value: 'a-' }] }, ERROR.INVALID_INPUT],
  ['pi terminator', { name: 'r', children: [{ type: 'processing-instruction', target: 'pi', data: 'a?>b' }] }, ERROR.INVALID_INPUT],
  ['pi xml target', { name: 'r', children: [{ type: 'processing-instruction', target: 'xml', data: '' }] }, ERROR.INVALID_INPUT],
  ['nonstring attribute', { name: 'r', attributes: { a: 1 } }, ERROR.INVALID_INPUT],
  ['nonstring child object', { name: 'r', children: [{}] }, ERROR.INVALID_INPUT],
  ['accessor property', (() => { const x = {}; Object.defineProperty(x, 'name', { get: () => 'r' }); return x; })(), ERROR.UNSUPPORTED_VALUE]
];

for (const [name, input, code] of invalidSerializationCases) {
  test('serialize invalid case: ' + name, () => {
    assert.throws(() => serializeSafeXml(input), (error) => {
      assert.equal(error.code, code, error.code + ' != ' + code);
      return true;
    });
  });
}

for (const name of ['__proto__', 'constructor', 'prototype']) {
  test('serialize rejects dangerous element name ' + name, () => {
    assert.throws(() => serializeSafeXml({ name }), (error) => error.code === ERROR.PROTOTYPE_KEY);
  });
  test('serialize rejects dangerous attribute name ' + name, () => {
    assert.throws(() => serializeSafeXml({ name: 'r', attributes: { [name]: 'x' } }), (error) => error.code === ERROR.PROTOTYPE_KEY);
  });
}

test('serialize rejects duplicate names in attributeList', () => {
  assert.throws(() => serializeSafeXml({
    name: 'r',
    attributeList: [{ name: 'a', value: '1' }, { name: 'a', value: '2' }]
  }), (error) => error.code === ERROR.DUPLICATE_ATTRIBUTE);
});

test('serialize rejects cyclic graph', () => {
  const node = { name: 'r', children: [] };
  node.children.push(node);
  assert.throws(() => serializeSafeXml(node), (error) => error.code === ERROR.CYCLE_DETECTED);
});

test('serialize enforces maxDepth', () => {
  const node = { name: 'a', children: [{ name: 'b' }] };
  assert.throws(() => serializeSafeXml(node, { maxDepth: 1 }), (error) => error.code === ERROR.MAX_DEPTH);
});

test('serialize enforces maxElements', () => {
  const node = { name: 'a', children: [{ name: 'b' }] };
  assert.throws(() => serializeSafeXml(node, { maxElements: 1 }), (error) => error.code === ERROR.MAX_ELEMENTS);
});

test('serialize enforces per element attributes', () => {
  const node = { name: 'a', attributes: { x: '1', y: '2' } };
  assert.throws(() => serializeSafeXml(node, { maxAttributesPerElement: 1 }), (error) => error.code === ERROR.MAX_ATTRIBUTES);
});

test('serialize enforces total attributes', () => {
  const node = { name: 'a', attributes: { x: '1' }, children: [{ name: 'b', attributes: { y: '2' } }] };
  assert.throws(() => serializeSafeXml(node, { maxTotalAttributes: 1 }), (error) => error.code === ERROR.MAX_ATTRIBUTES);
});

test('serialize enforces output byte cap', () => {
  assert.throws(() => serializeSafeXml({ name: 'r', children: ['xxxxx'] }, { maxBytes: 10 }), (error) => error.code === ERROR.MAX_BYTES);
});

test('serialize output byte cap counts astral characters as utf8 bytes', () => {
  assert.throws(() => serializeSafeXml({ name: 'r', children: ['😀'] }, { maxBytes: 8 }), (error) => error.code === ERROR.MAX_BYTES);
});

test('serialize deep tree iteratively', () => {
  let current = { name: 'leaf' };
  for (let index = 0; index < 1000; index += 1) current = { name: 'n', children: [current] };
  const xml = serializeSafeXml(current, { maxDepth: 1001, maxElements: 1001 });
  assert.ok(xml.startsWith('<n>'));
  assert.ok(xml.endsWith('</n>'));
});

test('serialize unknown option is rejected', () => {
  assert.throws(() => serializeSafeXml({ name: 'r' }, { unknown: true }), (error) => error.code === ERROR.INVALID_OPTIONS);
});

test('serialize xmlDeclaration option must be boolean', () => {
  assert.throws(() => serializeSafeXml({ name: 'r' }, { xmlDeclaration: 1 }), (error) => error.code === ERROR.INVALID_OPTIONS);
});

test('serialize output policy rejects lexical xinclude injection', () => {
  assert.throws(() => serializeSafeXml({
    name: 'xi:include',
    attributes: { 'xmlns:xi': 'http://www.w3.org/2001/XInclude', href: 'file:///etc/passwd' }
  }), (error) => error.code === ERROR.XINCLUDE_FORBIDDEN);
});

test('serialize output policy rejects namespace resolved xinclude injection', () => {
  assert.throws(() => serializeSafeXml({
    name: 'x:include',
    attributes: { 'xmlns:x': 'http://www.w3.org/2001/XInclude', href: 'https://example.invalid/x' }
  }), (error) => error.code === ERROR.XINCLUDE_FORBIDDEN);
});

test('serialize output policy can explicitly allow xinclude markup', () => {
  const xml = serializeSafeXml({
    name: 'xi:include',
    attributes: { 'xmlns:xi': 'http://www.w3.org/2001/XInclude', href: 'https://example.invalid/x' }
  }, { allowXInclude: true });
  assert.ok(xml.includes('xi:include'));
});

test('serialize output policy rejects external schema location injection', () => {
  assert.throws(() => serializeSafeXml({
    name: 'r',
    attributes: {
      'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      'xsi:schemaLocation': 'urn:example https://example.invalid/schema.xsd'
    }
  }), (error) => error.code === ERROR.EXTERNAL_SCHEMA_FORBIDDEN);
});

test('serialize output policy can explicitly allow schema locations', () => {
  const xml = serializeSafeXml({
    name: 'r',
    attributes: {
      'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      'xsi:schemaLocation': 'urn:example https://example.invalid/schema.xsd'
    }
  }, { allowExternalSchemaLocations: true });
  assert.ok(xml.includes('schemaLocation'));
});

test('serialize rejects namespace resolved duplicate generated attributes', () => {
  assert.throws(() => serializeSafeXml({
    name: 'r',
    attributes: { 'xmlns:a': 'urn:x', 'xmlns:b': 'urn:x', 'a:v': '1', 'b:v': '2' }
  }), (error) => error.code === ERROR.DUPLICATE_ATTRIBUTE);
});

test('serialize rejects unbound generated namespace prefixes', () => {
  assert.throws(() => serializeSafeXml({ name: 'x:r' }), (error) => error.code === ERROR.MALFORMED_XML);
});

test('serialize rejects incorrect reserved xml namespace bindings', () => {
  assert.throws(() => serializeSafeXml({
    name: 'r',
    attributes: { 'xmlns:xml': 'urn:wrong' }
  }), (error) => error.code === ERROR.MALFORMED_XML);
});

test('serialize rejects multiple top level root elements', () => {
  assert.throws(() => serializeSafeXml({
    type: 'document',
    children: [{ name: 'a' }, { name: 'b' }]
  }), (error) => error.code === ERROR.MALFORMED_XML);
});

for (const input of ['text', { type: 'text', value: 'text' }, { type: 'comment', value: 'ok' }]) {
  test('serialize rejects non document top level input ' + (typeof input), () => {
    assert.throws(() => serializeSafeXml(input), (error) => error.code === ERROR.INVALID_INPUT);
  });
}
