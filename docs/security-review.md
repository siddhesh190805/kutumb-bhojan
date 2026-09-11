# Security Review Notes

This document records production-security findings discovered during the household isolation review.

## Open follow-up: active household continuity after explicit join

The explicit family join flow can run after an anonymous identity already has a bootstrap-created household membership (for example, joining from Settings rather than from an invite URL before initial bootstrap). The current `bootstrap_household` RPC returns the caller's oldest membership. A joined household therefore needs an explicit active-household continuity mechanism; otherwise a later reload can select the original household again.

This must be resolved without trusting a client-selected household for authorization. The client may persist an active household identifier only as a hint; the server/RLS must verify membership before using it.

## Open follow-up: invite entropy

Current invite format uses two `gen_random_bytes(2)` values, giving 32 bits of entropy. This is too small for a production invite credential if an attacker can make repeated join attempts. Increase the effective token entropy substantially while keeping the human-shareable UX practical (for example, a longer base32/base64url-style token or a short code protected by a server-side rate/attempt limit). Never store plaintext invite tokens.
