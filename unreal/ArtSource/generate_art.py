"""SHIFT LEFT original art source. Blender 4.3+, no third-party assets.

Run: blender --background --factory-startup --python generate_art.py
Pass -- --skip-render to rebuild assets without the look-development still.
Meters in source; FBX meshes are explicitly baked to centimeters (UnitScaleFactor 1).
"""
import bpy
import math
import random
import os
import json
import sys
import shutil
from mathutils import Vector

random.seed(2026)
HERE = os.path.dirname(os.path.abspath(__file__))
CONTENT = os.path.abspath(os.path.join(HERE, '../ShiftLeft/Content/ArtSource'))
EXPORT = CONTENT
PREVIEW = HERE
for folder in (EXPORT, CONTENT, PREVIEW):
    os.makedirs(folder, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for old in bpy.data.materials:
    bpy.data.materials.remove(old)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1.0
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.eevee.taa_render_samples = 32
scene.cycles.device = 'CPU'
scene.cycles.samples = 64
# Debian CPU Blender lacks OpenImageDenoise; adaptive sampling is deterministic.
scene.cycles.use_denoising = False
scene.cycles.adaptive_threshold = .035
scene.cycles.max_bounces = 7
scene.cycles.transparent_max_bounces = 3
scene.render.threads_mode = 'FIXED'
scene.render.threads = 5
scene.render.resolution_x = 1600
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = 0.20

def material(name, color, metal=0.0, rough=.4, emission=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bs = mat.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Metallic'].default_value = metal
    bs.inputs['Roughness'].default_value = rough
    if emission:
        bs.inputs['Emission Color'].default_value = (*color, 1)
        bs.inputs['Emission Strength'].default_value = emission
    return mat

M = {
 'Navy': material('M_Navy', (.018, .079, .119), .6, .28),
 'Panel': material('M_Panel', (.046, .145, .178), .5, .34),
 'Metal': material('M_Metal', (.23, .36, .4), .78, .27),
 'Dark': material('M_Dark', (.004, .013, .023), .3, .3),
 'White': material('M_White', (.73, .87, .86), .18, .29),
 'Mint': material('M_Mint', (.15, .95, .64), .2, .22, 3.6),
 'Cyan': material('M_Cyan', (.025, .64, .87), .35, .25, 2.4),
 'Coral': material('M_Coral', (.98, .15, .085), .2, .3, 2.3),
 'Amber': material('M_Amber', (1.0, .52, .1), .2, .32, 1.3),
 'Paper': material('M_Paper', (.66, .82, .77), .08, .65),
 'Ink': material('M_Ink', (.02, .19, .19), .1, .55),
 'Rubber': material('M_Rubber', (.008, .02, .025), .0, .65),
 'Floor': material('M_Floor', (.017, .038, .047), .68, .33),
}
# Subtle original procedural surface; exported slots stay simple and named.
for key in ('Navy', 'Panel', 'Metal', 'Floor'):
    mat = M[key]
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 160
    noise.inputs['Detail'].default_value = 2
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = .12
    bump.inputs['Distance'].default_value = .018
    links.new(noise.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], nodes.get('Principled BSDF').inputs['Normal'])

current = None
def collection(name):
    global current
    current = bpy.data.collections.new(name)
    scene.collection.children.link(current)
    return current

def put(obj, name, mat=None):
    obj.name = name
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    current.objects.link(obj)
    if mat:
        obj.data.materials.append(M[mat] if isinstance(mat, str) else mat)
    return obj

def smooth(obj):
    if obj.type == 'MESH':
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj

def bevel(obj, amount=.05, segments=3):
    if amount:
        mod = obj.modifiers.new('Manufactured radii', 'BEVEL')
        mod.width = amount
        mod.segments = segments
        mod = obj.modifiers.new('Weighted panel normals', 'WEIGHTED_NORMAL')
        mod.keep_sharp = True
        mod.weight = 40
    return obj

def box(name, loc, dims, mat, radius=.04, rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = put(bpy.context.object, name, mat)
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if rot:
        obj.rotation_euler = rot
    bevel(obj, radius, 4 if radius > .075 else 3)
    return obj

def sphere(name, loc, scale, mat, segments=32):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=16, radius=1, location=loc)
    obj = put(bpy.context.object, name, mat)
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return smooth(obj)

def cyl(name, loc, rad, depth, mat, vertices=32, rotation=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=rad, depth=depth, location=loc)
    obj = put(bpy.context.object, name, mat)
    if rotation:
        obj.rotation_euler = rotation
    bevel(obj, min(.02, rad*.16), 3)
    return smooth(obj)

def rod(name, a, b, rad, mat, vertices=24):
    a, b = Vector(a), Vector(b)
    obj = cyl(name, (a+b)/2, rad, (b-a).length, mat, vertices)
    obj.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    return obj

def torus(name, loc, major, minor, mat, rot=None):
    bpy.ops.mesh.primitive_torus_add(major_segments=48, minor_segments=10,
        location=loc, major_radius=major, minor_radius=minor)
    obj = put(bpy.context.object, name, mat)
    if rot:
        obj.rotation_euler = rot
    return smooth(obj)

def line(name, points, radius, mat, cyclic=False):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.resolution_u = 12
    data.bevel_depth = radius
    data.bevel_resolution = 3
    spline = data.splines.new('POLY')
    spline.points.add(len(points)-1)
    for p, co in zip(spline.points, points):
        p.co = (*co, 1)
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, data)
    current.objects.link(obj)
    data.materials.append(M[mat])
    return obj

def text(name, words, loc, size, mat, align='CENTER', rot=(math.pi/2, 0, 0), extrude=.0006):
    data = bpy.data.curves.new(name, 'FONT')
    data.body = words
    data.align_x = align
    data.align_y = 'CENTER'
    data.size = size
    data.space_character = 1.1
    data.extrude = extrude
    data.bevel_depth = .0003
    obj = bpy.data.objects.new(name, data)
    current.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = rot
    data.materials.append(M[mat])
    return obj

def arc(name, cx, y, cz, rx, rz, start, end, mat, rad):
    return line(name, [(cx+rx*math.cos(t), y, cz+rz*math.sin(t))
        for t in [start+(end-start)*i/28 for i in range(29)]], rad, mat)

def bolt(name, x,y,z, r=.026, face='front'):
    rot = (math.pi/2,0,0) if face == 'front' else None
    cyl(name, (x,y,z), r, .018, 'Metal', 8, rot)
    if face == 'front':
        box(name+' screw slot',(x,y-.011,z),(r*.8,.004,.004),'Dark',.001)

def rounded_outline(name, cx,y,cz,w,h,r,thick,mat):
    pts=[]
    for bx,bz,s in ((cx+w/2-r,cz+h/2-r,0),(cx-w/2+r,cz+h/2-r,90),
                    (cx-w/2+r,cz-h/2+r,180),(cx+w/2-r,cz-h/2+r,270)):
        for i in range(9):
            a=math.radians(s+i*90/8)
            pts.append((bx+r*math.cos(a),y,bz+r*math.sin(a)))
    return line(name,pts,thick,mat,True)

ASSETS={}
def finish_asset(name, coll, pivot=(0,0,0)):
    # Convert curves and text, evaluate bevels, consolidate named material slots.
    bpy.ops.object.select_all(action='DESELECT')
    for ob in list(coll.objects):
        if ob.type not in ('MESH','CURVE','FONT'):
            continue
        ob.select_set(True)
    bpy.context.view_layer.objects.active = next(iter(coll.objects))
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join()
    obj=bpy.context.object
    obj.name=name
    scene.cursor.location=pivot
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    # Join deduplicates shared materials. Keep original material names on the FBX.
    bpy.ops.export_scene.fbx(filepath=os.path.join(EXPORT,name+'.fbx'),
        use_selection=True, object_types={'MESH'}, use_mesh_modifiers=True,
        global_scale=1.0, apply_unit_scale=True, apply_scale_options='FBX_SCALE_NONE',
        axis_forward='-Y', axis_up='Z', bake_space_transform=False,
        mesh_smooth_type='FACE', use_triangles=True, add_leaf_bones=False,
        path_mode='AUTO', embed_textures=False, bake_anim=False)
    ASSETS[name]={
        'file':name+'.fbx', 'dimensions_m':[round(v,4) for v in obj.dimensions],
        'vertices':len(obj.data.vertices), 'polygons':len(obj.data.polygons),
        'materials':[m.name for m in obj.data.materials],
        'front':'-Y','up':'+Z','pivot_m':list(pivot),
    }
    return obj

def export_patch_segments(coll):
    """Articulated static-mesh pieces for code-driven walk / hover animation."""
    global current
    groups={'Body':[], 'Arm_L':[], 'Arm_R':[], 'Leg_L':[], 'Leg_R':[]}
    for obj in list(coll.objects):
        n=obj.name
        if n.startswith('L '):
            part='Arm_L'
        elif n.startswith('R '):
            part='Arm_R'
        elif obj.location.z < .51 and obj.type=='MESH':
            part='Leg_L' if obj.location.x<0 else 'Leg_R'
        else:
            part='Body'
        groups[part].append(obj)
    pivots={'Body':(0,0,0),'Arm_L':(-.46,0,.94),'Arm_R':(.46,0,.94),
            'Leg_L':(-.23,0,.54),'Leg_R':(.23,0,.54)}
    for part,originals in groups.items():
        sub=collection('ANIMATION_PATCH_'+part)
        for ob in originals:
            dup=ob.copy()
            dup.data=ob.data.copy()
            sub.objects.link(dup)
        piece=finish_asset('SM_PATCH_'+part,sub,pivots[part])
        # Store mesh vertices relative to the shoulder/hip; component placement is manifest pivot.
        piece.location=(0,0,0)
        bpy.ops.object.select_all(action='DESELECT')
        piece.select_set(True)
        bpy.context.view_layer.objects.active=piece
        bpy.ops.export_scene.fbx(filepath=os.path.join(EXPORT,piece.name+'.fbx'),
            use_selection=True,object_types={'MESH'},global_scale=1.0,
            apply_unit_scale=True,apply_scale_options='FBX_SCALE_NONE',
            axis_forward='-Y',axis_up='Z',mesh_smooth_type='FACE',use_triangles=True,
            bake_anim=False,add_leaf_bones=False)
        ASSETS[piece.name]['component_placement_cm']=[v*100 for v in pivots[part]]
        sub.hide_render=True
        sub.hide_viewport=True
    current=coll

collection('ASSET_PATCH')
# PATCH: substantial radiused shell, inset visor, maintenance layers and soft hands.
box('Boot sole L',(-.23,-.02,.08),(.34,.49,.14),'Rubber',.065)
box('Boot sole R',(.23,-.02,.08),(.34,.49,.14),'Rubber',.065)
for s in (-1,1):
    box('Porcelain toe',(.23*s,-.06,.19),(.33,.46,.22),'White',.085)
    box('Toe indicator',(.23*s,-.292,.205),(.18,.012,.025),'Cyan',.008)
    cyl('Ankle piston',(.23*s,.01,.34),.10,.22,'Metal')
    torus('Ankle seal',(.23*s,.01,.32),.105,.024,'Rubber')
    box('Shin armor',(.23*s,-.08,.41),(.23,.22,.21),'Navy',.06)
    sphere('Hip bearing',(.23*s,.01,.54),(.13,.13,.13),'Dark')
box('Torso lower shell',(0,.015,.73),(.76,.47,.62),'Navy',.13)
box('Torso inset face',(0,-.238,.76),(.65,.055,.46),'Panel',.10)
rounded_outline('Torso seam',0,-.27,.76,.63,.43,.08,.009,'Metal')
box('Chest porcelain crest',(-.196,-.285,.84),(.135,.018,.21),'White',.025)
text('Tiny serial','P7',(-.196,-.298,.84),.058,'Navy')
box('Chest core shadow',(.112,-.276,.77),(.36,.023,.30),'Dark',.045)
line('Code left',[(.071,-.299,.86),(-.005,-.299,.77),(.071,-.299,.68)],.018,'Mint')
line('Code right',[(.153,-.299,.86),(.230,-.299,.77),(.153,-.299,.68)],.018,'Mint')
text('Chest serial','PATCH  /  07',(0,-.285,.563),.038,'White')
for x in (-.267,.267):
    bolt('Chest bolt',x,-.28,.925,.018)
for i in range(4):
    box('Chest service slots',(-.19+i*.053,-.283,.63),(.026,.01,.016),'Dark',.005)
cyl('Neck piston',(0,.02,1.13),.14,.21,'Metal')
torus('Neck gimbal',(0,.02,1.13),.147,.028,'Rubber')
box('Back battery',(0,.26,.79),(.46,.2,.39),'Dark',.075)
for x in (-.15,.15):
    box('Battery rail',(x,.38,.8),(.04,.04,.26),'Cyan',.01)
# Oversized friendly head, front facing -Y.
box('Head shell',(0,0,1.53),(1.23,.78,.91),'Navy',.23)
box('Head face bezel',(0,-.367,1.55),(1.12,.105,.74),'Metal',.18)
box('Cyan visor gasket',(0,-.423,1.55),(1.075,.025,.697),'Cyan',.165)
box('Visor black glass',(0,-.447,1.565),(1.015,.055,.627),'Dark',.15)
box('Brow porcelain mark',(0,-.385,1.95),(.24,.03,.035),'White',.012)
for s in (-1,1):
    # Two happy crescent eyes preserve the SVG identity.
    arc('Happy mint eye',.256*s,-.485,1.62,.112,.095,0,math.pi,'Mint',.026)
    sphere('Cheek light',(.38*s,-.484,1.48),(.027,.012,.016),'Cyan',20)
    cyl('Ear dark hub',(.637*s,0,1.55),.17,.09,'Dark',32,(0,math.pi/2,0))
    cyl('Ear ring',(.69*s,0,1.55),.128,.045,'Cyan',32,(0,math.pi/2,0))
    cyl('Ear center',(.715*s,0,1.55),.084,.05,'Navy',24,(0,math.pi/2,0))
    for i in range(3):
        box('Temple vent',(.594*s,.12+i*.07,1.6),(.025,.038,.15),'Dark',.01)
arc('Smile',0,-.485,1.48,.122,.083,math.pi,2*math.pi,'White',.016)
text('Visor micro branding','SL // ENGINEERING',(.02,-.479,1.326),.027,'Metal')
for s in (-1,1):
    bolt('Visor screw',.444*s,-.465,1.786,.014)
rod('Antenna stalk',(.055,.04,1.96),(.10,.04,2.19),.024,'Metal')
torus('Antenna base',(.055,.04,1.977),.072,.018,'Dark')
sphere('Antenna signal',(.10,.04,2.22),(.074,.074,.074),'Mint')
# A relaxed arm and a curious outstretched greeting arm; modeled as physical joints.
for side, shoulder, elbow, wrist in [
    ('L',(-.46,0,.94),(-.70,-.02,.71),(-.74,-.16,.52)),
    ('R',(.46,0,.94),(.74,-.015,1.03),(.86,-.12,1.31))]:
    sphere(side+' shoulder',shoulder,(.125,.13,.13),'Dark')
    rod(side+' upper arm',shoulder,elbow,.092,'White')
    sphere(side+' elbow',elbow,(.115,.12,.115),'Metal')
    rod(side+' forearm',elbow,wrist,.105,'Navy')
    sphere(side+' wrist',wrist,(.087,.085,.085),'Cyan')
    hand=(wrist[0]+(.015 if side=='R' else -.015),wrist[1]-.02,wrist[2]+(.1 if side=='R' else -.10))
    sphere(side+' mitt',hand,(.133,.09,.13),'White')
    for i in range(3):
        z=hand[2]+(.10 if side=='R' else -.095)
        sphere(side+' fingertip',(hand[0]+(i-1)*.07,hand[1],z),(.043,.065,.072),'White',20)
    sphere(side+' thumb',(hand[0]-.12,hand[1]-.01,hand[2]),(.068,.068,.058),'White',20)
patch_collection=current
export_patch_segments(patch_collection)
PATCH=finish_asset('SM_PATCH',patch_collection)

collection('ASSET_DOC')
# DOC is an open, physical field-guide with a dark friendly face on its pages.
for side in (-1,1):
    angle=math.radians(side*12)
    # Individually built page stacks preserve visible layered fore-edges.
    for k in range(7):
        page=box('DOC page layer',(.30*side,-.018-k*.011,.59),(.58,.014,.81),
            'Paper' if k%2==0 else 'White',.023,rot=(0,0,angle))
    box('DOC cover',(.30*side,.058,.58),(.63,.07,.91),'Navy',.055,rot=(0,0,angle))
    box('DOC cover metal heel',(.54*side,-.005,.18),(.14,.12,.055),'Metal',.018,rot=(0,0,angle))
    # The turquoise edges read as a book silhouette even at gameplay size.
    line('DOC cover edge',[(.018*side,-.085,.17),(.56*side,-.19,.17),
        (.61*side,-.19,.21),(.61*side,-.19,.96),(.57*side,-.19,1.0),(.025*side,-.085,1.0)],.015,'Mint')
    for i in range(4):
        line('DOC page rules',[(.14*side,-.114,.34+i*.055),(.48*side,-.175,.34+i*.055)],.006,'Ink')
    line('DOC margin glyph',[(.42*side,-.179,.84),(.50*side,-.193,.88),(.54*side,-.2,.84)],.009,'Cyan')
cyl('DOC binding',(0,.026,.58),.064,.90,'Metal')
for z in (.24,.39,.78,.94):
    torus('DOC binding ring',(0,.025,z),.073,.011,'Cyan')
box('DOC friendly screen',(0,-.162,.635),(.83,.08,.355),'Dark',.105)
rounded_outline('DOC screen rim',0,-.205,.635,.84,.36,.1,.008,'Panel')
for side in (-1,1):
    sphere('DOC eye',(.19*side,-.212,.68),(.033,.014,.045),'Mint')
    arc('DOC brow',.19*side,-.212,.753,.05,.018,.2,2.7,'Cyan',.008)
arc('DOC smile',0,-.212,.61,.083,.047,math.pi,2*math.pi,'White',.009)
box('DOC bookmark',(.39,.025,.115),(.095,.025,.24),'Coral',.01)
text('DOC title','D O C',(0,-.106,.917),.064,'Navy')
# Tiny anti-gravity keel and stabilizer loops; levitation is a game effect.
sphere('DOC lift motor',(0,.04,.112),(.16,.14,.085),'Navy')
torus('DOC floating loop',(0,.02,.045),.205,.014,'Cyan')
line('DOC code rune',[(-.04,-.107,.875),(0,-.115,.91),(.04,-.107,.875),(0,-.115,.84),(-.04,-.107,.875)],.01,'Mint')
DOC=finish_asset('SM_DOC',current)

collection('ASSET_SERVER_RACK')
box('Rack plinth',(0,0,.10),(1.12,.81,.2),'Rubber',.035)
box('Rack outer body',(0,.03,1.35),(1.05,.70,2.55),'Navy',.075)
box('Rack face recess',(0,-.335,1.36),(.88,.04,2.28),'Dark',.025)
for x in (-.48,.48):
    box('Extruded rack rail',(x,-.37,1.35),(.065,.095,2.49),'Metal',.018)
    for z in (.26,.66,1.06,1.46,1.86,2.46):
        bolt('Rail fastener',x,-.424,z,.020)
for i in range(7):
    z=.39+i*.292
    box('Server blade',(0,-.375,z),(.78,.13,.245),'Panel',.021)
    box('Blade handle',(-.31,-.46,z),(.08,.045,.14),'Metal',.012)
    for j in range(9):
        box('Blade vent',(-.20+j*.049,-.446,z+.035),(.023,.012,.065),'Dark',.004)
    for j in range(3):
        sphere('Blade indicator',(.20+j*.06,-.455,z-.065),(.014,.008,.014),'Mint' if j<2 else 'Amber',12)
    text('Blade serial',f'{i+1:02d}',(-.13,-.453,z-.07),.040,'White')
box('Rack crown',(0,-.355,2.57),(.85,.08,.16),'Dark',.024)
text('Rack crown title','ARTIFACT / 26',(0,-.402,2.57),.068,'White')
for x in (-.38,.38):
    box('Rack status spine',(x,-.432,1.38),(.013,.02,2.08),'Cyan',.004)
# Side cooling cassettes are visible at three-quarter angles.
for z in (.62,1.24,1.86):
    cyl('Cooling housing',(.543,.05,z),.225,.025,'Dark',32,(0,math.pi/2,0))
    torus('Cooling rim',(.565,.05,z),.193,.022,'Metal',(0,math.pi/2,0))
    for angle in range(0,360,60):
        a=math.radians(angle)
        box('Fan impeller',(.566,.05+.09*math.sin(a),z+.09*math.cos(a)),(.015,.07,.21),'Panel',.01,rot=(a,0,0))
    cyl('Fan axle',(.577,.05,z),.053,.04,'Metal',20,(0,math.pi/2,0))
for x in (-.2,.2):
    line('Rack service cables',[(x,.36,.4),(x+.03,.43,.9),(x-.05,.43,1.7),(x,.39,2.4)],.03,'Rubber')
SERVER=finish_asset('SM_ServerRack',current)

collection('ASSET_REPAIR_TERMINAL')
box('Terminal foot',(0,0,.08),(.88,.76,.16),'Dark',.07)
box('Terminal pedestal',(0,.08,.57),(.51,.45,.98),'Navy',.09)
box('Terminal spine',(0,.30,.72),(.30,.10,1.23),'Metal',.03)
for x in (-.16,.16):
    box('Pedestal stripe',(x,-.155,.48),(.018,.02,.64),'Cyan',.005)
box('Terminal console',(0,-.06,1.16),(1.02,.69,.21),'Panel',.075)
box('Terminal lip',(0,-.387,1.18),(.94,.055,.12),'Metal',.025)
for i in range(10):
    box('Control key',(-.31+(i%5)*.105,-.18+(i//5)*.11,1.277),(.077,.07,.018),'Dark',.009)
cyl('Confirm rotary',(.33,-.17,1.286),.075,.035,'Mint')
box('Screen back',(0,.13,1.63),(1.05,.19,.74),'Navy',.10)
box('Screen surround',(0,.018,1.63),(.95,.055,.65),'Metal',.065)
box('Display glass',(0,-.016,1.63),(.87,.025,.57),'Dark',.055)
text('Terminal status','REPAIR / SOURCE',(-.35,-.035,1.84),.060,'Mint','LEFT')
text('Terminal heading','LOCAL TRACE',(-.35,-.035,1.72),.043,'White','LEFT')
for i in range(4):
    box('Screen log trace',(-.08,-.035,1.60-i*.052),(.53-i*.07,.009,.012),'Cyan' if i<2 else 'Panel',.003)
for i in range(5):
    cyl('Pipeline node',(-.31+i*.155,-.044,1.405),.027,.012,'Mint' if i==0 else 'Cyan',20,(math.pi/2,0,0))
text('Pedestal warning','SHIFT LEFT',(0,-.165,.77),.064,'White')
text('Pedestal serial','AUTHORIZED REPAIR',(0,-.165,.68),.026,'Metal')
for x in (-.40,.40):
    bolt('Terminal screen bolt',x,-.018,1.855,.017)
line('Terminal conduit',[(.31,.18,.2),(.42,.33,.27),(.42,.34,.83),(.31,.24,1.14)],.027,'Rubber')
TERMINAL=finish_asset('SM_RepairTerminal',current)

collection('ASSET_FLOOR')
box('Floor cassette',(0,0,-.13),(4,3,.26),'Navy',.025)
box('Walk surface',(0,0,.013),(3.72,2.80,.055),'Floor',.015)
for x in (-1.76,1.76):
    box('Floor gutter',(x,0,.048),(.23,2.72,.035),'Dark',.008)
    for j in range(16):
        box('Gutter bridge',(x,-1.25+j*.166,.073),(.21,.032,.016),'Metal',.003)
for y in (-1.42,1.42):
    box('Floor seam',(0,y,.023),(3.72,.025,.018),'Metal',.003)
for x in (-1.38,1.38):
    for y in (-1.10,1.10):
        cyl('Floor pin',(x,y,.052),.035,.014,'Metal',8)
for x in (-1.97,1.97):
    box('Guide light',(x,0,.013),(.025,2.5,.025),'Cyan',.007)
FLOOR=finish_asset('SM_CorridorFloor',current)

collection('ASSET_WALL')
box('Wall structural slab',(0,.12,1.7),(3,.24,3.4),'Navy',.035)
box('Wall raised panel',(0,-.035,1.75),(2.79,.12,2.87),'Panel',.04)
box('Wall inset',(0,-.105,1.94),(2.42,.045,2.01),'Dark',.04)
for x in (-1.35,1.35):
    box('Wall buttress',(x,-.21,1.7),(.17,.34,3.4),'Metal',.03)
    for z in (.3,1.7,3.12):
        bolt('Wall anchor',x,-.39,z,.036)
for z in (.55,2.95):
    box('Panel horizontal rib',(0,-.17,z),(2.45,.13,.075),'Navy',.02)
for i in range(5):
    box('Wall vent',(0,-.16,.82+i*.11),(1.88,.09,.045),'Panel',.01)
line('Conduit tracing',[(-1.05,-.17,2.54),(-.8,-.17,2.54),(-.56,-.17,2.32),(.72,-.17,2.32),(1.06,-.17,2.62)],.027,'Cyan')
box('Service access',(0,-.20,1.77),(.85,.10,.70),'Navy',.045)
text('Service typography','S / L',(0,-.26,1.83),.14,'White')
text('Service serial','UTILITY 026',(0,-.26,1.63),.057,'Metal')
WALL=finish_asset('SM_CorridorWall',current)

collection('ASSET_OVERHEAD')
for x in (-3.75,3.75):
    box('Arch column',(x,0,2.4),(.27,.35,4.8),'Metal',.04)
    box('Arch boot',(x,0,.45),(.46,.52,.9),'Navy',.045)
    box('Arch inner light',(x-0.15*(1 if x>0 else -1),-.19,2.65),(.03,.04,2.2),'Cyan',.006)
box('Overhead beam',(0,0,4.8),(7.75,.38,.31),'Metal',.04)
for x in (-2.0,0,2.0):
    box('Overhead luminaire',(x,-.1,4.59),(1.1,.35,.09),'Dark',.03)
    box('Overhead luminous diffuser',(x,-.12,4.532),(.88,.23,.018),'White',.012)
for s in (-1,1):
    line('Arch angled brace',[(3.7*s,0,3.9),(3.2*s,0,4.7),(2.8*s,0,4.8)],.11,'Navy')
ARCH=finish_asset('SM_CorridorArch',current)

manifest={
    'project':'SHIFT LEFT — original art, 2026',
    'generator':'generate_art.py / Blender 4.3.2',
    'unit_convention':'Source meters; FBX applies unit scale 100 to mesh geometry, UnitScaleFactor=1 centimeter. Import uniform scale 1.0 in Unreal.',
    'assets':ASSETS,
    'palette':{m.name:{'base_color':list(m.diffuse_color[:3]),
        'metallic':m.node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value,
        'roughness':m.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value,
        'emission_strength':m.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value}
        for m in M.values()},
    'provenance':'All geometry, typography, procedural surfacing and layout created in this generator. No downloaded meshes, textures, fonts or third-party media.',
    'preview':'Blender look-development concept; not an Unreal Engine screenshot.'
}
with open(os.path.join(HERE,'asset_manifest.json'),'w') as f:
    json.dump(manifest,f,indent=2)
shutil.copy2(os.path.join(HERE,'asset_manifest.json'),os.path.join(CONTENT,'asset_manifest.json'))

# LOOK DEVELOPMENT: the same exported meshes in a cinematic industrial delivery grid.
collection('LOOKDEV_SET')
def instance(source, name, loc, rot=0, scale=1):
    obj=source.copy()
    obj.data=source.data
    current.objects.link(obj)
    obj.name=name
    obj.location=loc
    obj.rotation_euler=(0,0,rot)
    obj.scale=(scale,)*3
    return obj

# Original asset objects form the foreground hero grouping.
PATCH.location=(-1.0,-.55,0)
PATCH.rotation_euler.z=math.radians(-8)
DOC.location=(.53,-.32,1.57)
DOC.rotation_euler.z=math.radians(8)
DOC.scale=(1.1,)*3
SERVER.location=(-3.12,2.9,0)
SERVER.rotation_euler.z=math.radians(-8)
TERMINAL.location=(2.35,.70,0)
TERMINAL.rotation_euler.z=math.radians(12)
# Move the source modular parts into the corridor, duplicate by linked geometry.
FLOOR.location=(-2,0,0)
for x in (-2,2):
    for y in (-3,0,3,6,9,12,15):
        if (x,y)==(-2,0):continue
        instance(FLOOR,'Floor module', (x,y,0))
WALL.location=(-4,0,0)
WALL.rotation_euler.z=math.pi/2
for side in (-1,1):
    for y in (0,3,6,9,12,15):
        if side==-1 and y==0:continue
        instance(WALL,'Wall module', (4*side,y,0),math.pi/2 if side<0 else -math.pi/2)
ARCH.location=(0,3,0)
for y in (-3,6,9,12,15):
    instance(ARCH,'Structural rib',(0,y,0))
for x,y,rot in ((3.3,4.8,0),(-3.2,7.4,0),(3.25,9,0),(-3.25,13,0)):
    instance(SERVER,'Background artifact rack',(x,y,0),rot)
# Dense ceiling cable tray and flanged pipes create scale, contact shadows and rhythm.
for x,rad,mat in ((-2.72,.14,'Metal'),(-2.32,.11,'Panel'),(2.85,.19,'Panel'),(3.25,.09,'Metal')):
    rod('Trunk pipe',(x,-4,4.34),(x,17,4.34),rad,mat,32)
    for y in (-2,1,4,7,10,13,16):
        torus('Pipe flange',(x,y,4.34),rad*1.18,.028,'Metal',(math.pi/2,0,0))
        box('Pipe hanger',(x,y,4.63),(.06,.07,.35),'Dark',.008)
for j in range(5):
    x=-1.6+j*.115
    line('Overhead braided cable',[(x,-4,4.46),(x,0,4.39),(x,3,4.43),(x,6,4.37),(x,10,4.44),(x,17,4.42)],.032,'Rubber')
for y in range(-3,17,2):
    box('Cable ladder rail',(-1.36,y,4.35),(.78,.08,.06),'Metal',.01)
# A round service pad puts PATCH in a deliberate pool of warm/cool light.
cyl('Foreground service dais',(-1,-.55,-.015),1.18,.10,'Dark',96)
torus('Dais mint marking',(-1,-.55,.045),1.03,.013,'Cyan')
for a in range(0,360,30):
    r=math.radians(a)
    box('Dais radial marker',(-1+1.10*math.cos(r),-.55+1.10*math.sin(r),.043),(.08,.025,.008),'White',.003,rot=(0,0,r))
# Art direction: hazardous production gate far away, repair route moves left.
box('Far bulkhead',(0,16.9,2.45),(8,.4,4.9),'Dark',.05)
for x in (-1.22,1.22):
    box('Gate wing',(x,16.64,2.0),(2.35,.2,3.8),'Panel',.05)
    box('Gate hazard light',(x*1.91,16.5,2.0),(.055,.025,3.45),'Coral',.008)
box('Gate overhead',(0,16.45,4.15),(4.8,.3,.43),'Navy',.04)
text('Production sign','P R O D   /   0 5',(0,16.27,4.15),.24,'Coral')
box('Hanging source sign',(-1.1,4.4,3.93),(2.4,.14,.48),'Dark',.045)
text('Source sign','S O U R C E   /   0 1',(-1.1,4.314,3.96),.145,'Mint')
text('Source sign subline','REPAIR TOMORROW / TODAY',(-1.1,4.314,3.79),.054,'White')
for x in (-2.16,-.04):
    rod('Sign suspension',(x,4.4,4.18),(x,4.4,4.73),.012,'Metal')
# Floor legends follow the route through the world.
text('Floor route','SHIFT / LEFT',(.6,2.5,.052),.39,'White',rot=(0,0,0),extrude=.0003)
text('Floor route number','01  -  SOURCE',(.6,3.02,.052),.14,'Cyan',rot=(0,0,0),extrude=.0003)
for i in range(3):
    y=4.2+i*.45
    line('Floor direction arrow',[(-.20,y+.16,.055),(.02,y,.055),(-.20,y-.16,.055)],.019,'Mint')
# Original loose field-guide data fragments, sculptural light strokes not particles.
for x,y,z in ((.98,.15,1.43),(1.32,.34,1.93),(.98,.15,2.7),(-.17,.33,2.78)):
    line('Floating data glyph',[(x-.04,y,z),(x,y,z+.06),(x+.04,y,z),(x,y,z-.06),(x-.04,y,z)],.009,'Mint')
# Small maintenance debris and industrial details avoid an empty showroom.
for loc in ((-2.6,1.2,.23),(3.28,2.1,.23),(-2.9,5,.23)):
    box('Tool case',loc,(.65,.46,.46),'Navy',.055)
    box('Case latch',(loc[0],loc[1]-.237,loc[2]),(.14,.025,.13),'Metal',.015)
    for sx in (-.23,.23):
        box('Case bump rail',(loc[0]+sx,loc[1],loc[2]),(.04,.48,.47),'Rubber',.018)
line('Floor cable',[(-3.3,3,.1),(-2.65,2.5,.11),(-2.7,1.55,.10),(-2.4,.7,.10),(-2.8,-.1,.10)],.025,'Rubber')

def area(name, loc, target, energy, color, size, size_y=None):
    dat=bpy.data.lights.new(name,'AREA')
    dat.energy=energy
    dat.color=color
    dat.shape='DISK' if size_y is None else 'RECTANGLE'
    dat.size=size
    if size_y:dat.size_y=size_y
    obj=bpy.data.objects.new(name,dat)
    current.objects.link(obj)
    obj.location=loc
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    return obj

area('Hero softbox',(-3.4,-4.5,6),(0,-.1,1.2),850,(.65,.87,1),4.2)
area('Warm rim',(3.4,2.1,4.2),(-.7,0,1.3),1050,(1,.26,.13),2.5)
area('Mint eye bounce',(-.4,-1.8,2.9),(0,0,1.1),35,(.25,1,.80),1.4)
area('DOC page key',(2,-2.9,4),(.7,-.1,2.2),180,(.75,1,.92),2.0)
for y in (2.4,6.4,10.4,14.4):
    area('Ceiling pool',(0,y,4.48),(0,y,0),350,(.19,.59,.71),3.5,1.1)
    area('Side cool wash',(-3.8,y,2.5),(0,y,1.6),180,(.05,.8,1),1.7)
area('Gate red spill',(0,16,3.8),(0,7,1),950,(1,.08,.035),3.0)
world=bpy.data.worlds.new('Deep grid atmosphere')
scene.world=world
world.use_nodes=True
world.node_tree.nodes['Background'].inputs['Color'].default_value=(.025,.06,.085,1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value=.24
# Restrained spatial haze; enough contrast for a readable hero silhouette.
fogmat=bpy.data.materials.new('LOOKDEV_atmosphere')
fogmat.use_nodes=True
nodes=fogmat.node_tree.nodes
nodes.clear()
out=nodes.new('ShaderNodeOutputMaterial')
volume=nodes.new('ShaderNodeVolumePrincipled')
volume.inputs['Density'].default_value=.006
volume.inputs['Color'].default_value=(.29,.49,.57,1)
volume.inputs['Anisotropy'].default_value=.30
fogmat.node_tree.links.new(volume.outputs['Volume'],out.inputs['Volume'])
box('Atmosphere volume',(0,6,2.7),(8,24,5.4),fogmat,0)
# Floating motes at controlled positions, tiny white flecks read like depth not noise.
for i in range(62):
    sphere('Airborne signal dust',(random.uniform(-3.5,3.5),random.uniform(-1,14),random.uniform(.3,4.4)),
        (random.uniform(.002,.007),)*3,'Cyan',8)
camdata=bpy.data.cameras.new('Lookdev cinema camera')
cam=bpy.data.objects.new('Lookdev cinema camera',camdata)
current.objects.link(cam)
cam.location=(2.45,-7.3,3.0)
target=Vector((.0,1.3,1.6))
cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
camdata.lens=39
camdata.sensor_width=36
camdata.dof.use_dof=True
focus=bpy.data.objects.new('Hero focus',None)
current.objects.link(focus)
focus.location=(-.25,-.25,1.55)
camdata.dof.focus_object=focus
camdata.dof.aperture_fstop=7.1
scene.camera=cam
# Camera-space provenance caption, included in the rendered still itself.
# Provenance is in README and the preview filename, leaving the 3D composition intact.
scene.use_nodes=True
nodes=scene.node_tree.nodes
nodes.clear()
rl=nodes.new('CompositorNodeRLayers')
glare=nodes.new('CompositorNodeGlare')
glare.glare_type='FOG_GLOW'
glare.quality='MEDIUM'
glare.threshold=1.5
glare.size=7
glare.mix=-.92
out=nodes.new('CompositorNodeComposite')
scene.node_tree.links.new(rl.outputs['Image'],glare.inputs['Image'])
scene.node_tree.links.new(glare.outputs['Image'],out.inputs['Image'])
scene.render.filepath=os.path.join(PREVIEW,'preview.png')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE,'SHIFT_LEFT_ArtSource.blend'),compress=True)
print('SHIFT_LEFT_ASSETS_EXPORTED '+json.dumps(ASSETS))
if '--skip-render' not in sys.argv:
    bpy.ops.render.render(write_still=True)
    print('SHIFT_LEFT_LOOKDEV_RENDERED '+scene.render.filepath)
