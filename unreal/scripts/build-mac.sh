#!/usr/bin/env bash
set -eu
engine_dir='/Users/Shared/Epic Games/UE_5.8'
engine_supplied=0
refresh_assets=0
for argument in "$@"; do
  case "$argument" in
    --refresh-assets) refresh_assets=1 ;;
    -*) printf '%s\n' 'Usage: ./scripts/build-mac.sh [engine-directory] [--refresh-assets]'; exit 2 ;;
    *)
      if [ "$engine_supplied" -ne 0 ]; then
        printf '%s\n' 'Usage: ./scripts/build-mac.sh [engine-directory] [--refresh-assets]'
        exit 2
      fi
      engine_dir=$argument
      engine_supplied=1
      ;;
  esac
done
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
unreal_dir=$(CDPATH= cd -- "$script_dir/.." && pwd)
"$script_dir/check-mac.sh" "$engine_dir"
engine_dir=$(CDPATH= cd -- "$engine_dir" && pwd)
python3 "$script_dir/verify-source.py"
project_file="$unreal_dir/ShiftLeft/ShiftLeft.uproject"
config_dir="$unreal_dir/ShiftLeft/Config"
config_snapshot=$(mktemp -d "${TMPDIR:-/tmp}/shift-left-mac-config.XXXXXX")
cp -R -p "$config_dir/." "$config_snapshot/"
restore_config() {
  result=$?
  trap - EXIT
  if ! (rm -rf "$config_dir" && mkdir -p "$config_dir" && cp -R -p "$config_snapshot/." "$config_dir/"); then
    printf 'BLOCKED: could not restore Config; the original snapshot remains at %s\n' "$config_snapshot" >&2
    exit 2
  fi
  rm -rf "$config_snapshot"
  exit "$result"
}
trap restore_config EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
"$engine_dir/Engine/Build/BatchFiles/Mac/Build.sh" ShiftLeftEditor Mac Development "-Project=$project_file" -WaitMutex
content_dir="$unreal_dir/ShiftLeft/Content"
for asset in Maps/DeliveryGrid.umap Art/PATCH.uasset Art/PATCH_Body.uasset Art/PATCH_Arm_L.uasset Art/PATCH_Arm_R.uasset Art/PATCH_Leg_L.uasset Art/PATCH_Leg_R.uasset Art/DOC.uasset Art/ServerRack.uasset Art/Terminal.uasset Audio/SignalInTheDark.uasset; do
  if [ ! -f "$content_dir/$asset" ]; then refresh_assets=1; fi
done
editor="$engine_dir/Engine/Binaries/Mac/UnrealEditor.app/Contents/MacOS/UnrealEditor"
if [ "$refresh_assets" -eq 1 ]; then
  backup_dir="$unreal_dir/ShiftLeft/Saved/ContentBackups/$(date +%Y%m%d-%H%M%S)-$$"
  mkdir -p "$backup_dir"
  for part in Maps Art Audio; do
    if [ -d "$content_dir/$part" ]; then cp -R -p "$content_dir/$part" "$backup_dir/"; fi
  done
  printf 'Preserved existing generated content at %s before importing.\n' "$backup_dir"
  success_marker="$unreal_dir/ShiftLeft/Saved/ShiftLeft/bootstrap-success.json"
  rm -f "$success_marker"
  if ! "$editor" "$project_file" /Engine/Maps/Entry -unattended -nop4 -nosplash -NullRHI -stdout -FullStdOutLogOutput "-ExecutePythonScript=$script_dir/bootstrap_editor.py"; then
    printf '%s\n' 'BLOCKED: the Mac editor asset bootstrap failed. Inspect ShiftLeft/Saved/Logs/ShiftLeft.log.'
    exit 2
  fi
  if [ ! -f "$success_marker" ] || [ ! -f "$content_dir/Maps/DeliveryGrid.umap" ]; then
    printf '%s\n' 'BLOCKED: the Mac bootstrap did not save its fresh success marker and map. Inspect ShiftLeft/Saved/Logs/ShiftLeft.log.'
    exit 2
  fi
else
  printf '%s\n' 'Using the committed Unreal assets and map; no reimport or map regeneration was needed.'
fi
printf '%s\n' 'Mac Editor module compiled. Open the project and verify the actual rendering and gameplay:'
printf '"%s" "%s"\n' "$editor" "$project_file"
