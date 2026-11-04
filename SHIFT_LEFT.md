# SHIFT LEFT — Game Design Document v0.3

## Vision
A hybrid DevSecOps control-room game that teaches secure software delivery through actions and consequences, not quizzes. Theme: SHIFT; interpretation: shift security and quality left.

## Design pillars
1. Observe → Investigate → Act → Validate → Learn.
2. A fix changes a deterministic simulated system; it is not merely a correct-answer button.
3. Accessible visual interactions progressively reveal logs, code, policy, and risk tradeoffs.
4. Reward containment and safe remediation; distinguish prevention, detection, and remediation.
5. Every mission teaches recognition, investigation, remediation, and prevention.

## Main screen
- Center: interactive CODE → BUILD → TEST → STAGE → PROD pipeline map.
- Investigation console: evidence, logs, scan findings, and code snippets.
- Contextual action tray: inspect, scan, patch, configure, rerun, deploy, rollback.
- Mission briefing: objective, discovered evidence, optional learning outcomes.
- Status bar: deployment health, risk, incident state, and technical debt.
- PATCH and optional DOC appear as animated companions in the UI, not as mandatory walk-around avatars.

## Cast
- PATCH: player-facing robot engineer; curious, funny, learns with player. Navy, cyan, teal, mint, white palette inspired by jobContext visual direction.
- LEGACY: experienced engineer with institutional knowledge; not a villain.
- SHIP: speed-focused release manager, creates tension without being malicious.
- SENTINEL: scanner and security analyst; findings require interpretation.
- OPS: reliability engineer concerned with production health and recovery.
- DOC: optional teaching companion; explains terminology and provides contextual hints.
- TECH DEBT: evolving boss composed of shortcuts, skipped checks, outdated dependencies and brittle systems. Grows with poor decisions; shrinks with systemic improvements.

## Campaign
### Act I: Apprentice (beginner)
1. Hello, Pipeline! — order delivery stages; run first deployment.
2. The Red Build — distinguish build failures and failing tests; don't bypass tests.
3. The Leaked Secret — revoke/rotate exposed credential, remove hardcoding, assess history, introduce secrets management.
4. Shift Left! — install preventive controls and rerun the pipeline.
### Act II: Engineer (intermediate)
5. Scan Wars — SAST versus DAST, evidence and false positives.
6. Dependency Hell — SCA, SBOM and transitive dependencies.
7. Permission Denied — IAM and least privilege.
8. The Green Lie — required checks, skipped workflows, enforcement.
### Act III: Architect (advanced)
9. The Compromised Build — artifact provenance and supply-chain compromise.
10. Zero-Day Friday — prioritization by exploitability, exposure, impact.
11. Incident Commander — containment, evidence, recovery.
12. Technical Debt — optimize whole delivery system and defeat the boss.

## First mission: Hello, Pipeline!
**Audience:** newcomers, no coding required.
**Setup:** SHIP wants a release, but the pipeline stages are scrambled and the deployment button is disabled. PATCH asks the player to discover how code reaches users.
**Interactions:** click/drag cards SOURCE, BUILD, TEST, STAGE, PROD into a valid delivery order; inspect short tooltips; run pipeline; watch state transitions; inspect success report.
**Learning:** distinguish source, build, automated tests, preproduction staging, and production. Teach that a green build alone is not proof of security.
**Win condition:** correct pipeline ordering and a successful simulated deployment. **Feedback:** each misplaced stage explains its role; optional DOC hints; no irreversible failure.
**Extension:** optional expert objective: add an early secrets check without blocking valid work.

## Progression
- Beginner: annotated evidence, clear choices, immediate feedback.
- Intermediate: competing findings, code/config inspection, regressions.
- Advanced: incomplete evidence, cascading effects, tradeoffs, optional no-hint mode.

## Scoring
Measure understanding, reliability, risk reduction and root-cause prevention. Don't penalize emergency production containment when warranted. TECH DEBT increases with unresolved shortcuts.

## Technical direction
Browser only; Phaser 3 + TypeScript + Vite. Pure deterministic game-state engine independent from rendering, JSON scenario definitions, localStorage save, Vitest and Playwright tests, itch.io HTML5 export. No badge support.

## Jam scope
December 1, 2026 submission target. Ship polished missions 1–6 first; missions 7–12 are stretch. Start with one complete playable vertical slice before building additional levels.

## Educational sharing guardrails
Use only synthetic examples and publicly available references (OWASP, GitHub docs, etc.). Avoid employer/client branding, internal details, real secrets, or claims of official training approval. Add per-mission learning summaries and optional references. Accessibility: keyboard input, readable text, reduced motion, and no color-only status cues.
