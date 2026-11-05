# Linux Unreal handoff

Branch: `feat/unreal-linux-slice` in `JustLikeFrank3/Shift-Left`. This branch contains the earlier browser work; no PR merge is needed. Keep work on this branch until the native build is verified.

The immediate goal is the **first verified Unreal build of The Leaked Secret**. The C++ gameplay, original 3D assets, score import and Linux scripts are prepared. There is no packaged native executable yet.

## 1. Install the editor

On an x86-64 Linux development computer with a Vulkan-capable GPU, download the precompiled **Unreal Engine 5.8 Linux** archive from [Epic](https://www.unrealengine.com/en-US/linux). Sign in and accept the license yourself. Extract it so `~/Unreal/UE_5.8/Engine/` exists. Install Git, Python 3 and a C++ compiler; on Ubuntu:

```bash
sudo apt install git python3 build-essential
"$HOME/Unreal/UE_5.8/Engine/Binaries/Linux/UnrealEditor"
```

Let first launch finish, then close the editor before the scripted build. Epic recommends 32 GB RAM and at least 8 GB graphics memory. Allow substantial disk space for the engine and build caches; the 32 GB cloud workspace used to prepare this source cannot host that build. See [the full setup guide](README.md) for official requirements and troubleshooting links.

## 2. Get the branch

For a fresh checkout:

```bash
git clone --branch feat/unreal-linux-slice https://github.com/JustLikeFrank3/Shift-Left.git
cd Shift-Left/unreal
```

In an existing clone, save your work, run `git fetch origin`, and switch to `feat/unreal-linux-slice`. If the local branch does not exist yet, use `git switch --track origin/feat/unreal-linux-slice`. Do not reset or force-switch over local changes.

## 3. Build, import and open

Run in `Shift-Left/unreal` using Bash. Replace the engine path if you extracted elsewhere:

```bash
./scripts/check-linux.sh "$HOME/Unreal/UE_5.8"
./scripts/test-core.sh
python3 ./scripts/verify-source.py
set -o pipefail
./scripts/build-linux.sh "$HOME/Unreal/UE_5.8" 2>&1 | tee build-unreal.log
```

Continue only if the build exits successfully. It compiles the Editor module, imports original FBX parts and the score, creates materials, and generates `/Game/Maps/DeliveryGrid`. It requires a fresh success marker and a real saved map before reporting success.

```bash
"$HOME/Unreal/UE_5.8/Engine/Binaries/Linux/UnrealEditor" "$PWD/ShiftLeft/ShiftLeft.uproject"
```

Open `/Game/Maps/DeliveryGrid` and press **Play**. The first compile, asset import, shader generation and native playtest have not been performed in the cloud; resolving their errors is part of this handoff.

**Before rerunning the full build/import script:** it regenerates the bootstrap map and reimports meshes. Keep hand-edited levels in a separately named map and preserve any custom mesh changes. For C++ iteration after the initial bootstrap, build the Editor module without rerunning the import step:

```bash
"$HOME/Unreal/UE_5.8/Engine/Build/BatchFiles/Linux/Build.sh" ShiftLeftEditor Linux Development "$PWD/ShiftLeft/ShiftLeft.uproject" -WaitMutex
```

Close Unreal before an external C++ rebuild. Generated assets are real Unreal files; inspect any new `.uasset`/`.umap` files before deciding what to commit.

## 4. First playtest

PATCH should start beside PRODUCTION with DOC visible. Use A/D or arrows to move, Space to jump, E to connect, F for PATCH!, Q for the offline DOC guide, R to validate, M to toggle music, Escape or H for help (Escape stops Play-in-Editor; 4 there quits), and 1/2/3 or the mouse to choose operations.

Check these paths:

- **Presentation:** both characters face the camera, PATCH's limbs move while walking, DOC floats, terminals are readable, the camera follows, and the floor collision holds.
- **Complete incident:** at production, review usage, revoke the exposed credential and provision a replacement. Travel left to SOURCE. Replace the source literal, add the secret check, then use F to bind the replacement at runtime. Press R; expect a validated release and grade. Containment is free; these three source repairs total 3 effort.
- **Consequences:** restart and try packaging a replacement into the artifact. Expect renewed exposure and causal feedback. Revoke that compromised replacement, issue a fresh one and recover. Expensive repairs must respect the 24-effort budget; retry must restore it.
- **Accessibility and pacing:** help, DOC and terminal panels pause exposure and movement input. Guided mode removes the time-based deadline. Verify both mouse and keyboard panels, music/M, readable text and performance on the target GPU.

The model tests are deterministic; playtest balance and rendering still need human judgment. Do not label Blender previews as in-engine screenshots.

## 5. Package after the slice works

```bash
set -o pipefail
./scripts/package-linux.sh "$HOME/Unreal/UE_5.8" 2>&1 | tee package-unreal.log
```

Output defaults to `unreal/build/Linux/`. Run the resulting launcher on the intended Linux hardware and verify the full incident and music in that packaged build. This does not produce Windows or macOS packages.

## If something fails

Preserve `unreal/build-unreal.log` or `unreal/package-unreal.log` plus `unreal/ShiftLeft/Saved/Logs/ShiftLeft.log`. Report the **first actual error**, engine version, Linux distribution, GPU/driver and the command you ran. Do not interpret a source preflight pass or a bootstrap success marker as proof of correct rendering.

Known issues seen so far:

- UE 5.8 segfaults during editor shutdown after the bootstrap has saved everything. `build-linux.sh` accepts that exit only when the fresh success marker and map exist, and prints a warning.
- The editor rewrites `Config/DefaultInput.ini` and `DefaultEngine.ini` (expanded defaults, an Android file-server token). The build, package and playtest scripts restore `Config/` when they finish; review `git diff unreal/ShiftLeft/Config` before committing after saving settings in the editor.
- UAT stages with the first `env` on `PATH`. A sourceable `~/.local/bin/env` breaks staging with `Permission denied`; `package-linux.sh` puts `/usr/bin` first.
- Dragging the window recreates the Vulkan swapchain every frame (`LogVulkanRHI: Creating new VK swapchain`, about 220 times in 14 seconds in one manual run) and stutters while the window moves. The player confirmed it happened only while moving the window; play is unaffected.
- Quit is the fourth choice in the help panel (Escape or H, then 4 or click). Closing the window or Alt+F4 also exits.
- Unreal logs the audio "hardware device" as the first enumerated output, but SDL opens the system default (check the `Opening ... audio device` line).

## Committed generated content and other platforms

`ShiftLeft/Content/Art`, `Audio` and `Maps` are committed: the 9 imported meshes, 13 materials, the score and `DeliveryGrid`, exactly as used by the verified Linux package (imported by UE 5.8.0 on 2026-11-04). A fresh checkout can open, play and package without rerunning the bootstrap. Rerun `build-linux.sh` only to reimport changed FBX/WAV sources; it backs up `Content/` to `Saved/ContentBackups/` first.

Native code turns imported meshes 180 degrees at runtime (`SLPatchCharacter.cpp` `LoadArt`, `SLDeliveryWorld.cpp` `Rack`/`Terminal`). Do not also rotate them at import, or they will face away again.

**macOS has not been attempted.** A Mac build needs a Mac with Xcode and UE 5.8 for macOS; Linux cannot produce it. The C++, content and `-SLAutoplay` harness are platform-neutral, but every script in `scripts/` is Linux-specific (paths under `Engine/Binaries/Linux`, `BatchFiles/Linux`, the `/usr/bin` PATH fix). Expected Mac equivalents, unverified: `Engine/Build/BatchFiles/Mac/Build.sh ShiftLeftEditor Mac Development <uproject> -WaitMutex`, then `Engine/Build/BatchFiles/RunUAT.sh BuildCookRun -project=<uproject> -platform=Mac -clientconfig=Development -build -cook -stage -pak -archive -archivedirectory=<dir> -map=/Game/Maps/DeliveryGrid`. `DefaultEngine.ini` only sets Linux RHIs, so a Mac build uses the engine's Metal defaults. Record actual Mac results the same way as the Linux table below.

## Native verification results

Recorded 2026-11-04 on Ubuntu 26.04 LTS, Ryzen 7 8845HS, NVIDIA RTX 5060 Ti 16 GB (driver 595.99.02, Vulkan SM6), 29.7 GB RAM, UE 5.8.0 (CL 55116800).

| Check | Result |
| --- | --- |
| `test-core.sh` / `verify-source.py` | 68 checks pass / preflight passes |
| `build-linux.sh` | `ShiftLeftEditor` compiles; 9 FBX meshes, 13 materials, the score and `DeliveryGrid` saved |
| `package-linux.sh` | Development package built, 1.2 GB, `build/Linux/ShiftLeft.sh` |
| `playtest-linux.sh`, editor `-game` | complete, wrong, budget, guided, pause, quit: all PASS |
| `playtest-linux.sh`, packaged | complete, wrong, budget, guided, pause, quit: all PASS |

Scenario outcomes (identical in both builds): **complete** contains for 0 effort, repairs at SOURCE for 3, validates with grade S and 0 mistakes. **wrong** packages the replacement at PRODUCTION (16 effort, pressure 25, exposure resumes), revokes and reissues, then validates at 19 effort with 1 mistake. **budget** spends 24/24, an unaffordable check changes nothing, and Escape > Retry restores 0/24 at PRODUCTION. **guided** survives 241 s of exposure at 0 pressure; standard fails at exactly 180.0 s and retry starts fresh. **pause** shows DOC stopping both the exposure clock and movement, and M stopping and restarting the score. **quit** opens help with H and exits through the fourth choice (end reason Quit).

Screenshots confirmed: PATCH and DOC face the camera with their faces readable; PATCH's articulated limbs swing and he turns three-quarters toward travel; Space jumps and the deck holds; terminals and racks face the corridor; PATCH! raises his arm, shows a rising callout and flashes mint (coral when the route re-exposes the replacement); HUD and panels are readable at 1600x900. Music played on the default output (Scarlett Solo USB). Rough frame rate from log timestamps: 70-110 fps at 1600x900 windowed, including screenshot stalls.

Not verified: mouse clicks on panel choices; keys from a real OS keyboard (autoplay injects through Slate); anyone listening to the music; Play-in-Editor inside the editor viewport (tests used the editor binary with `-game`); fullscreen, other resolutions, gamepads; other GPUs or distributions; a Shipping configuration. Human balance and feel judgment is still needed.

Only **The Leaked Secret** has native gameplay. Campaign JSON is reference data. Native DOC is a labeled offline guide; the browser's live text agent is not connected to native UI. Native music currently loops the original score with an M toggle; the browser's adaptive mixer and crossfade have not been ported.

## Prompt for a local coding-agent session

Open this repository in a local coding-agent session on the Unreal-equipped machine and use:

> Continue SHIFT LEFT on branch feat/unreal-linux-slice. Read AGENTS.md, unreal/README.md and unreal/HANDOFF.md. Unreal Engine 5.8 is installed at ~/Unreal/UE_5.8 (adjust if needed). Run the portable checks and perform the first real Editor build and asset bootstrap. Fix compiler/import failures, then verify the DeliveryGrid in Play and package Linux. Preserve local changes and hand-edited maps. Prioritize readable PATCH and DOC, articulated walking, clear terminal interactions, music, guided mode and recoverable consequences. Keep the existing browser checkpoint. Record what actually compiled, ran and was playtested, plus unresolved issues. Do not merge or claim the full campaign or live DOC has been ported.
