"""Round-trip exported FBX dimensions through Blender's independent importer."""
import bpy
import os
import json
from mathutils import Vector
from io_scene_fbx import parse_fbx

HERE=os.path.dirname(os.path.abspath(__file__))
manifest=json.load(open(os.path.join(HERE,'asset_manifest.json')))
results={}
for name, spec in manifest['assets'].items():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    path=os.path.abspath(os.path.join(HERE,'../ShiftLeft/Content/ArtSource',spec['file']))
    # The file itself stores centimeters, making UE ImportUniformScale=1 safe.
    root,_=parse_fbx.parse(path)
    unit=None
    for el in root.elems:
        if el.id==b'GlobalSettings':
            for prop in el.elems:
                if prop.id==b'Properties70':
                    for p in prop.elems:
                        if p.id==b'P' and p.props[0]==b'UnitScaleFactor':
                            unit=p.props[-1]
    assert unit==1.0,(name,'Expected FBX centimeter metadata',unit)
    bpy.ops.import_scene.fbx(filepath=path,use_anim=False)
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    assert len(meshes)==1,(name,'Expected one consolidated static mesh',len(meshes))
    o=meshes[0]
    assert o.location.length<.001,(name,'Exported mesh origin must be local zero',list(o.location))
    got=list(o.dimensions)
    assert all(abs(a-b)<.002 for a,b in zip(got,spec['dimensions_m'])),(name,got,spec['dimensions_m'])
    assert all(len(p.vertices)==3 for p in o.data.polygons),(name,'Expected triangulated FBX')
    slots=[m.name for m in o.data.materials]
    assert len(slots)==len(spec['materials']),(name,'Material slot mismatch',slots)
    results[name]={'dimensions_m':[round(v,4) for v in got],
       'triangles':len(o.data.polygons),'material_slots':len(slots),
       'fbx_unit_scale_cm':unit,'bytes':os.path.getsize(path),'status':'PASS'}
with open(os.path.join(HERE,'verification.json'),'w') as f:
    json.dump(results,f,indent=2)
print('SHIFT_LEFT_FBX_VERIFIED '+json.dumps(results))
