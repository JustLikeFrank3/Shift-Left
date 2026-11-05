#!/usr/bin/env bash
set -eu
engine_dir=${1:-}
if ! command -v python3 >/dev/null 2>&1; then
  printf '%s\n' 'BLOCKED: python3 is required for setup checks.'
  exit 2
fi
printf '%s\n' 'SHIFT LEFT / Unreal Linux readiness'
printf 'Architecture: %s\n' "$(uname -m)"
if [ -r /etc/os-release ]; then
  python3 -c 'from pathlib import Path; d=dict(line.split("=",1) for line in Path("/etc/os-release").read_text().splitlines() if "=" in line); print("OS:",d.get("PRETTY_NAME","").strip(chr(34)))'
fi
python3 - <<'PY'
from pathlib import Path
mem=next(line for line in Path('/proc/meminfo').read_text().splitlines() if line.startswith('MemTotal:'))
print('RAM: %.1f GiB' % (int(mem.split()[1])/1024/1024))
PY
if command -v lspci >/dev/null 2>&1; then lspci | grep -Ei 'vga|3d|display' || true; fi
if [ -z "$engine_dir" ]; then
  printf '%s\n' 'Unreal path not supplied. Re-run: ./scripts/check-linux.sh /absolute/path/to/UnrealEngine'
  exit 2
fi
if [ ! -x "$engine_dir/Engine/Binaries/Linux/UnrealEditor" ]; then
  printf '%s\n' 'BLOCKED: UnrealEditor is not executable at the supplied engine path.'
  exit 2
fi
if [ ! -f "$engine_dir/Engine/Build/Build.version" ]; then
  printf '%s\n' 'BLOCKED: Engine/Build/Build.version is missing.'
  exit 2
fi
python3 - "$engine_dir/Engine/Build/Build.version" <<'PY'
import json,sys
v=json.load(open(sys.argv[1])); print('Engine: %s.%s.%s' % (v['MajorVersion'],v['MinorVersion'],v['PatchVersion']))
if (v['MajorVersion'], v['MinorVersion']) != (5, 8):
    raise SystemExit('This project targets Unreal Engine 5.8; use the matching editor before upgrading.')
PY
printf '%s\n' 'Editor executable found. This is a readiness check, not a successful project build.'
