export interface CardDeckState {
  /** The next card to draw is at index 0. */
  drawPile: string[];
  /** Used cards are not automatically returned to this pile. */
  discardPile: string[];
}

import { CARD_CATALOGUE } from "./catalogue";

export const MAX_INSTANT_KILL_CARDS_PER_HAND = 1;
export const MAX_CURSE_CARDS_PER_HAND = 4;

/** Instant Kill is limited regardless of how the card is acquired. */
export function canReceiveInstantKill(hand: readonly string[]): boolean {
  return !hand.includes("red_instant_kill");
}

/** Whether a card may enter a hand through a random draw. Theft and monster exchanges deliberately bypass the Curse limit. */
export function canReceiveCardFromRandomDraw(hand: readonly string[], cardId: string): boolean {
  const definition = CARD_CATALOGUE.find((card) => card.id === cardId);
  if (!definition) return true;
  if (definition.effectId === "instant_kill" && !canReceiveInstantKill(hand)) return false;
  if (definition.kind === "curse" && hand.filter((id) => CARD_CATALOGUE.find((card) => card.id === id)?.kind === "curse").length >= MAX_CURSE_CARDS_PER_HAND) return false;
  return true;
}

export interface DrawResult {
  hand: string[];
  deck: CardDeckState;
  drawnCardIds: string[];
}

/** Fisher-Yates shuffle. The caller supplies the card list and random source. */
export function shuffleCardIds(
  cardIds: string[],
  random: () => number = Math.random
): string[] {
  const shuffled = [...cardIds];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.min(index, Math.floor(random() * (index + 1)));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function createCardDeck(
  cardIds: string[],
  random: () => number = Math.random
): CardDeckState {
  return { drawPile: shuffleCardIds(cardIds, random), discardPile: [] };
}

/** Draws from the top of the deck. An empty deck stays empty; no recycle rule is assumed. */
export function drawCards(
  hand: string[],
  deck: CardDeckState,
  amount = 1
): DrawResult {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error("Draw amount must be a non-negative integer.");
  }

  const nextHand = [...hand];
  const nextDrawPile = [...deck.drawPile];
  const drawnCardIds: string[] = [];

  while (drawnCardIds.length < amount && nextDrawPile.length > 0) {
    const eligibleIndex = nextDrawPile.findIndex((cardId) => canReceiveCardFromRandomDraw(nextHand, cardId));
    if (eligibleIndex < 0) break;
    const [cardId] = nextDrawPile.splice(eligibleIndex, 1);
    nextHand.push(cardId);
    drawnCardIds.push(cardId);
  }

  return {
    hand: nextHand,
    deck: { ...deck, drawPile: nextDrawPile, discardPile: [...deck.discardPile] },
    drawnCardIds
  };
}

/**
 * Removes a selected card from the hand and returns its ID to the caller.
 * The caller decides how its effect resolves and where the card goes afterward.
 */
export function takeCardFromHand(
  hand: string[],
  cardId: string
): { hand: string[]; playedCardId: string } {
  const index = hand.indexOf(cardId);
  if (index < 0) {
    throw new Error("The selected card is not in the player's hand.");
  }
  const nextHand = [...hand];
  nextHand.splice(index, 1);
  return { hand: nextHand, playedCardId: cardId };
}

/** Explicitly moves a card into the discard pile; never called implicitly by play. */
export function discardCard(
  deck: CardDeckState,
  cardId: string
): CardDeckState {
  return {
    drawPile: [...deck.drawPile],
    discardPile: [...deck.discardPile, cardId]
  };
}
