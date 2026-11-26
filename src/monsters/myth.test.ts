import { describe, expect, it } from "vitest";
import { applyPlayerDeath, createGameState } from "../game/turnEngine";
import { resolveCardEffect } from "../cards/effectResolver";
import {
  acceptLucyOffer,
  advanceMythTurn,
  applyHecateLinkedDamage,
  getMythInteractionState,
  offerGranfelTrade,
  offerHecateCards,
  chooseNyxiaRandomCard,
  offerMythCards,
  notifyLuckCardUsed,
  summonMyth
} from "./myth";
import type { CardDeckState } from "../cards/deck";

const setup = [{ id: "p1", teamId: "red", startingHand: ["yellow_peek", "blue_common_sword", "green_herbal_potion", "red_summon_common"] }];
const bots = [
  ["yellow_peek", "blue_common_sword", "green_herbal_potion", "red_summon_common"],
  ["yellow_peek", "blue_common_sword", "green_herbal_potion", "red_summon_common"],
  ["yellow_peek", "blue_common_sword", "green_herbal_potion", "red_summon_common"]
];
const game = () => createGameState("1x4", setup, 32, bots);
const deck = (drawPile: string[] = []): CardDeckState => ({ drawPile, discardPile: [] });

describe("Myth Monsters M01-M10", () => {
  it("Hecate kills one player on summon and enables shared HP damage", () => {
    const result = summonMyth(game(), "M01", "hecate", deck(), () => 0);
    expect(result.state.players[0].hearts).toBe(2);
    expect(getMythInteractionState(result.state)?.linkedHp).toBe(true);
    const linked = applyHecateLinkedDamage(result.state, 2, () => 0);
    expect(linked.players.filter(player => player.status === "alive").every(player => player.hp === 18)).toBe(true);
  });

  it("Chronos marks every living player to skip their next turn", () => {
    const result = summonMyth(game(), "M03", "chronos", deck(), () => 0);
    expect(result.state.players.every(player => player.statusEffects.some(effect => effect.type === "skip_turn"))).toBe(true);
  });

  it("Nyxia hides hand identities and leaves immediately after Luck is used", () => {
    const result = summonMyth(game(), "M05", "nyxia", deck(), () => 0);
    expect(getMythInteractionState(result.state)?.hiddenHands).toBe(true);
    const removed = notifyLuckCardUsed(result.state);
    expect(removed.removed).toBe(true);
    expect(getMythInteractionState(removed.state)?.hiddenHands).toBe(false);
  });

  it("Pandy distributes three cards to every player and leaves immediately", () => {
    const pile = Array.from({ length: 12 }, () => "blue_common_sword");
    const result = summonMyth(game(), "M07", "pandy", deck(pile), () => 0);
    expect(result.removed).toBe(true);
    expect(result.state.players.every(player => player.hand.length === 7)).toBe(true);
    expect(result.deck?.drawPile).toHaveLength(0);
  });

  it("Ragnar accepts ten contributed cards across multiple players", () => {
    let state = game();
    state = { ...state, players: state.players.map(player => ({ ...player, hand: [...player.hand, ...Array(8).fill("blue_common_sword")] })) };
    const summoned = summonMyth(state, "M06", "ragnar", deck(), () => 0);
    const result = offerMythCards(summoned.state, [
      { playerId: "p1", cardIds: Array(5).fill("blue_common_sword") },
      { playerId: "bot-1", cardIds: Array(5).fill("blue_common_sword") }
    ]);
    expect(result.removed).toBe(true);
    expect(result.state.monsters.find(monster => monster.id === "ragnar")?.active).toBe(false);
  });


  it("Ragnar cannot be defeated by ordinary damage, even if a hit would exhaust its HP", () => {
    const summoned = summonMyth(game(), "M06", "ragnar-immortal", deck(), () => 0);
    const hit = damageMonster(summoned.state, "ragnar-immortal", 99999, "p1");
    expect(hit.event.defeated).toBe(false);
    expect(hit.event.hpAfter).toBe(1);
    expect(hit.state.monsters.find(monster => monster.id === "ragnar-immortal")?.active).toBe(true);
  });

  it("Ouro requires exactly one card of each color", () => {
    const summoned = summonMyth(game(), "M08", "ouro", deck(), () => 0);
    const result = offerMythCards(summoned.state, [{ playerId: "p1", cardIds: [
      "blue_common_sword", "yellow_peek", "green_herbal_potion", "red_summon_common"
    ] }]);
    expect(result.removed).toBe(true);
  });

  it("Granfel exchanges yellow cards for curse cards and resets its idle timer", () => {
    const summoned = summonMyth(game(), "M02", "granfel", deck(["red_forced_prison", "red_table_flip"]), () => 0);
    const result = offerGranfelTrade(summoned.state, "p1", deck(["red_forced_prison", "red_table_flip"]), () => 0);
    expect(result.state.players[0].hand).toContain("red_forced_prison");
    expect(result.state.mythRuntime?.granfelReceived).toBe(1);
    expect(result.state.mythRuntime?.granfelIdleTurns).toBe(0);
  });

  it("Lucy limits the heart-for-two-buffs bargain to once per player", () => {
    const summoned = summonMyth(game(), "M09", "lucy", deck(["green_immortal_blessing", "green_reflection_mirror"]), () => 0);
    const result = acceptLucyOffer(summoned.state, "p1", deck(["green_immortal_blessing", "green_reflection_mirror"]), () => 0);
    expect(result.state.players[0].hearts).toBe(2);
    expect(result.state.players[0].hand).toContain("green_immortal_blessing");
    expect(result.state.players[0].hand).toContain("green_reflection_mirror");
    expect(() => acceptLucyOffer(result.state, "p1", result.deck!, () => 0)).toThrow(/once/);
  });


  it("Hecate shares damage from ordinary card effects with all living players", () => {
    const summoned = summonMyth(game(), "M01", "hecate-link", deck(), () => 0);
    const result = resolveCardEffect(summoned.state, "blue_common_sword", { targetPlayerId: "bot-1", random: () => 0 });
    expect(result.state.players.filter(player => player.status === "alive").every(player => player.hp === 17)).toBe(true);
  });


  it("does not recursively spread reflected damage through Hecate's HP link", () => {
    const summoned = summonMyth(game(), "M01", "hecate-reflect", deck(), () => 0);
    const withReflection = {
      ...summoned.state,
      cardRuntime: {
        players: {
          "bot-1": { shields: 0, invulnerableOwnerTurns: 0, reflectionCharges: 1 }
        }
      }
    };
    const result = resolveCardEffect(withReflection, "blue_common_sword", {
      targetPlayerId: "bot-1",
      random: () => 0
    });
    expect(result.state.players.find(player => player.id === "p1")?.hp).toBe(14);
    expect(result.state.players.filter(player => player.id !== "p1").every(player => player.hp === 17)).toBe(true);
  });

  it("Chronos makes a player discard one random card after using three cards", () => {
    const summoned = summonMyth(game(), "M03", "chronos-discard", deck(), () => 0);
    const state = { ...summoned.state, players: summoned.state.players.map(player => player.id === "p1" ? { ...player, cardsPlayedThisTurn: 3 } : player) };
    const result = advanceMythTurn(state, "p1", () => 0);
    expect(result.state.players[0].hand).toHaveLength(3);
  });

  it("Granfel grants Resurrection to two random players when its idle timer expires", () => {
    let state = game();
    state = { ...state, players: state.players.map(player => player.id === "p1" ? { ...player, hand: ["blue_common_sword"] } : player) };
    state = summonMyth(state, "M02", "granfel-idle", deck(), () => 0).state;
    state = advanceMythTurn(state, "p1", () => 0).state;
    state = advanceMythTurn(state, "bot-1", () => 0).state;
    const result = advanceMythTurn(state, "bot-2", () => 0);
    expect(result.removed).toBe(true);
    expect(result.state.players.filter(player => player.hand.includes("yellow_resurrection"))).toHaveLength(2);
  });

  it("Void is removed by the shared player-death pipeline", () => {
    const summoned = summonMyth(game(), "M10", "void-death", deck(), () => 0);
    const death = applyPlayerDeath(summoned.state, "p1", () => 0);
    expect(death.state.monsters.find(monster => monster.id === "void-death")?.active).toBe(false);
  });


  it("Hecate accepts three yellow cards and awards four curses", () => {
    let state = game();
    state = { ...state, players: state.players.map(player => player.id === "p1"
      ? { ...player, hand: ["yellow_peek", "yellow_peek", "yellow_peek"] }
      : player) };
    const summoned = summonMyth(state, "M01", "hecate-offering", deck(), () => 0);
    const result = offerHecateCards(summoned.state, "p1", ["yellow_peek", "yellow_peek", "yellow_peek"],
      deck(["red_forced_prison", "red_table_flip", "red_grave_robbery", "red_silence"]), () => 0);
    expect(result.removed).toBe(true);
    expect(result.state.players[0].hand.filter(id => id.startsWith("red_"))).toHaveLength(4);
  });

  it("Nyxia exposes only one randomly selected card ID to the action layer", () => {
    const summoned = summonMyth(game(), "M05", "nyxia-random", deck(), () => 0);
    expect(chooseNyxiaRandomCard(summoned.state, "p1", () => 0)).toBe("yellow_peek");
  });

  it("all timed Myth effects expire at their configured turn count", () => {
    let state = summonMyth(game(), "M10", "void", deck(), () => 0).state;
    for (let i = 0; i < 5; i++) state = advanceMythTurn(state, "p1").state;
    expect(state.monsters.find(monster => monster.id === "void")?.active).toBe(false);
  });
});
