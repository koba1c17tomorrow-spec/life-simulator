import { describe, it, expect } from "vitest";
import { newGame, advanceMonth } from "../src/engine";
import {
  admissionChance,
  schoolPerformanceDelta,
  randomOrigin,
} from "../src/origins";
describe("v1.4 family and education", () => {
  it("birth conditions are deterministic", () => {
    expect(newGame(123).origin).toEqual(newGame(123).origin);
  });
  it("school performance depends on habits and upbringing", () => {
    const o = randomOrigin(() => 0.5);
    expect(schoolPerformanceDelta(o, [], "study")).toBeGreaterThan(
      schoolPerformanceDelta(o, [], "rest"),
    );
  });
  it("grades influence admission chance", () => {
    const o = randomOrigin(() => 0.5);
    const low = admissionChance({ ...o, schoolPerformance: 20 }, 30, []);
    const high = admissionChance({ ...o, schoolPerformance: 80 }, 30, []);
    expect(high).toBeGreaterThan(low);
  });
  it("school progress is updated monthly", () => {
    const s = newGame(42);
    s.month = 100;
    s.priority = "study";
    const n = advanceMonth(s, []);
    expect(n.origin.schoolPerformance).toBeGreaterThan(
      s.origin.schoolPerformance,
    );
  });
  it("admissions are resolved on graduation", () => {
    const s = newGame(42);
    s.month = 215;
    s.graduatedUniversity = true;
    const n = advanceMonth(s, []);
    expect(typeof n.origin.universityAccepted).toBe("boolean");
    expect(n.graduatedUniversity).toBe(n.origin.universityAccepted);
  });
  it("university has tuition and family support", () => {
    const s = newGame(42);
    s.month = 216;
    s.graduatedUniversity = true;
    s.origin.universityAccepted = true;
    const n = advanceMonth(s, []);
    expect(n.monthlyExpenses).toBeGreaterThan(0);
    expect(n.monthlyIncome).toBeGreaterThan(0);
  });
});
