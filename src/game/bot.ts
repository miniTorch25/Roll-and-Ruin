import { CARD_CATALOGUE, type CardEffectId } from "../cards/catalogue";
import type { GamePlayer, GameState, PlayerAction } from "./turnEngine";

export interface BotCardTargets {
  targetPlayerId?: string;
  targetMonsterId?: string;
}

export type BotCursePayment =
  | { type: "hp"; amount: number }
  | { type: "discard"; cardIds: [string, string] }
  | { type: "cooldown" };

export interface BotLegendOffering {
  cardIds: string[];
  selectedDeckCardId?: string;
}

/** Select a legal Curse cost after the Curse card has been removed from the bot's hand. */
export function chooseBotCursePayment(
  state: GameState,
  playerId: string,
  excludedCardId?: string
): BotCursePayment | undefined {
  const player = state.players.find(candidate => candidate.id === playerId);
  const runtime = state.cardRuntime?.players[playerId] as unknown as { curseCooldownUses?: number; curseCooldownTurnsRemaining?: number } | undefined;
  if (!player) return undefined;
  const availableCards = player.hand.filter(cardId => cardId !== excludedCardId);
  if (player.hp > 10) return { type: "hp", amount: 5 };
  if (availableCards.length >= 2) {
    return { type: "discard", cardIds: [availableCards[0], availableCards[1]] };
  }
  if ((player.hp < 5 || availableCards.length < 2) &&
      (runtime?.curseCooldownUses ?? 0) < 3 &&
      (runtime?.curseCooldownTurnsRemaining ?? 0) === 0) {
    return { type: "cooldown" };
  }
  if (player.hp >= 5) return { type: "hp", amount: 5 };
  return undefined;
}

function offeringCardValue(cardId: string): number {
  const card = CARD_CATALOGUE.find(candidate => candidate.id === cardId);
  if (!card) return 0;
  if (card.effectId === "instant_kill") return 100;
  if (card.effectId === "resurrection") return 90;
  if (card.kind === "curse") return 75;
  if (card.kind === "support") return 55;
  if (card.kind === "defense") return 45;
  return 30;
}
function selectOfferingCards(hand: string[], predicate: (cardId: string) => boolean, count: number): string[] {
  return hand.map((id, index) => ({ id, index })).filter(entry => predicate(entry.id))
    .sort((a, b) => offeringCardValue(a.id) - offeringCardValue(b.id) || a.index - b.index)
    .slice(0, count).map(entry => entry.id);
}
export function chooseBotLegendOffering(state: GameState, monsterId: string, drawPile: readonly string[] = []): BotLegendOffering | undefined {
  const monster = state.monsters.find(candidate => candidate.id === monsterId && candidate.active);
  const player = state.players[state.activePlayerIndex];
  if (!monster || monster.rank !== "Legend" || !monster.catalogueId || !player || player.status !== "alive") return undefined;
  const requirements: Record<string, { count: number; matches: (cardId: string) => boolean }> = {
    L01: { count: 4, matches: id => CARD_CATALOGUE.find(card => card.id === id)?.kind === "support" },
    L02: { count: 2, matches: id => CARD_CATALOGUE.find(card => card.id === id)?.color === "yellow" },
    L03: { count: 3, matches: () => true },
    L04: { count: 2, matches: id => CARD_CATALOGUE.find(card => card.id === id)?.color === "green" },
    L05: { count: 1, matches: () => true },
    L06: { count: 1, matches: id => id === "yellow_resurrection" },
    L07: { count: 2, matches: id => { const card = CARD_CATALOGUE.find(candidate => candidate.id === id); return card?.color === "blue" && card.kind === "defense"; } },
    L08: { count: 3, matches: id => CARD_CATALOGUE.find(card => card.id === id)?.color === "green" },
    L09: { count: 2, matches: id => CARD_CATALOGUE.find(card => card.id === id)?.color === "blue" },
    L10: { count: 5, matches: () => true }
  };
  const requirement = requirements[monster.catalogueId];
  if (!requirement) return undefined;
  const cardIds = selectOfferingCards(player.hand, requirement.matches, requirement.count);
  if (cardIds.length !== requirement.count) return undefined;
  if (monster.catalogueId !== "L03") return { cardIds };
  if (!drawPile.length) return undefined;
  const remainingHand = player.hand.filter(id => !cardIds.includes(id));
  const selectedDeckCardId = [...drawPile].filter(id => id !== "red_instant_kill" || !remainingHand.includes("red_instant_kill"))
    .sort((a, b) => {
      const score = (id: string) => {
        const card = CARD_CATALOGUE.find(candidate => candidate.id === id);
        if (!card) return 0;
        if (card.effectId === "instant_kill") return 100;
        if (card.effectId === "gain_heart") return 90;
        if (card.effectId === "grant_invulnerability") return 85;
        if (card.kind === "curse") return 80;
        if (card.kind === "support") return 70;
        return 40;
      };
      return score(b) - score(a);
    })[0];
  return selectedDeckCardId ? { cardIds, selectedDeckCardId } : undefined;
}
export function chooseBotMythOffering(state: GameState, monsterId: string): string[] {
  const monster = state.monsters.find(candidate => candidate.id === monsterId && candidate.active);
  const player = state.players[state.activePlayerIndex];
  if (!monster || !player || player.status !== "alive") return [];
  const runtime = (state as GameState & { mythRuntime?: { monsterId: string; catalogueId: string; offerings: Record<string, string[]> } }).mythRuntime;
  if (!runtime || runtime.monsterId !== monsterId) return [];
  if (runtime.catalogueId === "M01") {
    return selectOfferingCards(player.hand,
      id => CARD_CATALOGUE.find(card => card.id === id)?.color === "yellow", 3);
  }
  if (runtime.catalogueId === "M02") {
    const yellowCount = player.hand.filter(id => CARD_CATALOGUE.find(card => card.id === id)?.color === "yellow").length;
    return selectOfferingCards(player.hand,
      id => CARD_CATALOGUE.find(card => card.id === id)?.color === "yellow", yellowCount);
  }
  if (runtime.catalogueId === "M06") {
    const offered = Object.values(runtime.offerings).reduce((sum, cards) => sum + cards.length, 0);
    return selectOfferingCards(player.hand, () => true, Math.max(0, 10 - offered));
  }
  if (runtime.catalogueId === "M08") {
    const offeredColors = new Set(Object.values(runtime.offerings).flat().map(id => CARD_CATALOGUE.find(card => card.id === id)?.color));
    const selected: string[] = [];
    for (const color of ["blue", "yellow", "green", "red"] as const) {
      if (offeredColors.has(color)) continue;
      const candidate = selectOfferingCards(player.hand.filter(id => !selected.includes(id)),
        id => CARD_CATALOGUE.find(card => card.id === id)?.color === color, 1)[0];
      if (candidate) selected.push(candidate);
    }
    return selected;
  }
  return [];
}


/**
 * Plan Kingo's shared tribute using bot-controlled players only. Human hands are
 * never treated as resources the AI may spend. Contributions are balanced to
 * reduce the chance that one bot becomes the sole highest contributor.
 */
export function chooseBotKingoOffering(
  state: GameState,
  monsterId: string
): Array<{ playerId: string; cardIds: string[] }> | undefined {
  const monster = state.monsters.find(candidate =>
    candidate.id === monsterId && candidate.active && candidate.catalogueId === "L10"
  );
  if (!monster) return undefined;
  const bots = state.players.filter(player => player.status === "alive" && player.isBot);
  const selected = new Set<string>();
  const contributions = new Map<string, string[]>();
  while (selected.size < 5) {
    const candidates = bots.map(player => {
      const available = player.hand
        .filter(id => !selected.has(id) && CARD_CATALOGUE.some(card => card.id === id))
        .sort((a, b) => offeringCardValue(a) - offeringCardValue(b));
      return { player, available, count: contributions.get(player.id)?.length ?? 0 };
    }).filter(entry => entry.available.length > 0)
      .sort((a, b) => a.count - b.count ||
        offeringCardValue(a.available[0]) - offeringCardValue(b.available[0]));
    const next = candidates[0];
    if (!next) return undefined;
    const cardId = next.available[0];
    selected.add(cardId);
    contributions.set(next.player.id, [...(contributions.get(next.player.id) ?? []), cardId]);
  }
  return [...contributions].map(([playerId, cardIds]) => ({ playerId, cardIds }));
}

export function chooseBotAction(player: Pick<GamePlayer, "hand">): Exclude<PlayerAction, "use_cards"> {
  if (player.hand.length < 3) return "draw_two_roll_one";
  return "roll_two_dice";
}

const NEGATIVE_STATUSES = new Set([
  "skip_turn", "dice_limit", "dice_reduction", "cards_silenced",
  "movement_blocked", "reverse_movement", "attack_damage_reduction",
  "cards_limit", "movement_reduction", "poison"
]);

function getPlayerShields(state: GameState, playerId: string): number {
  const runtime = state.cardRuntime?.players[playerId] as unknown as { shields?: number } | undefined;
  return runtime?.shields ?? 0;
}

function targetScore(state: GameState, player: GamePlayer, effectId: CardEffectId): number {
  const runtime = state.cardRuntime?.players[player.id];
  const handValue = player.hand.length * 1.5;
  const vulnerability = (player.maxHp - player.hp) * 0.35 + (3 - player.hearts) * 2;
  const shieldValue = getPlayerShields(state, player.id);
  const protectedTarget = (runtime?.invulnerableOwnerTurns ?? 0) > 0 ? 100 : 0;
  if (effectId === "steal_random_card") return handValue + vulnerability - protectedTarget;
  if (effectId === "view_player_hand") return handValue - protectedTarget;
  if (effectId === "skip_next_turn") {
    const skipped = player.statusEffects.some(effect => effect.type === "skip_turn" && effect.turnsRemaining > 0);
    return (skipped ? -100 : 8) + vulnerability - protectedTarget;
  }
  if (effectId === "limit_next_turn_dice") {
    const limited = player.statusEffects.some(effect => effect.type === "dice_limit" && effect.turnsRemaining > 0);
    return (limited ? -100 : 8) + vulnerability - protectedTarget;
  }
  if (effectId === "damage_and_remove_shields") return vulnerability + shieldValue * 3 - protectedTarget;
  if (effectId === "damage_single_pierce_shield") return vulnerability + shieldValue - protectedTarget;
  return vulnerability - protectedTarget;
}

/** Pick a legal card for effects that require a specific card from a player's hand. */
export function chooseBotSelectedCardId(state: GameState, effectId: CardEffectId, targetPlayerId?: string): string | undefined {
  const active = state.players[state.activePlayerIndex];
  const target = effectId === "force_discard_selected_card"
    ? state.players.find(player => player.id === targetPlayerId)
    : active;
  if (!active || !target || target.hand.length === 0) return undefined;
  const value = (id: string): number => {
    const card = CARD_CATALOGUE.find(candidate => candidate.id === id);
    if (!card) return 0;
    if (card.effectId === "instant_kill") return 100;
    if (card.effectId === "resurrection") return 90;
    if (card.kind === "support") return 70;
    if (card.kind === "curse") return 65;
    if (card.kind === "defense") return 55;
    return 35;
  };
  if (effectId === "force_discard_selected_card") {
    return [...target.hand].sort((a, b) => value(b) - value(a))[0];
  }
  return [...active.hand].sort((a, b) => value(a) - value(b))[0];
}

/** Use maximum legal values when the bot controls its dice for the current turn. */
export function chooseBotDiceValues(state: GameState, playerId: string): number[] {
  const player = state.players.find(candidate => candidate.id === playerId);
  if (!player) return [];
  const runtime = state.cardRuntime?.players[playerId];
  if (runtime?.diceControlUsedThisTurn) return [];
  const limited = player.statusEffects.some(effect => effect.type === "dice_limit" && effect.turnsRemaining > 0);
  const count = limited ? 1 : Math.min(3, 1 + (runtime?.bonusDiceThisTurn ?? 0));
  return Array.from({ length: count }, () => 6);
}

export function chooseBotCardTargets(state: GameState, cardId: string): BotCardTargets {
  const card = CARD_CATALOGUE.find(candidate => candidate.id === cardId);
  const active = state.players[state.activePlayerIndex];
  if (!card || !active) return {};

  if (card.effectId === "steal_eliminated_player_cards") {
    const target = state.players.find(player => player.status === "eliminated" && player.hand.length > 0);
    return target ? { targetPlayerId: target.id } : {};
  }

  if (card.effectId === "damage_monster_only") {
    const monster = state.monsters
      .filter(candidate => candidate.active && candidate.hp !== null && candidate.hp !== undefined && candidate.hp > 0)
      .sort((a, b) => (a.hp ?? Infinity) - (b.hp ?? Infinity))[0];
    return monster ? { targetMonsterId: monster.id } : {};
  }

  const requiresPlayerTarget = (typeof card.parameters?.target === "string" &&
    ["one_player", "another_player"].includes(String(card.parameters.target))) ||
    ["damage_with_random_splash", "damage_with_self_hp_cost", "conditional_damage"].includes(card.effectId);
  if (!requiresPlayerTarget) return {};

  const target = state.players
    .filter(player => player.status === "alive" && player.id !== active.id)
    .map(player => ({ player, score: targetScore(state, player, card.effectId) }))
    .filter(entry => entry.score > -50)
    .sort((a, b) => b.score - a.score)[0]?.player;
  return target ? { targetPlayerId: target.id } : {};
}

/** Choose useful self-support or targeted attack/prank cards, never manual-choice curses. */
export function chooseBotCards(state: GameState, random: () => number = Math.random): string[] {
  const player = state.players[state.activePlayerIndex];
  if (!player || player.status !== "alive") return [];
  const mythRuntime = (state as GameState & { mythRuntime?: { catalogueId: string; hiddenHands: boolean } }).mythRuntime;
  if (mythRuntime?.catalogueId === "M05" && mythRuntime.hiddenHands && player.hand.length > 0) {
    const roll = random();
    const index = Math.min(player.hand.length - 1, Math.max(0, Math.floor(roll * player.hand.length)));
    return [player.hand[index]];
  }
  if (player.statusEffects.some(effect => effect.type === "cards_silenced" && effect.turnsRemaining > 0)) return [];

  const runtime = state.cardRuntime?.players[player.id];
  const cardLimit = player.statusEffects
    .filter(effect => effect.type === "cards_limit" && effect.turnsRemaining > 0)
    .reduce((limit, effect) => Math.min(limit, effect.amount ?? 2), 3);
  const remainingPlays = Math.max(0, Math.min(3, cardLimit) - player.cardsPlayedThisTurn);
  if (remainingPlays === 0) return [];

  const activeMonsters = state.monsters.filter(monster => monster.active);
  const hasIncomingThreat = activeMonsters.some(monster => (monster.attackDamage ?? 0) > 0);
  const hasNegativeStatus = player.statusEffects.some(effect =>
    effect.turnsRemaining > 0 && NEGATIVE_STATUSES.has(effect.type)
  );
  const candidates: Array<{ id: string; effectId: CardEffectId; priority: number }> = [];

  for (const id of player.hand) {
    const card = CARD_CATALOGUE.find(candidate => candidate.id === id);
    if (!card || card.kind === "joker") continue;
    if (card.kind === "attack" && runtime?.blockedAttackCardsThisTurn) continue;

    let priority = 0;
    const amount = Number(card.parameters?.amount ?? 0);
    if (card.effectId === "summon_random_monster" && card.kind === "summon") {
      const rank = String(card.parameters?.rank ?? "");
      const rankLimit: Record<string, number> = { Common: 5, Rare: 5, Epic: 4, Legend: 3, Myth: 1 };
      const rankCount = activeMonsters.filter(monster => monster.rank === rank).length;
      const mythAlreadyActive = activeMonsters.some(monster => monster.rank === "Myth");
      if (activeMonsters.length < 5 && (rankLimit[rank] ?? 0) > rankCount && !(rank === "Myth" && mythAlreadyActive)) {
        priority = rank === "Common" ? 46 : rank === "Rare" ? 44 : rank === "Epic" ? 42 : rank === "Legend" ? 36 : 28;
      }
    }
    switch (card.effectId) {
      case "heal":
        if (player.maxHp - player.hp >= Math.min(4, amount)) priority = 75 + Math.min(amount, player.maxHp - player.hp);
        break;
      case "heal_and_end_card_play":
        if (player.maxHp - player.hp >= 8) priority = 100;
        break;
      case "gain_heart":
        if (player.hearts < 3) priority = 88;
        break;
      case "increase_max_hp":
        if (player.maxHp < 30) priority = 38;
        break;
      case "cleanse_negative_statuses":
        if (hasNegativeStatus) priority = 82;
        break;
      case "grant_invulnerability":
        if (hasIncomingThreat && (runtime?.invulnerableOwnerTurns ?? 0) === 0) priority = 78;
        break;
      case "reflect_next_damage":
        if (hasIncomingThreat) priority = 60;
        break;
      case "gain_bonus_die":
        if (!player.statusEffects.some(effect => effect.type === "dice_limit" && effect.turnsRemaining > 0) &&
            (runtime?.bonusDiceThisTurn ?? 0) === 0) priority = 52;
        break;
      case "draw_cards":
        if (player.hand.length <= 1) priority = 68;
        break;
      case "team_heal":
        if (player.maxHp - player.hp >= 3) priority = 72;
        break;
      case "control_dice_values":
        if (!(runtime?.diceControlUsedThisTurn ?? false) && chooseBotCursePayment(state, player.id, id)) priority = 50;
        break;
      case "damage_single":
      case "damage_single_pierce_shield":
      case "damage_and_remove_shields":
      case "damage_with_random_splash":
      case "damage_with_self_hp_cost":
      case "conditional_damage":
      case "view_player_hand":
      case "steal_random_card":
      case "skip_next_turn":
      case "limit_next_turn_dice":
      case "force_discard_selected_card":
      case "trade_for_random_card": {
        const target = chooseBotCardTargets(state, id);
        const opponent = state.players.find(candidate => candidate.id === target.targetPlayerId);
        const healthyEnough = card.effectId !== "damage_with_self_hp_cost" ||
          player.hp > Number(card.parameters?.selfHpCost ?? 2) + 1;
        if (opponent && healthyEnough) {
          priority = card.effectId === "steal_random_card" ? (opponent.hand.length ? 67 : 0)
            : card.effectId === "force_discard_selected_card" ? (opponent.hand.length ? 61 : 0)
            : card.effectId === "trade_for_random_card" ? (opponent.hand.length ? 45 : 0)
            : card.effectId === "skip_next_turn" ? 58
            : card.effectId === "damage_and_remove_shields" && getPlayerShields(state, opponent.id) > 0 ? 62
            : card.kind === "attack" ? 48 : 42;
        }
        break;
      }
      case "damage_monster_only":
        if (chooseBotCardTargets(state, id).targetMonsterId) priority = 57;
        break;
      case "instant_kill":
      case "force_prison":
      case "weaken_attack_damage":
      case "drain_hp_and_heal":
      case "discard_random_half_hand":
      case "silence_card_use":
      case "prevent_movement":
      case "reverse_movement_direction":
      case "halve_current_hp":
      case "swap_current_hp":
      case "reset_other_players_positions":
      case "clear_monsters_and_reroll_tiles":
      case "remove_other_players_shields":
      case "remove_buffs_and_shields":
      case "steal_eliminated_player_cards":
      case "mark_monster_attack_target": {
        if (!chooseBotCursePayment(state, player.id, id)) break;
        if (card.effectId === "steal_eliminated_player_cards" &&
            !state.players.some(candidate => candidate.status === "eliminated" && candidate.hand.length > 0)) break;
        if (card.effectId === "mark_monster_attack_target" && !activeMonsters.length) break;
        if (card.effectId === "clear_monsters_and_reroll_tiles" && !activeMonsters.length) break;
        if (card.effectId === "remove_other_players_shields" &&
            !state.players.some(candidate => candidate.id !== player.id && getPlayerShields(state, candidate.id) > 0)) break;
        if (card.effectId === "instant_kill") {
          const opponent = state.players.find(candidate => candidate.id === chooseBotCardTargets(state, id).targetPlayerId);
          if (!opponent || (state.cardRuntime?.players[opponent.id]?.invulnerableOwnerTurns ?? 0) > 0) break;
          priority = opponent.hearts <= 1 ? 94 : 76;
        } else if (card.effectId === "clear_monsters_and_reroll_tiles") {
          priority = 70;
        } else if (card.effectId === "reset_other_players_positions") {
          priority = 55;
        } else {
          const opponent = state.players.find(candidate => candidate.id === chooseBotCardTargets(state, id).targetPlayerId);
          if (!opponent) break;
          priority = card.effectId === "drain_hp_and_heal" ? 72
            : card.effectId === "discard_random_half_hand" && opponent.hand.length >= 3 ? 68
            : card.effectId === "force_prison" ? 64
            : card.effectId === "silence_card_use" ? 63
            : card.effectId === "halve_current_hp" ? 67
            : 54;
        }
        break;
      }
      default:
        break;
    }
    if (priority > 0) candidates.push({ id, effectId: card.effectId, priority });
  }

  candidates.sort((a, b) => b.priority - a.priority);
  const selected: string[] = [];
  const selectedEffects = new Set<CardEffectId>();
  let selectedCurse = false;
  for (const candidate of candidates) {
    if (selected.length >= Math.min(2, remainingPlays)) break;
    const definition = CARD_CATALOGUE.find(card => card.id === candidate.id);
    if (selectedEffects.has(candidate.effectId) || (definition?.kind === "curse" && selectedCurse)) continue;
    selected.push(candidate.id);
    selectedEffects.add(candidate.effectId);
    if (definition?.kind === "curse") selectedCurse = true;
    if (candidate.effectId === "heal_and_end_card_play") break;
  }
  return selected;
}
