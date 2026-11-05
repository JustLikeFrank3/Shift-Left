#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "Simulation/IncidentModel.h"
#include "SLGameMode.generated.h"

UENUM()
enum class ESLPanel : uint8 { None, Station, Patch, Doc, Help, Complete };

USTRUCT()
struct FSLChoice
{
    GENERATED_BODY()
    UPROPERTY() FString Label;
    UPROPERTY() FString Detail;
    UPROPERTY() FString State;
    UPROPERTY() bool bEnabled = true;
};

/** Presentation adapter. The portable incident model owns every consequence. */
UCLASS()
class SHIFTLEFT_API ASLGameMode : public AGameModeBase
{
    GENERATED_BODY()
public:
    ASLGameMode();
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;

    const ShiftLeft::IncidentState& GetIncident() const { return Incident; }
    int32 GetNearbyStationIndex() const;
    int32 GetCurrentStageIndex() const;
    FString GetStationLabel() const;
    bool IsPanelOpen() const { return Panel != ESLPanel::None; }
    bool IsGameplayActive() const;
    ESLPanel GetPanel() const { return Panel; }
    FString GetPanelTitle() const;
    FString GetPanelBody() const;
    TArray<FSLChoice> GetChoices() const;
    float GetPatchPulse() const { return PatchPulse; }
    FString GetMusicStatus() const;

    void Interact();
    void OpenPatch();
    void ToggleGuide();
    void Validate();
    void ToggleMenu();
    void SelectChoice(int32 Index);
    void ClosePanel();
    void RestartIncident();
    void ToggleMusic();

private:
    ShiftLeft::IncidentState Incident;
    ESLPanel Panel = ESLPanel::Help;
    int32 PanelStation = 4;
    double MillisecondRemainder = 0.0;
    float PatchPulse = 0.f;
    UPROPERTY() class UAudioComponent* Score = nullptr;
    bool bMusicEnabled = true;
    bool bHasEnteredGrid = false;
    void OpenPanel(ESLPanel NewPanel);
    void ApplyAction(ShiftLeft::Action Action);
    ShiftLeft::Stage SelectedStage() const;
    void UpdatePointer();
};
