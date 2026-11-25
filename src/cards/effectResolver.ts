import { getCardDefinition, type CardDefinition, type CardEffectId } from "./catalogue";
import { getActivePlayer, MAX_CARDS_PER_TURN, type GameState } from "../game/turnEngine";

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
  /** Required only by effects that name a single teammate or player target. */
  targetPlayerId?: string;
  /** Injectable random source for deterministic tests and future random effects. */
  random?: () => number;
}

export interface ResolveCardEffectResult {
  state: CardEffectGameState;
  card: CardDefinition;
  appliedToPlayerIds: string[];
  endsCardPlay: boolean;
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

const IMPLEMENTED_EFFECTS = new Set<CardEffectId>([
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
 * Resolves the first deterministic player-state effects from the authoritative catalogue.
 * Targeted, monster, dice, movement, and curse-cost effects are deliberately deferred until
 * their corresponding game systems and player-choice inputs are available.
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

  let state = withRuntime(inputState);
  const active = getActivePlayer(state);
  const appliedToPlayerIds: string[] = [active.id];
  let endsCardPlay = false;
  const amount = Number(card.parameters?.amount ?? 0);

  switch (card.effectId) {
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

  return { state, card, appliedToPlayerIds, endsCardPlay };
}
