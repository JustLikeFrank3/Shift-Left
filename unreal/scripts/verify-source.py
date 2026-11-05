#!/usr/bin/env python3
"""Validate source/config/import inputs without claiming an Unreal build."""
import ast
import json
from pathlib import Path
import re
import wave

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / "ShiftLeft"


def require(condition, message):
    if not condition:
        raise SystemExit("BLOCKED: " + message)


project = json.loads((PROJECT / "ShiftLeft.uproject").read_text())
require(project["EngineAssociation"] == "5.8", "unexpected engine association")
require(any(m["Name"] == "ShiftLeft" for m in project["Modules"]), "runtime module is absent")
for target in ("ShiftLeft", "ShiftLeftEditor"):
    require((PROJECT / "Source" / f"{target}.Target.cs").is_file(), f"missing {target} target")

tree = ast.parse((ROOT / "scripts" / "bootstrap_editor.py").read_text())
def source_constant(name):
    return next(ast.literal_eval(node.value) for node in tree.body
                if isinstance(node, ast.Assign)
                and any(isinstance(t, ast.Name) and t.id == name for t in node.targets))


assets = source_constant("ASSETS")
materials = source_constant("COLORS")
manifest_path = PROJECT / "Content" / "ArtSource" / "asset_manifest.json"
require(manifest_path.is_file(), "original mesh manifest is absent")
manifest = json.loads(manifest_path.read_text())["assets"]
for filename in assets:
    source = PROJECT / "Content" / "ArtSource" / filename
    require(source.is_file(), f"missing original FBX: {source}")
    with source.open("rb") as stream:
        header = stream.read(64)
    require(header.startswith(b"Kaydara FBX Binary") or b"FBX" in header, f"invalid FBX header: {filename}")
    spec = next((item for item in manifest.values() if item["file"] == filename), None)
    require(spec is not None, f"mesh is absent from original asset manifest: {filename}")
    missing_materials = set(spec["materials"]) - set(materials)
    require(not missing_materials, f"{filename} has unmapped material slots: {sorted(missing_materials)}")

score = PROJECT / "Content" / "AudioSource" / "SignalInTheDark.wav"
require(score.is_file(), "native score source is absent")
with wave.open(str(score), "rb") as stream:
    require((stream.getnchannels(), stream.getsampwidth(), stream.getframerate()) == (2, 2, 44100),
            "score source must be stereo, 16-bit PCM, 44.1 kHz")
    require(90 <= stream.getnframes() / stream.getframerate() <= 110, "unexpected score duration")

source_dir = PROJECT / "Source" / "ShiftLeft"
for class_name in ("SLGameMode", "SLPatchCharacter", "SLDeliveryWorld", "SLGameHUD"):
    for extension in ("h", "cpp"):
        require((source_dir / f"{class_name}.{extension}").is_file(), f"missing {class_name}.{extension}")
    header = (source_dir / f"{class_name}.h").read_text()
    includes = re.findall(r'^#include\s+"([^"]+)"', header, re.MULTILINE)
    require(includes and includes[-1] == f"{class_name}.generated.h", f"UHT include must be last in {class_name}.h")

input_config = (PROJECT / "Config" / "DefaultInput.ini").read_text()
character_source = (source_dir / "SLPatchCharacter.cpp").read_text()
for binding_type, binding_name in re.findall(r'Bind(Action|Axis)\(TEXT\("([^"]+)"\)', character_source):
    require(f'{binding_type}Name="{binding_name}"' in input_config,
            f"input binding {binding_name} has no config mapping")

engine_config = (PROJECT / "Config" / "DefaultEngine.ini").read_text()
packaging_config = (PROJECT / "Config" / "DefaultGame.ini").read_text()
require("GameDefaultMap=/Game/Maps/DeliveryGrid" in engine_config, "default map does not match bootstrap")
for content in ("Art", "Audio"):
    require(f'DirectoriesToAlwaysCook=(Path="/Game/{content}")' in packaging_config,
            f"dynamically loaded {content} may be excluded from cooking")

print(f"Source preflight passed: {len(assets)} FBX inputs, stereo score, module targets, native inputs and cook paths.")
print("This source preflight does not compile or run Unreal. See the platform handoff for native verification results.")
