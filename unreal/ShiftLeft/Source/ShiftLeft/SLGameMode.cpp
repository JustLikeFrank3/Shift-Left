#include "SLGameMode.h"
#include "SLDeliveryWorld.h"
#include "SLAutoplay.h"
#include "SLGameHUD.h"
#include "SLPatchCharacter.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/PawnMovementComponent.h"
#include "Components/AudioComponent.h"
#include "Kismet/GameplayStatics.h"
#include "Sound/SoundBase.h"

namespace
{
    constexpr float StationSpacing = 1200.f;
    const TCHAR* StageNames[] = {TEXT("SOURCE"), TEXT("BUILD"), TEXT("TEST"), TEXT("STAGING"), TEXT("PRODUCTION")};
    FString FromModel(const std::string& Text) { return UTF8_TO_TCHAR(Text.c_str()); }
    FSLChoice Choice(const TCHAR* Label, const FString& Detail, const TCHAR* State = TEXT(""))
    {
        FSLChoice Result;
        Result.Label = Label; Result.Detail = Detail; Result.State = State;
        return Result;
    }
}

ASLGameMode::ASLGameMode()
{
    PrimaryActorTick.bCanEverTick = true;
    DefaultPawnClass = ASLPatchCharacter::StaticClass();
    HUDClass = ASLGameHUD::StaticClass();
    Score = CreateDefaultSubobject<UAudioComponent>(TEXT("OriginalScore"));
    Score->bAutoActivate = false;
    Score->bAllowSpatialization = false;
    Score->bIsUISound = true;
    Score->SetVolumeMultiplier(.22f);
    Incident = ShiftLeft::NewIncident();
}

void ASLGameMode::BeginPlay()
{
    Super::BeginPlay();
    if (!TActorIterator<ASLDeliveryWorld>(GetWorld())) GetWorld()->SpawnActor<ASLDeliveryWorld>();
    Score->SetSound(LoadObject<USoundBase>(nullptr, TEXT("/Game/Audio/SignalInTheDark.SignalInTheDark")));
    if (APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0))
        Pawn->SetActorLocation(FVector(2220.f, 0.f, 120.f), false, nullptr, ETeleportType::TeleportPhysics);
    OpenPanel(ESLPanel::Help);
    FString AutoplayScenario;
    if (FParse::Value(FCommandLine::Get(), TEXT("SLAutoplay="), AutoplayScenario)) GetWorld()->SpawnActor<ASLAutoplay>();
}

void ASLGameMode::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    PatchPulse = FMath::Max(0.f, PatchPulse - DeltaSeconds);
    if (!IsGameplayActive()) return;
    if (!FMath::IsFinite(DeltaSeconds) || DeltaSeconds <= 0.f) return;
    MillisecondRemainder += static_cast<double>(DeltaSeconds) * 1000.0;
    const int64 Step = static_cast<int64>(MillisecondRemainder);
    MillisecondRemainder -= static_cast<double>(Step);
    Incident = ShiftLeft::Advance(Incident, Step, true);
    if (Incident.completed || Incident.failed) OpenPanel(ESLPanel::Complete);
}

bool ASLGameMode::IsGameplayActive() const
{
    return Panel == ESLPanel::None && !Incident.completed && !Incident.failed;
}

int32 ASLGameMode::GetCurrentStageIndex() const
{
    const APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0);
    return Pawn ? FMath::Clamp(FMath::RoundToInt((Pawn->GetActorLocation().X + 2400.f) / StationSpacing), 0, 4) : 4;
}

int32 ASLGameMode::GetNearbyStationIndex() const
{
    const APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0);
    if (!Pawn) return -1;
    const int32 Index = GetCurrentStageIndex();
    return FMath::Abs(Pawn->GetActorLocation().X - (-2400.f + Index * StationSpacing)) <= 420.f ? Index : -1;
}

FString ASLGameMode::GetStationLabel() const
{
    return StageNames[GetCurrentStageIndex()];
}

void ASLGameMode::OpenPanel(ESLPanel NewPanel)
{
    Panel = NewPanel;
    if (APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0))
        if (UMovementComponent* Movement = Pawn->GetMovementComponent()) Movement->StopMovementImmediately();
    UpdatePointer();
}

void ASLGameMode::UpdatePointer()
{
    if (APlayerController* PC = UGameplayStatics::GetPlayerController(this, 0))
    {
        PC->bShowMouseCursor = IsPanelOpen();
        PC->bEnableClickEvents = IsPanelOpen();
        PC->bEnableMouseOverEvents = IsPanelOpen();
        if (IsPanelOpen())
        {
            FInputModeGameAndUI Mode;
            Mode.SetHideCursorDuringCapture(false);
            Mode.SetLockMouseToViewportBehavior(EMouseLockMode::DoNotLock);
            PC->SetInputMode(Mode);
        }
        else PC->SetInputMode(FInputModeGameOnly());
    }
}

void ASLGameMode::ClosePanel()
{
    if (Incident.completed || Incident.failed) { OpenPanel(ESLPanel::Complete); return; }
    Panel = ESLPanel::None;
    bHasEnteredGrid = true;
    if (bMusicEnabled && Score->Sound && !Score->IsPlaying()) Score->Play();
    UpdatePointer();
}

void ASLGameMode::Interact()
{
    if (IsPanelOpen()) { ClosePanel(); return; }
    const int32 Nearby = GetNearbyStationIndex();
    if (Nearby < 0) return;
    PanelStation = Nearby;
    OpenPanel(ESLPanel::Station);
}

void ASLGameMode::OpenPatch()
{
    if (Incident.completed || Incident.failed) return;
    if (Panel == ESLPanel::Patch) { ClosePanel(); return; }
    const int32 Nearby = GetNearbyStationIndex();
    if (Nearby < 0) return;
    PanelStation = Nearby;
    PatchPulse = .5f;
    OpenPanel(ESLPanel::Patch);
}

void ASLGameMode::ToggleGuide()
{
    if (Panel == ESLPanel::Doc) ClosePanel();
    else OpenPanel(ESLPanel::Doc);
}

void ASLGameMode::ToggleMenu()
{
    if (IsPanelOpen()) ClosePanel();
    else OpenPanel(ESLPanel::Help);
}

ShiftLeft::Stage ASLGameMode::SelectedStage() const
{
    return static_cast<ShiftLeft::Stage>(FMath::Clamp(PanelStation, 0, 4));
}

void ASLGameMode::ApplyAction(ShiftLeft::Action Action)
{
    Incident = ShiftLeft::Apply(Incident, Action, SelectedStage());
    PatchPulse = 0.8f;
    if (Incident.completed || Incident.failed) OpenPanel(ESLPanel::Complete);
}

void ASLGameMode::Validate()
{
    if (Incident.completed || Incident.failed) { OpenPanel(ESLPanel::Complete); return; }
    PanelStation = GetCurrentStageIndex();
    ApplyAction(ShiftLeft::Action::Validate);
    if (!Incident.completed && !Incident.failed) OpenPanel(ESLPanel::Station);
}

void ASLGameMode::SelectChoice(int32 Index)
{
    if (Index < 0 || Index >= GetChoices().Num()) return;
    if (Panel == ESLPanel::Complete) { RestartIncident(); return; }
    if (Panel == ESLPanel::Help)
    {
        if (Index == 1) RestartIncident();
        else if (Index == 2)
        {
            Incident = ShiftLeft::NewIncident(!Incident.guided);
            RestartIncident();
        }
        else ClosePanel();
        return;
    }
    if (Panel == ESLPanel::Doc) { ClosePanel(); return; }
    if (Panel == ESLPanel::Patch)
    {
        ApplyAction(Index == 0 ? ShiftLeft::Action::RouteToRuntime : ShiftLeft::Action::RouteIntoArtifact);
        // Return to the grid so PATCH's reaction and the feedback line are visible.
        PatchPulse = 1.2f;
        if (Panel == ESLPanel::Patch) ClosePanel();
        return;
    }
    if (Panel == ESLPanel::Station)
    {
        if (PanelStation == 4)
        {
            const ShiftLeft::Action Actions[] = {ShiftLeft::Action::InspectUsage, ShiftLeft::Action::RevokeCredential, ShiftLeft::Action::ProvisionReplacement};
            ApplyAction(Actions[Index]);
        }
        else
        {
            const ShiftLeft::Action Actions[] = {ShiftLeft::Action::InspectUsage, ShiftLeft::Action::RemoveSourceLiteral, ShiftLeft::Action::InstallEarlyCheck};
            ApplyAction(Actions[Index]);
        }
    }
}

void ASLGameMode::RestartIncident()
{
    Incident = ShiftLeft::Retry(Incident);
    MillisecondRemainder = 0;
    if (APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0))
        Pawn->SetActorLocation(FVector(2220.f, 0.f, 120.f), false, nullptr, ETeleportType::TeleportPhysics);
    ClosePanel();
}

FString ASLGameMode::GetPanelTitle() const
{
    switch (Panel)
    {
    case ESLPanel::Help: return TEXT("PATCH // THE LEAKED SECRET");
    case ESLPanel::Doc: return TEXT("DOC // LOCAL REFERENCE");
    case ESLPanel::Complete: return Incident.completed ? TEXT("RELEASE VERIFIED") : TEXT("INCIDENT REVIEW");
    case ESLPanel::Patch: return FString::Printf(TEXT("PATCH! // %s"), StageNames[PanelStation]);
    case ESLPanel::Station: return FString::Printf(TEXT("%s // DELIVERY TERMINAL"), StageNames[PanelStation]);
    default: return FString();
    }
}

FString ASLGameMode::GetPanelBody() const
{
    if (Panel == ESLPanel::Help)
        return TEXT("You are PATCH. A credential escaped in a shipped image. Contain the incident and prepare a safe release. SOURCE is left; PRODUCTION is right.\nA / D: move. E: connect. F: Patch! R: validate. Q: DOC. Space: jump. M: music. Esc or H: this guide.\nRepair effort doubles at each stage; budget 24. Reading pauses the clock. Guided mode removes the exposure deadline. Music begins when you enter.");
    if (Panel == ESLPanel::Doc)
        return TEXT("LOCAL REFERENCE / OFFLINE. Authored guidance; no live AI service is connected.\n\nContain: review usage, revoke the exposed key, provision a replacement. Editing a file cannot invalidate a copied credential.\nRoute: a runtime binding gives the service its key. An artifact distributes another extractable copy. If a replacement escapes, revoke it and issue another.\nPrevent: remove the source literal, install an early secret check, then validate. Existing artifacts are separate from source; the runtime route builds a clean image.\n\nEffort from SOURCE to PRODUCTION: 1 / 2 / 4 / 8 / 16. Emergency actions are free. Escape > Retry resets the incident and budget.");
    if (Panel == ESLPanel::Complete)
        return FString::Printf(TEXT("GRADE %s\n\nEffort %d / %d    |    Exposure %.1f seconds    |    Routing incidents %d\n\n%s\n\nOne incident in this vertical slice. Retry to compare another repair location or routing decision."), *FromModel(ShiftLeft::Grade(Incident)), Incident.effortSpent, Incident.budget, static_cast<double>(Incident.exposedMilliseconds) / 1000.0, Incident.mistakes, *FromModel(Incident.feedback));
    const FString Feedback = FromModel(Incident.feedback);
    if (Panel == ESLPanel::Patch)
        return FString::Printf(TEXT("%s\n\nA routing change here costs %d effort. Runtime configuration serves a running process; an artifact is packaged for distribution. Choose the destination."), *Feedback, ShiftLeft::RepairCost(SelectedStage()));
    return FString::Printf(TEXT("%s\n\nRepair effort here: %d. F: Patch! routing. R: validate. Operations actions are free."), *Feedback, ShiftLeft::RepairCost(SelectedStage()));
}

TArray<FSLChoice> ASLGameMode::GetChoices() const
{
    if (Panel == ESLPanel::Help) return {Choice(TEXT("Enter the delivery grid"), TEXT("Continue beside the live service. Reopen this guide with Escape.")),
        Choice(TEXT("Retry with a fresh budget"), TEXT("Restart from PRODUCTION and keep the selected difficulty.")),
        Choice(Incident.guided ? TEXT("Restart in standard mode") : TEXT("Restart in guided mode"),
            Incident.guided ? TEXT("Fresh incident with time pressure while credentials remain exposed.") : TEXT("Fresh incident without the exposure deadline; routing decisions still matter."))};
    if (Panel == ESLPanel::Doc) return {Choice(TEXT("Return to PATCH"), TEXT("Resume the incident clock and continue your own investigation."))};
    if (Panel == ESLPanel::Complete) return {Choice(TEXT("Retry The Leaked Secret"), TEXT("Fresh incident, fresh effort budget. Compare a different approach."))};
    const int32 Cost = ShiftLeft::RepairCost(SelectedStage());
    if (Panel == ESLPanel::Patch)
        return {Choice(TEXT("Bind replacement at runtime"), FString::Printf(TEXT("Connect the service to a runtime secret reference. %d effort."), Cost), Incident.runtimeBound ? TEXT("BOUND") : TEXT("")),
                Choice(TEXT("Include replacement in the artifact"), FString::Printf(TEXT("Package the credential with the image for deployment portability. %d effort."), Cost), Incident.replacementExposed ? TEXT("PACKAGED") : TEXT(""))};
    if (Panel == ESLPanel::Station && PanelStation == 4)
        return {Choice(TEXT("Review credential usage"), TEXT("Read the synthetic access trail and identify exposure. Free."), Incident.usageReviewed ? TEXT("REVIEWED") : TEXT("")),
                Choice(TEXT("Revoke current credential"), TEXT("Invalidate the exposed key at its issuer. Free."), Incident.credentialRevoked ? TEXT("REVOKED") : TEXT("")),
                Choice(TEXT("Provision a replacement"), TEXT("Issue another service credential without choosing its destination yet. Free."), Incident.replacementProvisioned ? TEXT("AVAILABLE") : TEXT(""))};
    if (Panel == ESLPanel::Station)
        return {Choice(TEXT("Review credential usage"), TEXT("Read the same synthetic access trail from this terminal. Free."), Incident.usageReviewed ? TEXT("REVIEWED") : TEXT("")),
                Choice(TEXT("Replace the source literal"), FString::Printf(TEXT("Change hardcoded configuration to a secret reference. %d effort."), Cost), Incident.sourceLiteralRemoved ? TEXT("EDITED") : TEXT("")),
                Choice(TEXT("Add a secret check"), FString::Printf(TEXT("Add detection before future artifacts are released. %d effort."), Cost), Incident.earlyCheck ? TEXT("INSTALLED") : TEXT(""))};
    return {};
}

void ASLGameMode::ToggleMusic()
{
    bMusicEnabled = !bMusicEnabled;
    if (!bMusicEnabled) Score->Stop();
    else if (bHasEnteredGrid && Score->Sound) Score->Play();
}

FString ASLGameMode::GetMusicStatus() const
{
    if (!Score || !Score->Sound) return TEXT("MUSIC / ASSET NOT IMPORTED");
    return bMusicEnabled ? TEXT("M MUSIC / ON") : TEXT("M MUSIC / OFF");
}

bool ASLGameMode::IsMusicPlaying() const
{
    return Score && Score->IsPlaying();
}
