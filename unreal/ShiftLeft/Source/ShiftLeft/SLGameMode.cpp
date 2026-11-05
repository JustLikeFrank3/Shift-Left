#include "SLGameMode.h"
#include "SLDocChat.h"
#include "DeliveryLayout.h"
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
#include "Kismet/KismetSystemLibrary.h"
#include "Sound/SoundBase.h"

namespace
{
    const TCHAR* StageNames[] = {TEXT("SOURCE"), TEXT("BUILD"), TEXT("TEST"), TEXT("STAGING"), TEXT("PRODUCTION")};
    FString FromModel(const std::string& Text) { return UTF8_TO_TCHAR(Text.c_str()); }
    FSLChoice Choice(const TCHAR* Label, const FString& Detail, const TCHAR* State = TEXT(""))
    {
        FSLChoice Result;
        Result.Label = Label; Result.Detail = Detail; Result.State = State;
        return Result;
    }
    FSLChoice ActionChoice(ShiftLeft::Action Action, const TCHAR* Label, const FString& Detail, bool Current = false)
    {
        FSLChoice Result = Choice(Label, Detail, Current ? TEXT("CURRENT") : TEXT(""));
        Result.bHasAction = true;
        Result.ActionId = Action;
        return Result;
    }
}

ASLGameMode::ASLGameMode()
{
    PrimaryActorTick.bCanEverTick = true;
    DefaultPawnClass = ASLPatchCharacter::StaticClass();
    HUDClass = ASLGameHUD::StaticClass();
    Score = CreateDefaultSubobject<UAudioComponent>(TEXT("OriginalScore"));
    DocChat = CreateDefaultSubobject<USLDocChat>(TEXT("DocChat"));
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
        Pawn->SetActorLocation(FVector(ShiftLeftLayout::StartX, 0.f, 120.f), false, nullptr, ETeleportType::TeleportPhysics);
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
    return Pawn ? FMath::Clamp(FMath::RoundToInt((ShiftLeftLayout::StageX(0) - Pawn->GetActorLocation().X) / ShiftLeftLayout::Spacing), 0, 4) : 4;
}

int32 ASLGameMode::GetNearbyStationIndex() const
{
    const APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0);
    if (!Pawn) return -1;
    const int32 Index = GetCurrentStageIndex();
    return FMath::Abs(Pawn->GetActorLocation().X - ShiftLeftLayout::StageX(Index)) <= 420.f ? Index : -1;
}

FString ASLGameMode::GetStationLabel() const
{
    return StageNames[GetCurrentStageIndex()];
}

void ASLGameMode::OpenPanel(ESLPanel NewPanel)
{
    if (Panel == ESLPanel::Doc && NewPanel != ESLPanel::Doc) DocChat->Hide();
    Panel = NewPanel;
    if (APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0))
        if (UMovementComponent* Movement = Pawn->GetMovementComponent()) Movement->StopMovementImmediately();
    UpdatePointer();
    if (NewPanel == ESLPanel::Doc) DocChat->Show();
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
    if (Panel == ESLPanel::Doc) DocChat->Hide();
    if (Incident.completed || Incident.failed) { OpenPanel(ESLPanel::Complete); return; }
    Panel = ESLPanel::None;
    bHasEnteredGrid = true;
    if (bMusicEnabled && Score->Sound && !Score->IsPlaying()) Score->Play();
    UpdatePointer();
}

void ASLGameMode::Interact()
{
    if (Panel == ESLPanel::Patch)
    {
        if (PanelStation == 4) ApplyAction(ShiftLeft::Action::InspectUsage);
        OpenPanel(ESLPanel::Station); return;
    }
    if (IsPanelOpen()) { ClosePanel(); return; }
    const int32 Nearby = GetNearbyStationIndex();
    if (Nearby < 0) return;
    PanelStation = Nearby;
    if (Nearby == 4) ApplyAction(ShiftLeft::Action::InspectUsage);
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
    else { PanelStation = GetCurrentStageIndex(); OpenPanel(ESLPanel::Doc); }
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
    if (!Incident.completed && !Incident.failed) OpenPanel(ESLPanel::Report);
}

void ASLGameMode::SelectChoice(int32 Index)
{
    if (Index < 0 || Index >= GetChoices().Num()) return;
    if (Panel == ESLPanel::Complete) { RestartIncident(); return; }
    if (Panel == ESLPanel::Help)
    {
        if (Index == 3)
        {
            UE_LOG(LogTemp, Display, TEXT("SHIFT LEFT: quit requested from the field guide"));
            UKismetSystemLibrary::QuitGame(this, UGameplayStatics::GetPlayerController(this, 0), EQuitPreference::Quit, false);
            return;
        }
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
    if (Panel == ESLPanel::Report)
    {
        if (Index == 1) ToggleGuide(); else ClosePanel();
        return;
    }
    if (Panel == ESLPanel::Station)
    {
        if (Index == 0) OpenPanel(ESLPanel::Patch); else ClosePanel();
        return;
    }
    if (Panel == ESLPanel::Patch)
    {
        const FSLChoice Selected = GetChoices()[Index];
        if (!Selected.bHasAction) { ClosePanel(); return; }
        if (Selected.ActionId == ShiftLeft::Action::Validate) { Validate(); return; }
        ApplyAction(Selected.ActionId);
        PatchPulse = 1.2f;
        if (Panel == ESLPanel::Patch) ClosePanel();
    }
}

void ASLGameMode::RestartIncident()
{
    Incident = ShiftLeft::Retry(Incident);
    MillisecondRemainder = 0;
    if (APawn* Pawn = UGameplayStatics::GetPlayerPawn(this, 0))
        Pawn->SetActorLocation(FVector(ShiftLeftLayout::StartX, 0.f, 120.f), false, nullptr, ETeleportType::TeleportPhysics);
    ClosePanel();
}

FString ASLGameMode::GetPanelTitle() const
{
    switch (Panel)
    {
    case ESLPanel::Help: return TEXT("PATCH // THE LEAKED SECRET");
    case ESLPanel::Doc: return TEXT("Ask DOC");
    case ESLPanel::Complete: return Incident.completed ? TEXT("RELEASE VERIFIED") : TEXT("INCIDENT REVIEW");
    case ESLPanel::Report: return TEXT("RELEASE REHEARSAL // PROBE RESULTS");
    case ESLPanel::Patch: return FString::Printf(TEXT("%s // CHOOSE AN APPROACH"), StageNames[PanelStation]);
    case ESLPanel::Station: return FString::Printf(TEXT("%s // DELIVERY TERMINAL"), StageNames[PanelStation]);
    default: return FString();
    }
}

FString ASLGameMode::GetEvidence() const
{
    switch (PanelStation)
    {
    case 0:
        return FString::Printf(TEXT("SOURCE is the code used to build the service.\nCurrent key setting: %s\nThe public history still contains the original key.\nChanging these files changes the next build, not keys already copied."),
            Incident.sourceLiteralRemoved ? TEXT("read SERVICE_KEY supplied at startup") : Incident.sourceEncoded ? TEXT("decode an encoded key stored in the code") : TEXT("a key written directly into the code"));
    case 1:
        return FString::Printf(TEXT("BUILD creates the downloadable application package.\nPackage inspection: %s\nKey delivery: %s\nAnyone with the download can unpack its files."),
            Incident.artifactContainsSecret ? TEXT("credential bytes found") : TEXT("no credential bytes found"),
            Incident.runtimeBound ? TEXT("the running service reads from the vault") : TEXT("configuration travels inside the download"));
    case 2:
        return FString::Printf(TEXT("TEST tries bad inputs before a release reaches users.\nProbe: submit a code change containing a fake service key.\nObserved result: %s\nA warning and a stopped release are different outcomes."),
            Incident.earlyCheck ? TEXT("the release was BLOCKED") : Incident.reportOnlyCheck ? TEXT("warning recorded; release ALLOWED") : TEXT("release ALLOWED; no check configured"));
    case 3:
        return TEXT("STAGING is a rehearsal of the release before it reaches users.\nThe rehearsal tries the copied key, a real service request,\na package inspection, and a deliberately bad code change.\nRun it whenever you want evidence about the current candidate.");
    default:
        return FString::Printf(TEXT("PRODUCTION is the live service people use.\nCopied-key request: %s\nService request: %s\nIssuer: %s\nAccess trail: a public download was followed by outside requests.\nA service key is a password used by software."),
            Incident.credentialRevoked ? TEXT("REJECTED") : TEXT("ACCEPTED"),
            ShiftLeft::ServiceResponding(Incident) ? TEXT("200 OK") : TEXT("401 - unauthorized"),
            Incident.replacementProvisioned ? TEXT("a replacement key exists") : TEXT("no replacement key issued"));
    }
}

FString ASLGameMode::GetPanelBody() const
{
    if (Panel == ESLPanel::Help)
        return TEXT("Someone copied the service's password from a public download. You are PATCH, sent to investigate.\nWin when copied keys stop working, the service works, and a new release passes the leak rehearsal.\nA / D: walk. E: read a terminal. F: choose a change. R: rehearse. Q: ask DOC anything.\nSOURCE is code; BUILD packages it; TEST checks it; STAGING rehearses; PRODUCTION runs it.\nReading pauses time. Guided mode removes the deadline. Changes use a 24-point repair budget. M: music.");
    if (Panel == ESLPanel::Doc)
        return TEXT("Type a game question. Send uses live DOC; Offline guide stays local. Escape returns to PATCH.");
    if (Panel == ESLPanel::Report)
        return FromModel(ShiftLeft::ReleaseReadout(Incident));
    if (Panel == ESLPanel::Complete)
        return FString::Printf(TEXT("GRADE %s\nEffort %d / %d    |    Exposure %.1f seconds    |    New key leaks %d\n\n%s\n\nReplay to compare decisions. Changing your approach costs effort; reading evidence and operations are free."), *FromModel(ShiftLeft::Grade(Incident)), Incident.effortSpent, Incident.budget, static_cast<double>(Incident.exposedMilliseconds) / 1000.0, Incident.mistakes, *FromModel(Incident.feedback));
    if (Panel == ESLPanel::Station) return GetEvidence();
    if (PanelStation == 4)
        return TEXT("Decide what to change in the live service. Operations are free.\nA deployment rollback changes the running version. The key issuer controls which passwords are accepted.\nDisabling a key can also interrupt the service using it.");
    if (PanelStation == 3) return GetEvidence();
    return FString::Printf(TEXT("%s\n\nEach changed approach here costs %d effort. Changes replace the current approach. Compare the evidence; Q asks DOC."),
        *GetEvidence(), ShiftLeft::RepairCost(SelectedStage()));
}

TArray<FSLChoice> ASLGameMode::GetChoices() const
{
    using A = ShiftLeft::Action;
    if (Panel == ESLPanel::Help) return {Choice(TEXT("Start / resume investigation"), TEXT("Begin beside the live service. E reads the terminal; Q opens DOC.")),
        Choice(TEXT("Retry with a fresh budget"), TEXT("Restart from PRODUCTION and keep the selected difficulty.")),
        Choice(Incident.guided ? TEXT("Restart in standard mode") : TEXT("Restart in guided mode"),
            Incident.guided ? TEXT("Time pressure while copied keys still work.") : TEXT("No exposure deadline. Choices and repair budget still matter.")),
        Choice(TEXT("Quit SHIFT LEFT"), TEXT("Close the game. Progress in this incident is not saved."))};
    if (Panel == ESLPanel::Doc) return {Choice(TEXT("Return to PATCH"), TEXT("Continue your investigation."))};
    if (Panel == ESLPanel::Complete) return {Choice(TEXT("Retry The Leaked Secret"), TEXT("Fresh incident and budget. Try another approach."))};
    if (Panel == ESLPanel::Report) return {Choice(TEXT("Return to the corridor"), TEXT("Keep investigating the probe results.")), Choice(TEXT("Ask DOC"), TEXT("Ask a plain-language question about what happened."))};
    if (Panel == ESLPanel::Station) return {Choice(TEXT("Choose an approach here"), TEXT("Compare the available changes. F opens this directly.")), Choice(TEXT("Return to the corridor"), TEXT("Keep exploring. Q opens DOC whenever you need an explanation."))};
    if (Panel != ESLPanel::Patch) return {};
    switch (PanelStation)
    {
    case 0: return {
        ActionChoice(A::EncodeSourceLiteral, TEXT("Encode the key in the code"), TEXT("Store an encoded string; decode it when the application starts."), Incident.sourceEncoded),
        ActionChoice(A::RemoveSourceLiteral, TEXT("Read a key supplied at startup"), TEXT("Keep only the setting name in code; the deployment supplies its value."), Incident.sourceLiteralRemoved)};
    case 1: return {
        ActionChoice(A::RouteToRuntime, TEXT("Fetch the key when the service starts"), TEXT("The package carries a vault reference; the running service resolves it."), Incident.runtimeBound),
        ActionChoice(A::RouteIntoArtifact, TEXT("Copy the key into the deployment package"), TEXT("The package carries everything it needs; no vault lookup during startup."), Incident.replacementExposed)};
    case 2: return {
        ActionChoice(A::ReportOnlyCheck, TEXT("Record findings and keep releases moving"), TEXT("Scan code and packages; write findings to the report without stopping delivery."), Incident.reportOnlyCheck),
        ActionChoice(A::InstallEarlyCheck, TEXT("Hold releases when the scanner finds a key"), TEXT("Scan code and packages; require the finding to be resolved before delivery."), Incident.earlyCheck)};
    case 3: return {
        ActionChoice(A::Validate, TEXT("Run the release rehearsal"), TEXT("Try the candidate against the service and leak probes. Free.")),
        Choice(TEXT("Keep investigating"), TEXT("Return without running a rehearsal."))};
    default: return {
        ActionChoice(A::RollBackRelease, TEXT("Roll back the application"), TEXT("Run the previous package with its previous configuration. Free.")),
        ActionChoice(A::ProvisionReplacement, TEXT("Issue a new service key"), TEXT("Create a key in the managed vault. Existing keys and the running service stay as they are. Free.")),
        ActionChoice(A::RevokeCredential, TEXT("Disable the exposed keys"), TEXT("Tell the issuer to reject copied keys, including any used by the service. Free."))};
    }
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
