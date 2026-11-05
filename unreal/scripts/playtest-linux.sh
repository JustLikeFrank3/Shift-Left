#!/usr/bin/env bash
# Scripted in-engine playtest. Each scenario launches the game, drives it with real
# key events through Slate, saves screenshots and logs PASS/FAIL checks.
#   ./scripts/playtest-linux.sh /path/to/UE_5.8 [scenario ...]          # editor build, -game
#   SL_GAME=/path/to/ShiftLeft.sh ./scripts/playtest-linux.sh - [scenario ...]  # packaged build
set -u
engine_dir=${1:?Usage: ./scripts/playtest-linux.sh /path/to/UnrealEngine|- [complete wrong budget guided pause]}
shift
scenarios=${*:-complete wrong budget guided pause}
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
unreal_dir=$(CDPATH= cd -- "$script_dir/.." && pwd)
project_file="$unreal_dir/ShiftLeft/ShiftLeft.uproject"
log_dir="$unreal_dir/playtest"
mkdir -p -- "$log_dir"
overall=0
for scenario in $scenarios; do
  log="$log_dir/$scenario.log"
  if [ -n "${SL_GAME:-}" ]; then
    timeout 900 "$SL_GAME" -windowed -ResX=1600 -ResY=900 -SLAutoplay="$scenario" -stdout -FullStdOutLogOutput >"$log" 2>&1
  else
    timeout 900 "$engine_dir/Engine/Binaries/Linux/UnrealEditor" "$project_file" /Game/Maps/DeliveryGrid -game -windowed \
      -ResX=1600 -ResY=900 -SLAutoplay="$scenario" -nosplash -stdout -FullStdOutLogOutput >"$log" 2>&1
  fi
  status=$?
  result=$(grep -o 'AUTOPLAY RESULT [A-Z]* scenario=[a-z]* failures=[0-9]*' "$log" | tail -1)
  printf '%-9s exit=%-3s %s\n' "$scenario" "$status" "${result:-NO RESULT (see $log)}"
  grep -E 'LogSLAutoplay: (Display: FAIL|Error)' "$log" | sed 's/^.*LogSLAutoplay: /    /' | cut -c1-220
  case "$result" in *PASS*) ;; *) overall=1 ;; esac
done
printf 'Screenshots: %s\n' "$unreal_dir/ShiftLeft/Saved/Autoplay (packaged: <game>/ShiftLeft/Saved/Autoplay)"
exit "$overall"
