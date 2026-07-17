# Security Policy

## Supported versions

Security fixes are applied on the default branch of this repository. There is no long-term support channel yet.

## Reporting a vulnerability

Please report security issues privately. Do **not** open a public GitHub issue for vulnerabilities that could allow remote code execution, credential theft, or unauthorized access to a local After Effects session.

Prefer one of:

1. **GitHub Security Advisories** — use “Report a vulnerability” on the repository (when available).
2. **Private contact** — open a private channel with the maintainers if advisories are not enabled yet.

Include:

- A clear description of the issue and impact
- Steps to reproduce (or a proof of concept)
- Affected version / commit if known

You should receive an acknowledgement when maintainers can respond. Please allow reasonable time for investigation before any public disclosure.

## Scope notes

This server runs on the operator’s machine and can evaluate ExtendScript against a local After Effects install via `ae_eval_script`. Treat MCP clients and tool callers as trusted for that machine. Misconfiguration or untrusted prompt injection into an agent that has this MCP server enabled can mutate open projects.
