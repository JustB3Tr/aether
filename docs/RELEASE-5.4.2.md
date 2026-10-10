# Aether 5.4.2

Includes the public mode, origin isolation, destination guards, signed profiles and Veck Rammerhead preference from [5.4.1](RELEASE-5.4.1.md).

Fixes Wisp 0.5.0's per-host limiter iterating a stream object as an array. With that limit enabled, permitted public TCP streams failed to initialize, stalling Ultraviolet and Scramjet. The version-checked install patch keeps the limits enabled and iterates Object.values instead. A regression check exercises both a permitted stream and an excess stream.

68 JavaScript checks and 30 host updater checks pass. Live Linux image checks cover health, signed profile cookies, saves/recovery, cross-profile and cross-site rejection, origin separation, Rammerhead public destinations and private/port/chaining rejection, and Wisp private stream rejection. Browser checks rendered public destinations through Ultraviolet and Scramjet Libcurl; Epoxy and production deployment evidence follows below.

The Docker save archive was compressed and loaded back successfully: 85,587,196 bytes, SHA-256 `01555ef55fb504660e4a3a608a91f8a9a62200c94f5af09558f34bd3f71a2608`, Linux AMD64 image config `sha256:6bfddc7d70de5236eaed7f07beee6375c3c3a77018885670d2b02595a592d825`.

Veck remains a remote compatibility limitation, not a guaranteed working game.
