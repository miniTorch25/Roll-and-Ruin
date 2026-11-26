import { CARD_CATALOGUE, type CardEffectId } from "../cards/catalogue";
import type { GamePlayer, GameState, PlayerAction } from "./turnEngine";

export interface BotCardTargets {
  targetPlayerId?: string;
  targetMonsterId?: string;
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

export function chooseBotCardTargets(state: GameState, cardId: string): BotCardTargets {
  const card = CARD_CATALOGUE.find(candidate => candidate.id === cardId);
  const active = state.players[state.activePlayerIndex];
  if (!card || !active) return {};

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
export function chooseBotCards(state: GameState): string[] {
  const player = state.players[state.activePlayerIndex];
  if (!player || player.status !== "alive") return [];
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
    if (!card || card.kind === "curse" || card.kind === "summon" || card.kind === "joker") continue;
    if (card.kind === "attack" && runtime?.blockedAttackCardsThisTurn) continue;

    let priority = 0;
    const amount = Number(card.parameters?.amount ?? 0);
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
      case "damage_single":
      case "damage_single_pierce_shield":
      case "damage_and_remove_shields":
      case "damage_with_random_splash":
      case "damage_with_self_hp_cost":
      case "conditional_damage":
      case "view_player_hand":
      case "steal_random_card":
      case "skip_next_turn":
      case "limit_next_turn_dice": {
        const target = chooseBotCardTargets(state, id);
        const opponent = state.players.find(candidate => candidate.id === target.targetPlayerId);
        const healthyEnough = card.effectId !== "damage_with_self_hp_cost" ||
          player.hp > Number(card.parameters?.selfHpCost ?? 2) + 1;
        if (opponent && healthyEnough) {
          priority = card.effectId === "steal_random_card" ? (opponent.hand.length ? 67 : 0)
            : card.effectId === "skip_next_turn" ? 58
            : card.effectId === "damage_and_remove_shields" && getPlayerShields(state, opponent.id) > 0 ? 62
            : card.kind === "attack" ? 48 : 42;
        }
        break;
      }
      case "damage_monster_only":
        if (chooseBotCardTargets(state, id).targetMonsterId) priority = 57;
        break;
      default:
        break;
    }
    if (priority > 0) candidates.push({ id, effectId: card.effectId, priority });
  }

  candidates.sort((a, b) => b.priority - a.priority);
  const selected: string[] = [];
  const selectedEffects = new Set<CardEffectId>();
  for (const candidate of candidates) {
    if (selected.length >= Math.min(2, remainingPlays)) break;
    if (selectedEffects.has(candidate.effectId)) continue;
    selected.push(candidate.id);
    selectedEffects.add(candidate.effectId);
    if (candidate.effectId === "heal_and_end_card_play") break;
  }
  return selected;
}
