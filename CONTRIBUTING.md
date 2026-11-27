# Contributing to xmlcage

Thanks for helping improve a zero-dependency security library.

## Ground rules

- Keep runtime dependencies empty. Keep development dependencies limited to fast-check for property fuzz tests.
- Keep Node 18 compatibility.
- Treat unsafe input as untrusted in every code path.
- Fail closed. When standards behavior is ambiguous, choose the behavior that
  cannot fetch, expand, execute or pollute.
- Do not weaken an existing default to make a payload parse.
- Keep ESM as the single source of truth in `src/index.mjs`.
- Never edit `cjs/index.cjs` directly. Run `node scripts/build-cjs.mjs` after
  changing the source.
- Keep public API behavior and TypeScript definitions in sync.

## Local verification

Run all of these before opening a pull request:

```sh
npm test
node scripts/build-cjs.mjs --check
node scripts/cli-smoke.mjs
npm pack --dry-run
```

The package must pack with no unexpected files. Consumers need no dependency install step because runtime dependencies remain empty.
The test script intentionally uses explicit cross-platform file discovery in
`scripts/run-tests.mjs` rather than shell glob expansion.

## Tests

Every security fix needs a regression test. Add both positive and negative
cases when changing parser behavior:

- A hostile payload must be rejected for the reason intended, not merely as a
  side effect of generic malformed syntax.
- A safe control document must remain accepted.
- If behavior is part of the public API, test it through both ESM and CommonJS.
- If the change affects resource limits, test exactly at the boundary and one
  unit beyond it.

## Code style

Use compact, dependency-free modern JavaScript. Keep parser loops iterative.
Do not add recursive document traversal. Validate resource limits before
allocating attacker-controlled output. Build attribute maps and AST nodes with
null prototypes.

## Documentation

Update `README.md`, `types/index.d.ts` and security documentation in the same
change as public API behavior. Finding codes are stable once published; do not
rename them without a major-version discussion.

## Security reports

Do not open public issues or pull requests with live exploit details. Follow
`SECURITY.md` for vulnerabilities in existing behavior. Tests with historical
or minimized payloads are welcome after a fix is public.
