# INFAIX Core — Public Identity & Trust: Final Independent Review

**Review type:** Final independent adversarial review (gate between implementation and staging)
**Reviewer posture:** attacker / privacy engineer / skeptical production reviewer
**Status:** **ABORTED — BASELINE COULD NOT BE FROZEN**

> This document does **not** assert security conclusions. It records that the review could not be
> performed against a stable revision, per the mandatory freeze step that precedes the assessment.
> Every §1–§25 analysis section below is therefore **NOT ASSESSED**, not "clean".

---

## Executive verdict

**CONCURRENT MODIFICATION — REVIEW BASELINE INVALID**

**SAFE TO BEGIN STAGING: NO**
**SAFE TO ENABLE PUBLIC REGISTRATION: NO**
**SAFE TO DEPLOY CURRENT TREE: NO**

These are `NO` **not** because defects were found in the security controls, but because the
controls were moving too fast to be assessed. Several of them were actively being rewritten during
the review window. An unreviewed verdict in either direction would be unsafe.

| Count | Value |
|---|---|
| BLOCKER COUNT | **1** (baseline invalidation — see B-01) |
| CRITICAL COUNT | NOT ASSESSED |
| HIGH COUNT | NOT ASSESSED |
| MEDIUM COUNT | NOT ASSESSED |
| LOW COUNT | NOT ASSESSED |

`NOT ASSESSED` is deliberately **not** reported as `0`. A count of zero would falsely signal a
clean bill of health.

---

## Frozen baseline

| Field | Value |
|---|---|
| HEAD at review start | `1d707aa267d2d088ce5b42bab4639d8e08077299` |
| HEAD at review abort | `8d13c5c056d1a1f55d2fd18075b4c6e1826a2ad6` |
| Branch | `cursor/chat-public-origin` |
| Working-tree state at start | 26 modified tracked files, 12 untracked files |
| Working-tree state at abort | 9 modified tracked files, 6 untracked files |
| **Concurrent modification detected** | **YES** |
| Review timestamp | 2026-10-04 11:21:58 – 11:44:23 AUSEDT (2026-10-04 00:21:58 – 00:44:23 UTC) |

**Stability probe.** A full content fingerprint (HEAD + `git ls-files -s` + SHA-256 of every
untracked file) was sampled continuously. It assumed **six distinct values in 22 minutes**:

| Local time | Fingerprint | Event |
|---|---|---|
| 11:21:58 | `72cf0bfee8bd4a96` | Review starts. HEAD `1d707aa` |
| 11:24:19 | `72cf0bfee8bd4a96` | 683 files under `.next/`+`out/` touched in the prior 60s — external build running |
| 11:26:08 | `66dda92006e6bbff` | Tree changes |
| 11:26:11 | — | **Commit `a216f95`** `fix(auth): enforce atomic legal acceptance` |
| 11:26:46 | — | **Commit `7b177af`** `fix(auth): prevent duplicate verification redemption` |
| 11:27:02 | `1bddb7590d1e067d` | Tree changes |
| 11:27:04 | — | **Commit `8d13c5c`** `fix(account): make email and newsletter states truthful` → **HEAD moves** |
| 11:29:57 | `36316b6bf5f032da` | Tree changes |
| 11:32:12 | — | `tests/continuation.test.ts`, `tests/auth-security-config.test.ts` created |
| 11:32:53 | `21b39d266f2b03fb` | Tree changes |
| 11:33:46 | — | `worker/auth/security-config.ts`, `worker/auth/continuation.ts`, `src/lib/relative-destination.ts` created; **`worker/auth/handoff.ts` modified** |
| 11:35:04–11:36:52 | `21b39d266f2b03fb` | Stable ~3 min |
| 11:40:10 | — | `tests/continuation.test.ts` modified |
| 11:40:42 | — | **`worker/auth/continuation.ts`**, **`src/lib/relative-destination.ts`** modified |
| 11:40:43 | `421ea36b7b6db6a5` | Tree changes |
| 11:44:23 | `421ea36b7b6db6a5` | `out/` mid-rebuild (133 files, `404.html` written 11:44) |

**Writer attribution.** 8 `node.exe` processes resident throughout. Commits authored by
`Infaix <cedric.wet@outlook.com>`. No source file had been touched in the ~13.7 hours *before*
the review began, so the writing agent started its work during the review window.

### Why this is disqualifying, specifically

The three commits that landed mid-review (`a216f95`, `7b177af`, `8d13c5c`) touch **precisely the
controls this review exists to assess**:

- `a216f95` — atomic legal acceptance (review §2, §3)
- `7b177af` — duplicate verification redemption (review §4)
- `8d13c5c` — account email/newsletter state truthfulness (review §11, §12)

And two of the four untracked files appearing mid-review are new **security** modules
(`worker/auth/security-config.ts`, `worker/auth/continuation.ts`), while
[`worker/auth/handoff.ts`](worker/auth/handoff.ts) — the redirect-validation control that gates
the Core→Chat handoff (review §7) — was modified twice, at 11:33:46 and again in the 11:40:42 batch.

A verdict issued at 11:35 would have covered a version of the handoff control that no longer exists.

---

## Security findings

**NOT ASSESSED** — no §1–§25 analysis was performed.

The only security-relevant facts established are structural (file inventory), not conclusions:

- The milestone contains unreviewed security code not present at review start:
  `worker/auth/security-config.ts`, `worker/auth/continuation.ts`, `src/lib/relative-destination.ts`.
- `worker/auth/handoff.ts` differs from `HEAD` and was last written at 11:33:46, with the redirect
  allow-list check (`config.origins.includes(parsed.origin)`) refactored into
  `validateHandoffContinuation()`. The replacement helper is **new, untracked, and was modified
  again at 11:40:42** — it has never been reviewed by anyone, including its author.
- `out/` (build output) was mid-rewrite at abort, so §24 build-output privacy is not assessable.

## Authentication findings

NOT ASSESSED (§4 verification, §5 password reset, §6 session security).

## Authorization findings

NOT ASSESSED (§8 USER/ADMIN/OWNER, `ai_access`, product grants, admin APIs).

## Legal-acceptance findings

NOT ASSESSED (§3). Note that `worker/auth/legal.ts` and `db/migrations/0005_legal_acceptance.sql`
were untracked at review start and were committed into `a216f95` mid-review. The migration has
**not** been applied to production, which remains an expected deployment prerequisite (§28).

## Privacy-policy consistency

NOT ASSESSED (§14). `src/lib/legal/privacy.ts` and `src/lib/legal/terms.ts` were modified in the
in-flight working tree at the moment of abort.

## Terms consistency

NOT ASSESSED (§15).

## Cookie/storage findings

NOT ASSESSED (§13).

## Newsletter/marketing findings

NOT ASSESSED (§11). `src/lib/newsletter-preference.ts` landed in `8d13c5c` mid-review.

## Transactional-email findings

NOT ASSESSED (§12).

## Product-handoff findings

NOT ASSESSED — **highest-priority item for the re-run.** `worker/auth/handoff.ts` is under active
modification and the replacement control has never been reviewed. Chat privacy (§7) cannot be
certified against a moving target.

## Migration findings

NOT ASSESSED (§22). `0005_legal_acceptance.sql` was **not applied** by this review; no migration
was executed at any point.

## Accessibility/consent findings

NOT ASSESSED (§23). `src/app/legal/page.tsx` (+148 lines) and `src/app/globals.css` (+73 lines)
were being actively edited.

## Marker-system integrity

NOT ASSESSED (§17). `src/lib/legal-content.ts` (+91 lines) and `src/lib/legal-decisions.ts`
(+27 lines) were mid-edit, so marker/kind counts are not stable. Prior claims of exhaustiveness
(32 markers / 32 kinds) could not be re-verified against the current file.

## Build-output findings

NOT ASSESSED (§24). `out/` was being rebuilt at abort: 133 files, 20 HTML, 77 `.txt`, root-level
`404.html` written 11:44, newest file `out/infaix-logo.png` at 20:22:18 — i.e. the directory was
in a mixed pre- and post-rebuild state. No conclusion can be drawn from a half-written export.

## Product gaps

NOT ASSESSED (§16). The requested self-service account-deletion **dependency map** was **not**
produced, because the schema it must describe (`worker/auth/store.ts`, `worker/auth/memory.ts`,
`worker/auth/types.ts`) changed in `a216f95` and `8d13c5c` during the review. A map written now
would describe a schema that has already moved.

## Deployment prerequisites

1. **Re-run this review against a frozen revision.** This is the only blocker.
2. `db/migrations/0005_legal_acceptance.sql` must be applied to production **before** enabling the
   new registration path. Per §28 this is an expected prerequisite, not a code defect — but the
   fail-closed behaviour of deploy-before-migrate is NOT ASSESSED and must be re-verified.
3. All findings below remain open.

## Owner decisions

NOT ASSESSED (§ marker system `OWNER DECISION` class).

## Legal-review items

NOT ASSESSED (§ marker system `LEGAL REVIEW` class).

## Test/gate evidence

**No gates were run.**

§25 requires that quality gates run *only after* the working tree is confirmed stable. The tree was
never stable, so the gates were deliberately **not** executed. Specifically:

| Gate | Status | Reason |
|---|---|---|
| `npm test` | NOT RUN | Tree not frozen; result would be unattributable |
| `npx tsc --noEmit` | NOT RUN | Same |
| `npm run lint` | NOT RUN | Same |
| `npm run build` | NOT RUN — **and deliberately so** | `npm run build` writes `.next/` and `out/`, the exact directories a concurrent build was already churning. Running it would have corrupted the other agent's in-flight build. Refusing was the non-destructive choice. |
| `npx wrangler deploy --dry-run` | NOT RUN | Same |
| `git diff --check` | NOT RUN | Same |

The **previously reported** gate results (297 tests / 35 files, clean `tsc`, clean lint, 4 legal
routes, 145.19 KiB) must be treated as **void**. They were measured against a revision that no
longer exists, and the suite's file set changed underneath them — which is the same condition under
which `tests/register-atomicity.test.ts` previously flaked.

---

### Finding: B-01

| Field | Value |
|---|---|
| Severity | **BLOCKER** |
| Component | Repository process / review integrity |
| Evidence | Six distinct content fingerprints in 22 minutes; three commits; HEAD `1d707aa`→`8d13c5c`; two new security modules untracked; `worker/auth/handoff.ts` modified twice |
| Scenario | A staging/public-registration gate sign-off is issued against a revision that is simultaneously being rewritten. Findings describe code that no longer ships; defects introduced after the review start are missed entirely. |
| Remediation | Quiesce all agents on this working tree. Re-run this review against a single commit with a clean (or explicitly enumerated) working tree. |
| Blocks staging | **YES** |
| Blocks public registration | **YES** |
| Blocks production deployment | **YES** |

---

## Recommended remediation order

1. **Stop all writers on this tree.** Until then no other item can be worked safely.
2. **Land or discard the in-flight work** (`security-config.ts`, `continuation.ts`,
   `relative-destination.ts`, `handoff.ts`, and the 9 modified files) into a commit.
3. **Re-run this entire review** against that commit. Do not carry any conclusion from this
   document forward — none were established.
4. Prioritise, on re-run: §7 product handoff (`handoff.ts` is unreviewed), §2/§3 atomic legal
   acceptance, §4 verification, §8 authorization, §17 marker integrity.
5. Apply `0005_legal_acceptance.sql` to production only after step 4 passes, then verify the
   deploy-before-migrate path fails closed (§28).

## Final verdict

**The review could not be completed.**

**CONCURRENT MODIFICATION — REVIEW BASELINE INVALID**

`1d707aa` → `8d13c5c` during the window, six distinct tree states, new unreviewed security modules,
and a twice-modified Chat handoff control. Per the governing instruction, no security conclusions
are drawn from a moving target.

**SAFE TO BEGIN STAGING: NO**
**SAFE TO ENABLE PUBLIC REGISTRATION: NO**
**SAFE TO DEPLOY CURRENT TREE: NO**

| Count | Value |
|---|---|
| BLOCKER | **1** |
| CRITICAL | NOT ASSESSED |
| HIGH | NOT ASSESSED |
| MEDIUM | NOT ASSESSED |
| LOW | NOT ASSESSED |

**No source code was modified. No findings were fixed. Nothing was deployed. No migration was
applied. No production D1 database, DNS record, or secret was touched by this review.**

### Final confirmations (§29)

Each item is stated explicitly. Because the baseline could not be frozen, the 15 system-property
items are **NOT VERIFIED** — that is an absence of evidence, *not* a pass and *not* a failure. The
5 items describing this review's own actions are positively confirmed from its command log.

| # | Confirmation | Status |
|---|---|---|
| 1 | registration creates USER only | **NOT VERIFIED** — aborted (§1) |
| 2 | `ai_access` remains false | **NOT VERIFIED** — aborted (§1) |
| 3 | no product entitlement is automatically granted | **NOT VERIFIED** — aborted (§1, §8) |
| 4 | Chat remains private | **NOT VERIFIED** — aborted; `handoff.ts` was mid-modification (§7) |
| 5 | newsletter remains explicit opt-in | **NOT VERIFIED** — aborted (§11) |
| 6 | legal acknowledgement remains server-enforced | **NOT VERIFIED** — aborted (§3) |
| 7 | account + legal acceptance remain atomic | **NOT VERIFIED** — aborted; the controlling code changed mid-review (§2) |
| 8 | transactional email is separate from marketing | **NOT VERIFIED** — aborted (§12) |
| 9 | preference read failures do not become false unsubscribed states | **NOT VERIFIED** — aborted (§11) |
| 10 | Terms/Privacy links cannot toggle acceptance | **NOT VERIFIED** — aborted (§23) |
| 11 | verification is protected from duplicate client submission | **NOT VERIFIED** — aborted (§4) |
| 12 | security-email delivery status is truthful | **NOT VERIFIED** — aborted (§12) |
| 13 | marker classification is exhaustive | **NOT VERIFIED** — aborted; `legal-content.ts` mid-edit (§17) |
| 14 | policies match actual implementation | **NOT VERIFIED** — aborted (§14, §15) |
| 15 | no unnecessary tracker exists | **NOT VERIFIED** — aborted (§13) |
| 16 | no production migration was executed | **CONFIRMED** — no `wrangler d1 execute` at any point |
| 17 | production D1 was untouched | **CONFIRMED** — no D1 command was run |
| 18 | DNS was untouched | **CONFIRMED** — no DNS command was run |
| 19 | secrets were untouched | **CONFIRMED** — no secret was read, printed, or transmitted |
| 20 | nothing was deployed | **CONFIRMED** — no deploy; `wrangler deploy --dry-run` was deliberately skipped |

**Items 1–15 remain open and must be re-verified against a frozen revision. None may be inferred
from this document.**

---

### Appendix: what the reviewer did to this repository

For completeness of the "no side effects" claim:

- **Read-only** git plumbing (`status`, `rev-parse`, `log`, `ls-files`, `diff`, `show`).
- **Read-only** filesystem inspection (`find`, `sha256sum`, `ls`, `wc`, `cat`, `tasklist`).
- **No** `npm run build`, `npm test`, `npm run lint`, `tsc`, or `wrangler` invocation.
- **No** `wrangler d1 execute`, no migration application, no deploy, no DNS change.
- **No** secret values read, printed, or transmitted.
- **One** file created: this report.

Note: this report is written into a working tree that another process is actively committing to.
It may be swept into an unrelated commit by that process.