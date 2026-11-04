import { describe, it, expect } from "vitest";
import {
  scenario,
  scenarios,
  startScenario,
  inspectEvidence,
  act,
  runScenario,
  parseProgress,
  evidenceText,
  type CampaignMission,
} from "./campaign";
const routes: Record<number, string[]> = {
  2: ["fix-module", "RUN", "fix-logic", "RUN"],
  3: ["revoke", "assess", "history", "rotate", "inject", "scan", "RUN"],
  4: ["hook", "ci", "enforce", "bad", "RUN", "clean", "RUN"],
  5: ["sast", "patch", "sast", "triage", "stage", "dast", "RUN"],
  6: ["sbom", "sca", "upgrade", "lock", "sbom", "sca", "regression", "RUN"],
  7: ["identity", "scope", "probe", "RUN"],
  8: ["coverage", "required", "protect", "skip", "RUN", "normal", "RUN"],
  9: ["quarantine", "pin", "rebuild", "verify", "RUN"],
  10: ["contain", "track", "patch", "test", "reopen", "RUN"],
  11: ["rollback", "capture", "verify", "restore", "fix", "health", "RUN"],
  12: [
    "revoke",
    "secrets",
    "tests",
    "dependencies",
    "recovery",
    "enforce",
    "bad",
    "RUN",
    "clean",
    "RUN",
  ],
};
function inspectAll(m: CampaignMission) {
  for (const e of scenario(m.id).evidence) m = inspectEvidence(m, e.id);
  return m;
}
function route(id: number, actions: string[]) {
  let m = inspectAll(startScenario(id));
  for (const action of actions)
    m = action === "RUN" ? runScenario(m) : act(m, action);
  return m;
}
describe("campaign transitions", () => {
  for (const s of scenarios) {
    it(`mission ${s.id} starts held and can be completed by changing the system`, () => {
      const initial = startScenario(s.id);
      expect(runScenario(initial).completed).toBe(false);
      const completed = route(s.id, routes[s.id]);
      expect(completed.completed).toBe(true);
      expect(completed.log).toContain("PROD: PASSED");
      expect(runScenario(completed)).toBe(completed);
      expect(act(completed, s.actions[0].id).flags).toEqual(completed.flags);
      expect(initial.flags).toEqual({});
    });
  }
  it("requires evidence and reveals tests only after the build succeeds", () => {
    const initial = startScenario(2);
    expect(act(initial, "fix-module").flags).toEqual({});
    expect(runScenario(initial).flags["tests-discovered"]).toBeUndefined();
    const m = route(2, ["fix-module", "RUN"]);
    expect(m.failedStage).toBe("TEST");
    expect(m.flags["tests-discovered"]).toBe(true);
    expect(
      act(inspectAll(startScenario(2)), "fix-logic").flags["logic-fixed"],
    ).toBeUndefined();
  });
  it("a bypassed test suite cannot ship even after the behavior is repaired", () => {
    const m = route(2, ["fix-module", "RUN", "fix-logic", "skip-tests", "RUN"]);
    expect(m.completed).toBe(false);
    expect(runScenario(act(m, "restore-tests")).completed).toBe(true);
  });
  it("deleting a secret line does not contain the exposed credential", () => {
    const m = route(3, ["delete", "RUN"]);
    expect(m.failedStage).toBe("SOURCE");
    expect(m.flags.revoked).toBeUndefined();
    expect(
      act(inspectAll(startScenario(3)), "rotate").flags.rotated,
    ).toBeUndefined();
  });
  it("requires both blocked bad work and allowed clean work", () => {
    const m = route(4, ["hook", "ci", "enforce", "clean", "RUN"]);
    expect(m.completed).toBe(false);
    const blocked = runScenario(act(m, "bad"));
    expect(blocked.flags["bad-blocked"]).toBe(true);
    expect(blocked.completed).toBe(false);
    expect(runScenario(act(blocked, "clean")).completed).toBe(true);
  });
  it("patching invalidates scan evidence and blanket suppression cannot pass", () => {
    const m = route(5, ["sast", "stage", "dast", "patch"]);
    expect(m.flags.sast).toBe(false);
    expect(m.flags.dast).toBe(false);
    expect(
      route(5, [...routes[5].slice(0, -1), "suppress", "RUN"]).completed,
    ).toBe(false);
    const repaired = route(5, routes[5]);
    expect(
      evidenceText(
        repaired,
        scenario(5).evidence.find((e) => e.id === "dast")!,
      ),
    ).toContain("DAST PASSED");
  });
  it("major upgrade breaks regressions and requires renewed lockfile, inventory and checks", () => {
    let m = route(6, [
      "sbom",
      "sca",
      "major",
      "lock",
      "sbom",
      "sca",
      "regression",
      "RUN",
    ]);
    expect(m.completed).toBe(false);
    expect(m.flags.regression).toBe(false);
    for (const a of ["repair", "lock", "sbom", "sca", "regression"])
      m = act(m, a);
    expect(runScenario(m).completed).toBe(true);
  });
  it("loads only bounded versioned progress and tolerates corrupt saves", () => {
    expect(parseProgress("bad")).toEqual({
      version: 1,
      selected: 1,
      completed: [],
    });
    expect(
      parseProgress('{"version":1,"selected":2,"completed":[2,2,99,"3",null]}'),
    ).toEqual({ version: 1, selected: 2, completed: [2] });
    expect(parseProgress('{"version":9}').selected).toBe(1);
  });
  it("scenario references and actions are internally consistent", () => {
    for (const s of scenarios) {
      expect(new Set(s.actions.map((a) => a.id)).size).toBe(s.actions.length);
      const flags = new Set(s.actions.flatMap((a) => Object.keys(a.effects)));
      if (s.id === 2) flags.add("tests-discovered");
      if (s.id === 4) flags.add("bad-blocked");
      if (s.id === 8) flags.add("skip-blocked");
      if (s.id === 12) flags.add("debt-blocked");
      for (const gate of s.gates)
        expect(flags.has(gate.flag.replace(/^!/, ""))).toBe(true);
      for (const a of s.actions)
        for (const e of a.evidence)
          expect(s.evidence.some((item) => item.id === e)).toBe(true);
    }
  });
});

describe("spatial intervention effort", () => {
  it("charges progressively more effort toward production for the same source fix", () => {
    const m = inspectAll(startScenario(2));
    const costs = ["SOURCE", "BUILD", "TEST", "STAGE", "PROD"].map(
      (stage) => act(m, "fix-module", stage as "SOURCE").effort,
    );
    expect(costs).toEqual([1, 2, 4, 8, 16]);
    expect(act(m, "fix-module", "PROD").flags).toEqual(
      act(m, "fix-module", "SOURCE").flags,
    );
    expect(m.effort).toBe(0);
  });
  it("never penalizes containment, investigation or recovery and does not charge no-op changes", () => {
    const initial = inspectAll(startScenario(3));
    const contained = act(initial, "revoke", "PROD");
    expect(contained.effort).toBe(0);
    expect(contained.interventions[0]).toMatchObject({
      stage: "PROD",
      cost: 0,
    });
    const fixed = act(inspectAll(startScenario(2)), "fix-module");
    expect(act(fixed, "fix-module", "PROD").effort).toBe(fixed.effort);
  });
  it("rejects wildcard permissions and allows rollback before evidence collection", () => {
    const elevated = route(7, ["identity", "admin", "probe", "RUN"]);
    expect(elevated.completed).toBe(false);
    expect(elevated.feedback).toContain("wildcard");
    expect(act(startScenario(11), "rollback", "PROD").flags.contained).toBe(
      true,
    );
  });
});

it("configuration changes clear stale stage results until the next validation", () => {
  const failed = route(2, ["fix-module", "RUN"]);
  expect(failed.log).toContain("BUILD: PASSED");
  const patched = act(failed, "fix-logic");
  expect(patched.log.some((line) => line.includes("PASSED"))).toBe(false);
  expect(patched.log[0]).toContain("stale");
  expect(runScenario(patched).completed).toBe(true);
});
