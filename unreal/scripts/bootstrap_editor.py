"""Run inside UE5 Editor after compiling the ShiftLeft module (not system Python).

Creates original materials, imports generated FBX props, and saves the play map.
The source assets and native actor remain inspectable; this is not a cooked build.
"""
from pathlib import Path
import json
import traceback
import unreal

PROJECT = Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir()))
ART_SOURCE = PROJECT / "Content" / "ArtSource"
ART_ROOT = "/Game/Art"
MATERIAL_ROOT = ART_ROOT + "/Materials"
MAP_PATH = "/Game/Maps/DeliveryGrid"
SUCCESS_MARKER = PROJECT / "Saved" / "ShiftLeft" / "bootstrap-success.json"
COLORS = {
    "M_Navy": ((0.025, 0.075, 0.115), 0.35, 0.34, 0),
    "M_Panel": ((0.065, 0.16, 0.20), 0.45, 0.31, 0),
    "M_Metal": ((0.20, 0.32, 0.36), 0.72, 0.28, 0),
    "M_Mint": ((0.12, 0.9, 0.56), 0.2, 0.32, 2.0),
    "M_Cyan": ((0.035, 0.54, 0.85), 0.2, 0.28, 2.0),
    "M_Coral": ((1.0, 0.13, 0.16), 0.1, 0.32, 2.0),
    "M_White": ((0.69, 0.82, 0.82), 0.15, 0.44, 0),
    "M_Dark": ((0.004, 0.012, 0.021), 0.3, 0.25, 0),
    "M_Paper": ((0.74, 0.81, 0.75), 0.0, 0.78, 0),
    "M_Ink": ((0.006, 0.025, 0.03), 0.0, 0.6, 0),
    "M_Rubber": ((0.012, 0.024, 0.03), 0.0, 0.88, 0),
    "M_Amber": ((1.0, 0.51, 0.055), 0.1, 0.3, 2.0),
    "M_Floor": ((0.025, 0.055, 0.075), 0.25, 0.67, 0),
}
ASSETS = {
    "SM_PATCH.fbx": "PATCH",
    "SM_DOC.fbx": "DOC",
    "SM_ServerRack.fbx": "ServerRack",
    "SM_RepairTerminal.fbx": "Terminal",
    "SM_PATCH_Body.fbx": "PATCH_Body",
    "SM_PATCH_Arm_L.fbx": "PATCH_Arm_L",
    "SM_PATCH_Arm_R.fbx": "PATCH_Arm_R",
    "SM_PATCH_Leg_L.fbx": "PATCH_Leg_L",
    "SM_PATCH_Leg_R.fbx": "PATCH_Leg_R",
}


def scalar(material, value):
    node = unreal.MaterialEditingLibrary.create_material_expression(
        material, unreal.MaterialExpressionConstant
    )
    node.set_editor_property("r", value)
    return node


def vector(material, color):
    node = unreal.MaterialEditingLibrary.create_material_expression(
        material, unreal.MaterialExpressionConstant3Vector
    )
    node.set_editor_property("constant", unreal.LinearColor(*color, 1.0))
    return node


def make_material(name, values):
    color, metallic, roughness, emission = values
    path = f"{MATERIAL_ROOT}/{name}"
    material = unreal.EditorAssetLibrary.load_asset(path)
    if material is None:
        material = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
            name, MATERIAL_ROOT, unreal.Material, unreal.MaterialFactoryNew()
        )
        base = vector(material, color)
        unreal.MaterialEditingLibrary.connect_material_property(
            base, "", unreal.MaterialProperty.MP_BASE_COLOR
        )
        for value, prop in [(metallic, unreal.MaterialProperty.MP_METALLIC),
                            (roughness, unreal.MaterialProperty.MP_ROUGHNESS)]:
            unreal.MaterialEditingLibrary.connect_material_property(scalar(material, value), "", prop)
        if emission:
            emissive = vector(material, tuple(c * emission for c in color))
            unreal.MaterialEditingLibrary.connect_material_property(
                emissive, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR
            )
        unreal.MaterialEditingLibrary.recompile_material(material)
        unreal.EditorAssetLibrary.save_loaded_asset(material)
    return material


def import_mesh(filename, asset_name, materials):
    source = ART_SOURCE / filename
    if not source.is_file():
        raise RuntimeError(f"Required original FBX is missing: {source}")
    options = unreal.FbxImportUI()
    options.set_editor_property("import_mesh", True)
    options.set_editor_property("import_materials", False)
    options.set_editor_property("import_textures", False)
    options.set_editor_property("import_as_skeletal", False)
    options.set_editor_property("mesh_type_to_import", unreal.FBXImportType.FBXIT_STATIC_MESH)
    options.static_mesh_import_data.set_editor_property("combine_meshes", True)
    options.static_mesh_import_data.set_editor_property("convert_scene", True)
    options.static_mesh_import_data.set_editor_property("convert_scene_unit", True)
    task = unreal.AssetImportTask()
    task.set_editor_property("filename", str(source))
    task.set_editor_property("destination_path", ART_ROOT)
    task.set_editor_property("destination_name", asset_name)
    task.set_editor_property("automated", True)
    task.set_editor_property("replace_existing", True)
    task.set_editor_property("save", True)
    task.set_editor_property("options", options)
    # UE5.8 may otherwise dispatch FBX to Interchange and ignore FbxImportUI.
    task.set_editor_property("factory", unreal.FbxFactory())
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
    mesh = unreal.EditorAssetLibrary.load_asset(f"{ART_ROOT}/{asset_name}")
    if not isinstance(mesh, unreal.StaticMesh):
        raise RuntimeError(f"FBX did not import as a static mesh: {asset_name}")
    for index, slot in enumerate(mesh.get_editor_property("static_materials")):
        slot_name = str(slot.material_slot_name)
        match = next((name for name in materials if slot_name == name or slot_name.startswith(name + ".")), None)
        if match:
            mesh.set_material(index, materials[match])
    unreal.EditorAssetLibrary.save_loaded_asset(mesh)
    return mesh


def import_music():
    source = PROJECT / "Content" / "AudioSource" / "SignalInTheDark.wav"
    if not source.is_file():
        raise RuntimeError(f"Required original score source is missing: {source}")
    unreal.EditorAssetLibrary.make_directory("/Game/Audio")
    task = unreal.AssetImportTask()
    task.set_editor_property("filename", str(source))
    task.set_editor_property("destination_path", "/Game/Audio")
    task.set_editor_property("destination_name", "SignalInTheDark")
    task.set_editor_property("automated", True)
    task.set_editor_property("replace_existing", True)
    task.set_editor_property("save", True)
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
    sound = unreal.EditorAssetLibrary.load_asset("/Game/Audio/SignalInTheDark")
    if not isinstance(sound, unreal.SoundWave):
        raise RuntimeError("Score did not import as a SoundWave.")
    sound.set_editor_property("looping", True)
    unreal.EditorAssetLibrary.save_loaded_asset(sound)


def main():
    unreal.EditorAssetLibrary.make_directory(ART_ROOT)
    unreal.EditorAssetLibrary.make_directory(MATERIAL_ROOT)
    unreal.EditorAssetLibrary.make_directory("/Game/Maps")
    materials = {name: make_material(name, values) for name, values in COLORS.items()}
    for filename, name in ASSETS.items():
        import_mesh(filename, name, materials)
    import_music()
    world_class = unreal.load_class(None, "/Script/ShiftLeft.SLDeliveryWorld")
    game_class = unreal.load_class(None, "/Script/ShiftLeft.SLGameMode")
    if world_class is None or game_class is None:
        raise RuntimeError("Build ShiftLeftEditor before running this bootstrap.")
    level_subsystem = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    # build-linux.sh copies Content/Maps to Saved/ContentBackups before this runs.
    if unreal.EditorAssetLibrary.does_asset_exist(MAP_PATH):
        if not unreal.EditorAssetLibrary.delete_asset(MAP_PATH):
            raise RuntimeError("Could not replace the existing delivery-grid level.")
    if not level_subsystem.new_level(MAP_PATH):
        raise RuntimeError("Could not create the delivery-grid level.")
    actor_subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    actor = actor_subsystem.spawn_actor_from_class(world_class, unreal.Vector(0, 0, 0))
    if actor is None:
        raise RuntimeError("Could not spawn the native delivery-grid actor.")
    actor.set_actor_label("SHIFT LEFT / Delivery Grid")
    # Clear of the deck (top at Z=0) so the default pawn never spawns inside it.
    start = actor_subsystem.spawn_actor_from_class(
        unreal.PlayerStart, unreal.Vector(2220, 0, 112), unreal.Rotator(0, 0, 0)
    )
    if start is None:
        raise RuntimeError("Could not place the PATCH player start.")
    start.set_actor_label("PATCH Start / PRODUCTION")
    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    world.get_world_settings().set_editor_property("default_game_mode", game_class)
    unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
    if not level_subsystem.save_current_level():
        raise RuntimeError("Could not save the delivery-grid level.")
    SUCCESS_MARKER.parent.mkdir(parents=True, exist_ok=True)
    SUCCESS_MARKER.write_text(json.dumps({"map": MAP_PATH, "music": "/Game/Audio/SignalInTheDark"}))
    unreal.log("SHIFT LEFT bootstrap complete. Open /Game/Maps/DeliveryGrid and press Play.")


if __name__ == "__main__":
    SUCCESS_MARKER.unlink(missing_ok=True)
    try:
        main()
    except Exception:
        unreal.log_error(traceback.format_exc())
        raise
    finally:
        # Editor Python failures do not consistently produce a nonzero process
        # exit code. The shell also checks the newly created success marker.
        unreal.SystemLibrary.quit_editor()
