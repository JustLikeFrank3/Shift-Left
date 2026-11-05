#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "SLPatchCharacter.generated.h"

class UCameraComponent;
class USpringArmComponent;
class UStaticMeshComponent;
class UTextRenderComponent;
class UPointLightComponent;
class USceneComponent;
class ASLGameMode;

/** A forgiving, plane-constrained PATCH with a close side camera and floating DOC. */
UCLASS()
class SHIFTLEFT_API ASLPatchCharacter : public ACharacter
{
    GENERATED_BODY()
public:
    ASLPatchCharacter();
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;
    virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;

private:
    UPROPERTY() USpringArmComponent* CameraArm;
    UPROPERTY() UCameraComponent* SideCamera;
    UPROPERTY() USceneComponent* PatchRoot;
    UPROPERTY() UStaticMeshComponent* ImportedPatch;
    UPROPERTY() TArray<UStaticMeshComponent*> ArticulatedPatch;
    UPROPERTY() TArray<UStaticMeshComponent*> FallbackPatch;
    UPROPERTY() USceneComponent* DocRoot;
    UPROPERTY() UStaticMeshComponent* ImportedDoc;
    UPROPERTY() TArray<UStaticMeshComponent*> FallbackDoc;
    UPROPERTY() UTextRenderComponent* PatchName;
    UPROPERTY() UTextRenderComponent* DocName;
    UPROPERTY() UTextRenderComponent* PatchCallout;
    UPROPERTY() UPointLightComponent* FillLight;
    UPROPERTY() UPointLightComponent* FlashLight;
    float AnimationTime = 0.f;
    float Facing = 1.f;
    float TurnYaw = 0.f;
    bool bArticulated = false;
    ASLGameMode* Game() const;
    void MoveRight(float Value);
    void BeginJump();
    void Interact();
    void Patch();
    void Guide();
    void Validate();
    void Menu();
    void Music();
    void Choice1();
    void Choice2();
    void Choice3();
};
