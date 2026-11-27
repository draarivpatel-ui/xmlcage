import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

import {
  XMLCAGE_ERROR_CODES as ERROR,
  auditXml,
  escapeXmlText,
  parseSafeXml,
} from '../src/index.mjs';

const propertyOptions = { seed: 20261127, numRuns: 100 };
const safeCharacterText = fc.stringMatching(/^[A-Za-z0-9 .,_-]{0,48}$/);
const xmlName = fc.stringMatching(/^[a-z][a-z0-9]{0,12}$/);

test('generated benign text round trips through escaping and parsing', () => {
  fc.assert(
    fc.property(safeCharacterText, (text) => {
      const xml = `<root>${escapeXmlText(text)}</root>`;
      const report = auditXml(xml);
      assert.equal(report.safe, true, JSON.stringify(report.findings));
      const documentNode = parseSafeXml(xml);
      assert.equal(documentNode.root.name, 'root');
      if (text.length > 0) {
        assert.equal(documentNode.root.children[0].value, text);
      }
    }),
    propertyOptions,
  );
});

test('generated markup characters are neutralized by text escaping', () => {
  const markupText = fc.stringMatching(/^[A-Za-z0-9 &<>'"]{1,48}$/);
  fc.assert(
    fc.property(markupText, (text) => {
      const escaped = escapeXmlText(text);
      assert.equal(escaped.includes('<'), false);
      assert.equal(escaped.includes('>'), false);
      const report = auditXml(`<root>${escaped}</root>`);
      assert.equal(report.safe, true, JSON.stringify(report.findings));
      const documentNode = parseSafeXml(`<root>${escaped}</root>`);
      assert.equal(documentNode.root.children[0].value, text);
    }),
    propertyOptions,
  );
});

test('generated internal entity declarations are rejected', () => {
  fc.assert(
    fc.property(xmlName, safeCharacterText, (name, payload) => {
      const xml = `<!DOCTYPE r [<!ENTITY ${name} "${payload}">]><r>&${name};</r>`;
      const report = auditXml(xml);
      assert.equal(report.safe, false);
      assert.ok(
        report.findings.some((finding) => finding.code === ERROR.ENTITY_FORBIDDEN),
        JSON.stringify(report.findings),
      );
      assert.throws(() => parseSafeXml(xml));
    }),
    propertyOptions,
  );
});

test('generated external entity identifiers are rejected before fetch behavior', () => {
  fc.assert(
    fc.property(xmlName, hostPathArb(), (name, path) => {
      const xml = `<!DOCTYPE r [<!ENTITY ${name} SYSTEM "https://169.254.169.254/${path}">]><r>&${name};</r>`;
      const report = auditXml(xml);
      assert.equal(report.safe, false);
      assert.ok(
        report.findings.some((finding) => finding.code === ERROR.ENTITY_FORBIDDEN),
        JSON.stringify(report.findings),
      );
    }),
    propertyOptions,
  );
});

function hostPathArb() {
  return fc.stringMatching(/^[a-z0-9][a-z0-9/]{0,24}$/);
}
