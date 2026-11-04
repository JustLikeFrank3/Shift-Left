import { describe, expect, it } from "vitest";
import { localDocAnswer, type DocKnowledgeContext } from "./doc-knowledge";

const context: DocKnowledgeContext = {
  missionId: 3,
  missionTitle: "The Leaked Secret",
  objective: "Revoke the exposed credential and migrate to a managed secret.",
  flags: {},
  feedback: "Contain the exposure: revoke the old credential.",
};

describe("DOC local guide", () => {
  it("teaches revocation before cleanup and distinguishes prevention", () => {
    const answer = localDocAnswer(
      "Can I delete a leaked secret from history?",
      context,
    );
    expect(answer).toContain("revoke the exposed credential first");
    expect(answer).toContain("Rotate to a fresh managed secret");
    expect(answer).toContain("does not revoke");
    expect(answer).toContain("prevent another leak");
  });

  it("distinguishes source, runtime and dependency scans", () => {
    expect(localDocAnswer("What is SAST?", context)).toContain(
      "without running",
    );
    expect(localDocAnswer("What is DAST?", context)).toContain(
      "running application",
    );
    expect(localDocAnswer("What is SCA?", context)).toContain(
      "third-party component",
    );
    expect(localDocAnswer("Help me understand SAST", context)).toContain(
      "without running",
    );
    const comparison = localDocAnswer("SAST vs DAST vs SCA?", context);
    expect(comparison).toContain("SAST examines");
    expect(comparison).toContain("DAST probes");
    expect(comparison).toContain("SCA checks");
    expect(comparison).toContain("none alone proves security");
  });

  it("explains that a green indicator does not establish security", () => {
    const answer = localDocAnswer(
      "Does a green build mean it is secure?",
      context,
    );
    expect(answer).toContain("not proof of security");
    expect(answer).toContain("skipped or bypassed");
  });

  it("offers the next unmet mission checkpoint without changing flags", () => {
    const initial = localDocAnswer("hint", context);
    expect(initial).toContain("revoke the old credential");
    const flags = { revoked: true };
    expect(localDocAnswer("What next?", { ...context, flags })).toContain(
      "usage audit",
    );
    expect(flags).toEqual({ revoked: true });
    expect(context.flags).toEqual({});
  });

  it("uses current feedback for a failure question and the objective on request", () => {
    expect(localDocAnswer("Why is it blocked?", context)).toContain(
      context.feedback,
    );
    expect(localDocAnswer("What is my objective?", context)).toContain(
      context.objective,
    );
  });

  it("gives unknown questions an honest fallback instead of inventing answers", () => {
    const answer = localDocAnswer("Who won the 2098 moon Olympics?", context);
    expect(answer).toContain("local guide has no matching entry");
    expect(answer).toContain("Try");
  });

  it("handles invalid mission ids and empty questions without throwing", () => {
    expect(localDocAnswer("hint", { ...context, missionId: 99 })).toContain(
      context.objective,
    );
    expect(localDocAnswer("  ", context)).toContain(
      "Ask about the current mission",
    );
  });

  it("does not penalize production containment in the effort explanation", () => {
    const answer = localDocAnswer("How does effort work?", context);
    expect(answer).toContain("illustrative game units");
    expect(answer).toContain(
      "containment, verification and recovery cost nothing",
    );
  });

  it("rejects wildcard IAM shortcuts and signature-only provenance", () => {
    expect(localDocAnswer("What is least privilege?", context)).toContain(
      "forbidden ones",
    );
    expect(
      localDocAnswer("Can a signature prove provenance?", context),
    ).toContain("without proving");
  });
});
