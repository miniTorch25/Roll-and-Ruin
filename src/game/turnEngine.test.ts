import { describe, expect, it } from "vitest";
import {
  applyPlayerDeath,
  createGameState,
  endPlayerTurn,
  finishSpecialTileCheck,
  finishStatusCheck,
  getTeamScores,
  moveActivePlayer,
  resolveMonsterAttackPhase,
  selectPlayerAction,
  startPlayerTurn,
  summonMonster
} from "./turnEngine";

const setup = [
  { id: "p1", teamId: "red" }, { id: "p2", teamId: "blue" },
  { id: "p3", teamId: "green" }, { id: "p4", teamId: "yellow" }
];

function readyState() {
  let state = createGameState("1x4", setup, 3, 20);
  state = startPlayerTurn(resolveMonsterAttackPhase(state, () => 0).state);
  return state;
}

describe("Roll and Ruin turn engine", () => {
  it("validates the 1x4 and 2x4 team layouts", () => {
    expect(createGameState("1x4", setup, 3, 20).players).toHaveLength(4);
    const pairs = [
      { id: "a", teamId: "A" }, { id: "b", teamId: "A" },
      { id: "c", teamId: "B" }, { id: "d", teamId: "B" },
      { id: "e", teamId: "C" }, { id: "f", teamId: "C" },
      { id: "g", teamId: "D" }, { id: "h", teamId: "D" }
    ];
    expect(createGameState("2x4", pairs, 3, 20).players).toHaveLength(8);
  });

  it("rejects an invalid team layout", () => {
    expect(() => createGameState("1x4", setup.slice(0, 3), 3, 20)).toThrow();
  });

  it("enforces the confirmed turn sequence and one selected action", () => {
    const state = readyState();
    const selected = selectPlayerAction(state, "roll_dice", { random: () => 0.5 });
    expect(selected.dieRoll).toBe(4);
    expect(selected.state.phase).toBe("move");
    expect(() => selectPlayerAction(selected.state, "draw_card")).toThrow();
    const moved = moveActivePlayer(selected.state);
    expect(moved.to).toBe(4);
    expect(finishSpecialTileCheck(moved.state).phase).toBe("status_check");
  });

  it("makes a newly summoned monster attack every living player immediately", () => {
    const state = readyState();
    const summoned = summonMonster(state, {
      id: "m1", attackPattern: "random_living"
    });
    expect(summoned.attack.reason).toBe("first_summon");
    expect(summoned.attack.targetPlayerIds).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("schedules a monster after two completed player turns", () => {
    let state = readyState();
    state = summonMonster(state, {
      id: "m1", attackPattern: "random_living", attackEveryPlayerTurns: 2
    }).state;
    state = selectPlayerAction(state, "draw_card").state;
    state = moveActivePlayer(state).state;
    state = finishSpecialTileCheck(state);
    state = finishStatusCheck(state);
    state = endPlayerTurn(state);
    expect(resolveMonsterAttackPhase(state, () => 0).attacks).toHaveLength(0);

    state = startPlayerTurn(resolveMonsterAttackPhase(state, () => 0).state);
    state = selectPlayerAction(state, "draw_card").state;
    state = moveActivePlayer(state).state;
    state = finishSpecialTileCheck(state);
    state = finishStatusCheck(state);
    state = endPlayerTurn(state);
    const scheduled = resolveMonsterAttackPhase(state, () => 0);
    expect(scheduled.attacks).toHaveLength(1);
    expect(scheduled.attacks[0].targetPlayerIds).toEqual(["p1"]);
  });

  it("discards half rounded up only when the hand has at least four cards", () => {
    let state = readyState();
    state = {
      ...state,
      players: state.players.map((player) => player.id === "p1"
        ? { ...player, hand: ["a", "b", "c", "d", "e"] }
        : player)
    };
    const death = applyPlayerDeath(state, "p1", () => 0);
    expect(death.result.discardedCards).toHaveLength(3);
    expect(death.state.players[0].hand).toHaveLength(2);
    expect(death.state.players[0].position).toBe(0);

    const smallHand = {
      ...state,
      players: state.players.map((player) => player.id === "p1"
        ? { ...player, hand: ["a", "b", "c"] }
        : player)
    };
    expect(applyPlayerDeath(smallHand, "p1").result.discardedCards).toHaveLength(0);
  });

  it("keeps eliminated players' points in the team total and allows negative scores", () => {
    const state = readyState();
    const scored = {
      ...state,
      players: state.players.map((player, index) => ({
        ...player, score: index === 0 ? -5 : 2, status: index === 0 ? "eliminated" as const : player.status
      }))
    };
    expect(getTeamScores(scored).red).toBe(-5);
  });

  it("skips a player eliminated during the monster attack phase", () => {
    const initial = createGameState("1x4", setup, 3, 20);
    const attackPhase = resolveMonsterAttackPhase(initial).state;
    const withEliminatedPlayer = {
      ...attackPhase,
      players: attackPhase.players.map((player) => player.id === "p1" ? { ...player, status: "eliminated" as const } : player)
    };
    const started = startPlayerTurn(withEliminatedPlayer);
    expect(started.activePlayerIndex).toBe(1);
    expect(started.phase).toBe("choose_action");
  });

  it("eliminates a player when the last heart is lost", () => {
    const state = {
      ...readyState(),
      players: readyState().players.map((player) => player.id === "p1" ? { ...player, hearts: 1 } : player)
    };
    const death = applyPlayerDeath(state, "p1");
    expect(death.result.eliminated).toBe(true);
    expect(death.state.players[0].status).toBe("eliminated");
  });
});
