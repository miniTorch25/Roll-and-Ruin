import { describe, expect, it } from "vitest";
import { createCardDeck, discardCard, drawCards, shuffleCardIds, takeCardFromHand } from "./deck";
import { CARD_CATALOGUE } from "./catalogue";

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

  it("does not draw a second Instant Kill or a fifth Curse card, leaving blocked cards in the pile", () => {
    const hand = ["red_instant_kill", "red_weaken", "red_life_drain", "red_hand_robbery", "red_silence"];
    const result = drawCards(hand, {
      drawPile: ["red_instant_kill", "red_despair", "yellow_peek"],
      discardPile: []
    }, 2);
    expect(result.drawnCardIds).toEqual(["yellow_peek"]);
    expect(result.hand).toEqual([...hand, "yellow_peek"]);
    expect(result.deck.drawPile).toEqual(["red_instant_kill", "red_despair"]);
  });

  it("includes exactly one Joker in the catalogue and therefore in a newly created game deck", () => {
    const jokerCards = CARD_CATALOGUE.filter((card) => card.id === "white_joker");
    const deck = createCardDeck(CARD_CATALOGUE.map((card) => card.id), () => 0);
    expect(jokerCards).toHaveLength(1);
    expect(deck.drawPile.filter((cardId) => cardId === "white_joker")).toHaveLength(1);
  });

  it("keeps the single Joker out of circulation after it is drawn and used", () => {
    const initial = createCardDeck(["white_joker"], () => 0);
    expect(initial.drawPile).toEqual(["white_joker"]);
    const drawn = drawCards([], initial, 1);
    expect(drawn.drawnCardIds).toEqual(["white_joker"]);
    const used = discardCard(drawn.deck, "white_joker");
    const secondDraw = drawCards([], used, 1);
    expect(secondDraw.drawnCardIds).toEqual([]);
    expect(secondDraw.deck.drawPile).toEqual([]);
    expect(secondDraw.deck.discardPile).toEqual(["white_joker"]);
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
