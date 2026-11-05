using UnrealBuildTool;
public class ShiftLeft : ModuleRules
{
    public ShiftLeft(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        CppStandard = CppStandardVersion.Cpp20;
        PublicDependencyModuleNames.AddRange(new string[] {"Core", "CoreUObject", "Engine", "InputCore"});
        PrivateDependencyModuleNames.AddRange(new string[] {"Slate", "SlateCore", "WebSockets", "Json"});
        // Mac's OpenSSL WebSocket backend reads this engine trust bundle. The
        // editor has it on disk, but ordinary game cooking does not stage it.
        RuntimeDependencies.Add("$(EngineDir)/Content/Certificates/ThirdParty/cacert.pem", StagedFileType.NonUFS);
    }
}
