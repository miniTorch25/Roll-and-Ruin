import { rollD6 } from "./dice";

export type GameMode = "1x4" | "2x4";
export type GamePhase =
  | "monster_attack"
  | "turn_start"
  | "choose_action"
  | "move"
  | "special_tile"
  | "status_check"
  | "turn_end"
  | "game_over";
export type PlayerAction = "use_card" | "draw_card" | "roll_dice";
export type PlayerStatus = "alive" | "eliminated";
export type MonsterAttackPattern = "random_living" | "all_living";

const MONSTER_ATTACK_INTERVAL = 2;

export interface GamePlayer {
  id: string;
  teamId: string;
  position: number;
  hearts: number;
  score: number;
  hand: string[];
  status: PlayerStatus;
}

export interface GameMonster {
  id: string;
  attackPattern: MonsterAttackPattern;
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
}

export interface PlayerSetup {
  id: string;
  teamId: string;
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

export function createGameState(
  mode: GameMode,
  playerSetup: PlayerSetup[],
  heartsPerPlayer: number,
  boardLength: number
): GameState {
  const playersPerTeam = mode === "1x4" ? 1 : 2;
  const expectedPlayers = playersPerTeam * 4;
  const teamIds = new Set(playerSetup.map((player) => player.teamId));

  if (playerSetup.length !== expectedPlayers) {
    throw new Error(`Mode ${mode} requires exactly ${expectedPlayers} players.`);
  }
  if (teamIds.size !== 4) {
    throw new Error("A match must contain exactly 4 teams.");
  }
  for (const teamId of teamIds) {
    if (playerSetup.filter((player) => player.teamId === teamId).length !== playersPerTeam) {
      throw new Error(`Team ${teamId} must contain ${playersPerTeam} player(s).`);
    }
  }
  if (!Number.isInteger(heartsPerPlayer) || heartsPerPlayer < 1) {
    throw new Error("heartsPerPlayer must be a positive integer.");
  }
  if (!Number.isInteger(boardLength) || boardLength < 2) {
    throw new Error("boardLength must be an integer greater than 1.");
  }
  if (new Set(playerSetup.map((player) => player.id)).size !== playerSetup.length) {
    throw new Error("Player IDs must be unique.");
  }

  return {
    mode,
    phase: "monster_attack",
    turnNumber: 1,
    activePlayerIndex: 0,
    boardLength,
    players: playerSetup.map((player) => ({
      ...player,
      position: 0,
      hearts: heartsPerPlayer,
      score: 0,
      hand: [],
      status: "alive"
    })),
    monsters: [],
    movementSteps: 0
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

function chooseRandom<T>(items: T[], random: () => number): T | undefined {
  if (items.length === 0) return undefined;
  const index = Math.min(items.length - 1, Math.floor(random() * items.length));
  return items[index];
}

/** A newly summoned monster attacks all living players immediately. */
export function summonMonster(
  state: GameState,
  monster: Omit<GameMonster, "turnsSinceLastAttack" | "active">
): { state: GameState; attack: MonsterAttackEvent } {
  if (state.monsters.some((item) => item.id === monster.id)) {
    throw new Error(`Monster ${monster.id} already exists.`);
  }
  const nextMonster: GameMonster = {
    ...monster,
    turnsSinceLastAttack: 0,
    active: true
  };
  const nextState = { ...state, monsters: [...state.monsters, nextMonster] };
  const targets = livingPlayers(nextState);
  return {
    state: nextState,
    attack: {
      monsterId: monster.id,
      targetPlayerIds: targets.map((player) => player.id),
      reason: "first_summon"
    }
  };
}

/** Resolve scheduled monster attacks before the next player's turn begins. */
export function resolveMonsterAttackPhase(
  state: GameState,
  random: () => number = Math.random
): { state: GameState; attacks: MonsterAttackEvent[] } {
  if (state.phase !== "monster_attack") {
    throw new Error("Monster attacks can only be resolved at the start of a turn.");
  }

  const attacks: MonsterAttackEvent[] = [];
  const monsters = state.monsters.map((monster) => {
    if (!monster.active || monster.turnsSinceLastAttack < MONSTER_ATTACK_INTERVAL) {
      return monster;
    }

    const targets = livingPlayers(state);
    const selected = monster.attackPattern === "all_living"
      ? targets
      : [chooseRandom(targets, random)].filter((player): player is GamePlayer => player !== undefined);

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
  return { ...state, activePlayerIndex, phase: "choose_action", selectedAction: undefined, movementSteps: 0 };
}

/** Exactly one of use-card, draw-card, or roll-dice may be selected per turn. */
export function selectPlayerAction(
  state: GameState,
  action: PlayerAction,
  options: { movementSteps?: number; random?: () => number } = {}
): { state: GameState; dieRoll?: number } {
  if (state.phase !== "choose_action") {
    throw new Error("An action can only be selected during the action-choice phase.");
  }

  const random = options.random ?? Math.random;
  const dieRoll = action === "roll_dice" ? rollD6(random) : undefined;
  const movementSteps = action === "roll_dice"
    ? dieRoll!
    : options.movementSteps ?? 0;

  if (!Number.isInteger(movementSteps) || movementSteps < 0) {
    throw new Error("movementSteps must be a non-negative integer.");
  }

  return {
    state: { ...state, selectedAction: action, movementSteps, phase: "move" },
    dieRoll
  };
}

export function moveActivePlayer(state: GameState): {
  state: GameState;
  from: number;
  to: number;
} {
  if (state.phase !== "move") {
    throw new Error("Movement can only happen after the action has been selected.");
  }
  const active = getActivePlayer(state);
  const from = active.position;
  const to = Math.min(state.boardLength - 1, from + state.movementSteps);
  const players = state.players.map((player) =>
    player.id === active.id ? { ...player, position: to } : player
  );
  return { state: { ...state, players, phase: "special_tile" }, from, to };
}

export function finishSpecialTileCheck(state: GameState): GameState {
  if (state.phase !== "special_tile") {
    throw new Error("Special tiles can only be checked after movement.");
  }
  return { ...state, phase: "status_check" };
}

/** Death removes one heart, returns the player to start, and applies the card-loss rule. */
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
          hearts,
          position: 0,
          hand: remaining,
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

  const monsters = state.monsters.map((monster) =>
    monster.active
      ? { ...monster, turnsSinceLastAttack: monster.turnsSinceLastAttack + 1 }
      : monster
  );

  const nextState = { ...state, monsters, turnNumber: state.turnNumber + 1 };
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
