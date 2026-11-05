#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "SLGameHUD.generated.h"

class ASLGameMode;

/** Resolution-independent native presentation. All decisions remain in the game mode. */
UCLASS()
class SHIFTLEFT_API ASLGameHUD : public AHUD
{
    GENERATED_BODY()

public:
    virtual void DrawHUD() override;
    virtual void NotifyHitBoxClick(FName BoxName) override;
    virtual void NotifyHitBoxBeginCursorOver(FName BoxName) override;
    virtual void NotifyHitBoxEndCursorOver(FName BoxName) override;

private:
    float UIScale = 1.f;
    FVector2D Origin = FVector2D::ZeroVector;
    FName HoveredBox = NAME_None;

    FVector2D Screen(float X, float Y) const;
    void Box(float X, float Y, float W, float H, const FLinearColor& Color);
    void Rule(float X, float Y, float W, const FLinearColor& Color, float Thickness = 1.f);
    void Text(const FString& Value, float X, float Y, float Size, const FLinearColor& Color);
    float Measure(const FString& Value, float Size) const;
    float Wrapped(const FString& Value, float X, float Y, float W, float Size,
                  const FLinearColor& Color, int32 MaxLines);
    void HitBox(float X, float Y, float W, float H, FName Name, int32 Priority = 0);
    void DrawStatus(const ASLGameMode& Mode);
    void DrawPipeline(const ASLGameMode& Mode);
    void DrawPanel(ASLGameMode& Mode);
};
