#include "SLDeliveryWorld.h"
#include "DeliveryLayout.h"
#include "SLGameMode.h"
#include "Components/DirectionalLightComponent.h"
#include "Components/ExponentialHeightFogComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/PostProcessComponent.h"
#include "Components/SceneComponent.h"
#include "Components/SkyLightComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "Materials/MaterialInstanceDynamic.h"

namespace
{
    const TCHAR* CubePath = TEXT("/Engine/BasicShapes/Cube.Cube");
    const TCHAR* CylinderPath = TEXT("/Engine/BasicShapes/Cylinder.Cylinder");
    UMaterialInterface* WorldMaterial(UObject* Owner, const TCHAR* Name, FLinearColor Color)
    {
        if (UMaterialInterface* Asset = LoadObject<UMaterialInterface>(nullptr, *FString::Printf(TEXT("/Game/Art/Materials/%s.%s"), Name, Name))) return Asset;
        UMaterialInterface* Base = LoadObject<UMaterialInterface>(nullptr, TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
        UMaterialInstanceDynamic* Result = UMaterialInstanceDynamic::Create(Base, Owner);
        if (Result) Result->SetVectorParameterValue(TEXT("Color"), Color);
        return Result;
    }
}

ASLDeliveryWorld::ASLDeliveryWorld()
{
    PrimaryActorTick.bCanEverTick = true;
    RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("DeliveryGridRoot"));
}

void ASLDeliveryWorld::OnConstruction(const FTransform& Transform)
{
    Super::OnConstruction(Transform);
    RebuildWorld();
}

void ASLDeliveryWorld::BeginPlay()
{
    Super::BeginPlay();
    // Rebuild serialized geometry too, so committed maps pick up layout fixes.
    RebuildWorld();
}

void ASLDeliveryWorld::RegisterPart(UActorComponent* Component)
{
    Component->ComponentTags.Add(TEXT("SLGenerated"));
    AddInstanceComponent(Component);
    if (USceneComponent* Scene = Cast<USceneComponent>(Component)) Scene->SetupAttachment(RootComponent);
    Component->RegisterComponent();
    BuiltComponents.Add(Component);
}

UStaticMeshComponent* ASLDeliveryWorld::Shape(const TCHAR* Path, FVector Position, FVector Scale, UMaterialInterface* Mat, bool bCollision, FRotator Rotation)
{
    UStaticMeshComponent* Mesh = NewObject<UStaticMeshComponent>(this, NAME_None, RF_Transactional);
    Mesh->SetStaticMesh(LoadObject<UStaticMesh>(nullptr, Path));
    Mesh->SetRelativeLocation(Position); Mesh->SetRelativeScale3D(Scale); Mesh->SetRelativeRotation(Rotation);
    Mesh->SetMobility(EComponentMobility::Movable);
    Mesh->SetCollisionEnabled(bCollision ? ECollisionEnabled::QueryAndPhysics : ECollisionEnabled::NoCollision);
    if (bCollision) Mesh->SetCollisionProfileName(TEXT("BlockAll"));
    Mesh->SetMaterial(0, Mat);
    RegisterPart(Mesh);
    return Mesh;
}

UStaticMeshComponent* ASLDeliveryWorld::Cube(FVector Position, FVector Size, UMaterialInterface* Mat, bool bCollision)
{
    return Shape(CubePath, Position, Size / 100.f, Mat, bCollision);
}

void ASLDeliveryWorld::Sign(const FString& Text, FVector Position, float Size, FColor Color)
{
    UTextRenderComponent* Label = NewObject<UTextRenderComponent>(this, NAME_None, RF_Transactional);
    Label->SetRelativeLocation(Position); Label->SetRelativeRotation(FRotator(0,-90,0));
    Label->SetHorizontalAlignment(EHTA_Center); Label->SetVerticalAlignment(EVRTA_TextCenter);
    Label->SetWorldSize(Size); Label->SetTextRenderColor(Color);
    Label->SetText(FText::FromString(Text)); Label->SetCastShadow(false);
    RegisterPart(Label);
}

void ASLDeliveryWorld::Light(FVector Position, FLinearColor Color, float Intensity, float Radius)
{
    UPointLightComponent* Point = NewObject<UPointLightComponent>(this, NAME_None, RF_Transactional);
    Point->SetRelativeLocation(Position); Point->SetLightColor(Color); Point->SetIntensity(Intensity);
    Point->SetAttenuationRadius(Radius); Point->SetCastShadows(false);
    RegisterPart(Point);
}

void ASLDeliveryWorld::Rack(FVector Position, float Scale, bool bAlert)
{
    if (UStaticMesh* Imported = LoadObject<UStaticMesh>(nullptr, TEXT("/Game/Art/ServerRack.ServerRack")))
    {
        UStaticMeshComponent* Component = Shape(TEXT("/Game/Art/ServerRack.ServerRack"), Position, FVector(1), Metal, false, FRotator(0,180,0));
        const FBox Bounds = Imported->GetBoundingBox();
        const float S = 300.f * Scale / FMath::Max(static_cast<float>(Bounds.GetSize().Z), 1.f);
        Component->SetRelativeScale3D(FVector(S));
        Component->SetRelativeLocation(Position - FVector(0,0,Bounds.Min.Z * S));
        for (FName Name : Component->GetMaterialSlotNames())
        {
            UMaterialInterface* Mat = LoadObject<UMaterialInterface>(nullptr, *FString::Printf(TEXT("/Game/Art/Materials/%s.%s"), *Name.ToString(), *Name.ToString()));
            if (Mat) Component->SetMaterialByName(Name, Mat);
        }
        return;
    }
    auto At = [Position, Scale](FVector Offset) { return Position + Offset * Scale; };
    Cube(At(FVector(0,0,150)), FVector(170,130,300) * Scale, Metal);
    Cube(At(FVector(0,-69,150)), FVector(146,12,276) * Scale, Dark);
    Cube(At(FVector(-76,-78,150)), FVector(7,10,280) * Scale, bAlert ? Coral : Teal);
    for (int32 Slot=0; Slot<7; ++Slot)
    {
        const float Z = 38.f + Slot * 36.f;
        Cube(At(FVector(0,-80,Z)), FVector(123,12,26) * Scale, PanelMaterial);
        Cube(At(FVector(-44,-88,Z)), FVector(7,3,7) * Scale, bAlert && Slot % 3 == 0 ? Coral : Teal);
        for (int32 Vent=0; Vent<4; ++Vent)
            Cube(At(FVector(10.f + Vent*12,-88,Z)), FVector(5,3,14) * Scale, Metal);
    }
}

void ASLDeliveryWorld::Terminal(FVector Position, int32 Stage)
{
    if (UStaticMesh* Imported = LoadObject<UStaticMesh>(nullptr, TEXT("/Game/Art/Terminal.Terminal")))
    {
        UStaticMeshComponent* Component = Shape(TEXT("/Game/Art/Terminal.Terminal"), Position, FVector(1), PanelMaterial, false, FRotator(0,180,0));
        const FBox Bounds = Imported->GetBoundingBox();
        const float S = 170.f / FMath::Max(static_cast<float>(Bounds.GetSize().Z), 1.f);
        Component->SetRelativeScale3D(FVector(S));
        Component->SetRelativeLocation(Position - FVector(0,0,Bounds.Min.Z*S));
        for (FName Name : Component->GetMaterialSlotNames())
        {
            UMaterialInterface* Mat = LoadObject<UMaterialInterface>(nullptr, *FString::Printf(TEXT("/Game/Art/Materials/%s.%s"), *Name.ToString(), *Name.ToString()));
            if (Mat) Component->SetMaterialByName(Name, Mat);
        }
    }
    else
    {
        Cube(Position + FVector(0,0,14), FVector(150,100,28), Metal);
        Cube(Position + FVector(0,15,71), FVector(46,48,112), PanelMaterial);
        Cube(Position + FVector(0,5,142), FVector(166,48,103), Navy);
        Cube(Position + FVector(0,-21,146), FVector(142,5,76), Dark);
        for (int32 Line=0; Line<3; ++Line)
            Cube(Position + FVector(-16,-26,165-Line*19), FVector(Line==0?104:75,3,5), Stage==4?Coral:Teal);
        Cube(Position + FVector(0,-35,98), FVector(165,69,12), Metal);
    }
}

void ASLDeliveryWorld::RebuildWorld()
{
    const TArray<UActorComponent*> OldComponents = GetInstanceComponents();
    for (UActorComponent* Part : OldComponents)
        if (IsValid(Part) && Part->ComponentHasTag(TEXT("SLGenerated")))
        { RemoveInstanceComponent(Part); Part->DestroyComponent(); }
    BuiltComponents.Empty(); LeakBars.Empty(); StationStrips.Empty(); LeakLight = nullptr;
    Teal = WorldMaterial(this,TEXT("M_Cyan"),FLinearColor(.025f,.75f,.85f));
    Coral = WorldMaterial(this,TEXT("M_Coral"),FLinearColor(1.f,.12f,.08f));
    Navy = WorldMaterial(this,TEXT("M_Navy"),FLinearColor(.016f,.028f,.055f));
    PanelMaterial = WorldMaterial(this,TEXT("M_Panel"),FLinearColor(.045f,.10f,.14f));
    Metal = WorldMaterial(this,TEXT("M_Metal"),FLinearColor(.12f,.19f,.23f));
    White = WorldMaterial(this,TEXT("M_White"),FLinearColor(.71f,.85f,.9f));
    Dark = WorldMaterial(this,TEXT("M_Dark"),FLinearColor(.003f,.008f,.012f));

    // Continuous safe deck: travel tests a decision, never platforming precision.
    Cube(FVector(0,0,-38),FVector(6250,1000,76),Metal,true);
    Cube(FVector(0,-490,-80),FVector(6250,36,120),Navy);
    Cube(FVector(0,-511,-38),FVector(6250,7,10),Teal);
    Cube(FVector(0,465,260),FVector(6250,25,520),Navy);
    Cube(FVector(0,600,580),FVector(6900,28,1500),Dark);
    for (int32 Bay=0; Bay<15; ++Bay)
    {
        const float X = -3080.f + Bay * 440.f;
        Cube(FVector(X,430,340),FVector(28,150,680),PanelMaterial);
        Cube(FVector(X,180,680),FVector(32,660,24),Metal);
        Cube(FVector(X,355,580),FVector(12,10,150),Teal);
        Cube(FVector(X,-245,2),FVector(7,450,2),PanelMaterial);
        if (Bay % 2 == 0) Cube(FVector(X+85,-300,3),FVector(100,6,2),White);
    }
    for (int32 Pipe=0; Pipe<3; ++Pipe)
    {
        const float Z = 520.f + Pipe * 58.f;
        Shape(CylinderPath,FVector(0,365,Z),FVector(.27f,.27f,62.f),Metal,false,FRotator(90,0,0));
        Shape(CylinderPath,FVector(0,344,Z),FVector(.055f,.055f,62.f),Pipe==2?Coral:Teal,false,FRotator(90,0,0));
    }

    const TCHAR* Names[] = {TEXT("SOURCE"),TEXT("BUILD"),TEXT("TEST"),TEXT("STAGING"),TEXT("PRODUCTION")};
    const TCHAR* Subtitles[] = {TEXT("CODE / 1 EFFORT"),TEXT("PACKAGE / 2 EFFORT"),TEXT("CHECKS / 4 EFFORT"),TEXT("REHEARSE / FREE"),TEXT("LIVE SERVICE / FREE")};
    for (int32 Stage=0; Stage<5; ++Stage)
    {
        const float X = ShiftLeftLayout::StageX(Stage);
        UMaterialInterface* Accent = Stage==4?Coral:Teal;
        Cube(FVector(X,354,345),FVector(740,34,138),PanelMaterial);
        Cube(FVector(X,331,413),FVector(742,8,6),Accent);
        Sign(Names[Stage],FVector(X,328,362),Stage==4?52.f:66.f,Stage==4?FColor(255,150,119):FColor(143,250,233));
        Sign(Subtitles[Stage],FVector(X,328,314),23.f,FColor(124,166,183));
        Cube(FVector(X,0,1),FVector(1200,450,2),Navy);
        StationStrips.Add(Cube(FVector(X,-219,4),FVector(1200,8,4),Accent));
        // Only the two corridor ends get transverse borders. Individual bays
        // must not look like isolated walkable boards or false travel limits.
        if (Stage == 0) Cube(FVector(X+600,0,4),FVector(8,445,4),Accent);
        if (Stage == 4) Cube(FVector(X-600,0,4),FVector(8,445,4),Accent);
        Rack(FVector(X-290,230,0),1.f,Stage==4);
        Rack(FVector(X+270,300,0),.88f,Stage==4);
        Terminal(FVector(X,110,0),Stage);
        Light(FVector(X,50,380),Stage==4?FLinearColor(1,.12f,.07f):FLinearColor(.04f,.6f,.8f),Stage==4?6500:4000,720);
        Cube(FVector(X-426,268,44),FVector(80,110,88),Metal);
        Cube(FVector(X-426,210,53),FVector(48,4,9),Accent);
        Shape(CylinderPath,FVector(X+425,280,55),FVector(.5f,.5f,1.1f),PanelMaterial);
        if (Stage < 4)
            Sign(FString::Printf(TEXT("< %s   /   %s >"), Names[Stage], Names[Stage+1]),
                 FVector(X-600,310,180),22.f,FColor(125,222,211));
    }
    Sign(TEXT("<  SHIFT THE FIX LEFT"),FVector(1800,330,330),30.f,FColor(125,222,211));
    Sign(TEXT("LIVE GRID / SYNTHETIC SYSTEM"),FVector(-1800,330,330),26.f,FColor(249,147,120));
    for (int32 Index=0; Index<7; ++Index)
        LeakBars.Add(Cube(FVector(-2640.f-(Index%3)*34.f,210,380.f+Index*34.f),FVector(12,12,60),Coral));
    LeakLight = NewObject<UPointLightComponent>(this,NAME_None,RF_Transactional);
    LeakLight->SetRelativeLocation(FVector(-2630,140,340)); LeakLight->SetLightColor(FLinearColor(1,.05f,.02f));
    LeakLight->SetIntensity(12000); LeakLight->SetAttenuationRadius(700); LeakLight->SetCastShadows(false);
    RegisterPart(LeakLight);

    UDirectionalLightComponent* Key = NewObject<UDirectionalLightComponent>(this,NAME_None,RF_Transactional);
    Key->SetRelativeRotation(FRotator(-42,-35,0)); Key->SetLightColor(FLinearColor(.64f,.78f,1.f));
    Key->SetIntensity(3.f); RegisterPart(Key);
    Light(FVector(0,-900,850),FLinearColor(.42f,.64f,1.f),160000,4800);
    Light(FVector(2450,-500,700),FLinearColor(.7f,.85f,1.f),32000,1600);
    Light(FVector(-2450,-500,700),FLinearColor(.7f,.85f,1.f),32000,1600);
    USkyLightComponent* Sky = NewObject<USkyLightComponent>(this,NAME_None,RF_Transactional);
    Sky->SetIntensity(.4f); Sky->SetLightColor(FLinearColor(.23f,.39f,.54f));
    Sky->SetMobility(EComponentMobility::Movable); RegisterPart(Sky);
    UExponentialHeightFogComponent* Fog = NewObject<UExponentialHeightFogComponent>(this,NAME_None,RF_Transactional);
    Fog->SetRelativeLocation(FVector(0,0,-100)); Fog->SetFogDensity(.009f);
    Fog->SetFogHeightFalloff(.28f); Fog->SetFogInscatteringColor(FLinearColor(.012f,.04f,.065f));
    Fog->SetFogMaxOpacity(.4f); RegisterPart(Fog);
    UPostProcessComponent* Post = NewObject<UPostProcessComponent>(this,NAME_None,RF_Transactional);
    Post->bUnbound = true;
    Post->Settings.bOverride_AutoExposureMinBrightness = true; Post->Settings.AutoExposureMinBrightness = 1.f;
    Post->Settings.bOverride_AutoExposureMaxBrightness = true; Post->Settings.AutoExposureMaxBrightness = 1.f;
    Post->Settings.bOverride_BloomIntensity = true; Post->Settings.BloomIntensity = .55f;
    Post->Settings.bOverride_VignetteIntensity = true; Post->Settings.VignetteIntensity = .22f;
    RegisterPart(Post);
}

void ASLDeliveryWorld::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    WorldTime += DeltaSeconds;
    const ASLGameMode* GM = GetWorld() ? GetWorld()->GetAuthGameMode<ASLGameMode>() : nullptr;
    if (!GM) return;
    const ShiftLeft::IncidentState& State = GM->GetIncident();
    const bool bLeak = !State.credentialRevoked;
    for (int32 Index=0; Index<LeakBars.Num(); ++Index)
    {
        LeakBars[Index]->SetVisibility(bLeak);
        const float Cycle = FMath::Fmod(WorldTime * 1.25f + Index*.19f,1.f);
        LeakBars[Index]->SetRelativeLocation(FVector(-2630.f-(Index%3)*32.f,200.f,280.f+Cycle*350.f));
        LeakBars[Index]->SetRelativeScale3D(FVector(.09f,.09f,.25f+Cycle*.5f));
    }
    if (LeakLight) LeakLight->SetIntensity(bLeak?10000.f+FMath::Sin(WorldTime*6.f)*2000.f:0.f);
    if (StationStrips.Num()==5)
    {
        StationStrips[4]->SetMaterial(0,bLeak?Coral:Teal);
        StationStrips[0]->SetMaterial(0,State.sourceLiteralRemoved?Teal:White);
        StationStrips[2]->SetMaterial(0,State.earlyCheck?Teal:White);
    }
}
