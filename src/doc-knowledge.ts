import scenarios from "./scenarios.json";

/** The local guide only reads the current mission. It never performs an action. */
export type DocKnowledgeContext = {
  missionId: number;
  missionTitle: string;
  objective: string;
  flags: Record<string, boolean>;
  feedback: string;
};

type Topic = { matches: RegExp; answer: string };

const topics: Topic[] = [
  {
    matches: /\b(devsecops|devops)\b/,
    answer:
      "DevSecOps means sharing responsibility for secure software delivery across development, security and operations. Build security into everyday changes, verify it with evidence, and keep recovery ready.",
  },
  {
    matches: /\b(shift(?:ing)? left|early feedback|earlier checks)\b/,
    answer:
      "Shifting left moves useful security and quality feedback earlier in delivery, where fixes can be easier. Early checks complement production monitoring, incident containment and recovery; they do not replace them.",
  },
  {
    matches:
      /\b(secret|secrets|credential|credentials|token|tokens|revok\w*|rotat\w*|hardcod\w*|vault|history)\b/,
    answer:
      "For a leaked credential, revoke the exposed credential first, then assess usage and historical copies. Rotate to a fresh managed secret and inject it at runtime. Deleting a line or rewriting repository history does not revoke a leaked credential; scanning helps prevent another leak.",
  },
  {
    matches: /\b(sast|static (?:analysis|application security testing))\b/,
    answer:
      "SAST (static application security testing) examines source or compiled code without running the application. Findings need triage: verify the risky code path and fix the cause. Rerun the scan after a code change.",
  },
  {
    matches: /\b(dast|dynamic (?:analysis|application security testing))\b/,
    answer:
      "DAST (dynamic application security testing) probes a running application from the outside. In this game, deploy the current patched source to the isolated staging target before scanning it. A result covers the tested target and scope, not every possible vulnerability.",
  },
  {
    matches: /\b(sca|software composition analysis)\b/,
    answer:
      "SCA (software composition analysis) checks the resolved third-party component inventory for known vulnerabilities. It includes transitive dependencies. Rerun SCA after updating the dependency tree; it does not prove application compatibility or complete security.",
  },
  {
    matches: /\b(sbom|software bill of materials|inventory)\b/,
    answer:
      "An SBOM (software bill of materials) is an inventory of software components and their versions. It helps identify affected dependencies; it is not a vulnerability scan. Refresh it after dependency resolution changes.",
  },
  {
    matches: /\b(transitive|dependenc\w*|lockfile|lock file|upgrade)\b/,
    answer:
      "A direct dependency is one the application uses explicitly; a transitive dependency arrives through another component. Update the affected parent to a compatible patched version, regenerate the lockfile and inventory, then rerun SCA and regression tests. A newer major version can break compatibility.",
  },
  {
    matches:
      /\b(iam|least privilege|permission\w*|wildcard|workload identity|admin|access denial)\b/,
    answer:
      "IAM (identity and access management) controls who may do what. Least privilege grants a dedicated identity only the actions and resources it needs. Test allowed operations and forbidden ones; a wildcard administrator role may hide a denial while creating excessive access.",
  },
  {
    matches: /\b(false positive|triage|suppress\w*|reachability)\b/,
    answer:
      "Triage checks a finding against evidence, including whether the vulnerable path is reachable. A false positive needs a documented reason, such as a non-executable fixture. Blanket suppression hides real issues; severity alone does not establish exposure or urgency.",
  },
  {
    matches:
      /\b(provenance|supply chain|signature|digest|trusted builder|artifact identity)\b/,
    answer:
      "Artifact provenance records how an output was built: source, commit, builder, inputs and artifact digest. Verify that evidence against promotion policy. A valid signature can identify a signer without proving the source or builder was approved. Quarantine suspect output before rebuilding.",
  },
  {
    matches:
      /\b(zero[ -]?day|severity|cvss|exploitab\w*|prioriti\w*|exposure|impact)\b/,
    answer:
      "Prioritize using exploitability, reachability, exposure and impact alongside severity. A reachable public flaw may need containment before a higher-severity development-only finding. Track the lower-exposure issue too, then test a permanent fix before removing temporary containment.",
  },
  {
    matches:
      /\b(rollback|incident|contain\w*|recovery|recover\w*|health check|restart)\b/,
    answer:
      "Contain harm promptly, preserve incident evidence, and recover a verified known-good release. Rollback is a valid immediate response. Validate service behavior and health, repair the cause and add a regression check before closing the incident; restarting the harmful release alone is insufficient.",
  },
  {
    matches: /\b(technical debt|tech debt|shortcut\w*)\b/,
    answer:
      "Technical debt is the future cost of shortcuts and deferred improvements. In SHIFT LEFT, retire shared secrets, enforce tests, pin patched dependencies and rehearse recovery. Prove the delivery system rejects unsafe work and still allows a clean release.",
  },
  {
    matches:
      /\b(green|secure|security guarantee|bypass|skipped check|required check|promotion|release gate)\b/,
    answer:
      "A green build is not proof of security. Promotion should require completed, successful checks on the current change. A skipped or bypassed check provides no passing evidence. Test that unsafe changes are blocked and valid changes can still ship.",
  },
  {
    matches: /\b(sql|injection|parameteri\w*|bound parameter)\b/,
    answer:
      "SQL injection happens when untrusted input can change query syntax. Use bound parameters so input stays data, then rerun source analysis and tests against the updated application. Escaping or suppressing a finding alone is not equivalent evidence.",
  },
  {
    matches: /\b(regression|test\w*|boundary|discount)\b/,
    answer:
      "Regression tests check that a change has not broken expected behavior, including boundary cases such as a zero discount. A build produces an artifact; tests exercise behavior. Fix the failing cause and rerun required checks rather than disabling the suite.",
  },
  {
    matches:
      /\b(ci|continuous integration|cd|continuous delivery|continuous deployment)\b/,
    answer:
      "Continuous integration (CI) builds and checks changes frequently. Continuous delivery keeps verified changes ready for release; continuous deployment automatically releases changes that meet the gates. Local checks give fast feedback, while independent required CI checks protect promotion.",
  },
  {
    matches: /\b(effort|cost|points|score)\b/,
    answer:
      "For code or configuration fixes, the game models effort as SOURCE 1 → BUILD 2 → TEST 4 → STAGE 8 → PROD 16. These are illustrative game units, not a universal cost formula. Investigation, containment, verification and recovery cost nothing.",
  },
  {
    matches:
      /\b(pipeline|stage|stages|source|build|artifact|production|staging|prod)\b/,
    answer:
      "The delivery order is SOURCE → BUILD → TEST → STAGE → PROD. Source stores reviewed changes; build produces an artifact; tests check behavior; staging exercises a production-like environment; production serves users. Each stage adds evidence, not a security guarantee.",
  },
];

function nextHint(context: DocKnowledgeContext): string {
  if (context.missionId === 1)
    return "Arrange SOURCE → BUILD → TEST → STAGE → PROD, then validate the pipeline. A passing run is a starting point, not proof of security.";
  const mission = scenarios.find((item) => item.id === context.missionId);
  if (!mission) return `Your objective: ${context.objective}`;
  const gate = mission.gates.find((item) =>
    item.flag.startsWith("!")
      ? context.flags[item.flag.slice(1)] === true
      : context.flags[item.flag] !== true,
  );
  return gate
    ? `Next checkpoint: ${gate.message} ${mission.hint}`
    : "The listed checkpoints are configured. Validate the release to verify the current system and see any remaining feedback.";
}

/** A deterministic, searchable local guide; this function makes no AI request. */
export function localDocAnswer(
  question: string,
  context: DocKnowledgeContext,
): string {
  const text = question
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’']/g, "")
    .trim();
  if (!text)
    return "Ask about the current mission or a DevSecOps term, or type ‘hint’ for the next checkpoint.";

  if (
    /\b(objective|my goal|this mission|current mission|what am i doing)\b/.test(
      text,
    )
  )
    return `${context.missionTitle}: ${context.objective}`;

  if (
    /\b(why|what)\b.*\b(fail\w*|blocked|held|wrong|stuck)\b|\b(current feedback|last error)\b/.test(
      text,
    )
  )
    return `${context.feedback || context.objective}\n${nextHint(context)}`;

  if (
    /\b(hint|next|stuck|what should i do|how do i win)\b|^(?:help|help me)[.!?]?$/.test(
      text,
    )
  )
    return nextHint(context);

  const scans = ["sast", "dast", "sca"].filter((term) =>
    new RegExp(`\\b${term}\\b`).test(text),
  );
  if (scans.length > 1)
    return "SAST examines source or compiled code without running the app. DAST probes a running application. SCA checks third-party components for known vulnerabilities. They cover different risks and need current evidence; none alone proves security.";

  const topic = topics.find((item) => item.matches.test(text));
  return (
    topic?.answer ??
    "DOC’s local guide has no matching entry for that question. Try ‘hint’, ‘SAST vs DAST’, ‘leaked secret’, ‘least privilege’, or another DevSecOps term from the mission."
  );
}
