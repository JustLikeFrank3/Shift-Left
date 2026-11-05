#!/usr/bin/env bash
set -eu
engine_dir=${1:?Usage: ./scripts/build-linux.sh /absolute/path/to/UnrealEngine}
engine_dir=$(CDPATH= cd -- "$engine_dir" && pwd)
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
unreal_dir=$(CDPATH= cd -- "$script_dir/.." && pwd)
project_file="$unreal_dir/ShiftLeft/ShiftLeft.uproject"
success_marker="$unreal_dir/ShiftLeft/Saved/ShiftLeft/bootstrap-success.json"
"$script_dir/check-linux.sh" "$engine_dir"
python3 "$script_dir/verify-source.py"
"$engine_dir/Engine/Build/BatchFiles/Linux/Build.sh" ShiftLeftEditor Linux Development "$project_file" -WaitMutex
editor="$engine_dir/Engine/Binaries/Linux/UnrealEditor-Cmd"
if [ ! -x "$editor" ]; then editor="$engine_dir/Engine/Binaries/Linux/UnrealEditor"; fi
content_dir="$unreal_dir/ShiftLeft/Content"
if [ -d "$content_dir/Maps" ] || [ -d "$content_dir/Art" ]; then
  backup_dir="$unreal_dir/ShiftLeft/Saved/ContentBackups/$(date +%Y%m%d-%H%M%S)"
  mkdir -p -- "$backup_dir"
  for part in Maps Art Audio; do
    if [ -d "$content_dir/$part" ]; then cp -a -- "$content_dir/$part" "$backup_dir/"; fi
  done
  printf 'Backed up existing generated content to %s before regenerating it.\n' "$backup_dir"
fi
rm -f -- "$success_marker"
"$editor" "$project_file" /Engine/Maps/Entry -unattended -nop4 -nosplash -NullRHI -stdout -FullStdOutLogOutput -ExecutePythonScript="$script_dir/bootstrap_editor.py"
if [ ! -f "$success_marker" ] || [ ! -f "$unreal_dir/ShiftLeft/Content/Maps/DeliveryGrid.umap" ]; then
  printf '%s\n' 'BLOCKED: editor bootstrap did not finish. Inspect ShiftLeft/Saved/Logs/ShiftLeft.log.'
  exit 2
fi
printf '%s\n' 'Native module compiled and art/map bootstrap finished. Launch the editor to inspect the result:'
printf '%s "%s"\n' "$engine_dir/Engine/Binaries/Linux/UnrealEditor" "$project_file"
