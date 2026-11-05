#!/usr/bin/env bash
set -eu
engine_dir=${1:-"/Users/Shared/Epic Games/UE_5.8"}
printf '%s\n' 'SHIFT LEFT / Unreal macOS readiness'
if [ "$(uname -s)" != Darwin ]; then
  printf '%s\n' 'BLOCKED: run the Mac build scripts on macOS. No Mac build was attempted.'
  exit 2
fi
printf 'Architecture: %s\n' "$(uname -m)"
sw_vers
if ! command -v python3 >/dev/null 2>&1; then
  printf '%s\n' 'BLOCKED: Python 3 is required for project setup checks.'
  exit 2
fi
if ! command -v xcode-select >/dev/null 2>&1 || ! command -v xcodebuild >/dev/null 2>&1; then
  printf '%s\n' 'BLOCKED: install the full Xcode application, launch it once and finish its setup.'
  exit 2
fi
developer_dir=${DEVELOPER_DIR:-$(xcode-select -p)}
if [ ! -x "$developer_dir/usr/bin/xcodebuild" ]; then
  printf '%s\n' 'BLOCKED: the selected developer directory is not a full Xcode installation.'
  printf '%s\n' 'Select your Xcode app, for example: sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer'
  exit 2
fi
printf 'Selected developer directory: %s\n' "$developer_dir"
if ! xcode_details=$(xcodebuild -version); then
  printf '%s\n' 'BLOCKED: Xcode is not ready. Open Xcode and finish its license/component setup.'
  exit 2
fi
printf '%s\n' "$xcode_details"
python3 - "$xcode_details" <<'PY'
import re, sys
match = re.search(r'^Xcode (\d+)(?:\.(\d+))?', sys.argv[1], re.MULTILINE)
if not match:
    raise SystemExit('BLOCKED: could not identify the active Xcode version.')
version = (int(match[1]), int(match[2] or 0))
if version < (26, 0):
    raise SystemExit('BLOCKED: UE 5.8 requires Xcode 26.0 or newer; Epic recommends 26.1.1.')
if version == (26, 4):
    raise SystemExit('BLOCKED: Epic lists Xcode 26.4 as incompatible with UE 5.8. Select a compatible Xcode such as 26.1.1.')
PY
if ! xcrun --sdk macosx --show-sdk-version; then
  printf '%s\n' 'BLOCKED: the selected Xcode cannot provide the macOS SDK.'
  exit 2
fi
if ! xcrun --find metal >/dev/null; then
  printf '%s\n' 'BLOCKED: the Metal compiler is unavailable. Finish installing the Xcode Metal toolchain.'
  exit 2
fi
editor="$engine_dir/Engine/Binaries/Mac/UnrealEditor.app/Contents/MacOS/UnrealEditor"
if [ ! -x "$editor" ]; then
  printf 'BLOCKED: UnrealEditor is not executable at %s\n' "$editor"
  printf '%s\n' 'Install Unreal Engine 5.8 for macOS through Epic Games Launcher, or supply its actual engine directory.'
  exit 2
fi
version_file="$engine_dir/Engine/Build/Build.version"
if [ ! -f "$version_file" ]; then
  printf '%s\n' 'BLOCKED: Engine/Build/Build.version is missing.'
  exit 2
fi
python3 - "$version_file" <<'PY'
import json, sys
with open(sys.argv[1]) as stream:
    version = json.load(stream)
print('Engine: %s.%s.%s' % (version['MajorVersion'], version['MinorVersion'], version['PatchVersion']))
if (version['MajorVersion'], version['MinorVersion']) != (5, 8):
    raise SystemExit('BLOCKED: this project targets Unreal Engine 5.8; use the matching editor before upgrading.')
PY
for command_path in Engine/Build/BatchFiles/Mac/Build.sh Engine/Build/BatchFiles/RunUAT.sh; do
  if [ ! -x "$engine_dir/$command_path" ]; then
    printf 'BLOCKED: required engine build tool is not executable: %s\n' "$engine_dir/$command_path"
    exit 2
  fi
done
sdk_manifest="$engine_dir/Engine/Config/Apple/Apple_SDK.json"
if [ -f "$sdk_manifest" ]; then
  printf 'Engine-specific Apple SDK constraints: %s\n' "$sdk_manifest"
fi
printf '%s\n' 'Prerequisites found. UnrealBuildTool will validate the installed engine SDK constraints during compilation.'
printf '%s\n' 'This readiness check is not a successful Mac build, render or packaged launch.'
