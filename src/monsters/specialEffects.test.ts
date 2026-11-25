import { describe, expect, it } from "vitest";
import {
  createGameState,
  endPlayerTurn,
  moveActivePlayer,
  playCardFromHand,
  selectPlayerAction,
  startPlayerTurn,
  type PlayerSetup
} from "../game/turnEngine";
import { resolveCardEffect, resolveMonsterAttackEvents } from "../cards/effectResolver";
import { damageMonster, summonRandomMonster } from "./engine";

const setup: PlayerSetup[] = [
  { id: "p1", teamId: "red", startingHand: ["a", "b", "c", "d"] },
  { id: "p2", teamId: "blue", startingHand: ["e", "f", "g", "h"] },
  { id: "p3", teamId: "green", startingHand: ["i", "j", "k", "l"] },
  { id: "p4", teamId: "yellow", startingHand: ["m", "n", "o", "p"] }
];

function hitMonster(rank: "Rare", random: () => number) {
  const initial = createGameState("1x4", setup);
  const summoned = summonRandomMonster(initial, rank, "monster-1", random);
  return resolveMonsterAttackEvents(summoned.state, [{
    monsterId: "monster-1",
    targetPlayerIds: ["p1"],
    reason: "scheduled"
  }]);
}

describe("monster-applied player status effects", () => {
  it("applies Bob's slow status and reduces movement by one on the next turn", () => {
    const hit = hitMonster("Rare", () => 0);
    expect(hit.state.players[0].statusEffects).toContainEqual({
      type: "movement_reduction",
      turnsRemaining: 1,
      amount: 1
    });
    const started = startPlayerTurn({ ...hit.state, phase: "turn_start" });
    const action = selectPlayerAction(started, "roll_two_dice", { random: () => 0.5 });
    expect(action.diceRolls).toEqual([4, 4]);
    const moved = moveActivePlayer(action.state);
    expect(moved.state.players[0].position).toBe(7);
  });

  it("applies Scorpy poison and deals direct HP damage at the start of each affected turn", () => {
    const hit = hitMonster("Rare", () => 0.6);
    expect(hit.state.players[0].statusEffects).toContainEqual({
      type: "poison",
      turnsRemaining: 3,
      amount: 1
    });

    const started = startPlayerTurn({ ...hit.state, phase: "turn_start" }, () => 0);
    expect(started.players[0].hp).toBe(16);
    expect(started.players[0].statusEffects).toContainEqual({
      type: "poison",
      turnsRemaining: 3,
      amount: 1
    });

    const ended = endPlayerTurn({ ...started, phase: "turn_end" });
    expect(ended.players[0].statusEffects).toContainEqual({
      type: "poison",
      turnsRemaining: 2,
      amount: 1
    });
  });

  it("lets poison trigger normal death and elimination before the player acts", () => {
    const initial = createGameState("1x4", setup);
    const poisoned = {
      ...initial,
      phase: "turn_start" as const,
      players: initial.players.map((player) => player.id === "p1"
        ? {
            ...player,
            hp: 1,
            hearts: 1,
            statusEffects: [{ type: "poison" as const, turnsRemaining: 1, amount: 1 }]
          }
        : player)
    };
    const started = startPlayerTurn(poisoned, () => 0);
    expect(started.players[0].status).toBe("eliminated");
    expect(started.phase).toBe("turn_end");
  });

  it("applies Stoney's one-die limit for the target's next turn", () => {
    const hit = hitMonster("Rare", () => 0.3);
    expect(hit.state.players[0].statusEffects).toContainEqual({
      type: "dice_limit",
      turnsRemaining: 1,
      amount: 1
    });
    const started = startPlayerTurn({ ...hit.state, phase: "turn_start" });
    const action = selectPlayerAction(started, "roll_two_dice", { random: () => 0.99 });
    expect(action.diceRolls).toHaveLength(1);
  });

  it("makes Wizzy roll for a 2-damage bonus blast on a 1 or 2", () => {
    const initial = createGameState("1x4", setup);
    const summoned = summonRandomMonster(initial, "Rare", "wizzy", () => 0.2);
    const result = resolveMonsterAttackEvents(summoned.state, [{
      monsterId: "wizzy", targetPlayerIds: ["p1"], reason: "scheduled"
    }], () => 0);
    expect(result.damageEvents.map((event) => event.attemptedDamage)).toEqual([3, 2]);
    expect(result.state.players[0].hp).toBe(15);
  });

  it("makes Harpy discard one random card from its target", () => {
    const initial = createGameState("1x4", setup);
    const summoned = summonRandomMonster(initial, "Rare", "harpy", () => 0.75);
    const result = resolveMonsterAttackEvents(summoned.state, [{
      monsterId: "harpy", targetPlayerIds: ["p1"], reason: "scheduled"
    }], () => 0);
    expect(result.state.players[0].hand).toEqual(["b", "c", "d"]);
  });

  it("applies Frosty's two-card limit for the target's next turn", () => {
    const hit = hitMonster("Rare", () => 0.9);
    expect(hit.state.players[0].statusEffects).toContainEqual({
      type: "cards_limit",
      turnsRemaining: 1,
      amount: 2
    });
    const started = startPlayerTurn({ ...hit.state, phase: "turn_start" });
    const cardPhase = selectPlayerAction(started, "use_cards").state;
    const one = playCardFromHand(cardPhase, "a");
    const two = playCardFromHand(one, "b");
    expect(() => playCardFromHand(two, "c")).toThrow(/at most 2 cards/);
  });


  it("heals Zomzom by 1 after each attack without exceeding maximum HP", () => {
    const initial = createGameState("1x4", setup);
    const summoned = summonRandomMonster(initial, "Common", "zomzom", () => 0.25);
    const damaged = {
      ...summoned.state,
      monsters: summoned.state.monsters.map((monster) => monster.id === "zomzom"
        ? { ...monster, hp: 10 }
        : monster)
    };
    const result = resolveMonsterAttackEvents(damaged, [{
      monsterId: "zomzom",
      targetPlayerIds: ["p1"],
      reason: "scheduled"
    }]);
    expect(result.damageEvents[0].attemptedDamage).toBe(1);
    expect(result.state.monsters[0].hp).toBe(11);

    const nearMaximum = {
      ...result.state,
      monsters: result.state.monsters.map((monster) => monster.id === "zomzom"
        ? { ...monster, hp: 20 }
        : monster)
    };
    const capped = resolveMonsterAttackEvents(nearMaximum, [{
      monsterId: "zomzom",
      targetPlayerIds: ["p1"],
      reason: "scheduled"
    }]);
    expect(capped.state.monsters[0].hp).toBe(20);
  });

  it("gives Fang +1 attack damage while at least two Wolves are active", () => {
    const initial = createGameState("1x4", setup);
    const first = summonRandomMonster(initial, "Common", "fang-1", () => 0.55);
    const second = summonRandomMonster(first.state, "Common", "fang-2", () => 0.55);
    const result = resolveMonsterAttackEvents(second.state, [{
      monsterId: "fang-1",
      targetPlayerIds: ["p1"],
      reason: "scheduled"
    }]);
    expect(result.damageEvents[0].attemptedDamage).toBe(3);
    expect(result.state.players[0].hp).toBe(17);
  });

  it("does not give Fang the pack bonus when it is the only active Wolf", () => {
    const initial = createGameState("1x4", setup);
    const summoned = summonRandomMonster(initial, "Common", "fang-1", () => 0.55);
    const result = resolveMonsterAttackEvents(summoned.state, [{
      monsterId: "fang-1",
      targetPlayerIds: ["p1"],
      reason: "scheduled"
    }]);
    expect(result.damageEvents[0].attemptedDamage).toBe(2);
    expect(result.state.players[0].hp).toBe(18);
  });


  it("makes the player who defeats Shroomy lose 1 HP from its spores", () => {
    const initial = createGameState("1x4", setup);
    const summoned = summonRandomMonster(initial, "Common", "shroomy", () => 0.65);
    const weakened = {
      ...summoned.state,
      monsters: summoned.state.monsters.map((monster) => monster.id === "shroomy"
        ? { ...monster, hp: 5 }
        : monster)
    };
    const result = resolveCardEffect(weakened, "blue_monster_hunter", {
      targetMonsterId: "shroomy",
      random: () => 0
    });
    expect(result.monsterDamageEvents[0].defeated).toBe(true);
    expect(result.state.players[0].hp).toBe(19);
    expect(result.damageEvents[0]).toMatchObject({
      kind: "direct_hp_loss",
      sourcePlayerId: "p1",
      targetPlayerId: "p1",
      attemptedDamage: 1,
      hpDamage: 1
    });
  });

  it("reduces Monster Hunter damage against Rocky by 1, but never below 1", () => {
    const initial = createGameState("1x4", setup);
    const summoned = summonRandomMonster(initial, "Common", "rocky", () => 0.85);
    const result = resolveCardEffect(summoned.state, "blue_monster_hunter", {
      targetMonsterId: "rocky"
    });
    expect(result.monsterDamageEvents[0].attemptedDamage).toBe(4);
    expect(result.state.monsters.find((monster) => monster.id === "rocky")?.hp).toBe(11);
  });



  it("makes Sneaky steal one random card on each scheduled attack and return all stolen cards when defeated", () => {
    const initial = createGameState("1x4", setup);
    const summoned = summonRandomMonster(initial, "Common", "sneaky", () => 0.95);
    const withTargetHand = {
      ...summoned.state,
      players: summoned.state.players.map((player) => player.id === "p1"
        ? { ...player, hand: ["kept", "stolen-a", "stolen-b"] }
        : player)
    };
    const attacked = resolveMonsterAttackEvents(withTargetHand, [{
      monsterId: "sneaky",
      targetPlayerIds: ["p1"],
      reason: "scheduled"
    }], () => 0.5);
    expect(attacked.state.players[0].hand).toEqual(["kept", "stolen-b"]);
    expect(attacked.state.monsters[0].stolenCards).toEqual([
      { ownerPlayerId: "p1", cardId: "stolen-a" }
    ]);

    const defeated = damageMonster(attacked.state, "sneaky", 4, "p2");
    expect(defeated.event.returnedCards).toEqual([
      { ownerPlayerId: "p1", cardId: "stolen-a" }
    ]);
    expect(defeated.state.players[0].hand).toEqual(["kept", "stolen-b", "stolen-a"]);
    expect(defeated.state.monsters[0].stolenCards).toEqual([]);
  });

  it("suppresses Webby's normal reward when an Attack card defeats it", () => {
    const initial = createGameState("1x4", setup);
    const summoned = summonRandomMonster(initial, "Common", "webby", () => 0.45);
    const result = resolveCardEffect(summoned.state, "blue_monster_hunter", {
      targetMonsterId: "webby"
    });
    expect(result.monsterDamageEvents[0].defeated).toBe(true);
    expect(result.monsterDamageEvents[0].rewardSuppressed).toBe(true);
  });

  it("assigns Minoo a random corner and attacks a player who crosses that corner", () => {
    const initial = createGameState("1x4", setup);
    let roll = 0;
    const summoned = summonRandomMonster(initial, "Rare", "minoo", () => roll++ === 0 ? 0.85 : 0);
    expect(summoned.monster.catalogueId).toBe("R09");
    expect(summoned.monster.triggerPosition).toBe(0);
    const positioned = {
      ...summoned.state,
      phase: "move" as const,
      players: summoned.state.players.map((player) => player.id === "p1"
        ? { ...player, position: 31 }
        : player),
      movementSteps: 1
    };
    const moved = moveActivePlayer(positioned);
    expect(moved.state.players[0].position).toBe(0);
    expect(moved.monsterAttackEvents).toEqual([{
      monsterId: "minoo",
      targetPlayerIds: ["p1"],
      reason: "movement_trigger"
    }]);
    const attacked = resolveMonsterAttackEvents(moved.state, moved.monsterAttackEvents, () => 0);
    expect(attacked.state.players[0].hp).toBe(16);
  });

  it("records Chesty's extra green-card reward when defeated", () => {
    const initial = createGameState("1x4", setup);
    const summoned = summonRandomMonster(initial, "Rare", "chesty", () => 0.15);
    expect(summoned.monster.catalogueId).toBe("R02");
    const defeated = damageMonster(summoned.state, "chesty", 30, "p1");
    expect(defeated.event.defeated).toBe(true);
    expect(defeated.event.bonusReward).toEqual({ greenCards: 1 });
  });

  it("makes Ghosty immune to attacks dealing less than 3 damage", () => {
    const initial = createGameState("1x4", setup);
    const summoned = summonRandomMonster(initial, "Rare", "ghosty", () => 0.5);
    const blocked = damageMonster(summoned.state, "ghosty", 2, "p1");
    expect(blocked.event.preventedBy).toBe("attack_below_threshold");
    expect(blocked.state.monsters[0].hp).toBe(12);
    const hit = damageMonster(blocked.state, "ghosty", 3, "p1");
    expect(hit.event.hpDamage).toBe(3);
    expect(hit.state.monsters[0].hp).toBe(9);
  });

  it("does not apply secondary statuses when invulnerability prevents the attack", () => {
    const initial = createGameState("1x4", setup);
    const summoned = summonRandomMonster(initial, "Rare", "monster-1", () => 0.6);
    const protectedState = {
      ...summoned.state,
      cardRuntime: {
        players: {
          p1: { shields: 0, invulnerableOwnerTurns: 1, reflectionCharges: 0 }
        }
      }
    };
    const result = resolveMonsterAttackEvents(protectedState, [{
      monsterId: "monster-1",
      targetPlayerIds: ["p1"],
      reason: "scheduled"
    }]);
    expect(result.damageEvents[0].preventedBy).toBe("invulnerability");
    expect(result.state.players[0].statusEffects).toEqual([]);
  });
});
