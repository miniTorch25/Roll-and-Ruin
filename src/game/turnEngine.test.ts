import { describe, expect, it } from "vitest";
import {
  applyPlayerDeath,
  createGameState,
  endPlayerTurn,
  finishCardActivity,
  finishSpecialTileCheck,
  finishStatusCheck,
  getTeamScores,
  moveActivePlayer,
  playCardFromHand,
  resolveMonsterAttackPhase,
  selectPlayerAction,
  startPlayerTurn,
  summonMonster
} from "./turnEngine";

const setup = [
  { id: "p1", teamId: "red", startingHand: ["a", "b", "c", "d"] },
  { id: "p2", teamId: "blue", startingHand: ["a", "b", "c", "d"] },
  { id: "p3", teamId: "green", startingHand: ["a", "b", "c", "d"] },
  { id: "p4", teamId: "yellow", startingHand: ["a", "b", "c", "d"] }
];

function readyState() {
  const initial = createGameState("1x4", setup);
  return startPlayerTurn(resolveMonsterAttackPhase(initial, () => 0).state);
}

function completeEmptyTurn(state: ReturnType<typeof readyState>) {
  const action = selectPlayerAction(state, "roll_two_dice", { random: () => 0 });
  const moved = moveActivePlayer(action.state);
  return endPlayerTurn(finishStatusCheck(finishSpecialTileCheck(moved.state)));
}

describe("Roll and Ruin turn engine", () => {
  it("supports all four confirmed match formats and validates team sizes", () => {
    expect(createGameState("1v1", [
      { id: "a", teamId: "red" }, { id: "b", teamId: "blue" }
    ]).players).toHaveLength(2);
    expect(createGameState("1x4", setup).players).toHaveLength(4);
    expect(createGameState("2v2", [
      { id: "a", teamId: "red" }, { id: "b", teamId: "red" },
      { id: "c", teamId: "blue" }, { id: "d", teamId: "blue" }
    ]).players).toHaveLength(4);
    expect(createGameState("2x4", [
      { id: "a", teamId: "A" }, { id: "b", teamId: "A" },
      { id: "c", teamId: "B" }, { id: "d", teamId: "B" },
      { id: "e", teamId: "C" }, { id: "f", teamId: "C" },
      { id: "g", teamId: "D" }, { id: "h", teamId: "D" }
    ]).players).toHaveLength(8);
  });

  it("uses confirmed starting HP, hearts, hand size, and 32-space board", () => {
    const state = createGameState("1x4", setup);
    expect(state.boardLength).toBe(32);
    expect(state.players[0]).toMatchObject({
      hp: 20, maxHp: 20, hearts: 3, hand: ["a", "b", "c", "d"]
    });
    expect(() => createGameState("1x4", setup, 3, 18)).toThrow();
    expect(() => createGameState("1x4", setup.map(({ startingHand, ...player }) => player)
      .map((player) => ({ ...player, startingHand: ["a", "b", "c"] })))).toThrow();
  });

  it("draws two supplied cards and rolls exactly one die", () => {
    const result = selectPlayerAction(readyState(), "draw_two_roll_one", {
      drawnCardIds: ["e", "f"], random: () => 0.5
    });
    expect(result.diceRolls).toEqual([4]);
    expect(result.state.movementSteps).toBe(4);
    expect(result.state.players[0].hand).toHaveLength(6);
    expect(result.state.phase).toBe("move");
  });

  it("rolls two dice and moves by their total", () => {
    const result = selectPlayerAction(readyState(), "roll_two_dice", { random: () => 0.5 });
    expect(result.diceRolls).toEqual([4, 4]);
    expect(result.state.movementSteps).toBe(8);
    expect(moveActivePlayer(result.state).to).toBe(8);
  });

  it("allows up to three cards, then rolls movement without spending another card action", () => {
    let state = selectPlayerAction(readyState(), "use_cards").state;
    state = playCardFromHand(state, "a");
    state = playCardFromHand(state, "b");
    state = playCardFromHand(state, "c");
    expect(state.players[0].cardsPlayedThisTurn).toBe(3);
    expect(() => playCardFromHand(state, "d")).toThrow();
    const finished = finishCardActivity(state, () => 0);
    expect(finished.diceRolls).toEqual([1]);
    expect(finished.state.phase).toBe("move");
    expect(finished.state.players[0].hand).toEqual(["d"]);
  });

  it("rejects playing a card that is not in the active player's hand", () => {
    const state = selectPlayerAction(readyState(), "use_cards").state;
    expect(() => playCardFromHand(state, "missing")).toThrow();
  });

  it("makes a newly summoned monster attack every living player immediately", () => {
    const summoned = summonMonster(readyState(), {
      id: "m1", attackPattern: "random_living", attackInterval: 2
    });
    expect(summoned.attack.reason).toBe("first_summon");
    expect(summoned.attack.targetPlayerIds).toEqual(["p1", "p2", "p3", "p4"]);
    expect(summoned.state.monsters[0].turnsSinceLastAttack).toBe(0);
  });

  it("uses each monster's own attack interval and target count", () => {
    let state = readyState();
    state = summonMonster(state, {
      id: "fast", attackPattern: "random_living", attackInterval: 1, targetCount: 2
    }).state;
    state = summonMonster(state, {
      id: "slow", attackPattern: "random_living", attackInterval: 4
    }).state;

    state = completeEmptyTurn(state);
    const first = resolveMonsterAttackPhase(state, () => 0);
    expect(first.attacks).toHaveLength(1);
    expect(first.attacks[0].monsterId).toBe("fast");
    expect(first.attacks[0].targetPlayerIds).toHaveLength(2);

    state = startPlayerTurn(first.state);
    state = completeEmptyTurn(state);
    const second = resolveMonsterAttackPhase(state, () => 0);
    expect(second.attacks).toHaveLength(1);
    expect(second.attacks[0].monsterId).toBe("fast");
  });

  it("wraps around the 32-space board and awards two points per completed lap", () => {
    const state = {
      ...readyState(),
      players: readyState().players.map((player) =>
        player.id === "p1" ? { ...player, position: 30 } : player
      ),
      movementSteps: 4,
      phase: "move" as const
    };
    const moved = moveActivePlayer(state);
    expect(moved.to).toBe(2);
    expect(moved.completedLaps).toBe(1);
    expect(moved.state.players[0].score).toBe(2);
  });

  it("discards half rounded up only when the hand has at least four cards and restores HP", () => {
    const state = {
      ...readyState(),
      players: readyState().players.map((player) => player.id === "p1"
        ? { ...player, hp: 0, hand: ["a", "b", "c", "d", "e"] }
        : player)
    };
    const death = applyPlayerDeath(state, "p1", () => 0);
    expect(death.result.discardedCards).toHaveLength(3);
    expect(death.state.players[0].hand).toHaveLength(2);
    expect(death.state.players[0]).toMatchObject({ position: 0, hp: 20, hearts: 2 });

    const smallHand = {
      ...state,
      players: state.players.map((player) => player.id === "p1"
        ? { ...player, hand: ["a", "b", "c"] }
        : player)
    };
    expect(applyPlayerDeath(smallHand, "p1").result.discardedCards).toHaveLength(0);
  });

  it("keeps eliminated players' points in the team total and allows negative scores", () => {
    const state = {
      ...readyState(),
      players: readyState().players.map((player, index) => ({
        ...player, score: index === 0 ? -5 : 2,
        status: index === 0 ? "eliminated" as const : player.status
      }))
    };
    expect(getTeamScores(state).red).toBe(-5);
  });

  it("skips a player eliminated during the monster attack phase", () => {
    const initial = createGameState("1x4", setup);
    const attackPhase = resolveMonsterAttackPhase(initial).state;
    const withEliminatedPlayer = {
      ...attackPhase,
      players: attackPhase.players.map((player) => player.id === "p1"
        ? { ...player, status: "eliminated" as const } : player)
    };
    const started = startPlayerTurn(withEliminatedPlayer);
    expect(started.activePlayerIndex).toBe(1);
    expect(started.phase).toBe("choose_action");
  });

  it("eliminates a player when the last heart is lost", () => {
    const state = {
      ...readyState(),
      players: readyState().players.map((player) => player.id === "p1"
        ? { ...player, hearts: 1 } : player)
    };
    const death = applyPlayerDeath(state, "p1");
    expect(death.result.eliminated).toBe(true);
    expect(death.state.players[0].status).toBe("eliminated");
  });
});
