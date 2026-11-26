import { describe, expect, it } from "vitest";
import { formatMatchTime, getRemainingMatchTime } from "./matchTimer";

describe("match timer", () => {
  it("returns the remaining time without allowing negative values", () => {
    expect(getRemainingMatchTime(10_000, 3_000)).toBe(7_000);
    expect(getRemainingMatchTime(10_000, 12_000)).toBe(0);
  });

  it("formats a countdown using ceiling seconds", () => {
    expect(formatMatchTime(600_000)).toBe("10:00");
    expect(formatMatchTime(599_200)).toBe("10:00");
    expect(formatMatchTime(599_000)).toBe("09:59");
    expect(formatMatchTime(1)).toBe("00:01");
    expect(formatMatchTime(0)).toBe("00:00");
  });
});
