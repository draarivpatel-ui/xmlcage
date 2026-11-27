import test from 'node:test';
import assert from 'node:assert/strict';
import { auditXml, parseSafeXml, XMLCAGE_ERROR_CODES as ERROR } from '../src/index.mjs';
import { assertReportHasCode, codes, nestedXml } from './helpers.mjs';

function safe(xml, options) {
  const report = auditXml(xml, options);
  assert.equal(report.safe, true, codes(report).join(','));
  return report;
}

function xmlWithElements(count) {
  return nestedXml(count);
}

for (const [text, byteLength] of [['<r/>', 4], ['<r>π</r>', 9], ['<r>😀</r>', 11]]) {
  test('maxBytes exact boundary accepts ' + byteLength + ' bytes', () => {
    const report = safe(text, { maxBytes: byteLength });
    assert.equal(report.stats.bytes, byteLength);
  });
  test('maxBytes rejects one byte below ' + byteLength + ' bytes', () => {
    assertReportHasCode(auditXml(text, { maxBytes: byteLength - 1 }), ERROR.MAX_BYTES);
  });
}

for (const depth of [1, 2, 3, 8, 16, 32]) {
  test('maxDepth exact boundary accepts depth ' + depth, () => {
    const report = safe(xmlWithElements(depth), { maxDepth: depth, maxElements: depth });
    assert.equal(report.stats.maxDepthObserved, depth);
  });
  if (depth > 1) {
    test('maxDepth rejects depth ' + depth + ' when cap is one lower', () => {
      assertReportHasCode(auditXml(xmlWithElements(depth), { maxDepth: depth - 1 }), ERROR.MAX_DEPTH);
    });
  }
}

for (const count of [1, 2, 5, 10, 32, 100]) {
  test('maxElements exact boundary accepts ' + count, () => {
    const report = safe(xmlWithElements(count), { maxDepth: count, maxElements: count });
    assert.equal(report.stats.elements, count);
  });
  if (count > 1) {
    test('maxElements rejects ' + count + ' when cap is one lower', () => {
      assertReportHasCode(auditXml(xmlWithElements(count), { maxDepth: count, maxElements: count - 1 }), ERROR.MAX_ELEMENTS);
    });
  }
}

for (const count of [0, 1, 2, 8, 64]) {
  const attributes = Array.from({ length: count }, (_, index) => 'a' + index + '="x"').join(' ');
  const xml = '<r' + (count > 0 ? ' ' + attributes : '') + '/>';
  test('maxAttributesPerElement exact boundary accepts ' + count, () => {
    safe(xml, { maxAttributesPerElement: count, maxTotalAttributes: count });
  });
  if (count > 0) {
    test('maxAttributesPerElement rejects one beyond ' + count, () => {
      const tooMany = attributes + ' extra="x"';
      assertReportHasCode(auditXml('<r ' + tooMany + '/>', { maxAttributesPerElement: count }), ERROR.MAX_ATTRIBUTES);
    });
  }
}

test('maxTotalAttributes is enforced across siblings', () => {
  const xml = '<r><a x="1" y="2"/><b z="3"/></r>';
  safe(xml, { maxTotalAttributes: 3 });
  assertReportHasCode(auditXml(xml, { maxTotalAttributes: 2 }), ERROR.MAX_ATTRIBUTES);
});

for (const length of [1, 2, 16, 256, 1024]) {
  const xml = '<r>' + 'x'.repeat(length) + '</r>';
  test('maxTextLength exact boundary accepts ' + length, () => {
    safe(xml, { maxTextLength: length });
  });
  test('maxTextLength rejects one beyond ' + length, () => {
    assertReportHasCode(auditXml('<r>' + 'x'.repeat(length + 1) + '</r>', { maxTextLength: length }), ERROR.MAX_TEXT_LENGTH);
  });
}

for (const length of [1, 2, 16, 256, 1024]) {
  test('maxAttributeValueLength exact boundary accepts ' + length, () => {
    safe('<r a="' + 'x'.repeat(length) + '"/>', { maxAttributeValueLength: length });
  });
  test('maxAttributeValueLength rejects one beyond ' + length, () => {
    assertReportHasCode(auditXml('<r a="' + 'x'.repeat(length + 1) + '"/>', { maxAttributeValueLength: length }), ERROR.MAX_ATTRIBUTE_VALUE_LENGTH);
  });
}

for (const length of [1, 2, 16, 128, 256]) {
  const name = 'a'.repeat(length);
  test('maxNameLength exact boundary accepts ' + length, () => {
    safe('<' + name + '/>', { maxNameLength: length });
  });
  test('maxNameLength rejects one beyond ' + length, () => {
    assertReportHasCode(auditXml('<' + name + 'x/>', { maxNameLength: length }), ERROR.MAX_NAME_LENGTH);
  });
}

for (const count of [0, 1, 2, 10]) {
  const comments = count === 0 ? '' : '<!--x-->'.repeat(count);
  test('maxComments exact boundary accepts ' + count, () => {
    safe('<r>' + comments + '</r>', { maxComments: count });
  });
  test('maxComments rejects one beyond ' + count, () => {
    assertReportHasCode(auditXml('<r>' + '<!--x-->'.repeat(count + 1) + '</r>', { maxComments: count }), ERROR.MAX_COMMENTS);
  });
}

for (const count of [0, 1, 2, 10]) {
  const references = count === 0 ? '' : '&#65;'.repeat(count);
  test('maxEntityReferences exact boundary accepts ' + count, () => {
    safe('<r>' + references + '</r>', { maxEntityReferences: count });
  });
  test('maxEntityReferences rejects one beyond ' + count, () => {
    assertReportHasCode(auditXml('<r>' + '&#65;'.repeat(count + 1) + '</r>', { maxEntityReferences: count }), ERROR.MAX_ENTITY_REFERENCES);
  });
}

for (const count of [1, 2, 10, 100]) {
  test('maxExpandedTextBytes exact boundary accepts ' + count + ' ascii references', () => {
    safe('<r>' + '&#65;'.repeat(count) + '</r>', { maxExpandedTextBytes: count });
  });
  test('maxExpandedTextBytes rejects one beyond ' + count, () => {
    assertReportHasCode(auditXml('<r>' + '&#65;'.repeat(count + 1) + '</r>', { maxExpandedTextBytes: count }), ERROR.MAX_EXPANDED_TEXT_BYTES);
  });
}

for (const count of [0, 1, 2, 5]) {
  const pi = count === 0 ? '' : '<?pi x?>'.repeat(count);
  test('maxProcessingInstructions exact boundary accepts ' + count, () => {
    safe('<r>' + pi + '</r>', { allowProcessingInstructions: true, maxProcessingInstructions: count });
  });
  test('maxProcessingInstructions rejects one beyond ' + count, () => {
    assertReportHasCode(
      auditXml('<r>' + '<?pi x?>'.repeat(count + 1) + '</r>', { allowProcessingInstructions: true, maxProcessingInstructions: count }),
      ERROR.MAX_PROCESSING_INSTRUCTIONS
    );
  });
}

test('entity references in attributes count toward both reference caps', () => {
  const xml = '<r a="&#65;&#65;"/>';
  safe(xml, { maxEntityReferences: 2, maxExpandedTextBytes: 2 });
  assertReportHasCode(auditXml(xml, { maxEntityReferences: 1 }), ERROR.MAX_ENTITY_REFERENCES);
  assertReportHasCode(auditXml(xml, { maxExpandedTextBytes: 1 }), ERROR.MAX_EXPANDED_TEXT_BYTES);
});

test('cdata length uses the text cap', () => {
  const xml = '<r><![CDATA[xxxx]]></r>';
  safe(xml, { maxTextLength: 4 });
  assertReportHasCode(auditXml(xml, { maxTextLength: 3 }), ERROR.MAX_TEXT_LENGTH);
});

test('separate text nodes each have separate length limits', () => {
  const xml = '<r>xxxx<a/>yyyy</r>';
  safe(xml, { maxTextLength: 4 });
  assertReportHasCode(auditXml('<r>xxxxx<a/>yyyy</r>', { maxTextLength: 4 }), ERROR.MAX_TEXT_LENGTH);
});

const invalidOptions = [
  ['unknown key', { notAnOption: true }],
  ['array options', []],
  ['number options', 4],
  ['maxBytes zero', { maxBytes: 0 }],
  ['maxBytes fractional', { maxBytes: 1.5 }],
  ['maxDepth boolean', { maxDepth: true }],
  ['maxElements negative', { maxElements: -1 }],
  ['maxAttributesPerElement negative', { maxAttributesPerElement: -1 }],
  ['maxTotalAttributes fractional', { maxTotalAttributes: 1.2 }],
  ['maxTextLength negative', { maxTextLength: -1 }],
  ['maxAttributeValueLength negative', { maxAttributeValueLength: -1 }],
  ['maxNameLength zero', { maxNameLength: 0 }],
  ['maxComments negative', { maxComments: -1 }],
  ['allowDoctype nonboolean', { allowDoctype: 1 }],
  ['allowXInclude nonboolean', { allowXInclude: 'yes' }],
  ['allowProcessingInstructions nonboolean', { allowProcessingInstructions: null }],
  ['allowXmlStylesheet nonboolean', { allowXmlStylesheet: 0 }],
  ['allowExternalSchemaLocations nonboolean', { allowExternalSchemaLocations: 'false' }]
];

for (const [name, options] of invalidOptions) {
  test('invalid options rejected: ' + name, () => {
    assert.throws(() => auditXml('<r/>', options), (error) => {
      assert.equal(error.code, ERROR.INVALID_OPTIONS);
      return true;
    });
  });
}

test('maxBytes check happens before parsing malformed oversized input', () => {
  const xml = '<r>' + 'x'.repeat(2000);
  assertReportHasCode(auditXml(xml, { maxBytes: 100 }), ERROR.MAX_BYTES);
});

test('audit invalid input type is a finding rather than a crash', () => {
  const report = auditXml(42);
  assert.equal(report.safe, false);
  assert.equal(report.findings[0].code, ERROR.INVALID_INPUT);
});

test('parse invalid input type throws invalid input', () => {
  assert.throws(() => parseSafeXml(42), (error) => {
    assert.equal(error.code, ERROR.INVALID_INPUT);
    return true;
  });
});

test('zero length text cap still permits an empty element', () => {
  safe('<r/>', { maxTextLength: 0 });
});

test('zero length text cap rejects one character', () => {
  assertReportHasCode(auditXml('<r>x</r>', { maxTextLength: 0 }), ERROR.MAX_TEXT_LENGTH);
});

test('zero attribute cap permits no attributes and rejects one', () => {
  safe('<r/>', { maxAttributesPerElement: 0, maxTotalAttributes: 0 });
  assertReportHasCode(auditXml('<r a="x"/>', { maxAttributesPerElement: 0 }), ERROR.MAX_ATTRIBUTES);
});

test('limits do not mutate caller options', () => {
  const options = Object.freeze({ maxDepth: 2, maxElements: 2 });
  safe(nestedXml(2), options);
  assert.deepEqual(options, { maxDepth: 2, maxElements: 2 });
});

test('entity reference name exactly at name cap reaches entity policy', () => {
  const name = 'x'.repeat(8);
  assertReportHasCode(auditXml('<r>&' + name + ';</r>', { maxNameLength: 8 }), ERROR.UNKNOWN_ENTITY);
});

test('entity reference name beyond name cap is length limited', () => {
  const name = 'x'.repeat(9);
  assertReportHasCode(auditXml('<r>&' + name + ';</r>', { maxNameLength: 8 }), ERROR.MAX_NAME_LENGTH);
});
