import { scenario, type CampaignMission, type Action } from "./campaign";
import { type Stage } from "./mission";
export const stations: {
  stage: Stage;
  x: number;
  name: string;
  role: string;
}[] = [
  {
    stage: "SOURCE",
    x: 380,
    name: "THE SOURCE FOUNDRY",
    role: "Prevent it here • 1 effort",
  },
  {
    stage: "BUILD",
    x: 1200,
    name: "ARTIFACT WORKS",
    role: "Shape the release • 2 effort",
  },
  {
    stage: "TEST",
    x: 2100,
    name: "THE PROVING GROUNDS",
    role: "Challenge assumptions • 4 effort",
  },
  {
    stage: "STAGE",
    x: 2950,
    name: "REHEARSAL DECK",
    role: "Test the real artifact • 8 effort",
  },
  {
    stage: "PROD",
    x: 3820,
    name: "THE LIVE GRID",
    role: "Contain first • fixes cost 16 effort",
  },
];
export const campaignRoute = [3, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const operations: Record<number, Record<string, Stage>> = {
  2: { "skip-tests": "TEST" },
  3: {
    revoke: "PROD",
    assess: "PROD",
    history: "SOURCE",
    rotate: "STAGE",
    delete: "SOURCE",
  },
  4: { bad: "TEST", clean: "TEST", disable: "STAGE" },
  5: { sast: "SOURCE", stage: "STAGE", dast: "STAGE", suppress: "SOURCE" },
  6: { sbom: "BUILD", sca: "TEST", regression: "TEST" },
  7: { probe: "TEST" },
  8: { skip: "TEST", normal: "TEST" },
  9: { quarantine: "PROD", verify: "STAGE", signature: "PROD" },
  10: {
    contain: "PROD",
    track: "TEST",
    test: "TEST",
    reopen: "PROD",
    severity: "BUILD",
  },
  11: {
    rollback: "PROD",
    capture: "PROD",
    verify: "STAGE",
    restore: "PROD",
    health: "PROD",
    restart: "PROD",
  },
  12: {
    revoke: "PROD",
    recovery: "STAGE",
    bad: "TEST",
    clean: "TEST",
    shortcut: "PROD",
  },
};
export function nearestStation(x: number) {
  return stations.reduce((a, b) =>
    Math.abs(b.x - x) < Math.abs(a.x - x) ? b : a,
  );
}
export function stationActions(m: CampaignMission, stage: Stage): Action[] {
  return scenario(m.id).actions.filter(
    (a) => a.kind === "fix" || operations[m.id]?.[a.id] === stage,
  );
}
export function stationEvidence(m: CampaignMission, stage: Stage) {
  const evidence = scenario(m.id).evidence.filter((e) => e.stage === stage);
  if (m.id === 3 && stage === "PROD")
    return [scenario(3).evidence.find((e) => e.id === "secret")!, ...evidence];
  return evidence;
}
export function isContained(m: CampaignMission) {
  return !!(
    m.completed ||
    m.flags.revoked ||
    m.flags.contained ||
    m.flags.quarantined
  );
}
export function nextMission(id: number) {
  return campaignRoute[(campaignRoute.indexOf(id) + 1) % campaignRoute.length];
}
export function nextDestination(m: CampaignMission): {
  stage: Stage;
  instruction: string;
} {
  if (m.completed)
    return {
      stage: "PROD",
      instruction: "Release restored. Enter the gateway to the next sector.",
    };
  const actions = scenario(m.id).actions;
  // Opening mission follows containment → investigate → managed replacement → source prevention.
  if (m.id === 3) {
    if (!m.flags.revoked)
      return {
        stage: "PROD",
        instruction:
          "The credential is leaking. Reach the red terminal and revoke it.",
      };
    if (!m.flags.assessed)
      return {
        stage: "PROD",
        instruction:
          "Read the usage audit. Find out what the exposed credential touched.",
      };
    if (!m.flags.rotated)
      return {
        stage: "STAGE",
        instruction:
          "Move LEFT to the vault on the rehearsal deck. Provision a replacement.",
      };
    if (!m.flags["history-reviewed"])
      return {
        stage: "SOURCE",
        instruction:
          "Trace the leak LEFT to source. Assess repository history.",
      };
    if (!m.flags.injected)
      return {
        stage: "SOURCE",
        instruction:
          "Replace hardcoding at SOURCE. Prevention is cheapest here.",
      };
    if (!m.flags["secret-check"])
      return {
        stage: "SOURCE",
        instruction:
          "Add the early secrets check, then validate the delivery pipeline.",
      };
    return {
      stage: "SOURCE",
      instruction:
        "Press R to run the repaired pipeline. Watch the release reach production.",
    };
  }
  if (m.id === 2) {
    if (!m.flags["module-fixed"])
      return {
        stage: "BUILD",
        instruction:
          "Investigate the broken artifact at BUILD and repair the import.",
      };
    if (!m.flags["tests-discovered"])
      return {
        stage: "TEST",
        instruction:
          "Run the pipeline with R. Find the failure behind the build failure.",
      };
    if (!m.flags["logic-fixed"] && !m.inspected.includes("test-report"))
      return {
        stage: "TEST",
        instruction:
          "Read the failing test report at TEST. The right fix starts with evidence.",
      };
    if (!m.flags["logic-fixed"])
      return {
        stage: "SOURCE",
        instruction:
          "Read the test report at TEST, then shift the fix LEFT to SOURCE.",
      };
  }
  const missing = actions.find(
    (a) =>
      !a.warning &&
      !(m.id === 4 && a.id === "bad" && m.flags["bad-blocked"]) &&
      !(m.id === 8 && a.id === "skip" && m.flags["skip-blocked"]) &&
      !(m.id === 12 && a.id === "bad" && m.flags["debt-blocked"]) &&
      Object.entries(a.effects).some(
        ([key, value]) => value && !m.flags[key],
      ) &&
      a.requires.every((key) => m.flags[key]),
  );
  if (missing) {
    const e = scenario(m.id).evidence.find(
      (e) => missing.evidence.includes(e.id) && !m.inspected.includes(e.id),
    );
    return {
      stage: (e?.stage as Stage) ?? operations[m.id]?.[missing.id] ?? "SOURCE",
      instruction: e
        ? `Investigate ${e.title} at ${e.stage}.`
        : `${missing.label}. ${missing.kind === "fix" ? "Shift LEFT to reduce repair effort." : "Find the matching station."}`,
    };
  }
  return {
    stage: nearestStation(380).stage,
    instruction: "Validate with R. DOC can help if the release is still held.",
  };
}
