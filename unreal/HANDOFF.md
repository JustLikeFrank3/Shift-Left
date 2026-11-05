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

PATCH should start beside PRODUCTION with DOC visible. Use A/D or arrows to move, Space to jump, E to connect, F for PATCH!, Q for the offline DOC guide, R to validate, M to toggle music, Escape for help, and 1/2/3 or the mouse to choose operations.

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

Validation already performed: 68 GCC checks for the portable model; source/config/import-input preflight; Bash and Python syntax checks; static review of native C++; Blender round trips for the original seven assets. Native compilation/import/play/packaging and the five articulated parts' final in-engine transforms remain unverified.

Only **The Leaked Secret** has native gameplay. Campaign JSON is reference data. Native DOC is a labeled offline guide; the browser's live text agent is not connected to native UI. Native music currently loops the original score with an M toggle; the browser's adaptive mixer and crossfade have not been ported.

## Prompt for a local coding-agent session

Open this repository in a local coding-agent session on the Unreal-equipped machine and use:

> Continue SHIFT LEFT on branch feat/unreal-linux-slice. Read AGENTS.md, unreal/README.md and unreal/HANDOFF.md. Unreal Engine 5.8 is installed at ~/Unreal/UE_5.8 (adjust if needed). Run the portable checks and perform the first real Editor build and asset bootstrap. Fix compiler/import failures, then verify the DeliveryGrid in Play and package Linux. Preserve local changes and hand-edited maps. Prioritize readable PATCH and DOC, articulated walking, clear terminal interactions, music, guided mode and recoverable consequences. Keep the existing browser checkpoint. Record what actually compiled, ran and was playtested, plus unresolved issues. Do not merge or claim the full campaign or live DOC has been ported.
