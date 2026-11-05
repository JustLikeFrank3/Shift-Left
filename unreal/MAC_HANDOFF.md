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

At production, inspect usage, revoke the leaked credential and provision a replacement. Move left to SOURCE. Replace the source literal, add the early check, then use PATCH! to bind the replacement at runtime. Validate the release. Also test a wrong artifact route, recovery, the budget, retry, guided mode and paused panel reading. The existing Linux handoff records the full scripted scenarios; they still need to pass on Mac. Automated tests do not establish mouse usability or sound quality.

Only The Leaked Secret is native. DOC is currently an offline guide. Keep the original score; the browser's adaptive audio mixer has not been ported. Blender previews are not Mac gameplay evidence.

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
