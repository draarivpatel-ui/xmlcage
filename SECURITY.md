# Security Policy

## Supported versions

Only the latest published `1.x` release receives security fixes. Users should
upgrade promptly when a security release is published.

| Version | Supported |
| --- | --- |
| 1.x | Yes |
| Older than 1.0.0 | No |

## Reporting a vulnerability

Report suspected vulnerabilities privately through the GitHub Security
Advisories workflow for `draarivpatel-ui/xmlcage`. Do not open a public issue,
pull request or discussion with a working exploit payload.

Include:

- The exact package version and Node.js version
- Whether input came through `auditXml`, `assertSafeXml`, `parseSafeXml`,
  `parseSafeXmlBytes`, `serializeSafeXml`, the CLI or a guard method
- The complete options object, with secrets removed
- A minimal XML or byte fixture, encoded as base64 or hex when control bytes
  matter
- The expected safe result and the actual result or finding code
- Whether behavior differs between ESM and CommonJS or between operating
  systems

A useful report does not need a large application reproduction. A small script
that imports the package and prints the finding or error code is enough.

## Scope

In scope:

- XXE or external identifier bypasses in accepted input
- Entity expansion or character-reference amplification bypasses
- DTD declaration smuggling through mixed case, comments or encoding tricks
- XInclude, stylesheet or schema-location SSRF bypasses
- Depth, element, text, comment or attribute resource-cap bypasses
- Duplicate attributes missed after namespace resolution
- Prototype pollution through parsed or serialized element and attribute names
- Parser differentials with security impact, including malformed input accepted
  as well formed
- Invalid UTF-8 or encoding-confusion bypasses
- ESM and CommonJS behavior differences with security impact
- XML injection through `escapeXmlText`, `escapeXmlAttr` or `serializeSafeXml`

Out of scope:

- Attacker-controlled memory spent before input reaches the library, such as
  reading a huge file into a string before calling `auditXml`
- Resource use after a caller intentionally raises documented limits far above
  the defaults
- Application-level semantic validation, XPath, XSLT execution, XML Schema
  validation and XML Signature verification, which are deliberate non-goals
- Vulnerabilities in downstream XML parsers after a caller exports data and
  reparses it with a different security policy
- Reports requiring a modified Node.js runtime

## Response expectations

Reports are triaged as time permits. A confirmed vulnerability receives a fix
or mitigation plan before public disclosure whenever practical. Credit is given
in release notes only when the reporter asks for it.

## Hardening guidance

Keep the default feature allowances off. Use the smallest resource limits that
fit real payloads. Treat parsed text as untrusted application data even after
XML-level threats are rejected. Use `assertSafeXml` when silently ignoring an
audit report would be an integration error.
