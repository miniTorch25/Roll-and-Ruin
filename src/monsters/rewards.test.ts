import { describe, expect, it } from "vitest";
import { CARD_CATALOGUE } from "../cards/catalogue";
import { createGameState, type PlayerSetup } from "../game/turnEngine";
import { damageMonster, summonRandomMonster } from "./engine";
import { resolveMonsterDefeatRewards } from "./rewards";

const setup: PlayerSetup[] = [
  { id: "p1", teamId: "red", startingHand: ["a", "b", "c", "d"] },
  { id: "p2", teamId: "blue", startingHand: ["e", "f", "g", "h"] },
  { id: "p3", teamId: "green", startingHand: ["i", "j", "k", "l"] },
  { id: "p4", teamId: "yellow", startingHand: ["m", "n", "o", "p"] }
];

const deck = {
  drawPile: CARD_CATALOGUE.map((card) => card.id),
  discardPile: []
};

describe("centralized monster defeat rewards", () => {
  it("grants the default three random Prank or Curse cards", () => {
    const state = createGameState("1x4", setup);
    const summoned = summonRandomMonster(state, "Common", "ratty", () => 0.3);
    const defeated = damageMonster(summoned.state, "ratty", 3, "p1");
    const result = resolveMonsterDefeatRewards(defeated.state, [defeated.event], deck, () => 0);
    const reward = result.events[0].cardIds;
    expect(reward).toHaveLength(3);
    expect(reward.every((id) => ["yellow", "red"].includes(CARD_CATALOGUE.find((card) => card.id === id)!.color))).toBe(true);
    expect(result.state.players[0].hand.slice(-3)).toEqual(reward);
    expect(result.deck.drawPile).toHaveLength(deck.drawPile.length - 3);
  });

  it("uses a monster's catalogue-specific reward instead of the default reward", () => {
    const state = createGameState("1x4", setup);
    const summoned = summonRandomMonster(state, "Epic", "ogrok", () => 0);
    const defeated = damageMonster(summoned.state, "ogrok", 60, "p1");
    const result = resolveMonsterDefeatRewards(defeated.state, [defeated.event], deck, () => 0);
    expect(result.events[0].cardIds).toHaveLength(4);
    expect(result.events[0].cardIds.every((id) => CARD_CATALOGUE.find((card) => card.id === id)?.color === "yellow")).toBe(true);
  });

  it("grants Chesty three default cards plus its bonus green card", () => {
    const state = createGameState("1x4", setup);
    const summoned = summonRandomMonster(state, "Rare", "chesty", () => 0.15);
    const defeated = damageMonster(summoned.state, "chesty", 30, "p1");
    const result = resolveMonsterDefeatRewards(defeated.state, [defeated.event], deck, () => 0);
    expect(result.events[0].cardIds).toHaveLength(4);
    expect(CARD_CATALOGUE.find((card) => card.id === result.events[0].cardIds[3])?.color).toBe("green");
  });

  it("withholds Webby's normal reward when its defeat event suppresses rewards", () => {
    const state = createGameState("1x4", setup);
    const summoned = summonRandomMonster(state, "Common", "webby", () => 0.45);
    const defeated = damageMonster(summoned.state, "webby", 4, "p1");
    const suppressed = { ...defeated.event, rewardSuppressed: true };
    const result = resolveMonsterDefeatRewards(defeated.state, [suppressed], deck, () => 0);
    expect(result.events[0].cardIds).toEqual([]);
    expect(result.state.players[0].hand).toEqual(setup[0].startingHand);
  });

  it("does not recycle discarded cards when the requested reward pool is exhausted", () => {
    const state = createGameState("1x4", setup);
    const summoned = summonRandomMonster(state, "Common", "ratty", () => 0.3);
    const defeated = damageMonster(summoned.state, "ratty", 3, "p1");
    const result = resolveMonsterDefeatRewards(defeated.state, [defeated.event], {
      drawPile: [],
      discardPile: ["blue_common_sword"]
    }, () => 0);
    expect(result.events[0].cardIds).toEqual([]);
    expect(result.deck.discardPile).toEqual(["blue_common_sword"]);
  });
});
