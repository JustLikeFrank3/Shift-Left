using UnrealBuildTool;
using System.Collections.Generic;
public class ShiftLeftTarget : TargetRules
{
    public ShiftLeftTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Game;
        DefaultBuildSettings = BuildSettingsVersion.Latest;
        IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
        ExtraModuleNames.Add("ShiftLeft");
    }
}
