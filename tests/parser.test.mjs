import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import {
  auditXml,
  parseSafeXml,
  XMLCAGE_ERROR_CODES as ERROR
} from '../src/index.mjs';
import { assertReportHasCode, codes, nestedXml } from './helpers.mjs';

const validDocuments = [
  ['empty root', '<root/>', {}],
  ['explicit close root', '<root></root>', {}],
  ['text root', '<root>text</root>', {}],
  ['double quoted attribute', '<root a="1"/>', {}],
  ['single quoted attribute', "<root a='1'/>", {}],
  ['two attributes', '<root a="1" b="2"/>', {}],
  ['attribute whitespace around equals', '<root a = "1"/>', {}],
  ['child element', '<root><child/></root>', {}],
  ['mixed content', '<root>pre<child/>post</root>', {}],
  ['whitespace around document', ' \n\t<root/>\n ', {}],
  ['comment before root', '<!--before--><root/>', {}],
  ['comment after root', '<root/><!--after-->', {}],
  ['comment inside root', '<root><!--inside--></root>', {}],
  ['empty comment', '<root><!----></root>', {}],
  ['cdata section', '<root><![CDATA[raw <>& text]]></root>', {}],
  ['empty cdata section', '<root><![CDATA[]]></root>', {}],
  ['cdata with brackets', '<root><![CDATA[a]b]]x]]></root>', {}],
  ['xml declaration only version', '<?xml version="1.0"?><root/>', {}],
  ['xml declaration utf8', '<?xml version="1.0" encoding="UTF-8"?><root/>', {}],
  ['xml declaration lowercase utf8', '<?xml version="1.0" encoding="utf-8"?><root/>', {}],
  ['xml declaration standalone yes', '<?xml version="1.0" standalone="yes"?><root/>', {}],
  ['xml declaration standalone no', '<?xml version="1.0" standalone="no"?><root/>', {}],
  ['xml declaration all fields', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><root/>', {}],
  ['xml declaration single quotes', "<?xml version='1.0' encoding='UTF-8'?><root/>", {}],
  ['xml declaration trailing whitespace', '<?xml version="1.0" ?><root/>', {}],
  ['leading utf8 bom', '\ufeff<root/>', {}],
  ['crlf input', '<root>\r\n<a/>\r\ntext\r</root>', {}],
  ['unicode element name', '<résumé/>', {}],
  ['unicode attribute name', '<root café="yes"/>', {}],
  ['unicode text', '<root>hello π 😀</root>', {}],
  ['unicode attribute value', '<root a="hello π 😀"/>', {}],
  ['underscore name', '<_root/>', {}],
  ['hyphen dot digits after first character', '<a-1.2/>', {}],
  ['simple doctype when allowed', '<!DOCTYPE root><root/>', { allowDoctype: true }],
  ['ordinary pi when allowed', '<?pi data?><root><?pi two?></root>', { allowProcessingInstructions: true }],
  ['stylesheet pi when allowed', '<root><?xml-stylesheet href="style.xsl"?></root>', { allowXmlStylesheet: true }],
  ['default namespace', '<root xmlns="urn:example"><child/></root>', {}],
  ['prefixed namespace', '<x:root xmlns:x="urn:example"><x:child/></x:root>', {}],
  ['xml prefixed attribute', '<root xml:lang="en"/>', {}],
  ['empty default namespace undeclared', '<root xmlns="urn:a"><child xmlns=""><grand/></child></root>', {}],
  ['namespace rebinding', '<root xmlns:x="urn:a"><x:one xmlns:x="urn:b"/><x:two/></root>', {}]
];

for (const [name, xml, options] of validDocuments) {
  test('valid document accepted: ' + name, () => {
    const report = auditXml(xml, options);
    assert.equal(report.safe, true, codes(report).join(','));
    const documentNode = parseSafeXml(xml, options);
    assert.equal(documentNode.type, 'document');
    assert.ok(documentNode.root);
  });
}

test('document AST shape and values are exposed', () => {
  const documentNode = parseSafeXml('<?xml version="1.0" encoding="UTF-8"?><root a="1"><child>text</child><![CDATA[x]]></root>');
  assert.equal(documentNode.type, 'document');
  assert.equal(documentNode.xmlDeclaration.version, '1.0');
  assert.equal(documentNode.xmlDeclaration.encoding, 'UTF-8');
  assert.equal(documentNode.xmlDeclaration.standalone, null);
  assert.equal(documentNode.root.type, 'element');
  assert.equal(documentNode.root.name, 'root');
  assert.equal(documentNode.root.localName, 'root');
  assert.equal(documentNode.root.prefix, null);
  assert.equal(documentNode.root.namespaceURI, null);
  assert.equal(documentNode.root.attributes.a, '1');
  assert.equal(documentNode.root.attributeList[0].name, 'a');
  assert.equal(documentNode.root.children[0].name, 'child');
  assert.equal(documentNode.root.children[0].children[0].type, 'text');
  assert.equal(documentNode.root.children[0].children[0].value, 'text');
  assert.equal(documentNode.root.children[1].type, 'cdata');
  assert.equal(documentNode.root.children[1].value, 'x');
});

test('AST nodes and attribute maps use null prototypes', () => {
  const documentNode = parseSafeXml('<root a="1"><child/></root>');
  assert.equal(Object.getPrototypeOf(documentNode), null);
  assert.equal(Object.getPrototypeOf(documentNode.root), null);
  assert.equal(Object.getPrototypeOf(documentNode.root.attributes), null);
  assert.equal(Object.getPrototypeOf(documentNode.root.attributeList[0]), null);
});

test('AST is deeply frozen', () => {
  const documentNode = parseSafeXml('<root a="1"><child>text</child></root>');
  assert.ok(Object.isFrozen(documentNode));
  assert.ok(Object.isFrozen(documentNode.root));
  assert.ok(Object.isFrozen(documentNode.root.attributes));
  assert.ok(Object.isFrozen(documentNode.root.children));
  assert.throws(() => {
    documentNode.root.attributes.a = 'changed';
  }, TypeError);
  assert.throws(() => {
    documentNode.root.children.push({});
  }, TypeError);
});

test('CRLF and CR normalize to LF in text', () => {
  const documentNode = parseSafeXml('<root>a\r\nb\rc</root>');
  assert.equal(documentNode.root.children[0].value, 'a\nb\nc');
});

test('cdata preserves raw markup characters without entity decoding', () => {
  const documentNode = parseSafeXml('<root><![CDATA[&amp;<tag>]]></root>');
  assert.equal(documentNode.root.children[0].value, '&amp;<tag>');
});

test('mixed content preserves node order', () => {
  const documentNode = parseSafeXml('<root>a<b/>c<![CDATA[d]]>e</root>');
  assert.deepEqual(documentNode.root.children.map((node) => node.type), ['text', 'element', 'text', 'cdata', 'text']);
  assert.deepEqual(documentNode.root.children.map((node) => node.type === 'element' ? node.name : node.value), ['a', 'b', 'c', 'd', 'e']);
});

const malformedDocuments = [
  ['empty input', ''],
  ['whitespace only', ' \n\t'],
  ['text only', 'hello'],
  ['text before root', 'x<root/>'],
  ['text after root', '<root/>x'],
  ['two roots', '<a/><b/>'],
  ['end tag only', '</a>'],
  ['extra end after root', '<a/></a>'],
  ['mismatched case end', '<a></A>'],
  ['nested mismatch', '<a><b></a></b>'],
  ['unclosed root', '<a>'],
  ['unclosed child', '<a><b></a>'],
  ['unterminated start tag', '<a'],
  ['unterminated start tag after name', '<a '],
  ['unterminated end tag', '<a></a'],
  ['empty tag name', '<>'],
  ['space before tag name', '< a/>'],
  ['digit start name', '<1a/>'],
  ['hyphen start name', '<-a/>'],
  ['dot start name', '<.a/>'],
  ['multiple colons in element name', '<a:b:c/>'],
  ['leading colon in element name', '<:a/>'],
  ['trailing colon in element name', '<a:/>'],
  ['multiple colons in attribute name', '<r a:b:c="1"/>'],
  ['missing attribute equals', '<r a "1"/>'],
  ['missing attribute quote', '<r a=1/>'],
  ['unterminated attribute', '<r a="1></r>'],
  ['unterminated single attribute', "<r a='1></r>"],
  ['raw less than in attribute', '<r a="x<y"/>'],
  ['stray ampersand in attribute', '<r a="x&y"/>'],
  ['stray ampersand in text', '<r>x&y</r>'],
  ['empty reference', '<r>&;</r>'],
  ['unterminated reference', '<r>&amp</r>'],
  ['cdata terminator in text', '<r>]]></r>'],
  ['unterminated cdata', '<r><![CDATA[x</r>'],
  ['malformed cdata lowercase', '<r><![cdata[x]]></r>'],
  ['double hyphen comment', '<r><!-- a -- b --></r>'],
  ['comment ending hyphen', '<r><!-- a ---></r>'],
  ['unterminated comment', '<r><!-- a</r>'],
  ['unterminated pi', '<r><?pi x</r>'],
  ['xml declaration wrong version', '<?xml version="1.1"?><r/>'],
  ['xml declaration missing version', '<?xml encoding="UTF-8"?><r/>'],
  ['xml declaration unquoted version', '<?xml version=1.0?><r/>'],
  ['xml declaration bad standalone', '<?xml version="1.0" standalone="maybe"?><r/>'],
  ['xml declaration trailing junk', '<?xml version="1.0" junk?><r/>'],
  ['doctype after root', '<r/><!DOCTYPE r>'],
  ['doctype inside root', '<r><!DOCTYPE r></r>'],
  ['two roots with whitespace', '<a/> \n <b/>'],
  ['unbound element prefix', '<x:a/>'],
  ['unbound attribute prefix', '<a x:b="1"/>'],
  ['prefixed xmlns empty binding', '<a xmlns:x=""><x:b/></a>'],
  ['wrong xml namespace binding', '<a xmlns:xml="wrong"/>'],
  ['xml namespace bound to wrong prefix', '<a xmlns:x="http://www.w3.org/XML/1998/namespace"/>'],
  ['xmlns prefix rebound', '<a xmlns:xmlns="urn:x"/>'],
  ['xmlns namespace bound', '<a xmlns:x="http://www.w3.org/2000/xmlns/"/>'],
  ['namespace uri contains space', '<a xmlns:x="urn:bad space"><x:b/></a>'],
  ['literal nul in text', '<r>\u0000</r>'],
  ['literal control one in text', '<r>\u0001</r>'],
  ['literal control eight in attribute', '<r a="\u0008"/>'],
  ['literal vertical tab', '<r>\u000b</r>'],
  ['literal form feed', '<r>\u000c</r>'],
  ['literal lone high surrogate', '<r>\ud800</r>'],
  ['literal lone low surrogate', '<r>\udc00</r>']
];

for (const [name, xml] of malformedDocuments) {
  test('malformed document rejected: ' + name, () => {
    const report = auditXml(xml);
    assert.equal(report.safe, false, 'expected unsafe report');
    assert.ok(
      report.findings.some((finding) => finding.code === ERROR.MALFORMED_XML || finding.code === ERROR.DOCTYPE_FORBIDDEN || finding.code === ERROR.UNKNOWN_ENTITY),
      codes(report).join(',')
    );
    assert.throws(() => parseSafeXml(xml), (error) => {
      assert.equal(error.name, 'XmlCageError');
      return true;
    });
  });
}


for (const [name, xml] of [
  ['pi target xml inside root', '<r><?xml version="1.0"?></r>'],
  ['pi target xmlfoo inside root', '<r><?xmlfoo x?></r>'],
  ['pi target mixed case xml prefix', '<r><?XmLabc x?></r>'],
  ['xml declaration after whitespace', ' <?xml version="1.0"?><r/>']
]) {
  test('reserved xml processing target rejected when instructions are allowed: ' + name, () => {
    assertReportHasCode(auditXml(xml, { allowProcessingInstructions: true }), ERROR.MALFORMED_XML);
  });
}

test('non UTF8 declaration uses encoding mismatch code', () => {
  assertReportHasCode(auditXml('<?xml version="1.0" encoding="UTF-16"?><r/>'), ERROR.ENCODING_MISMATCH);
});

test('unknown entity uses stable code', () => {
  assertReportHasCode(auditXml('<r>&madeup;</r>'), ERROR.UNKNOWN_ENTITY);
});

const duplicateAttributeDocuments = [
  ['exact duplicate double quoted', '<r a="1" a="2"/>'],
  ['exact duplicate mixed quotes', '<r a="1" a=\'2\'/>'],
  ['duplicate after namespace resolution', '<r xmlns:a="urn:x" xmlns:b="urn:x" a:v="1" b:v="2"/>'],
  ['duplicate inherited and local namespace attributes', '<r xmlns:a="urn:x"><c xmlns:b="urn:x" a:v="1" b:v="2"/></r>'],
  ['duplicate in child element', '<r><c xmlns:a="urn:x" xmlns:b="urn:x" a:v="1" b:v="2"/></r>']
];

for (const [name, xml] of duplicateAttributeDocuments) {
  test('duplicate attribute rejected: ' + name, () => {
    assertReportHasCode(auditXml(xml), ERROR.DUPLICATE_ATTRIBUTE);
  });
}

test('same local names in different namespaces are not duplicates', () => {
  const xml = '<r xmlns:a="urn:a" xmlns:b="urn:b" a:v="1" b:v="2"/>';
  const report = auditXml(xml);
  assert.equal(report.safe, true, codes(report).join(','));
});

for (const [name, xml] of [
  ['digit after element prefix', '<p:2a xmlns:p="urn:x"/>'],
  ['hyphen after element prefix', '<p:-a xmlns:p="urn:x"/>'],
  ['dot after element prefix', '<p:.a xmlns:p="urn:x"/>'],
  ['digit after attribute prefix', '<r xmlns:p="urn:x" p:2a="1"/>'],
  ['hyphen after attribute prefix', '<r xmlns:p="urn:x" p:-a="1"/>'],
  ['digit in declared namespace prefix', '<r xmlns:2p="urn:x"/>'],
  ['hyphen in declared namespace prefix', '<r xmlns:-p="urn:x"/>']
]) {
  test('qualified name ncname boundary rejected: ' + name, () => {
    assertReportHasCode(auditXml(xml), ERROR.MALFORMED_XML);
  });
}

test('qualified name ncname characters after the first are accepted', () => {
  const xml = '<p:a-2 xmlns:p="urn:x" p:b-2="1"/>';
  const report = auditXml(xml);
  assert.equal(report.safe, true, codes(report).join(','));
});

test('unprefixed attributes are not in the default namespace', () => {
  const documentNode = parseSafeXml('<r xmlns="urn:default" v="1"/>');
  assert.equal(documentNode.root.namespaceURI, 'urn:default');
  assert.equal(documentNode.root.attributeList.find((attribute) => attribute.name === 'v').namespaceURI, null);
});

test('namespace scoping is restored after a child closes', () => {
  const documentNode = parseSafeXml('<r xmlns:x="urn:a"><x:one xmlns:x="urn:b"/><x:two/></r>');
  const one = documentNode.root.children[0];
  const two = documentNode.root.children[1];
  assert.equal(one.namespaceURI, 'urn:b');
  assert.equal(two.namespaceURI, 'urn:a');
});

test('self closing namespace child restores binding immediately', () => {
  const documentNode = parseSafeXml('<r><x:one xmlns:x="urn:b"/><x:two xmlns:x="urn:b"/></r>');
  assert.equal(documentNode.root.children[0].namespaceURI, 'urn:b');
  assert.equal(documentNode.root.children[1].namespaceURI, 'urn:b');
});

test('empty default namespace undeclares only default namespace', () => {
  const documentNode = parseSafeXml('<r xmlns="urn:a" xmlns:x="urn:p"><c xmlns=""><x:in/><out/></c></r>');
  const child = documentNode.root.children[0];
  assert.equal(child.children[0].namespaceURI, 'urn:p');
  assert.equal(child.children[1].namespaceURI, null);
});

const prototypeNames = ['__proto__', 'constructor', 'prototype'];
for (const name of prototypeNames) {
  test('prototype pollution element name rejected: ' + name, () => {
    assertReportHasCode(auditXml('<' + name + '/>'), ERROR.PROTOTYPE_KEY);
  });
  test('prototype pollution attribute name rejected: ' + name, () => {
    assertReportHasCode(auditXml('<r ' + name + '="x"/>'), ERROR.PROTOTYPE_KEY);
  });
  test('prefixed prototype local element name rejected: ' + name, () => {
    assertReportHasCode(auditXml('<p:' + name + ' xmlns:p="urn:x"/>'), ERROR.PROTOTYPE_KEY);
  });
  test('prefixed prototype local attribute name rejected: ' + name, () => {
    assertReportHasCode(auditXml('<r xmlns:p="urn:x" p:' + name + '="x"/>'), ERROR.PROTOTYPE_KEY);
  });
}

test('similar but safe names are accepted', () => {
  const xml = '<__proto__x constructorx="1" prototypex="2"><constructor-x/></__proto__x>';
  const report = auditXml(xml);
  assert.equal(report.safe, true, codes(report).join(','));
});

test('deep bomb hits max depth quickly without stack overflow', () => {
  const depth = 100000;
  const xml = nestedXml(depth);
  const started = performance.now();
  const report = auditXml(xml);
  const elapsed = performance.now() - started;
  assertReportHasCode(report, ERROR.MAX_DEPTH);
  assert.ok(elapsed < 1500, 'deep audit took ' + elapsed + 'ms');
});

test('moderately deep document parses iteratively when limits allow it', () => {
  const depth = 5000;
  const xml = nestedXml(depth);
  const documentNode = parseSafeXml(xml, { maxDepth: depth, maxElements: depth });
  assert.equal(documentNode.root.name, 'a');
});

test('depth exactly at cap is accepted', () => {
  const xml = nestedXml(3);
  const report = auditXml(xml, { maxDepth: 3, maxElements: 3 });
  assert.equal(report.safe, true, codes(report).join(','));
  assert.equal(report.stats.maxDepthObserved, 3);
});

test('depth one beyond cap is rejected', () => {
  assertReportHasCode(auditXml(nestedXml(4), { maxDepth: 3 }), ERROR.MAX_DEPTH);
});

test('xml declaration fields are represented in document', () => {
  const documentNode = parseSafeXml('<?xml version="1.0" encoding="UTF-8" standalone="no"?><r/>');
  assert.equal(documentNode.xmlDeclaration.encoding, 'UTF-8');
  assert.equal(documentNode.xmlDeclaration.standalone, false);
});

test('simple allowed doctype does not create a document node', () => {
  const documentNode = parseSafeXml('<!DOCTYPE root><root/>', { allowDoctype: true });
  assert.equal(documentNode.root.name, 'root');
  assert.equal(documentNode.children.length, 1);
});
