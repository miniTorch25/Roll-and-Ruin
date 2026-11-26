import { describe, expect, it } from "vitest";
import { CARD_CATALOGUE } from "../cards/catalogue";
import { createGameState, type PlayerSetup } from "../game/turnEngine";
import { damageMonster, summonRandomMonster } from "./engine";
import { resolveLegendOffering } from "./legend";
import { resolveCardEffect } from "../cards/effectResolver";

const setup: PlayerSetup[] = [
  { id: "p1", teamId: "red", startingHand: ["green_herbal_potion", "green_life_core", "green_extra_heart", "green_lucky_clover"] },
  { id: "p2", teamId: "blue", startingHand: ["blue_wooden_shield", "blue_iron_shield", "yellow_resurrection", "yellow_peek"] },
  { id: "p3", teamId: "green", startingHand: ["green_brave_spirit", "green_power_armor", "green_immortal_blessing", "green_reflection_mirror"] },
  { id: "p4", teamId: "yellow", startingHand: ["yellow_lucky_dice", "yellow_pickpocket", "yellow_peek", "yellow_resurrection"] }
];
const deck = { drawPile: CARD_CATALOGUE.map(card => card.id), discardPile: [] as string[] };

function summon(id: string) {
  const state = createGameState("1x4", setup);
  const index = ["lizzie", "sphinxy", "gini", "unico", "lepri", "fenny", "mirro", "treeo", "dwarfy", "kingo"].indexOf(id);
  if (index < 0) throw new Error(`Unknown test Legend ${id}`);
  return summonRandomMonster(state, "Legend", id, () => (index + 0.1) / 10).state;
}

describe("Legend monster offerings", () => {
  it("lets Lizzie accept four Support cards and leave", () => {
    const result = resolveLegendOffering(summon("lizzie"), "lizzie", [
      { playerId: "p1", cardIds: setup[0].startingHand }
    ], deck);
    expect(result.event.removed).toBe(true);
    expect(result.state.monsters[0].active).toBe(false);
    expect(result.state.players[0].hand).toEqual([]);
  });

  it("lets Sphinxy accept two yellow cards and leave", () => {
    const result = resolveLegendOffering(summon("sphinxy"), "sphinxy", [
      { playerId: "p2", cardIds: ["yellow_resurrection", "yellow_peek"] }
    ], deck);
    expect(result.event.removed).toBe(true);
  });

  it("lets Gini trade three cards for one selected draw-pile card", () => {
    const state = summon("gini");
    const chosen = deck.drawPile[deck.drawPile.length - 1];
    const result = resolveLegendOffering(state, "gini", [
      { playerId: "p1", cardIds: setup[0].startingHand.slice(0, 3) }
    ], deck, { selectedDeckCardId: chosen });
    expect(result.event.awardedCardIds).toEqual([chosen]);
    expect(result.state.players[0].hand).toContain(chosen);
  });

  it("does not let Gini give a second Instant Kill to a player who already holds one", () => {
    const state = summon("gini");
    const withKill = {
      ...state,
      players: state.players.map(player => player.id === "p1"
        ? { ...player, hand: [...player.hand, "red_instant_kill"] }
        : player)
    };
    expect(() => resolveLegendOffering(withKill, "gini", [
      { playerId: "p1", cardIds: setup[0].startingHand.slice(0, 3) }
    ], deck, { selectedDeckCardId: "red_instant_kill" })).toThrow(/already holds Instant Kill/);
  });

  it("lets Lepri exchange for Curse cards above the four-card limit but skips a duplicate Instant Kill", () => {
    const state = summon("lepri");
    const withKillAndCurses = {
      ...state,
      players: state.players.map(player => player.id === "p1"
        ? { ...player, hand: [...player.hand, "red_instant_kill", "red_weaken", "red_life_drain", "red_hand_robbery", "red_silence"] }
        : player)
    };
    const result = resolveLegendOffering(withKillAndCurses, "lepri", [
      { playerId: "p1", cardIds: ["green_herbal_potion"] }
    ], { drawPile: ["red_instant_kill", "red_despair", "red_cursed_dice", "yellow_peek"], discardPile: [] }, { random: () => 0 });
    expect(result.event.awardedCardIds).toEqual(["red_despair", "red_cursed_dice"]);
    expect(result.state.players[0].hand.filter(id => id === "red_instant_kill")).toHaveLength(1);
    expect(result.state.players[0].hand.filter(id => CARD_CATALOGUE.find(card => card.id === id)?.kind === "curse")).toHaveLength(7);
  });

  it("heals every living player by ten for Unico's green-card offering", () => {
    const state = summon("unico");
    const wounded = { ...state, players: state.players.map(player => ({ ...player, hp: 10 })) };
    const result = resolveLegendOffering(wounded, "unico", [
      { playerId: "p1", cardIds: ["green_herbal_potion", "green_life_core"] }
    ], deck);
    expect(result.event.healedPlayerIds).toHaveLength(4);
    expect(result.state.players.every(player => player.hp === 20)).toBe(true);
  });

  it("allows three Lepri exchanges and removes it after the third", () => {
    let state = summon("lepri");
    let currentDeck = deck;
    for (let i = 0; i < 3; i++) {
      const hand = state.players[0].hand;
      const result = resolveLegendOffering(state, "lepri", [
        { playerId: "p1", cardIds: [hand[0]] }
      ], currentDeck, { random: () => 0 });
      state = result.state;
      currentDeck = result.deck;
      expect(result.event.awardedCardIds).toHaveLength(2);
      expect(result.event.removed).toBe(i === 2);
    }
    expect(state.monsters[0].active).toBe(false);
  });

  it("revives Fenny once at full HP before allowing defeat", () => {
    let state = summon("fenny");
    const first = damageMonster(state, "fenny", 200, "p1");
    expect(first.event.revived).toBe(true);
    expect(first.event.defeated).toBe(false);
    expect(first.state.monsters[0].hp).toBe(200);
    const second = damageMonster(first.state, "fenny", 200, "p1");
    expect(second.event.defeated).toBe(true);
  });

  it("lets Mirro accept two blue Defense cards", () => {
    const result = resolveLegendOffering(summon("mirro"), "mirro", [
      { playerId: "p2", cardIds: ["blue_wooden_shield", "blue_iron_shield"] }
    ], deck);
    expect(result.event.removed).toBe(true);
  });

  it("lets Treeo accept three green cards", () => {
    const result = resolveLegendOffering(summon("treeo"), "treeo", [
      { playerId: "p1", cardIds: setup[0].startingHand.slice(0, 3) }
    ], deck);
    expect(result.event.removed).toBe(true);
  });

  it("lets Dwarfy consume only the selected copy when a player holds duplicate card IDs", () => {
    const base = summon("dwarfy");
    const state = {
      ...base,
      players: base.players.map(player => player.id === "p2"
        ? { ...player, hand: [...player.hand, "blue_wooden_shield"] }
        : player)
    };
    const result = resolveLegendOffering(state, "dwarfy", [
      { playerId: "p2", cardIds: ["blue_wooden_shield", "blue_wooden_shield"] }
    ], { drawPile: [], discardPile: [] });
    expect(result.state.players.find(player => player.id === "p2")?.hand.filter(id => id === "blue_wooden_shield")).toHaveLength(0);
    expect(result.event.consumedCardIds).toEqual(["blue_wooden_shield", "blue_wooden_shield"]);
    expect(result.event.awardedCardIds).toHaveLength(0);
  });

  it("does not consume unoffered duplicate copies from a contributor's hand", () => {
    const base = summon("dwarfy");
    const state = {
      ...base,
      players: base.players.map(player => player.id === "p2"
        ? { ...player, hand: [...player.hand, "blue_wooden_shield", "blue_wooden_shield"] }
        : player)
    };
    const result = resolveLegendOffering(state, "dwarfy", [
      { playerId: "p2", cardIds: ["blue_wooden_shield", "blue_wooden_shield"] }
    ], { drawPile: [], discardPile: [] });
    expect(result.state.players.find(player => player.id === "p2")?.hand.filter(id => id === "blue_wooden_shield")).toHaveLength(1);
  });

  it("collects Kingo's five-card tribute across players and rewards the top contributor", () => {
    const state = summon("kingo");
    const result = resolveLegendOffering(state, "kingo", [
      { playerId: "p1", cardIds: ["green_herbal_potion", "green_life_core"] },
      { playerId: "p2", cardIds: ["blue_wooden_shield", "blue_iron_shield"] },
      { playerId: "p3", cardIds: ["green_brave_spirit"] }
    ], deck, { random: () => 0 });
    expect(result.event.removed).toBe(true);
    expect(result.event.selectedPlayerId).toBe("p1");
    expect(result.event.awardedCardIds).toHaveLength(1);
    expect(result.state.players[0].hand).toContain(result.event.awardedCardIds[0]);
  });

  it.each([
    { id: "sphinxy", expected: 2 },
    { id: "unico", expected: 5 },
    { id: "lepri", expected: 1 },
    { id: "mirro", expected: 5 },
    { id: "treeo", expected: 1 },
    { id: "dwarfy", expected: 2 },
    { id: "kingo", expected: 2 }
  ])("$id reflects the configured percentage of actual HP damage", ({ id, expected }) => {
    const state = summon(id);
    const result = resolveCardEffect(state, "blue_monster_hunter", {
      targetMonsterId: id,
      random: () => 0
    });
    const reflection = result.damageEvents.find(event => event.kind === "reflection");
    expect(reflection?.hpDamage).toBe(expected);
    expect(result.state.players[0].hp).toBe(20 - expected);
    expect(result.monsterDamageEvents[0].reflectedDamage).toBe(expected);
  });

  it("makes Mirro's reflected damage bypass the attacker's shields", () => {
    const base = summon("mirro");
    const state = {
      ...base,
      cardRuntime: { players: { p1: { shields: 3 } } }
    } as unknown as typeof base;
    const result = resolveCardEffect(state, "blue_monster_hunter", {
      targetMonsterId: "mirro",
      random: () => 0
    });
    expect(result.state.players[0].hp).toBe(15);
    expect(result.state.cardRuntime.players.p1.shields).toBe(3);
  });

  it("rejects invalid card types and duplicate contributions without mutating input", () => {
    const state = summon("mirro");
    expect(() => resolveLegendOffering(state, "mirro", [
      { playerId: "p1", cardIds: ["green_herbal_potion", "green_life_core"] }
    ], deck)).toThrow(/blue Defense/);
    expect(state.players[0].hand).toEqual(setup[0].startingHand);
  });
});
