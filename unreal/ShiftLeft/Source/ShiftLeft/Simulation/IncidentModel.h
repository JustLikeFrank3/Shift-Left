#pragma once

#include <algorithm>
#include <cstdint>
#include <limits>
#include <string>

// Portable simulation: no Unreal types, wall clock, random numbers, or side effects.
// Every command returns a new value, so callers can replay a run from its inputs.
namespace ShiftLeft
{
enum class Stage { Source, Build, Test, Staging, Production };
enum class Action
{
    InspectUsage,
    RevokeCredential,
    ProvisionReplacement,
    RemoveSourceLiteral,
    RouteToRuntime,
    RouteIntoArtifact,
    InstallEarlyCheck,
    Validate,
    EncodeSourceLiteral,
    ReportOnlyCheck,
    RollBackRelease
};

struct IncidentState
{
    bool credentialRevoked = false;
    bool usageReviewed = false;
    bool replacementProvisioned = false;
    bool sourceLiteralRemoved = false;
    bool runtimeBound = false;
    bool artifactContainsSecret = true;
    bool earlyCheck = false;
    bool completed = false;
    bool failed = false;
    int effortSpent = 0;
    int budget = 24;
    int mistakes = 0;
    int pressure = 0;
    std::int64_t exposedMilliseconds = 0;
    std::string feedback;

    // The original public token and any later leaked replacement have separate
    // lifecycles. A safe replacement can exist before the old token is revoked.
    bool initialCredentialRevoked = false;
    bool replacementExposed = false;
    bool guided = false;
    bool sourceEncoded = false;
    bool reportOnlyCheck = false;
};

inline constexpr int RepairCost(Stage stage)
{
    switch (stage)
    {
    case Stage::Source: return 1;
    case Stage::Build: return 2;
    case Stage::Test: return 4;
    case Stage::Staging: return 8;
    case Stage::Production: return 16;
    }
    return 16;
}

inline bool IsExposed(const IncidentState& state)
{
    return !state.credentialRevoked;
}

inline int RemainingEffort(const IncidentState& state)
{
    return std::max(0, state.budget - state.effortSpent);
}

inline IncidentState NewIncident(bool guided = false)
{
    IncidentState state;
    state.guided = guided;
    state.feedback = "Someone copied the service key from a public download. Stop their access and prepare a release that keeps the service working.";
    return state;
}

inline IncidentState Retry(const IncidentState& previous)
{
    return NewIncident(previous.guided);
}

namespace Detail
{
inline IncidentState UpdatePressure(IncidentState state)
{
    // Compute from total exposed time, rather than rounding each frame. Guided
    // play records time but only unsafe releases can raise its pressure.
    const std::int64_t timePressure = state.guided ? 0 : state.exposedMilliseconds / 1800;
    const std::int64_t actionPressure = static_cast<std::int64_t>(state.mistakes) * 25;
    state.pressure = static_cast<int>(std::min<std::int64_t>(100, timePressure + actionPressure));
    if (state.pressure >= 100)
    {
        state.failed = true;
        state.feedback = "Exposed credentials overwhelmed the live service. Retry starts a fresh incident at the checkpoint.";
    }
    return state;
}
} // namespace Detail

inline IncidentState Advance(const IncidentState& previous, std::int64_t deltaMs, bool active = true)
{
    if (!active || deltaMs <= 0 || previous.completed || previous.failed || !IsExposed(previous))
        return previous;

    IncidentState state = previous;
    const std::int64_t room = std::numeric_limits<std::int64_t>::max() - state.exposedMilliseconds;
    state.exposedMilliseconds += std::min(deltaMs, room);
    if (!state.guided)
    {
        // Stop at the exact failure instant even if one frame spans that point.
        // One long Advance and many short Advances therefore produce one state.
        const std::int64_t remainingPressure = std::max<std::int64_t>(0, 100 - static_cast<std::int64_t>(state.mistakes) * 25);
        state.exposedMilliseconds = std::min(state.exposedMilliseconds, remainingPressure * 1800);
    }
    return Detail::UpdatePressure(state);
}

// These are observations from probes, not a list of repair commands.
inline bool ServiceResponding(const IncidentState& state)
{
    return !state.initialCredentialRevoked || (state.runtimeBound && state.replacementProvisioned && !state.replacementExposed);
}

inline bool ReleaseReady(const IncidentState& state)
{
    return state.credentialRevoked && state.usageReviewed && state.replacementProvisioned
        && state.runtimeBound && state.sourceLiteralRemoved && !state.artifactContainsSecret && state.earlyCheck;
}

inline std::string ReleaseReadout(const IncidentState& state)
{
    return std::string("Copied-key request: ") + (state.credentialRevoked ? "REJECTED" : "ACCEPTED")
        + "\nService request: " + (ServiceResponding(state) ? "200 OK" : "401 - cannot authenticate")
        + "\nAccess trail: " + (state.usageReviewed ? "reviewed for current exposure" : "current exposure not reviewed")
        + "\nCode inspection: " + (state.sourceLiteralRemoved ? "reads a key reference" : state.sourceEncoded ? "decodes an embedded key" : "contains an embedded key")
        + "\nDownload inspection: " + (state.artifactContainsSecret ? "credential bytes found" : "no credential bytes")
        + "\nFake-key test change: " + (state.earlyCheck ? "release BLOCKED" : state.reportOnlyCheck ? "warning logged; release ALLOWED" : "release ALLOWED");
}

inline IncidentState Apply(const IncidentState& previous, Action action, Stage stage)
{
    if (previous.completed || previous.failed)
        return previous;

    IncidentState state = previous;
    const auto spend = [&state, stage]()
    {
        const int cost = RepairCost(stage);
        if (cost > RemainingEffort(state))
        {
            state.feedback = "Insufficient effort at this station. The operation made no changes; earlier stations cost less.";
            return false;
        }
        state.effortSpent += cost;
        return true;
    };

    switch (action)
    {
    case Action::InspectUsage:
        if (state.usageReviewed)
            state.feedback = "The current exposure windows are already reviewed. No extra effort spent.";
        else
        {
            state.usageReviewed = true;
            state.feedback = "Usage and history reviewed: public source and artifacts exposed this token; revocation must cover every live leaked token.";
        }
        break;

    case Action::RevokeCredential:
        if (state.credentialRevoked)
            state.feedback = "Every leaked token is already revoked. No extra effort spent.";
        else
        {
            state.initialCredentialRevoked = true;
            if (state.replacementExposed)
            {
                state.replacementProvisioned = false;
                state.runtimeBound = false;
                state.replacementExposed = false;
                state.feedback = "All leaked tokens revoked. The compromised replacement cannot be reused; provision a fresh one to restore service.";
            }
            else
                state.feedback = "The public token is revoked. Its copies remain in history, but they can no longer access the service.";
            state.credentialRevoked = true;
        }
        break;

    case Action::ProvisionReplacement:
        if (state.replacementProvisioned)
            state.feedback = state.replacementExposed
                ? "The current replacement is already exposed. Revoke it before issuing a fresh credential."
                : "A fresh managed credential already exists. No extra effort spent.";
        else
        {
            state.replacementProvisioned = true;
            state.feedback = "A fresh synthetic credential is ready in the managed vault. Delivery configuration decides where it goes.";
        }
        break;

    case Action::RemoveSourceLiteral:
        if (state.sourceLiteralRemoved)
            state.feedback = "The source literal is already removed. History and previous artifacts still keep their copies.";
        else if (spend())
        {
            state.sourceLiteralRemoved = true;
            state.sourceEncoded = false;
            state.feedback = "Hardcoded source literal removed. This does not revoke a token or remove it from shipped artifacts and history.";
        }
        break;

    case Action::RouteToRuntime:
        if (!state.replacementProvisioned)
            state.feedback = "No managed replacement exists to bind. The service still needs a valid credential.";
        else if (state.replacementExposed)
            state.feedback = "This replacement is public already. Moving it cannot make it private; revoke it and issue a fresh one.";
        else if (state.runtimeBound && !state.artifactContainsSecret)
            state.feedback = "Runtime vault binding and the clean artifact are already configured. No extra effort spent.";
        else if (spend())
        {
            state.runtimeBound = true;
            state.artifactContainsSecret = false;
            state.feedback = "The release now resolves its credential from the vault at runtime. A rebuilt artifact contains only the reference.";
        }
        break;

    case Action::RouteIntoArtifact:
        if (!state.replacementProvisioned)
            state.feedback = "No replacement exists to inject into the artifact. No change was made.";
        else if (state.replacementExposed)
            state.feedback = "This replacement is already inside a public artifact. Repeating the injection changes nothing.";
        else if (state.earlyCheck)
        {
            if (spend())
                state.feedback = "The scanner stopped this build: a key was inside the package. The previous package and service were kept; no new key escaped.";
        }
        else if (spend())
        {
            state.artifactContainsSecret = true;
            state.replacementExposed = true;
            state.credentialRevoked = false;
            state.runtimeBound = false;
            state.usageReviewed = false;
            ++state.mistakes;
            state.feedback = "Build-time injection published the replacement in the artifact. Runtime binding is lost, exposure resumed, and usage review is stale.";
        }
        break;

    case Action::InstallEarlyCheck:
        if (state.earlyCheck)
            state.feedback = "The early source and artifact secret checks are already installed. No extra effort spent.";
        else if (spend())
        {
            state.earlyCheck = true;
            state.reportOnlyCheck = false;
            state.feedback = "Early secret checks now scan source changes and release artifacts. Existing leaked credentials still need containment and repair.";
        }
        break;

    case Action::EncodeSourceLiteral:
        if (state.sourceEncoded)
            state.feedback = "The code already decodes an embedded key. No change made.";
        else if (spend())
        {
            state.sourceEncoded = true;
            state.sourceLiteralRemoved = false;
            state.artifactContainsSecret = true;
            state.feedback = "The key is no longer readable at a glance. A download inspection decodes it back to the same credential.";
        }
        break;

    case Action::ReportOnlyCheck:
        if (state.reportOnlyCheck)
            state.feedback = "The test already records warnings without stopping a release. No change made.";
        else if (spend())
        {
            state.reportOnlyCheck = true;
            state.earlyCheck = false;
            state.feedback = "The fake-key test produced a warning. The release still went through.";
        }
        break;

    case Action::RollBackRelease:
        state.runtimeBound = false;
        state.artifactContainsSecret = true;
        state.feedback = state.initialCredentialRevoked
            ? "The previous version is running again. Its old key receives 401: unauthorized. Public downloads still contain that key."
            : "The previous version is running again. Requests using the copied key are still accepted; the issuer did not change.";
        break;

    case Action::Validate:
        if (ReleaseReady(state))
        {
            state.completed = true;
            state.feedback = "Copied keys are rejected, the service works, and the candidate survives the leak rehearsal. Release verified.";
        }
        else
            state.feedback = "Rehearsal did not pass. Read the probe results; the candidate has not been released.";
        break;
    }

    return Detail::UpdatePressure(state);
}

inline std::string Grade(const IncidentState& state)
{
    if (state.failed)
        return "F";
    if (!state.completed)
        return "IN PROGRESS";
    // Code, packaging and enforcement at their owning stages cost seven effort. Emergency containment and replacement
    // never consume effort or lower the grade at any station.
    const int effortPenalty = std::max(0, state.effortSpent - 7) * 2;
    const int timePenalty = static_cast<int>(std::min<std::int64_t>(30, state.exposedMilliseconds / 6000));
    const int score = 100 - effortPenalty - state.mistakes * 15 - timePenalty;
    if (score >= 95) return "S";
    if (score >= 85) return "A";
    if (score >= 70) return "B";
    if (score >= 50) return "C";
    return "D";
}
} // namespace ShiftLeft
