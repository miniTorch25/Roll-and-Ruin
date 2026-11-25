import { applyPlayerDeath, getActivePlayer, imprisonPlayer, MAX_CARDS_PER_TURN, type DeathResult, type GameState } from "../game/turnEngine";
import { getCardDefinition, type CardDefinition, type CardEffectId } from "./catalogue";
import { drawCards, type CardDeckState } from "./deck";

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
  /** Card id selected by the player who must give or discard a card. */
  selectedCardId?: string;
  /** Current deck state for effects that draw cards. */
  deck?: CardDeckState;
  /** Required payment choice when playing a Curse card. */
  cursePayment?: CursePayment;
  /** Injectable random source, including random card-loss when a player dies. */
  random?: () => number;
}

export interface DamageEvent {
  kind: "attack" | "hp_cost" | "direct_hp_loss" | "reflection";
  sourcePlayerId?: string;
  targetPlayerId: string;
  attemptedDamage: number;
  shieldAbsorbed: number;
  hpDamage: number;
  preventedBy?: "invulnerability";
  death?: DeathResult;
  reflection?: DamageEvent;
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
  curseCooldownUses: 0
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
  "draw_cards",
  "draw_and_distribute_cards",
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
        curseCooldownUses: current.curseCooldownUses + 1
      }));
    }
  }

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

  return { state, card, appliedToPlayerIds, endsCardPlay, damageEvents, revealedHands, discardedCardIds, drawEvents, deck: updatedDeck, cursePayment: options.cursePayment };
}


/** Call once when this player's turn starts to advance their three-turn Curse cooldown. */
export function advanceCurseCooldown(inputState: GameState, playerId: string): CardEffectGameState {
  const state = withRuntime(inputState);
  requireLivingPlayer(state, playerId);
  return updatePlayerRuntime(state, playerId, (current) => ({
    ...current,
    curseCooldownTurnsRemaining: Math.max(0, current.curseCooldownTurnsRemaining - 1)
  }));
}
