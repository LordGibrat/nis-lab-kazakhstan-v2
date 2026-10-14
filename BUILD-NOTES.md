# NIS Lab developer workspace build

Base repository: https://github.com/LordGibrat/nis-lab-kazakhstan
Base commit: dcadb520411792fcb212f62f637f01f8cf92fdcc
Prepared: 2026-10-14

This is a local, reviewable enhancement. No remote GitHub branch, commit, pull request, deployment, or account was created.

## Included

- Developer workspace: search, subject/topic/status filters, editable custom question bank, built-in copy workflow, source attribution, validation, atomic duplicate-safe question imports, local exports and topic targets.
- Official/reference resource catalogue with rights guidance.
- 15 draft mathematics concepts with Russian, Kazakh and English text (45 language variants), precise CC BY 4.0 attribution.
- Existing student practice integrates reviewed custom questions and language display. Canonical question IDs/topics preserve non-duplicated learning history.
- New defensive handling of missing custom question references and storage write failures.

## Verified

10 Node schema/unit tests passed. Translation checks passed for all 15 concepts and 180 numeric option positions, prompt/explanation numeric alignment and correct answers. JavaScript syntax checks and `git diff --check` passed. Independent mocked-DOM integration checked import/edit flows, escaping, quota/storage handling, draft eligibility, missing saved questions, language display and canonical topic results.

## Not verified

Real Chromium launch was blocked by the build environment's Unix-socket restriction; the subsequent escalation attempt aborted without executing the browser test. No real browser/visual pass or screenshot is claimed. The included browser integration script is ready to run in an environment with Chromium and Playwright.

## Intentional limits

Browser-local only, no secure server admin/authentication, shared online database or cross-device synchronization. Original UI remains Russian. Existing bank does not gain translations automatically. Starter questions are supplementary math practice, not official NIS questions or complete subject coverage. Backups are additive and do not overwrite duplicate IDs. Profiles/history need their separate existing export. No delete feature. See README for usage, license and safe recovery details.
