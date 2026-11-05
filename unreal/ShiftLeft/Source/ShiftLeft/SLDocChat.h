#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "SLDocChat.generated.h"

class IWebSocket;
class SEditableTextBox;
class SScrollBox;
class SWidget;

/** Text-only advisory chat. Never applies incident actions or requests audio. */
UCLASS()
class SHIFTLEFT_API USLDocChat : public UActorComponent
{
    GENERATED_BODY()
public:
    void Show();
    void Hide();
    void Ask(const FString& Question, bool bOffline = false);
    FString GetStatus() const { return Status; }
    FString GetTranscript() const { return Transcript; }
    bool IsPending() const { return bPending; }
    FString GetDraft() const;
    virtual void EndPlay(const EEndPlayReason::Type Reason) override;

private:
    TSharedPtr<SWidget> Widget;
    TSharedPtr<SEditableTextBox> QuestionBox;
    TSharedPtr<SScrollBox> Scroll;
    TSharedPtr<IWebSocket> Socket;
    FTimerHandle Deadline;
    FTimerHandle Quiet;
    FString Status = TEXT("Type a game question. Send uses live DOC (ElevenLabs); Offline guide stays on this Mac.");
    FString Transcript;
    FString CurrentQuestion;
    FString Answer;
    bool bPending = false;
    void Connected();
    void Message(const FString& Data);
    void Failed(const FString& Reason);
    void Finish();
    void Disconnect();
    void Send(const TSharedRef<class FJsonObject>& Event);
    FString LocalAnswer(const FString& Question) const;
};
