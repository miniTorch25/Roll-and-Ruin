import { describe, expect, it } from "vitest";
import {
  createGameState,
  endPlayerTurn,
  playCardFromHand,
  selectPlayerAction,
  startPlayerTurn,
  type PlayerSetup
} from "../game/turnEngine";
import { resolveMonsterAttackEvents } from "../cards/effectResolver";
import { summonRandomMonster } from "./engine";

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
  it("applies Scorpy poison and deals direct HP damage at the start of each affected turn", () => {
    const hit = hitMonster("Rare", () => 0.6);
    expect(hit.state.players[0].statusEffects).toContainEqual({
      type: "poison",
      turnsRemaining: 3,
      amount: 1
    });

    const started = startPlayerTurn({ ...hit.state, phase: "turn_start" }, () => 0);
    expect(started.players[0].hp).toBe(19);
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
