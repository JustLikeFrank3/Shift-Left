#include "SLAutoplay.h"
#include "SLGameMode.h"
#include "SLDocChat.h"
#include "SLDeliveryWorld.h"
#include "Components/TextRenderComponent.h"
#include "EngineUtils.h"
#include "Engine/World.h"
#include "GameFramework/Pawn.h"
#include "GameFramework/PlayerController.h"
#include "Camera/PlayerCameraManager.h"
#include "GameFramework/WorldSettings.h"
#include "Framework/Application/SlateApplication.h"
#include "HAL/PlatformMisc.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/App.h"
#include "Misc/Paths.h"
#include "Misc/ConfigCacheIni.h"
#include "UnrealClient.h"

DEFINE_LOG_CATEGORY_STATIC(LogSLAutoplay, Display, All);

namespace
{
    constexpr float StationX(int32 Station) { return 2400.f - Station * 1200.f; }
    const TCHAR* PanelName(ESLPanel Panel)
    {
        switch (Panel)
        {
        case ESLPanel::None: return TEXT("None");
        case ESLPanel::Station: return TEXT("Station");
        case ESLPanel::Patch: return TEXT("Patch");
        case ESLPanel::Doc: return TEXT("Doc");
        case ESLPanel::Help: return TEXT("Help");
        case ESLPanel::Complete: return TEXT("Complete");
        }
        return TEXT("?");
    }
    const APawn* Player(const UObject* Context) { return UGameplayStatics::GetPlayerPawn(Context, 0); }
}

ASLAutoplay::ASLAutoplay()
{
    PrimaryActorTick.bCanEverTick = true;
    PrimaryActorTick.bTickEvenWhenPaused = true;
}

ASLGameMode* ASLAutoplay::Mode() const
{
    return GetWorld() ? GetWorld()->GetAuthGameMode<ASLGameMode>() : nullptr;
}

void ASLAutoplay::BeginPlay()
{
    Super::BeginPlay();
    FParse::Value(FCommandLine::Get(), TEXT("SLAutoplay="), Scenario);
    Build();
    UE_LOG(LogSLAutoplay, Display, TEXT("AUTOPLAY scenario=%s steps=%d"), *Scenario, Steps.Num());
}

void ASLAutoplay::SendKey(const FKey& Key, bool bDown)
{
    // Real key events through Slate reach the viewport and the legacy input bindings.
    FSlateApplication& Slate = FSlateApplication::Get();
    // Keep a real text field's focus. Forcing the viewport before every injected
    // key made UI-only DOC unable to receive Escape or ordinary typing.
    if (!Mode() || Mode()->GetPanel() != ESLPanel::Doc) Slate.SetAllUserFocusToGameViewport();
    const FKeyEvent Event(Key, FModifierKeysState(), 0, false, 0, 0);
    const bool bHandled = bDown ? Slate.ProcessKeyDownEvent(Event) : Slate.ProcessKeyUpEvent(Event);
    if (bDown) HeldKeys.Add(Key); else HeldKeys.Remove(Key);
    UE_LOG(LogSLAutoplay, Display, TEXT("KEY %s %s handled=%d"), *Key.ToString(), bDown ? TEXT("down") : TEXT("up"), bHandled ? 1 : 0);
}

void ASLAutoplay::Wait(float Seconds)
{
    Steps.Add([this, Seconds](float) { return StepTime >= Seconds; });
}

void ASLAutoplay::Tap(const FKey& Key, float After)
{
    Steps.Add([this, Key](float) { SendKey(Key, true); return true; });
    Wait(.06f);
    Steps.Add([this, Key](float) { SendKey(Key, false); return true; });
    Wait(After);
}

void ASLAutoplay::Hold(const FKey& Key, float Seconds)
{
    Steps.Add([this, Key](float) { SendKey(Key, true); return true; });
    Wait(Seconds);
    Steps.Add([this, Key](float) { SendKey(Key, false); return true; });
}

void ASLAutoplay::WalkTo(int32 Station)
{
    Steps.Add([this, Station](float)
    {
        const APawn* Pawn = Player(this);
        if (!Pawn) return false;
        const float Delta = StationX(Station) - Pawn->GetActorLocation().X;
        const FKey Want = Delta < 0.f ? EKeys::D : EKeys::A;
        const FKey Other = Delta < 0.f ? EKeys::A : EKeys::D;
        if (FMath::Abs(Delta) < 70.f || StepTime > 20.f)
        {
            if (HeldKeys.Contains(Want)) SendKey(Want, false);
            if (HeldKeys.Contains(Other)) SendKey(Other, false);
            if (StepTime > 20.f) { ++Failures; UE_LOG(LogSLAutoplay, Error, TEXT("FAIL walk to station %d timed out: %s"), Station, *Describe()); }
            return true;
        }
        if (HeldKeys.Contains(Other)) SendKey(Other, false);
        if (!HeldKeys.Contains(Want)) SendKey(Want, true);
        return false;
    });
    Wait(.5f);
}

void ASLAutoplay::Shot(const FString& Name)
{
    Steps.Add([this, Name](float)
    {
        const FString File = FPaths::ConvertRelativePathToFull(FPaths::ProjectSavedDir() / TEXT("Autoplay") /
            FString::Printf(TEXT("%s-%02d-%s.png"), *Scenario, ShotIndex++, *Name));
        FScreenshotRequest::RequestScreenshot(File, true, false);
        UE_LOG(LogSLAutoplay, Display, TEXT("SHOT %s | %s"), *File, *Describe());
        return true;
    });
    Wait(.25f);
}

void ASLAutoplay::Log(const FString& Label)
{
    Steps.Add([this, Label](float) { UE_LOG(LogSLAutoplay, Display, TEXT("STATE %s | %s"), *Label, *Describe()); return true; });
}

void ASLAutoplay::Expect(const FString& Label, TFunction<bool(const ASLGameMode&)> Check)
{
    Steps.Add([this, Label, Check](float)
    {
        const ASLGameMode* GM = Mode();
        const bool bPass = GM && Check(*GM);
        if (!bPass) ++Failures;
        UE_LOG(LogSLAutoplay, Display, TEXT("%s %s | %s"), bPass ? TEXT("PASS") : TEXT("FAIL"), *Label, *Describe());
        return true;
    });
}

FString ASLAutoplay::Describe() const
{
    const ASLGameMode* GM = Mode();
    if (!GM) return TEXT("no game mode");
    const ShiftLeft::IncidentState& S = GM->GetIncident();
    const APawn* Pawn = Player(this);
    const FVector P = Pawn ? Pawn->GetActorLocation() : FVector::ZeroVector;
    return FString::Printf(TEXT("panel=%s x=%.0f z=%.0f station=%d revoked=%d reviewed=%d provisioned=%d literal=%d runtime=%d artifactSecret=%d check=%d replacementExposed=%d effort=%d/%d mistakes=%d pressure=%d exposedMs=%lld guided=%d completed=%d failed=%d music=%d grade=%s feedback=\"%s\""),
        PanelName(GM->GetPanel()), P.X, P.Z, GM->GetNearbyStationIndex(), S.credentialRevoked, S.usageReviewed, S.replacementProvisioned,
        S.sourceLiteralRemoved, S.runtimeBound, S.artifactContainsSecret, S.earlyCheck, S.replacementExposed, S.effortSpent, S.budget,
        S.mistakes, S.pressure, static_cast<long long>(S.exposedMilliseconds), S.guided, S.completed, S.failed, GM->IsMusicPlaying() ? 1 : 0,
        UTF8_TO_TCHAR(ShiftLeft::Grade(S).c_str()), UTF8_TO_TCHAR(S.feedback.c_str()));
}

void ASLAutoplay::Build()
{
    // Let shaders and streaming settle before the first capture.
    Wait(4.f);
    Shot(TEXT("help"));
    Expect(TEXT("help panel opens at start"), [](const ASLGameMode& M) { return M.GetPanel() == ESLPanel::Help; });

    const auto Contain = [this]()
    {
        Tap(EKeys::E);
        Tap(EKeys::One); Tap(EKeys::Two); Tap(EKeys::Three);
    };
    const auto SourceRepairs = [this]()
    {
        WalkTo(0);
        Tap(EKeys::E);
        Tap(EKeys::Two); Tap(EKeys::Three);
        Tap(EKeys::E);
        Tap(EKeys::F);
        Tap(EKeys::One, 1.4f);
    };

    if (Scenario == TEXT("layout"))
    {
        Tap(EKeys::One, 1.5f);
        Expect(TEXT("rendered station signs match gameplay coordinates"), [this](const ASLGameMode&)
        {
            int32 Found = 0;
            const TCHAR* Names[] = {TEXT("SOURCE"),TEXT("BUILD"),TEXT("TEST"),TEXT("STAGING"),TEXT("PRODUCTION")};
            for (TActorIterator<ASLDeliveryWorld> It(GetWorld()); It; ++It)
            {
                TArray<UTextRenderComponent*> Signs;
                It->GetComponents(Signs);
                for (const auto* Sign : Signs)
                    for (int32 Stage=0; Stage<5; ++Stage)
                        if (Sign->Text.ToString() == Names[Stage])
                        {
                            ++Found;
                            UE_LOG(LogSLAutoplay, Display, TEXT("SIGN %s world=%s"), Names[Stage], *Sign->GetComponentLocation().ToString());
                            if (FMath::Abs(Sign->GetComponentLocation().X - StationX(Stage)) > 1.f) return false;
                        }
            }
            return Found == 5;
        });
        Shot(TEXT("production-start"));
        WalkTo(0);
        Shot(TEXT("source-arrival"));
        Hold(EKeys::Left, 2.f);
        Wait(.5f);
        Expect(TEXT("left endpoint is SOURCE and remains grounded"), [this](const ASLGameMode& M)
        {
            const FVector P = Player(this)->GetActorLocation();
            return M.GetCurrentStageIndex() == 0 && P.X > 2900.f && P.Z > 90.f && P.Z < 115.f;
        });
        Shot(TEXT("left-limit-source"));
        WalkTo(4);
        Shot(TEXT("production-arrival"));
        Hold(EKeys::Right, 2.f);
        Wait(.5f);
        Expect(TEXT("right endpoint is PRODUCTION and remains grounded"), [this](const ASLGameMode& M)
        {
            const FVector P = Player(this)->GetActorLocation();
            return M.GetCurrentStageIndex() == 4 && P.X < -2900.f && P.Z > 90.f && P.Z < 115.f;
        });
        Shot(TEXT("right-limit-production"));
    }
    else if (Scenario == TEXT("complete"))
    {
        Tap(EKeys::One, 1.5f);
        Shot(TEXT("grid-production"));
        Expect(TEXT("entering the grid starts music"), [](const ASLGameMode& M) { return M.IsMusicPlaying(); });
        Expect(TEXT("source to production agrees with screen-right"), [this](const ASLGameMode& M)
        {
            const auto* PC = UGameplayStatics::GetPlayerController(this, 0);
            return PC && PC->PlayerCameraManager && M.GetCurrentStageIndex() == 4
                && FVector::DotProduct(PC->PlayerCameraManager->GetCameraRotation().RotateVector(FVector::RightVector), FVector(StationX(4)-StationX(0),0,0)) > 4000.f;
        });
        const auto BeforeMove = MakeShared<FVector>(FVector::ZeroVector);
        Steps.Add([this, BeforeMove](float) { *BeforeMove = Player(this)->GetActorLocation(); return true; });
        Steps.Add([this](float) { SendKey(EKeys::D, true); return true; });
        Wait(.45f);
        Expect(TEXT("D moves right on screen"), [this, BeforeMove](const ASLGameMode&)
        {
            auto* PC = UGameplayStatics::GetPlayerController(this, 0);
            FVector2D Before, After;
            return PC && PC->ProjectWorldLocationToScreen(*BeforeMove, Before)
                && PC->ProjectWorldLocationToScreen(Player(this)->GetActorLocation(), After) && After.X > Before.X + 50.f;
        });
        Shot(TEXT("walk-right"));
        Steps.Add([this](float) { SendKey(EKeys::D, false); return true; });
        Wait(.6f);
        Steps.Add([this](float) { SendKey(EKeys::SpaceBar, true); return true; });
        Wait(.25f);
        Expect(TEXT("space has no unrelated jump action"), [this](const ASLGameMode&) { return Player(this) && Player(this)->GetActorLocation().Z < 115.f; });
        Shot(TEXT("grounded"));
        Steps.Add([this](float) { SendKey(EKeys::SpaceBar, false); return true; });
        Wait(1.2f);
        Expect(TEXT("floor collision keeps PATCH grounded"), [this](const ASLGameMode&) { const float Z = Player(this) ? Player(this)->GetActorLocation().Z : -1.f; return Z > 90.f && Z < 115.f; });
        WalkTo(4);
        Tap(EKeys::E);
        Shot(TEXT("production-terminal"));
        Tap(EKeys::One); Tap(EKeys::Two); Tap(EKeys::Three);
        Shot(TEXT("production-contained"));
        Expect(TEXT("containment is free"), [](const ASLGameMode& M) { const auto& S = M.GetIncident(); return S.credentialRevoked && S.usageReviewed && S.replacementProvisioned && S.effortSpent == 0; });
        Tap(EKeys::E);
        Steps.Add([this](float) { SendKey(EKeys::A, true); return true; });
        Wait(4.f);
        Shot(TEXT("walk-left-midgrid"));
        Steps.Add([this](float) { SendKey(EKeys::A, false); return true; });
        WalkTo(0);
        Shot(TEXT("source-arrival"));
        Tap(EKeys::E);
        Tap(EKeys::Two); Tap(EKeys::Three);
        Shot(TEXT("source-repaired"));
        Tap(EKeys::E);
        Tap(EKeys::F, .5f);
        Shot(TEXT("patch-panel"));
        Steps.Add([this](float) { SendKey(EKeys::One, true); return true; });
        Wait(.06f);
        Steps.Add([this](float) { SendKey(EKeys::One, false); return true; });
        Wait(.15f);
        Shot(TEXT("patch-feedback"));
        Wait(.6f);
        Expect(TEXT("source repairs cost 3"), [](const ASLGameMode& M) { const auto& S = M.GetIncident(); return S.sourceLiteralRemoved && S.earlyCheck && S.runtimeBound && S.effortSpent == 3; });
        Tap(EKeys::R, 1.f);
        Shot(TEXT("complete"));
        Expect(TEXT("validated release with mistakes 0"), [](const ASLGameMode& M) { const auto& S = M.GetIncident(); return S.completed && S.mistakes == 0 && M.GetPanel() == ESLPanel::Complete; });
    }
    else if (Scenario == TEXT("wrong"))
    {
        Tap(EKeys::One, 1.f);
        Contain();
        Tap(EKeys::E);
        Tap(EKeys::F);
        Tap(EKeys::Two, .15f);
        Shot(TEXT("artifact-route"));
        Expect(TEXT("artifact route re-exposes the replacement"), [](const ASLGameMode& M) { const auto& S = M.GetIncident(); return S.replacementExposed && !S.credentialRevoked && S.mistakes == 1 && S.effortSpent == 16 && S.pressure >= 25; });
        Wait(2.f);
        Expect(TEXT("exposure clock runs again"), [](const ASLGameMode& M) { return M.GetIncident().exposedMilliseconds > 1500; });
        Tap(EKeys::E);
        Tap(EKeys::One); Tap(EKeys::Two); Tap(EKeys::Three);
        Shot(TEXT("recovered"));
        Expect(TEXT("revoke + fresh replacement recovers"), [](const ASLGameMode& M) { const auto& S = M.GetIncident(); return S.credentialRevoked && S.replacementProvisioned && !S.replacementExposed && S.usageReviewed; });
        Tap(EKeys::E);
        SourceRepairs();
        Tap(EKeys::R, 1.f);
        Shot(TEXT("complete"));
        Expect(TEXT("recovered run validates with one mistake"), [](const ASLGameMode& M) { const auto& S = M.GetIncident(); return S.completed && S.mistakes == 1 && S.effortSpent == 19; });
    }
    else if (Scenario == TEXT("budget"))
    {
        Tap(EKeys::One, 1.f);
        Contain();
        Tap(EKeys::E);
        Tap(EKeys::F); Tap(EKeys::One, 1.4f);
        WalkTo(3);
        Tap(EKeys::E);
        Tap(EKeys::Two); Tap(EKeys::Three, .6f);
        Shot(TEXT("budget-exhausted"));
        Expect(TEXT("unaffordable repair changes nothing"), [](const ASLGameMode& M) { const auto& S = M.GetIncident(); return S.effortSpent == 24 && S.sourceLiteralRemoved && !S.earlyCheck && !S.completed; });
        Tap(EKeys::E);
        Tap(EKeys::Escape, .5f);
        Tap(EKeys::Two, 1.f);
        Shot(TEXT("retry"));
        Expect(TEXT("retry restores budget and position"), [this](const ASLGameMode& M) { const auto& S = M.GetIncident(); return S.effortSpent == 0 && !S.credentialRevoked && M.GetPanel() == ESLPanel::None && Player(this) && FMath::Abs(Player(this)->GetActorLocation().X + 2220.f) < 60.f; });
    }
    else if (Scenario == TEXT("guided"))
    {
        Tap(EKeys::Three, 1.f);
        Expect(TEXT("guided mode selected"), [](const ASLGameMode& M) { return M.GetIncident().guided && M.GetPanel() == ESLPanel::None; });
        Steps.Add([this](float) { GetWorldSettings()->SetTimeDilation(20.f); return true; });
        Wait(12.f);
        Steps.Add([this](float) { GetWorldSettings()->SetTimeDilation(1.f); return true; });
        Shot(TEXT("guided-long-exposure"));
        Expect(TEXT("guided mode survives past the standard deadline"), [](const ASLGameMode& M) { const auto& S = M.GetIncident(); return !S.failed && S.exposedMilliseconds > 180000 && S.pressure == 0; });
        Tap(EKeys::Escape, .5f);
        Tap(EKeys::Three, 1.f);
        Expect(TEXT("standard mode selected"), [](const ASLGameMode& M) { return !M.GetIncident().guided && M.GetIncident().exposedMilliseconds < 2000; });
        Steps.Add([this](float) { GetWorldSettings()->SetTimeDilation(20.f); return true; });
        Wait(12.f);
        Steps.Add([this](float) { GetWorldSettings()->SetTimeDilation(1.f); return true; });
        Shot(TEXT("standard-failure"));
        Expect(TEXT("standard mode fails at the deadline"), [](const ASLGameMode& M) { const auto& S = M.GetIncident(); return S.failed && S.exposedMilliseconds == 180000 && M.GetPanel() == ESLPanel::Complete; });
        Tap(EKeys::One, 1.f);
        Expect(TEXT("retry after failure starts fresh"), [](const ASLGameMode& M) { const auto& S = M.GetIncident(); return !S.failed && S.exposedMilliseconds < 2000 && M.GetPanel() == ESLPanel::None; });
    }
    else if (Scenario == TEXT("pause"))
    {
        Tap(EKeys::One, 2.f);
        TSharedRef<int64> Before = MakeShared<int64>(0);
        Steps.Add([this, Before](float) { *Before = Mode()->GetIncident().exposedMilliseconds; return true; });
        Tap(EKeys::Q, .5f);
        Shot(TEXT("doc-panel"));
        Steps.Add([this](float) { SendKey(EKeys::D, true); return true; });
        Wait(4.f);
        Steps.Add([this](float) { SendKey(EKeys::D, false); return true; });
        Expect(TEXT("DOC pauses exposure and movement"), [this, Before](const ASLGameMode& M) { return M.GetIncident().exposedMilliseconds - *Before < 600 && Player(this) && FMath::Abs(Player(this)->GetActorLocation().X + 2220.f) < 30.f; });
        Tap(EKeys::Escape, 2.f);
        Expect(TEXT("closing DOC resumes exposure"), [Before](const ASLGameMode& M) { return M.GetIncident().exposedMilliseconds - *Before > 1500; });
        Tap(EKeys::M, .5f);
        Expect(TEXT("M stops music"), [](const ASLGameMode& M) { return !M.IsMusicPlaying(); });
        Shot(TEXT("music-off"));
        Tap(EKeys::M, .5f);
        Expect(TEXT("M restarts music"), [](const ASLGameMode& M) { return M.IsMusicPlaying(); });
    }
    else if (Scenario == TEXT("doc") || Scenario == TEXT("doc-live"))
    {
        Tap(EKeys::One, .5f);
        Tap(EKeys::Q, .5f);
        Shot(TEXT("question-panel"));
        Steps.Add([](float)
        {
            for (TCHAR Character : FString(TEXT("adq"))) FSlateApplication::Get().ProcessKeyCharEvent(FCharacterEvent(Character, FModifierKeysState(), 0, false));
            return true;
        });
        Expect(TEXT("typing movement and DOC keys edits the question"), [](const ASLGameMode& M)
        {
            return M.GetDocChat()->GetDraft() == TEXT("adq") && M.GetPanel() == ESLPanel::Doc;
        });
        Steps.Add([this](float)
        {
            Mode()->GetDocChat()->Ask(TEXT("Why isn't deleting the exposed key from source enough?"), Scenario == TEXT("doc"));
            return true;
        });
        Steps.Add([this](float) { return !Mode()->GetDocChat()->IsPending() || StepTime > 35.f; });
        Expect(TEXT("DOC answers a plain-language question and preserves the incident"), [this](const ASLGameMode& M)
        {
            const auto* Doc = M.GetDocChat();
            return !Doc->IsPending() && Doc->GetTranscript().Contains(TEXT("You: Why isn't deleting"))
                && Doc->GetTranscript().Contains(Scenario == TEXT("doc") ? TEXT("Offline guide:") : TEXT("DOC (live):"))
                && !M.GetIncident().credentialRevoked && M.GetIncident().effortSpent == 0 && M.GetPanel() == ESLPanel::Doc;
        });
        Shot(TEXT("answer"));
        if (Scenario == TEXT("doc"))
        {
            Steps.Add([this](float)
            {
                FString Agent;
                GConfig->GetString(TEXT("ShiftLeft.Doc"), TEXT("AgentId"), Agent, GGameIni);
                GConfig->SetString(TEXT("ShiftLeft.Doc"), TEXT("AgentId"), TEXT(""), GGameIni);
                Mode()->GetDocChat()->Ask(TEXT("What is runtime routing?"));
                GConfig->SetString(TEXT("ShiftLeft.Doc"), TEXT("AgentId"), *Agent, GGameIni);
                return true;
            });
            Expect(TEXT("unavailable live DOC labels its offline fallback"), [](const ASLGameMode& M)
            {
                return !M.GetDocChat()->IsPending() && M.GetDocChat()->GetStatus().Contains(TEXT("not an AI answer"));
            });
            Shot(TEXT("offline-fallback"));
        }
        else
        {
            Steps.Add([this](float) { Mode()->GetDocChat()->Ask(TEXT("What should I inspect next?")); return true; });
        }
        Tap(EKeys::Escape, .5f);
        Expect(TEXT("Escape closes DOC and cancels pending work"), [](const ASLGameMode& M) { return M.GetPanel() == ESLPanel::None && !M.GetDocChat()->IsPending(); });
    }
    else if (Scenario == TEXT("quit"))
    {
        Tap(EKeys::One, 1.f);
        Tap(EKeys::H, .6f);
        Shot(TEXT("help-with-quit"));
        Expect(TEXT("H opens the field guide with a Quit choice"), [](const ASLGameMode& M) { return M.GetPanel() == ESLPanel::Help && M.GetChoices().Num() == 4; });
        Steps.Add([this](float) { bQuitPressed = Failures == 0; SendKey(EKeys::Four, true); return true; });
        Wait(.06f);
        Steps.Add([this](float) { SendKey(EKeys::Four, false); return true; });
        // Reaching the next step means the game is still running.
        Wait(6.f);
        Steps.Add([this](float) { bQuitPressed = false; ++Failures; UE_LOG(LogSLAutoplay, Error, TEXT("FAIL pressing 4 in the field guide did not quit")); return true; });
    }
    else
    {
        Steps.Add([this](float) { ++Failures; UE_LOG(LogSLAutoplay, Error, TEXT("Unknown scenario '%s' (complete|wrong|budget|guided|pause|quit)"), *Scenario); return true; });
    }
    Log(TEXT("final"));
}

void ASLAutoplay::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    // Undilated time, so the guided scenario can accelerate the game clock.
    const float RealDelta = static_cast<float>(FApp::GetDeltaTime());
    StepTime += RealDelta;
    // At most one step completes per frame, so key events land in separate input ticks.
    if (StepIndex < Steps.Num() && Steps[StepIndex](RealDelta))
    {
        ++StepIndex;
        StepTime = 0.f;
    }
    if (StepIndex == Steps.Num())
    {
        UE_LOG(LogSLAutoplay, Display, TEXT("AUTOPLAY RESULT %s scenario=%s failures=%d"), Failures == 0 ? TEXT("PASS") : TEXT("FAIL"), *Scenario, Failures);
        bResultLogged = true;
        ++StepIndex;
        FPlatformMisc::RequestExit(false);
    }
}

void ASLAutoplay::EndPlay(const EEndPlayReason::Type Reason)
{
    // The quit scenario passes only if the game shuts down after the Quit choice.
    if (!bResultLogged && Scenario == TEXT("quit"))
    {
        const bool bPass = bQuitPressed && Failures == 0 && Reason == EEndPlayReason::Quit;
        UE_LOG(LogSLAutoplay, Display, TEXT("AUTOPLAY RESULT %s scenario=quit failures=%d endReason=%d"), bPass ? TEXT("PASS") : TEXT("FAIL"), bPass ? 0 : FMath::Max(Failures, 1), static_cast<int32>(Reason));
        bResultLogged = true;
    }
    Super::EndPlay(Reason);
}
