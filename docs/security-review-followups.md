# Security Review Follow-ups

## Active household continuity

An explicit Settings-based family join can occur after the anonymous identity already has a bootstrap-created household membership. The current bootstrap function returns the caller's oldest membership, so a later reload can select the pre-join household instead of the newly joined family household. The active household needs durable continuity; any client-persisted identifier must be treated only as a hint and verified server-side before use.

## Invite credential strength

The current invite token uses two `gen_random_bytes(2)` segments, providing only 32 bits of entropy. This is insufficient for a production credential without strong attempt throttling. Increase token entropy substantially while retaining a practical sharing UX, and continue storing only a cryptographic hash server-side.
