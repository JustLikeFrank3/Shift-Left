#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "SLDeliveryWorld.generated.h"

class UStaticMeshComponent;
class UPointLightComponent;
class UMaterialInterface;

/** Native modular delivery grid; no Blueprint or external asset is required. */
UCLASS()
class SHIFTLEFT_API ASLDeliveryWorld : public AActor
{
    GENERATED_BODY()
public:
    ASLDeliveryWorld();
    virtual void OnConstruction(const FTransform& Transform) override;
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;
    UFUNCTION(CallInEditor, Category="SHIFT LEFT") void RebuildWorld();

private:
    UPROPERTY(Transient) TArray<UActorComponent*> BuiltComponents;
    UPROPERTY(Transient) TArray<UStaticMeshComponent*> LeakBars;
    UPROPERTY(Transient) TArray<UStaticMeshComponent*> StationStrips;
    UPROPERTY(Transient) UPointLightComponent* LeakLight = nullptr;
    UPROPERTY(Transient) UMaterialInterface* Teal = nullptr;
    UPROPERTY(Transient) UMaterialInterface* Coral = nullptr;
    UPROPERTY(Transient) UMaterialInterface* Navy = nullptr;
    UPROPERTY(Transient) UMaterialInterface* PanelMaterial = nullptr;
    UPROPERTY(Transient) UMaterialInterface* Metal = nullptr;
    UPROPERTY(Transient) UMaterialInterface* White = nullptr;
    UPROPERTY(Transient) UMaterialInterface* Dark = nullptr;
    float WorldTime = 0.f;
    UStaticMeshComponent* Shape(const TCHAR* Path, FVector Position, FVector Scale, UMaterialInterface* Material, bool bCollision = false, FRotator Rotation = FRotator::ZeroRotator);
    UStaticMeshComponent* Cube(FVector Position, FVector Size, UMaterialInterface* Material, bool bCollision = false);
    void Sign(const FString& Text, FVector Position, float Size, FColor Color);
    void Light(FVector Position, FLinearColor Color, float Intensity, float Radius);
    void Rack(FVector Position, float Scale, bool bCoral);
    void Terminal(FVector Position, int32 Stage);
    void RegisterPart(UActorComponent* Component);
};
