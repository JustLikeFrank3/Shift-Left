#include "SLDocChat.h"
#include "SLGameMode.h"
#include "Engine/GameViewportClient.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"
#include "Framework/Application/SlateApplication.h"
#include "IWebSocket.h"
#include "WebSocketsModule.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Misc/ConfigCacheIni.h"
#include "TimerManager.h"
#include "Widgets/SCompoundWidget.h"
#include "Widgets/SOverlay.h"
#include "Widgets/SBoxPanel.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Layout/SScrollBox.h"
#include "Widgets/Input/SButton.h"
#include "Widgets/Input/SEditableTextBox.h"
#include "Widgets/Text/STextBlock.h"

namespace
{
    TSharedRef<FJsonObject> Event(const TCHAR* Type)
    {
        auto Result = MakeShared<FJsonObject>();
        Result->SetStringField(TEXT("type"), Type);
        return Result;
    }
    FString Json(const TSharedRef<FJsonObject>& Object)
    {
        FString Result;
        FJsonSerializer::Serialize(Object, TJsonWriterFactory<>::Create(&Result));
        return Result;
    }
    class SDocWindow : public SCompoundWidget
    {
    public:
        SLATE_BEGIN_ARGS(SDocWindow) {} SLATE_EVENT(FSimpleDelegate, OnClose) SLATE_END_ARGS()
        void Construct(const FArguments& Args) { Close = Args._OnClose; }
        void SetContent(TSharedRef<SWidget> Content) { ChildSlot[Content]; }
        virtual FReply OnPreviewKeyDown(const FGeometry&, const FKeyEvent& Key) override
        {
            if (Key.GetKey() == EKeys::Escape) { Close.ExecuteIfBound(); return FReply::Handled(); }
            return FReply::Unhandled();
        }
        FSimpleDelegate Close;
    };
}

void USLDocChat::Show()
{
    if (Widget || !GetWorld()->GetGameViewport()) return;
    // Packaged games initialize C++ globals before Slate. Accessing FCoreStyle
    // in a module-global initializer crashes before main (the editor loads this
    // module later, masking that ordering bug). Create the style on first use.
    static const FTextBlockStyle ButtonText = FTextBlockStyle(FCoreStyle::Get().GetWidgetStyle<FTextBlockStyle>("NormalText"))
        .SetFont(FCoreStyle::GetDefaultFontStyle("Regular", 16));
    const TWeakObjectPtr<USLDocChat> Self(this);
    auto Close = [Self]() { if (Self.IsValid()) if (auto* Mode = Cast<ASLGameMode>(Self->GetOwner())) Mode->ClosePanel(); };
    auto Submit = [Self](bool Offline)
    {
        if (Self.IsValid() && Self->QuestionBox) Self->Ask(Self->QuestionBox->GetText().ToString(), Offline);
        return FReply::Handled();
    };
    auto Root = SNew(SDocWindow).OnClose_Lambda(Close);
    Root->SetContent(SNew(SOverlay)
        + SOverlay::Slot()[SNew(SBorder).BorderImage(FCoreStyle::Get().GetBrush("WhiteBrush")).BorderBackgroundColor(FLinearColor(0, .01f, .02f, .85f))]
        + SOverlay::Slot().HAlign(HAlign_Center).VAlign(VAlign_Center)
        [SNew(SBox).WidthOverride(880).HeightOverride(620)
         [SNew(SBorder).BorderImage(FCoreStyle::Get().GetBrush("WhiteBrush")).BorderBackgroundColor(FLinearColor(.025f,.06f,.09f)).Padding(28)
          [SNew(SVerticalBox)
           + SVerticalBox::Slot().AutoHeight().Padding(0,0,0,12)
           [SNew(STextBlock).Text(FText::FromString(TEXT("Ask DOC"))).Font(FCoreStyle::GetDefaultFontStyle("Bold", 26))]
           + SVerticalBox::Slot().AutoHeight().Padding(0,0,0,14)
           [SNew(STextBlock).Text(FText::FromString(TEXT("Your question, recent discussion and synthetic mission context go to ElevenLabs only when you press Send. DOC advises; you make every game decision. No microphone."))).Font(FCoreStyle::GetDefaultFontStyle("Regular",16)).AutoWrapText(true)]
           + SVerticalBox::Slot().FillHeight(1).Padding(0,0,0,14)
           [SAssignNew(Scroll, SScrollBox) + SScrollBox::Slot()
            [SNew(STextBlock).Text_Lambda([Self] { return FText::FromString(Self.IsValid() ? Self->Transcript : FString()); }).AutoWrapText(true).Font(FCoreStyle::GetDefaultFontStyle("Regular",18))]]
           + SVerticalBox::Slot().AutoHeight().Padding(0,0,0,12)
           [SNew(STextBlock).Text_Lambda([Self] { return FText::FromString(Self.IsValid() ? Self->Status : FString()); }).Font(FCoreStyle::GetDefaultFontStyle("Regular",16)).AutoWrapText(true)]
           + SVerticalBox::Slot().AutoHeight().Padding(0,0,0,14)
           [SAssignNew(QuestionBox, SEditableTextBox).HintText(FText::FromString(TEXT("e.g. Why isn't deleting the key enough?")))
            .Font(FCoreStyle::GetDefaultFontStyle("Regular",18)).ClearKeyboardFocusOnCommit(false)
            .OnTextCommitted_Lambda([Self](const FText& Text, ETextCommit::Type Type) { if (Self.IsValid() && Type == ETextCommit::OnEnter) Self->Ask(Text.ToString()); })]
           + SVerticalBox::Slot().AutoHeight()
           [SNew(SHorizontalBox)
            + SHorizontalBox::Slot().AutoWidth().Padding(0,0,12,0)
            [SNew(SButton).TextStyle(&ButtonText).ContentPadding(FMargin(12,8)).Text(FText::FromString(TEXT("Send to live DOC"))).IsEnabled_Lambda([Self]{ return Self.IsValid() && !Self->bPending; }).OnClicked_Lambda([Submit]{ return Submit(false); })]
            + SHorizontalBox::Slot().AutoWidth().Padding(0,0,12,0)
            [SNew(SButton).TextStyle(&ButtonText).ContentPadding(FMargin(12,8)).Text(FText::FromString(TEXT("Offline guide"))).IsEnabled_Lambda([Self]{ return Self.IsValid() && !Self->bPending; }).OnClicked_Lambda([Submit]{ return Submit(true); })]
            + SHorizontalBox::Slot().AutoWidth()
            [SNew(SButton).TextStyle(&ButtonText).ContentPadding(FMargin(12,8)).Text(FText::FromString(TEXT("Return to PATCH (Esc)"))).OnClicked_Lambda([Close]{ Close(); return FReply::Handled(); })]]]]]);
    Widget = Root;
    GetWorld()->GetGameViewport()->AddViewportWidgetContent(Root, 100);
    if (auto* PC = GetWorld()->GetFirstPlayerController())
    {
        FInputModeUIOnly Mode;
        Mode.SetWidgetToFocus(QuestionBox);
        Mode.SetLockMouseToViewportBehavior(EMouseLockMode::DoNotLock);
        PC->SetInputMode(Mode);
        PC->bShowMouseCursor = true;
    }
    // The viewport overlay has no Slate widget path until the following tick.
    // Focusing it during the Q key event silently fails and strands UI-only input.
    GetWorld()->GetTimerManager().SetTimerForNextTick(FTimerDelegate::CreateWeakLambda(this, [this]
    {
        if (Widget && QuestionBox)
        {
            FSlateApplication::Get().SetUserFocus(0, QuestionBox, EFocusCause::SetDirectly);
            FSlateApplication::Get().SetKeyboardFocus(QuestionBox, EFocusCause::SetDirectly);
        }
    }));
}

FString USLDocChat::GetDraft() const { return QuestionBox ? QuestionBox->GetText().ToString() : FString(); }

void USLDocChat::Hide()
{
    if (bPending) Status = TEXT("Question cancelled. Send again to reconnect, or use the offline guide.");
    bPending = false;
    Disconnect();
    if (Widget && GetWorld() && GetWorld()->GetGameViewport()) GetWorld()->GetGameViewport()->RemoveViewportWidgetContent(Widget.ToSharedRef());
    Widget.Reset(); QuestionBox.Reset(); Scroll.Reset();
}

void USLDocChat::EndPlay(const EEndPlayReason::Type Reason) { Hide(); Super::EndPlay(Reason); }

void USLDocChat::Ask(const FString& Question, bool bOffline)
{
    if (bPending) return;
    CurrentQuestion = Question.TrimStartAndEnd();
    if (CurrentQuestion.IsEmpty()) { Status = TEXT("Type a question first."); return; }
    if (CurrentQuestion.Len() > 600) { Status = TEXT("Please keep your question within 600 characters."); return; }
    if (QuestionBox) QuestionBox->SetText(FText::GetEmpty());
    // Preserve a bounded local conversation; only its recent portion accompanies a live question.
    Transcript = Transcript.Right(10000) + TEXT("\n\nYou: ") + CurrentQuestion;
    Answer.Empty();
    if (bOffline)
    {
        Status = TEXT("Offline guide / authored reference / no network request");
        Transcript += TEXT("\nOffline guide: ") + LocalAnswer(CurrentQuestion);
        if (Scroll) Scroll->ScrollToEnd();
        return;
    }
    FString Agent;
    GConfig->GetString(TEXT("ShiftLeft.Doc"), TEXT("AgentId"), Agent, GGameIni);
    if (!Agent.StartsWith(TEXT("agent_")) || Agent.Contains(TEXT("&"))) { Failed(TEXT("Live DOC is not configured.")); return; }
    bPending = true;
    Status = TEXT("Connecting to live DOC...");
    Socket = FWebSocketsModule::Get().CreateWebSocket(TEXT("wss://api.elevenlabs.io/v1/convai/conversation?agent_id=") + Agent);
    Socket->OnConnected().AddUObject(this, &USLDocChat::Connected);
    Socket->OnMessage().AddUObject(this, &USLDocChat::Message);
    Socket->OnConnectionError().AddUObject(this, &USLDocChat::Failed);
    Socket->OnClosed().AddWeakLambda(this, [this](int32, const FString&, bool) { if (bPending) Failed(TEXT("Live session disconnected.")); });
    GetWorld()->GetTimerManager().SetTimer(Deadline, FTimerDelegate::CreateWeakLambda(this, [this]{ Failed(TEXT("Live DOC timed out.")); }), 30.f, false);
    Socket->Connect();
}

void USLDocChat::Connected()
{
    auto Init = Event(TEXT("conversation_initiation_client_data"));
    auto Conversation = MakeShared<FJsonObject>(); Conversation->SetBoolField(TEXT("text_only"), true);
    auto Override = MakeShared<FJsonObject>(); Override->SetObjectField(TEXT("conversation"), Conversation);
    Init->SetObjectField(TEXT("conversation_config_override"), Override);
    Send(Init);
}

void USLDocChat::Send(const TSharedRef<FJsonObject>& Data) { if (Socket && Socket->IsConnected()) Socket->Send(Json(Data)); }

void USLDocChat::Message(const FString& Data)
{
    if (!bPending || Data.Len() > 100000) return;
    TSharedPtr<FJsonObject> Object;
    if (!FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(Data), Object) || !Object) return;
    FString Type;
    if (!Object->TryGetStringField(TEXT("type"), Type)) return;
    if (Type == TEXT("ping"))
    {
        const TSharedPtr<FJsonObject>* Ping;
        double Id;
        if (Object->TryGetObjectField(TEXT("ping_event"), Ping) && (*Ping)->TryGetNumberField(TEXT("event_id"), Id))
        { auto Pong = Event(TEXT("pong")); Pong->SetNumberField(TEXT("event_id"), Id); Send(Pong); }
    }
    else if (Type == TEXT("conversation_initiation_metadata"))
    {
        auto Context = Event(TEXT("contextual_update"));
        auto Snapshot = MakeShared<FJsonObject>();
        Snapshot->SetStringField(TEXT("mission"), TEXT("The Leaked Secret / SHIFT LEFT"));
        Snapshot->SetStringField(TEXT("recentDiscussion"), Transcript.Right(4000));
        if (auto* Mode = Cast<ASLGameMode>(GetOwner()))
        {
            const auto& S = Mode->GetIncident();
            Snapshot->SetStringField(TEXT("stage"), Mode->GetStationLabel());
            Snapshot->SetStringField(TEXT("feedback"), UTF8_TO_TCHAR(S.feedback.c_str()));
            Snapshot->SetBoolField(TEXT("credentialRevoked"), S.credentialRevoked);
            Snapshot->SetBoolField(TEXT("usageReviewed"), S.usageReviewed);
            Snapshot->SetBoolField(TEXT("replacementProvisioned"), S.replacementProvisioned);
            Snapshot->SetBoolField(TEXT("replacementExposed"), S.replacementExposed);
            Snapshot->SetBoolField(TEXT("sourceLiteralRemoved"), S.sourceLiteralRemoved);
            Snapshot->SetBoolField(TEXT("runtimeBound"), S.runtimeBound);
            Snapshot->SetBoolField(TEXT("artifactContainsSecret"), S.artifactContainsSecret);
            Snapshot->SetBoolField(TEXT("earlyCheck"), S.earlyCheck);
            Snapshot->SetNumberField(TEXT("effortSpent"), S.effortSpent);
            Snapshot->SetNumberField(TEXT("effortBudget"), S.budget);
            Snapshot->SetNumberField(TEXT("pressurePercent"), S.pressure);
            Snapshot->SetNumberField(TEXT("activeExposureSeconds"), static_cast<double>(S.exposedMilliseconds) / 1000.0);
            Snapshot->SetBoolField(TEXT("guidedMode"), S.guided);
            Snapshot->SetBoolField(TEXT("completed"), S.completed);
            Snapshot->SetBoolField(TEXT("failed"), S.failed);
        }
        Context->SetStringField(TEXT("text"), Json(Snapshot)); Send(Context);
        auto Question = Event(TEXT("user_message")); Question->SetStringField(TEXT("text"), CurrentQuestion); Send(Question);
        Status = TEXT("Live DOC is thinking...");
    }
    else if (Type == TEXT("agent_response") || Type == TEXT("agent_response_correction"))
    {
        const bool Correction = Type.EndsWith(TEXT("correction"));
        const TSharedPtr<FJsonObject>* Response;
        FString Text;
        if (Object->TryGetObjectField(Correction ? TEXT("agent_response_correction_event") : TEXT("agent_response_event"), Response)
            && (*Response)->TryGetStringField(Correction ? TEXT("corrected_agent_response") : TEXT("agent_response"), Text))
        {
            Answer = Text.Left(8000);
            // The public agent sends full responses without a completion event.
            GetWorld()->GetTimerManager().SetTimer(Quiet, this, &USLDocChat::Finish, .7f, false);
        }
    }
    else if (Type == TEXT("agent_response_complete")) { if (!Answer.IsEmpty()) Finish(); }
    else if (Type == TEXT("audio") || Type == TEXT("client_tool_call") || Type == TEXT("client_error") || Type == TEXT("guardrail_triggered"))
        Failed(TEXT("Live DOC could not continue in text-only mode."));
}

void USLDocChat::Finish()
{
    bPending = false;
    Status = TEXT("Live DOC / ElevenLabs / advisory answer");
    Transcript += TEXT("\nDOC (live): ") + Answer;
    UE_LOG(LogTemp, Display, TEXT("DOC live answer received (%d characters)"), Answer.Len());
    Disconnect();
    if (Scroll) Scroll->ScrollToEnd();
}

void USLDocChat::Failed(const FString& Reason)
{
    bPending = false;
    Status = TEXT("Live DOC is unavailable. Showing the offline guide instead; this is not an AI answer.");
    Transcript += TEXT("\nOffline guide: ") + LocalAnswer(CurrentQuestion);
    UE_LOG(LogTemp, Display, TEXT("DOC live unavailable (%s); used labeled offline reference"), *Reason);
    Disconnect();
    if (Scroll) Scroll->ScrollToEnd();
}

void USLDocChat::Disconnect()
{
    if (GetWorld()) { GetWorld()->GetTimerManager().ClearTimer(Deadline); GetWorld()->GetTimerManager().ClearTimer(Quiet); }
    if (Socket)
    {
        Socket->OnConnected().Clear(); Socket->OnMessage().Clear(); Socket->OnConnectionError().Clear(); Socket->OnClosed().Clear();
        Socket->Close(); Socket.Reset();
    }
}

FString USLDocChat::LocalAnswer(const FString& Question) const
{
    const FString Q = Question.ToLower();
    if (Q.Contains(TEXT("delet")) || Q.Contains(TEXT("revok")) || Q.Contains(TEXT("contain")))
        return TEXT("Deleting a source literal cannot invalidate a credential already copied from history or an artifact. At PRODUCTION, review usage, revoke the exposed credential and provision a replacement. These emergency actions cost no effort.");
    if (Q.Contains(TEXT("runtime")) || Q.Contains(TEXT("artifact")) || Q.Contains(TEXT("route")))
        return TEXT("A runtime binding lets the running service resolve a credential from the vault. Putting the value in an artifact ships another extractable copy. If the replacement escapes, revoke it and provision another before retrying the runtime route.");
    if (Q.Contains(TEXT("left")) || Q.Contains(TEXT("cost")) || Q.Contains(TEXT("budget")))
        return TEXT("SOURCE is on the left, then BUILD, TEST, STAGING and PRODUCTION. Repairs cost 1 / 2 / 4 / 8 / 16 effort at those stages; you have 24. Containment and investigation stay free. Walk left to make structural changes cheaper.");
    if (Q.Contains(TEXT("jump"))) return TEXT("This corridor is about investigating and repairing the delivery pipeline. There is no jump action: terminals are reachable on the floor.");
    if (Q.Contains(TEXT("check")) || Q.Contains(TEXT("scan"))) return TEXT("An early secret check detects future mistakes before an artifact ships. It does not revoke an exposed credential. Install it alongside source repair and safe runtime routing, then validate the release.");
    return TEXT("This offline reference covers containment/revocation, runtime versus artifact routing, early checks and repair costs. Ask about one of those, or Send to live DOC for a plain-language answer to a broader game question. DOC never changes the incident for you.");
}
