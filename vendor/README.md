# Vendored third-party assets

Self-hosted to keep the Content-Security-Policy tight (served from `'self'`, no extra external hosts).

## xlsx.full.min.js
- **Library:** SheetJS (xlsx) **0.20.3**
- **Source:** https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js
- **SHA-256:** `cc015130aa8521e7f088f88898eba949ccdcbfb38df0bd129b44b7273c3a6f41`
- **Why pinned here:** 0.20.3 patches CVE-2023-30533 (prototype pollution) and CVE-2024-22363 (ReDoS) present in 0.18.5. SheetJS no longer publishes ≥0.19 to npm/jsdelivr, so it is vendored rather than loaded from a CDN.
