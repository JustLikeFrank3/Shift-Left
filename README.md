# SHIFT LEFT

**Fix tomorrow's bugs yesterday.**

SHIFT LEFT is a browser-based, story-driven DevSecOps control-room puzzle game for GitHub Game Off 2026. Players learn by investigating failures, changing simulated pipeline controls, and validating consequences.

## Audience

Beginners through experienced engineers. Three acts: Apprentice, Engineer, Architect. No coding experience needed for the opening missions; optional expert challenges add realism.

## Game

Play as PATCH, a cheerful robot engineer. Supporting cast: LEGACY (veteran), SHIP (release manager), SENTINEL (security analyst), OPS (reliability engineer), DOC (learning companion). Final antagonist: TECH DEBT, the accumulated consequences of shortcuts.

## Stack

Phaser 3, TypeScript, Vite, data-driven deterministic scenario engine, Vitest, Playwright, GitHub Actions, HTML5 itch.io distribution.

See [SHIFT_LEFT.md](SHIFT_LEFT.md) for the game design and [AGENTS.md](AGENTS.md) for coding-agent instructions.

## Status

All 12 missions have playable deterministic scenarios. The optional 30-second pipeline tutorial leads straight to The Leaked Secret; the incident can also be launched immediately. This is a campaign prototype with a shared investigation/workbench loop, ready for playtesting and further scene-specific polish.

## Learning and workplace use

Designed as an independent, public, informal learning resource, not official Accenture training or a certification. Use fictional systems and synthetic data only; do not add client code, company materials, secrets, or internal workflows. Review employer policies before workplace promotion.

## Play locally

Requires Node.js 24 or newer.

```sh
npm ci
npm run dev
```

Start with **Respond to the leak** for the first incident, or use PATCH's short optional tutorial. The campaign plays tutorial → leaked secret → red build → remaining missions. Every mission is available for practice from the campaign selector.

Investigate the evidence console, then use the engineering workbench to change the simulated system. Prerequisites explain what evidence or configuration is still needed. Validate the release to see which delivery gate holds and why. DOC's guidance is optional. Completed missions have a learning summary and a continuation button.

The pipeline map places each fix spatially. Code/configuration fixes default to production; moving the intervention left before applying it reduces simulated repair effort: SOURCE 1 → BUILD 2 → TEST 4 → STAGE 8 → PROD 16. This is an illustrative game model, not a universal real-world cost formula. Investigation, operational verification, emergency containment and recovery cost nothing. Reapplying unchanged settings also costs nothing. On narrow screens the pipeline scrolls horizontally to preserve left-to-right meaning.

Selected mission and completion history are stored locally. In-progress experiments reset when switching missions or reloading. If browser storage is unavailable, the game remains playable for the session.

**Audio:** enable Sound to hear the original _Signal in the Dark_ score, procedural interface cues and PATCH's nonverbal blip. Music and FX have separate volume sliders. The score loops with a crossfade, changes filtering/intensity with mission state, ducks beneath cues, and pauses with the tab. Audio is off until a user gesture and has no gameplay requirement. See [audio provenance](public/audio/README.md). This first score is an audition candidate in the requested melodic, dark, contemporary direction.

## Validation

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright covers all twelve missions on desktop/mobile, evidence and action flows, negative validation, completion persistence, tutorial skip/assembly, spatial effort, audio decoding and controls, storage failure, browser errors and overflow, plus tutorial keyboard controls and desktop drag-and-drop. `dist/` is the production build. Deterministic engines live in `src/mission.ts` (tutorial) and `src/campaign.ts` (incidents), with scenario definitions in `src/scenarios.json`, independently of the Phaser telemetry renderer and DOM controls. All deployment data is fictional; nothing reaches a real environment. Motion respects the reduced-motion preference.

PATCH and DOC use local SVG artwork based on the documented navy, cyan, teal, mint and white character direction. No external image or font services are required.
