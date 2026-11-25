import { applyPlayerDeath, getActivePlayer, imprisonPlayer, resurrectPlayer, MAX_CARDS_PER_TURN, type DeathResult, type GameState, type PlayerStatusEffect, type PlayerStatusEffectType, type MonsterAttackEvent } from "../game/turnEngine";
import { getCardDefinition, type CardDefinition, type CardEffectId } from "./catalogue";
import { drawCards, type CardDeckState } from "./deck";
import { damageMonster, summonRandomMonster, type MonsterDamageEvent } from "../monsters/engine";
import type { MonsterRank } from "../monsters/catalogue";

export interface CardRuntimePlayerState {
  shields: number;
  invulnerableOwnerTurns: number;
  reflectionCharges: number;
  attackDamageBonus: number;
  defenseShieldBonus: number;
  nextAttackDamageBonus: number;
  blockedAttackCardsThisTurn: boolean;
  negativeStatuses: string[];
  curseCooldownTurnsRemaining: number;
  curseCooldownUses: number;
  curseCooldownFresh: boolean;
  bonusDiceThisTurn: number;
  luckyDiceUsedThisTurn: boolean;
  rerollsRemaining: number;
  rerollCardUsedThisTurn: boolean;
  controlledDiceValues: number[];
  diceControlUsedThisTurn: boolean;
}

export interface CardRuntimeState {
  players: Record<string, CardRuntimePlayerState>;
}

export type CardEffectGameState = GameState & { cardRuntime: CardRuntimeState };

export type CursePayment =
  | { type: "hp"; amount: number }
  | { type: "discard"; cardIds: [string, string] }
  | { type: "cooldown" };

export interface ResolveCardEffectOptions {
  /** Required by effects that name one player or teammate. */
  targetPlayerId?: string;
  /** Required by Monster Hunter. */
  targetMonsterId?: string;
  /** Card id selected by the player who must give or discard a card. */
  selectedCardId?: string;
  /** Current deck state for effects that draw cards. */
  deck?: CardDeckState;
  /** Required payment choice when playing a Curse card. */
  cursePayment?: CursePayment;
  /** Selected values for Control Dice; one value for each die that will be rolled. */
  diceValues?: number[];
  /** Injectable random source, including random card-loss when a player dies. */
  random?: () => number;
}

export interface DamageEvent {
  kind: "attack" | "monster_attack" | "hp_cost" | "direct_hp_loss" | "reflection";
  sourcePlayerId?: string;
  sourceMonsterId?: string;
  targetPlayerId: string;
  attemptedDamage: number;
  shieldAbsorbed: number;
  hpDamage: number;
  preventedBy?: "invulnerability";
  death?: DeathResult;
  reflection?: DamageEvent;
  monsterReflection?: MonsterDamageEvent;
}

export interface CardDrawEvent {
  playerId: string;
  drawnCardIds: string[];
}

export interface ResolveCardEffectResult {
  state: CardEffectGameState;
  card: CardDefinition;
  appliedToPlayerIds: string[];
  endsCardPlay: boolean;
  damageEvents: DamageEvent[];
  monsterDamageEvents: MonsterDamageEvent[];
  monsterSummonEvents: MonsterAttackEvent[];
  revealedHands: Array<{ playerId: string; cardIds: string[] }>;
  discardedCardIds: string[];
  drawEvents: CardDrawEvent[];
  deck?: CardDeckState;
  cursePayment?: CursePayment;
}

const EMPTY_PLAYER_RUNTIME = (): CardRuntimePlayerState => ({
  shields: 0,
  invulnerableOwnerTurns: 0,
  reflectionCharges: 0,
  attackDamageBonus: 0,
  defenseShieldBonus: 0,
  nextAttackDamageBonus: 0,
  blockedAttackCardsThisTurn: false,
  negativeStatuses: [],
  curseCooldownTurnsRemaining: 0,
  curseCooldownUses: 0,
  curseCooldownFresh: false,
  bonusDiceThisTurn: 0,
  luckyDiceUsedThisTurn: false,
  rerollsRemaining: 0,
  rerollCardUsedThisTurn: false,
  controlledDiceValues: [],
  diceControlUsedThisTurn: false
});

function withRuntime(state: GameState): CardEffectGameState {
  const existing = (state as Partial<CardEffectGameState>).cardRuntime;
  const players: Record<string, CardRuntimePlayerState> = {};
  for (const player of state.players) {
    const current = existing?.players[player.id];
    players[player.id] = current
      ? { ...EMPTY_PLAYER_RUNTIME(), ...current, negativeStatuses: [...(current.negativeStatuses ?? [])] }
      : EMPTY_PLAYER_RUNTIME();
  }
  return { ...state, cardRuntime: { players } };
}

function updatePlayerRuntime(
  state: CardEffectGameState,
  playerId: string,
  update: (current: CardRuntimePlayerState) => CardRuntimePlayerState
): CardEffectGameState {
  const current = state.cardRuntime.players[playerId];
  if (!current) throw new Error(`No card runtime state for player ${playerId}.`);
  return {
    ...state,
    cardRuntime: {
      ...state.cardRuntime,
      players: {
        ...state.cardRuntime.players,
        [playerId]: update(current)
      }
    }
  };
}

function addShield(
  state: CardEffectGameState,
  playerId: string,
  amount: number,
  applyDefenseBonus = false
): CardEffectGameState {
  const bonus = applyDefenseBonus
    ? state.cardRuntime.players[playerId].defenseShieldBonus
    : 0;
  return updatePlayerRuntime(state, playerId, (current) => ({
    ...current,
    shields: Math.min(3, current.shields + amount + bonus)
  }));
}

function applyTimedStatus(
  state: CardEffectGameState,
  playerId: string,
  status: PlayerStatusEffect
): CardEffectGameState {
  const player = requireLivingPlayer(state, playerId);
  const remaining = player.statusEffects.filter((effect) => effect.type !== status.type);
  remaining.push({ ...status });
  return {
    ...state,
    players: state.players.map((item) => item.id === playerId
      ? { ...item, statusEffects: remaining }
      : item)
  };
}

function createTimedStatus(
  type: PlayerStatusEffectType,
  turnsRemaining: number,
  amount?: number,
  minimum?: number
): PlayerStatusEffect {
  return { type, turnsRemaining, ...(amount === undefined ? {} : { amount }), ...(minimum === undefined ? {} : { minimum }) };
}

function requireLivingPlayer(state: CardEffectGameState, playerId: string) {
  const player = state.players.find((item) => item.id === playerId);
  if (!player || player.status !== "alive") {
    throw new Error(`Target player ${playerId} is not alive.`);
  }
  return player;
}

function requireOpponentTarget(state: CardEffectGameState, attackerId: string, targetId?: string) {
  if (!targetId) throw new Error("This card effect requires targetPlayerId.");
  if (targetId === attackerId) throw new Error("An attack card must target another player.");
  return requireLivingPlayer(state, targetId);
}

function requireEliminatedTarget(state: CardEffectGameState, activePlayerId: string, targetId?: string) {
  if (!targetId) throw new Error("This card effect requires targetPlayerId.");
  if (targetId === activePlayerId) throw new Error("The active player cannot be the eliminated target.");
  const target = state.players.find((player) => player.id === targetId);
  if (!target || target.status !== "eliminated") {
    throw new Error("This card requires a player who has been eliminated.");
  }
  return target;
}

interface DamageOptions {
  kind?: DamageEvent["kind"];
  sourcePlayerId?: string;
  sourceMonsterId?: string;
  pierceShield?: boolean;
  ignoreShield?: boolean;
  ignoreInvulnerability?: boolean;
  allowReflection?: boolean;
}

function applyDamage(
  inputState: CardEffectGameState,
  targetPlayerId: string,
  amount: number,
  random: () => number,
  options: DamageOptions = {}
): { state: CardEffectGameState; event: DamageEvent } {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error("Damage must be a non-negative integer.");
  }
  const target = requireLivingPlayer(inputState, targetPlayerId);
  let state = inputState;
  const event: DamageEvent = {
    kind: options.kind ?? "attack",
    sourcePlayerId: options.sourcePlayerId,
    sourceMonsterId: options.sourceMonsterId,
    targetPlayerId,
    attemptedDamage: amount,
    shieldAbsorbed: 0,
    hpDamage: 0
  };
  if (amount === 0) return { state, event };

  const targetRuntime = state.cardRuntime.players[targetPlayerId];
  if (!options.ignoreInvulnerability && targetRuntime.invulnerableOwnerTurns > 0) {
    event.preventedBy = "invulnerability";
    return { state, event };
  }

  if (!options.pierceShield && !options.ignoreShield) {
    event.shieldAbsorbed = Math.min(targetRuntime.shields, amount);
    if (event.shieldAbsorbed > 0) {
      state = updatePlayerRuntime(state, targetPlayerId, (current) => ({
        ...current,
        shields: current.shields - event.shieldAbsorbed
      }));
    }
  }

  const remainingDamage = amount - event.shieldAbsorbed;
  event.hpDamage = Math.min(target.hp, remainingDamage);
  if (event.hpDamage > 0) {
    state = {
      ...state,
      players: state.players.map((player) => player.id === targetPlayerId
        ? { ...player, hp: Math.max(0, player.hp - event.hpDamage) }
        : player)
    };
    const died = target.hp - event.hpDamage <= 0;
    if (died) {
      const death = applyPlayerDeath(state, targetPlayerId, random);
      state = death.state as CardEffectGameState;
      event.death = death.result;
    }
  }

  if (
    event.hpDamage > 0 &&
    options.allowReflection !== false &&
    options.sourcePlayerId &&
    options.sourcePlayerId !== targetPlayerId &&
    state.players.some((player) => player.id === options.sourcePlayerId && player.status === "alive") &&
    state.cardRuntime.players[targetPlayerId].reflectionCharges > 0
  ) {
    state = updatePlayerRuntime(state, targetPlayerId, (current) => ({
      ...current,
      reflectionCharges: current.reflectionCharges - 1
    }));
    const reflected = applyDamage(
      state,
      options.sourcePlayerId,
      event.hpDamage,
      random,
      {
        kind: "reflection",
        sourcePlayerId: targetPlayerId,
        allowReflection: false
      }
    );
    state = reflected.state;
    event.reflection = reflected.event;
  }

  if (
    event.hpDamage > 0 &&
    options.sourceMonsterId &&
    state.cardRuntime.players[targetPlayerId].reflectionCharges > 0
  ) {
    state = updatePlayerRuntime(state, targetPlayerId, (current) => ({
      ...current,
      reflectionCharges: current.reflectionCharges - 1
    }));
    const reflected = damageMonster(state, options.sourceMonsterId, event.hpDamage, targetPlayerId);
    state = reflected.state as CardEffectGameState;
    event.monsterReflection = reflected.event;
  }

  return { state, event };
}

export interface MonsterAttackResolution {
  state: CardEffectGameState;
  damageEvents: DamageEvent[];
}

/** Applies the attack events emitted by summonMonster or resolveMonsterAttackPhase. */
export function resolveMonsterAttackEvents(
  inputState: GameState,
  attacks: MonsterAttackEvent[],
  random: () => number = Math.random
): MonsterAttackResolution {
  let state = withRuntime(inputState);
  const damageEvents: DamageEvent[] = [];

  for (const attack of attacks) {
    const monster = state.monsters.find((item) => item.id === attack.monsterId && item.active);
    if (!monster) continue;
    if (monster.attackDamage === undefined) {
      throw new Error(`Monster ${monster.id} has no catalogue attack damage.`);
    }
    const pierceShield = monster.rules?.some((rule) => rule.includes("ทะลุเกราะ")) ?? false;
    const wolfPackBonus = monster.catalogueId === "C06" &&
      state.monsters.filter((item) => item.active && item.catalogueId === "C06").length > 1
      ? 1
      : 0;
    const attackDamage = monster.attackDamage + wolfPackBonus;

    for (const targetPlayerId of attack.targetPlayerIds) {
      const target = state.players.find((player) => player.id === targetPlayerId);
      if (!target || target.status !== "alive") continue;
      const hit = applyDamage(state, targetPlayerId, attackDamage, random, {
        kind: "monster_attack",
        sourceMonsterId: monster.id,
        pierceShield
      });
      state = hit.state;
      damageEvents.push(hit.event);

      if (monster.catalogueId === "C10" && attack.reason === "scheduled") {
        for (const targetPlayerId of attack.targetPlayerIds) {
          const target = state.players.find((player) => player.id === targetPlayerId && player.status === "alive");
          if (!target || target.hand.length === 0) continue;
          const index = Math.min(target.hand.length - 1, Math.max(0, Math.floor(random() * target.hand.length)));
          const [cardId] = target.hand.slice(index, index + 1);
          state = {
            ...state,
            players: state.players.map((player) => player.id === targetPlayerId
              ? { ...player, hand: player.hand.filter((_, cardIndex) => cardIndex !== index) }
              : player),
            monsters: state.monsters.map((item) => item.id === monster.id
              ? { ...item, stolenCards: [...(item.stolenCards ?? []), { ownerPlayerId: targetPlayerId, cardId }] }
              : item)
          };
        }
      }

      if (!hit.event.preventedBy && !hit.event.death && hit.event.attemptedDamage > 0) {
        if (monster.catalogueId === "R03" && Math.floor(random() * 6) + 1 <= 2 &&
          state.players.some((player) => player.id === targetPlayerId && player.status === "alive")) {
          const blast = applyDamage(state, targetPlayerId, 2, random, {
            kind: "monster_attack",
            sourceMonsterId: monster.id,
            pierceShield
          });
          state = blast.state;
          damageEvents.push(blast.event);
        }

        if (monster.catalogueId === "R08") {
          const harpyTarget = state.players.find((player) => player.id === targetPlayerId && player.status === "alive");
          if (harpyTarget && harpyTarget.hand.length > 0) {
            const discardedIndex = Math.min(harpyTarget.hand.length - 1, Math.max(0, Math.floor(random() * harpyTarget.hand.length)));
            state = {
              ...state,
              players: state.players.map((player) => player.id === targetPlayerId
                ? { ...player, hand: player.hand.filter((_, index) => index !== discardedIndex) }
                : player)
            };
          }
        }

        const status = monster.catalogueId === "R01"
          ? { type: "movement_reduction" as const, turnsRemaining: 1, amount: 1 }
          : monster.catalogueId === "R07"
          ? { type: "poison" as const, turnsRemaining: 3, amount: 1 }
          : monster.catalogueId === "R04"
            ? { type: "dice_limit" as const, turnsRemaining: 1, amount: 1 }
            : monster.catalogueId === "R10"
              ? { type: "cards_limit" as const, turnsRemaining: 1, amount: 2 }
              : undefined;
        if (status && state.players.some((player) => player.id === targetPlayerId && player.status === "alive")) {
          state = {
            ...state,
            players: state.players.map((player) => player.id === targetPlayerId
              ? {
                  ...player,
                  statusEffects: [
                    ...player.statusEffects.filter((effect) => effect.type !== status.type),
                    status
                  ]
                }
              : player)
          };
        }
      }
    }

    const selfHeal = monster.catalogueId === "R05" ? 2 : monster.catalogueId === "C03" ? 1 : 0;
    if (selfHeal > 0) {
      state = {
        ...state,
        monsters: state.monsters.map((item) => item.id === monster.id && item.active &&
          typeof item.hp === "number" && typeof item.maxHp === "number"
          ? { ...item, hp: Math.min(item.maxHp, item.hp + selfHeal) }
          : item)
      };
    }
  }

  return { state, damageEvents };
}

function applyHpCost(
  inputState: CardEffectGameState,
  playerId: string,
  amount: number,
  random: () => number,
  kind: "hp_cost" | "direct_hp_loss" = "hp_cost"
): { state: CardEffectGameState; event: DamageEvent } {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error("HP cost must be a non-negative integer.");
  }
  const player = requireLivingPlayer(inputState, playerId);
  const hpLoss = Math.min(player.hp, amount);
  let state: CardEffectGameState = {
    ...inputState,
    players: inputState.players.map((item) => item.id === playerId
      ? { ...item, hp: Math.max(0, item.hp - amount) }
      : item)
  };
  const event: DamageEvent = {
    kind,
    sourcePlayerId: playerId,
    targetPlayerId: playerId,
    attemptedDamage: amount,
    shieldAbsorbed: 0,
    hpDamage: hpLoss
  };
  if (player.hp - amount <= 0) {
    const death = applyPlayerDeath(state, playerId, random);
    state = death.state as CardEffectGameState;
    event.death = death.result;
  }
  return { state, event };
}

function takeAttackBonus(state: CardEffectGameState, playerId: string): {
  state: CardEffectGameState;
  bonus: number;
} {
  const runtime = state.cardRuntime.players[playerId];
  const activePlayer = state.players.find((player) => player.id === playerId);
  const weakness = activePlayer?.statusEffects
    .filter((effect) => effect.type === "attack_damage_reduction" && effect.turnsRemaining > 0)
    .reduce((maximum, effect) => Math.max(maximum, effect.amount ?? 0), 0) ?? 0;
  const bonus = runtime.attackDamageBonus + runtime.nextAttackDamageBonus - weakness;
  if (runtime.nextAttackDamageBonus === 0) return { state, bonus };
  return {
    state: updatePlayerRuntime(state, playerId, (current) => ({
      ...current,
      nextAttackDamageBonus: 0
    })),
    bonus
  };
}

const IMPLEMENTED_EFFECTS = new Set<CardEffectId>([
  "damage_with_random_splash",
  "damage_monster_only",
  "summon_random_monster",
  "damage_single",
  "damage_single_pierce_shield",
  "damage_and_remove_shields",
  "damage_all_except_self",
  "damage_with_self_hp_cost",
  "conditional_damage",
  "view_player_hand",
  "steal_random_card",
  "swap_positions",
  "trade_for_random_card",
  "force_discard_selected_card",
  "draw_cards",
  "draw_and_distribute_cards",
  "resurrection",
  "gain_bonus_die",
  "reroll_one_die",
  "control_dice_values",
  "skip_next_turn",
  "limit_next_turn_dice",
  "weaken_attack_damage",
  "silence_card_use",
  "prevent_movement",
  "reverse_movement_direction",
  "reduce_dice_values",
  "reveal_player_hand",
  "discard_random_half_hand",
  "mark_monster_attack_target",
  "remove_buffs_and_shields",
  "steal_eliminated_player_cards",
  "instant_kill",
  "force_prison",
  "reset_other_players_positions",
  "drain_hp_and_heal",
  "halve_current_hp",
  "remove_other_players_shields",
  "swap_current_hp",
  "heal",
  "increase_max_hp",
  "gain_heart",
  "gain_shield",
  "gain_team_shield",
  "gain_shield_and_block_attack_cards",
  "heal_and_end_card_play",
  "team_heal",
  "cleanse_negative_statuses",
  "boost_next_attack_and_shield",
  "grant_invulnerability",
  "reflect_next_damage",
  "boost_attack_damage",
  "boost_defense_shield"
]);

export function isCardEffectImplemented(effectId: CardEffectId): boolean {
  return IMPLEMENTED_EFFECTS.has(effectId);
}

/**
 * Resolves supported player-vs-player attacks and deterministic player-state effects.
 * Monster, deck-manipulation, movement/dice, and curse-cost effects remain explicit TODOs.
 */
export function resolveCardEffect(
  inputState: GameState,
  cardOrId: CardDefinition | string,
  options: ResolveCardEffectOptions = {}
): ResolveCardEffectResult {
  const card = typeof cardOrId === "string" ? getCardDefinition(cardOrId) : cardOrId;
  if (!card) throw new Error(`Unknown card ID: ${String(cardOrId)}`);
  if (!isCardEffectImplemented(card.effectId)) {
    throw new Error(`Card effect ${card.effectId} is not implemented yet.`);
  }

  const random = options.random ?? Math.random;
  let state = withRuntime(inputState);
  const active = getActivePlayer(state);
  const appliedToPlayerIds: string[] = [active.id];
  const damageEvents: DamageEvent[] = [];
  const monsterDamageEvents: MonsterDamageEvent[] = [];
  const monsterSummonEvents: MonsterAttackEvent[] = [];
  const revealedHands: Array<{ playerId: string; cardIds: string[] }> = [];
  const discardedCardIds: string[] = [];
  const drawEvents: CardDrawEvent[] = [];
  let updatedDeck: CardDeckState | undefined = options.deck
    ? { drawPile: [...options.deck.drawPile], discardPile: [...options.deck.discardPile] }
    : undefined;
  let endsCardPlay = false;
  const amount = Number(card.parameters?.amount ?? 0);


  if (card.kind === "curse") {
    const payment = options.cursePayment;
    if (!payment) throw new Error("A Curse card requires an explicit cursePayment.");
    if (!card.curseCostOptions?.length) throw new Error("This Curse card has no configured payment options.");

    if (payment.type === "hp") {
      if (!card.curseCostOptions.includes("pay_hp_5_to_10")) {
        throw new Error("This Curse card does not allow HP payment.");
      }
      if (!Number.isInteger(payment.amount) || payment.amount < 5 || payment.amount > 10) {
        throw new Error("Curse HP payment must be an integer from 5 to 10.");
      }
      if (active.hp < payment.amount) {
        throw new Error("The active player does not have enough HP for this Curse payment.");
      }
      const paid = applyHpCost(state, active.id, payment.amount, random);
      state = paid.state;
      damageEvents.push(paid.event);
    } else if (payment.type === "discard") {
      if (!card.curseCostOptions.includes("discard_2_cards")) {
        throw new Error("This Curse card does not allow card-discard payment.");
      }
      const uniqueCards = new Set(payment.cardIds);
      if (uniqueCards.size !== 2 || payment.cardIds.some((cardId) => !active.hand.includes(cardId))) {
        throw new Error("Curse discard payment requires two different cards from the active player's hand.");
      }
      state = {
        ...state,
        players: state.players.map((player) => {
          if (player.id !== active.id) return player;
          const hand = [...player.hand];
          for (const cardId of payment.cardIds) hand.splice(hand.indexOf(cardId), 1);
          return { ...player, hand };
        })
      };
      discardedCardIds.push(...payment.cardIds);
    } else {
      if (!card.curseCostOptions.includes("curse_cooldown_3_turns")) {
        throw new Error("This Curse card does not allow cooldown payment.");
      }
      const runtime = state.cardRuntime.players[active.id];
      if (runtime.curseCooldownUses >= 3) {
        throw new Error("The active player has already used the Curse cooldown three times this game.");
      }
      if (runtime.curseCooldownTurnsRemaining > 0) {
        throw new Error("The active player's Curse cooldown is still active.");
      }
      if (active.hp >= 5 && active.hand.length >= 2) {
        throw new Error("Curse cooldown is available only when HP or hand cards are insufficient.");
      }
      state = updatePlayerRuntime(state, active.id, (current) => ({
        ...current,
        curseCooldownTurnsRemaining: 3,
        curseCooldownUses: current.curseCooldownUses + 1,
        curseCooldownFresh: true
      }));
    }
  }

  switch (card.effectId) {
    case "damage_monster_only": {
      if (!options.targetMonsterId) {
        throw new Error("Monster Hunter requires targetMonsterId.");
      }
      const attack = takeAttackBonus(state, active.id);
      state = attack.state;
      const targetMonster = state.monsters.find((monster) => monster.id === options.targetMonsterId && monster.active);
      if (!targetMonster) throw new Error(`Active monster ${options.targetMonsterId} was not found.`);
      const rockyReduction = targetMonster.catalogueId === "C09" ? 1 : 0;
      const hit = damageMonster(
        state,
        options.targetMonsterId,
        Math.max(1, Number(card.parameters?.damage ?? 5) + attack.bonus - rockyReduction),
        active.id
      );
      state = hit.state as CardEffectGameState;
      if (hit.event.defeated && targetMonster.catalogueId === "C05") hit.event.rewardSuppressed = true;
      monsterDamageEvents.push(hit.event);
      if (hit.event.defeated && targetMonster.catalogueId === "C07") {
        const hazard = applyHpCost(state, active.id, 1, random, "direct_hp_loss");
        state = hazard.state;
        damageEvents.push(hazard.event);
      }
      break;
    }
    case "damage_with_random_splash": {
      const target = requireOpponentTarget(state, active.id, options.targetPlayerId);
      const attack = takeAttackBonus(state, active.id);
      state = attack.state;
      const primary = applyDamage(
        state,
        target.id,
        Math.max(1, Number(card.parameters?.targetDamage ?? 3) + attack.bonus),
        random,
        { sourcePlayerId: active.id }
      );
      state = primary.state;
      damageEvents.push(primary.event);
      appliedToPlayerIds.push(target.id);

      const splashTargets = [
        ...state.players
          .filter((player) => player.id !== target.id && player.status === "alive")
          .map((player) => ({ kind: "player" as const, id: player.id })),
        ...state.monsters
          .filter((monster) => monster.active)
          .map((monster) => ({ kind: "monster" as const, id: monster.id }))
      ];
      if (splashTargets.length > 0) {
        const index = Math.min(splashTargets.length - 1, Math.max(0, Math.floor(random() * splashTargets.length)));
        const splashTarget = splashTargets[index];
        const splashDamage = Math.max(1, Number(card.parameters?.splashDamage ?? 1) + attack.bonus);
        if (splashTarget.kind === "player") {
          const splash = applyDamage(state, splashTarget.id, splashDamage, random, { sourcePlayerId: active.id });
          state = splash.state;
          damageEvents.push(splash.event);
          appliedToPlayerIds.push(splashTarget.id);
        } else {
          const splashMonster = state.monsters.find((monster) => monster.id === splashTarget.id && monster.active);
          const rockyReduction = splashMonster?.catalogueId === "C09" ? 1 : 0;
          const splash = damageMonster(state, splashTarget.id, Math.max(1, splashDamage - rockyReduction), active.id);
          state = splash.state as CardEffectGameState;
          if (splash.event.defeated && splashMonster?.catalogueId === "C05") splash.event.rewardSuppressed = true;
          monsterDamageEvents.push(splash.event);
          if (splash.event.defeated && splashMonster?.catalogueId === "C07") {
            const hazard = applyHpCost(state, active.id, 1, random, "direct_hp_loss");
            state = hazard.state;
            damageEvents.push(hazard.event);
          }
        }
      }
      break;
    }
    case "summon_random_monster": {
      const rank = card.parameters?.rank;
      const validRanks: MonsterRank[] = ["Common", "Rare", "Epic", "Legend", "Myth"];
      if (typeof rank !== "string" || !validRanks.includes(rank as MonsterRank)) {
        throw new Error("Summon card has an invalid monster rank in its catalogue parameters.");
      }
      const instanceId = `monster-${state.turnNumber}-${state.monsters.length + 1}-${card.id}`;
      const summoned = summonRandomMonster(state, rank as MonsterRank, instanceId, random);
      state = summoned.state as CardEffectGameState;
      monsterSummonEvents.push(summoned.attack);
      break;
    }
    case "damage_single":
    case "damage_single_pierce_shield":
    case "damage_and_remove_shields":
    case "damage_with_self_hp_cost":
    case "conditional_damage": {
      const target = requireOpponentTarget(state, active.id, options.targetPlayerId);
      const attack = takeAttackBonus(state, active.id);
      state = attack.state;
      let damage = Number(card.parameters?.damage ?? card.parameters?.targetDamage ?? card.parameters?.baseDamage ?? 0);
      if (card.effectId === "conditional_damage") {
        const conditionalDamage = Number(card.parameters?.conditionalDamage ?? damage);
        damage = target.hp < active.hp ? conditionalDamage : Number(card.parameters?.baseDamage ?? 0);
      }
      damage = Math.max(1, damage + attack.bonus);

      if (card.effectId === "damage_and_remove_shields") {
        state = updatePlayerRuntime(state, target.id, (current) => ({ ...current, shields: 0 }));
      }

      const hit = applyDamage(state, target.id, damage, random, {
        sourcePlayerId: active.id,
        pierceShield: card.effectId === "damage_single_pierce_shield"
      });
      state = hit.state;
      damageEvents.push(hit.event);
      appliedToPlayerIds.push(target.id);

      if (card.effectId === "damage_with_self_hp_cost") {
        const cost = applyHpCost(state, active.id, Number(card.parameters?.selfHpCost ?? 0), random);
        state = cost.state;
        damageEvents.push(cost.event);
      }
      break;
    }
    case "damage_all_except_self": {
      const attack = takeAttackBonus(state, active.id);
      state = attack.state;
      const damage = Math.max(1, Number(card.parameters?.damage ?? 0) + attack.bonus);
      const targets = state.players.filter((player) => player.id !== active.id && player.status === "alive");
      for (const target of targets) {
        const hit = applyDamage(state, target.id, damage, random, { sourcePlayerId: active.id });
        state = hit.state;
        damageEvents.push(hit.event);
        appliedToPlayerIds.push(target.id);
      }
      break;
    }
    case "skip_next_turn":
    case "limit_next_turn_dice":
    case "weaken_attack_damage":
    case "silence_card_use":
    case "prevent_movement":
    case "reverse_movement_direction":
    case "reduce_dice_values":
    case "reveal_player_hand": {
      const target = requireOpponentTarget(state, active.id, options.targetPlayerId);
      const rawDuration = card.parameters?.duration;
      const duration = typeof rawDuration === "number"
        ? rawDuration
        : rawDuration === "next_turn"
          ? 1
          : (card.effectId === "weaken_attack_damage" ? 3 : 1);
      const statusByEffect: Partial<Record<CardEffectId, PlayerStatusEffect>> = {
        skip_next_turn: createTimedStatus("skip_turn", duration),
        limit_next_turn_dice: createTimedStatus("dice_limit", duration, Number(card.parameters?.diceCount ?? 1)),
        weaken_attack_damage: createTimedStatus("attack_damage_reduction", duration, Number(card.parameters?.damageReduction ?? 2)),
        silence_card_use: createTimedStatus("cards_silenced", duration),
        prevent_movement: createTimedStatus("movement_blocked", duration),
        reverse_movement_direction: createTimedStatus("reverse_movement", duration),
        reduce_dice_values: createTimedStatus(
          "dice_reduction",
          duration,
          Number(card.parameters?.reduction ?? 2),
          Number(card.parameters?.minimum ?? 1)
        ),
        reveal_player_hand: createTimedStatus("reveal_hand", duration)
      };
      const status = statusByEffect[card.effectId];
      if (!status) throw new Error(`Missing timed status mapping for ${card.effectId}.`);
      state = applyTimedStatus(state, target.id, status);
      if (card.effectId === "reveal_player_hand") {
        revealedHands.push({ playerId: target.id, cardIds: [...target.hand] });
      }
      appliedToPlayerIds.push(target.id);
      break;
    }
    case "view_player_hand": {
      const target = requireOpponentTarget(state, active.id, options.targetPlayerId);
      revealedHands.push({ playerId: target.id, cardIds: [...target.hand] });
      appliedToPlayerIds.push(target.id);
      break;
    }
    case "steal_random_card": {
      const target = requireOpponentTarget(state, active.id, options.targetPlayerId);
      if (target.hand.length > 0) {
        const index = Math.min(target.hand.length - 1, Math.max(0, Math.floor(random() * target.hand.length)));
        const [stolenCardId] = target.hand.slice(index, index + 1);
        state = {
          ...state,
          players: state.players.map((player) => {
            if (player.id === target.id) {
              const hand = [...player.hand];
              hand.splice(index, 1);
              return { ...player, hand };
            }
            if (player.id === active.id) return { ...player, hand: [...player.hand, stolenCardId] };
            return player;
          })
        };
      }
      appliedToPlayerIds.push(target.id);
      break;
    }
    case "draw_cards": {
      if (!updatedDeck) throw new Error("This card effect requires the current deck state.");
      const drawn = drawCards(active.hand, updatedDeck, Number(card.parameters?.count ?? 0));
      updatedDeck = drawn.deck;
      state = {
        ...state,
        players: state.players.map((player) => player.id === active.id
          ? { ...player, hand: drawn.hand }
          : player)
      };
      drawEvents.push({ playerId: active.id, drawnCardIds: drawn.drawnCardIds });
      break;
    }
    case "draw_and_distribute_cards": {
      if (!updatedDeck) throw new Error("This card effect requires the current deck state.");
      const selfDraw = drawCards(
        active.hand,
        updatedDeck,
        Number(card.parameters?.selfDraw ?? 0)
      );
      updatedDeck = selfDraw.deck;
      state = {
        ...state,
        players: state.players.map((player) => player.id === active.id
          ? { ...player, hand: selfDraw.hand }
          : player)
      };
      drawEvents.push({ playerId: active.id, drawnCardIds: selfDraw.drawnCardIds });

      const recipients = state.players.filter((player) =>
        player.id !== active.id && player.status === "alive"
      );
      for (const recipient of recipients) {
        const currentRecipient = state.players.find((player) => player.id === recipient.id);
        if (!currentRecipient) continue;
        const sharedDraw = drawCards(
          currentRecipient.hand,
          updatedDeck,
          Number(card.parameters?.otherPlayersDraw ?? 0)
        );
        updatedDeck = sharedDraw.deck;
        state = {
          ...state,
          players: state.players.map((player) => player.id === recipient.id
            ? { ...player, hand: sharedDraw.hand }
            : player)
        };
        drawEvents.push({ playerId: recipient.id, drawnCardIds: sharedDraw.drawnCardIds });
        appliedToPlayerIds.push(recipient.id);
      }
      break;
    }
    case "swap_positions": {
      const target = requireOpponentTarget(state, active.id, options.targetPlayerId);
      state = {
        ...state,
        players: state.players.map((player) => {
          if (player.id === active.id) return { ...player, position: target.position };
          if (player.id === target.id) return { ...player, position: active.position };
          return player;
        })
      };
      appliedToPlayerIds.push(target.id);
      break;
    }
    case "trade_for_random_card": {
      const target = requireOpponentTarget(state, active.id, options.targetPlayerId);
      if (!options.selectedCardId || !active.hand.includes(options.selectedCardId)) {
        throw new Error("This trade requires selectedCardId from the active player's hand.");
      }
      if (target.hand.length === 0) {
        throw new Error("The selected player has no card to trade.");
      }
      const randomIndex = Math.min(target.hand.length - 1, Math.max(0, Math.floor(random() * target.hand.length)));
      const receivedCardId = target.hand[randomIndex];
      state = {
        ...state,
        players: state.players.map((player) => {
          if (player.id === active.id) {
            const hand = [...player.hand];
            const givenIndex = hand.indexOf(options.selectedCardId as string);
            hand.splice(givenIndex, 1);
            hand.push(receivedCardId);
            return { ...player, hand };
          }
          if (player.id === target.id) {
            const hand = [...player.hand];
            hand.splice(randomIndex, 1);
            hand.push(options.selectedCardId as string);
            return { ...player, hand };
          }
          return player;
        })
      };
      appliedToPlayerIds.push(target.id);
      break;
    }
    case "force_discard_selected_card": {
      const target = requireOpponentTarget(state, active.id, options.targetPlayerId);
      if (!options.selectedCardId || !target.hand.includes(options.selectedCardId)) {
        throw new Error("This discard effect requires selectedCardId from the target player's hand.");
      }
      state = {
        ...state,
        players: state.players.map((player) => {
          if (player.id !== target.id) return player;
          const hand = [...player.hand];
          hand.splice(hand.indexOf(options.selectedCardId as string), 1);
          return { ...player, hand };
        })
      };
      discardedCardIds.push(options.selectedCardId);
      appliedToPlayerIds.push(target.id);
      break;
    }
    case "discard_random_half_hand": {
      const target = requireOpponentTarget(state, active.id, options.targetPlayerId);
      const discardCount = Math.ceil(target.hand.length * Number(card.parameters?.fraction ?? 0.5));
      const remaining = [...target.hand];
      const discarded: string[] = [];
      for (let index = 0; index < discardCount; index++) {
        const randomIndex = Math.min(remaining.length - 1, Math.max(0, Math.floor(random() * remaining.length)));
        discarded.push(remaining.splice(randomIndex, 1)[0]);
      }
      state = {
        ...state,
        players: state.players.map((player) => player.id === target.id
          ? { ...player, hand: remaining }
          : player)
      };
      discardedCardIds.push(...discarded);
      appliedToPlayerIds.push(target.id);
      break;
    }
    case "steal_eliminated_player_cards": {
      const target = requireEliminatedTarget(state, active.id, options.targetPlayerId);
      const stolenCards = [...target.hand];
      state = {
        ...state,
        players: state.players.map((player) => {
          if (player.id === target.id) return { ...player, hand: [] };
          if (player.id === active.id) return { ...player, hand: [...player.hand, ...stolenCards] };
          return player;
        })
      };
      appliedToPlayerIds.push(target.id);
      break;
    }
    case "remove_buffs_and_shields": {
      const target = requireOpponentTarget(state, active.id, options.targetPlayerId);
      state = updatePlayerRuntime(state, target.id, (current) => ({
        ...current,
        shields: 0,
        invulnerableOwnerTurns: 0,
        reflectionCharges: 0,
        attackDamageBonus: 0,
        defenseShieldBonus: 0,
        nextAttackDamageBonus: 0
      }));
      appliedToPlayerIds.push(target.id);
      break;
    }
    case "mark_monster_attack_target": {
      const target = requireOpponentTarget(state, active.id, options.targetPlayerId);
      if (!state.monsters.some((monster) => monster.active)) {
        throw new Error("เหยื่อล่ requires at least one active monster on the board.");
      }
      state = {
        ...state,
        monsters: state.monsters.map((monster) => monster.active
          ? { ...monster, forcedTargetPlayerId: target.id }
          : monster)
      };
      appliedToPlayerIds.push(target.id);
      break;
    }
    case "instant_kill": {
      const target = requireOpponentTarget(state, active.id, options.targetPlayerId);
      const shields = state.cardRuntime.players[target.id].shields;
      const hit = applyDamage(state, target.id, target.hp + shields, random, {
        sourcePlayerId: active.id
      });
      state = hit.state;
      damageEvents.push(hit.event);
      appliedToPlayerIds.push(target.id);
      break;
    }
    case "force_prison": {
      const target = requireOpponentTarget(state, active.id, options.targetPlayerId);
      state = imprisonPlayer(state, target.id, 3) as CardEffectGameState;
      appliedToPlayerIds.push(target.id);
      break;
    }
    case "reset_other_players_positions": {
      const resetPosition = Number(card.parameters?.position ?? 0);
      state = {
        ...state,
        players: state.players.map((player) => player.id !== active.id && player.status === "alive"
          ? { ...player, position: resetPosition }
          : player)
      };
      appliedToPlayerIds.push(...state.players
        .filter((player) => player.id !== active.id && player.status === "alive")
        .map((player) => player.id));
      break;
    }
    case "drain_hp_and_heal": {
      const target = requireOpponentTarget(state, active.id, options.targetPlayerId);
      const hit = applyDamage(
        state,
        target.id,
        Number(card.parameters?.targetDamage ?? 4),
        random,
        { sourcePlayerId: active.id }
      );
      state = hit.state;
      damageEvents.push(hit.event);
      const healAmount = hit.event.hpDamage;
      const activeAfterHit = state.players.find((player) => player.id === active.id);
      if (activeAfterHit?.status === "alive" && healAmount > 0) {
        state = {
          ...state,
          players: state.players.map((player) => player.id === active.id
            ? { ...player, hp: Math.min(player.maxHp, player.hp + healAmount) }
            : player)
        };
      }
      appliedToPlayerIds.push(target.id);
      break;
    }
    case "halve_current_hp": {
      const target = requireOpponentTarget(state, active.id, options.targetPlayerId);
      const newHp = Math.floor(target.hp / 2);
      const hpLoss = target.hp - newHp;
      const loss = applyHpCost(state, target.id, hpLoss, random, "direct_hp_loss");
      state = loss.state;
      if (newHp === 0) {
        const death = loss.event.death;
        if (!death) throw new Error("A zero-HP target must enter the death flow.");
      }
      damageEvents.push(loss.event);
      appliedToPlayerIds.push(target.id);
      break;
    }
    case "remove_other_players_shields": {
      const targets = state.players.filter((player) => player.id !== active.id && player.status === "alive");
      for (const target of targets) {
        state = updatePlayerRuntime(state, target.id, (current) => ({
          ...current,
          shields: 0
        }));
        appliedToPlayerIds.push(target.id);
      }
      break;
    }
    case "swap_current_hp": {
      const target = requireOpponentTarget(state, active.id, options.targetPlayerId);
      const activeHp = state.players.find((player) => player.id === active.id)?.hp ?? active.hp;
      state = {
        ...state,
        players: state.players.map((player) => {
          if (player.id === active.id) return { ...player, hp: target.hp };
          if (player.id === target.id) return { ...player, hp: activeHp };
          return player;
        })
      };
      appliedToPlayerIds.push(target.id);
      break;
    }
    case "resurrection": {
      const targetId = options.targetPlayerId;
      if (!targetId) {
        throw new Error("Resurrection requires targetPlayerId for an eliminated player.");
      }
      if (targetId === active.id) {
        throw new Error("A living active player cannot target themselves with Resurrection; keep the card to self-revive automatically.");
      }
      state = resurrectPlayer(state, targetId) as CardEffectGameState;
      appliedToPlayerIds.push(targetId);
      break;
    }
    case "gain_bonus_die": {
      const runtime = state.cardRuntime.players[active.id];
      if (runtime.luckyDiceUsedThisTurn) {
        throw new Error("Lucky Dice can only be used once per turn.");
      }
      const bonusDice = Number(card.parameters?.dice ?? 1);
      state = updatePlayerRuntime(state, active.id, (current) => ({
        ...current,
        bonusDiceThisTurn: Math.min(2, current.bonusDiceThisTurn + bonusDice),
        luckyDiceUsedThisTurn: true
      }));
      break;
    }
    case "reroll_one_die": {
      const runtime = state.cardRuntime.players[active.id];
      if (runtime.rerollCardUsedThisTurn) {
        throw new Error("Only one reroll card may be used per turn.");
      }
      const rerolls = Number(card.parameters?.rerolls ?? 1);
      state = updatePlayerRuntime(state, active.id, (current) => ({
        ...current,
        rerollsRemaining: Math.max(current.rerollsRemaining, rerolls),
        rerollCardUsedThisTurn: true
      }));
      break;
    }
    case "control_dice_values": {
      const runtime = state.cardRuntime.players[active.id];
      if (runtime.diceControlUsedThisTurn) {
        throw new Error("Dice values can only be controlled once per turn.");
      }
      const maximumDice = Number(card.parameters?.maximumDice ?? 3);
      const diceValues = options.diceValues;
      if (
        !diceValues ||
        diceValues.length < 1 ||
        diceValues.length > maximumDice ||
        diceValues.some((value) => !Number.isInteger(value) || value < 1 || value > 6)
      ) {
        throw new Error(`Control Dice requires 1 to ${maximumDice} integer die value(s), each from 1 to 6.`);
      }
      const diceLimited = active.statusEffects.some((effect) =>
        effect.type === "dice_limit" && effect.turnsRemaining > 0
      );
      const expectedDice = diceLimited ? 1 : Math.min(3, 1 + runtime.bonusDiceThisTurn);
      if (diceValues.length !== expectedDice) {
        throw new Error(`Choose exactly ${expectedDice} value(s) for the dice rolled this turn.`);
      }
      state = updatePlayerRuntime(state, active.id, (current) => ({
        ...current,
        controlledDiceValues: [...diceValues],
        diceControlUsedThisTurn: true
      }));
      break;
    }
    case "heal": {
      state = {
        ...state,
        players: state.players.map((player) => player.id === active.id
          ? { ...player, hp: Math.min(player.maxHp, player.hp + amount) }
          : player)
      };
      break;
    }
    case "increase_max_hp": {
      state = {
        ...state,
        players: state.players.map((player) => player.id === active.id
          ? { ...player, maxHp: player.maxHp + amount }
          : player)
      };
      break;
    }
    case "gain_heart": {
      const maximum = Number(card.parameters?.maximum ?? 3);
      state = {
        ...state,
        players: state.players.map((player) => player.id === active.id
          ? { ...player, hearts: Math.min(maximum, player.hearts + amount) }
          : player)
      };
      break;
    }
    case "gain_shield": {
      state = addShield(state, active.id, amount, true);
      break;
    }
    case "gain_team_shield": {
      const teammate = state.players.find((player) =>
        player.id === options.targetPlayerId &&
        player.id !== active.id &&
        player.teamId === active.teamId &&
        player.status === "alive"
      );
      if (teammate) {
        state = addShield(state, active.id, Number(card.parameters?.selfShield ?? 1), true);
        state = addShield(state, teammate.id, Number(card.parameters?.teammateShield ?? 1), true);
        appliedToPlayerIds.push(teammate.id);
      } else {
        const hasLivingTeammate = state.players.some((player) =>
          player.id !== active.id && player.teamId === active.teamId && player.status === "alive"
        );
        if (hasLivingTeammate) {
          throw new Error("กำแพงคู่ requires targetPlayerId to select a living teammate.");
        }
        state = addShield(state, active.id, Number(card.parameters?.noTeammateSelfShield ?? 2), true);
      }
      break;
    }
    case "gain_shield_and_block_attack_cards": {
      state = addShield(state, active.id, Number(card.parameters?.shield ?? 3), true);
      state = updatePlayerRuntime(state, active.id, (current) => ({
        ...current,
        blockedAttackCardsThisTurn: true
      }));
      break;
    }
    case "heal_and_end_card_play": {
      state = {
        ...state,
        players: state.players.map((player) => player.id === active.id
          ? {
              ...player,
              hp: Math.min(player.maxHp, player.hp + amount),
              cardsPlayedThisTurn: MAX_CARDS_PER_TURN
            }
          : player)
      };
      endsCardPlay = true;
      break;
    }
    case "team_heal": {
      const teammate = state.players.find((player) =>
        player.id === options.targetPlayerId &&
        player.id !== active.id &&
        player.teamId === active.teamId &&
        player.status === "alive"
      );
      const hasLivingTeammate = state.players.some((player) =>
        player.id !== active.id && player.teamId === active.teamId && player.status === "alive"
      );
      if (hasLivingTeammate && !teammate) {
        throw new Error("สายใยทีม requires targetPlayerId to select a living teammate.");
      }
      const selfHeal = Number(card.parameters?.[teammate ? "selfHeal" : "noTeammateSelfHeal"] ?? 0);
      const teammateHeal = Number(card.parameters?.teammateHeal ?? 0);
      state = {
        ...state,
        players: state.players.map((player) => {
          if (player.id === active.id) return { ...player, hp: Math.min(player.maxHp, player.hp + selfHeal) };
          if (teammate && player.id === teammate.id) return { ...player, hp: Math.min(player.maxHp, player.hp + teammateHeal) };
          return player;
        })
      };
      if (teammate) appliedToPlayerIds.push(teammate.id);
      break;
    }
    case "cleanse_negative_statuses": {
      state = updatePlayerRuntime(state, active.id, (current) => ({
        ...current,
        negativeStatuses: []
      }));
      state = {
        ...state,
        players: state.players.map((player) => player.id === active.id
          ? { ...player, statusEffects: [] }
          : player)
      };
      break;
    }
    case "boost_next_attack_and_shield": {
      state = addShield(state, active.id, Number(card.parameters?.shieldNow ?? 1));
      state = updatePlayerRuntime(state, active.id, (current) => ({
        ...current,
        nextAttackDamageBonus: current.nextAttackDamageBonus + Number(card.parameters?.nextAttackDamage ?? 1)
      }));
      break;
    }
    case "grant_invulnerability": {
      state = updatePlayerRuntime(state, active.id, (current) => ({
        ...current,
        invulnerableOwnerTurns: Math.max(current.invulnerableOwnerTurns, Number(card.parameters?.duration ?? 0))
      }));
      break;
    }
    case "reflect_next_damage": {
      state = updatePlayerRuntime(state, active.id, (current) => ({
        ...current,
        reflectionCharges: current.reflectionCharges + Number(card.parameters?.hits ?? 1)
      }));
      break;
    }
    case "boost_attack_damage": {
      state = updatePlayerRuntime(state, active.id, (current) => ({
        ...current,
        attackDamageBonus: current.attackDamageBonus + amount
      }));
      break;
    }
    case "boost_defense_shield": {
      state = updatePlayerRuntime(state, active.id, (current) => ({
        ...current,
        defenseShieldBonus: current.defenseShieldBonus + amount
      }));
      break;
    }
    default: {
      throw new Error(`Unsupported card effect: ${card.effectId}`);
    }
  }

  return { state, card, appliedToPlayerIds, endsCardPlay, damageEvents, monsterDamageEvents, monsterSummonEvents, revealedHands, discardedCardIds, drawEvents, deck: updatedDeck, cursePayment: options.cursePayment };
}


/** Call once when this player's turn starts to advance their three-turn Curse cooldown. */
export function advanceCurseCooldown(inputState: GameState, playerId: string): CardEffectGameState {
  const state = withRuntime(inputState);
  requireLivingPlayer(state, playerId);
  return updatePlayerRuntime(state, playerId, (current) => ({
    ...current,
    curseCooldownTurnsRemaining: current.curseCooldownFresh
      ? current.curseCooldownTurnsRemaining
      : Math.max(0, current.curseCooldownTurnsRemaining - 1),
    curseCooldownFresh: false
  }));
}
