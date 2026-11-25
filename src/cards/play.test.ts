import { describe, expect, it } from "vitest";
import { createGameState, resolveMonsterAttackPhase, startPlayerTurn, selectPlayerAction } from "../game/turnEngine";
import { playCatalogueCard } from "./play";

function stateWithCards(cardIds: string[]) {
  const setup = [
    { id: "p1", teamId: "red", startingHand: cardIds },
    { id: "p2", teamId: "blue", startingHand: ["x", "x", "x", "x"] },
    { id: "p3", teamId: "green", startingHand: ["x", "x", "x", "x"] },
    { id: "p4", teamId: "yellow", startingHand: ["x", "x", "x", "x"] }
  ];
  return startPlayerTurn(resolveMonsterAttackPhase(createGameState("1x4", setup)).state);
}

describe("catalogue card play", () => {
  it("removes a real card, returns its effect definition, and adds its score", () => {
    const initial = stateWithCards([
      "blue_common_sword", "yellow_peek", "red_summon_common", "red_instant_kill"
    ]);
    const ready = selectPlayerAction(initial, "use_cards").state;
    const played = playCatalogueCard(ready, "blue_common_sword");
    expect(played.playedCardId).toBe("blue_common_sword");
    expect(played.card.effectId).toBe("damage_single");
    expect(played.state.players[0].hand).toEqual([
      "yellow_peek", "red_summon_common", "red_instant_kill"
    ]);
    expect(played.state.players[0].score).toBe(1);
    expect(played.state.players[0].cardsPlayedThisTurn).toBe(1);
  });

  it("applies the distinct confirmed score values for Prank, Summon, and Curse cards", () => {
    let state = selectPlayerAction(stateWithCards([
      "yellow_peek", "red_summon_common", "red_instant_kill", "blue_common_sword"
    ]), "use_cards").state;
    state = playCatalogueCard(state, "yellow_peek").state;
    expect(state.players[0].score).toBe(0);
    state = playCatalogueCard(state, "red_summon_common").state;
    expect(state.players[0].score).toBe(-2);
    state = playCatalogueCard(state, "red_instant_kill").state;
    expect(state.players[0].score).toBe(-6);
  });

  it("does not automatically discard the used card", () => {
    const initial = selectPlayerAction(stateWithCards([
      "blue_common_sword", "yellow_peek", "red_summon_common", "red_instant_kill"
    ]), "use_cards").state;
    const played = playCatalogueCard(initial, "blue_common_sword");
    expect(played.state.players[0].hand).not.toContain("blue_common_sword");
    expect(played.playedCardId).toBe("blue_common_sword");
  });

  it("rejects unknown catalogue IDs", () => {
    const initial = selectPlayerAction(stateWithCards([
      "blue_common_sword", "yellow_peek", "red_summon_common", "red_instant_kill"
    ]), "use_cards").state;
    expect(() => playCatalogueCard(initial, "not-a-real-card")).toThrow(/Unknown card ID/);
  });
});
