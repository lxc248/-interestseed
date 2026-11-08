# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 4.0.x standalone | Yes |
| 3.0.x plugin | Yes |
| 2.7.x | Best effort |
| Older | Best effort |

## Reporting a vulnerability

Please do not open a public issue for a security vulnerability.

Report privately to the maintainer through the repository's private security
advisory channel, or contact the maintainer listed in `package.json`.

Include:

- affected version and platform;
- a minimal reproduction;
- impact and expected behavior;
- whether vault data, secrets or local processes are involved.

Do not include real vault contents, API keys, cookies or personal paths. Use
synthetic fixtures.

## Trust boundaries

InterestSeed is local-first. It:

- does not operate a remote InterestSeed service;
- does not require an account;
- does not send note bodies to the Explore AI provider;
- does not automatically mutate the graph or discoveries.

Key storage differs by runtime:

- the Obsidian plugin uses Obsidian SecretStorage;
- the standalone CLI/web stores the key in `<vault>/.interestseed/key`.

The standalone web server binds to `127.0.0.1` only. State-changing routes
require `application/json` and reject cross-origin browser requests. The MCP
server is read-only, but it can expose node summaries and source references to
the MCP client you connect; only connect MCP clients you trust with that data.
Use `--minimal` or `INTERESTSEED_MCP_MINIMAL=1` to expose only the next step
and current experiment instead of the full graph. Missing, directory, malformed
or incomplete graph files are returned as stable MCP tool errors; filesystem
details stay on stderr.

Regression coverage lives in `tests/standaloneServerSecurity.test.ts`: non-JSON
requests return 415, null/cross-origin/cross-site requests return 403, localhost
or CLI-style requests reach the route, static files carry CSP/nosniff/DENY
headers, encoded `..` paths do not escape the web root, missing static files
return 404, and route failures return a generic 500 without internal exception
text.

The optional DSH Agent starts a local child process and uses DSH's own model,
tool, sandbox and permission system. DSH permissions are controlled by DSH,
not by InterestSeed. Review DSH settings and permissions before enabling it.

## Sensitive data

Never commit:

- `.env` files or API keys;
- cookies, session tokens or DSH credentials;
- real vault notes or exports;
- personal filesystem paths;
- unsanitized discovery or graph data.

## Dependency and release hygiene

- Dependabot checks npm and GitHub Actions weekly.
- `minimatch` is pinned through npm overrides to a non-vulnerable release.
- Builds are produced from tagged commits by CI.
- Release artifacts include `main.js`, `manifest.json` and `styles.css`.
- Verify the SHA-256 digest published with the release.
- The deploy script refuses to deploy when the quality gate fails.
