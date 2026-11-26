import { CARD_CATALOGUE, type CardDefinition } from "../cards/catalogue";
import { canReceiveInstantKill, type CardDeckState } from "../cards/deck";
import type { GameState } from "../game/turnEngine";

export interface LegendContribution {
  playerId: string;
  cardIds: string[];
}

export interface LegendOfferingEvent {
  monsterId: string;
  catalogueId: string;
  contributorIds: string[];
  consumedCardIds: string[];
  awardedCardIds: string[];
  removed: boolean;
  healedPlayerIds: string[];
  exchangeNumber?: number;
  selectedPlayerId?: string;
}

export interface LegendOfferingResult {
  state: GameState;
  deck: CardDeckState;
  event: LegendOfferingEvent;
}

function card(cardId: string): CardDefinition | undefined {
  return CARD_CATALOGUE.find((definition) => definition.id === cardId);
}

function takeRandomMatching(
  drawPile: string[],
  predicate: (definition: CardDefinition) => boolean,
  count: number,
  random: () => number
): string[] {
  const awarded: string[] = [];
  for (let index = 0; index < count; index++) {
    const candidates = drawPile
      .map((id, position) => ({ id, position, definition: card(id) }))
      .filter((entry) => entry.definition && predicate(entry.definition));
    if (!candidates.length) break;
    const choice = candidates[Math.min(candidates.length - 1, Math.max(0, Math.floor(random() * candidates.length)))];
    drawPile.splice(choice.position, 1);
    awarded.push(choice.id);
  }
  return awarded;
}

/**
 * Resolves a voluntary Legend-monster offering. The caller supplies explicit card
 * selections so UI layers can present the required payment choices before committing.
 */
export function resolveLegendOffering(
  inputState: GameState,
  monsterId: string,
  contributions: LegendContribution[],
  inputDeck: CardDeckState,
  options: { selectedDeckCardId?: string; random?: () => number } = {}
): LegendOfferingResult {
  const random = options.random ?? Math.random;
  const monster = inputState.monsters.find((item) => item.id === monsterId && item.active);
  if (!monster || !monster.catalogueId?.startsWith("L")) {
    throw new Error("An active Legend monster is required.");
  }
  if (!contributions.length) throw new Error("At least one player must contribute cards.");
  const players = new Map(inputState.players.map((player) => [player.id, player]));
  const seen = new Set<string>();
  const total = contributions.reduce((sum, contribution) => sum + contribution.cardIds.length, 0);
  for (const contribution of contributions) {
    const player = players.get(contribution.playerId);
    if (!player || player.status !== "alive") throw new Error("Every contributor must be a living player.");
    if (new Set(contribution.cardIds).size !== contribution.cardIds.length) throw new Error("A player cannot contribute the same card twice.");
    for (const cardId of contribution.cardIds) {
      if (seen.has(cardId) || !player.hand.includes(cardId)) throw new Error("Every contributed card must be a unique card in its owner's hand.");
      seen.add(cardId);
    }
  }
  if (monster.catalogueId !== "L10" && contributions.length !== 1) {
    throw new Error("Only Kingo accepts contributions from multiple players.");
  }
  const first = contributions[0];
  const allDefinitions = contributions.flatMap(contribution => contribution.cardIds.map(cardId => card(cardId)!));
  const requireCount = (count: number) => {
    if (total !== count) throw new Error(`This offering requires exactly ${count} card(s).`);
  };
  const requireAll = (predicate: (definition: CardDefinition) => boolean, message: string) => {
    if (allDefinitions.some(definition => !predicate(definition))) throw new Error(message);
  };
  const deck: CardDeckState = { drawPile: [...inputDeck.drawPile], discardPile: [...inputDeck.discardPile] };
  let state = inputState;
  const awardedCardIds: string[] = [];
  let healedPlayerIds: string[] = [];
  let removed = false;
  let selectedPlayerId: string | undefined;
  let exchangeNumber: number | undefined;

  switch (monster.catalogueId) {
    case "L01":
      requireCount(4);
      requireAll(definition => definition.kind === "support", "Lizzie accepts four Support/Buff cards.");
      removed = true;
      break;
    case "L02":
      requireCount(2);
      requireAll(definition => definition.color === "yellow", "Sphinxy accepts two Prank (yellow) cards.");
      removed = true;
      break;
    case "L03": {
      requireCount(3);
      if (!options.selectedDeckCardId || !deck.drawPile.includes(options.selectedDeckCardId)) {
        throw new Error("Gini requires choosing one card currently in the draw pile.");
      }
      const selected = card(options.selectedDeckCardId);
      if (!selected) throw new Error("The selected Gini reward is not in the card catalogue.");
      if (selected.effectId === "instant_kill" && !canReceiveInstantKill(first.hand.filter(cardId => !contributions[0].cardIds.includes(cardId)))) {
        throw new Error("A player who already holds Instant Kill cannot receive another copy.");
      }
      deck.drawPile.splice(deck.drawPile.indexOf(options.selectedDeckCardId), 1);
      awardedCardIds.push(options.selectedDeckCardId);
      removed = true;
      break;
    }
    case "L04":
      requireCount(2);
      requireAll(definition => definition.color === "green", "Unico accepts two green cards.");
      state = { ...state, players: state.players.map(player => {
        if (player.status !== "alive") return player;
        healedPlayerIds.push(player.id);
        return { ...player, hp: Math.min(player.maxHp, player.hp + 10) };
      }) };
      removed = true;
      break;
    case "L05": {
      requireCount(1);
      const remaining = monster.exchangesRemaining ?? 3;
      if (remaining <= 0) throw new Error("Lepri has no exchanges remaining.");
      const remainingHand = first.hand.filter(cardId => !contributions[0].cardIds.includes(cardId));
      const matching = takeRandomMatching(deck.drawPile,
        definition => definition.effectId !== "instant_kill" || canReceiveInstantKill(remainingHand), 2, random);
      awardedCardIds.push(...matching);
      exchangeNumber = 4 - remaining;
      const nextRemaining = remaining - 1;
      removed = nextRemaining === 0;
      state = { ...state, monsters: state.monsters.map(item => item.id === monsterId
        ? { ...item, exchangesRemaining: nextRemaining, active: !removed }
        : item) };
      break;
    }
    case "L06":
      requireCount(1);
      requireAll(definition => definition.id === "yellow_resurrection", "Fenny accepts one Resurrection card.");
      removed = true;
      break;
    case "L07":
      requireCount(2);
      requireAll(definition => definition.color === "blue" && definition.kind === "defense", "Mirro accepts two blue Defense cards.");
      removed = true;
      break;
    case "L08":
      requireCount(3);
      requireAll(definition => definition.color === "green", "Treeo accepts three green cards.");
      removed = true;
      break;
    case "L09":
      requireCount(2);
      requireAll(definition => definition.color === "blue", "Dwarfy accepts two blue cards.");
      awardedCardIds.push(...takeRandomMatching(deck.drawPile,
        definition => definition.color === "blue" && definition.kind === "defense", 3, random));
      removed = true;
      break;
    case "L10": {
      requireCount(5);
      const highest = Math.max(...contributions.map(contribution => contribution.cardIds.length));
      const candidates = contributions.filter(contribution => contribution.cardIds.length === highest);
      selectedPlayerId = candidates[Math.min(candidates.length - 1, Math.max(0, Math.floor(random() * candidates.length)))].playerId;
      const recipient = players.get(selectedPlayerId);
      const recipientHand = recipient?.hand ?? [];
      const curse = takeRandomMatching(deck.drawPile,
        definition => definition.kind === "curse" && (definition.effectId !== "instant_kill" || canReceiveInstantKill(recipientHand)), 1, random);
      awardedCardIds.push(...curse);
      removed = true;
      break;
    }
    default:
      throw new Error(`Legend offering is not configured for ${monster.catalogueId}.`);
  }

  state = {
    ...state,
    players: state.players.map(player => {
      const contribution = contributions.find(item => item.playerId === player.id);
      if (!contribution) return player;
      return {
        ...player,
        hand: [
          ...player.hand.filter(cardId => !contribution.cardIds.includes(cardId)),
          ...(player.id === first.playerId && monster.catalogueId !== "L10" ? awardedCardIds : []),
          ...(player.id === selectedPlayerId ? awardedCardIds : [])
        ]
      };
    }),
    monsters: state.monsters.map(item => item.id === monsterId
      ? { ...item, active: removed ? false : item.active }
      : item)
  };
  deck.discardPile.push(...contributions.flatMap(contribution => contribution.cardIds));
  return {
    state,
    deck,
    event: {
      monsterId,
      catalogueId: monster.catalogueId,
      contributorIds: contributions.map(contribution => contribution.playerId),
      consumedCardIds: contributions.flatMap(contribution => contribution.cardIds),
      awardedCardIds,
      removed,
      healedPlayerIds,
      ...(exchangeNumber === undefined ? {} : { exchangeNumber }),
      ...(selectedPlayerId === undefined ? {} : { selectedPlayerId })
    }
  };
}
