import { describe, expect, it } from "vitest";
import { CARD_CATALOGUE, getCardDefinition, getCardsByColor } from "./catalogue";

describe("authoritative Roll and Ruin card catalogue", () => {
  it("contains 61 unique cards including the single white Joker", () => {
    expect(CARD_CATALOGUE).toHaveLength(61);
    expect(new Set(CARD_CATALOGUE.map((card) => card.id)).size).toBe(61);
    expect(getCardsByColor("blue")).toHaveLength(12);
    expect(getCardsByColor("yellow")).toHaveLength(12);
    expect(getCardsByColor("green")).toHaveLength(12);
    expect(getCardsByColor("red")).toHaveLength(24);
    expect(getCardsByColor("white")).toHaveLength(1);
    expect(getCardDefinition("white_joker")?.kind).toBe("joker");
  });

  it("preserves the confirmed score values by card group", () => {
    expect(CARD_CATALOGUE.filter((card) => card.color === "blue" || card.color === "green")
      .every((card) => card.scoreValue === 1)).toBe(true);
    expect(getCardsByColor("yellow").every((card) => card.scoreValue === 0)).toBe(true);
    expect(getCardsByColor("white").every((card) => card.scoreValue === 0)).toBe(true);
    expect(CARD_CATALOGUE.filter((card) => card.kind === "summon")
      .every((card) => card.scoreValue === -2)).toBe(true);
    expect(CARD_CATALOGUE.filter((card) => card.kind === "curse")
      .every((card) => card.scoreValue === -4)).toBe(true);
  });

  it("contains five summon ranks and nineteen curses with the confirmed costs", () => {
    const summons = CARD_CATALOGUE.filter((card) => card.kind === "summon");
    const curses = CARD_CATALOGUE.filter((card) => card.kind === "curse");
    expect(summons).toHaveLength(5);
    expect(summons.every((card) => card.curseCostOptions === undefined)).toBe(true);
    expect(curses).toHaveLength(19);
    expect(curses.every((card) => card.curseCostOptions?.length === 3)).toBe(true);
    expect(curses.every((card) => card.cooldownLimitPerGame === 3)).toBe(true);
    expect(curses.every((card) => card.cooldownEligibility === "hp_or_cards_insufficient")).toBe(true);
  });

  it("exposes stable IDs and complete descriptions for every card", () => {
    expect(CARD_CATALOGUE.every((card) => card.id.length > 0 && card.name.length > 0
      && card.description.length > 0 && card.effectId.length > 0)).toBe(true);
    expect(getCardDefinition("blue_common_sword")?.name).toBe("ดาบสามัญ");
    expect(getCardDefinition("red_summon_myth")?.parameters?.rank).toBe("Myth");
  });
});
