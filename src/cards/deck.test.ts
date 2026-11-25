import { describe, expect, it } from "vitest";
import { createCardDeck, discardCard, drawCards, shuffleCardIds, takeCardFromHand } from "./deck";

describe("card deck primitives", () => {
  it("shuffles deterministically when a random source is supplied", () => {
    expect(shuffleCardIds(["a", "b", "c"], () => 0)).toEqual(["b", "c", "a"]);
  });

  it("draws cards from the top of the deck", () => {
    const result = drawCards(["in-hand"], { drawPile: ["one", "two"], discardPile: [] }, 2);
    expect(result.drawnCardIds).toEqual(["one", "two"]);
    expect(result.hand).toEqual(["in-hand", "one", "two"]);
    expect(result.deck.drawPile).toEqual([]);
  });

  it("draws only the cards available and does not silently recycle discards", () => {
    const result = drawCards([], { drawPile: ["last"], discardPile: ["used"] }, 3);
    expect(result.drawnCardIds).toEqual(["last"]);
    expect(result.deck.drawPile).toEqual([]);
    expect(result.deck.discardPile).toEqual(["used"]);
  });

  it("creates a deck with an empty discard pile", () => {
    expect(createCardDeck(["x", "y"], () => 0).discardPile).toEqual([]);
  });

  it("removes a selected card from hand and returns it for effect resolution", () => {
    expect(takeCardFromHand(["a", "b", "c"], "b")).toEqual({
      hand: ["a", "c"],
      playedCardId: "b"
    });
  });

  it("rejects using a card not held by the player", () => {
    expect(() => takeCardFromHand(["a"], "b")).toThrow();
  });

  it("only adds a card to discard when explicitly requested", () => {
    const deck = { drawPile: ["a"], discardPile: [] };
    expect(discardCard(deck, "played")).toEqual({
      drawPile: ["a"],
      discardPile: ["played"]
    });
    expect(deck.discardPile).toEqual([]);
  });
});
