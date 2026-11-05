#!/usr/bin/env bash
set -eu
engine_dir=${1:-"/Users/Shared/Epic Games/UE_5.8"}
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
unreal_dir=$(CDPATH= cd -- "$script_dir/.." && pwd)
"$script_dir/check-mac.sh" "$engine_dir"
engine_dir=$(CDPATH= cd -- "$engine_dir" && pwd)
output_dir=$(python3 - "${2:-"$unreal_dir/build/Mac"}" <<'PY'
from pathlib import Path
import sys
print(Path(sys.argv[1]).expanduser().resolve())
PY
)
if [ ! -f "$unreal_dir/ShiftLeft/Content/Maps/DeliveryGrid.umap" ]; then
  printf '%s\n' 'BLOCKED: DeliveryGrid.umap is missing. Run build-mac.sh first.'
  exit 2
fi
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
# Use the system env executable during staging, as expected by the engine tools.
PATH="/usr/bin:/bin:$PATH"
export PATH
"$engine_dir/Engine/Build/BatchFiles/RunUAT.sh" BuildCookRun "-project=$unreal_dir/ShiftLeft/ShiftLeft.uproject" -noP4 -platform=Mac -clientconfig=Development -build -cook -stage -pak -archive "-archivedirectory=$output_dir" -map=/Game/Maps/DeliveryGrid -utf8output
printf 'Mac package archived to %s. Launch and playtest it on the target Mac before sharing.\n' "$output_dir"
