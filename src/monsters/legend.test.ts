import { describe, expect, it } from "vitest";
import { CARD_CATALOGUE } from "../cards/catalogue";
import { createGameState, type PlayerSetup } from "../game/turnEngine";
import { damageMonster, summonRandomMonster } from "./engine";
import { resolveLegendOffering } from "./legend";

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

  it("lets Dwarfy trade two blue cards for up to three blue Defense cards", () => {
    const result = resolveLegendOffering(summon("dwarfy"), "dwarfy", [
      { playerId: "p2", cardIds: ["blue_wooden_shield", "blue_iron_shield"] }
    ], deck);
    expect(result.event.awardedCardIds).toHaveLength(3);
    expect(result.event.awardedCardIds.every(id => CARD_CATALOGUE.find(card => card.id === id)?.kind === "defense")).toBe(true);
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

  it("rejects invalid card types and duplicate contributions without mutating input", () => {
    const state = summon("mirro");
    expect(() => resolveLegendOffering(state, "mirro", [
      { playerId: "p1", cardIds: ["green_herbal_potion", "green_life_core"] }
    ], deck)).toThrow(/blue Defense/);
    expect(state.players[0].hand).toEqual(setup[0].startingHand);
  });
});
