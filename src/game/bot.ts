import { CARD_CATALOGUE, type CardEffectId } from "../cards/catalogue";
import type { GamePlayer, GameState, PlayerAction } from "./turnEngine";

/** Baseline policy: refill a small hand, otherwise prioritize movement. */
export function chooseBotAction(player: Pick<GamePlayer, "hand">): Exclude<PlayerAction, "use_cards"> {
  if (player.hand.length < 3) return "draw_two_roll_one";
  return "roll_two_dice";
}

const NEGATIVE_STATUSES = new Set([
  "skip_turn", "dice_limit", "dice_reduction", "cards_silenced",
  "movement_blocked", "reverse_movement", "attack_damage_reduction",
  "cards_limit", "movement_reduction", "poison"
]);

/**
 * Select only self-contained support cards. Targeted effects, curses, summons,
 * and cooperative offerings are skipped until their decisions can be automated.
 */
export function chooseBotCards(state: GameState): string[] {
  const player = state.players[state.activePlayerIndex];
  if (!player || player.status !== "alive") return [];
  if (player.statusEffects.some(effect => effect.type === "cards_silenced" && effect.turnsRemaining > 0)) return [];

  const cardLimit = player.statusEffects
    .filter(effect => effect.type === "cards_limit" && effect.turnsRemaining > 0)
    .reduce((limit, effect) => Math.min(limit, effect.amount ?? 2), 3);
  const remainingPlays = Math.max(0, cardLimit - player.cardsPlayedThisTurn);
  if (remainingPlays === 0) return [];

  const runtime = state.cardRuntime?.players[player.id];
  const activeMonsters = state.monsters.filter(monster => monster.active);
  const hasIncomingThreat = activeMonsters.some(monster => (monster.attackDamage ?? 0) > 0);
  const hasNegativeStatus = player.statusEffects.some(effect =>
    effect.turnsRemaining > 0 && NEGATIVE_STATUSES.has(effect.type)
  );
  const handDefinitions = player.hand.map(id => CARD_CATALOGUE.find(card => card.id === id));

  const candidates: Array<{ id: string; effectId: CardEffectId; priority: number }> = [];
  for (const card of handDefinitions) {
    if (!card) continue;
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
      default:
        break;
    }
    if (priority > 0) candidates.push({ id: card.id, effectId: card.effectId, priority });
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
