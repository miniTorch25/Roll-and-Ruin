import { describe, expect, it } from "vitest";
import { createGameState, resolveMonsterAttackPhase, selectPlayerAction, startPlayerTurn } from "../game/turnEngine";
import { resolveCardEffect, type CardEffectGameState } from "./effectResolver";

function cardPlayState(mode: "1x4" | "2v2" = "1x4"): CardEffectGameState {
  const teams = mode === "2v2" ? ["red", "red", "blue", "blue"] : ["red", "blue", "green", "yellow"];
  const players = teams.map((teamId, index) => ({
    id: `p${index + 1}`,
    teamId,
    startingHand: index === 0
      ? ["green_herbal_potion", "green_life_core", "green_extra_heart", "blue_wooden_shield"]
      : ["x", "x", "x", "x"]
  }));
  const state = selectPlayerAction(
    startPlayerTurn(resolveMonsterAttackPhase(createGameState(mode, players)).state),
    "use_cards"
  ).state;
  return {
    ...state,
    cardRuntime: {
      players: Object.fromEntries(players.map((player) => [player.id, {
        shields: 0,
        invulnerableOwnerTurns: 0,
        reflectionCharges: 0,
        attackDamageBonus: 0,
        defenseShieldBonus: 0,
        nextAttackDamageBonus: 0,
        blockedAttackCardsThisTurn: false,
        negativeStatuses: []
      }]))
    }
  };
}

function withPlayer(state: CardEffectGameState, playerId: string, patch: Partial<CardEffectGameState["players"][number]>) {
  return {
    ...state,
    players: state.players.map((player) => player.id === playerId ? { ...player, ...patch } : player)
  };
}

function withRuntime(
  state: CardEffectGameState,
  playerId: string,
  patch: Partial<CardEffectGameState["cardRuntime"]["players"][string]>
): CardEffectGameState {
  return {
    ...state,
    cardRuntime: {
      ...state.cardRuntime,
      players: {
        ...state.cardRuntime.players,
        [playerId]: { ...state.cardRuntime.players[playerId], ...patch }
      }
    }
  };
}

describe("player attack card effects", () => {
  it("absorbs damage with shield before reducing HP", () => {
    const state = withRuntime(cardPlayState(), "p2", { shields: 2 });
    const result = resolveCardEffect(state, "blue_common_sword", { targetPlayerId: "p2" });
    expect(result.damageEvents[0]).toMatchObject({ attemptedDamage: 3, shieldAbsorbed: 2, hpDamage: 1 });
    expect(result.state.players[1].hp).toBe(19);
    expect(result.state.cardRuntime.players.p2.shields).toBe(0);
  });

  it("pierces shields without consuming them", () => {
    const state = withRuntime(cardPlayState(), "p2", { shields: 3 });
    const result = resolveCardEffect(state, "blue_accurate_arrow", { targetPlayerId: "p2" });
    expect(result.damageEvents[0]).toMatchObject({ attemptedDamage: 2, shieldAbsorbed: 0, hpDamage: 2 });
    expect(result.state.players[1].hp).toBe(18);
    expect(result.state.cardRuntime.players.p2.shields).toBe(3);
  });

  it("removes all target shields before applying axe damage", () => {
    const state = withRuntime(cardPlayState(), "p2", { shields: 3 });
    const result = resolveCardEffect(state, "blue_armor_breaking_axe", { targetPlayerId: "p2" });
    expect(result.damageEvents[0]).toMatchObject({ attemptedDamage: 3, shieldAbsorbed: 0, hpDamage: 3 });
    expect(result.state.cardRuntime.players.p2.shields).toBe(0);
    expect(result.state.players[1].hp).toBe(17);
  });

  it("prevents ordinary damage while invulnerable and keeps reflection available", () => {
    const state = withRuntime(cardPlayState(), "p2", { invulnerableOwnerTurns: 2, reflectionCharges: 1 });
    const result = resolveCardEffect(state, "blue_common_sword", { targetPlayerId: "p2" });
    expect(result.damageEvents[0].preventedBy).toBe("invulnerability");
    expect(result.state.players[1].hp).toBe(20);
    expect(result.state.cardRuntime.players.p2.reflectionCharges).toBe(1);
  });

  it("reflects HP damage back to the attacker once without creating a reflection loop", () => {
    let state = withRuntime(cardPlayState(), "p2", { shields: 1, reflectionCharges: 1 });
    state = withPlayer(state, "p1", { hp: 15 });
    const result = resolveCardEffect(state, "blue_common_sword", { targetPlayerId: "p2" });
    expect(result.damageEvents[0]).toMatchObject({ shieldAbsorbed: 1, hpDamage: 2 });
    expect(result.damageEvents[0].reflection).toMatchObject({
      kind: "reflection",
      sourcePlayerId: "p2",
      targetPlayerId: "p1",
      hpDamage: 2
    });
    expect(result.state.players[0].hp).toBe(13);
    expect(result.state.cardRuntime.players.p2.reflectionCharges).toBe(0);
  });

  it("damages every other living player but never the card user", () => {
    const result = resolveCardEffect(cardPlayState(), "blue_thunderclap");
    expect(result.appliedToPlayerIds).toEqual(["p1", "p2", "p3", "p4"]);
    expect(result.state.players.map((player) => player.hp)).toEqual([20, 18, 18, 18]);
  });

  it("uses conditional damage based on target HP before the attack", () => {
    const weakerTarget = withPlayer(cardPlayState(), "p2", { hp: 19 });
    const strongerTarget = withPlayer(cardPlayState(), "p2", { hp: 20 });
    const strongerHit = resolveCardEffect(weakerTarget, "blue_counter_punch", { targetPlayerId: "p2" });
    const normalHit = resolveCardEffect(strongerTarget, "blue_counter_punch", { targetPlayerId: "p2" });
    expect(strongerHit.damageEvents[0].attemptedDamage).toBe(4);
    expect(normalHit.damageEvents[0].attemptedDamage).toBe(2);
  });

  it("applies attack buffs and consumes the next-attack bonus exactly once", () => {
    const state = withRuntime(cardPlayState(), "p1", { attackDamageBonus: 2, nextAttackDamageBonus: 1 });
    const result = resolveCardEffect(state, "blue_common_sword", { targetPlayerId: "p2" });
    expect(result.damageEvents[0].attemptedDamage).toBe(6);
    expect(result.state.cardRuntime.players.p1.nextAttackDamageBonus).toBe(0);
    expect(result.state.cardRuntime.players.p1.attackDamageBonus).toBe(2);
  });

  it("applies Double-Edged Sword self-HP cost separately from shields", () => {
    const state = withPlayer(cardPlayState(), "p1", { hp: 10 });
    const result = resolveCardEffect(state, "blue_double_edged_sword", { targetPlayerId: "p2" });
    expect(result.state.players[1].hp).toBe(14);
    expect(result.state.players[0].hp).toBe(8);
    expect(result.damageEvents[1]).toMatchObject({ kind: "hp_cost", attemptedDamage: 2, hpDamage: 2 });
  });

  it("runs the normal death/respawn flow when an attack reduces HP to zero", () => {
    const state = withPlayer(cardPlayState(), "p2", { hp: 2, position: 12 });
    const result = resolveCardEffect(state, "blue_common_sword", {
      targetPlayerId: "p2",
      random: () => 0
    });
    expect(result.damageEvents[0].death).toMatchObject({
      lostHeart: true,
      eliminated: false,
      discardedCards: ["x", "x"]
    });
    expect(result.state.players[1]).toMatchObject({
      hp: 20,
      hearts: 2,
      position: 0,
      status: "alive"
    });
    expect(result.state.players[1].hand).toHaveLength(2);
  });
});

describe("catalogue card effect resolver foundation", () => {
  it("heals without exceeding maximum HP", () => {
    const state = withPlayer(cardPlayState(), "p1", { hp: 18 });
    const result = resolveCardEffect(state, "green_herbal_potion");
    expect(result.state.players[0].hp).toBe(20);
  });

  it("increases maximum HP without silently changing current HP", () => {
    const result = resolveCardEffect(cardPlayState(), "green_life_core");
    expect(result.state.players[0].maxHp).toBe(22);
    expect(result.state.players[0].hp).toBe(20);
  });

  it("caps hearts at the rule maximum of three", () => {
    const result = resolveCardEffect(cardPlayState(), "green_extra_heart");
    expect(result.state.players[0].hearts).toBe(3);
  });

  it("caps shields at three and records them outside the base turn engine", () => {
    const state = withRuntime(cardPlayState(), "p1", { shields: 2 });
    const result = resolveCardEffect(state, "blue_iron_shield");
    expect(result.state.cardRuntime.players.p1.shields).toBe(3);
  });

  it("ends further card play after Greater Heal", () => {
    const result = resolveCardEffect(cardPlayState(), "green_greater_heal");
    expect(result.endsCardPlay).toBe(true);
    expect(result.state.players[0].cardsPlayedThisTurn).toBe(3);
  });

  it("applies the two-player team shield only to a selected living teammate", () => {
    const result = resolveCardEffect(cardPlayState("2v2"), "blue_double_wall", { targetPlayerId: "p2" });
    expect(result.state.cardRuntime.players.p1.shields).toBe(1);
    expect(result.state.cardRuntime.players.p2.shields).toBe(1);
    expect(result.appliedToPlayerIds).toEqual(["p1", "p2"]);
  });

  it("gives the full team shield to the user when no living teammate exists", () => {
    const state = { ...cardPlayState(), players: cardPlayState().players.map((p, i) => i === 0 ? p : { ...p, status: "eliminated" as const }) };
    const result = resolveCardEffect(state, "blue_double_wall");
    expect(result.state.cardRuntime.players.p1.shields).toBe(2);
  });

  it("requires a teammate selection when a living teammate exists", () => {
    expect(() => resolveCardEffect(cardPlayState("2v2"), "blue_double_wall")).toThrow(/targetPlayerId/);
  });

  it("records temporary defensive and offensive effects", () => {
    let result = resolveCardEffect(cardPlayState(), "green_immortal_blessing");
    expect(result.state.cardRuntime.players.p1.invulnerableOwnerTurns).toBe(3);
    result = resolveCardEffect(result.state, "green_reflection_mirror");
    expect(result.state.cardRuntime.players.p1.reflectionCharges).toBe(1);
    result = resolveCardEffect(result.state, "green_brave_spirit");
    expect(result.state.cardRuntime.players.p1.attackDamageBonus).toBe(2);
    result = resolveCardEffect(result.state, "green_power_armor");
    expect(result.state.cardRuntime.players.p1.defenseShieldBonus).toBe(1);
  });

  it("cleanses tracked negative statuses and grants the double blessing", () => {
    const state = withRuntime(cardPlayState(), "p1", { negativeStatuses: ["sleep", "cursed_dice"] });
    let result = resolveCardEffect(state, "green_holy_water");
    expect(result.state.cardRuntime.players.p1.negativeStatuses).toEqual([]);
    result = resolveCardEffect(result.state, "green_double_blessing");
    expect(result.state.cardRuntime.players.p1.shields).toBe(1);
    expect(result.state.cardRuntime.players.p1.nextAttackDamageBonus).toBe(1);
  });

  it("rejects effects that depend on systems not integrated yet", () => {
    expect(() => resolveCardEffect(cardPlayState(), "blue_monster_hunter")).toThrow(/not implemented yet/);
  });
});
