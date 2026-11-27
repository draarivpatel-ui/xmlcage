# Good first issues

These starter tasks are intentionally narrow. Each should include regression
tests and documentation when public behavior changes.

## 1. Add line and column coverage for every finding

Some malformed-input findings already carry `position`, `line` and `column`.
Audit the parser paths that do not. Add tests for findings on the second and
third lines, including input using CRLF line endings.

## 2. Add a fuzz corpus harness without a fuzzing dependency

Create a small deterministic mutator that takes seed XML documents, deletes,
duplicates and replaces bytes, and checks that xmlcage never throws a non-
`XmlCageError` exception from `auditXml`. Keep it in `tests/` and make the
iteration count fixed.

## 3. Expand numeric character-reference boundary tests

Add table-driven coverage for leading zeros, maximum legal scalars, the first
illegal scalar beyond each boundary and astral-plane values in both text and
attributes. Confirm the exact code is `XMLCAGE_ILLEGAL_CHAR_REF` where required.

## 4. Improve CLI coverage for file-type rejection

Add temporary-directory tests for a directory path and, on POSIX, a FIFO path.
Assert exit code 2 and a stderr message that does not expose internal stack
traces. Skip FIFO creation cleanly on Windows.

## 5. Add serializer round-trip property tests

Generate small deterministic element trees, serialize them, parse them with
`parseSafeXml` and compare names, attributes and text. Include astral Unicode,
quotes, apostrophes, newlines and carriage returns.

## 6. Document integration recipes for SAML and SOAP middleware

Add a docs page showing how to audit before signature verification or SOAP
body decoding. Make clear that xmlcage does not validate signatures, schemas,
XPath or application semantics.

## 7. Add namespace declaration corner-case tests

Cover rebinding a prefix in a child, restoring it in a sibling, empty default
namespace undeclaration, reserved `xml` and `xmlns` bindings, and unbound
prefixed attributes. Assert both acceptance and exact rejection codes.

## 8. Create a threat-model diagram with plain text or SVG

Produce a small dependency-free diagram that shows untrusted XML entering the
cage, the scanner, strict parser, resource caps and safe AST output. Do not use
external images or fonts.

## 9. Add package self-reference smoke tests

Test `import 'xmlcage'` and `require('xmlcage')` through package self-reference
in addition to direct file imports. Assert all public functions exist and one
representative payload has identical findings in both module systems.

## 10. Review and test maxFindings behavior

Document exactly what happens when hostile input creates more findings than
`maxFindings`. Add tests proving the report remains bounded, deterministic and
frozen, and decide whether a terminal truncation finding would be clearer.
