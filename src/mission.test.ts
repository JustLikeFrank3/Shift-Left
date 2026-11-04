import { describe, it, expect } from "vitest";
import { newMission, moveStage, validate, finish } from "./mission";
describe("Mission 01", () => {
  it("starts unsolved", () => expect(newMission().completed).toBe(false));
  it("rejects an invalid order", () => {
    const m = validate(newMission());
    expect(m.running).toBe(false);
    expect(m.attempts).toBe(1);
  });
  it("allows a valid deployment", () => {
    let m = newMission();
    m = { ...m, order: ["SOURCE", "BUILD", "TEST", "STAGE", "PROD"] };
    m = validate(m);
    expect(m.running).toBe(true);
    expect(finish(m).completed).toBe(true);
  });
  it("does not move stages after completion", () => {
    const m = { ...newMission(), completed: true };
    expect(moveStage(m, 0, 1)).toBe(m);
  });
});
describe("deterministic transitions", () => {
  it("keeps input immutable when moving", () => {
    const initial = newMission();
    const moved = moveStage(initial, 1, 0);
    expect(initial.order[0]).toBe("PROD");
    expect(moved.order[0]).toBe("SOURCE");
    expect([...moved.order].sort()).toEqual([...initial.order].sort());
  });
  it("ignores invalid indices and deployment moves", () => {
    const initial = newMission();
    for (const n of [-1, 5, NaN, 1.5])
      expect(moveStage(initial, n, 0)).toBe(initial);
    const running = validate({
      ...initial,
      order: ["SOURCE", "BUILD", "TEST", "STAGE", "PROD"],
    });
    expect(moveStage(running, 0, 1)).toBe(running);
    expect(validate(running)).toBe(running);
  });
  it("only finishes a running mission and is repeatable", () => {
    const initial = newMission();
    expect(finish(initial)).toBe(initial);
    const solved = {
      ...initial,
      order: [
        "SOURCE",
        "BUILD",
        "TEST",
        "STAGE",
        "PROD",
      ] as typeof initial.order,
    };
    expect(finish(validate(solved))).toEqual(finish(validate(solved)));
    const completed = finish(validate(solved));
    expect(validate(completed)).toBe(completed);
    expect(finish(completed)).toBe(completed);
  });
});
