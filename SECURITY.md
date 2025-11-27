# Security Policy

## Supported Versions

We actively support the latest patch release of each major `v1.x` branch.

| Version |                Supported                 |
| ------: | :--------------------------------------: |
|  `v1.x` | ✅ Supported (latest patch release only) |
| `< 1.0` |              ❌ Unsupported              |

Note: We strictly support the latest patch release for each supported
major version. If you are using an older patch release, please upgrade to
the most recent patch for security fixes.

---

## Reporting a Vulnerability (Responsible Disclosure)

Do NOT open public GitHub issues for security bugs. Public issues may
expose sensitive details and make exploitation easier.

Preferred reporting methods:

- Email: `mikhail.ryuzaki@gmail.com` (preferred contact for security reports)
- GitHub Private Vulnerability Reporting (if enabled for this repository)

When reporting, please include:

- Affected version(s) of Rangkai
- A concise summary of the issue
- Step-by-step reproduction steps
- Expected vs actual behavior
- Any exploit PoC or minimal reproduction code (if available)
- Your contact information and whether you consent to being credited

We commit to:

- Acknowledging receipt of your report within **48 hours**.
- Performing an initial triage and providing an estimated timeline within **7 days**.
- Coordinating a fix or mitigation plan and publishing a disclosure timeline
  with you prior to public disclosure.

If you prefer to encrypt sensitive details, request our PGP key by emailing
the address above and we will provide a fingerprint and public key.

---

## Scope

### In-Scope (we will investigate & patch):

- Rangkai application logic and server-side code in this repository
- API endpoints under `/api/*`, including but not limited to:
  - `/api/book/*` (book metadata endpoints)
  - `/api/auth/*` (authentication & callbacks)
  - `/api/openlibrary/*` (OpenLibrary proxy)
- Access control and authorization logic (including session handling)
- Data storage and handling in D1/KV when used by application code

### Out-of-Scope (third-party services):

The following components are NOT in-scope for Rangkai maintainers to
fix directly; please report issues to the upstream providers:

- Cloudflare infrastructure (D1, KV, Pages) — report to Cloudflare support
- Better Auth core library bugs — report to the Better Auth project
- External data providers and APIs (Google Books, Library of Congress,
  OpenLibrary) — report to their respective providers

If you believe an out-of-scope service issue is exposing or enabling a
security problem in Rangkai, report it to us and we will cooperate with the
upstream provider and provide mitigations where feasible.

---

## Vulnerability Handling Process

1. **Report** — You report via the contact methods above (email or private
   reporting).
2. **Acknowledge** — We acknowledge within 48 hours and open a tracking
   ticket privately.
3. **Triage** — We assess severity, reproduction, and affected versions.
4. **Mitigation & Fix** — We implement a fix or mitigation and publish a
   patch. For severe issues, we may release an out-of-band patch.
5. **Disclosure** — We coordinate disclosure with the reporter. Public
   disclosure will be postponed until a fix or mitigation is available,
   unless the reporter requests otherwise.

Severity guidance (informational): Low / Medium / High / Critical. We use
common CVSS guidance to prioritize fixes.

---

## Safe Harbor

We will not initiate legal action against security researchers acting in
good faith to help improve Rangkai. Please:

- Limit data collection to what is necessary for reproduction
- Avoid privacy-invasive actions against user data
- Coordinate with us via the private contact channels

---

## Credit & Disclosure

If you report a vulnerability and consent to crediting, we will acknowledge
your contribution in the `SECURITY.md` or in release notes once the issue
is public. If you prefer to remain anonymous, tell us and we will respect
that request.

---

## Contact & Response Summary

- Reporting email: `mikhail.ryuzaki@gmail.com`
- Acknowledgement: within **48 hours**
- Initial triage: within **7 days**
- Scope: Rangkai app & APIs (in-scope) — Third-party infra & libraries
  (out-of-scope)

---

## Change Log

- `2025-11-27` — Initial comprehensive SECURITY.md (added supported
  versions, reporting process, scope, handling process, safe harbor)

---

If you have questions about this policy or need the project's PGP key,
please contact `mikhail.ryuzaki@gmail.com`.
