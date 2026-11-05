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

## Playtest direction — November 4

The opening delivery-order exercise is an optional ~30-second tutorial. PATCH can assemble the practice pipeline; the primary incident hook is The Leaked Secret, available immediately and directly after the tutorial. The Red Build follows the leak in the recommended route; original mission numbers remain stable in saved progress and the selector.

All incident screens expose a left-to-right intervention map. Players choose where code/configuration fixes enter delivery. Effort increases from 1 at SOURCE to 16 at PROD; these are illustrative game units. Starting at PROD makes the decision to move a fix left visible. Emergency containment, recovery, evidence collection and verification remain free. The map preserves its horizontal direction on mobile through scrolling.

### Audio and music

Music is a core part of the game's identity and jam presentation. Direction: strong original exploration melodies, dark alien isolation, modern electronic detail and restrained broken-beat rhythm. Avoid borrowing existing melodies. The first original generated score candidate is Signal in the Dark, with provenance in public/audio/README.md.

Current implementation uses a crossfaded instrumental loop with state-dependent filtering and intensity, separate music/FX gains, ducking under UI cues, a short PATCH blip, and explicit user activation. Tab hiding suspends playback. No mission depends on hearing audio. Future musical polish can replace the candidate or add compatible composed incident/containment stems after audition; current adaptive behavior remixes one track rather than claiming multiple stems.

### Campaign implementation

All 12 scenarios now have playable evidence, prerequisite-driven system changes, release gates, recovery from bad choices and learning summaries. Browser-only state is deterministic. Later acts currently share the investigation/workbench interface; scene-specific set pieces, richer enemy animation and broader player balancing remain further polish work.

## Revised play direction — side-scrolling delivery grid

The participant's playtest feedback supersedes the original companion-only control-room presentation. PATCH is now a directly controlled animated robot in a connected side-scrolling world. The pipeline is geography: a source foundry to the left, artifact works, proving grounds, rehearsal deck and a leaking live grid to the right. An optional controls tutorial replaces mandatory ordering as the opening experience.

The central loop is move → observe a visible failure → connect to its terminal → contain → trace left → repair → ride the validated release forward. Animated production leakage stops after revocation; machinery, parallax, walking/jumping/thrusters, collectible signals, debt mites, pulse effects and a release traversal make consequences visible. Checkpoints preserve investigation. Optional click-to-travel and touch controls keep the world usable without a keyboard.

DOC now has optional plain-text questions grounded in the synthetic current mission. The ElevenLabs agent is advisory only, has no game tools and uses text sessions without a microphone. Provider-backed answers and the offline reference guide are labeled separately; loss of the live connection never blocks gameplay. Both mission state and success conditions remain in the deterministic engine.

## External playtest feedback carried forward

The participant supplied Claude's review of commit `5156757`. It is evidence about the earlier build, not a replacement specification. The side-scrolling rebuild addresses presentation and flow, but it does not establish that the original blind-click bot would now lose.

| Finding                                                      | Current state                                                                                                                                                     | Remaining work                                                                                                                                                                                               |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The interface reveals the solution                           | Open. Station geography adds traversal, but action ordering, prerequisites, objective text and risky styling still guide the answer.                              | Create plausible competing decisions whose consequences emerge from the simulation; keep detailed guidance optional.                                                                                         |
| Shift-left effort has no stakes                              | Partly addressed. Fix location is physical, and the release summary records effort.                                                                               | A budget, par/replay grade, or another consequential economy is still missing.                                                                                                                               |
| No pressure or meaningful failure                            | Partly addressed. Debt mites, shields and checkpoints add recoverable movement hazards.                                                                           | Secret exploitation/availability consequences, release pressure and carry-over debt are not implemented. The final-sector debt creature is currently a visual state indicator, not a systemic campaign boss. |
| Phaser and companions are mostly unused                      | Addressed for the default game. Phaser now owns the scrolling world, camera, collisions, machinery, animated PATCH, jumps, pulses, pickups and release traversal. | Further art direction and animation polish remain; the retained workbench is a development regression mode.                                                                                                  |
| Missions share one template and hardcoded rules              | Open. Each incident has station-specific evidence/actions, but shares the same world and terminal structure.                                                      | More mission-specific mechanics and a data-driven event/rule model are needed.                                                                                                                               |
| Repeated actions, generic feedback, raw flags and tall pages | Mixed. The default game fits the viewport and does not show raw flags.                                                                                            | Applied actions still need clearer completed states, and feedback needs more specific causal explanations.                                                                                                   |

Next gameplay milestone: make The Leaked Secret require understanding and expose a credible backfire, then prove that with an automated blind-policy test. More missions or richer rendering alone do not meet that milestone. The pending engine/platform decision does not resolve these gameplay issues.

## Native Unreal direction — November 4

The participant selected a downloadable Unreal game for Linux, prioritizing visuals. This supersedes the original browser-only delivery plan. Keep the existing Phaser game as a playable checkpoint; concentrate the native port on one complete Leaked Secret slice before claiming the full campaign is ported. See [the native project and setup guide](unreal/README.md).

PATCH becomes a visible 3D robot in a 2.5D industrial delivery corridor, with DOC as a visible floating book companion. Movement is horizontal along X; the camera sees the corridor from the side. Five terminals are physical locations with repair costs SOURCE 1 → BUILD 2 → TEST 4 → STAGE 8 → PROD 16. Players begin near the leaking production terminal and can contain it immediately for free, then trace the cause left. A PATCH! operation changes the credential route and animates the robot's repair pulse.

The portable native incident model adds a 24-effort budget, exposure pressure, plausible runtime-versus-artifact routing, validation, retry and a replay grade. Standard mode allows 180 seconds of active exposure; containment stops that clock. Help, DOC and station panels suspend incident time while reading. Guided mode removes time-based failure while preserving action consequences. Deleting the source literal does not invalidate an exposed credential. Repeated wrong routes and blind deletion have explicit failing tests. These checks establish model behavior, not playtest balance or a working Unreal build.

Native integration remains uncompiled until Unreal is installed on a capable Linux machine. The existing live DOC text transport has not been ported to native; the native DOC panel is initially a labeled offline guide. Original 3D look-development previews are Blender renders and must be labeled as such. Native music imports the existing original score; hearing it in a packaged game still requires the Unreal build and audio checks.

## Mac development target — November 5

The participant is developing on an Apple silicon Mac. Use Unreal 5.8 and the Mac toolchain; preserve the newer Linux branch's recorded native verification and generated content. `feat/unreal-mac-build` starts from the latest Linux head `af72e1a`, including its compile, playtest, packaging, character and Quit fixes. See [the Mac handoff](unreal/MAC_HANDOFF.md). Mac verification is pending an actual Mac build; the earlier uncompiled status above describes the original scaffold, not the later Linux checkpoint.

An iOS version is under consideration after the Mac slice works. It requires mobile lighting instead of desktop Lumen, touch controls, safe-area layouts, lifecycle handling and signed physical-device testing. [The port assessment](unreal/IOS_PORT.md) records those requirements; it is not an implemented mobile release.

## Native gameplay corrections — November 5

The corridor and controls must agree with the player's screen: SOURCE → BUILD → TEST → STAGING → PRODUCTION, with A/left moving left and D/right moving right. The side camera makes negative world X appear screen-right, so scene placement and movement use that convention together. PATCH begins at production, contains the leak, and traces left toward cheaper structural repairs.

The flat investigation corridor has no jump action. Jumping had no obstacle, reward or incident consequence; adding arbitrary platforming would dilute the investigation. Reintroduce it only with a deliberate traversal mechanic worth testing.

DOC again accepts plain-language typed questions in the native game, using the existing public text-only ElevenLabs agent. The question, recent discussion and synthetic incident state are sent only on submission. DOC remains advisory and cannot apply game actions. A separate offline reference and an explicitly labeled connection-failure fallback keep investigation playable without the service. Chat pauses movement and incident pressure, typing must not trigger gameplay shortcuts, and Escape cancels pending work. Native verification and connection limits are recorded in the Mac handoff.
