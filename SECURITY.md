# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 3.0.x | Yes |
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

InterestSeed is a local Obsidian plugin. It:

- does not operate a remote InterestSeed service;
- does not require an account;
- does not store model provider keys;
- does not send note bodies to the Explore AI provider;
- does not automatically mutate the graph or discoveries.

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

- Builds are produced from tagged commits by CI.
- Release artifacts include `main.js`, `manifest.json` and `styles.css`.
- Verify the SHA-256 digest published with the release.
- The deploy script refuses to deploy when the quality gate fails.
