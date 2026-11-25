import { describe, expect, it } from "vitest";
import { createGameState, finishCardActivity, resolveMonsterAttackPhase, selectPlayerAction, startPlayerTurn } from "../game/turnEngine";
import { advanceCurseCooldown, rerollOneMovementDie, resolveCardEffect, type CardEffectGameState } from "./effectResolver";

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
        negativeStatuses: [],
        curseCooldownTurnsRemaining: 0,
        curseCooldownUses: 0,
        curseCooldownFresh: false,
        bonusDiceThisTurn: 0,
        bonusDiceGrantedThisTurn: false,
        rerollsRemaining: 0,
        controlledDiceUsedThisTurn: false
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


describe("targeted yellow prank card effects", () => {
  it("returns another player's hand for the view-hand interface without mutating it", () => {
    const state = withPlayer(cardPlayState(), "p2", { hand: ["blue_common_sword", "green_herbal_potion"] });
    const result = resolveCardEffect(state, "yellow_peek", { targetPlayerId: "p2" });
    expect(result.revealedHands).toEqual([{
      playerId: "p2",
      cardIds: ["blue_common_sword", "green_herbal_potion"]
    }]);
    expect(result.state.players[1].hand).toEqual(["blue_common_sword", "green_herbal_potion"]);
    expect(result.appliedToPlayerIds).toContain("p2");
  });

  it("steals one random card and transfers it from the target into the user's hand", () => {
    const state = withPlayer(cardPlayState(), "p2", { hand: ["card-a", "card-b", "card-c"] });
    const result = resolveCardEffect(state, "yellow_pickpocket", {
      targetPlayerId: "p2",
      random: () => 0.5
    });
    expect(result.state.players[0].hand).toContain("card-b");
    expect(result.state.players[1].hand).toEqual(["card-a", "card-c"]);
  });

  it("swaps only the two selected players' board positions", () => {
    let state = withPlayer(cardPlayState(), "p1", { position: 4 });
    state = withPlayer(state, "p2", { position: 21 });
    const result = resolveCardEffect(state, "yellow_swap_places", { targetPlayerId: "p2" });
    expect(result.state.players[0].position).toBe(21);
    expect(result.state.players[1].position).toBe(4);
    expect(result.state.players[2].position).toBe(0);
  });

  it("returns a selected target card for explicit discard-pile handling", () => {
    const state = withPlayer(cardPlayState(), "p2", { hand: ["card-a", "card-b"] });
    const result = resolveCardEffect(state, "yellow_forced_discard", {
      targetPlayerId: "p2",
      selectedCardId: "card-b"
    });
    expect(result.state.players[1].hand).toEqual(["card-a"]);
    expect(result.discardedCardIds).toEqual(["card-b"]);
  });

  it("trades one selected user card for one random target card", () => {
    const state = withPlayer(cardPlayState(), "p2", { hand: ["target-a", "target-b", "target-c"] });
    const result = resolveCardEffect(state, "yellow_card_trade", {
      targetPlayerId: "p2",
      selectedCardId: "green_herbal_potion",
      random: () => 0.5
    });
    expect(result.state.players[0].hand).toContain("target-b");
    expect(result.state.players[0].hand).not.toContain("green_herbal_potion");
    expect(result.state.players[1].hand).toContain("green_herbal_potion");
    expect(result.state.players[1].hand).not.toContain("target-b");
  });

  it("rejects invalid card choices without mutating the input state", () => {
    const state = withPlayer(cardPlayState(), "p2", { hand: ["card-a"] });
    expect(() => resolveCardEffect(state, "yellow_forced_discard", {
      targetPlayerId: "p2",
      selectedCardId: "not-in-hand"
    })).toThrow(/selectedCardId/);
    expect(state.players[1].hand).toEqual(["card-a"]);
  });
});


describe("deck-backed draw card effects", () => {
  it("draws up to the catalogue count from the shared deck", () => {
    const state = withPlayer(cardPlayState(), "p1", { hand: ["held-card"] });
    const deck = { drawPile: ["draw-1", "draw-2", "draw-3"], discardPile: ["discarded"] };
    const result = resolveCardEffect(state, "yellow_card_rain", { deck });
    expect(result.state.players[0].hand).toEqual(["held-card", "draw-1", "draw-2", "draw-3"]);
    expect(result.drawEvents).toEqual([{ playerId: "p1", drawnCardIds: ["draw-1", "draw-2", "draw-3"] }]);
    expect(result.deck).toEqual({ drawPile: [], discardPile: ["discarded"] });
    expect(deck.drawPile).toEqual(["draw-1", "draw-2", "draw-3"]);
  });

  it("draws two for the user, then one for each other living player in seat order", () => {
    const deck = {
      drawPile: ["self-1", "self-2", "p2-card", "p3-card", "p4-card"],
      discardPile: []
    };
    const result = resolveCardEffect(cardPlayState(), "yellow_card_gift", { deck });
    expect(result.drawEvents).toEqual([
      { playerId: "p1", drawnCardIds: ["self-1", "self-2"] },
      { playerId: "p2", drawnCardIds: ["p2-card"] },
      { playerId: "p3", drawnCardIds: ["p3-card"] },
      { playerId: "p4", drawnCardIds: ["p4-card"] }
    ]);
    expect(result.state.players[0].hand.slice(-2)).toEqual(["self-1", "self-2"]);
    expect(result.state.players[1].hand.at(-1)).toBe("p2-card");
    expect(result.state.players[2].hand.at(-1)).toBe("p3-card");
    expect(result.state.players[3].hand.at(-1)).toBe("p4-card");
    expect(result.deck?.drawPile).toEqual([]);
  });

  it("does not draw cards for eliminated players during distribution", () => {
    const state = {
      ...cardPlayState(),
      players: cardPlayState().players.map((player, index) =>
        index === 2 ? { ...player, status: "eliminated" as const } : player
      )
    };
    const result = resolveCardEffect(state, "yellow_card_gift", {
      deck: { drawPile: ["self-1", "self-2", "p2-card", "p4-card"], discardPile: [] }
    });
    expect(result.drawEvents.map((event) => event.playerId)).toEqual(["p1", "p2", "p4"]);
    expect(result.state.players[2].hand).toEqual(["x", "x", "x", "x"]);
  });

  it("requires a deck instead of silently ignoring draw effects", () => {
    expect(() => resolveCardEffect(cardPlayState(), "yellow_card_rain")).toThrow(/deck state/);
  });
});


describe("Curse payment and cooldown", () => {
  it("requires an explicit supported payment for every Curse card", () => {
    expect(() => resolveCardEffect(cardPlayState(), "red_instant_kill", {
      targetPlayerId: "p2"
    })).toThrow(/cursePayment/);
  });

  it("charges the selected 5-to-10 HP cost before resolving the Curse", () => {
    const state = withPlayer(cardPlayState(), "p1", { hp: 12 });
    const result = resolveCardEffect(state, "red_instant_kill", {
      targetPlayerId: "p2",
      cursePayment: { type: "hp", amount: 7 }
    });
    expect(result.state.players[0].hp).toBe(5);
    expect(result.damageEvents[0]).toMatchObject({
      kind: "hp_cost",
      attemptedDamage: 7,
      hpDamage: 7
    });
    expect(result.state.players[1].hearts).toBe(2);
  });

  it("rejects HP payments outside the allowed range or above current HP", () => {
    expect(() => resolveCardEffect(cardPlayState(), "red_instant_kill", {
      targetPlayerId: "p2",
      cursePayment: { type: "hp", amount: 4 }
    })).toThrow(/from 5 to 10/);
    const lowHp = withPlayer(cardPlayState(), "p1", { hp: 5 });
    expect(() => resolveCardEffect(lowHp, "red_instant_kill", {
      targetPlayerId: "p2",
      cursePayment: { type: "hp", amount: 6 }
    })).toThrow(/enough HP/);
  });

  it("discards exactly two selected cards as Curse payment", () => {
    const result = resolveCardEffect(cardPlayState(), "red_instant_kill", {
      targetPlayerId: "p2",
      cursePayment: { type: "discard", cardIds: ["green_herbal_potion", "green_life_core"] }
    });
    expect(result.state.players[0].hand).toEqual(["green_extra_heart", "blue_wooden_shield"]);
    expect(result.discardedCardIds).toEqual(["green_herbal_potion", "green_life_core"]);
  });

  it("allows cooldown only when HP or hand cards are insufficient and advances per owner turn", () => {
    const lowHp = withPlayer(cardPlayState(), "p1", { hp: 4 });
    const result = resolveCardEffect(lowHp, "red_instant_kill", {
      targetPlayerId: "p2",
      cursePayment: { type: "cooldown" }
    });
    expect(result.state.cardRuntime.players.p1.curseCooldownTurnsRemaining).toBe(3);
    expect(result.state.cardRuntime.players.p1.curseCooldownUses).toBe(1);
    const castingTurnEnd = advanceCurseCooldown(result.state, "p1");
    expect(castingTurnEnd.cardRuntime.players.p1.curseCooldownTurnsRemaining).toBe(3);
    const afterThree = advanceCurseCooldown(
      advanceCurseCooldown(
        advanceCurseCooldown(castingTurnEnd, "p1"),
        "p1"
      ),
      "p1"
    );
    expect(afterThree.cardRuntime.players.p1.curseCooldownTurnsRemaining).toBe(0);
  });

  it("rejects cooldown if the user can afford an ordinary Curse payment", () => {
    expect(() => resolveCardEffect(cardPlayState(), "red_instant_kill", {
      targetPlayerId: "p2",
      cursePayment: { type: "cooldown" }
    })).toThrow(/only when HP or hand cards are insufficient/);
  });

  it("limits cooldown payment to three uses per player per game", () => {
    let state = withPlayer(cardPlayState(), "p1", { hp: 4 });
    for (let use = 0; use < 3; use++) {
      const result = resolveCardEffect(state, "red_instant_kill", {
        targetPlayerId: "p2",
        cursePayment: { type: "cooldown" }
      });
      state = result.state;
      state = advanceCurseCooldown(
        advanceCurseCooldown(
          advanceCurseCooldown(
            advanceCurseCooldown(state, "p1"),
            "p1"
          ),
          "p1"
        ),
        "p1"
      );
    }
    expect(state.cardRuntime.players.p1.curseCooldownUses).toBe(3);
    expect(() => resolveCardEffect(state, "red_instant_kill", {
      targetPlayerId: "p2",
      cursePayment: { type: "cooldown" }
    })).toThrow(/three times/);
  });
});

describe("player-targeted Curse effects", () => {
  it("instantly kills a target after their shields are consumed, unless invulnerable", () => {
    const shielded = withRuntime(cardPlayState(), "p2", { shields: 3 });
    const result = resolveCardEffect(shielded, "red_instant_kill", {
      targetPlayerId: "p2",
      cursePayment: { type: "discard", cardIds: ["green_herbal_potion", "green_life_core"] },
      random: () => 0
    });
    expect(result.damageEvents.at(-1)).toMatchObject({
      attemptedDamage: 23,
      shieldAbsorbed: 3,
      hpDamage: 20
    });
    expect(result.state.players[1]).toMatchObject({ hp: 20, hearts: 2, status: "alive" });

    const protectedState = withRuntime(cardPlayState(), "p2", {
      shields: 2,
      invulnerableOwnerTurns: 1
    });
    const protectedResult = resolveCardEffect(protectedState, "red_instant_kill", {
      targetPlayerId: "p2",
      cursePayment: { type: "discard", cardIds: ["green_herbal_potion", "green_life_core"] }
    });
    expect(protectedResult.damageEvents.at(-1)?.preventedBy).toBe("invulnerability");
    expect(protectedResult.state.cardRuntime.players.p2.shields).toBe(2);
    expect(protectedResult.state.players[1].hp).toBe(20);
  });

  it("drains only HP damage that penetrates shields and heals the user by that amount", () => {
    let state = withPlayer(cardPlayState(), "p1", { hp: 15 });
    state = withRuntime(state, "p2", { shields: 1 });
    const result = resolveCardEffect(state, "red_life_drain", {
      targetPlayerId: "p2",
      cursePayment: { type: "discard", cardIds: ["green_herbal_potion", "green_life_core"] }
    });
    expect(result.damageEvents.at(-1)).toMatchObject({ shieldAbsorbed: 1, hpDamage: 3 });
    expect(result.state.players[0].hp).toBe(18);
    expect(result.state.players[1].hp).toBe(17);
  });

  it("halves current HP using floor without consuming shields", () => {
    let state = withPlayer(cardPlayState(), "p2", { hp: 9 });
    state = withRuntime(state, "p2", { shields: 3 });
    const result = resolveCardEffect(state, "red_despair", {
      targetPlayerId: "p2",
      cursePayment: { type: "discard", cardIds: ["green_herbal_potion", "green_life_core"] }
    });
    expect(result.state.players[1].hp).toBe(4);
    expect(result.state.cardRuntime.players.p2.shields).toBe(3);
    expect(result.damageEvents.at(-1)?.kind).toBe("direct_hp_loss");
  });

  it("runs death processing if halving current HP reaches zero", () => {
    const state = withPlayer(cardPlayState(), "p2", { hp: 1 });
    const result = resolveCardEffect(state, "red_despair", {
      targetPlayerId: "p2",
      cursePayment: { type: "discard", cardIds: ["green_herbal_potion", "green_life_core"] },
      random: () => 0
    });
    expect(result.damageEvents.at(-1)?.death).toMatchObject({ lostHeart: true, eliminated: false });
    expect(result.state.players[1]).toMatchObject({ hp: 20, hearts: 2, status: "alive" });
  });

  it("removes all shields from other living players but keeps the user's shields", () => {
    let state = withRuntime(cardPlayState(), "p1", { shields: 3 });
    state = withRuntime(state, "p2", { shields: 2 });
    state = withRuntime(state, "p3", { shields: 1 });
    const result = resolveCardEffect(state, "red_shield_dissolve", {
      cursePayment: { type: "discard", cardIds: ["green_herbal_potion", "green_life_core"] }
    });
    expect(result.state.cardRuntime.players.p1.shields).toBe(3);
    expect(result.state.cardRuntime.players.p2.shields).toBe(0);
    expect(result.state.cardRuntime.players.p3.shields).toBe(0);
  });

  it("swaps current HP values exactly between the user and selected target", () => {
    let state = withPlayer(cardPlayState(), "p1", { hp: 7 });
    state = withPlayer(state, "p2", { hp: 15 });
    const result = resolveCardEffect(state, "red_fate_swap", {
      targetPlayerId: "p2",
      cursePayment: { type: "discard", cardIds: ["green_herbal_potion", "green_life_core"] }
    });
    expect(result.state.players[0].hp).toBe(15);
    expect(result.state.players[1].hp).toBe(7);
  });

  it("sends the selected target to prison for three turns", () => {
    const result = resolveCardEffect(cardPlayState(), "red_forced_prison", {
      targetPlayerId: "p2",
      cursePayment: { type: "discard", cardIds: ["green_herbal_potion", "green_life_core"] }
    });
    expect(result.state.players[1].prisonTurnsRemaining).toBe(3);
  });

  it("resets every other living player's position but not the user", () => {
    let state = withPlayer(cardPlayState(), "p1", { position: 7 });
    state = withPlayer(state, "p2", { position: 12 });
    state = withPlayer(state, "p3", { position: 24 });
    const result = resolveCardEffect(state, "red_table_flip", {
      cursePayment: { type: "discard", cardIds: ["green_herbal_potion", "green_life_core"] }
    });
    expect(result.state.players.map((player) => player.position)).toEqual([7, 0, 0, 0]);
  });
});


describe("timed player status card effects", () => {
  it("applies Sleep Spell as a one-turn skip to the selected target", () => {
    const result = resolveCardEffect(cardPlayState(), "yellow_sleep_spell", { targetPlayerId: "p2" });
    expect(result.state.players[1].statusEffects).toContainEqual({
      type: "skip_turn",
      turnsRemaining: 1
    });
  });

  it("limits the target to one die next turn", () => {
    const result = resolveCardEffect(cardPlayState(), "yellow_cursed_dice", { targetPlayerId: "p2" });
    expect(result.state.players[1].statusEffects).toContainEqual({
      type: "dice_limit",
      turnsRemaining: 1,
      amount: 1
    });
  });

  it("applies Weakness for three turns with the confirmed damage reduction", () => {
    const result = resolveCardEffect(cardPlayState(), "red_weaken", {
      targetPlayerId: "p2",
      cursePayment: { type: "discard", cardIds: ["green_herbal_potion", "green_life_core"] }
    });
    expect(result.state.players[1].statusEffects).toContainEqual({
      type: "attack_damage_reduction",
      turnsRemaining: 3,
      amount: 2
    });
  });

  it("applies Silence, Binding, Reverse Walk, cursed die faces, and hand reveal durations", () => {
    const silence = resolveCardEffect(cardPlayState(), "red_silence", {
      targetPlayerId: "p2",
      cursePayment: { type: "discard", cardIds: ["green_herbal_potion", "green_life_core"] }
    });
    expect(silence.state.players[1].statusEffects).toContainEqual({ type: "cards_silenced", turnsRemaining: 1 });

    const binding = resolveCardEffect(cardPlayState(), "red_binding", {
      targetPlayerId: "p2",
      cursePayment: { type: "discard", cardIds: ["green_herbal_potion", "green_life_core"] }
    });
    expect(binding.state.players[1].statusEffects).toContainEqual({ type: "movement_blocked", turnsRemaining: 2 });

    const reverse = resolveCardEffect(cardPlayState(), "red_reverse_walk", {
      targetPlayerId: "p2",
      cursePayment: { type: "discard", cardIds: ["green_herbal_potion", "green_life_core"] }
    });
    expect(reverse.state.players[1].statusEffects).toContainEqual({ type: "reverse_movement", turnsRemaining: 1 });

    const cursedDice = resolveCardEffect(cardPlayState(), "red_cursed_dice", {
      targetPlayerId: "p2",
      cursePayment: { type: "discard", cardIds: ["green_herbal_potion", "green_life_core"] }
    });
    expect(cursedDice.state.players[1].statusEffects).toContainEqual({
      type: "dice_reduction", turnsRemaining: 2, amount: 2, minimum: 1
    });

    const reveal = resolveCardEffect(cardPlayState(), "red_public_hand", { targetPlayerId: "p2",
      cursePayment: { type: "discard", cardIds: ["green_herbal_potion", "green_life_core"] }
    });
    expect(reveal.state.players[1].statusEffects).toContainEqual({ type: "reveal_hand", turnsRemaining: 3 });
    expect(reveal.revealedHands[0].playerId).toBe("p2");
  });

  it("lets Holy Water remove all timed negative statuses from the user", () => {
    const state = {
      ...cardPlayState(),
      players: cardPlayState().players.map((player, index) => index === 0
        ? {
            ...player,
            statusEffects: [
              { type: "cards_silenced" as const, turnsRemaining: 1 },
              { type: "dice_reduction" as const, turnsRemaining: 2, amount: 2, minimum: 1 }
            ]
          }
        : player)
    };
    const result = resolveCardEffect(state, "green_holy_water");
    expect(result.state.players[0].statusEffects).toEqual([]);
  });
});


describe("timed combat modifiers", () => {
  it("reduces attack card damage by two for three target turns", () => {
    const state = {
      ...cardPlayState(),
      players: cardPlayState().players.map((player, index) => index === 0
        ? {
            ...player,
            statusEffects: [{ type: "attack_damage_reduction" as const, turnsRemaining: 3, amount: 2 }]
          }
        : player)
    };
    const result = resolveCardEffect(state, "blue_common_sword", { targetPlayerId: "p2" });
    expect(result.damageEvents[0].attemptedDamage).toBe(1);
    expect(result.state.players[1].hp).toBe(19);
  });

  it("adds the Power Armor bonus to a defense card's shield gain", () => {
    const powered = resolveCardEffect(cardPlayState(), "green_power_armor");
    const shielded = resolveCardEffect(powered.state, "blue_wooden_shield");
    expect(shielded.state.cardRuntime.players.p1.shields).toBe(2);
    expect(shielded.state.cardRuntime.players.p1.defenseShieldBonus).toBe(1);
  });

  it("does not add the defense-card bonus to a direct shield grant", () => {
    const powered = resolveCardEffect(cardPlayState(), "green_power_armor");
    const shielded = resolveCardEffect(powered.state, "green_double_blessing");
    expect(shielded.state.cardRuntime.players.p1.shields).toBe(1);
  });
});


describe("remaining player-targeted Curse effects", () => {
  it("randomly discards half of a target's hand, rounded up", () => {
    const state = withPlayer(cardPlayState(), "p2", {
      hand: ["hand-1", "hand-2", "hand-3", "hand-4", "hand-5"]
    });
    const result = resolveCardEffect(state, "red_hand_robbery", {
      targetPlayerId: "p2",
      cursePayment: { type: "discard", cardIds: ["green_herbal_potion", "green_life_core"] },
      random: () => 0
    });
    expect(result.discardedCardIds).toEqual(["green_herbal_potion", "green_life_core", "hand-1", "hand-2", "hand-3"]);
    expect(result.state.players[1].hand).toEqual(["hand-4", "hand-5"]);
  });

  it("steals every card from one eliminated player without taking cards from living players", () => {
    let state = withPlayer(cardPlayState(), "p3", {
      status: "eliminated",
      hand: ["grave-1", "grave-2", "grave-3"]
    });
    const result = resolveCardEffect(state, "red_grave_robbery", {
      targetPlayerId: "p3",
      cursePayment: { type: "discard", cardIds: ["green_herbal_potion", "green_life_core"] }
    });
    expect(result.state.players[0].hand).toEqual([
      "green_extra_heart", "blue_wooden_shield", "grave-1", "grave-2", "grave-3"
    ]);
    expect(result.state.players[2].hand).toEqual([]);
    expect(result.state.players[2].status).toBe("eliminated");
  });

  it("requires an eliminated target for Grave Robbery", () => {
    expect(() => resolveCardEffect(cardPlayState(), "red_grave_robbery", {
      targetPlayerId: "p2",
      cursePayment: { type: "discard", cardIds: ["green_herbal_potion", "green_life_core"] }
    })).toThrow(/eliminated/);
  });

  it("removes shields, invulnerability, reflection, and positive combat buffs from the target", () => {
    let state = withRuntime(cardPlayState(), "p2", {
      shields: 3,
      invulnerableOwnerTurns: 2,
      reflectionCharges: 1,
      attackDamageBonus: 2,
      defenseShieldBonus: 1,
      nextAttackDamageBonus: 1
    });
    state = withPlayer(state, "p2", {
      statusEffects: [{ type: "cards_silenced", turnsRemaining: 1 }]
    });
    const result = resolveCardEffect(state, "red_power_wipe", {
      targetPlayerId: "p2",
      cursePayment: { type: "discard", cardIds: ["green_herbal_potion", "green_life_core"] }
    });
    expect(result.state.cardRuntime.players.p2).toMatchObject({
      shields: 0,
      invulnerableOwnerTurns: 0,
      reflectionCharges: 0,
      attackDamageBonus: 0,
      defenseShieldBonus: 0,
      nextAttackDamageBonus: 0
    });
    expect(result.state.players[1].statusEffects).toEqual([
      { type: "cards_silenced", turnsRemaining: 1 }
    ]);
  });

  it("marks every active monster to attack the selected player on its next scheduled attack", () => {
    const state = {
      ...cardPlayState(),
      monsters: [
        {
          id: "fast",
          attackPattern: "all_living" as const,
          attackInterval: 1,
          turnsSinceLastAttack: 1,
          active: true
        },
        {
          id: "slow",
          attackPattern: "random_living" as const,
          attackInterval: 4,
          turnsSinceLastAttack: 0,
          active: true
        }
      ]
    };
    const marked = resolveCardEffect(state, "red_hunt_bait", {
      targetPlayerId: "p2",
      cursePayment: { type: "discard", cardIds: ["green_herbal_potion", "green_life_core"] }
    });
    expect(marked.state.monsters.every((monster) => monster.forcedTargetPlayerId === "p2")).toBe(true);

    const firstAttack = resolveMonsterAttackPhase({
      ...marked.state,
      phase: "monster_attack"
    }, () => 0);
    expect(firstAttack.attacks).toEqual([{
      monsterId: "fast",
      targetPlayerIds: ["p2"],
      reason: "scheduled"
    }]);
    expect(firstAttack.state.monsters.find((monster) => monster.id === "fast")?.forcedTargetPlayerId).toBeUndefined();
    expect(firstAttack.state.monsters.find((monster) => monster.id === "slow")?.forcedTargetPlayerId).toBe("p2");

    const slowMonsterDue = {
      ...firstAttack.state,
      phase: "monster_attack" as const,
      monsters: firstAttack.state.monsters.map((monster) => monster.id === "slow"
        ? { ...monster, turnsSinceLastAttack: monster.attackInterval }
        : monster)
    };
    const secondAttack = resolveMonsterAttackPhase(slowMonsterDue, () => 0);
    expect(secondAttack.attacks).toEqual([{
      monsterId: "slow",
      targetPlayerIds: ["p2"],
      reason: "scheduled"
    }]);
  });

  it("requires at least one active monster before applying Hunt Bait", () => {
    expect(() => resolveCardEffect(cardPlayState(), "red_hunt_bait", {
      targetPlayerId: "p2",
      cursePayment: { type: "discard", cardIds: ["green_herbal_potion", "green_life_core"] }
    })).toThrow(/active monster/);
  });
});


describe("dice card effects", () => {
  it("adds one movement die with Lucky Dice and only allows it once per turn", () => {
    const boosted = resolveCardEffect(cardPlayState(), "yellow_lucky_dice");
    expect(boosted.state.cardRuntime.players.p1.bonusDiceThisTurn).toBe(1);
    expect(() => resolveCardEffect(boosted.state, "yellow_lucky_dice")).toThrow(/once per turn/);

    const movement = finishCardActivity(boosted.state, () => 0.2);
    expect(movement.diceRolls).toEqual([2, 2]);
    expect(movement.state.movementSteps).toBe(4);
    expect(movement.state.cardRuntime?.players.p1.bonusDiceThisTurn).toBe(0);
  });

  it("grants exactly one reroll for Clover and consumes it when used", () => {
    const prepared = resolveCardEffect(cardPlayState(), "green_lucky_clover");
    const movement = finishCardActivity(prepared.state, () => 0);
    expect(movement.diceRolls).toEqual([1]);

    const rerolled = rerollOneMovementDie(movement.state, movement.diceRolls, 0, () => 0.99);
    expect(rerolled.diceRolls).toEqual([6]);
    expect(rerolled.state.movementSteps).toBe(6);
    expect(rerolled.state.cardRuntime.players.p1.rerollsRemaining).toBe(0);
    expect(() => rerollOneMovementDie(rerolled.state, rerolled.diceRolls, 0, () => 0)).toThrow(/No movement die reroll/);
  });

  it("requires a valid die selection for Control Dice and uses those values instead of random rolls", () => {
    const state = cardPlayState();
    const invalid = () => resolveCardEffect(state, "red_dice_control", {
      cursePayment: { type: "discard", cardIds: ["green_herbal_potion", "green_life_core"] },
      controlledDiceValues: [7]
    });
    expect(invalid).toThrow(/one to three selected die values/);

    const controlled = resolveCardEffect(state, "red_dice_control", {
      cursePayment: { type: "discard", cardIds: ["green_herbal_potion", "green_life_core"] },
      controlledDiceValues: [6, 4, 3]
    });
    const movement = finishCardActivity(controlled.state, () => 0);
    expect(movement.diceRolls).toEqual([6, 4, 3]);
    expect(movement.state.movementSteps).toBe(13);
    expect(movement.state.cardRuntime?.players.p1.controlledDiceUsedThisTurn).toBe(true);
    expect(movement.state.cardRuntime?.players.p1.controlledDiceValues).toBeUndefined();
  });
});
