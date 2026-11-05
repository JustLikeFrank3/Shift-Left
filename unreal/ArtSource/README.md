# Original SHIFT LEFT art

`preview.png` is a Blender look-development render using the exported assets. It is **not an Unreal gameplay screenshot** and does not demonstrate native lighting, animation or performance.

All models, procedural materials and scene layout were authored for this project with AI coding assistance. No external meshes or textures were downloaded. The parent repository license applies to this original source. The existing music has separate provenance in `public/audio/README.md`.

Rebuild with Blender 4.3 or later:

```bash
blender --background --factory-startup --python generate_art.py -- --skip-render
blender --background --factory-startup --python verify_exports.py
```

Run these commands from this directory. Omit `-- --skip-render` to also render `preview.png`; rendering can take several minutes. `SHIFT_LEFT_ArtSource.blend` is the saved editable source scene. The generator targets `../ShiftLeft/Content/ArtSource/` directly. The committed preview is an 800×450 composition render; the generator is configured for 1600×900.

Models use meters in Blender, front −Y and up +Z. FBX geometry is baked to centimeters with `UnitScaleFactor=1`; Unreal's import scale should be 1. The full PATCH model is retained as a fallback. Five separate PATCH body/limb assets carry local shoulder/hip pivots for procedural animation; their assembly offsets appear in `asset_manifest.json`.

`verification.json` records FBX round trips through Blender's importer. The seven original exports were checked for dimensions, material slots, triangulation and centimeter metadata. Native engine import and the five later articulated parts still require further verification; an FBX header check alone does not establish correct pivots or animation in Unreal.

The corridor modules are available as source assets for later set dressing. The initial native world currently constructs its deck and structural geometry in C++; it imports PATCH, DOC, racks and terminals. The look-development composition is an art target rather than a promise of identical in-game framing.
