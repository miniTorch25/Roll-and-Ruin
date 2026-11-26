import { describe, expect, it } from "vitest";
import { chooseBotAction, chooseBotCards } from "./bot";
import { createGameState } from "./turnEngine";

function stateWithHand(hand: string[], overrides: Partial<{ hp: number; maxHp: number; hearts: number; statuses: Array<{ type: "poison" | "bonus_dice"; turnsRemaining: number }> }> = {}) {
  const setup = Array.from({ length: 4 }, (_, index) => ({
    id: `p${index + 1}`,
    teamId: `team-${index + 1}`,
    startingHand: index === 0
      ? [...hand, ...Array.from({ length: Math.max(0, 4 - hand.length) }, (_, filler) => `filler-${filler}`)]
      : ["filler-a", "filler-b", "filler-c", "filler-d"]
  }));
  const state = createGameState("1x4", setup);
  return {
    ...state,
    phase: "choose_action" as const,
    players: state.players.map((player, index) => index === 0 ? {
      ...player,
      hp: overrides.hp ?? player.hp,
      maxHp: overrides.maxHp ?? player.maxHp,
      hearts: overrides.hearts ?? player.hearts,
      statusEffects: (overrides.statuses ?? []).map(effect => ({ ...effect }))
    } : player)
  };
}

describe("chooseBotAction", () => {
  it("draws when the bot has fewer than three cards", () => {
    expect(chooseBotAction({ hand: ["a", "b"] })).toBe("draw_two_roll_one");
    expect(chooseBotAction({ hand: [] })).toBe("draw_two_roll_one");
  });

  it("prioritizes movement when the bot has enough cards", () => {
    expect(chooseBotAction({ hand: ["a", "b", "c"] })).toBe("roll_two_dice");
    expect(chooseBotAction({ hand: ["a", "b", "c", "d"] })).toBe("roll_two_dice");
  });
});

describe("chooseBotCards", () => {
  it("uses healing when the bot has a meaningful HP deficit", () => {
    expect(chooseBotCards(stateWithHand(["green_herbal_potion"], { hp: 10 })))
      .toContain("green_herbal_potion");
  });

  it("saves healing when the bot is already near full HP", () => {
    expect(chooseBotCards(stateWithHand(["green_herbal_potion"], { hp: 19 }))).toEqual([]);
  });

  it("uses a heart card only when a heart has been lost", () => {
    expect(chooseBotCards(stateWithHand(["green_extra_heart"], { hearts: 2 })))
      .toContain("green_extra_heart");
    expect(chooseBotCards(stateWithHand(["green_extra_heart"], { hearts: 3 }))).toEqual([]);
  });

  it("cleanses an active negative status", () => {
    expect(chooseBotCards(stateWithHand(["green_holy_water"], {
      statuses: [{ type: "poison", turnsRemaining: 2 }]
    }))).toContain("green_holy_water");
  });

  it("does not select targeted, curse, or summon cards", () => {
    expect(chooseBotCards(stateWithHand([
      "blue_common_sword", "red_instant_kill", "red_summon_common", "yellow_sleep_spell"
    ]))).toEqual([]);
  });
});
