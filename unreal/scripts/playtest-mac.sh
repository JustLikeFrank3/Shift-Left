#!/usr/bin/env bash
# Run the existing Slate-input scenarios with the Mac editor or a packaged binary.
set -eu
engine_dir=${1:-"/Users/Shared/Epic Games/UE_5.8"}
if [ "$#" -gt 0 ]; then shift; fi
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
unreal_dir=$(CDPATH= cd -- "$script_dir/.." && pwd)
exec python3 - "$unreal_dir" "$engine_dir" "$@" <<'PY'
from pathlib import Path
import os
import re
import shutil
import subprocess
import sys
import tempfile

root = Path(sys.argv[1])
engine = Path(sys.argv[2])
scenarios = sys.argv[3:] or ['complete', 'wrong', 'budget', 'guided', 'pause', 'doc', 'quit']
if any(s not in ('complete', 'wrong', 'budget', 'guided', 'pause', 'doc', 'doc-live', 'layout', 'quit') for s in scenarios):
    raise SystemExit('Unknown playtest scenario')
game = os.environ.get('SL_GAME')
command = [game] if game else [str(engine / 'Engine/Binaries/Mac/UnrealEditor.app/Contents/MacOS/UnrealEditor'), str(root / 'ShiftLeft/ShiftLeft.uproject'), '/Game/Maps/DeliveryGrid', '-game']
logs = root / 'playtest/Mac' / ('packaged' if game else 'editor')
logs.mkdir(parents=True, exist_ok=True)
config = root / 'ShiftLeft/Config'
failed = False
with tempfile.TemporaryDirectory(prefix='shift-left-playtest-') as backup:
    shutil.copytree(config, Path(backup) / 'Config')
    try:
        for scenario in scenarios:
            log = logs / f'{scenario}.log'
            with log.open('w') as output:
                try:
                    result = subprocess.run(command + ['-windowed', f'-ResX={int(os.environ.get("SL_RES_X", 1600))}', f'-ResY={int(os.environ.get("SL_RES_Y", 900))}', f'-SLAutoplay={scenario}', '-nosplash', '-stdout', '-FullStdOutLogOutput'], stdout=output, stderr=subprocess.STDOUT, timeout=900)
                    code = result.returncode
                except subprocess.TimeoutExpired:
                    code = 124
            content = log.read_text(errors='replace')
            matches = re.findall(r'AUTOPLAY RESULT (PASS|FAIL) scenario=' + scenario + r' failures=(\d+)', content)
            passed = code == 0 and bool(matches) and matches[-1] == ('PASS', '0')
            failed |= not passed
            print(f'{scenario}: {"PASS" if passed else "FAIL"} exit={code} log={log}', flush=True)
            for line in content.splitlines():
                if 'LogSLAutoplay:' in line and ('FAIL' in line or 'Error:' in line):
                    print(line, flush=True)
            if code < 0:
                print('Stopping the suite after a process crash; inspect the macOS crash report before launching more scenarios.', flush=True)
                break
    finally:
        shutil.rmtree(config)
        shutil.copytree(Path(backup) / 'Config', config)
raise SystemExit(1 if failed else 0)
PY
