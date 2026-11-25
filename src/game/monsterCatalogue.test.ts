import { describe, expect, it } from "vitest";
import {
  createMonsterInstance,
  getMonsterDefinition,
  getMonstersByRank,
  MONSTER_CATALOGUE
} from "./monsterCatalogue";

describe("authoritative monster catalogue", () => {
  it("contains 50 unique monsters with 10 in each of the five ranks", () => {
    expect(MONSTER_CATALOGUE).toHaveLength(50);
    expect(new Set(MONSTER_CATALOGUE.map((monster) => monster.id)).size).toBe(50);
    for (const rank of ["Common", "Rare", "Epic", "Legend", "Myth"] as const) {
      expect(getMonstersByRank(rank)).toHaveLength(10);
    }
  });

  it("preserves confirmed base stats and multi-target attack counts", () => {
    expect(getMonsterDefinition("C01")).toMatchObject({
      name: "Gob", hp: 5, damage: 1, attackInterval: 2
    });
    expect(getMonsterDefinition("C02")).toMatchObject({
      name: "Bone", hp: 1, damage: 2, attackInterval: 2, targetCount: 2
    });
    expect(getMonsterDefinition("E04")).toMatchObject({
      name: "Cerby", hp: 80, damage: 4, attackInterval: 2, targetCount: 3
    });
    expect(getMonsterDefinition("M06")).toMatchObject({
      name: "Ragnar", hp: 99999, damage: 15,
      attackInterval: 2, attackPattern: "all_living", ignoresShields: true
    });
  });

  it("represents immortal HP and no recurring attack intervals without inventing values", () => {
    expect(getMonsterDefinition("M02")).toMatchObject({
      hp: null, damage: 1, attackInterval: null
    });
    expect(getMonsterDefinition("M03")?.hp).toBeNull();
    expect(getMonsterDefinition("M03")?.attackInterval).toBeNull();
  });

  it("creates an instance with current and maximum HP copied from its definition", () => {
    const definition = getMonsterDefinition("R05");
    if (!definition) throw new Error("Missing test monster definition.");
    const instance = createMonsterInstance(definition, "vampy-1");
    expect(instance).toMatchObject({
      id: "vampy-1",
      catalogueId: "R05",
      name: "Vampy",
      rank: "Rare",
      hp: 25,
      maxHp: 25,
      damage: 2,
      attackInterval: 2
    });
  });
});
