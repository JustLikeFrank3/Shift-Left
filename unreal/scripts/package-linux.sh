#!/usr/bin/env bash
set -eu
engine_dir=${1:?Usage: ./scripts/package-linux.sh /absolute/path/to/UnrealEngine [output-directory]}
engine_dir=$(CDPATH= cd -- "$engine_dir" && pwd)
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
unreal_dir=$(CDPATH= cd -- "$script_dir/.." && pwd)
output_dir=${2:-"$unreal_dir/build/Linux"}
"$script_dir/check-linux.sh" "$engine_dir"
if [ ! -f "$unreal_dir/ShiftLeft/Content/Maps/DeliveryGrid.umap" ]; then
  printf '%s\n' 'BLOCKED: run build-linux.sh to import the art and create the map before packaging.'
  exit 2
fi
"$engine_dir/Engine/Build/BatchFiles/RunUAT.sh" BuildCookRun -project="$unreal_dir/ShiftLeft/ShiftLeft.uproject" -noP4 -platform=Linux -clientconfig=Development -build -cook -stage -pak -archive -archivedirectory="$output_dir" -map=/Game/Maps/DeliveryGrid -utf8output
