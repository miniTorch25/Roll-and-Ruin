import { applyPlayerDeath, getActivePlayer, MAX_CARDS_PER_TURN, type DeathResult, type GameState } from "../game/turnEngine";
import { getCardDefinition, type CardDefinition, type CardEffectId } from "./catalogue";

export interface CardRuntimePlayerState {
  shields: number;
  invulnerableOwnerTurns: number;
  reflectionCharges: number;
  attackDamageBonus: number;
  defenseShieldBonus: number;
  nextAttackDamageBonus: number;
  blockedAttackCardsThisTurn: boolean;
  negativeStatuses: string[];
}

export interface CardRuntimeState {
  players: Record<string, CardRuntimePlayerState>;
}

export type CardEffectGameState = GameState & { cardRuntime: CardRuntimeState };

export interface ResolveCardEffectOptions {
  /** Required by effects that name one player or teammate. */
  targetPlayerId?: string;
  /** Card id selected by the player who must give or discard a card. */
  selectedCardId?: string;
  /** Injectable random source, including random card-loss when a player dies. */
  random?: () => number;
}

export interface DamageEvent {
  kind: "attack" | "hp_cost" | "reflection";
  sourcePlayerId?: string;
  targetPlayerId: string;
  attemptedDamage: number;
  shieldAbsorbed: number;
  hpDamage: number;
  preventedBy?: "invulnerability";
  death?: DeathResult;
  reflection?: DamageEvent;
}

export interface ResolveCardEffectResult {
  state: CardEffectGameState;
  card: CardDefinition;
  appliedToPlayerIds: string[];
  endsCardPlay: boolean;
  damageEvents: DamageEvent[];
  revealedHands: Array<{ playerId: string; cardIds: string[] }>;
  discardedCardIds: string[];
}

const EMPTY_PLAYER_RUNTIME = (): CardRuntimePlayerState => ({
  shields: 0,
  invulnerableOwnerTurns: 0,
  reflectionCharges: 0,
  attackDamageBonus: 0,
  defenseShieldBonus: 0,
  nextAttackDamageBonus: 0,
  blockedAttackCardsThisTurn: false,
  negativeStatuses: []
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
  amount: number
): CardEffectGameState {
  return updatePlayerRuntime(state, playerId, (current) => ({
    ...current,
    shields: Math.min(3, current.shields + amount)
  }));
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

interface DamageOptions {
  kind?: DamageEvent["kind"];
  sourcePlayerId?: string;
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

  return { state, event };
}

function applyHpCost(
  inputState: CardEffectGameState,
  playerId: string,
  amount: number,
  random: () => number
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
    kind: "hp_cost",
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
  const bonus = runtime.attackDamageBonus + runtime.nextAttackDamageBonus;
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
  const revealedHands: Array<{ playerId: string; cardIds: string[] }> = [];
  const discardedCardIds: string[] = [];
  let endsCardPlay = false;
  const amount = Number(card.parameters?.amount ?? 0);

  switch (card.effectId) {
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
      state = addShield(state, active.id, amount);
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
        state = addShield(state, active.id, Number(card.parameters?.selfShield ?? 1));
        state = addShield(state, teammate.id, Number(card.parameters?.teammateShield ?? 1));
        appliedToPlayerIds.push(teammate.id);
      } else {
        const hasLivingTeammate = state.players.some((player) =>
          player.id !== active.id && player.teamId === active.teamId && player.status === "alive"
        );
        if (hasLivingTeammate) {
          throw new Error("กำแพงคู่ requires targetPlayerId to select a living teammate.");
        }
        state = addShield(state, active.id, Number(card.parameters?.noTeammateSelfShield ?? 2));
      }
      break;
    }
    case "gain_shield_and_block_attack_cards": {
      state = addShield(state, active.id, Number(card.parameters?.shield ?? 3));
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

  return { state, card, appliedToPlayerIds, endsCardPlay, damageEvents, revealedHands, discardedCardIds };
}
