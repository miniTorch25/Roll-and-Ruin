import { rollD6 } from "./dice";

export type GameMode = "1v1" | "1x4" | "2v2" | "2x4";
export type GamePhase =
  | "monster_attack"
  | "turn_start"
  | "choose_action"
  | "play_cards"
  | "move"
  | "special_tile"
  | "status_check"
  | "turn_end"
  | "game_over";
export type PlayerAction = "use_cards" | "draw_two_roll_one" | "roll_two_dice";
export type PlayerStatus = "alive" | "eliminated";
export type MonsterAttackPattern = "random_living" | "all_living";

export type PlayerStatusEffectType =
  | "skip_turn"
  | "dice_limit"
  | "dice_reduction"
  | "cards_silenced"
  | "movement_blocked"
  | "reverse_movement"
  | "attack_damage_reduction"
  | "reveal_hand";

export interface PlayerStatusEffect {
  type: PlayerStatusEffectType;
  turnsRemaining: number;
  amount?: number;
  minimum?: number;
}

export interface TurnCardRuntimePlayer {
  invulnerableOwnerTurns?: number;
  attackDamageBonus?: number;
  defenseShieldBonus?: number;
  blockedAttackCardsThisTurn?: boolean;
  curseCooldownTurnsRemaining?: number;
  curseCooldownFresh?: boolean;
}

export interface TurnCardRuntime {
  players: Record<string, TurnCardRuntimePlayer>;
}

export const STARTING_HP = 20;
export const STARTING_HEARTS = 3;
export const STARTING_HAND_SIZE = 4;
export const MAX_CARDS_PER_TURN = 3;

export interface GamePlayer {
  id: string;
  teamId: string;
  position: number;
  hp: number;
  maxHp: number;
  hearts: number;
  score: number;
  hand: string[];
  cardsPlayedThisTurn: number;
  status: PlayerStatus;
  isBot: boolean;
  prisonTurnsRemaining: number;
  statusEffects: PlayerStatusEffect[];
}

export interface GameMonster {
  id: string;
  attackPattern: MonsterAttackPattern;
  /** The monster-specific interval from the rules file. */
  attackInterval: number;
  /** Number of distinct living targets for a scheduled attack. */
  targetCount?: number;
  turnsSinceLastAttack: number;
  active: boolean;
}

export interface GameState {
  mode: GameMode;
  phase: GamePhase;
  turnNumber: number;
  activePlayerIndex: number;
  boardLength: number;
  players: GamePlayer[];
  monsters: GameMonster[];
  selectedAction?: PlayerAction;
  movementSteps: number;
  movementDirection: 1 | -1;
  cardRuntime?: TurnCardRuntime;
}

export interface PlayerSetup {
  id: string;
  teamId: string;
  /** The deck layer supplies the four real starting cards. */
  startingHand: string[];
}

export interface MonsterAttackEvent {
  monsterId: string;
  targetPlayerIds: string[];
  reason: "first_summon" | "scheduled";
}

export interface DeathResult {
  lostHeart: boolean;
  discardedCards: string[];
  eliminated: boolean;
}

const MODE_RULES: Record<GameMode, { players: number; teams: number; playersPerTeam: number }> = {
  "1v1": { players: 2, teams: 2, playersPerTeam: 1 },
  "1x4": { players: 4, teams: 4, playersPerTeam: 1 },
  "2v2": { players: 4, teams: 2, playersPerTeam: 2 },
  "2x4": { players: 8, teams: 4, playersPerTeam: 2 }
};

export function createGameState(
  mode: GameMode,
  playerSetup: PlayerSetup[],
  boardLength = 32,
  botStartingHands: string[][] = []
): GameState {
  const rules = MODE_RULES[mode];
  if (playerSetup.length < 1 || playerSetup.length > rules.players) {
    throw new Error(`Mode ${mode} accepts between 1 and ${rules.players} human player(s).`);
  }
  const playerIds = new Set(playerSetup.map((player) => player.id));
  if (playerIds.size !== playerSetup.length) {
    throw new Error("Player IDs must be unique.");
  }

  const teamIds = [...new Set(playerSetup.map((player) => player.teamId))];
  if (teamIds.length > rules.teams) {
    throw new Error(`Mode ${mode} supports at most ${rules.teams} teams.`);
  }
  const teamCounts = new Map<string, number>();
  for (const teamId of teamIds) {
    const count = playerSetup.filter((player) => player.teamId === teamId).length;
    if (count > rules.playersPerTeam) {
      throw new Error(`Team ${teamId} cannot contain more than ${rules.playersPerTeam} player(s).`);
    }
    teamCounts.set(teamId, count);
  }
  let generatedTeamNumber = 1;
  while (teamIds.length < rules.teams) {
    let candidate = `bot-team-${generatedTeamNumber++}`;
    while (teamIds.includes(candidate)) candidate = `bot-team-${generatedTeamNumber++}`;
    teamIds.push(candidate);
    teamCounts.set(candidate, 0);
  }

  const botCount = rules.players - playerSetup.length;
  if (botStartingHands.length !== botCount) {
    throw new Error(`Provide exactly ${botCount} bot starting hand(s) to fill this match.`);
  }
  const expandedSetup: (PlayerSetup & { isBot: boolean })[] =
    playerSetup.map((player) => ({ ...player, isBot: false }));
  let nextBotId = 1;
  for (const hand of botStartingHands) {
    if (hand.length !== STARTING_HAND_SIZE) {
      throw new Error(`Each bot must start with exactly ${STARTING_HAND_SIZE} cards.`);
    }
    const teamId = teamIds.find((id) => (teamCounts.get(id) ?? 0) < rules.playersPerTeam);
    if (!teamId) throw new Error("Unable to assign a bot to an available team.");
    let id = `bot-${nextBotId++}`;
    while (playerIds.has(id)) id = `bot-${nextBotId++}`;
    playerIds.add(id);
    expandedSetup.push({ id, teamId, startingHand: hand, isBot: true });
    teamCounts.set(teamId, (teamCounts.get(teamId) ?? 0) + 1);
  }
  if (!Number.isInteger(boardLength) || boardLength !== 32) {
    throw new Error("The confirmed board contains exactly 32 spaces.");
  }
  for (const player of expandedSetup) {
    if (player.startingHand.length !== STARTING_HAND_SIZE) {
      throw new Error(`Player ${player.id} must start with exactly ${STARTING_HAND_SIZE} cards.`);
    }
  }

  return {
    mode,
    phase: "monster_attack",
    turnNumber: 1,
    activePlayerIndex: 0,
    boardLength,
    players: expandedSetup.map((player) => ({
      id: player.id,
      teamId: player.teamId,
      position: 0,
      hp: STARTING_HP,
      maxHp: STARTING_HP,
      hearts: STARTING_HEARTS,
      score: 0,
      hand: [...player.startingHand],
      cardsPlayedThisTurn: 0,
      status: "alive",
      isBot: player.isBot,
      prisonTurnsRemaining: 0,
      statusEffects: []
    })),
    monsters: [],
    movementSteps: 0,
    movementDirection: 1
  };
}

export function getActivePlayer(state: GameState): GamePlayer {
  const player = state.players[state.activePlayerIndex];
  if (!player || player.status !== "alive") {
    throw new Error("There is no active living player.");
  }
  return player;
}

function livingPlayers(state: GameState): GamePlayer[] {
  return state.players.filter((player) => player.status === "alive");
}

function chooseRandomTargets<T>(items: T[], amount: number, random: () => number): T[] {
  const pool = [...items];
  const selected: T[] = [];
  while (selected.length < Math.min(amount, pool.length)) {
    const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
    selected.push(pool.splice(index, 1)[0]);
  }
  return selected;
}

/** A newly summoned monster attacks every living player immediately, then starts its own timer at zero. */
export function summonMonster(
  state: GameState,
  monster: Omit<GameMonster, "turnsSinceLastAttack" | "active">
): { state: GameState; attack: MonsterAttackEvent } {
  if (state.monsters.some((item) => item.id === monster.id)) {
    throw new Error(`Monster ${monster.id} already exists.`);
  }
  if (state.monsters.filter((item) => item.active).length >= 4) {
    throw new Error("A maximum of four active monsters may be on the board.");
  }
  if (!Number.isInteger(monster.attackInterval) || monster.attackInterval < 1) {
    throw new Error("A monster must define its own positive attack interval.");
  }
  if (monster.targetCount !== undefined && (!Number.isInteger(monster.targetCount) || monster.targetCount < 1)) {
    throw new Error("targetCount must be a positive integer when provided.");
  }
  const nextMonster: GameMonster = {
    ...monster,
    turnsSinceLastAttack: 0,
    active: true
  };
  const nextState = { ...state, monsters: [...state.monsters, nextMonster] };
  return {
    state: nextState,
    attack: {
      monsterId: monster.id,
      targetPlayerIds: livingPlayers(nextState).map((player) => player.id),
      reason: "first_summon"
    }
  };
}

/** Scheduled attacks resolve before Turn Start; each monster uses its own interval and target count. */
export function resolveMonsterAttackPhase(
  state: GameState,
  random: () => number = Math.random
): { state: GameState; attacks: MonsterAttackEvent[] } {
  if (state.phase !== "monster_attack") {
    throw new Error("Monster attacks can only be resolved at the start of a turn.");
  }

  const attacks: MonsterAttackEvent[] = [];
  const monsters = state.monsters.map((monster) => {
    if (!monster.active || monster.turnsSinceLastAttack < monster.attackInterval) {
      return monster;
    }

    const targets = livingPlayers(state);
    const selected = monster.attackPattern === "all_living"
      ? targets
      : chooseRandomTargets(targets, monster.targetCount ?? 1, random);

    attacks.push({
      monsterId: monster.id,
      targetPlayerIds: selected.map((player) => player.id),
      reason: "scheduled"
    });
    return { ...monster, turnsSinceLastAttack: 0 };
  });

  return { state: { ...state, monsters, phase: "turn_start" }, attacks };
}

export function startPlayerTurn(state: GameState): GameState {
  if (state.phase !== "turn_start") {
    throw new Error("A player turn can only start after the monster attack phase.");
  }
  if (livingPlayers(state).length === 0) return { ...state, phase: "game_over" };
  let activePlayerIndex = state.activePlayerIndex;
  if (state.players[activePlayerIndex]?.status !== "alive") {
    for (let offset = 1; offset <= state.players.length; offset++) {
      const candidate = (activePlayerIndex + offset) % state.players.length;
      if (state.players[candidate].status === "alive") {
        activePlayerIndex = candidate;
        break;
      }
    }
  }
  const activePlayer = state.players[activePlayerIndex];
  const players = state.players.map((player, index) =>
    index === activePlayerIndex
      ? {
          ...player,
          cardsPlayedThisTurn: 0,
          prisonTurnsRemaining: Math.max(0, player.prisonTurnsRemaining - 1)
        }
      : player
  );
  const isSkippedByStatus = activePlayer.statusEffects.some((effect) =>
    effect.type === "skip_turn" && effect.turnsRemaining > 0
  );
  return {
    ...state,
    players,
    activePlayerIndex,
    phase: activePlayer.prisonTurnsRemaining > 0 || isSkippedByStatus ? "turn_end" : "choose_action",
    selectedAction: undefined,
    movementSteps: 0,
    movementDirection: activePlayer.statusEffects.some((effect) =>
      effect.type === "reverse_movement" && effect.turnsRemaining > 0
    ) ? -1 : 1
  };
}

/** Resolve one of the three activities defined by the rules. Card IDs are supplied by the deck layer. */
export function selectPlayerAction(
  state: GameState,
  action: PlayerAction,
  options: { drawnCardIds?: string[]; random?: () => number } = {}
): { state: GameState; diceRolls: number[] } {
  if (state.phase !== "choose_action") {
    throw new Error("An activity can only be selected during the action-choice phase.");
  }

  const random = options.random ?? Math.random;
  if (action === "use_cards") {
    const active = getActivePlayer(state);
    if (active.statusEffects.some((effect) => effect.type === "cards_silenced" && effect.turnsRemaining > 0)) {
      throw new Error("Card use is disabled for this player's current turn.");
    }
    return {
      state: { ...state, selectedAction: action, phase: "play_cards", movementSteps: 0 },
      diceRolls: []
    };
  }

  if (action === "draw_two_roll_one" && (options.drawnCardIds?.length ?? 0) > 2) {
    throw new Error("The draw activity can add at most two cards.");
  }

  const active = getActivePlayer(state);
  const diceLimit = active.statusEffects.some((effect) => effect.type === "dice_limit" && effect.turnsRemaining > 0);
  const requestedDice = action === "draw_two_roll_one" || diceLimit ? 1 : 2;
  const diceReduction = active.statusEffects
    .filter((effect) => effect.type === "dice_reduction" && effect.turnsRemaining > 0)
    .reduce((maximum, effect) => Math.max(maximum, effect.amount ?? 0), 0);
  const minimumDieValue = active.statusEffects
    .filter((effect) => effect.type === "dice_reduction" && effect.turnsRemaining > 0)
    .reduce((minimum, effect) => Math.max(minimum, effect.minimum ?? 1), 1);
  const diceRolls = Array.from({ length: requestedDice }, () =>
    Math.max(minimumDieValue, rollD6(random) - diceReduction)
  );
  const drawnCardIds = action === "draw_two_roll_one" ? (options.drawnCardIds ?? []) : [];
  const players = state.players.map((player) =>
    player.id === active.id ? { ...player, hand: [...player.hand, ...drawnCardIds] } : player
  );

  return {
    state: {
      ...state,
      players,
      selectedAction: action,
      movementSteps: diceRolls.reduce((sum, roll) => sum + roll, 0),
      phase: "move"
    },
    diceRolls
  };
}

/** Play one card ID at a time. The caller resolves the card's catalogue-defined effect. */
export function playCardFromHand(state: GameState, cardId: string, scoreValue = 0): GameState {
  if (state.phase !== "play_cards" || state.selectedAction !== "use_cards") {
    throw new Error("Cards can only be played during the use-cards activity.");
  }
  if (!Number.isInteger(scoreValue)) {
    throw new Error("Card score value must be an integer.");
  }
  const active = getActivePlayer(state);
  if (active.statusEffects.some((effect) => effect.type === "cards_silenced" && effect.turnsRemaining > 0)) {
    throw new Error("Card use is disabled for this player's current turn.");
  }
  if (active.cardsPlayedThisTurn >= MAX_CARDS_PER_TURN) {
    throw new Error(`A player may use at most ${MAX_CARDS_PER_TURN} cards per turn.`);
  }
  const cardIndex = active.hand.indexOf(cardId);
  if (cardIndex < 0) throw new Error("The selected card is not in the player's hand.");

  const hand = [...active.hand];
  hand.splice(cardIndex, 1);
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === active.id
        ? {
            ...player,
            hand,
            score: player.score + scoreValue,
            cardsPlayedThisTurn: player.cardsPlayedThisTurn + 1
          }
        : player
    )
  };
}

/** Card play does not consume a movement die; the normal movement roll is one D6. */
export function finishCardActivity(
  state: GameState,
  random: () => number = Math.random
): { state: GameState; diceRolls: number[] } {
  if (state.phase !== "play_cards" || state.selectedAction !== "use_cards") {
    throw new Error("The use-cards activity is not active.");
  }
  const active = getActivePlayer(state);
  const reduction = active.statusEffects
    .filter((effect) => effect.type === "dice_reduction" && effect.turnsRemaining > 0)
    .reduce((maximum, effect) => Math.max(maximum, effect.amount ?? 0), 0);
  const minimum = active.statusEffects
    .filter((effect) => effect.type === "dice_reduction" && effect.turnsRemaining > 0)
    .reduce((value, effect) => Math.max(value, effect.minimum ?? 1), 1);
  const diceRolls = [Math.max(minimum, rollD6(random) - reduction)];
  return {
    state: { ...state, movementSteps: diceRolls[0], phase: "move" },
    diceRolls
  };
}

export function moveActivePlayer(state: GameState): {
  state: GameState;
  from: number;
  to: number;
  completedLaps: number;
} {
  if (state.phase !== "move") {
    throw new Error("Movement can only happen after the activity has been resolved.");
  }
  const active = getActivePlayer(state);
  const from = active.position;
  const activeRuntimeStatuses = active.statusEffects;
  const movementBlocked = activeRuntimeStatuses.some((effect) =>
    effect.type === "movement_blocked" && effect.turnsRemaining > 0
  );
  const steps = movementBlocked ? 0 : state.movementSteps;
  const totalPosition = from + steps * state.movementDirection;
  const to = ((totalPosition % state.boardLength) + state.boardLength) % state.boardLength;
  const completedLaps = state.movementDirection === 1
    ? Math.floor((from + steps) / state.boardLength)
    : from === 0
      ? Math.floor(steps / state.boardLength)
      : steps < from
        ? 0
        : 1 + Math.floor((steps - from) / state.boardLength);
  const players = state.players.map((player) =>
    player.id === active.id
      ? { ...player, position: to, score: player.score + completedLaps * 2 }
      : player
  );
  return { state: { ...state, players, phase: "special_tile" }, from, to, completedLaps };
}

export function imprisonPlayer(state: GameState, playerId: string, turns = 3): GameState {
  if (!Number.isInteger(turns) || turns < 1) {
    throw new Error("Prison duration must be a positive integer.");
  }
  const target = state.players.find((player) => player.id === playerId);
  if (!target || target.status !== "alive") {
    throw new Error("Only a living player can be sent to prison.");
  }
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId ? { ...player, prisonTurnsRemaining: turns } : player
    )
  };
}

export function finishSpecialTileCheck(state: GameState): GameState {
  if (state.phase !== "special_tile") {
    throw new Error("Special tiles can only be checked after movement.");
  }
  return { ...state, phase: "status_check" };
}

/** Death removes one heart, restores HP, returns the player to start, and applies the card-loss rule. */
export function applyPlayerDeath(
  state: GameState,
  playerId: string,
  random: () => number = Math.random
): { state: GameState; result: DeathResult } {
  const target = state.players.find((player) => player.id === playerId);
  if (!target || target.status !== "alive") {
    throw new Error("Only a living player can be processed for death.");
  }

  const hearts = Math.max(0, target.hearts - 1);
  const discardCount = target.hand.length >= 4 ? Math.ceil(target.hand.length / 2) : 0;
  const remaining = [...target.hand];
  const discardedCards: string[] = [];

  for (let i = 0; i < discardCount; i++) {
    const index = Math.min(remaining.length - 1, Math.floor(random() * remaining.length));
    discardedCards.push(remaining.splice(index, 1)[0]);
  }

  const eliminated = hearts === 0;
  const players = state.players.map((player) =>
    player.id === playerId
      ? {
          ...player,
          hp: player.maxHp,
          hearts,
          position: 0,
          hand: remaining,
          cardsPlayedThisTurn: 0,
          prisonTurnsRemaining: 0,
          status: eliminated ? "eliminated" as const : "alive" as const
        }
      : player
  );

  return {
    state: { ...state, players },
    result: { lostHeart: true, discardedCards, eliminated }
  };
}

export function finishStatusCheck(state: GameState): GameState {
  if (state.phase !== "status_check") {
    throw new Error("Player status can only be checked after the special-tile phase.");
  }
  return { ...state, phase: "turn_end" };
}

export function endPlayerTurn(state: GameState): GameState {
  if (state.phase !== "turn_end") {
    throw new Error("A turn can only end after status has been checked.");
  }

  const activePlayer = state.players[state.activePlayerIndex];
  const players = state.players.map((player) => player.id === activePlayer?.id
    ? {
        ...player,
        statusEffects: player.statusEffects
          .map((effect) => ({ ...effect, turnsRemaining: effect.turnsRemaining - 1 }))
          .filter((effect) => effect.turnsRemaining > 0)
      }
    : player
  );
  const monsters = state.monsters.map((monster) =>
    monster.active
      ? { ...monster, turnsSinceLastAttack: monster.turnsSinceLastAttack + 1 }
      : monster
  );
  let cardRuntime = state.cardRuntime;
  if (cardRuntime && activePlayer) {
    const runtime = cardRuntime.players[activePlayer.id];
    if (runtime) {
      cardRuntime = {
        ...cardRuntime,
        players: {
          ...cardRuntime.players,
          [activePlayer.id]: {
            ...runtime,
            invulnerableOwnerTurns: Math.max(0, (runtime.invulnerableOwnerTurns ?? 0) - 1),
            attackDamageBonus: 0,
            defenseShieldBonus: 0,
            blockedAttackCardsThisTurn: false,
            curseCooldownTurnsRemaining: runtime.curseCooldownFresh
              ? (runtime.curseCooldownTurnsRemaining ?? 0)
              : Math.max(0, (runtime.curseCooldownTurnsRemaining ?? 0) - 1),
            curseCooldownFresh: false
          }
        }
      };
    }
  }

  const nextState = {
    ...state,
    players,
    monsters,
    cardRuntime,
    movementDirection: 1 as const,
    turnNumber: state.turnNumber + 1
  };
  const alive = livingPlayers(nextState);
  if (alive.length === 0) return { ...nextState, phase: "game_over" };

  for (let offset = 1; offset <= state.players.length; offset++) {
    const index = (state.activePlayerIndex + offset) % state.players.length;
    if (nextState.players[index].status === "alive") {
      return { ...nextState, activePlayerIndex: index, phase: "monster_attack" };
    }
  }

  return { ...nextState, phase: "game_over" };
}

export function getTeamScores(state: GameState): Record<string, number> {
  return state.players.reduce<Record<string, number>>((scores, player) => {
    scores[player.teamId] = (scores[player.teamId] ?? 0) + player.score;
    return scores;
  }, {});
}
