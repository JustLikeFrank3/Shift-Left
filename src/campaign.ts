import data from "./scenarios.json";
import { correctOrder, type Stage } from "./mission";
export const effortCost: Record<Stage, number> = {
  SOURCE: 1,
  BUILD: 2,
  TEST: 4,
  STAGE: 8,
  PROD: 16,
};
export type Intervention = {
  action: string;
  label: string;
  stage: Stage;
  cost: number;
};
export type Evidence = {
  id: string;
  title: string;
  stage: string;
  before: string;
  after: string;
  when: string;
};
export type Action = {
  kind: "fix" | "operation";
  id: string;
  label: string;
  detail: string;
  effects: Record<string, boolean>;
  requires: string[];
  evidence: string[];
  warning: boolean;
};
export type Scenario = {
  id: number;
  title: string;
  voice: string;
  brief: string;
  objective: string;
  hint: string;
  learning: string;
  evidence: Evidence[];
  actions: Action[];
  gates: { stage: string; flag: string; message: string }[];
};
export const scenarios: Scenario[] = data.map((s) => ({
  ...s,
  actions: s.actions.map((a) => ({
    ...a,
    kind: a.kind === "fix" ? ("fix" as const) : ("operation" as const),
    effects: Object.fromEntries(
      Object.entries(a.effects).filter(
        ([, value]) => typeof value === "boolean",
      ),
    ),
  })),
}));
export type CampaignMission = {
  effort: number;
  interventions: Intervention[];
  id: number;
  flags: Record<string, boolean>;
  inspected: string[];
  attempts: number;
  completed: boolean;
  feedback: string;
  log: string[];
  failedStage: Stage | null;
};
export function scenario(id: number) {
  const result = scenarios.find((s) => s.id === id);
  if (!result) throw new Error("Unknown mission");
  return result;
}
export function startScenario(id: number): CampaignMission {
  const s = scenario(id);
  return {
    id,
    effort: 0,
    interventions: [],
    flags: {},
    inspected: [],
    attempts: 0,
    completed: false,
    feedback: s.objective,
    log: ["Release held. Inspect evidence and configure the system."],
    failedStage: null,
  };
}
export function inspectEvidence(
  m: CampaignMission,
  id: string,
): CampaignMission {
  if (
    !scenario(m.id).evidence.some((e) => e.id === id) ||
    m.inspected.includes(id)
  )
    return m;
  return { ...m, inspected: [...m.inspected, id] };
}
export function evidenceText(m: CampaignMission, e: Evidence): string {
  if (m.id === 5 && e.id === "sast" && m.flags.sast && m.flags.parameterized)
    return (
      "F-01 RESOLVED / search.ts:12\nInput is bound as data, not SQL syntax.\n" +
      (m.flags.triaged
        ? "F-02 FALSE POSITIVE / non-executable fixture; reachability evidence documented."
        : "F-02 / fixtures/example.txt\nReview the non-executable fixture's reachability evidence.")
    );
  if (m.id === 5 && e.id === "dast" && m.flags.dast && m.flags.parameterized)
    return "DAST PASSED: synthetic injection cannot alter query structure.\nScope: demo search endpoint only.";
  if (m.id === 6 && e.id === "sbom" && m.flags.sbom && m.flags.locked)
    return m.flags.breaking
      ? "demo-shop → demo-renderer@2.0 → demo-parser@3.0\nInventory reflects the resolved major upgrade; application compatibility still needs verification."
      : "demo-shop → demo-renderer@1.3 → demo-parser@2.1\nInventory reflects the resolved compatible patched dependency tree.";
  if (m.id === 6 && e.id === "sca" && m.flags.sca && m.flags.locked)
    return (
      `SCA PASSED: resolved demo-parser@${m.flags.breaking ? "3.0" : "2.1"} is outside the synthetic affected range.\n` +
      "No known finding in this demo inventory; this is not a security guarantee." +
      (m.flags.breaking
        ? "\nRenderer 2.0 changes the application API; SCA does not verify compatibility."
        : "")
    );
  if (m.id === 6 && e.id === "lock" && m.flags.locked && m.flags.breaking)
    return "demo-renderer 2.0 / demo-parser 3.0\nResolved, but the application still calls the old rendering API.";
  if (m.id === 2 && e.id === "test-report" && m.flags["logic-fixed"])
    return m.completed
      ? "TEST PASSED: zero discount preserves the total.\nRequired regression suite remains enabled."
      : "Patch applied: zero discount preserves the total.\nRerun required tests to verify behavior.";
  return e.when && m.flags[e.when] ? e.after : e.before;
}
export function blockedReason(m: CampaignMission, a: Action): string | null {
  if (m.completed) return "Mission complete. Restart to experiment again.";
  if (a.requires.some((key) => !m.flags[key]))
    return (
      "Prerequisite: " +
      a.requires
        .filter((key) => !m.flags[key])
        .join(", ")
        .replaceAll("-", " ") +
      "."
    );
  if (a.evidence.some((id) => !m.inspected.includes(id)))
    return (
      "Inspect first: " +
      a.evidence
        .filter((id) => !m.inspected.includes(id))
        .map((id) => scenario(m.id).evidence.find((e) => e.id === id)!.title)
        .join(", ") +
      "."
    );
  return null;
}
export function act(
  m: CampaignMission,
  id: string,
  placement: Stage = "SOURCE",
): CampaignMission {
  if (!correctOrder.includes(placement)) return m;
  const a = scenario(m.id).actions.find((a) => a.id === id);
  if (!a) return m;
  const reason = blockedReason(m, a);
  if (reason) return { ...m, feedback: reason };
  let flags = { ...m.flags, ...a.effects };
  if (m.id === 6 && id === "regression" && flags.breaking)
    flags = { ...flags, regression: false };
  const changed = Object.entries(flags).some(
    ([key, value]) => !!m.flags[key] !== !!value,
  );
  const cost = a.kind === "fix" && changed ? effortCost[placement] : 0;
  const intervention = {
    action: id,
    label: a.label,
    stage: a.kind === "fix" ? placement : operationalStage(m.id, id),
    cost,
  };
  const feedback =
    m.id === 6 && id === "regression" && flags.breaking
      ? "Regression FAILED: renderer 2.0 changed the API. Restore the compatible release."
      : a.warning
        ? `${a.label}: system changed, but unresolved risks remain. Run validation to observe the consequence.`
        : `${a.label}: configuration applied. Rerun validation to check the result.`;
  return {
    ...m,
    flags,
    effort: m.effort + cost,
    interventions: changed
      ? [...m.interventions, intervention]
      : m.interventions,
    feedback:
      feedback +
      (cost ? ` Applied at ${placement}: ${cost} simulated effort.` : ""),
    failedStage: null,
    log: changed
      ? [
          "SYSTEM CHANGED / previous validation is stale. Rerun release checks.",
          feedback,
        ]
      : [...m.log, feedback].slice(-12),
  };
}
function operationalStage(id: number, action: string): Stage {
  if (
    [
      "revoke",
      "assess",
      "contain",
      "reopen",
      "rollback",
      "health",
      "restart",
      "restore",
      "capture",
    ].includes(action)
  )
    return "PROD";
  if (["stage", "dast", "verify", "recovery", "quarantine"].includes(action))
    return "STAGE";
  if (["lock", "sbom", "rotate"].includes(action)) return "BUILD";
  return "TEST";
}
function holds(flags: Record<string, boolean>, key: string) {
  return key.startsWith("!") ? !flags[key.slice(1)] : !!flags[key];
}
export function runScenario(m: CampaignMission): CampaignMission {
  if (m.completed) return m;
  const s = scenario(m.id);
  let flags = { ...m.flags };
  const log: string[] = [];
  let failedStage: Stage | null = null;
  let feedback = "";
  for (const stage of ["SOURCE", "BUILD", "TEST", "STAGE", "PROD"] as Stage[]) {
    // A real build must exist before this synthetic test failure becomes visible.
    if (m.id === 2 && stage === "TEST") flags["tests-discovered"] = true;
    if (
      m.id === 4 &&
      stage === "TEST" &&
      flags["bad-fixture"] &&
      flags.ci &&
      flags.enforced
    ) {
      flags["bad-blocked"] = true;
      failedStage = "TEST";
      feedback =
        "Unsafe fixture blocked by the required CI check. Prevention proved. Load the clean change and rerun with controls still enabled.";
      log.push("TEST: BLOCKED / synthetic credential detected");
      break;
    }
    if (
      m.id === 8 &&
      stage === "TEST" &&
      flags["skipped-fixture"] &&
      flags.required &&
      flags.protected
    ) {
      flags["skip-blocked"] = true;
      failedStage = "TEST";
      feedback =
        "Skipped check rejected. Load the completed-check fixture and validate without removing enforcement.";
      log.push("TEST: BLOCKED / skipped scan is not a pass");
      break;
    }
    if (
      m.id === 12 &&
      stage === "PROD" &&
      flags["debt-fixture"] &&
      flags.enforced
    ) {
      flags["debt-blocked"] = true;
      failedStage = "PROD";
      feedback =
        "Unsafe release blocked. TECH DEBT cannot bypass the acceptance contract. Load the clean release and rerun.";
      log.push("PROD: BLOCKED / unsafe release evidence rejected");
      break;
    }
    const failure = s.gates.find(
      (g) => g.stage === stage && !holds(flags, g.flag),
    );
    if (failure) {
      failedStage = stage;
      feedback = failure.message;
      log.push(`${stage}: HELD / ${feedback}`);
      break;
    }
    log.push(`${stage}: PASSED`);
  }
  const completed = failedStage === null;
  return {
    ...m,
    flags,
    attempts: m.attempts + 1,
    completed,
    failedStage,
    log,
    feedback: completed ? "Deployment validated. " + s.learning : feedback,
  };
}
export type Progress = { version: 1; selected: number; completed: number[] };
export const freshProgress = (): Progress => ({
  version: 1,
  selected: 1,
  completed: [],
});
export function parseProgress(raw: string | null): Progress {
  try {
    const p = JSON.parse(raw ?? "null");
    if (
      p?.version !== 1 ||
      !Number.isInteger(p.selected) ||
      p.selected < 1 ||
      p.selected > 12 ||
      !Array.isArray(p.completed)
    )
      return freshProgress();
    return {
      version: 1,
      selected: p.selected,
      completed: [
        ...new Set<number>(
          p.completed.filter(
            (n: unknown) =>
              Number.isInteger(n) && Number(n) >= 1 && Number(n) <= 12,
          ),
        ),
      ],
    };
  } catch {
    return freshProgress();
  }
}
