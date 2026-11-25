import { getCardDefinition } from "./catalogue";
import { playCardFromHand, type GameState } from "../game/turnEngine";
import type { CardDefinition } from "./catalogue";

export interface PlayCatalogueCardResult {
  state: GameState;
  card: CardDefinition;
  playedCardId: string;
}

/**
 * Removes a catalogue card from the active player's hand and applies its confirmed score value.
 * The returned card definition is passed to the effect resolver; discard remains explicit.
 */
export function playCatalogueCard(state: GameState, cardId: string): PlayCatalogueCardResult {
  const card = getCardDefinition(cardId);
  if (!card) {
    throw new Error(`Unknown card ID: ${cardId}`);
  }

  return {
    state: playCardFromHand(state, cardId, card.scoreValue),
    card,
    playedCardId: cardId
  };
}
