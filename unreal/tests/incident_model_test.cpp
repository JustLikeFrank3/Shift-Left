#include "../ShiftLeft/Source/ShiftLeft/Simulation/IncidentModel.h"

#include <cstdlib>
#include <iostream>
#include <limits>
#include <string>
#include <vector>

using ShiftLeft::Action;
using ShiftLeft::IncidentState;
using ShiftLeft::Stage;

namespace
{
int assertions = 0;

void Expect(bool condition, const char* message)
{
    ++assertions;
    if (!condition)
    {
        std::cerr << "FAIL: " << message << '\n';
        std::exit(EXIT_FAILURE);
    }
}

bool SameGameplay(const IncidentState& left, const IncidentState& right)
{
    return left.credentialRevoked == right.credentialRevoked &&
        left.usageReviewed == right.usageReviewed &&
        left.replacementProvisioned == right.replacementProvisioned &&
        left.sourceLiteralRemoved == right.sourceLiteralRemoved &&
        left.runtimeBound == right.runtimeBound &&
        left.artifactContainsSecret == right.artifactContainsSecret &&
        left.earlyCheck == right.earlyCheck && left.completed == right.completed &&
        left.failed == right.failed && left.effortSpent == right.effortSpent &&
        left.budget == right.budget && left.mistakes == right.mistakes &&
        left.pressure == right.pressure &&
        left.exposedMilliseconds == right.exposedMilliseconds &&
        left.initialCredentialRevoked == right.initialCredentialRevoked &&
        left.replacementExposed == right.replacementExposed && left.guided == right.guided;
}

bool SameState(const IncidentState& left, const IncidentState& right)
{
    return SameGameplay(left, right) && left.feedback == right.feedback;
}

IncidentState Do(const IncidentState& state, Action action, Stage stage = Stage::Source)
{
    return ShiftLeft::Apply(state, action, stage);
}

IncidentState Solve(IncidentState state, Stage fixAt = Stage::Source,
                    Stage containAt = Stage::Production)
{
    state = Do(state, Action::InspectUsage, containAt);
    state = Do(state, Action::RevokeCredential, containAt);
    state = Do(state, Action::ProvisionReplacement, containAt);
    state = Do(state, Action::RemoveSourceLiteral, fixAt);
    state = Do(state, Action::RouteToRuntime, fixAt);
    state = Do(state, Action::InstallEarlyCheck, fixAt);
    return Do(state, Action::Validate, containAt);
}

void SolvedPathAndIndependentActions()
{
    const IncidentState initial = ShiftLeft::NewIncident();
    Expect(ShiftLeft::IsExposed(initial) && initial.artifactContainsSecret,
           "opening incident starts with a live token in an existing artifact");
    const IncidentState solved = Solve(initial);
    Expect(solved.completed && !solved.failed, "complete safe repair validates");
    Expect(solved.effortSpent == 3 && solved.mistakes == 0,
           "three source fixes cost three, containment and recovery are free");
    Expect(ShiftLeft::Grade(solved) == "S", "efficient immediate repair receives S");
    Expect(SameState(solved, Do(solved, Action::RouteIntoArtifact)),
           "completed simulation cannot change");

    IncidentState reordered = Do(initial, Action::ProvisionReplacement);
    reordered = Do(reordered, Action::RouteToRuntime);
    Expect(reordered.runtimeBound && !reordered.credentialRevoked,
           "runtime repair can precede containment without revoking the old token");
    reordered = Do(reordered, Action::InstallEarlyCheck);
    reordered = Do(reordered, Action::RemoveSourceLiteral);
    reordered = Do(reordered, Action::RevokeCredential);
    Expect(reordered.replacementProvisioned && reordered.runtimeBound,
           "revoking the old token preserves an unexposed replacement");
    Expect(!Do(reordered, Action::Validate).completed,
           "working configuration still needs exposure scope assessment");
    reordered = Do(reordered, Action::InspectUsage);
    Expect(Do(reordered, Action::Validate).completed,
           "real end state validates regardless of action order");

    const IncidentState missingReplacement = Do(initial, Action::RouteToRuntime);
    Expect(SameGameplay(initial, missingReplacement),
           "routing a missing object produces feedback without a purchase");
    Expect(!Do(initial, Action::Validate).completed,
           "verification cannot silently remediate an incident");
}

void BlindPoliciesLose()
{
    IncidentState deleted = Do(ShiftLeft::NewIncident(), Action::RemoveSourceLiteral);
    deleted = Do(deleted, Action::InstallEarlyCheck);
    Expect(!deleted.credentialRevoked && deleted.artifactContainsSecret,
           "deleting source and installing checks do not revoke or rewrite old artifacts");
    deleted = ShiftLeft::Advance(deleted, 180000);
    Expect(deleted.failed && !deleted.completed && deleted.pressure == 100,
           "delete-first policy that never contains the token loses to exposure");

    IncidentState blind = ShiftLeft::NewIncident();
    blind = Do(blind, Action::RemoveSourceLiteral);
    blind = Do(blind, Action::InstallEarlyCheck);
    // This plausible blind policy contains each visible leak, then repeatedly
    // chooses build-time injection as its credential restoration strategy.
    for (int release = 0; release < 4; ++release)
    {
        blind = Do(blind, Action::InspectUsage);
        blind = Do(blind, Action::RevokeCredential);
        blind = Do(blind, Action::ProvisionReplacement);
        blind = Do(blind, Action::RouteIntoArtifact);
        blind = Do(blind, Action::Validate);
        Expect(!blind.completed, "repeated artifact injection never validates");
    }
    Expect(blind.failed && blind.mistakes == 4 && blind.pressure == 100,
           "four new-token leaks exhaust pressure despite early containment");
    Expect(ShiftLeft::Grade(blind) == "F", "failed run has F grade");
    Expect(SameState(blind, ShiftLeft::Advance(blind, 1000)),
           "failure freezes the simulation");
    Expect(SameState(ShiftLeft::Retry(blind), ShiftLeft::NewIncident()),
           "retry is free and starts a fresh incident checkpoint");
}

void BudgetAndShiftLeft()
{
    Expect(ShiftLeft::RepairCost(Stage::Source) == 1 &&
               ShiftLeft::RepairCost(Stage::Build) == 2 &&
               ShiftLeft::RepairCost(Stage::Test) == 4 &&
               ShiftLeft::RepairCost(Stage::Staging) == 8 &&
               ShiftLeft::RepairCost(Stage::Production) == 16,
           "repair costs double across delivery stages");

    IncidentState late = Do(ShiftLeft::NewIncident(), Action::RemoveSourceLiteral, Stage::Production);
    late = Do(late, Action::ProvisionReplacement);
    const IncidentState rejected = Do(late, Action::RouteToRuntime, Stage::Production);
    Expect(SameGameplay(late, rejected) && rejected.feedback != late.feedback,
           "unaffordable runtime operation rejects every gameplay change atomically");
    const IncidentState rejectedMistake = Do(late, Action::RouteIntoArtifact, Stage::Production);
    Expect(SameGameplay(late, rejectedMistake),
           "unaffordable unsafe operation cannot leak or raise pressure");
    Expect(ShiftLeft::RemainingEffort(late) == 8, "budget remaining is visible");
    late = Do(late, Action::RouteToRuntime, Stage::Source);
    late = Do(late, Action::InstallEarlyCheck, Stage::Source);
    late = Do(late, Action::RevokeCredential, Stage::Production);
    late = Do(late, Action::InspectUsage);
    late = Do(late, Action::Validate);
    Expect(late.completed && late.effortSpent == 18,
           "moving remaining fixes left recovers after an expensive production fix");
    const IncidentState early = Solve(ShiftLeft::NewIncident());
    Expect(early.effortSpent < late.effortSpent &&
               ShiftLeft::Grade(early) == "S" && ShiftLeft::Grade(late) == "B",
           "earlier fixes preserve meaningful budget and earn a better grade");
    Expect(ShiftLeft::Grade(Solve(ShiftLeft::NewIncident(), Stage::Source, Stage::Source)) ==
               ShiftLeft::Grade(Solve(ShiftLeft::NewIncident(), Stage::Source, Stage::Production)),
           "emergency production revocation never worsens grade");

    for (Action action : {Action::InspectUsage, Action::RevokeCredential,
                          Action::ProvisionReplacement, Action::RemoveSourceLiteral,
                          Action::RouteToRuntime, Action::InstallEarlyCheck})
    {
        IncidentState state = Do(ShiftLeft::NewIncident(), Action::ProvisionReplacement);
        state = Do(state, action);
        const IncidentState repeated = Do(state, action);
        Expect(SameGameplay(state, repeated), "completed operations never spend or penalize a no-op");
    }

    // One unit short must reject the operation, while an exact balance succeeds.
    for (Stage stage : {Stage::Source, Stage::Build, Stage::Test, Stage::Staging, Stage::Production})
    {
        IncidentState state = ShiftLeft::NewIncident();
        state.budget = ShiftLeft::RepairCost(stage) - 1;
        Expect(SameGameplay(state, Do(state, Action::RemoveSourceLiteral, stage)),
               "repair one unit over budget has no partial state change");
        ++state.budget;
        const IncidentState exact = Do(state, Action::RemoveSourceLiteral, stage);
        Expect(exact.sourceLiteralRemoved && exact.effortSpent == exact.budget,
               "exactly affordable repair succeeds");
    }
}

void ExposureClock()
{
    const IncidentState initial = ShiftLeft::NewIncident();
    Expect(SameState(initial, ShiftLeft::Advance(initial, 999999, false)),
           "onboarding and DOC pause exposure and feedback");
    Expect(SameState(initial, ShiftLeft::Advance(initial, -1)),
           "negative deltas are ignored");
    IncidentState active = ShiftLeft::Advance(initial, 179999);
    Expect(!active.failed && active.pressure == 99, "live exposure permits recovery until 180 seconds");
    active = ShiftLeft::Advance(active, 1);
    Expect(active.failed && active.exposedMilliseconds == 180000,
           "standard mode fails at the exact exposure deadline");
    IncidentState chunks = initial;
    for (int frame = 0; frame < 181; ++frame)
        chunks = ShiftLeft::Advance(chunks, 1000);
    Expect(SameState(active, chunks) &&
               SameState(active, ShiftLeft::Advance(initial, 999999999)),
           "frame chunk size and overshoot cannot change a failed outcome");

    IncidentState contained = Do(ShiftLeft::Advance(initial, 12000), Action::RevokeCredential);
    Expect(SameState(contained, ShiftLeft::Advance(contained, 999999999)),
           "revocation stops exposure pressure immediately");
    IncidentState guided = ShiftLeft::Advance(ShiftLeft::NewIncident(true), 86400000);
    Expect(!guided.failed && guided.pressure == 0 && guided.exposedMilliseconds == 86400000,
           "guided mode records time but has no time failure");
    Expect(ShiftLeft::Retry(guided).guided, "retry preserves guided mode");
    guided = ShiftLeft::Advance(guided, std::numeric_limits<std::int64_t>::max());
    Expect(!guided.failed && guided.exposedMilliseconds == std::numeric_limits<std::int64_t>::max(),
           "very large guided time deltas saturate safely");

    const IncidentState fast = Solve(initial);
    const IncidentState slow = Solve(ShiftLeft::Advance(initial, 120000));
    Expect(ShiftLeft::Grade(fast) == "S" && ShiftLeft::Grade(slow) == "B",
           "containment time contributes to replay grade");
}

void WrongRouteRecovery()
{
    IncidentState state = Do(ShiftLeft::NewIncident(), Action::RevokeCredential);
    state = Do(state, Action::InspectUsage);
    state = Do(state, Action::ProvisionReplacement);
    state = Do(state, Action::RemoveSourceLiteral);
    state = Do(state, Action::RouteToRuntime);
    state = Do(state, Action::InstallEarlyCheck);
    const IncidentState safe = state;
    state = Do(state, Action::RouteIntoArtifact);
    Expect(state.replacementExposed && !state.credentialRevoked && state.artifactContainsSecret &&
               !state.runtimeBound && !state.usageReviewed && state.mistakes == 1 && state.pressure == 25,
           "wrong route publishes the new token, invalidates runtime, and expands scope");
    Expect(SameGameplay(state, Do(state, Action::RouteIntoArtifact)),
           "repeating the same unsafe injection does not spend or invent another leak");
    Expect(SameGameplay(state, Do(state, Action::RouteToRuntime)),
           "a compromised replacement cannot become safe merely by moving it");
    Expect(!Do(state, Action::Validate).completed, "a leaked replacement prevents release");
    state = ShiftLeft::Advance(state, 1800);
    Expect(state.pressure == 26, "newly exposed replacements resume the exposure clock");
    state = Do(state, Action::RevokeCredential);
    Expect(state.credentialRevoked && !state.replacementProvisioned && !state.replacementExposed,
           "free containment revokes the compromised replacement instead of reusing it");
    Expect(state.sourceLiteralRemoved && state.earlyCheck,
           "containment preserves legitimate prior remediation");
    state = Do(state, Action::ProvisionReplacement);
    state = Do(state, Action::RouteToRuntime);
    state = Do(state, Action::InspectUsage);
    state = Do(state, Action::Validate);
    Expect(state.completed && state.effortSpent == safe.effortSpent + 2 && state.mistakes == 1,
           "fresh replacement and safe binding recover affordably from the mistake");
    Expect(ShiftLeft::Grade(state) != ShiftLeft::Grade(Do(safe, Action::Validate)),
           "recoverable mistakes still affect the replay grade");

    IncidentState exposed = Do(ShiftLeft::NewIncident(), Action::ProvisionReplacement);
    exposed = Do(exposed, Action::RouteIntoArtifact);
    IncidentState chunked = exposed;
    for (int frame = 0; frame < 150; ++frame)
        chunked = ShiftLeft::Advance(chunked, 1000);
    Expect(SameState(chunked, ShiftLeft::Advance(exposed, 150000)) &&
               chunked.exposedMilliseconds == 135000,
           "mistake pressure and time share the same deterministic failure instant");
}

void ImmutabilityAndReplay()
{
    const IncidentState original = ShiftLeft::NewIncident();
    const IncidentState snapshot = original;
    const IncidentState advanced = ShiftLeft::Advance(original, 15000);
    const IncidentState applied = Do(original, Action::RemoveSourceLiteral);
    Expect(SameState(original, snapshot), "Advance and Apply leave their input untouched");
    Expect(advanced.exposedMilliseconds == 15000 && applied.sourceLiteralRemoved,
           "pure operations produce independent successor states");

    struct Command
    {
        Action action;
        Stage stage;
        std::int64_t delta;
        bool active;
    };
    const std::vector<Command> commands = {
        {Action::RemoveSourceLiteral, Stage::Build, 1111, true},
        {Action::InspectUsage, Stage::Production, 50000, false},
        {Action::RevokeCredential, Stage::Production, 333, true},
        {Action::ProvisionReplacement, Stage::Production, 10000, true},
        {Action::RouteIntoArtifact, Stage::Test, 800, true},
        {Action::RevokeCredential, Stage::Production, 900, true},
        {Action::ProvisionReplacement, Stage::Source, 100, true},
        {Action::RouteToRuntime, Stage::Build, 100, true},
        {Action::InstallEarlyCheck, Stage::Source, 100, true},
        {Action::InspectUsage, Stage::Production, 100, true},
        {Action::Validate, Stage::Production, 100, true}
    };
    const auto replay = [&commands]()
    {
        IncidentState state = ShiftLeft::NewIncident();
        for (const Command& command : commands)
        {
            state = ShiftLeft::Advance(state, command.delta, command.active);
            state = Do(state, command.action, command.stage);
        }
        return state;
    };
    const IncidentState first = replay();
    Expect(first.completed && first.mistakes == 1, "replay includes a genuine recovered error");
    Expect(SameState(first, replay()), "identical command streams reproduce every field and feedback");
}
} // namespace

int main()
{
    SolvedPathAndIndependentActions();
    BlindPoliciesLose();
    BudgetAndShiftLeft();
    ExposureClock();
    WrongRouteRecovery();
    ImmutabilityAndReplay();
    std::cout << "Incident model: " << assertions << " checks passed\n";
    return EXIT_SUCCESS;
}
