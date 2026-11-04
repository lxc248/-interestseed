# Standalone 4.0.2 — security patch verification

Date: 2026-11-02

## Package

```text
release/interestseed-standalone-v4.0.2.zip
size: 78791
sha256: 4606b74ae69939b7be6544fe4a8e5d4cc99664209623b41a52180f5874acc8c5
```

## Tests

```text
74 test files
531 tests passing
npm run verify 通过
```

## HTTP guard

```text
POST /api/config/test application/json -> 200
POST /api/config/test text/plain        -> 415
POST with Origin https://evil.example  -> 403
POST with Origin http://127.0.0.1      -> 200
```

## Headers

```text
Content-Security-Policy
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
```

## Audits

```text
review/security-audit-4.0.1.md
review/geo-audit-2026-11-02.md
```
