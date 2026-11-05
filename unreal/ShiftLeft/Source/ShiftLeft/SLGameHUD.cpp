#include "SLGameHUD.h"

#include "SLGameMode.h"
#include "CanvasItem.h"
#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "Engine/Font.h"
#include "Kismet/GameplayStatics.h"

namespace
{
    const FLinearColor Ink(0.019f, 0.043f, 0.073f, 0.97f);
    const FLinearColor Surface(0.035f, 0.075f, 0.11f, 0.96f);
    const FLinearColor White(0.92f, 0.97f, 1.f, 1.f);
    const FLinearColor Muted(0.55f, 0.7f, 0.77f, 1.f);
    const FLinearColor Teal(0.18f, 0.92f, 0.79f, 1.f);
    const FLinearColor Coral(1.f, 0.38f, 0.29f, 1.f);
    const FLinearColor Hairline(0.13f, 0.29f, 0.35f, 1.f);

    UFont* HUDFont()
    {
        return GEngine ? GEngine->GetMediumFont() : nullptr;
    }

    float NativeFontHeight(UCanvas* Canvas)
    {
        float Width = 0.f;
        float Height = 0.f;
        if (Canvas && HUDFont())
        {
            Canvas->StrLen(HUDFont(), TEXT("Ag"), Width, Height);
        }
        return FMath::Max(Height, 1.f);
    }
}

FVector2D ASLGameHUD::Screen(float X, float Y) const
{
    return Origin + FVector2D(X, Y) * UIScale;
}

void ASLGameHUD::Box(float X, float Y, float W, float H, const FLinearColor& Color)
{
    const FVector2D P = Screen(X, Y);
    DrawRect(Color, P.X, P.Y, W * UIScale, H * UIScale);
}

void ASLGameHUD::Rule(float X, float Y, float W, const FLinearColor& Color, float Thickness)
{
    Box(X, Y, W, Thickness, Color);
}

void ASLGameHUD::Text(const FString& Value, float X, float Y, float Size, const FLinearColor& Color)
{
    if (!Canvas || !HUDFont())
    {
        return;
    }
    FCanvasTextItem Item(Screen(X, Y), FText::FromString(Value), HUDFont(), Color);
    Item.Scale = FVector2D(Size * UIScale / NativeFontHeight(Canvas));
    Item.EnableShadow(FLinearColor(0.f, 0.f, 0.f, 0.55f), FVector2D(1.f, 1.f));
    Canvas->DrawItem(Item);
}

float ASLGameHUD::Measure(const FString& Value, float Size) const
{
    if (!Canvas || !HUDFont())
    {
        return 0.f;
    }
    float Width = 0.f;
    float Height = 0.f;
    Canvas->StrLen(HUDFont(), Value, Width, Height);
    return Width * Size / NativeFontHeight(Canvas);
}

float ASLGameHUD::Wrapped(const FString& Value, float X, float Y, float W, float Size,
                         const FLinearColor& Color, int32 MaxLines)
{
    TArray<FString> Paragraphs;
    Value.ParseIntoArrayLines(Paragraphs, false);
    int32 Lines = 0;
    const float LineHeight = Size * 1.35f;
    for (const FString& Paragraph : Paragraphs)
    {
        TArray<FString> Words;
        Paragraph.ParseIntoArray(Words, TEXT(" "), true);
        FString Line;
        for (const FString& Word : Words)
        {
            const FString Candidate = Line.IsEmpty() ? Word : Line + TEXT(" ") + Word;
            if (!Line.IsEmpty() && Measure(Candidate, Size) > W)
            {
                if (Lines >= MaxLines)
                {
                    return Lines * LineHeight;
                }
                Text(Line, X, Y + Lines * LineHeight, Size, Color);
                ++Lines;
                Line = Word;
            }
            else
            {
                Line = Candidate;
            }
        }
        if (Lines >= MaxLines)
        {
            return Lines * LineHeight;
        }
        Text(Line, X, Y + Lines * LineHeight, Size, Color);
        ++Lines;
    }
    return Lines * LineHeight;
}

void ASLGameHUD::HitBox(float X, float Y, float W, float H, FName Name, int32 Priority)
{
    AddHitBox(Screen(X, Y), FVector2D(W, H) * UIScale, Name, true, Priority);
}

void ASLGameHUD::DrawHUD()
{
    Super::DrawHUD();
    if (!Canvas)
    {
        return;
    }
    ASLGameMode* Mode = Cast<ASLGameMode>(UGameplayStatics::GetGameMode(this));
    if (!Mode)
    {
        return;
    }

    UIScale = FMath::Min(Canvas->SizeX / 1600.f, Canvas->SizeY / 900.f);
    Origin = FVector2D((Canvas->SizeX - 1600.f * UIScale) * .5f,
                       (Canvas->SizeY - 900.f * UIScale) * .5f);

    DrawStatus(*Mode);
    DrawPipeline(*Mode);
    if (Mode->IsPanelOpen() && Mode->GetPanel() != ESLPanel::Doc)
    {
        DrawPanel(*Mode);
    }
    else if (!Mode->IsPanelOpen())
    {
        const bool bNearby = Mode->GetNearbyStationIndex() >= 0;
        const FString Prompt = bNearby
            ? FString::Printf(TEXT("E  READ %s     F  CHOOSE A CHANGE"), *Mode->GetStationLabel())
            : TEXT("A / D  WALK TO A TERMINAL     Q  ASK DOC");
        const float Width = FMath::Max(Measure(Prompt, 20.f) + 64.f, 430.f);
        Box(800.f - Width * .5f, 654.f, Width, 44.f, Ink);
        Rule(800.f - Width * .5f, 654.f, Width, Teal, 2.f);
        Text(Prompt, 800.f - Measure(Prompt, 20.f) * .5f, 665.f, 20.f, White);

        const FString Feedback = UTF8_TO_TCHAR(Mode->GetIncident().feedback.c_str());
        if (!Feedback.IsEmpty())
        {
            const float FeedbackWidth = FMath::Min(Measure(Feedback, 16.f) + 40.f, 1360.f);
            Box(800.f - FeedbackWidth * .5f, 706.f, FeedbackWidth, 52.f, Ink);
            Wrapped(Feedback, 820.f - FeedbackWidth * .5f, 714.f,
                    FeedbackWidth - 40.f, 16.f, Muted, 2);
        }
    }
}

void ASLGameHUD::DrawStatus(const ASLGameMode& Mode)
{
    const ShiftLeft::IncidentState& State = Mode.GetIncident();
    // Anchor to the physical viewport top, including taller-than-16:9 windows.
    // The wall's station title is part of navigation and must stay unobstructed.
    const float Top = 12.f - Origin.Y / UIScale;
    Box(28.f, Top, 1544.f, 62.f, Ink);
    Rule(28.f, Top, 1544.f, Teal, 2.f);
    Text(TEXT("SHIFT LEFT"), 44.f, Top + 10.f, 21.f, White);
    Text(State.guided ? TEXT("THE LEAKED SECRET / GUIDED") : TEXT("THE LEAKED SECRET / STANDARD"),
         44.f, Top + 37.f, 12.f, Teal);
    const FString LiveState = State.completed ? TEXT("RELEASE VERIFIED")
        : !State.credentialRevoked ? TEXT("COPIED KEY STILL WORKS")
        : !ShiftLeft::ServiceResponding(State) ? TEXT("ACCESS STOPPED / SERVICE INTERRUPTED") : TEXT("ACCESS STOPPED / SERVICE RESPONDING");
    Text(LiveState, 365.f, Top + 10.f, 17.f,
         State.credentialRevoked || State.completed ? Teal : Coral);
    Text(TEXT("Goal: stop stolen access. Keep the service working. Pass the leak rehearsal."), 365.f, Top + 37.f, 12.f, Muted);
    Text(Mode.GetMusicStatus(), 1000.f, Top + 37.f, 12.f, Muted);
    const int32 Remaining = FMath::Max(State.budget - State.effortSpent, 0);
    Text(FString::Printf(TEXT("REPAIR BUDGET  %d / %d"), Remaining, State.budget),
         1000.f, Top + 10.f, 17.f, White);
    Text(FString::Printf(TEXT("PRESSURE  %d%%"), State.pressure), 1310.f, Top + 10.f, 17.f,
         State.pressure >= 65 ? Coral : White);
    const bool bClockPaused = !Mode.IsGameplayActive();
    const FString ClockLabel = FString::Printf(TEXT("%.0fs exposed / %s"),
        static_cast<double>(State.exposedMilliseconds) / 1000.,
        bClockPaused ? TEXT("PAUSED") : State.credentialRevoked ? TEXT("CONTAINED") : TEXT("ACTIVE"));
    Text(ClockLabel, 1310.f, Top + 37.f, 12.f, bClockPaused ? Teal : Muted);
}

void ASLGameHUD::DrawPipeline(const ASLGameMode& Mode)
{
    static const TCHAR* Names[] = {TEXT("SOURCE"), TEXT("BUILD"), TEXT("TEST"), TEXT("STAGING"), TEXT("PRODUCTION")};
    static const TCHAR* Roles[] = {TEXT("CODE / 1 EFFORT"), TEXT("PACKAGE / 2 EFFORT"), TEXT("CHECKS / 4 EFFORT"), TEXT("REHEARSE / FREE"), TEXT("LIVE OPS / FREE")};
    const int32 Current = FMath::Clamp(Mode.GetCurrentStageIndex(), 0, 4);

    Box(28.f, 775.f, 1544.f, 101.f, Ink);
    Text(TEXT("PREVENT THE NEXT INCIDENT"), 48.f, 787.f, 13.f, Teal);
    Text(TEXT("CONTAIN THE CURRENT INCIDENT"), 1316.f, 787.f, 13.f, Coral);

    for (int32 Index = 0; Index < 5; ++Index)
    {
        const float X = 292.f + Index * 207.f;
        const bool bHere = Index == Current;
        Box(X, 801.f, 195.f, 50.f, bHere ? FLinearColor(.07f, .19f, .23f, 1.f) : Surface);
        Rule(X, 801.f, 195.f, bHere ? Teal : Hairline, bHere ? 3.f : 1.f);
        Text(Names[Index], X + 12.f, 811.f, 15.f, bHere ? White : Muted);
        Text(Roles[Index], X + 12.f, 832.f, 12.f, Muted);
        if (bHere)
        {
            Text(TEXT("PATCH"), X + 123.f, 832.f, 13.f, Teal);
        }

    }
    Text(FString::Printf(TEXT("A / LEFT: %s"), Current > 0 ? Names[Current-1] : TEXT("END")),
         48.f, 814.f, 13.f, White);
    Text(FString::Printf(TEXT("D / RIGHT: %s"), Current < 4 ? Names[Current+1] : TEXT("END")),
         48.f, 836.f, 13.f, White);
    Text(TEXT("E  READ     F  CHANGE     Q  DOC     R  REHEARSE     ESC / H  HELP"),
         48.f, 859.f, 13.f, Muted);
    Text(TEXT("Choices: number keys or click"), 1316.f, 859.f, 13.f, Muted);
}

void ASLGameHUD::DrawPanel(ASLGameMode& Mode)
{
    // A modal suspends the deterministic incident clock and character input.
    DrawRect(FLinearColor(0.f, .012f, .025f, .56f), 0.f, 0.f, Canvas->SizeX, Canvas->SizeY);
    const TArray<FSLChoice> Choices = Mode.GetChoices();
    const int32 Count = FMath::Min(Choices.Num(), 4);
    // Four choices (help + Quit) use a taller panel with compact one-line rows.
    const bool bCompact = Count > 3;
    constexpr float X = 232.f;
    const float Y = bCompact ? 130.f : 170.f;
    constexpr float Width = 1136.f;
    const float Height = bCompact ? 640.f : 578.f;
    const float RowPitch = bCompact ? 72.f : 86.f;
    const float RowHeight = bCompact ? 64.f : 76.f;
    const float RowInset = bCompact ? -6.f : 0.f;
    Box(X + 8.f, Y + 8.f, Width, Height, FLinearColor(0.f, 0.f, 0.f, .38f));
    Box(X, Y, Width, Height, Ink);
    Rule(X, Y, Width, Teal, 3.f);

    const bool bDoc = Mode.GetPanel() == ESLPanel::Doc;
    const bool bComplete = Mode.GetPanel() == ESLPanel::Complete;
    const FString Eyebrow = bDoc ? TEXT("DOC / LOCAL REFERENCE / OFFLINE")
        : bComplete ? TEXT("PATCH / INCIDENT REVIEW")
        : Mode.GetPanel() == ESLPanel::Patch ? TEXT("PATCH / COMPARE APPROACHES")
        : Mode.GetPanel() == ESLPanel::Help ? TEXT("PATCH + DOC / FIELD GUIDE")
        : TEXT("PATCH / STATION CONNECTION");
    Text(Eyebrow, X + 40.f, Y + 25.f, 14.f, Teal);
    Text(Mode.GetPanelTitle(), X + 40.f, Y + 52.f, 27.f, White);

    const FString CloseLabel = TEXT("ESC  CLOSE");
    Text(CloseLabel, X + Width - 148.f, Y + 27.f, 14.f, Muted);
    HitBox(X + Width - 160.f, Y + 12.f, 144.f, 36.f, TEXT("ClosePanel"), 20);

    const float ChoicesY = Y + Height - 64.f - Count * RowPitch;
    const float BodyY = Y + 108.f;
    const int32 BodyLines = FMath::Max(1, FMath::FloorToInt((ChoicesY - BodyY - 14.f) / 24.3f));
    Wrapped(Mode.GetPanelBody(), X + 40.f, BodyY, Width - 80.f, 18.f, Muted, BodyLines);

    for (int32 Index = 0; Index < Count; ++Index)
    {
        const FSLChoice& Choice = Choices[Index];
        const FName Name(*FString::Printf(TEXT("Choice_%d"), Index));
        const float ButtonY = ChoicesY + Index * RowPitch;
        const bool bHovered = HoveredBox == Name;
        const FLinearColor Background = bHovered && Choice.bEnabled
            ? FLinearColor(.07f, .22f, .25f, 1.f) : Surface;
        Box(X + 40.f, ButtonY, Width - 80.f, RowHeight, Background);
        Rule(X + 40.f, ButtonY, Width - 80.f,
             bHovered && Choice.bEnabled ? Teal : Hairline, 1.f);
        Box(X + 56.f, ButtonY + 19.f + RowInset, 34.f, 34.f,
            Choice.bEnabled ? FLinearColor(.09f, .31f, .33f, 1.f) : Hairline);
        Text(FString::FromInt(Index + 1), X + 67.f, ButtonY + 26.f + RowInset, 19.f,
             Choice.bEnabled ? White : Muted);
        Text(Choice.Label, X + 108.f, ButtonY + 13.f + RowInset * .6f, 22.f,
             Choice.bEnabled ? White : Muted);
        Wrapped(Choice.Detail, X + 109.f, ButtonY + 43.f + RowInset, Width - 260.f,
                15.f, Muted, bCompact ? 1 : 2);
        if (!Choice.State.IsEmpty())
        {
            const float StateWidth = Measure(Choice.State, 13.f);
            Text(Choice.State, X + Width - 57.f - StateWidth, ButtonY + 13.f, 13.f, Teal);
        }
        if (Choice.bEnabled)
        {
            HitBox(X + 40.f, ButtonY, Width - 80.f, RowHeight, Name, 10);
        }
    }
    Rule(X + 40.f, Y + Height - 46.f, Width - 80.f, Hairline);
    Text(TEXT("INCIDENT CLOCK PAUSED WHILE READING"), X + 40.f, Y + Height - 29.f, 13.f, Teal);
    const FString Footer = Count == 1 ? TEXT("1  SELECT     ESC  RETURN TO THE GRID")
        : FString::Printf(TEXT("1 - %d  SELECT     ESC  RETURN TO THE GRID"), Count);
    Text(Footer, X + Width - 40.f - Measure(Footer, 13.f), Y + Height - 29.f, 13.f, Muted);
}

void ASLGameHUD::NotifyHitBoxClick(FName BoxName)
{
    Super::NotifyHitBoxClick(BoxName);
    ASLGameMode* Mode = Cast<ASLGameMode>(UGameplayStatics::GetGameMode(this));
    if (!Mode || !Mode->IsPanelOpen())
    {
        return;
    }
    if (BoxName == TEXT("ClosePanel"))
    {
        Mode->ClosePanel();
        return;
    }
    const FString Name = BoxName.ToString();
    if (Name.StartsWith(TEXT("Choice_")))
    {
        Mode->SelectChoice(FCString::Atoi(*Name.Mid(7)));
    }
}

void ASLGameHUD::NotifyHitBoxBeginCursorOver(FName BoxName)
{
    Super::NotifyHitBoxBeginCursorOver(BoxName);
    HoveredBox = BoxName;
}

void ASLGameHUD::NotifyHitBoxEndCursorOver(FName BoxName)
{
    Super::NotifyHitBoxEndCursorOver(BoxName);
    if (HoveredBox == BoxName)
    {
        HoveredBox = NAME_None;
    }
}
