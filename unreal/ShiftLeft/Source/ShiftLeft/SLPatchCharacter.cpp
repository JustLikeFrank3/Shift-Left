#include "SLPatchCharacter.h"
#include "SLGameMode.h"
#include "Camera/CameraComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/InputComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/SceneComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "UObject/ConstructorHelpers.h"

namespace
{
    UMaterialInterface* Material(UObject* Owner, const TCHAR* Name, FLinearColor Color)
    {
        if (UMaterialInterface* Authored = LoadObject<UMaterialInterface>(nullptr, *FString::Printf(TEXT("/Game/Art/Materials/%s.%s"), Name, Name))) return Authored;
        UMaterialInterface* Base = LoadObject<UMaterialInterface>(nullptr, TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
        UMaterialInstanceDynamic* Result = UMaterialInstanceDynamic::Create(Base, Owner);
        if (Result) Result->SetVectorParameterValue(TEXT("Color"), Color);
        return Result;
    }
    void SetArtMaterials(UStaticMeshComponent* Part)
    {
        if (!Part || !Part->GetStaticMesh()) return;
        for (const FName Name : Part->GetMaterialSlotNames())
        {
            UMaterialInterface* Mat = LoadObject<UMaterialInterface>(nullptr, *FString::Printf(TEXT("/Game/Art/Materials/%s.%s"), *Name.ToString(), *Name.ToString()));
            if (Mat) Part->SetMaterialByName(Name, Mat);
        }
    }
    bool LoadArt(UStaticMeshComponent* Component, const TCHAR* Path, float Height)
    {
        UStaticMesh* Mesh = LoadObject<UStaticMesh>(nullptr, Path);
        if (!Mesh) return false;
        Component->SetStaticMesh(Mesh);
        const FBox Box = Mesh->GetBoundingBox();
        const float Scale = Height / FMath::Max(static_cast<float>(Box.GetSize().Z), 1.f);
        Component->SetRelativeScale3D(FVector(Scale));
        Component->SetRelativeLocation(FVector(0.f, 0.f, -95.f - Box.Min.Z * Scale));
        // Sources face Blender -Y and import facing +Y, away from the side camera.
        Component->SetRelativeRotation(FRotator(0.f, 180.f, 0.f));
        SetArtMaterials(Component);
        return true;
    }
}

ASLPatchCharacter::ASLPatchCharacter()
{
    PrimaryActorTick.bCanEverTick = true;
    GetCapsuleComponent()->InitCapsuleSize(38.f, 100.f);
    bUseControllerRotationYaw = false;
    UCharacterMovementComponent* Move = GetCharacterMovement();
    Move->MaxWalkSpeed = 550.f;
    Move->MaxAcceleration = 2600.f;
    Move->BrakingDecelerationWalking = 3000.f;
    Move->GroundFriction = 10.f;
    Move->JumpZVelocity = 560.f;
    Move->AirControl = 0.65f;
    Move->GravityScale = 1.7f;
    Move->bOrientRotationToMovement = false;
    Move->bConstrainToPlane = true;
    Move->SetPlaneConstraintNormal(FVector(0.f, 1.f, 0.f));
    Move->bSnapToPlaneAtStart = true;

    CameraArm = CreateDefaultSubobject<USpringArmComponent>(TEXT("SideCameraArm"));
    CameraArm->SetupAttachment(RootComponent);
    CameraArm->TargetArmLength = 940.f;
    CameraArm->SetRelativeRotation(FRotator(-6.f, 90.f, 0.f));
    CameraArm->TargetOffset = FVector(65.f, 0.f, 20.f);
    CameraArm->bDoCollisionTest = false;
    CameraArm->bEnableCameraLag = true;
    CameraArm->CameraLagSpeed = 6.f;
    CameraArm->bInheritPitch = CameraArm->bInheritYaw = CameraArm->bInheritRoll = false;
    SideCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("SideCamera"));
    SideCamera->SetupAttachment(CameraArm, USpringArmComponent::SocketName);
    SideCamera->FieldOfView = 65.f;

    PatchRoot = CreateDefaultSubobject<USceneComponent>(TEXT("PATCH"));
    PatchRoot->SetupAttachment(RootComponent);
    ImportedPatch = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("PATCHImportedMesh"));
    ImportedPatch->SetupAttachment(PatchRoot);
    ImportedPatch->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    static ConstructorHelpers::FObjectFinder<UStaticMesh> Cube(TEXT("/Engine/BasicShapes/Cube.Cube"));
    static ConstructorHelpers::FObjectFinder<UStaticMesh> Sphere(TEXT("/Engine/BasicShapes/Sphere.Sphere"));
    auto Part = [this](const TCHAR* Name, USceneComponent* Parent, FVector Position, FVector Scale, bool bSphere, TArray<UStaticMeshComponent*>& Out)
    {
        UStaticMeshComponent* Mesh = CreateDefaultSubobject<UStaticMeshComponent>(Name);
        Mesh->SetupAttachment(Parent);
        Mesh->SetStaticMesh(bSphere ? Sphere.Object : Cube.Object);
        Mesh->SetRelativeLocation(Position);
        Mesh->SetRelativeScale3D(Scale);
        Mesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
        Out.Add(Mesh);
        return Mesh;
    };
    Part(TEXT("PatchTorso"), PatchRoot, FVector(0, 0, -4), FVector(.75,.48,.76), false, FallbackPatch);
    Part(TEXT("PatchHead"), PatchRoot, FVector(0, 0, 58), FVector(.91,.60,.63), true, FallbackPatch);
    Part(TEXT("PatchVisor"), PatchRoot, FVector(0,-28,62), FVector(.65,.08,.23), false, FallbackPatch);
    Part(TEXT("PatchEyeLeft"), PatchRoot, FVector(-18,-34,63), FVector(.09,.06,.10), false, FallbackPatch);
    Part(TEXT("PatchEyeRight"), PatchRoot, FVector(18,-34,63), FVector(.09,.06,.10), false, FallbackPatch);
    Part(TEXT("PatchLeftArm"), PatchRoot, FVector(-50,0,-5), FVector(.22,.30,.68), false, FallbackPatch);
    Part(TEXT("PatchRightArm"), PatchRoot, FVector(50,0,-5), FVector(.22,.30,.68), false, FallbackPatch);
    Part(TEXT("PatchLeftBoot"), PatchRoot, FVector(-22,-5,-70), FVector(.33,.50,.48), false, FallbackPatch);
    Part(TEXT("PatchRightBoot"), PatchRoot, FVector(22,-5,-70), FVector(.33,.50,.48), false, FallbackPatch);
    Part(TEXT("PatchChestMark"), PatchRoot, FVector(0,-26,-4), FVector(.27,.04,.28), false, FallbackPatch);
    Part(TEXT("PatchAntenna"), PatchRoot, FVector(28,0,99), FVector(.12,.12,.28), false, FallbackPatch);
    const TCHAR* LimbNames[] = {TEXT("ArtBody"),TEXT("ArtArmLeft"),TEXT("ArtArmRight"),TEXT("ArtLegLeft"),TEXT("ArtLegRight")};
    for (const TCHAR* LimbName : LimbNames)
    {
        UStaticMeshComponent* Limb = CreateDefaultSubobject<UStaticMeshComponent>(LimbName);
        Limb->SetupAttachment(PatchRoot); Limb->SetCollisionEnabled(ECollisionEnabled::NoCollision);
        ArticulatedPatch.Add(Limb);
    }

    DocRoot = CreateDefaultSubobject<USceneComponent>(TEXT("DOC"));
    DocRoot->SetupAttachment(RootComponent);
    DocRoot->SetRelativeLocation(FVector(135.f, 0.f, 120.f));
    ImportedDoc = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("DOCImportedMesh"));
    ImportedDoc->SetupAttachment(DocRoot);
    ImportedDoc->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    Part(TEXT("DocBody"), DocRoot, FVector::ZeroVector, FVector(.62,.36,.48), false, FallbackDoc);
    Part(TEXT("DocVisor"), DocRoot, FVector(0,-20,2), FVector(.43,.06,.18), false, FallbackDoc);
    Part(TEXT("DocLight"), DocRoot, FVector(0,-24,2), FVector(.20,.05,.07), false, FallbackDoc);
    Part(TEXT("DocAntenna"), DocRoot, FVector(0,0,33), FVector(.08,.08,.20), false, FallbackDoc);
    auto Label = [this](const TCHAR* ComponentName, USceneComponent* Parent, const TCHAR* Text, FVector Position, FColor Color, float Size)
    {
        UTextRenderComponent* Result = CreateDefaultSubobject<UTextRenderComponent>(ComponentName);
        Result->SetupAttachment(Parent); Result->SetRelativeLocation(Position);
        Result->SetRelativeRotation(FRotator(0,-90,0));
        Result->SetHorizontalAlignment(EHTA_Center); Result->SetVerticalAlignment(EVRTA_TextCenter);
        Result->SetWorldSize(Size); Result->SetTextRenderColor(Color); Result->SetText(FText::FromString(Text));
        return Result;
    };
    PatchName = Label(TEXT("PatchName"), RootComponent, TEXT("PATCH"), FVector(0,-15,128), FColor(145,255,232), 24.f);
    DocName = Label(TEXT("DocName"), DocRoot, TEXT("DOC"), FVector(0,-15,68), FColor(133,211,255), 22.f);
    PatchCallout = Label(TEXT("PatchCallout"), RootComponent, TEXT("PATCH!"), FVector(0,-60,175), FColor(120,255,214), 46.f);
    PatchCallout->SetVisibility(false);
    // Camera-side fill keeps the navy characters readable against the dark corridor.
    FillLight = CreateDefaultSubobject<UPointLightComponent>(TEXT("CharacterFill"));
    FillLight->SetupAttachment(RootComponent);
    FillLight->SetRelativeLocation(FVector(40.f, -260.f, 150.f));
    FillLight->SetLightColor(FLinearColor(.72f, .88f, 1.f));
    FillLight->SetIntensity(5200.f);
    FillLight->SetAttenuationRadius(620.f);
    FillLight->SetCastShadows(false);
    FlashLight = CreateDefaultSubobject<UPointLightComponent>(TEXT("PatchFlash"));
    FlashLight->SetupAttachment(RootComponent);
    FlashLight->SetRelativeLocation(FVector(0.f, -120.f, 90.f));
    FlashLight->SetLightColor(FLinearColor(.2f, 1.f, .7f));
    FlashLight->SetIntensity(0.f);
    FlashLight->SetAttenuationRadius(700.f);
    FlashLight->SetCastShadows(false);
}

void ASLPatchCharacter::BeginPlay()
{
    Super::BeginPlay();
    SetActorLocation(FVector(2220.f,0.f,120.f),false,nullptr,ETeleportType::TeleportPhysics);
    const bool bPatchArt = LoadArt(ImportedPatch, TEXT("/Game/Art/PATCH.PATCH"), 190.f);
    const TCHAR* Paths[] = {TEXT("/Game/Art/PATCH_Body.PATCH_Body"),TEXT("/Game/Art/PATCH_Arm_L.PATCH_Arm_L"),TEXT("/Game/Art/PATCH_Arm_R.PATCH_Arm_R"),TEXT("/Game/Art/PATCH_Leg_L.PATCH_Leg_L"),TEXT("/Game/Art/PATCH_Leg_R.PATCH_Leg_R")};
    // Imported parts are turned 180 degrees to face the camera, so source X pivots mirror.
    const FVector Pivots[] = {FVector(0,0,0),FVector(46,0,94),FVector(-46,0,94),FVector(23,0,54),FVector(-23,0,54)};
    constexpr float ArtScale = 190.f / 228.4f;
    bArticulated = true;
    for (int32 Index=0; Index<ArticulatedPatch.Num(); ++Index)
    {
        UStaticMesh* Mesh = LoadObject<UStaticMesh>(nullptr,Paths[Index]);
        bArticulated &= Mesh != nullptr;
        ArticulatedPatch[Index]->SetStaticMesh(Mesh);
        ArticulatedPatch[Index]->SetRelativeLocation(Pivots[Index]*ArtScale+FVector(0,0,-95));
        ArticulatedPatch[Index]->SetRelativeScale3D(FVector(ArtScale));
        ArticulatedPatch[Index]->SetRelativeRotation(FRotator(0.f, 180.f, 0.f));
        SetArtMaterials(ArticulatedPatch[Index]);
    }
    for (UStaticMeshComponent* Part : ArticulatedPatch) Part->SetVisibility(bArticulated);
    ImportedPatch->SetVisibility(!bArticulated && bPatchArt);
    const bool bDocArt = LoadArt(ImportedDoc, TEXT("/Game/Art/DOC.DOC"), 88.f);
    if (bDocArt) ImportedDoc->AddLocalOffset(FVector(0,0,62.f));
    UMaterialInterface* Navy = Material(this, TEXT("M_Navy"), FLinearColor(.018f,.035f,.07f));
    UMaterialInterface* White = Material(this, TEXT("M_White"), FLinearColor(.78f,.9f,.94f));
    UMaterialInterface* Cyan = Material(this, TEXT("M_Cyan"), FLinearColor(.02f,.7f,.9f));
    UMaterialInterface* Mint = Material(this, TEXT("M_Mint"), FLinearColor(.2f,1.f,.69f));
    for (int32 Index = 0; Index < FallbackPatch.Num(); ++Index)
    {
        FallbackPatch[Index]->SetVisibility(!bPatchArt && !bArticulated);
        const bool bLight = Index == 3 || Index == 4 || Index == 9 || Index == 10;
        FallbackPatch[Index]->SetMaterial(0, bLight ? Mint : (Index == 1 || Index == 5 || Index == 6 ? White : Navy));
    }
    for (int32 Index = 0; Index < FallbackDoc.Num(); ++Index)
    {
        FallbackDoc[Index]->SetVisibility(!bDocArt);
        FallbackDoc[Index]->SetMaterial(0, Index == 2 || Index == 3 ? Cyan : (Index == 1 ? Navy : White));
    }
}

ASLGameMode* ASLPatchCharacter::Game() const { return GetWorld() ? GetWorld()->GetAuthGameMode<ASLGameMode>() : nullptr; }

void ASLPatchCharacter::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    AnimationTime += DeltaSeconds;
    const ASLGameMode* CurrentGame = Game();
    const float Pulse = CurrentGame ? CurrentGame->GetPatchPulse() : 0.f;
    const float Speed = FMath::Abs(GetVelocity().X);
    const bool bWalk = Speed > 20.f && GetCharacterMovement()->IsMovingOnGround();
    PatchRoot->SetRelativeLocation(FVector(0,0,bWalk ? FMath::Abs(FMath::Sin(AnimationTime * 13.f)) * 3.f : FMath::Sin(AnimationTime * 2.f) * 1.f));
    // Turn three-quarters toward travel so the stride reads; face the camera at rest.
    TurnYaw = FMath::FInterpTo(TurnYaw, bWalk ? Facing * 35.f : 0.f, DeltaSeconds, 9.f);
    PatchRoot->SetRelativeRotation(FRotator(0, TurnYaw, 0));
    PatchRoot->SetRelativeScale3D(FVector(1.f + FMath::Sin(FMath::Clamp(Pulse/1.2f,0.f,1.f) * PI) * .08f));
    if (bArticulated)
    {
        const float Stride = bWalk ? FMath::Sin(AnimationTime*11.f) * 32.f * Facing : 0.f;
        // Pitch applies in each part's own frame before the 180-degree turn;
        // negative pitch lifts Arm_R up and out for the PATCH! punch.
        ArticulatedPatch[1]->SetRelativeRotation(FRotator(-Stride*.65f,180,0));
        ArticulatedPatch[2]->SetRelativeRotation(FRotator(Stride*.65f-FMath::Sin(FMath::Clamp(Pulse/1.2f,0.f,1.f)*PI)*70.f,180,0));
        ArticulatedPatch[3]->SetRelativeRotation(FRotator(Stride,180,0));
        ArticulatedPatch[4]->SetRelativeRotation(FRotator(-Stride,180,0));
    }
    if (FallbackPatch.Num() >= 9)
    {
        const float Swing = bWalk ? FMath::Sin(AnimationTime * 13.f) * 20.f : 0.f;
        FallbackPatch[5]->SetRelativeRotation(FRotator(Swing,0,0));
        FallbackPatch[6]->SetRelativeRotation(FRotator(-Swing,0,0));
        FallbackPatch[7]->SetRelativeRotation(FRotator(-Swing*.6f,0,0));
        FallbackPatch[8]->SetRelativeRotation(FRotator(Swing*.6f,0,0));
    }
    DocRoot->SetRelativeLocation(FVector(150.f, 10.f, 70.f + FMath::Sin(AnimationTime * 2.4f) * 10.f));
    ImportedPatch->SetRelativeRotation(FRotator(0.f, 180.f + FMath::Sin(Pulse * 12.f) * Pulse * 4.f, 0.f));
    // PATCH! reads at a glance: callout pops, a mint flash washes the deck, the arm punches up.
    const float Burst = FMath::Clamp(Pulse / 1.2f, 0.f, 1.f);
    PatchCallout->SetVisibility(Burst > 0.f);
    PatchName->SetVisibility(Burst <= 0.f);
    PatchCallout->SetRelativeLocation(FVector(-30.f, -60.f, 128.f + (1.f - Burst) * 30.f));
    PatchCallout->SetWorldSize(34.f + FMath::Sin(Burst * PI) * 22.f);
    FlashLight->SetIntensity(Burst * Burst * 26000.f);
    // A route that re-exposed the replacement reads as an alarm, not a success.
    const bool bAlarm = CurrentGame && CurrentGame->GetIncident().replacementExposed;
    FlashLight->SetLightColor(bAlarm ? FLinearColor(1.f, .16f, .1f) : FLinearColor(.2f, 1.f, .7f));
    PatchCallout->SetTextRenderColor(bAlarm ? FColor(255,120,96) : FColor(120,255,214));
    // End walls never cost a life or erase progress.
    const FVector Position = GetActorLocation();
    if (Position.X < -2910.f || Position.X > 2910.f)
        SetActorLocation(FVector(FMath::Clamp(Position.X,-2910.0,2910.0),0,Position.Z));
}

void ASLPatchCharacter::MoveRight(float Value)
{
    if (ASLGameMode* GM = Game())
    {
        if (!GM->IsGameplayActive()) return;
        if (!FMath::IsNearlyZero(Value)) Facing = FMath::Sign(Value);
        AddMovementInput(FVector::ForwardVector, Value);
    }
}
void ASLPatchCharacter::BeginJump() { if (ASLGameMode* GM = Game()) if (GM->IsGameplayActive()) Jump(); }
void ASLPatchCharacter::Interact() { if (ASLGameMode* GM = Game()) GM->Interact(); }
void ASLPatchCharacter::Patch() { if (ASLGameMode* GM = Game()) GM->OpenPatch(); }
void ASLPatchCharacter::Guide() { if (ASLGameMode* GM = Game()) GM->ToggleGuide(); }
void ASLPatchCharacter::Validate() { if (ASLGameMode* GM = Game()) GM->Validate(); }
void ASLPatchCharacter::Menu() { if (ASLGameMode* GM = Game()) GM->ToggleMenu(); }
void ASLPatchCharacter::Music() { if (ASLGameMode* GM = Game()) GM->ToggleMusic(); }
void ASLPatchCharacter::Choice1() { if (ASLGameMode* GM = Game()) GM->SelectChoice(0); }
void ASLPatchCharacter::Choice2() { if (ASLGameMode* GM = Game()) GM->SelectChoice(1); }
void ASLPatchCharacter::Choice3() { if (ASLGameMode* GM = Game()) GM->SelectChoice(2); }

void ASLPatchCharacter::SetupPlayerInputComponent(UInputComponent* Input)
{
    Super::SetupPlayerInputComponent(Input);
    Input->BindAxis(TEXT("MoveRight"), this, &ASLPatchCharacter::MoveRight);
    Input->BindAction(TEXT("Jump"), IE_Pressed, this, &ASLPatchCharacter::BeginJump);
    Input->BindAction(TEXT("Jump"), IE_Released, this, &ACharacter::StopJumping);
    Input->BindAction(TEXT("Interact"), IE_Pressed, this, &ASLPatchCharacter::Interact);
    Input->BindAction(TEXT("Patch"), IE_Pressed, this, &ASLPatchCharacter::Patch);
    Input->BindAction(TEXT("Guide"), IE_Pressed, this, &ASLPatchCharacter::Guide);
    Input->BindAction(TEXT("Validate"), IE_Pressed, this, &ASLPatchCharacter::Validate);
    Input->BindAction(TEXT("Menu"), IE_Pressed, this, &ASLPatchCharacter::Menu);
    Input->BindAction(TEXT("Music"), IE_Pressed, this, &ASLPatchCharacter::Music);
    Input->BindAction(TEXT("Choice1"), IE_Pressed, this, &ASLPatchCharacter::Choice1);
    Input->BindAction(TEXT("Choice2"), IE_Pressed, this, &ASLPatchCharacter::Choice2);
    Input->BindAction(TEXT("Choice3"), IE_Pressed, this, &ASLPatchCharacter::Choice3);
}
