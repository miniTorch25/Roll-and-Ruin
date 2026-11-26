import { describe, expect, it } from "vitest";
import { chooseBotAction, chooseBotCards, chooseBotCardTargets, chooseBotCursePayment, chooseBotLegendOffering, chooseBotMythOffering } from "./bot";
import { createGameState } from "./turnEngine";
import { CARD_CATALOGUE } from "../cards/catalogue";

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

  it("selects a targeted attack and chooses a vulnerable opponent", () => {
    const state = stateWithHand(["blue_common_sword"]);
    const changed = {
      ...state,
      players: state.players.map((player, index) => index === 1
        ? { ...player, hp: 5, hearts: 1 }
        : player)
    };
    expect(chooseBotCards(changed)).toContain("blue_common_sword");
    expect(chooseBotCardTargets(changed, "blue_common_sword").targetPlayerId).toBe("p2");
  });

  it("selects Monster Hunter only when a finite-HP monster is active", () => {
    const state = stateWithHand(["blue_monster_hunter"]);
    const withMonster = {
      ...state,
      monsters: [{ id: "m1", rank: "Common" as const, hp: 4, maxHp: 4, attackPattern: "random_living" as const, attackInterval: 2, turnsSinceLastAttack: 0, active: true }]
    };
    expect(chooseBotCards(withMonster)).toContain("blue_monster_hunter");
    expect(chooseBotCardTargets(withMonster, "blue_monster_hunter").targetMonsterId).toBe("m1");
  });

  it("uses an affordable Curse and selects a vulnerable opponent", () => {
    const state = stateWithHand(["red_instant_kill"]);
    const changed = {
      ...state,
      players: state.players.map((player, index) => index === 1
        ? { ...player, hp: 4, hearts: 1 }
        : player)
    };
    expect(chooseBotCards(changed)).toContain("red_instant_kill");
    expect(chooseBotCardTargets(changed, "red_instant_kill").targetPlayerId).toBe("p2");
  });

  it("chooses HP, discard, or cooldown Curse payment according to available resources", () => {
    const healthy = stateWithHand(["red_instant_kill"], { hp: 18 });
    expect(chooseBotCursePayment(healthy, "p1")).toEqual({ type: "hp", amount: 5 });

    const lowHp = stateWithHand(["red_instant_kill"], { hp: 4 });
    const withDiscardCards = {
      ...lowHp,
      players: lowHp.players.map((player, index) => index === 0
        ? { ...player, hand: ["green_herbal_potion", "blue_wooden_shield"] }
        : player)
    };
    expect(chooseBotCursePayment(withDiscardCards, "p1")).toEqual({
      type: "discard",
      cardIds: ["green_herbal_potion", "blue_wooden_shield"]
    });

    const cooldownState = {
      ...lowHp,
      players: lowHp.players.map((player, index) => index === 0
        ? { ...player, hand: [] }
        : player)
    };
    expect(chooseBotCursePayment(cooldownState, "p1")).toEqual({ type: "cooldown" });
  });

  it("does not select targeted, curse, or summon cards when no legal target exists", () => {
    const state = stateWithHand(["blue_common_sword", "red_instant_kill", "red_summon_common", "yellow_sleep_spell"]);
    const solo = { ...state, players: state.players.map((player, index) => index === 0 ? player : { ...player, status: "eliminated" as const }) };
    expect(chooseBotCards(solo)).toEqual([]);
  });
});

describe("bot monster offerings", () => {
  it("selects the exact card types required by a Legend offering", () => {
    const state = stateWithHand(["yellow_peek", "yellow_sleep_spell", "blue_common_sword", "green_herbal_potion"]);
    const legend = { ...state, monsters: [{ id: "l02", catalogueId: "L02", name: "Sphinxy", rank: "Legend" as const, hp: null, maxHp: null, attackPattern: "random_living" as const, attackInterval: null, turnsSinceLastAttack: 0, active: true }] };
    const offering = chooseBotLegendOffering(legend, "l02");
    expect(offering?.cardIds).toHaveLength(2);
    expect(offering?.cardIds.every(id => CARD_CATALOGUE.find(card => card.id === id)?.color === "yellow")).toBe(true);
  });
  it("contributes only the remaining number of cards to Ragnar", () => {
    const state = stateWithHand(["yellow_peek", "blue_common_sword", "green_herbal_potion", "blue_wooden_shield"]);
    const myth = { ...state, monsters: [{ id: "m06", catalogueId: "M06", name: "Ragnar", rank: "Myth" as const, hp: 99999, maxHp: 99999, attackPattern: "all_living" as const, attackInterval: 2, turnsSinceLastAttack: 0, active: true }],
      mythRuntime: { monsterId: "m06", catalogueId: "M06", offerings: { p2: ["blue_common_sword", "green_herbal_potion", "yellow_peek", "blue_wooden_shield", "green_life_core", "blue_iron_shield", "yellow_card_rain", "green_extra_heart"] } } };
    expect(chooseBotMythOffering(myth, "m06")).toHaveLength(2);
  });
  it("offers only colors Ouro still needs", () => {
    const state = stateWithHand(["yellow_peek", "blue_common_sword", "green_herbal_potion", "red_instant_kill"]);
    const myth = { ...state, monsters: [{ id: "m08", catalogueId: "M08", name: "Ouro", rank: "Myth" as const, hp: null, maxHp: null, attackPattern: "all_living" as const, attackInterval: 1, turnsSinceLastAttack: 0, active: true }],
      mythRuntime: { monsterId: "m08", catalogueId: "M08", offerings: { p2: ["yellow_peek", "red_instant_kill"] } } };
    const cards = chooseBotMythOffering(myth, "m08");
    expect(cards.map(id => CARD_CATALOGUE.find(card => card.id === id)?.color).sort()).toEqual(["blue", "green"]);
  });
});
