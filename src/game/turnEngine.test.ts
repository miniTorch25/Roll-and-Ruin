import { describe, expect, it } from "vitest";
import {
  applyPlayerDeath,
  createGameState,
  endPlayerTurn,
  finishCardActivity,
  finishSpecialTileCheck,
  finishStatusCheck,
  getTeamScores,
  imprisonPlayer,
  moveActivePlayer,
  playCardFromHand,
  resolveMonsterAttackPhase,
  rerollOneDie,
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
      { id: "a", teamId: "red", startingHand: ["1","2","3","4"] }, { id: "b", teamId: "blue", startingHand: ["1","2","3","4"] }
    ]).players).toHaveLength(2);
    expect(createGameState("1x4", setup).players).toHaveLength(4);
    expect(createGameState("2v2", [
      { id: "a", teamId: "red", startingHand: ["1","2","3","4"] }, { id: "b", teamId: "red", startingHand: ["1","2","3","4"] },
      { id: "c", teamId: "blue", startingHand: ["1","2","3","4"] }, { id: "d", teamId: "blue", startingHand: ["1","2","3","4"] }
    ]).players).toHaveLength(4);
    expect(createGameState("2x4", [
      { id: "a", teamId: "A", startingHand: ["1","2","3","4"] }, { id: "b", teamId: "A", startingHand: ["1","2","3","4"] },
      { id: "c", teamId: "B", startingHand: ["1","2","3","4"] }, { id: "d", teamId: "B", startingHand: ["1","2","3","4"] },
      { id: "e", teamId: "C", startingHand: ["1","2","3","4"] }, { id: "f", teamId: "C", startingHand: ["1","2","3","4"] },
      { id: "g", teamId: "D", startingHand: ["1","2","3","4"] }, { id: "h", teamId: "D", startingHand: ["1","2","3","4"] }
    ]).players).toHaveLength(8);
  });

  it("fills missing seats with bots for solo and partial-human matches", () => {
    const solo = createGameState("1v1", [
      { id: "solo", teamId: "red", startingHand: ["a", "b", "c", "d"] }
    ], 32, [["e", "f", "g", "h"]]);
    expect(solo.players).toHaveLength(2);
    expect(solo.players.filter((player) => player.isBot)).toHaveLength(1);
    expect(new Set(solo.players.map((player) => player.teamId)).size).toBe(2);

    const partial = createGameState("1x4", [
      { id: "human", teamId: "red", startingHand: ["a", "b", "c", "d"] }
    ], 32, [
      ["e", "f", "g", "h"], ["i", "j", "k", "l"], ["m", "n", "o", "p"]
    ]);
    expect(partial.players).toHaveLength(4);
    expect(partial.players.filter((player) => player.isBot)).toHaveLength(3);
    expect(new Set(partial.players.map((player) => player.teamId)).size).toBe(4);

    const sevenHumans = Array.from({ length: 7 }, (_, index) => ({
      id: `human-${index + 1}`,
      teamId: `team-${Math.floor(index / 2) + 1}`,
      startingHand: ["a", "b", "c", "d"]
    }));
    const almostFull = createGameState("2x4", sevenHumans, 32, [["e", "f", "g", "h"]]);
    expect(almostFull.players).toHaveLength(8);
    expect(almostFull.players.filter((player) => player.isBot)).toHaveLength(1);
  });

  it("requires exactly enough four-card starting hands for generated bots", () => {
    const oneHuman = [{ id: "human", teamId: "red", startingHand: ["a", "b", "c", "d"] }];
    expect(() => createGameState("1v1", oneHuman)).toThrow(/bot starting hand/);
    expect(() => createGameState("1v1", oneHuman, 32, [["a", "b", "c"]])).toThrow(/4 cards/);
  });

  it("uses confirmed starting HP, hearts, hand size, and 32-space board", () => {
    const state = createGameState("1x4", setup);
    expect(state.boardLength).toBe(32);
    expect(state.players[0]).toMatchObject({
      hp: 20, maxHp: 20, hearts: 3, hand: ["a", "b", "c", "d"]
    });
    expect(() => createGameState("1x4", setup, 18)).toThrow();
    expect(() => createGameState("1x4", setup.map((player) => ({ ...player, startingHand: ["a", "b", "c"] })))).toThrow();
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



  it("makes Gob repeat its previous target 60% of the time and pick a different target otherwise", () => {
    const summoned = summonMonster(createGameState("1x4", setup), {
      id: "gob", catalogueId: "C01", attackPattern: "random_living",
      attackInterval: 2, attackDamage: 1,
      lastTargetPlayerId: "p1"
    });
    const scheduled = { ...summoned.state, monsters: summoned.state.monsters.map((monster) => ({ ...monster, turnsSinceLastAttack: 2 })) };
    const repeated = resolveMonsterAttackPhase(scheduled, () => 0.2);
    expect(repeated.attacks[0].targetPlayerIds).toEqual(["p1"]);
    expect(repeated.state.monsters[0].lastTargetPlayerId).toBe("p1");

    const changed = resolveMonsterAttackPhase({
      ...scheduled,
      phase: "monster_attack" as const,
      monsters: scheduled.monsters.map((monster) => ({ ...monster, turnsSinceLastAttack: 2 }))
    }, () => 0.9);
    expect(changed.attacks[0].targetPlayerIds).not.toEqual(["p1"]);
    expect(changed.state.monsters[0].lastTargetPlayerId).toBe(changed.attacks[0].targetPlayerIds[0]);
  });

  it("uses Bone's two distinct targets, Ratty's one-turn interval, and Batty's fresh random target", () => {
    const bone = summonMonster(createGameState("1x4", setup), {
      id: "bone", catalogueId: "C02", attackPattern: "random_living",
      attackInterval: 2, targetCount: 2, attackDamage: 2
    });
    expect(resolveMonsterAttackPhase({ ...bone.state, monsters: bone.state.monsters.map((monster) => ({ ...monster, turnsSinceLastAttack: 2 })) }, () => 0).attacks[0].targetPlayerIds).toEqual(["p1", "p2"]);

    const ratty = summonMonster(createGameState("1x4", setup), {
      id: "ratty", catalogueId: "C04", attackPattern: "random_living",
      attackInterval: 1, attackDamage: 1
    });
    expect(resolveMonsterAttackPhase({ ...ratty.state, monsters: ratty.state.monsters.map((monster) => ({ ...monster, turnsSinceLastAttack: 1 })) }, () => 0).attacks).toHaveLength(1);

    const batty = summonMonster(createGameState("1x4", setup), {
      id: "batty", catalogueId: "C08", attackPattern: "random_living",
      attackInterval: 1, attackDamage: 1
    });
    const scheduledBatty = { ...batty.state, monsters: batty.state.monsters.map((monster) => ({ ...monster, turnsSinceLastAttack: 1 })) };
    const first = resolveMonsterAttackPhase(scheduledBatty, () => 0);
    const second = resolveMonsterAttackPhase({
      ...scheduledBatty,
      phase: "monster_attack" as const,
      monsters: scheduledBatty.monsters.map((monster) => ({ ...monster, turnsSinceLastAttack: 1 }))
    }, () => 0.99);
    expect(first.attacks[0].targetPlayerIds).toEqual(["p1"]);
    expect(second.attacks[0].targetPlayerIds).toEqual(["p4"]);
  });

  it("enforces the five-active-monster board limit", () => {
    let state = readyState();
    for (let index = 1; index <= 5; index++) {
      state = summonMonster(state, {
        id: `m${index}`, attackPattern: "random_living", attackInterval: 2
      }).state;
    }
    expect(() => summonMonster(state, {
      id: "m6", attackPattern: "random_living", attackInterval: 2
    })).toThrow(/maximum of 5/);
  });

  it("enforces the per-rank monster limit before the board-wide limit", () => {
    let state = readyState();
    for (let index = 1; index <= 4; index++) {
      state = summonMonster(state, {
        id: `epic-${index}`, rank: "Epic", attackPattern: "random_living", attackInterval: 2
      }).state;
    }
    expect(() => summonMonster(state, {
      id: "epic-5", rank: "Epic", attackPattern: "random_living", attackInterval: 2
    })).toThrow(/Epic monster limit/);
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

  it("skips three imprisoned turns while still advancing monster attack counters", () => {
    let state = createGameState("1x4", setup);
    state = summonMonster(state, {
      id: "m1", attackPattern: "random_living", attackInterval: 1
    }).state;
    state = imprisonPlayer(state, "p1");
    state = startPlayerTurn(resolveMonsterAttackPhase(state).state);
    expect(state.phase).toBe("turn_end");
    expect(state.players[0].prisonTurnsRemaining).toBe(2);

    state = endPlayerTurn(state);
    expect(state.monsters[0].turnsSinceLastAttack).toBe(1);
    const attacks = resolveMonsterAttackPhase(state, () => 0);
    expect(attacks.attacks).toHaveLength(1);
    const nextPlayer = startPlayerTurn(attacks.state);
    expect(nextPlayer.activePlayerIndex).toBe(1);
    expect(nextPlayer.phase).toBe("choose_action");
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


describe("timed player status processing", () => {
  it("skips exactly the target's next turn and expires the skip after that turn", () => {
    const initial = {
      ...createGameState("1x4", setup),
      phase: "turn_start" as const,
      players: createGameState("1x4", setup).players.map((player) => player.id === "p1"
        ? { ...player, statusEffects: [{ type: "skip_turn" as const, turnsRemaining: 1 }] }
        : player)
    };
    const skipped = startPlayerTurn(initial);
    expect(skipped.phase).toBe("turn_end");
    const ended = endPlayerTurn(skipped);
    expect(ended.players[0].statusEffects).toEqual([]);
    expect(ended.activePlayerIndex).toBe(1);
  });

  it("limits dice count and reduces die faces to the configured minimum", () => {
    const state = {
      ...readyState(),
      players: readyState().players.map((player) => player.id === "p1"
        ? {
            ...player,
            statusEffects: [
              { type: "dice_limit" as const, turnsRemaining: 1, amount: 1 },
              { type: "dice_reduction" as const, turnsRemaining: 2, amount: 2, minimum: 1 }
            ]
          }
        : player)
    };
    const result = selectPlayerAction(state, "roll_two_dice", { random: () => 0.99 });
    expect(result.diceRolls).toEqual([4]);
    expect(result.state.movementSteps).toBe(4);
  });

  it("allows dice actions but blocks card actions while Silenced", () => {
    const state = {
      ...readyState(),
      players: readyState().players.map((player) => player.id === "p1"
        ? { ...player, statusEffects: [{ type: "cards_silenced" as const, turnsRemaining: 1 }] }
        : player)
    };
    expect(() => selectPlayerAction(state, "use_cards")).toThrow(/Card use is disabled/);
    expect(selectPlayerAction(state, "roll_two_dice", { random: () => 0 }).diceRolls).toEqual([1, 1]);
  });

  it("prevents movement while Bound without preventing the action or dice roll", () => {
    const state = {
      ...readyState(),
      players: readyState().players.map((player) => player.id === "p1"
        ? {
            ...player,
            position: 7,
            statusEffects: [{ type: "movement_blocked" as const, turnsRemaining: 2 }]
          }
        : player),
      movementSteps: 6,
      phase: "move" as const
    };
    const moved = moveActivePlayer(state);
    expect(moved.to).toBe(7);
    expect(moved.completedLaps).toBe(0);
  });

  it("moves backwards for the reversed turn and counts crossing Start once", () => {
    const state = {
      ...readyState(),
      players: readyState().players.map((player) => player.id === "p1"
        ? {
            ...player,
            position: 1,
            statusEffects: [{ type: "reverse_movement" as const, turnsRemaining: 1 }]
          }
        : player),
      movementSteps: 3,
      movementDirection: -1 as const,
      phase: "move" as const
    };
    const moved = moveActivePlayer(state);
    expect(moved.to).toBe(30);
    expect(moved.completedLaps).toBe(1);
    expect(moved.state.players[0].score).toBe(2);
  });

  it("does not award a backwards lap merely for leaving position zero", () => {
    const state = {
      ...readyState(),
      players: readyState().players.map((player) => player.id === "p1"
        ? { ...player, position: 0 }
        : player),
      movementSteps: 1,
      movementDirection: -1 as const,
      phase: "move" as const
    };
    const moved = moveActivePlayer(state);
    expect(moved.to).toBe(31);
    expect(moved.completedLaps).toBe(0);
  });

  it("expires owner-turn buffs and temporary attack/defense bonuses at turn end", () => {
    const initial = {
      ...readyState(),
      phase: "turn_end" as const,
      cardRuntime: {
        players: {
          p1: {
            invulnerableOwnerTurns: 3,
            attackDamageBonus: 2,
            defenseShieldBonus: 1,
            blockedAttackCardsThisTurn: true,
            curseCooldownTurnsRemaining: 0
          }
        }
      }
    };
    const ended = endPlayerTurn(initial);
    expect(ended.cardRuntime?.players.p1).toMatchObject({
      invulnerableOwnerTurns: 2,
      attackDamageBonus: 0,
      defenseShieldBonus: 0,
      blockedAttackCardsThisTurn: false
    });
  });

  it("blocks catalogue attack cards after Armor Seal but still permits non-attack cards", () => {
    const ready = readyState();
    const state = {
      ...selectPlayerAction(ready, "use_cards").state,
      cardRuntime: {
        players: {
          p1: { blockedAttackCardsThisTurn: true }
        }
      }
    };
    expect(() => playCardFromHand(state, "a", 1, true)).toThrow(/Attack cards are blocked/);
    expect(() => playCardFromHand(state, "b", 1, false)).not.toThrow();
  });
});


describe("dice manipulation turn flow", () => {
  it("rolls the bonus die and consumes controlled values during card activity", () => {
    const cardActivity = selectPlayerAction(readyState(), "use_cards").state;
    const state = {
      ...cardActivity,
      cardRuntime: {
        players: {
          p1: {
            bonusDiceThisTurn: 1,
            controlledDiceValues: [4, 6]
          }
        }
      }
    };
    const result = finishCardActivity(state, () => 0);
    expect(result.diceRolls).toEqual([4, 6]);
    expect(result.state.movementSteps).toBe(10);
    expect(result.state.cardRuntime?.players.p1).toMatchObject({
      bonusDiceThisTurn: 0,
      controlledDiceValues: []
    });
  });

  it("rerolls one selected die and updates the movement total", () => {
    const cardActivity = selectPlayerAction(readyState(), "use_cards").state;
    const state = {
      ...cardActivity,
      cardRuntime: {
        players: {
          p1: { rerollsRemaining: 1 }
        }
      }
    };
    const firstRoll = finishCardActivity(state, () => 0);
    expect(firstRoll.diceRolls).toEqual([1]);

    const rerolled = rerollOneDie(firstRoll.state, firstRoll.diceRolls, 0, () => 0.99);
    expect(rerolled.diceRolls).toEqual([6]);
    expect(rerolled.state.movementSteps).toBe(6);
    expect(rerolled.state.cardRuntime?.players.p1.rerollsRemaining).toBe(0);
    expect(() => rerollOneDie(rerolled.state, rerolled.diceRolls, 0, () => 0)).toThrow(/No die reroll/);
  });

  it("applies cursed die-face reduction when rerolling", () => {
    const cardActivity = selectPlayerAction(readyState(), "use_cards").state;
    const state = {
      ...cardActivity,
      players: cardActivity.players.map((player) => player.id === "p1"
        ? {
            ...player,
            statusEffects: [{ type: "dice_reduction" as const, turnsRemaining: 2, amount: 2, minimum: 1 }]
          }
        : player),
      cardRuntime: {
        players: {
          p1: { rerollsRemaining: 1 }
        }
      }
    };
    const firstRoll = finishCardActivity(state, () => 0.99);
    expect(firstRoll.diceRolls).toEqual([4]);
    const rerolled = rerollOneDie(firstRoll.state, firstRoll.diceRolls, 0, () => 0.99);
    expect(rerolled.diceRolls).toEqual([4]);
  });
});


describe("dice status precedence and controlled die faces", () => {
  it("uses only one die when cursed even if a bonus die is stored", () => {
    const cardActivity = selectPlayerAction(readyState(), "use_cards").state;
    const state = {
      ...cardActivity,
      players: cardActivity.players.map((player) => player.id === "p1"
        ? {
            ...player,
            statusEffects: [{ type: "dice_limit" as const, turnsRemaining: 1, amount: 1 }]
          }
        : player),
      cardRuntime: {
        players: {
          p1: {
            bonusDiceThisTurn: 2,
            controlledDiceValues: [6]
          }
        }
      }
    };
    const result = finishCardActivity(state, () => 0);
    expect(result.diceRolls).toEqual([6]);
    expect(result.state.movementSteps).toBe(6);
  });

  it("applies cursed die-face reduction to values chosen through Control Dice", () => {
    const cardActivity = selectPlayerAction(readyState(), "use_cards").state;
    const state = {
      ...cardActivity,
      players: cardActivity.players.map((player) => player.id === "p1"
        ? {
            ...player,
            statusEffects: [{ type: "dice_reduction" as const, turnsRemaining: 2, amount: 2, minimum: 1 }]
          }
        : player),
      cardRuntime: {
        players: {
          p1: {
            bonusDiceThisTurn: 1,
            controlledDiceValues: [6, 4]
          }
        }
      }
    };
    const result = finishCardActivity(state, () => 0);
    expect(result.diceRolls).toEqual([4, 2]);
    expect(result.state.movementSteps).toBe(6);
  });

  it("supports a maximum of three dice and resets all dice effects at owner turn end", () => {
    const initial = {
      ...readyState(),
      phase: "turn_end" as const,
      cardRuntime: {
        players: {
          p1: {
            bonusDiceThisTurn: 2,
            luckyDiceUsedThisTurn: true,
            rerollsRemaining: 1,
            rerollCardUsedThisTurn: true,
            controlledDiceValues: [4, 5, 6],
            diceControlUsedThisTurn: true
          }
        }
      }
    };
    const ended = endPlayerTurn(initial);
    expect(ended.cardRuntime?.players.p1).toMatchObject({
      bonusDiceThisTurn: 0,
      luckyDiceUsedThisTurn: false,
      rerollsRemaining: 0,
      rerollCardUsedThisTurn: false,
      controlledDiceValues: [],
      diceControlUsedThisTurn: false
    });

    const cardActivity = selectPlayerAction(readyState(), "use_cards").state;
    const maxDiceState = {
      ...cardActivity,
      cardRuntime: {
        players: { p1: { bonusDiceThisTurn: 2 } }
      }
    };
    const result = finishCardActivity(maxDiceState, () => 0);
    expect(result.diceRolls).toEqual([1, 1, 1]);
  });
});


describe("Resurrection during death processing", () => {
  it("consumes a held Resurrection before applying random hand loss when the last heart is lost", () => {
    const state = {
      ...readyState(),
      players: readyState().players.map((player) => player.id === "p1"
        ? {
            ...player,
            hearts: 1,
            hand: ["a", "b", "yellow_resurrection", "c", "d"]
          }
        : player)
    };
    const death = applyPlayerDeath(state, "p1", () => 0);
    expect(death.result).toMatchObject({
      lostHeart: true,
      eliminated: false,
      selfResurrected: true,
      discardedCards: ["a", "b"]
    });
    expect(death.state.players[0]).toMatchObject({
      hp: 20,
      hearts: 1,
      position: 0,
      status: "alive",
      hand: ["c", "d"]
    });
    expect(death.state.players[0].hand).not.toContain("yellow_resurrection");
  });

  it("keeps a held Resurrection card when the player still has hearts remaining", () => {
    const state = {
      ...readyState(),
      players: readyState().players.map((player) => player.id === "p1"
        ? { ...player, hearts: 2, hand: ["yellow_resurrection", "a", "b"] }
        : player)
    };
    const death = applyPlayerDeath(state, "p1", () => 0);
    expect(death.result).toMatchObject({ eliminated: false, selfResurrected: false });
    expect(death.state.players[0].hearts).toBe(1);
    expect(death.state.players[0].hand).toEqual(["yellow_resurrection", "a", "b"]);
  });

  it("still eliminates a player who has no Resurrection card when their last heart is lost", () => {
    const state = {
      ...readyState(),
      players: readyState().players.map((player) => player.id === "p1"
        ? { ...player, hearts: 1, hand: ["a", "b", "c"] }
        : player)
    };
    const death = applyPlayerDeath(state, "p1");
    expect(death.result).toMatchObject({ eliminated: true, selfResurrected: false });
    expect(death.state.players[0].status).toBe("eliminated");
  });
});
