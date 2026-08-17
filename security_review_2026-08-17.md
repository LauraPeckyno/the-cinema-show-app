# The Cinema Show — Focused Security Review

**Review date:** August 17, 2026  
**Reviewer:** Manus AI  
**Scope:** The Expo/React Native client, Express/tRPC backend, authentication and session flows, WebView-based microphone processing, permissions, network configuration, source-controlled secrets, and production dependency audit results.

> **Assessment boundary.** This was a source, configuration, and dependency review with a limited local HTTP-header check. It was not a penetration test, mobile binary reverse-engineering exercise, cloud-account review, or authenticated attack simulation. Findings describe current risk and hardening priorities; they do not establish that user data has been compromised.

## Executive assessment

The app has several sound foundations: native session tokens use `expo-secure-store`; the source-controlled tree did not contain common hard-coded credential signatures; the client’s music and artwork URLs primarily use HTTPS; and the current backend exposes only a small set of public application procedures. However, the current backend CORS policy, WebView security settings, dependency posture, and session/logging decisions create material risk if the backend becomes more feature-rich or the WebView’s content path changes.

The most urgent remediation is to **replace origin reflection with a strict CORS allowlist**. The second is to **harden the microphone WebView**, which currently permits mixed content, arbitrary origin navigation, local-file access, and broad permission grants. The dependency report should then be triaged and updated, especially the direct `@trpc/server` version and the Expo/CLI transitive tree.

| Priority | Finding | Severity | Why it matters now |
|---|---|---:|---|
| 1 | Credentialed CORS reflects arbitrary origins | High | A malicious website can read credentialed backend responses from a victim’s browser when a sensitive endpoint is present. |
| 2 | Microphone WebView is configured permissively | High | A future navigation or HTML-injection defect would have a broad in-app JavaScript, network, file, and microphone-permission blast radius. |
| 3 | Production dependency audit reports critical/high findings | High | The scanner reports 2 critical, 75 high, 46 moderate, and 6 low advisories across the resolved dependency tree. |
| 4 | Long-lived sessions and permissive deep-link token acceptance | Medium | A stolen or injected token remains useful for up to one year, and a token supplied by a callback URL is persisted without client-side validation. |
| 5 | Sensitive token/PII logging | Medium | Logs include a token prefix and full cached user objects, increasing disclosure risk on shared devices or centralized logs. |
| 6 | Plain HTTP legacy media proxy plus no request throttling | Medium | The legacy proxy is configured to fetch upstream media over HTTP, and public endpoints accept 50 MB request bodies without rate limiting. |
| 7 | `.env` is not fully ignored | Low | No `.env` file is currently present or tracked, but a future root `.env` could be committed accidentally. |

## Prioritized findings

### 1. Reflected credentialed CORS policy

The Express server copies any supplied `Origin` into `Access-Control-Allow-Origin` and simultaneously sends `Access-Control-Allow-Credentials: true` in `server/_core/index.ts` (lines 33–52). A local validation request using `Origin: https://untrusted.example` received `Access-Control-Allow-Origin: https://untrusted.example` and credential support. OWASP identifies reflecting an origin without validation as insecure, particularly when credentials are permitted. [1]

At present, the exposed authenticated routes are limited, which reduces immediate data exposure. Nevertheless, `/api/auth/me` returns user information, and the design becomes significantly riskier when future protected procedures are added. The same permissive policy also makes cross-site logout and other cookie-backed actions easier to trigger.

**Recommended remediation.** Replace reflection with an exact allowlist of production and development origins. Return `Access-Control-Allow-Credentials: true` only for those allowlisted browser origins; do not emit credentialed CORS headers on public media or health endpoints. Add `Vary: Origin`, validate state-changing requests with CSRF protection or origin checks, and test an untrusted origin as a regression case.

### 2. Overly permissive microphone WebView configuration

The native microphone processor constructs a hidden WebView from inline HTML and JavaScript. The current implementation includes a CSP of `default-src * 'unsafe-inline' 'unsafe-eval' data: blob:`, uses `mixedContentMode="always"`, sets `originWhitelist={["*"]}`, enables file access, and grants every requested WebView permission in `components/mic-passthrough.tsx` (lines 1178–1184 and 1391–1415). The WebView reference documents that an origin whitelist controls navigable origins and that request interception can enforce a narrower rule; Android documents that `MIXED_CONTENT_ALWAYS_ALLOW` permits a secure origin to load insecure resources. [2] [3]

The app currently supplies static, source-controlled HTML rather than user-provided remote documents, so no direct exploit path was established during this review. The risk is a **high-impact hardening gap**: any future injected content, unexpected navigation, or compromised URL path could run inside a WebView that has unusually broad capabilities while microphone processing is enabled.

**Recommended remediation.** Keep JavaScript enabled only because Web Audio requires it, but reduce every other permission. Use HTTPS-only media, remove `mixedContentMode="always"`, disable file access unless demonstrated necessary, and block all navigation except the static local/base URL. Replace the wildcard CSP with a minimal policy; avoid `unsafe-eval` if the inline DSP runs without it. Grant only the audio-capture resource requested by the intended microphone flow, reject unrelated permission requests, and validate `postMessage` payload shape and expected message types.

### 3. Dependency audit requires remediation and triage

`pnpm audit --prod --json` completed against the installed resolved tree and reported **2 critical, 75 high, 46 moderate, and 6 low** advisories across 893 dependencies. The critical advisories include `shell-quote` 1.8.3 (patched in 1.8.4) and `tar` 7.5.2 (patched in 7.5.19). The observed paths place them primarily under Expo CLI, React development tooling, and related transitive packages; this makes direct mobile-runtime exploitability less certain, but they remain a supply-chain and build-environment concern. [4] [5]

The direct `@trpc/server` dependency is 11.7.2. The audit reports a high-severity prototype-pollution advisory affecting versions below 11.8.0. The current server uses the Express adapter, not the advisory’s `experimental_nextAppDirCaller` path, so the exact described route was not observed as reachable; upgrading remains appropriate. [6]

**Recommended remediation.** First run the Expo-compatible upgrade workflow rather than forcing incompatible package versions. Update Expo SDK companion packages to their compatible patch releases, update `@trpc/*` to at least 11.8.0 in lockstep, and regenerate the lockfile. Re-run `pnpm audit --prod` in CI. Treat critical CLI/build dependencies as urgent for the development and build environment even if they are not shipped in the mobile binary.

### 4. Long-lived session tokens and unvalidated deep-link token intake

OAuth routes issue HS256 session JWTs with a one-year expiration and set cookies with `SameSite=None` (see `server/_core/oauth.ts`, lines 64–129, and `server/_core/cookies.ts`, lines 47–60). The mobile callback accepts a `sessionToken` URL parameter and stores it directly in SecureStore before server-side validation (`app/oauth/callback.tsx`, lines 152–165). JWT verification checks that an `appId` exists, but does not compare it with the configured application ID (`server/_core/sdk.ts`, lines 181–205).

Session tokens are authentication equivalents; OWASP notes that capture, fixation, or disclosure can enable session hijacking and recommends limiting accepted token-exchange mechanisms and using secure expiry controls. [7] The native storage choice itself is positive, but the lifetime and URL intake increase the consequence of token disclosure or callback manipulation.

**Recommended remediation.** Use a shorter absolute session lifetime with refresh/reauthentication, enforce a configured issuer/audience/application identifier during verification, and remove direct `sessionToken` URL acceptance unless a platform-specific, one-time exchange validates it first. Restrict the Android custom-scheme intent filter to the exact expected callback host rather than `host: "*"`; retain state/PKCE validation in the OAuth exchange.

### 5. Sensitive authentication and user information is logged

`lib/_core/auth.ts` logs the first 20 characters of session tokens on retrieval and storage, and logs full cached user objects (lines 23–28 and 88–100). The OAuth callback and authentication hook also log token state and user information. OWASP recommends excluding session identifiers, access tokens, and sensitive personal data from logs or masking them before collection. [8]

**Recommended remediation.** Remove token values and token prefixes from all production logging. Log only opaque event identifiers and non-sensitive status fields, use a production log-level gate, and redact user fields such as email and open ID unless an audited operational need exists.

### 6. Legacy HTTP media proxy and lack of basic abuse controls

The server-side media proxy uses `http://streamingkeys.imaginaurium.workers.dev` as its upstream (`server/_core/index.ts`, line 64), although the active client music URLs use HTTPS. The local HTTP check did not show a redirect to HTTPS. Separately, the server accepts JSON and URL-encoded request bodies up to 50 MB and has no observed rate limiting. The proxy’s destination is fixed, so this is not a general SSRF finding; the main concerns are transport downgrade and service-resource abuse.

**Recommended remediation.** Delete the unused proxy if the client’s HTTPS Cloudflare URLs are sufficient. Otherwise change the upstream to HTTPS, restrict accepted filenames/extensions with a fixed allowlist, enforce response and timeout limits, and add rate limiting plus tighter request-body limits to public server routes. OWASP recommends maintaining HTTPS for the entire session and avoiding mixed encrypted/unencrypted content. [7]

### 7. Root `.env` file is not ignored

No root `.env` file was present, no tracked environment/key file was found, and the common-signature scan did not locate hard-coded private-key or token patterns. However, `.gitignore` excludes `.env*.local` but not a plain `.env`, while `scripts/load-env.js` loads a root `.env` file. This creates a future accidental-commit risk.

**Recommended remediation.** Add `.env` and `.env.*` to `.gitignore`, keep an `.env.example` with empty placeholders only, and enforce a pre-commit or CI secret scan.

## Positive controls observed

| Area | Observation | Security value |
|---|---|---|
| Native credential storage | Native session tokens use `expo-secure-store`. | Stronger than ordinary app storage for device-resident credentials. |
| Permission scope | The manifest declares audio/notification permissions, with microphone use initiated by the app’s effects flow. | The declared app-level permission set is relatively narrow for the current feature set. |
| Client media delivery | Current album and artwork URLs use HTTPS Cloudflare Worker endpoints. | Reduces network interception risk for the main playback path. |
| Authorization primitives | tRPC defines `protectedProcedure` and `adminProcedure`, although the current router has only limited public auth routes. | A usable foundation exists for future protected APIs. |
| Source-secret check | No root `.env` or tracked common credential signature was identified. | No current evidence of a committed secret from this review method. |

## Recommended remediation order

| Timeframe | Action | Verification criterion |
|---|---|---|
| **Before adding user data or new authenticated APIs** | Implement strict credentialed-CORS allowlists and CSRF/origin enforcement. | An arbitrary Origin no longer receives an allowed credentialed response. |
| **Before the next mobile release** | Harden the microphone WebView and remove HTTP/mixed-content settings. | Navigation, file access, and permissions are restricted to the minimal audio-processing use case. |
| **Next dependency-maintenance cycle** | Upgrade Expo-compatible packages and `@trpc/*`, then regenerate and audit the lockfile. | Production audit has no unresolved critical findings, or each exception has documented non-reachability and a date-bound upgrade plan. |
| **Next authentication change** | Shorten session lifetime, reject direct token URL parameters, and enforce JWT audience/app ID. | A foreign or expired token cannot be persisted or authenticated. |
| **Immediate hygiene** | Remove sensitive console logging and ignore root `.env`. | Production builds emit no token fragments or user PII in client logs. |

## Validation performed

The review examined application configuration, server routes, authentication code, WebView microphone code, dependency manifest/lock resolution, and relevant tests. It verified origin reflection locally using a harmless `GET /api/health` request with `Origin: https://untrusted.example`. It ran `pnpm audit --prod --json` and a tracked-file credential-signature scan. No destructive actions, production authentication attempts, traffic interception, or exploit payloads were used.

## References

[1]: https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/11-Client-side_Testing/07-Testing_Cross_Origin_Resource_Sharing "OWASP Web Security Testing Guide: Testing CORS"
[2]: https://github.com/react-native-webview/react-native-webview/blob/master/docs/Reference.md "React Native WebView API Reference"
[3]: https://developer.android.com/reference/android/webkit/WebSettings "Android WebSettings Reference"
[4]: https://github.com/advisories/GHSA-w7jw-789q-3m8p "GitHub Advisory: shell-quote newline escaping"
[5]: https://github.com/advisories/GHSA-23hp-3jrh-7fpw "GitHub Advisory: node-tar decompression/parse DoS"
[6]: https://github.com/advisories/GHSA-43p4-m455-4f4j "GitHub Advisory: tRPC prototype pollution"
[7]: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html "OWASP Session Management Cheat Sheet"
[8]: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html "OWASP Logging Cheat Sheet"
