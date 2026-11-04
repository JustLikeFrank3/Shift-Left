import { describe, it, expect } from "vitest";
import { startScenario, inspectEvidence, act, scenario } from "./campaign";
import {
  stationActions,
  stationEvidence,
  nextDestination,
  nearestStation,
  campaignRoute,
} from "./world-model";
describe("side-scrolling mission flow", () => {
  it("puts containment and exposure evidence together at the opening live terminal", () => {
    const m = startScenario(3);
    expect(nextDestination(m).stage).toBe("PROD");
    expect(stationEvidence(m, "PROD").some((e) => e.id === "secret")).toBe(
      true,
    );
    expect(stationActions(m, "PROD").some((a) => a.id === "revoke")).toBe(true);
    expect(stationActions(m, "SOURCE").some((a) => a.id === "revoke")).toBe(
      false,
    );
  });
  it("moves the player left after containment while keeping corrective fixes available at any station", () => {
    let m = startScenario(3);
    m = inspectEvidence(m, "secret");
    m = act(m, "revoke");
    m = inspectEvidence(m, "audit");
    m = act(m, "assess");
    expect(nextDestination(m).stage).toBe("STAGE");
    m = act(m, "rotate");
    expect(nextDestination(m).stage).toBe("SOURCE");
    for (const stage of ["SOURCE", "PROD"] as const)
      expect(stationActions(m, stage).some((a) => a.id === "inject")).toBe(
        true,
      );
  });
  it("exposes every required action and evidence source in the world", () => {
    for (const id of campaignRoute) {
      const m = startScenario(id);
      const stages = ["SOURCE", "BUILD", "TEST", "STAGE", "PROD"] as const;
      for (const a of scenario(id).actions)
        expect(
          stages.some((s) =>
            stationActions(m, s).some((item) => item.id === a.id),
          ),
        ).toBe(true);
      for (const e of scenario(id).evidence)
        expect(
          stages.some((s) =>
            stationEvidence(m, s).some((item) => item.id === e.id),
          ),
        ).toBe(true);
    }
  });
  it("maps actual world positions to delivery regions", () => {
    expect(nearestStation(3650).stage).toBe("PROD");
    expect(nearestStation(450).stage).toBe("SOURCE");
  });
});
