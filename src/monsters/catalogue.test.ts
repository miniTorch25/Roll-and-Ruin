import { describe, expect, it } from "vitest";
import {
  getMonsterDefinition,
  getMonstersByRank,
  getRandomMonsterByRank,
  MONSTER_CATALOGUE,
  type MonsterRank
} from "./catalogue";

const RANKS: MonsterRank[] = ["Common", "Rare", "Epic", "Legend", "Myth"];

describe("authoritative monster catalogue", () => {
  it("contains exactly 50 uniquely identified monsters", () => {
    expect(MONSTER_CATALOGUE).toHaveLength(50);
    expect(new Set(MONSTER_CATALOGUE.map((monster) => monster.id)).size).toBe(50);
  });

  it("contains ten monsters in every rank", () => {
    for (const rank of RANKS) {
      expect(getMonstersByRank(rank)).toHaveLength(10);
    }
  });

  it("preserves the source monster stats and special-rule text", () => {
    expect(getMonsterDefinition("C01")).toMatchObject({
      name: "Gob",
      species: "Goblin",
      rank: "Common",
      hp: 5,
      attackDamage: 1,
      attackInterval: 2,
      rules: ["โจมตีทุก 2 เทิร์น", "60% ที่จะโจมตีเป้าหมายเดิมซ้ำ"]
    });
    expect(getMonsterDefinition("E04")).toMatchObject({
      name: "Cerby",
      hp: 80,
      attackDamage: 4,
      attackInterval: 2,
      targetCount: 3
    });
  });

  it("represents infinite-HP Myth monsters without inventing a numeric value", () => {
    for (const id of ["M02", "M03", "M04", "M05", "M07", "M08", "M09", "M10"]) {
      expect(getMonsterDefinition(id)?.hp).toBeNull();
    }
    expect(getMonsterDefinition("M06")?.hp).toBe(99999);
  });

  it("preserves monsters without a fixed attack interval as null", () => {
    expect(getMonsterDefinition("M01")?.attackInterval).toBeNull();
    expect(getMonsterDefinition("M02")?.attackInterval).toBeNull();
    expect(getMonsterDefinition("M06")?.attackInterval).toBe(2);
  });

  it("selects a random monster only from the requested rank", () => {
    expect(getRandomMonsterByRank("Rare", () => 0).id).toBe("R01");
    expect(getRandomMonsterByRank("Rare", () => 0.99).id).toBe("R10");
  });

  it("rejects invalid random values", () => {
    expect(() => getRandomMonsterByRank("Common", () => 1)).toThrow(/range/);
    expect(() => getRandomMonsterByRank("Myth", () => -0.1)).toThrow(/range/);
  });
});
