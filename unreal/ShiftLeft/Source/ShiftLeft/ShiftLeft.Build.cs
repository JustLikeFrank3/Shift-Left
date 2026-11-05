using UnrealBuildTool;
public class ShiftLeft : ModuleRules
{
    public ShiftLeft(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        CppStandard = CppStandardVersion.Cpp20;
        PublicDependencyModuleNames.AddRange(new string[] {"Core", "CoreUObject", "Engine", "InputCore"});
        PrivateDependencyModuleNames.AddRange(new string[] {"Slate", "SlateCore"});
    }
}
