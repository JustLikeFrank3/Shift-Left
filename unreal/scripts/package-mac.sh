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
# Apple packaging finalizes the self-contained app before Archive copies it.
# Without -package UE 5.8 can report success while archiving the bare build app,
# which has no Contents/UE cooked data and cannot run independently.
"$engine_dir/Engine/Build/BatchFiles/RunUAT.sh" BuildCookRun "-project=$unreal_dir/ShiftLeft/ShiftLeft.uproject" -noP4 -platform=Mac -clientconfig=Development -build -cook -stage -pak -package -archive "-archivedirectory=$output_dir" -map=/Game/Maps/DeliveryGrid -utf8output
app_dir="$output_dir/ShiftLeft.app"
pak_dir="$app_dir/Contents/UE/ShiftLeft/Content/Paks"
for cooked_file in ShiftLeft-Mac.pak ShiftLeft-Mac.utoc ShiftLeft-Mac.ucas; do
  if [ ! -s "$pak_dir/$cooked_file" ]; then
    printf 'BLOCKED: archived app is missing cooked content: %s\n' "$pak_dir/$cooked_file" >&2
    exit 2
  fi
done
if [ ! -s "$app_dir/Contents/UE/Engine/Content/Certificates/ThirdParty/cacert.pem" ]; then
  printf '%s\n' 'BLOCKED: archived app is missing the CA bundle needed by live DOC.' >&2
  exit 2
fi
codesign --verify --deep --strict "$app_dir"
printf 'Mac package archived to %s. Launch and playtest it on the target Mac before sharing.\n' "$output_dir"
