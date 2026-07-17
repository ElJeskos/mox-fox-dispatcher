import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMETERS, INITIAL_OBSERVATIONS } from "../src/data";
import { calculateFoxReport } from "../src/report";

describe("calculateFoxReport", () => {
  it("ranks fox_001 first and explains its score for the supplied data", () => {
    const report = calculateFoxReport(INITIAL_OBSERVATIONS, DEFAULT_PARAMETERS);

    expect(report.uniqueFoxCount).toBe(4);
    expect(report.totalObservationCount).toBe(5);
    expect(report.leader?.foxId).toBe("fox_001");
    expect(report.leader?.score).toBe(15);
    expect(report.leader?.averageSuspicion).toBe(8.5);
    expect(report.leader?.reasons).toContain("2 наблюдения за одной лисой");
    expect(report.leader?.reasons).toContain("1 раз замечена с добычей");
  });

  it("recalculates the leader after observations change", () => {
    const changed = INITIAL_OBSERVATIONS.map((observation) =>
      observation.fox_id === "fox_001"
        ? { ...observation, suspicion_level: 1, has_prey: false }
        : observation,
    );

    const report = calculateFoxReport(changed, DEFAULT_PARAMETERS);

    expect(report.leader?.foxId).toBe("fox_003");
    expect(report.leader?.score).toBe(10);
  });

  it("aggregates locations in descending order", () => {
    const report = calculateFoxReport(INITIAL_OBSERVATIONS, DEFAULT_PARAMETERS);

    expect(report.locations).toEqual([
      { location: "Северная поляна", count: 3 },
      { location: "Моховой овраг", count: 1 },
      { location: "Туманная тропа", count: 1 },
    ]);
  });

  it("returns a valid empty report", () => {
    const report = calculateFoxReport([], DEFAULT_PARAMETERS);

    expect(report.leader).toBeNull();
    expect(report.leaders).toEqual([]);
    expect(report.uniqueFoxCount).toBe(0);
    expect(report.totalObservationCount).toBe(0);
    expect(report.rankings).toEqual([]);
  });

  it("reports a tie instead of choosing an arbitrary leader", () => {
    const report = calculateFoxReport(INITIAL_OBSERVATIONS, {
      suspicionWeight: 0,
      preyWeight: 0,
      repeatWeight: 0,
      sameLocationWeight: 0,
    });

    expect(report.leader).toBeNull();
    expect(report.leaders.map((fox) => fox.foxId)).toEqual([
      "fox_001",
      "fox_002",
      "fox_003",
      "fox_004",
    ]);
    expect(report.leaders.every((fox) => fox.score === 0)).toBe(true);
  });
});
