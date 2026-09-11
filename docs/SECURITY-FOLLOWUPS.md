# Security Follow-ups

These findings are intentionally tracked before the household isolation PR is considered production-complete.

1. **Active household continuity:** a user can acquire a second household membership through a Settings-based invite after initial anonymous bootstrap. Bootstrap currently chooses the oldest membership, so reload can return the wrong household. The active household must be persisted as a client hint and verified server-side, or the membership model must explicitly support a canonical active household.
2. **Invite entropy:** the current invite token construction uses `gen_random_bytes(2)` twice (32 bits total). Increase credential entropy substantially and/or add robust server-side attempt throttling before treating invite sharing as production-grade.

Do not weaken RLS to solve either issue.
