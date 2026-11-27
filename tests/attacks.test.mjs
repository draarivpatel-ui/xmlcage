import test from 'node:test';
import assert from 'node:assert/strict';
import {
  auditXml,
  assertSafeXml,
  parseSafeXml,
  XMLCAGE_ERROR_CODES as ERROR
} from '../src/index.mjs';
import { assertReportHasCode, assertThrowsCode, codes } from './helpers.mjs';

const xxePayloads = [
  ['passwd file entity', '<!DOCTYPE r [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><r>&xxe;</r>'],
  ['cloud metadata entity', '<!DOCTYPE r [<!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data">]><r>&xxe;</r>'],
  ['https metadata entity', '<!DOCTYPE r [<!ENTITY xxe SYSTEM "https://169.254.169.254/latest/meta-data">]><r>&xxe;</r>'],
  ['php filter entity', '<!DOCTYPE r [<!ENTITY xxe SYSTEM "php://filter/convert.base64-encode/resource=/etc/passwd">]><r>&xxe;</r>'],
  ['expect entity', '<!DOCTYPE r [<!ENTITY xxe SYSTEM "expect://id">]><r>&xxe;</r>'],
  ['gopher entity', '<!DOCTYPE r [<!ENTITY xxe SYSTEM "gopher://127.0.0.1:25/xHELO">]><r>&xxe;</r>'],
  ['jar entity', '<!DOCTYPE r [<!ENTITY xxe SYSTEM "jar:http://example.test/a.jar!/x">]><r>&xxe;</r>'],
  ['netdoc entity', '<!DOCTYPE r [<!ENTITY xxe SYSTEM "netdoc:///etc/passwd">]><r>&xxe;</r>'],
  ['single quoted system id', "<!DOCTYPE r [<!ENTITY xxe SYSTEM 'file:///etc/passwd'>]><r>&xxe;</r>"],
  ['public external id', '<!DOCTYPE r [<!ENTITY xxe PUBLIC "-//X//EN" "http://example.test/x">]><r>&xxe;</r>'],
  ['internal custom entity', '<!DOCTYPE r [<!ENTITY xxe "secret">]><r>&xxe;</r>'],
  ['parameter entity declaration', '<!DOCTYPE r [<!ENTITY % xxe SYSTEM "file:///etc/passwd">]><r/>'],
  ['parameter entity indirect', '<!DOCTYPE r [<!ENTITY % a "<!ENTITY xxe SYSTEM \'file:///etc/passwd\'>"> %a;]><r>&xxe;</r>'],
  ['external parameter entity', '<!DOCTYPE r [<!ENTITY % xxe SYSTEM "http://example.test/x.dtd"> %xxe;]><r/>'],
  ['entity in attlist default', '<!DOCTYPE r [<!ATTLIST r a CDATA "&xxe;">]><r/>'],
  ['notation external', '<!DOCTYPE r [<!NOTATION n SYSTEM "http://example.test/n">]><r/>'],
  ['doctype system only', '<!DOCTYPE r SYSTEM "http://example.test/evil.dtd"><r/>'],
  ['doctype public only', '<!DOCTYPE r PUBLIC "-//X//EN" "http://example.test/evil.dtd"><r/>'],
  ['utf8 bom xxe', '\ufeff<!DOCTYPE r [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><r>&xxe;</r>'],
  ['newline before xxe', '\n<!DOCTYPE r [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><r>&xxe;</r>'],
  ['xml declaration then xxe', '<?xml version="1.0"?><!DOCTYPE r [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><r>&xxe;</r>'],
  ['spaces in entity declaration', '<!DOCTYPE r [<!ENTITY    xxe    SYSTEM    "file:///etc/passwd">]><r>&xxe;</r>'],
  ['comment before entity declaration', '<!DOCTYPE r [<!--c--><!ENTITY xxe SYSTEM "file:///etc/passwd">]><r>&xxe;</r>'],
  ['comment inside entity keyword', '<!DOCTYPE r [<!ENT<!-- -->ITY xxe SYSTEM "file:///etc/passwd">]><r>&xxe;</r>'],
  ['mixed case entity keyword', '<!DOCTYPE r [<!EnTiTy xxe SYSTEM "file:///etc/passwd">]><r>&xxe;</r>'],
  ['lowercase entity keyword', '<!DOCTYPE r [<!entity xxe SYSTEM "file:///etc/passwd">]><r>&xxe;</r>'],
  ['mixed case system keyword', '<!DOCTYPE r [<!ENTITY xxe SyStEm "file:///etc/passwd">]><r>&xxe;</r>'],
  ['lowercase public keyword', '<!DOCTYPE r [<!ENTITY xxe public "-//X//EN" "http://example.test/x">]><r>&xxe;</r>'],
  ['attribute entity use', '<!DOCTYPE r [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><r a="&xxe;"/>'],
  ['entity reference repeated', '<!DOCTYPE r [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><r>&xxe;&xxe;&xxe;</r>'],
  ['cdata is inert', '<r><![CDATA[<!ENTITY xxe SYSTEM "file:///etc/passwd">]]></r>'],
  ['comment content is inert', '<!-- <!ENTITY xxe SYSTEM "file:///etc/passwd"> --><r/>']
];

for (const [name, xml] of xxePayloads) {
  test('xxe scanner case: ' + name, () => {
    const report = auditXml(xml);
    if (name.endsWith('is inert')) {
      assert.equal(report.safe, true, codes(report).join(','));
    } else if (name.includes('attlist')) {
      assertReportHasCode(report, ERROR.ATTLIST_FORBIDDEN);
    } else if (name.includes('notation')) {
      assertReportHasCode(report, ERROR.NOTATION_FORBIDDEN);
    } else if (name.includes('doctype')) {
      assertReportHasCode(report, ERROR.EXTERNAL_ID_FORBIDDEN);
    } else {
      assertReportHasCode(report, ERROR.ENTITY_FORBIDDEN);
    }
  });
}

test('external doctype without entity has external identifier finding', () => {
  assertReportHasCode(auditXml(xxePayloads[16][1]), ERROR.EXTERNAL_ID_FORBIDDEN);
});

test('public doctype without entity has external identifier finding', () => {
  assertReportHasCode(auditXml(xxePayloads[17][1]), ERROR.EXTERNAL_ID_FORBIDDEN);
});

const billionLaughsPayloads = [
  '<!DOCTYPE lolz [<!ENTITY lol "laugh"><!ENTITY lol1 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;"><!ENTITY lol2 "&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;">]><lolz>&lol2;</lolz>',
  '<!DOCTYPE a [<!ENTITY x "1234567890"><!ENTITY y "&x;&x;&x;&x;&x;&x;&x;&x;&x;&x;"><!ENTITY z "&y;&y;&y;&y;&y;&y;&y;&y;&y;&y;">]><a>&z;</a>',
  '<!DOCTYPE a [<!ENTITY x "x"><!ENTITY x2 "&x;&x;"><!ENTITY x3 "&x2;&x2;"><!ENTITY x4 "&x3;&x3;"><!ENTITY x5 "&x4;&x4;">]><a>&x5;</a>',
  '<!DOCTYPE a [<!ENTITY x "a very large replacement text that would be copied repeatedly"><!ENTITY y "&x;&x;&x;&x;">]><a>&y;&y;&y;&y;</a>',
  '<!DOCTYPE a [<!ENTITY % p "<!ENTITY x \'expanded\'>"><!ENTITY x "trigger">]><a>&x;</a>'
];

for (const [index, xml] of billionLaughsPayloads.entries()) {
  test('billion laughs custom expansion is rejected ' + index, () => {
    const report = auditXml(xml);
    assertReportHasCode(report, ERROR.ENTITY_FORBIDDEN);
    assert.throws(() => parseSafeXml(xml), (error) => {
      assert.ok(error.code === ERROR.DOCTYPE_FORBIDDEN || error.code === ERROR.ENTITY_FORBIDDEN);
      return true;
    });
  });
}

test('repeated numeric references hit maxEntityReferences', () => {
  const xml = '<r>' + '&#65;'.repeat(5) + '</r>';
  assertReportHasCode(auditXml(xml, { maxEntityReferences: 4 }), ERROR.MAX_ENTITY_REFERENCES);
});

test('repeated numeric references hit expanded byte cap', () => {
  const xml = '<r>' + '&#65;'.repeat(5) + '</r>';
  assertReportHasCode(auditXml(xml, { maxExpandedTextBytes: 4 }), ERROR.MAX_EXPANDED_TEXT_BYTES);
});

test('repeated astral numeric references count four expansion bytes each', () => {
  const xml = '<r>' + '&#x1F600;'.repeat(3) + '</r>';
  const report = auditXml(xml, { maxExpandedTextBytes: 12 });
  assert.equal(report.safe, true, codes(report).join(','));
  assert.equal(report.stats.expandedTextBytes, 12);
});

test('repeated astral numeric references reject one byte beyond cap', () => {
  const xml = '<r>' + '&#x1F600;'.repeat(4) + '</r>';
  assertReportHasCode(auditXml(xml, { maxExpandedTextBytes: 12 }), ERROR.MAX_EXPANDED_TEXT_BYTES);
});

const xincludePayloads = [
  '<xi:include xmlns:xi="http://www.w3.org/2001/XInclude" href="file:///etc/passwd"/>',
  '<xi:include xmlns:xi="http://www.w3.org/2001/XInclude" href="http://169.254.169.254/latest/meta-data"/>',
  '<xi:include xmlns:xi="http://www.w3.org/2001/XInclude" parse="text" href="file:///etc/passwd"/>',
  '<xi:include xmlns:xi="http://www.w3.org/2001/XInclude"><xi:fallback>fallback</xi:fallback></xi:include>',
  '<xi:fallback xmlns:xi="http://www.w3.org/2001/XInclude">fallback</xi:fallback>',
  '<include xmlns="http://www.w3.org/2001/XInclude" href="file:///etc/passwd"/>',
  '<x:include xmlns:x="http://www.w3.org/2001/XInclude" href="file:///etc/passwd"/>',
  '<r><xi:include xmlns:xi="http://www.w3.org/2001/XInclude" href="file:///etc/passwd"/></r>',
  '<xi:include href="file:///etc/passwd"/>',
  '<Xi:include xmlns:Xi="http://www.w3.org/2001/XInclude" href="file:///etc/passwd"/>'
];

for (const [index, xml] of xincludePayloads.entries()) {
  test('xinclude payload rejected ' + index, () => {
    assertReportHasCode(auditXml(xml), ERROR.XINCLUDE_FORBIDDEN);
  });
}

test('xinclude can be allowed as inert data', () => {
  const xml = xincludePayloads[0];
  const report = auditXml(xml, { allowXInclude: true });
  assert.equal(report.safe, true, codes(report).join(','));
  assert.equal(parseSafeXml(xml, { allowXInclude: true }).root.name, 'xi:include');
});

const processingInstructionPayloads = [
  '<?xml-stylesheet type="text/xsl" href="http://example.test/x.xsl"?><r/>',
  '<?xml-stylesheet type="text/xsl" href="file:///etc/passwd"?><r/>',
  '<r><?xml-stylesheet type="text/xsl" href="http://example.test/x.xsl"?></r>',
  '<r><?xml-stylesheet href="data:text/xsl,<x"/?></r>',
  '<r><?pi data?></r>',
  '<?pi data?><r/>',
  '<r><?php echo 1; ?></r>',
  '<r><?xmlfoo data?></r>',
  '<r><?x-a valid?></r>',
  '<?xml-stylesheet href="a"?><r><?xml-stylesheet href="b"?></r>'
];

for (const [index, xml] of processingInstructionPayloads.entries()) {
  test('processing instruction rejected by default ' + index, () => {
    assertReportHasCode(auditXml(xml), ERROR.PROCESSING_INSTRUCTION_FORBIDDEN);
  });
}

test('ordinary processing instructions can be allowed', () => {
  const report = auditXml('<r><?pi data?></r>', { allowProcessingInstructions: true });
  assert.equal(report.safe, true, codes(report).join(','));
  const documentNode = parseSafeXml('<r><?pi data?></r>', { allowProcessingInstructions: true });
  assert.equal(documentNode.root.children[0].type, 'processing-instruction');
  assert.equal(documentNode.root.children[0].target, 'pi');
  assert.equal(documentNode.root.children[0].data, 'data');
});

for (const xml of [
  '<r><?pi <!DOCTYPE foo>?></r>',
  '<?pi <!ENTITY x "y">?><r/>',
  '<r><?pi <!ATTLIST r a CDATA #IMPLIED>?></r>'
]) {
  test('declaration text inside an allowed processing instruction is inert', () => {
    const report = auditXml(xml, { allowProcessingInstructions: true });
    assert.equal(report.safe, true, codes(report).join(','));
  });
}

test('unterminated processing instruction hiding declaration text is still rejected', () => {
  const report = auditXml('<r><?pi <!DOCTYPE foo></r>', { allowProcessingInstructions: true });
  assert.equal(report.safe, false);
  assert.ok(report.findings.some((finding) => finding.code === ERROR.MALFORMED_XML), codes(report).join(','));
});

test('xml stylesheet remains separately denied when ordinary pi is allowed', () => {
  assertReportHasCode(
    auditXml('<r><?xml-stylesheet href="x"?></r>', { allowProcessingInstructions: true }),
    ERROR.PROCESSING_INSTRUCTION_FORBIDDEN
  );
});

test('xml stylesheet can be allowed as inert data', () => {
  const report = auditXml('<r><?xml-stylesheet href="x"?></r>', { allowXmlStylesheet: true });
  assert.equal(report.safe, true, codes(report).join(','));
});

const schemaLocations = [
  'http://169.254.169.254/latest/meta-data',
  'https://example.test/schema.xsd',
  'file:///etc/passwd',
  'ftp://example.test/schema.xsd',
  'gopher://example.test/x',
  '//example.test/schema.xsd',
  '/etc/passwd',
  '\\\\server\\share\\schema.xsd',
  '../secret.xsd',
  'sub/../../secret.xsd',
  'HtTp://example.test/schema.xsd'
];

for (const location of schemaLocations) {
  test('external xsi schemaLocation rejected: ' + location, () => {
    const xml = '<r xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:example ' + location + '"/>';
    assertReportHasCode(auditXml(xml), ERROR.EXTERNAL_SCHEMA_FORBIDDEN);
  });
  test('external xsi noNamespaceSchemaLocation rejected: ' + location, () => {
    const xml = '<r xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="' + location + '"/>';
    assertReportHasCode(auditXml(xml), ERROR.EXTERNAL_SCHEMA_FORBIDDEN);
  });
}

test('schema location with entity-encoded scheme is decoded before detection', () => {
  const xml = '<r xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="&#x68;ttp://example.test/x"/>';
  assertReportHasCode(auditXml(xml), ERROR.EXTERNAL_SCHEMA_FORBIDDEN);
});

for (const [name, location] of [
  ['percent encoded parent traversal', '%2e%2e/secret.xsd'],
  ['mixed case percent encoded parent traversal', '%2E%2e/secret.xsd'],
  ['single encoded dot in traversal', '.%2e/secret.xsd'],
  ['percent encoded scheme letters', '%68%74%74%70://example.test/schema.xsd']
]) {
  test('schema location percent normalization rejected: ' + name, () => {
    const xml = '<r xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="' + location + '"/>';
    assertReportHasCode(auditXml(xml), ERROR.EXTERNAL_SCHEMA_FORBIDDEN);
  });
}

test('reserved percent escapes in a relative schema name remain inert', () => {
  const xml = '<r xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="schema%20file.xsd"/>';
  const report = auditXml(xml);
  assert.equal(report.safe, true, codes(report).join(','));
});

test('schema location through alternate prefix bound to xsi namespace is rejected', () => {
  const xml = '<r xmlns:s="http://www.w3.org/2001/XMLSchema-instance" s:noNamespaceSchemaLocation="https://example.test/x"/>';
  assertReportHasCode(auditXml(xml), ERROR.EXTERNAL_SCHEMA_FORBIDDEN);
});

test('unbound xsi prefix with external schema is still rejected as schema risk', () => {
  const xml = '<r xsi:noNamespaceSchemaLocation="https://example.test/x"/>';
  assertReportHasCode(auditXml(xml), ERROR.EXTERNAL_SCHEMA_FORBIDDEN);
});

test('same-directory relative schema reference is inert under the default parser', () => {
  const xml = '<r xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="schema.xsd"/>';
  const report = auditXml(xml);
  assert.equal(report.safe, true, codes(report).join(','));
});

test('external schema locations can be allowed as inert data', () => {
  const xml = '<r xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://example.test/x"/>';
  const report = auditXml(xml, { allowExternalSchemaLocations: true });
  assert.equal(report.safe, true, codes(report).join(','));
});

const invalidDecimalReferences = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 14, 15, 16, 17, 18, 19,
  20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
  55296, 56319, 57343, 65534, 65535, 1114112, 1114113, 9999999
];

for (const value of invalidDecimalReferences) {
  test('illegal decimal character reference ' + value, () => {
    assertReportHasCode(auditXml('<r>&#' + value + ';</r>'), ERROR.ILLEGAL_CHAR_REF);
  });
}

const invalidHexReferences = [
  '0', '1', '8', 'B', 'C', 'E', '1F', 'D800', 'DBFF', 'DC00', 'DFFF',
  'FFFE', 'FFFF', '110000', 'FFFFFF', 'GG', '12G', '-1', '+1'
];

for (const value of invalidHexReferences) {
  test('illegal hexadecimal character reference ' + value, () => {
    assertReportHasCode(auditXml('<r>&#x' + value + ';</r>'), ERROR.ILLEGAL_CHAR_REF);
  });
}

const malformedReferences = [
  '#', '#x', '#X41', '# 41', '#x 41', '#x1 2', 'amp extra', 'AMP', 'Amp', 'LT',
  'madeup', 'xxe', 'nbsp', 'copy', 'xml', 'xmlns', '_private', '%xxe'
];

for (const body of malformedReferences) {
  test('unknown or malformed entity reference &' + body + ';', () => {
    const report = auditXml('<r>&' + body + ';</r>');
    assert.equal(report.safe, false);
    assert.ok(
      report.findings.some((finding) => finding.code === ERROR.UNKNOWN_ENTITY || finding.code === ERROR.ILLEGAL_CHAR_REF),
      codes(report).join(',')
    );
  });
}

const validReferences = [
  ['#9', 0x9], ['#10', 0xa], ['#13', 0xd], ['#32', 0x20], ['#38', 0x26],
  ['#60', 0x3c], ['#62', 0x3e], ['#34', 0x22], ['#39', 0x27], ['#65', 0x41],
  ['#x9', 0x9], ['#xA', 0xa], ['#xD', 0xd], ['#x20', 0x20], ['#x26', 0x26],
  ['#x3C', 0x3c], ['#x3E', 0x3e], ['#x22', 0x22], ['#x27', 0x27], ['#x41', 0x41],
  ['#x7E', 0x7e], ['#xA0', 0xa0], ['#xD7FF', 0xd7ff], ['#xE000', 0xe000],
  ['#xFFFD', 0xfffd], ['#x10000', 0x10000], ['#x1F600', 0x1f600], ['#x10FFFF', 0x10ffff],
  ['#00065', 0x41], ['#x000041', 0x41], ['#0000000065', 0x41], ['#x0000000041', 0x41]
];

for (const [reference, codePoint] of validReferences) {
  test('valid character reference &' + reference + ';', () => {
    const documentNode = parseSafeXml('<r>&' + reference + ';</r>');
    assert.equal(documentNode.root.children[0].value, String.fromCodePoint(codePoint));
  });
}

test('all five predefined entities decode in text', () => {
  const documentNode = parseSafeXml('<r>&amp;&lt;&gt;&quot;&apos;</r>');
  assert.equal(documentNode.root.children[0].value, '&<>"\'');
});

test('all five predefined entities decode in attributes', () => {
  const documentNode = parseSafeXml('<r a="&amp;&lt;&gt;&quot;&apos;"/>');
  assert.equal(documentNode.root.attributes.a, '&<>"\'');
});

test('literal attribute whitespace normalizes but character references do not', () => {
  const documentNode = parseSafeXml('<r a="x\ny\tz&#10;end"/>');
  assert.equal(documentNode.root.attributes.a, 'x y z\nend');
});

const deceptiveDeclarations = [
  ['comment split doctype', '<!DOCT<!-- -->YPE r><r/>'],
  ['comment split doctype after bang', '<!<!-- -->DOCTYPE r><r/>'],
  ['comment split entity', '<!DOCTYPE r [<!ENT<!-- -->ITY x "y">]><r/>'],
  ['mixed case doctype', '<!DoCtYpE r><r/>'],
  ['lowercase doctype', '<!doctype r><r/>'],
  ['uppercase entity', '<!DOCTYPE r [<!ENTITY x "y">]><r/>'],
  ['bom before doctype', '\ufeff<!DOCTYPE r><r/>'],
  ['bom and xml declaration before doctype', '\ufeff<?xml version="1.0"?><!DOCTYPE r><r/>']
];

for (const [name, xml] of deceptiveDeclarations) {
  test('deceptive declaration caught: ' + name, () => {
    assertReportHasCode(auditXml(xml), ERROR.DOCTYPE_FORBIDDEN);
  });
}

test('attlist declaration has its stable code', () => {
  assertReportHasCode(auditXml('<!DOCTYPE r [<!ATTLIST r a CDATA #IMPLIED>]><r/>'), ERROR.ATTLIST_FORBIDDEN);
});

test('element declaration has its stable code', () => {
  assertReportHasCode(auditXml('<!DOCTYPE r [<!ELEMENT r ANY>]><r/>'), ERROR.ELEMENT_DECLARATION_FORBIDDEN);
});

test('notation declaration has its stable code', () => {
  assertReportHasCode(auditXml('<!DOCTYPE r [<!NOTATION n SYSTEM "x">]><r/>'), ERROR.NOTATION_FORBIDDEN);
});

test('assertSafeXml throws first finding with findings attached', () => {
  try {
    assertSafeXml(xxePayloads[0][1]);
    assert.fail('expected assertSafeXml to throw');
  } catch (error) {
    assert.equal(error.code, ERROR.DOCTYPE_FORBIDDEN);
    assert.ok(Array.isArray(error.findings));
    assert.ok(error.findings.some((finding) => finding.code === ERROR.ENTITY_FORBIDDEN));
  }
});
