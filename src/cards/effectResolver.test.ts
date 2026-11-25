import { describe, expect, it } from "vitest";
import { createGameState, resolveMonsterAttackPhase, selectPlayerAction, startPlayerTurn } from "../game/turnEngine";
import { resolveCardEffect } from "./effectResolver";

function cardPlayState(teamMate = false) {
  const players = [
    { id: "p1", teamId: teamMate ? "red" : "red", startingHand: ["green_herbal_potion", "green_life_core", "green_extra_heart", "blue_wooden_shield"] },
    { id: "p2", teamId: teamMate ? "red" : "blue", startingHand: ["x", "x", "x", "x"] },
    { id: "p3", teamId: "green", startingHand: ["x", "x", "x", "x"] },
    { id: "p4", teamId: "yellow", startingHand: ["x", "x", "x", "x"] }
  ];
  return selectPlayerAction(
    startPlayerTurn(resolveMonsterAttackPhase(createGameState("1x4", players)).state),
    "use_cards"
  ).state;
}

describe("catalogue card effect resolver foundation", () => {
  it("heals without exceeding maximum HP", () => {
    const state = { ...cardPlayState(), players: cardPlayState().players.map((p, i) => i === 0 ? { ...p, hp: 18 } : p) };
    const result = resolveCardEffect(state, "green_herbal_potion");
    expect(result.state.players[0].hp).toBe(20);
  });

  it("increases maximum HP without silently changing current HP", () => {
    const result = resolveCardEffect(cardPlayState(), "green_life_core");
    expect(result.state.players[0].maxHp).toBe(22);
    expect(result.state.players[0].hp).toBe(20);
  });

  it("caps hearts at the rule maximum of three", () => {
    const state = { ...cardPlayState(), players: cardPlayState().players.map((p, i) => i === 0 ? { ...p, hearts: 3 } : p) };
    expect(resolveCardEffect(state, "green_extra_heart").state.players[0].hearts).toBe(3);
  });

  it("caps shields at three and records them outside the base turn engine", () => {
    const state = { ...cardPlayState(), cardRuntime: { players: { p1: { shields: 2 } } } } as never;
    const result = resolveCardEffect(state, "blue_iron_shield");
    expect(result.state.cardRuntime.players.p1.shields).toBe(3);
  });

  it("ends further card play after Greater Heal", () => {
    const result = resolveCardEffect(cardPlayState(), "green_greater_heal");
    expect(result.endsCardPlay).toBe(true);
    expect(result.state.players[0].cardsPlayedThisTurn).toBe(3);
  });

  it("applies the two-player team shield only to a selected living teammate", () => {
    const result = resolveCardEffect(cardPlayState(true), "blue_double_wall", { targetPlayerId: "p2" });
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
    expect(() => resolveCardEffect(cardPlayState(true), "blue_double_wall")).toThrow(/targetPlayerId/);
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
    const state = { ...cardPlayState(), cardRuntime: { players: { p1: { negativeStatuses: ["sleep", "cursed_dice"] } } } } as never;
    let result = resolveCardEffect(state, "green_holy_water");
    expect(result.state.cardRuntime.players.p1.negativeStatuses).toEqual([]);
    result = resolveCardEffect(result.state, "green_double_blessing");
    expect(result.state.cardRuntime.players.p1.shields).toBe(1);
    expect(result.state.cardRuntime.players.p1.nextAttackDamageBonus).toBe(1);
  });

  it("rejects effects that depend on systems not integrated yet", () => {
    expect(() => resolveCardEffect(cardPlayState(), "blue_common_sword")).toThrow(/not implemented yet/);
  });
});
