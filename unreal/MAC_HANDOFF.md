# SHIFT LEFT — Apple silicon Mac handoff

Current branch: `feat/unreal-mac-build`. Base: `origin/feat/unreal-linux-slice` at `af72e1a` (`feat(unreal): add Quit to the field guide`). No merge to `main` is required.

The base includes recorded Linux UE 5.8.0 compile, bootstrap, in-engine and packaged playtest results, plus the generated `.uasset` files and `DeliveryGrid.umap`. Reuse those assets; compile native Mac binaries and cook Metal shaders locally. Mac verification from the actual machine is recorded below; the earlier cloud workspace did not verify Mac execution.

## Install Unreal and Xcode

1. Download the **Epic Games Launcher for macOS** from [Epic's official Unreal download page](https://www.unrealengine.com/download). Sign in, open Unreal Engine → Library, add an engine version and select **5.8**. Install its Mac components. The usual installation directory is `/Users/Shared/Epic Games/UE_5.8`; adjust the commands if you choose another location. Use the Mac engine installation, not the Linux archive.
2. Install full Xcode and launch it once to finish setup. Epic's current [UE 5.8 Mac requirements](https://dev.epicgames.com/documentation/unreal-engine/macos-development-requirements-for-unreal-engine) list **Xcode 26.0 minimum, 26.1.1 recommended**, and explicitly mark **26.4 incompatible**. Check that page and the installed engine's `Engine/Config/Apple/Apple_SDK.json` before choosing a different release. Obtain a specific Xcode version from [Apple Developer downloads](https://developer.apple.com/download/all/) if the App Store offers an incompatible release.
3. In Xcode → Settings → Locations, select this full Xcode installation for Command Line Tools. Command Line Tools alone are insufficient. Install the Metal Toolchain component if Xcode requests it. Apple documents [additional Xcode components](https://developer.apple.com/documentation/xcode/downloading-and-installing-additional-xcode-components).
4. Ensure Python 3 and Git are available. Epic lists 16 GB minimum RAM and recommends 32 GB or more. Leave substantial free disk space for the engine, shaders and cooked builds. The Mac renderer profile uses conventional shadow maps to cover M1 hardware while retaining software Lumen; higher-end settings can be profiled later.

If the launcher reports `SU-DS01` against `/Volumes/Epic Games Launcher`, it is running from the mounted installer image. Quit it, drag `Epic Games Launcher.app` into Applications, eject the installer image, and launch `/Applications/Epic Games Launcher.app`. Recheck actual Mac free space only if the installed copy still reports a storage error. Epic documents the [Applications installation location](https://www.epicgames.com/help/en-US/c-Category_EpicGamesStore/c-EpicGamesStore_LauncherSupport/how-do-i-change-the-installation-directory-of-the-epic-games-launcher-a000084679?lang=en-US).

Check the selected developer tools in Terminal:

```bash
xcode-select -p
xcodebuild -version
xcrun --find metal
```

If the developer directory points to `/Library/Developer/CommandLineTools`, select the full Xcode app in Xcode's settings. If `metal` is missing, finish installing the matching Metal Toolchain component before starting Unreal.

## Get and build the Mac branch

For a fresh checkout:

```bash
git clone --branch feat/unreal-mac-build https://github.com/JustLikeFrank3/Shift-Left.git
cd Shift-Left/unreal
```

For an existing checkout, save local changes, fetch origin, then switch to `feat/unreal-mac-build` (or use `git switch --track origin/feat/unreal-mac-build` if it does not exist locally). Do not overwrite local work or merge earlier PRs just to run this version.

Close Unreal, then run from `Shift-Left/unreal`:

```bash
./scripts/check-mac.sh "/Users/Shared/Epic Games/UE_5.8"
./scripts/test-core.sh
python3 ./scripts/verify-source.py
set -o pipefail
./scripts/build-mac.sh "/Users/Shared/Epic Games/UE_5.8" 2>&1 | tee build-mac.log
```

Continue only after the build succeeds. The Mac script preserves the committed map and art by default. An explicit `--refresh-assets` reruns the editor bootstrap when source FBX/WAV files change, backing up generated content first. Keep custom levels separately and close the editor before invoking an external rebuild. The scripts preserve authored Config files because editor/cook processes can rewrite them.

Open the project:

```bash
open -a "/Users/Shared/Epic Games/UE_5.8/Engine/Binaries/Mac/UnrealEditor.app" "$PWD/ShiftLeft/ShiftLeft.uproject"
```

Let Metal shaders finish compiling. Open `/Game/Maps/DeliveryGrid`, then press **Play**. A missing-module prompt before the native module has compiled is expected; resolve the first real compiler error rather than assuming Linux binaries can be reused.

## Verify the Mac slice

Run the existing scripted scenarios on Mac after compilation (the editor must be closed first):

```bash
./scripts/playtest-mac.sh "/Users/Shared/Epic Games/UE_5.8"
# Or run the same checks against the executable inside the packaged app:
SL_GAME="/absolute/path/ShiftLeft.app/Contents/MacOS/ShiftLeft" ./scripts/playtest-mac.sh -
```

This runner uses Python's timeout support rather than GNU `timeout`, preserves authored Config files, and writes logs under `playtest/Mac/`. It requires both a successful process exit and the scenario's zero-failure PASS marker. The scenarios use Slate input injection and in-engine screenshots; they do not verify OS keyboard/mouse input or audible sound quality. Allow the first launch to compile Metal shaders.

Check PATCH's facing, readable size and articulated walking; DOC's floating book model; floor collision; camera; keyboard and trackpad/mouse choices; terminal feedback; and actual audible music with M toggling it. H opens/closes the guide in Play-in-Editor, where Escape may stop play. The guide includes Quit.

For the current investigation design, E reads the production access trail and F compares issuer/application operations. Code decisions belong to SOURCE, packaging to BUILD, enforcement to TEST, and rehearsals to STAGING (or R). Test both deliberate repair and blindly applying every approach. Also test a wrong artifact route, recovery, the budget, retry, guided mode and paused panel reading. The existing Linux handoff records the full scripted scenarios; they still need to pass on Mac. Automated tests do not establish mouse usability or sound quality.

Only The Leaked Secret is native. Q opens native DOC text chat; Send uses live ElevenLabs, while Offline guide uses authored local answers. Keep the original score; the browser's adaptive audio mixer has not been ported. Blender previews are not Mac gameplay evidence.

## Package for macOS

After native play succeeds:

```bash
set -o pipefail
./scripts/package-mac.sh "/Users/Shared/Epic Games/UE_5.8" 2>&1 | tee package-mac.log
```

The archive goes under `unreal/build/Mac/`. Locate the generated `.app`, launch it, and repeat the full incident. First produce a working native Apple silicon build. Verify output architectures separately before claiming a universal Intel/Apple silicon release. Distribution to other Macs also needs a deliberate signing/notarization plan; a local Development package is not automatically a public release.

For failures, preserve `build-mac.log`, `package-mac.log`, and `ShiftLeft/Saved/Logs/ShiftLeft.log`. Report the first real error, `xcodebuild -version`, `sw_vers`, chip/RAM and the engine's exact 5.8 patch version. Rendering issues require a screenshot from the actual Mac and its engine log.

## Local Codex prompt

> Continue SHIFT LEFT on feat/unreal-mac-build, based on the latest Linux Unreal branch af72e1a. Read AGENTS.md, unreal/MAC_HANDOFF.md and the recorded Linux results. This is an Apple silicon Mac; locate Unreal 5.8, normally /Users/Shared/Epic Games/UE_5.8, and verify compatible full Xcode/Metal tools. Preserve local changes and committed content. Run portable checks, compile the Mac Editor module, verify DeliveryGrid in Play, then cook/package and launch the Mac app. Fix real compiler, Metal, input, camera, character, audio and packaging issues. Preserve the Linux and browser checkpoints. iOS is follow-up work described in IOS_PORT.md. Record exactly what ran and what remains unverified. Commit and push this branch; do not merge.

## Actual Mac verification — November 5, 2026

Machine: Apple M3 Max, 36 GB RAM, arm64, macOS 26.7.1 (25G241). Engine: UE 5.8.4 (58902052), installed under `~/Library/Application Support/Epic/UE_5.8`. Selected developer tools: `/Applications/Xcode.app/Contents/Developer`, Xcode 27.2 (27B52), macOS SDK 27.2, Apple clang 21.0.0. The installed engine's `Apple_SDK.json` accepts Xcode through 27.9.0, and UnrealBuildTool accepted this toolchain without overrides.

- `test-core.sh`: 68 checks passed; `verify-source.py`: passed.
- Closed the editor before compilation. The unresponsive project-selection window required force termination after Quit and SIGTERM failed; the launcher reopened it once, so the first build attempt was interrupted and editor shutdown reconfirmed before restarting.
- `build-mac.sh`: succeeded, including reflection generation, all project C++ files and the native editor dylib. No gameplay C++ fixes were required. Committed map, meshes and music were reused without reimport.
- Mac editor binary with `/Game/Maps/DeliveryGrid -game` and Metal: `complete`, `wrong`, `budget`, `guided`, `pause`, `quit` all reported zero-failure PASS and exited 0. The full incident earned S with effort 3/24 and no routing mistakes. These cover movement, jumping/floor collision, containment, source repair, runtime binding, validation, wrong-route recovery, budget/retry, deadlines, paused reading, music state toggling and quitting.
- In-engine 1600×900 captures under `ShiftLeft/Saved/Autoplay/` were inspected, including production and the validated release screen. PATCH, DOC, terminal and HUD rendered. This is actual Mac Metal rendering, not a Blender preview or NullRHI run.
- Editor logs are preserved under `playtest/Mac/editor/`; build output is `build-mac.log`. The new `playtest-mac.sh` keeps packaged logs separately under `playtest/Mac/packaged/`.
- Found and fixed a real archive defect: the original `package-mac.sh` omitted `-package`. AutomationTool exited successfully but archived the 412 MB bare `Binaries/Mac/ShiftLeft.app` without `Contents/UE` or cooked data. Added Apple package finalization before archive, checks for nonempty `.pak`/`.utoc`/`.ucas` files in the archived app, and strict bundle signature verification. The initial output log is retained locally as `package-mac-before-fix.log`.

- Corrected `package-mac.sh`: exit 0; build, cook, stage, **package**, archive and strict signature verification succeeded. `build/Mac/ShiftLeft.app` is approximately 885 MB, contains cooked game data under `Contents/UE`, and `lipo -archs` reports **arm64 only**. Signature is ad hoc, with no development team; this is a local Development app, not a notarized public release or universal build.
- Archived executable: `complete`, `wrong`, `budget`, `guided`, `pause`, `quit` each eventually reported zero-failure PASS and exited 0. **The first suite was not clean:** guided and pause exited -11 before emitting logs. Both passed isolated retries without code changes. The macOS diagnostic report `~/Library/Logs/DiagnosticReports/ShiftLeft-2026-11-05-120742.ips` identifies `FLLMTracker::PopTag` / `FMallocBinned3` during AppKit/LaunchServices startup. This intermittent engine-startup reliability issue remains unresolved; successful retries do not establish it is fixed.
- Packaged captures under `~/Library/Containers/com.YourCompany.ShiftLeft/Data/Library/Application Support/Epic/ShiftLeft/Saved/Autoplay/` show the actual Metal scene and complete release. Logs are under `playtest/Mac/packaged/`; packaging output is `package-mac.log`. Packaged engine initialization reported approximately two seconds.
- After the user unlocked the Mac, the UI tool attached to the archived game and direct E keyboard input visibly opened the staging terminal, pausing the incident. Mouse attempts failed in the automation service with `noWindowsAvailable` despite successful screenshots; mouse choices therefore remain unverified. Some native UI calls took several minutes despite requested timeouts. Play-in-Editor viewport use has not been tested; editor runtime verification used `-game`.
- The user explicitly confirmed **music is audible** from the Mac. The runtime music component and M stop/restart checks also passed. CoreAudio nevertheless logged an unknown hardware device and a sample-rate query warning (2003332927); no claim is made that this warning is resolved or that audio quality was independently reviewed.

First editor startup took roughly seven minutes loading libraries and shaders; later launches were substantially faster. No map regeneration, authored-asset edits, engine-installation edits, Linux changes, or browser changes were needed. The checkout was clean before switching branches, and authored Config files were preserved throughout the scripted runs.

## Gameplay correction pass — November 5

The earlier build/playtest results above predate this correction. They missed an inverted screen/world coordinate convention and only tested the old static DOC panel.

- **Directions and stages:** the side camera looks along +Y, making -X screen-right. A/D input, SOURCE→PRODUCTION placement, startup/retry positions, arrows and production leak effects now agree with that view. `DeliveryLayout.h` shares the coordinates used by gameplay and scene construction. The scene rebuilds its generated geometry at runtime, so the committed map does not need destructive regeneration. Both startup paths and the bootstrap PlayerStart were corrected.
- **Jump:** removed the Space binding and jump instructions. This is a flat investigation corridor with no jump-dependent obstacles, rewards or decisions. Adding arbitrary obstacles would add travel friction rather than support the incident mechanics.
- **DOC:** Q opens a native Slate question field. Enter/Send uses the same public ElevenLabs text-only agent as the browser. Only a submitted question, recent conversation and synthetic incident snapshot are transmitted. No microphone, API key or incident-action tools were added. Offline guide answers authored reference topics without a request. Live connection failure is visibly labeled as an offline fallback; Escape cancels pending work and resumes PATCH.
- **Regression coverage:** the full incident now checks screen-projected D movement, SOURCE→PRODUCTION screen order, the production start and grounded Space behavior. `doc` checks typing A/D/Q into the question field, state preservation, authored answers, explicit fallback and Escape. `doc-live` is an optional real-service check, including cancellation of a subsequent request. The default Mac runner includes the offline `doc` scenario; live requests are never part of its default suite.
- **Editor runtime results:** native build succeeded. `complete`, `pause`, `doc`, `doc-live` passed after the corrections. The full incident earned S. A relevant live answer explaining source deletion versus credential revocation was read in the rendered DOC panel. One intervening live attempt hit an SSL timeout; the actual labeled fallback was inspected and its log preserved as `playtest/Mac/editor/doc-live-ssl-timeout.log`. Live connectivity is not guaranteed.

The first correction run caught a second hardcoded spawn in the character. The initial DOC input failures also exposed the autoplay harness forcing focus to the game viewport before every key, which is invalid for a real text field. Both were fixed before the passing runs. Logs for this pass are `build-mac-logic.log`, `package-mac-logic.log` and `playtest/Mac/`; prior package output was moved to `build/Mac-before-logic-<timestamp>/` rather than discarded.

The first package of this pass then exposed a separate, deterministic startup crash introduced in DOC styling: `_GLOBAL__sub_I_SLDocChat.cpp` accessed `FCoreStyle` before Slate initialization. Editor module loading masked this order dependency. Moved style construction into `USLDocChat::Show()` so it occurs only after the viewport exists. The corrected archived app passed its standalone `doc` smoke test, including opening the style, typing, fallback and Escape, with exit 0. The runner now stops after a process crash instead of launching every remaining scenario and producing repeated crash dialogs. Original failures are retained in `playtest/Mac/packaged-doc-startup-crash/` and the OS diagnostic reports.

With that startup fix, all seven offline packaged scenarios (`complete`, `wrong`, `budget`, `guided`, `pause`, `doc`, `quit`) passed without retries or process crashes. The packaged live test then exposed a missing runtime dependency: OpenSSL reported `unable to get local issuer certificate`. The editor could read `Engine/Content/Certificates/ThirdParty/cacert.pem`, but cooking had not staged it. Added that existing engine CA bundle as a NonUFS runtime dependency and required it in the package validation script. Verified the bundle validates ElevenLabs with certificate verification enabled; no TLS checks or system security settings were disabled. The failed pre-fix connection log is preserved as `playtest/Mac/packaged/doc-live-before-ca-fix.log`.

**Final archive verification:** `package-mac.sh` succeeded with cooked data, the staged CA file and strict signature verification. The final app at `build/Mac/ShiftLeft.app` is arm64, approximately 885 MB. In that archive, `doc-live` passed with a real 501-character ElevenLabs answer; typing, incident-state preservation, pending-request cancellation and Escape passed. The rendered answer was inspected. `complete` was rerun after the CA packaging fix and passed with grade S, screen-correct D movement, correct stage order and effort 3/24. No process crash occurred in these final runs. The seven offline scenarios listed above had already passed on the same corrected C++ gameplay code before the packaging-only CA addition. Portable checks remained 68/68 and source preflight passed. No browser source, engine installation or authored art/map was changed; the Linux build was not rerun for these changes.


## Corridor readability pass — November 5

The user reported that PRODUCTION appeared to be the left edge of the walkable board and that the top banner obscured the wall title in a 16:10 window. The earlier short screen-direction assertion did not establish the actual travel endpoints.

- Added an explicit `layout` runtime scenario: inspect all five rendered station-label world positions, walk A to SOURCE, continue with Left to the physical left clamp, walk D back to PRODUCTION, then continue with Right to the physical right clamp. The actual editor/Metal run reached SOURCE at X=2910 and PRODUCTION at X=-2910, grounded throughout. The rendered signs matched the gameplay positions. The reported inversion was not reproduced in that traversal; no coordinate reversal was added.
- The individual 900-unit bay outlines visually resembled separate walkable boards. Extended the bay floor panels and front strips to meet across the full corridor, removed transverse borders between bays, and retained borders at the two real ends. Replaced one-way chevrons with named neighboring-stage directions. The HUD also shows the left and right destinations explicitly. Collision and incident rules are unchanged.
- Replaced the 124-unit tall header with a 62-unit compact strip anchored to the actual viewport top. Previously the centered 16:9 UI origin moved it down over the wall title in a taller viewport. The 1600×1000 Metal capture now shows the full PRODUCTION heading and subtitle below the strip.
- `build-mac.sh` succeeded with the editor closed; `package-mac.sh` succeeded, including strict signature and content/CA checks. Core checks passed 68/68 and source preflight passed. Logs: `build-mac-layout.log`, `package-mac-layout.log`, and `playtest/Mac/{editor,packaged}/layout.log`. The earlier app was preserved in `build/Mac-before-layout-20261105-153403/`.
- The Mac playtest runner accepts optional `layout`, `SL_RES_X` and `SL_RES_Y`; default resolution remains 1600×900.

Final archive: `layout`, `complete` and offline `doc` each passed with zero failures and process exit 0 at 1600×1000, without retries or crashes. The full incident earned S with effort 3/24. Inspected the packaged production-start capture: the complete wall heading/subtitle, continuous floor strip, neighboring-stage sign and HUD directions are visible. Native DOC typing/fallback/Escape checks passed; live DOC was not rerun in this presentation-only pass (the preceding pass records the actual packaged live success). Linux and browser builds were not rerun.


## Investigation redesign — November 5

The user found the incident hard to understand while also solvable by clicking a prescribed sequence. Reworked the native presentation and decisions: E reads stage-specific evidence, F compares approaches, and R runs a rehearsal reporting all probe outcomes. The briefing defines the stolen service key as a software password and states the goal in terms of copied access, working service and a safe release.

SOURCE now owns the code decision, BUILD the package/runtime delivery decision, and TEST advisory/blocking checks. STAGING rehearses and PRODUCTION operates the application and key issuer. Reversing a plan changes the simulated state and spends the corresponding 1/2/4 effort. Encoding source can undo source repair, advisory scanning can undo enforcement, and rollback restores the old package without revoking its keys. The current native clean route costs seven out of 24; the generic arbitrary-station repair menu has been replaced. The portable model retains legacy arbitrary-stage cost support. Live operations, investigation and rehearsals remain free.

Updated DOC's local explanation and per-question live context with the new roles, costs and observations. Live DOC remains advisory; it is asked to explain evidence and provide a step-by-step solution only when the player requests one. No remote agent settings were changed.

Portable checks: 84 passed, including deliberate seven-effort repair, service interruption after revocation, no implicit service change from issuance, mutually exclusive repair policies, atomic budget rejection, rollback consequences, and forward/reverse blind sweeps that cannot win. The native autoplay chooses visible actions by semantic identity before sending number keys; the separate `decisions` scenario deliberately presses every approach by its displayed number.

The editor/Metal `complete` and `decisions` scenarios passed at 1600×1000. The deliberate route earned S with seven effort; the numeric option sweep left a new key exposed and did not complete. Inspected briefing, production evidence, source/test decisions and the six-line rehearsal readout. The screen review led to two presentation corrections before final packaging: decision panels now repeat their local evidence instead of stale feedback from another station, and footers show only the number keys actually available.

Review also found that the old `InstallEarlyCheck` state was only a release condition: later artifact injection could still publish a key. A blocking check now intercepts that packaging attempt, spends the attempted work but preserves the previous package/service and does not leak or invalidate the access review. Advisory checks still allow the mistake. Added portable tests and a native `prevention` scenario for the actual guard. Earlier wrong-route tests intentionally exercise the unprotected path.

The first archive was compiled before the last prevention edit and failed the new `prevention` scenario as unknown. Preserved that log as `playtest/Mac/packaged/prevention-stale-archive.log` and its build output as `package-mac-decisions-before-prevention.log`, then forced recompilation of the final project sources. The final `package-mac.sh` completed successfully, including the content, CA-bundle and strict signature checks. The previous user-played app is preserved in `build/Mac-before-investigation-20261105-171458/`.

**Final standalone results:** all nine scenarios passed with zero failures and process exit 0 at 1600×1000: `prevention`, `decisions`, `complete`, `wrong`, `budget`, `guided`, `pause`, `doc`, `quit`. No process crash occurred in that final suite. The full incident earned S with effort 7/24; the recovered wrong-route run used 9/24 with one leak. The prevention scenario kept the prior safe package, working service and reviewed exposure while blocking the later attempted injection; effort was 9/24 and no new leak was recorded. The blind sweep spent 14/24 and remained incomplete with an exposed replacement. Inspected the final packaged source-decision screen: local evidence, startup-setting wording, both alternatives and the two-key footer are visible without clipping. Pause/music state, DOC typing/offline fallback/Escape and Quit passed. Live DOC connectivity was not rerun in this pass; prior live verification remains recorded above. Linux/browser builds and OS mouse automation were not rerun.

Final logs: `build-mac-decisions.log`, `package-mac-decisions.log`, and `playtest/Mac/packaged/`. The final app remains `build/Mac/ShiftLeft.app`. Authored assets and Config were preserved.
