import { describe, expect, it } from "vitest";
import { createGameState, resolveMonsterAttackPhase, type GameState } from "../game/turnEngine";
import { clearActiveMonsters, damageMonster, summonRandomMonster, summonRandomMonsterFromCatalogue } from "./engine";

function gameState(): GameState {
  return createGameState("1x4", [
    { id: "p1", teamId: "red", startingHand: ["a", "b", "c", "d"] },
    { id: "p2", teamId: "blue", startingHand: ["a", "b", "c", "d"] },
    { id: "p3", teamId: "green", startingHand: ["a", "b", "c", "d"] },
    { id: "p4", teamId: "yellow", startingHand: ["a", "b", "c", "d"] }
  ]);
}

describe("catalogue monster runtime", () => {
  it("summons a random monster from the requested rank with its real combat data", () => {
    const result = summonRandomMonster(gameState(), "Common", "monster-1", () => 0);
    expect(result.monster).toMatchObject({
      id: "monster-1",
      catalogueId: "C01",
      name: "Gob",
      rank: "Common",
      hp: 5,
      maxHp: 5,
      attackDamage: 1,
      attackInterval: 2,
      active: true
    });
    expect(result.attack).toEqual({
      monsterId: "monster-1",
      targetPlayerIds: ["p1", "p2", "p3", "p4"],
      reason: "first_summon"
    });
  });

  it("summons uniformly from the full 50-monster catalogue for a Monster tile", () => {
    const first = summonRandomMonsterFromCatalogue(gameState(), "tile-monster-1", { drawPile: [], discardPile: [] }, () => 0);
    expect(first.monster).toMatchObject({
      id: "tile-monster-1",
      catalogueId: "C01",
      name: "Gob",
      rank: "Common",
      active: true
    });
    expect(first.attack).toMatchObject({
      monsterId: "tile-monster-1",
      targetPlayerIds: ["p1", "p2", "p3", "p4"],
      reason: "first_summon"
    });

    const last = summonRandomMonsterFromCatalogue(gameState(), "tile-monster-2", { drawPile: [], discardPile: [] }, () => 0.999999);
    expect(last.monster.catalogueId).toBe("M10");
    expect(last.monster.rank).toBe("Myth");
    expect((last.state as GameState & { mythRuntime?: { catalogueId: string } }).mythRuntime?.catalogueId).toBe("M10");
  });

  it("initializes Fenny's one revival when summoned from a Monster tile", () => {
    const result = summonRandomMonsterFromCatalogue(
      gameState(),
      "tile-fenny",
      { drawPile: [], discardPile: [] },
      () => 35 / 50
    );

    expect(result.monster.catalogueId).toBe("L06");
    expect(result.monster.revivalsRemaining).toBe(1);

    const firstHit = damageMonster(result.state, "tile-fenny", 200, "p1");
    expect(firstHit.event.revived).toBe(true);
    expect(firstHit.event.defeated).toBe(false);
    expect(firstHit.state.monsters[0]).toMatchObject({ hp: 200, active: true, revivalsRemaining: 0 });

    const secondHit = damageMonster(firstHit.state, "tile-fenny", 200, "p1");
    expect(secondHit.event.defeated).toBe(true);
    expect(secondHit.state.monsters[0].active).toBe(false);
  });

  it("keeps monsters with no scheduled interval out of later scheduled attacks", () => {
    const summoned = summonRandomMonster(gameState(), "Myth", "myth-1", () => 0.1);
    expect(summoned.monster.attackInterval).toBeNull();
    const next = resolveMonsterAttackPhase({
      ...summoned.state,
      phase: "monster_attack",
      monsters: summoned.state.monsters.map((monster) => ({ ...monster, turnsSinceLastAttack: 99 }))
    }, () => 0);
    expect(next.attacks).toEqual([]);
  });

  it("reduces finite monster HP and deactivates a monster at zero", () => {
    const summoned = summonRandomMonster(gameState(), "Common", "monster-1", () => 0);
    const hit = damageMonster(summoned.state, "monster-1", 3, "p1");
    expect(hit.event).toMatchObject({
      attemptedDamage: 3,
      hpBefore: 5,
      hpAfter: 2,
      hpDamage: 3,
      defeated: false
    });
    const defeated = damageMonster(hit.state, "monster-1", 2, "p2");
    expect(defeated.event).toMatchObject({ hpBefore: 2, hpAfter: 0, hpDamage: 2, defeated: true });
    expect(defeated.state.monsters[0].active).toBe(false);
  });

  it("does not damage monsters whose catalogue HP is infinite", () => {
    const summoned = summonRandomMonster(gameState(), "Myth", "myth-2", () => 0.1);
    const hit = damageMonster(summoned.state, "myth-2", 999999, "p1");
    expect(hit.event).toMatchObject({
      hpBefore: null,
      hpAfter: null,
      hpDamage: 0,
      defeated: false,
      preventedBy: "infinite_hp"
    });
    expect(hit.state.monsters[0].active).toBe(true);
  });

  it("enforces the five-active-monster limit", () => {
    let state = gameState();
    for (let index = 0; index < 5; index++) {
      state = summonRandomMonster(state, "Common", `monster-${index}`, () => 0).state;
    }
    expect(() => summonRandomMonster(state, "Rare", "monster-6", () => 0)).toThrow(/maximum of 5/);
  });

  it("enforces the Epic rank limit independently of total board capacity", () => {
    let state = gameState();
    for (let index = 0; index < 4; index++) {
      state = summonRandomMonster(state, "Epic", `epic-${index}`, () => 0).state;
    }
    expect(() => summonRandomMonster(state, "Epic", "epic-5", () => 0)).toThrow(/Epic monster limit/);
  });

  it("clears active monsters without deleting their historical records", () => {
    let state = summonRandomMonster(gameState(), "Common", "monster-1", () => 0).state;
    state = summonRandomMonster(state, "Rare", "monster-2", () => 0).state;
    const cleared = clearActiveMonsters(state);
    expect(cleared.removedMonsterIds).toEqual(["monster-1", "monster-2"]);
    expect(cleared.state.monsters.every((monster) => !monster.active)).toBe(true);
    expect(cleared.state.monsters).toHaveLength(2);
  });
});
