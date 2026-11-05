#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "InputCoreTypes.h"
#include "SLAutoplay.generated.h"

class ASLGameMode;

/**
 * Scripted playtest, spawned only with -SLAutoplay=<scenario>. It sends key events
 * through Slate into the normal input bindings, captures in-engine screenshots and
 * logs incident state, then quits. Not part of normal play.
 */
UCLASS(NotPlaceable, Transient)
class SHIFTLEFT_API ASLAutoplay : public AActor
{
    GENERATED_BODY()
public:
    ASLAutoplay();
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;

private:
    using FStep = TFunction<bool(float)>;
    TArray<FStep> Steps;
    int32 StepIndex = 0;
    float StepTime = 0.f;
    int32 ShotIndex = 0;
    int32 Failures = 0;
    FString Scenario;
    TSet<FKey> HeldKeys;

    ASLGameMode* Mode() const;
    void SendKey(const FKey& Key, bool bDown);
    void Wait(float Seconds);
    void Tap(const FKey& Key, float After = .35f);
    void Hold(const FKey& Key, float Seconds);
    void WalkTo(int32 Station);
    void Shot(const FString& Name);
    void Log(const FString& Label);
    void Expect(const FString& Label, TFunction<bool(const ASLGameMode&)> Check);
    void Build();
    FString Describe() const;
};
