using UnrealBuildTool;
using System.Collections.Generic;
public class ShiftLeftEditorTarget : TargetRules
{
    public ShiftLeftEditorTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Editor;
        DefaultBuildSettings = BuildSettingsVersion.Latest;
        ExtraModuleNames.Add("ShiftLeft");
    }
}
