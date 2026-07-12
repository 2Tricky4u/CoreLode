# Mobile-friendly co-op pairing — progress

Plan: make phone/tablet pairing effortless — the manual two-way paste dies on mobile
because backgrounding the browser (to reach a messaging app) evicts the page and the
in-memory RTCPeerConnection. Decisions locked: same-room/LAN stays (iceServers: [],
no STUN); full QR loop (in-page camera scan, jsQR fallback dep approved); invite = URL
`#coop=<token>` (native camera app opens it — no typing); reply = QR scanned in-page by
the host; tokens deflate-compressed via CompressionStream; handshake made crash-proof
(waitOpen timeout/close-reject, lobby onClose, New code / Start over, stale-answer
guard). No PROTO bump (tokens are pre-wire only). src/core/sim untouched — both golden
suites stay frozen. Branch `feat/mobile-pairing`; one commit per step; merge --ff-only
per milestone gate.

## M1 — Compressed tokens + transport resilience + pure URL helpers

- [x] [P0] Branch + this progress doc
- [x] [P1] sdpToken.ts: {v:2, z:deflate} token codec, v1 fallback/back-compat, tests
- [x] [P2] RtcChannel: compressed payloads, waitOpen(timeoutMs) + close rejection, hasRemoteAnswer
- [x] [P3] core/net/invite.ts: buildInviteUrl / parseInviteHash / pageBase, tests, core export
- [ ] M1 gate: full suite + build, desktop paste flow re-paired, token length recorded, merged

## M2 — QR generation, camera scanner, lobby UI

- [ ] [P4] Vendor qrcodegen (MIT) + jsQR dep + Node encode→decode round-trip test
- [ ] [P5] drawQrCanvas renderer (+ .coop-qr CSS)
- [ ] [P6] startQrScan camera module (BarcodeDetector fast path, lazy jsQR fallback)
- [ ] [P7] qrScanOverlay + exporter shareText/canShare + scanner strings
- [ ] [P8] coopScreen: seat waiting/connected/lost states, invite QR + Share/Copy/New code, Scan reply, guest answer QR
- [ ] M2 gate: full suite + build, jsqr as lazy chunk, invite QR scans from a phone camera, merged

## M3 — App flow, hash boot, lobby resilience, docs

- [ ] [P9] Strings batch + invite-URL/share/copy wiring in renderCoop
- [ ] [P10] #coop= hash boot → auto-join; clearInviteHash on open/back; reload self-recovery
- [ ] [P11] Lobby resilience: wireSeatChannel onClose, replaceCoopSeat/Remove, stale-answer guard, waitOpen(15s), scan-reply wiring, startCoopSession channel leak fix
- [ ] [P12] Docs (coop.md pairing rewrite, CLAUDE.md) + final gate: full suite + build, merged, pushed

## Notes / decisions

- Invite base derived from `location.origin + location.pathname` (no vite/client types
  in tsconfig, so no import.meta.env) — correct under both `/` and `/CoreLode/`.
- Old build reading a compressed token fails with the clean coopBadToken toast; peers on
  the same build always speak the same dialect (hi handshake still enforces PROTO/SAVE).
- Manual QA at the end (user's phones, one Wi-Fi): QR loop, invite link via messenger,
  mid-join reload recovery, New code, stale answer, camera denied, desktop paste,
  ?coop= dev tabs, 3-player, solo/story/expedition smoke.
