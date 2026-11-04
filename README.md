# SHIFT LEFT

**Fix tomorrow's bugs yesterday.**

SHIFT LEFT is a browser-based, story-driven DevSecOps control-room puzzle game for GitHub Game Off 2026. Players learn by investigating failures, changing simulated pipeline controls, and validating consequences.

## Audience

Beginners through experienced engineers. Three acts: Apprentice, Engineer, Architect. No coding experience needed for the opening missions; optional expert challenges add realism.

## Game

Play as PATCH, a cheerful robot engineer. Supporting cast: LEGACY (veteran), SHIP (release manager), SENTINEL (security analyst), OPS (reliability engineer), DOC (learning companion). Final antagonist: TECH DEBT, the accumulated consequences of shortcuts.

## Stack (planned)

Phaser 3, TypeScript, Vite, data-driven deterministic scenario engine, Vitest, Playwright, GitHub Actions, HTML5 itch.io distribution.

See [SHIFT_LEFT.md](SHIFT_LEFT.md) for the game design and [AGENTS.md](AGENTS.md) for coding-agent instructions.

## Status

Mission 01 is playable: configure, investigate, validate and deploy in a browser-only sandbox. Missions 02–12 remain planned.

## Learning and workplace use

Designed as an independent, public, informal learning resource, not official Accenture training or a certification. Use fictional systems and synthetic data only; do not add client code, company materials, secrets, or internal workflows. Review employer policies before workplace promotion.

## Play Mission 01 locally

Requires Node.js 24 or newer.

```sh
npm ci
npm run dev
```

Arrange SOURCE, BUILD, TEST, STAGE and PROD using drag-and-drop, the labeled move buttons, or the arrow keys while a card is focused. Select cards to inspect their roles. DOC offers optional guidance. Run the pipeline to validate your order and watch the simulated deployment. Restart safely at any point; completed missions can be replayed.

## Validation

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright covers desktop and mobile mission completion, invalid-order recovery, hints, replay, keyboard focus, reset during deployment, browser errors and overflow, plus desktop drag-and-drop. `dist/` is the production build. The deterministic engine lives in `src/mission.ts`, independently of the Phaser telemetry renderer and DOM controls. All deployment data is fictional; nothing reaches a real environment. Motion respects the reduced-motion preference.

PATCH and DOC use local SVG artwork based on the documented navy, cyan, teal, mint and white character direction. No external image or font services are required.
