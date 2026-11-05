# SHIFT LEFT

**Fix tomorrow's bugs yesterday.**

SHIFT LEFT is a side-scrolling DevSecOps adventure for GitHub Game Off 2026. Players learn by investigating failures, changing simulated pipeline controls, and validating consequences.

**Current direction: downloadable Unreal Engine game, with Apple silicon Mac as the next target.** Start with the [Mac setup and handoff](unreal/MAC_HANDOFF.md). The latest native source includes a verified Linux slice of The Leaked Secret and its generated assets; the Mac build still requires verification on a Mac. The [native project guide](unreal/README.md) records the Linux results, and [the iOS port assessment](unreal/IOS_PORT.md) tracks mobile work. The existing browser version remains available; the browser instructions below describe that version.

## Audience

Beginners through experienced engineers. Three acts: Apprentice, Engineer, Architect. No coding experience needed for the opening missions; optional expert challenges add realism.

## Game

Play as PATCH, a cheerful robot engineer. Supporting cast: LEGACY (veteran), SHIP (release manager), SENTINEL (security analyst), OPS (reliability engineer), DOC (learning companion). Final antagonist: TECH DEBT, the accumulated consequences of shortcuts.

## Stack

Phaser 3, TypeScript, Vite, data-driven deterministic scenario engine, Vitest, Playwright, GitHub Actions, HTML5 itch.io distribution.

See [SHIFT_LEFT.md](SHIFT_LEFT.md) for the game design and [AGENTS.md](AGENTS.md) for coding-agent instructions.

## Status

The default game is a full-screen side-scrolling delivery grid. Move PATCH through SOURCE → BUILD → TEST → STAGE → PROD, jump between service platforms, recover signal fragments and pulse away debt mites. The opening incident is The Leaked Secret; all eleven incident scenarios use the deterministic campaign engine. The original ordering exercise remains available in the development workbench, while the world opens with a short optional controls tutorial.

## Learning and workplace use

Designed as an independent, public, informal learning resource, not official Accenture training or a certification. Use fictional systems and synthetic data only; do not add client code, company materials, secrets, or internal workflows. Review employer policies before workplace promotion.

## Play locally

Requires Node.js 24 or newer.

```sh
npm ci
npm run dev
```

Click **Enter the grid**. PATCH starts beside the leaking production terminal. Connect, revoke the exposed credential, then trace its cause left through the vault and source foundry. Changes affect the world: the red leak seals, repaired terminals light up, and a passing release carries PATCH back through the pipeline into the next sector.

| Control        | Action                       |
| -------------- | ---------------------------- |
| A / D or ← / → | Move                         |
| Space, W or ↑  | Jump                         |
| Shift          | Boost                        |
| E              | Connect to a nearby terminal |
| F              | Pulse nearby debt mites      |
| R              | Validate the release         |
| Q              | Open DOC                     |
| Escape         | Close the current panel      |

Touch controls support phones and tablets. Clicking a pipeline stage makes PATCH walk there with camera follow; it does not teleport the player. The Sectors menu opens any incident for practice. The 30-second controls guide is optional.

Each terminal shows local evidence and operational actions. Code/configuration fixes can be made at any terminal, but shifting the repair left costs less effort: SOURCE 1 → BUILD 2 → TEST 4 → STAGE 8 → PROD 16. These are illustrative game units. Investigation, verification, containment and recovery stay free. Debt mites affect PATCH's shield, never erase mission evidence, and return PATCH to a nearby checkpoint if needed. Signal fragments are optional exploration rewards.

Completed missions and selected sector are saved on this device. Active experiments reset on reload or sector change. Blocked storage does not prevent play.

**DOC:** click Ask DOC or press Q, then type a question. Live mode uses the public ElevenLabs text-only agent and sends only the question, recent chat context and the synthetic mission snapshot after Send. It has no tools, microphone access or ability to change the game. A labeled local reference guide answers common terms and contextual hints without an AI request. If live chat cannot connect, the panel clearly identifies the local fallback. The game pauses movement input while typing. Public agent configuration is in `public/doc-agent.json`; no provider API key belongs in this client.

**Music:** the original _Signal in the Dark_ score plays if selected at entry, with independent music/FX volume. The loop crossfades, changes mood with the incident, ducks under cues and pauses with the tab. The first take remains ready for musical audition; see [audio provenance](public/audio/README.md).

Live DOC uses the verified public agent’s permitted per-session text-only override. CI tests mock the external service; the live WebSocket could not be verified from the managed development network. Its timeout and explicit local fallback are tested.

The former control-room interface remains at `/?mode=workbench` for engine regression testing. It is not the default play experience.

## Validation

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright covers the live world on desktop/mobile: movement, jumping, camera follow, containment, walking between stations, the complete leak repair, release animation, sector restart, touch controls, and overflow. DOC tests mock the external connection and cover questions, context, cancellation, fallback and typing without moving PATCH. The original workbench still tests every deterministic scenario, audio and persistence. `dist/` is the production build. Deterministic engines live in `src/mission.ts` (tutorial) and `src/campaign.ts` (incidents), with scenario definitions in `src/scenarios.json`, independently of the Phaser world and UI. `src/world-model.ts` maps evidence and operational actions to physical delivery regions; `src/side-scroll.ts` owns movement, collisions and scene transitions. All deployment data is fictional; nothing reaches a real environment. Motion respects the reduced-motion preference.

PATCH and DOC use local SVG artwork based on the documented navy, cyan, teal, mint and white character direction. No external image or font services are required.
