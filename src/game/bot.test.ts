import { describe, expect, it } from "vitest";
import { chooseBotAction, chooseBotCards, chooseBotCardTargets, chooseBotCursePayment, chooseBotDiceValues, chooseBotKingoOffering, chooseBotLegendOffering, chooseBotMythOffering, chooseBotSelectedCardId } from "./bot";
import { createGameState } from "./turnEngine";
import { CARD_CATALOGUE } from "../cards/catalogue";
import { createBoardState, type BoardTile } from "./board";

function stateWithHand(hand: string[], overrides: Partial<{ hp: number; maxHp: number; hearts: number; statuses: Array<{ type: "poison" | "bonus_dice"; turnsRemaining: number }> }> = {}) {
  const setup = Array.from({ length: 4 }, (_, index) => ({
    id: `p${index + 1}`,
    teamId: `team-${index + 1}`,
    startingHand: index === 0
      ? [...hand, ...Array.from({ length: Math.max(0, 4 - hand.length) }, (_, filler) => `filler-${filler}`)]
      : ["filler-a", "filler-b", "filler-c", "filler-d"]
  }));
  const state = createGameState("1x4", setup);
  return {
    ...state,
    phase: "choose_action" as const,
    players: state.players.map((player, index) => index === 0 ? {
      ...player,
      hp: overrides.hp ?? player.hp,
      maxHp: overrides.maxHp ?? player.maxHp,
      hearts: overrides.hearts ?? player.hearts,
      statusEffects: (overrides.statuses ?? []).map(effect => ({ ...effect }))
    } : player)
  };
}

describe("chooseBotAction", () => {
  it("draws when the bot has fewer than three cards", () => {
    expect(chooseBotAction({ hand: ["a", "b"] })).toBe("draw_two_roll_one");
    expect(chooseBotAction({ hand: [] })).toBe("draw_two_roll_one");
  });

  it("prioritizes movement when the bot has enough cards", () => {
    expect(chooseBotAction({ hand: ["a", "b", "c"] })).toBe("roll_two_dice");
    expect(chooseBotAction({ hand: ["a", "b", "c", "d"] })).toBe("roll_two_dice");
  });
});

describe("chooseBotCards", () => {
  it("uses healing when the bot has a meaningful HP deficit", () => {
    expect(chooseBotCards(stateWithHand(["green_herbal_potion"], { hp: 10 })))
      .toContain("green_herbal_potion");
  });

  it("saves healing when the bot is already near full HP", () => {
    expect(chooseBotCards(stateWithHand(["green_herbal_potion"], { hp: 19 }))).toEqual([]);
  });

  it("uses a heart card only when a heart has been lost", () => {
    expect(chooseBotCards(stateWithHand(["green_extra_heart"], { hearts: 2 })))
      .toContain("green_extra_heart");
    expect(chooseBotCards(stateWithHand(["green_extra_heart"], { hearts: 3 }))).toEqual([]);
  });

  it("cleanses an active negative status", () => {
    expect(chooseBotCards(stateWithHand(["green_holy_water"], {
      statuses: [{ type: "poison", turnsRemaining: 2 }]
    }))).toContain("green_holy_water");
  });

  it("selects a targeted attack and chooses a vulnerable opponent", () => {
    const state = stateWithHand(["blue_common_sword"]);
    const changed = {
      ...state,
      players: state.players.map((player, index) => index === 1
        ? { ...player, hp: 5, hearts: 1 }
        : player)
    };
    expect(chooseBotCards(changed)).toContain("blue_common_sword");
    expect(chooseBotCardTargets(changed, "blue_common_sword").targetPlayerId).toBe("p2");
  });

  it("selects Monster Hunter only when a finite-HP monster is active", () => {
    const state = stateWithHand(["blue_monster_hunter"]);
    const withMonster = {
      ...state,
      monsters: [{ id: "m1", rank: "Common" as const, hp: 4, maxHp: 4, attackPattern: "random_living" as const, attackInterval: 2, turnsSinceLastAttack: 0, active: true }]
    };
    expect(chooseBotCards(withMonster)).toContain("blue_monster_hunter");
    expect(chooseBotCardTargets(withMonster, "blue_monster_hunter").targetMonsterId).toBe("m1");
  });

  it("uses an affordable Curse and selects a vulnerable opponent", () => {
    const state = stateWithHand(["red_instant_kill"]);
    const changed = {
      ...state,
      players: state.players.map((player, index) => index === 1
        ? { ...player, hp: 4, hearts: 1 }
        : player)
    };
    expect(chooseBotCards(changed)).toContain("red_instant_kill");
    expect(chooseBotCardTargets(changed, "red_instant_kill").targetPlayerId).toBe("p2");
  });

  it("chooses HP, discard, or cooldown Curse payment according to available resources", () => {
    const healthy = stateWithHand(["red_instant_kill"], { hp: 18 });
    expect(chooseBotCursePayment(healthy, "p1")).toEqual({ type: "hp", amount: 5 });

    const lowHp = stateWithHand(["red_instant_kill"], { hp: 4 });
    const withDiscardCards = {
      ...lowHp,
      players: lowHp.players.map((player, index) => index === 0
        ? { ...player, hand: ["green_herbal_potion", "blue_wooden_shield"] }
        : player)
    };
    expect(chooseBotCursePayment(withDiscardCards, "p1")).toEqual({
      type: "discard",
      cardIds: ["green_herbal_potion", "blue_wooden_shield"]
    });

    const cooldownState = {
      ...lowHp,
      players: lowHp.players.map((player, index) => index === 0
        ? { ...player, hand: [] }
        : player)
    };
    expect(chooseBotCursePayment(cooldownState, "p1")).toEqual({ type: "cooldown" });
  });

  it("uses summon cards only when the board and rank limits allow it", () => {
    expect(chooseBotCards(stateWithHand(["red_summon_common"]))).toContain("red_summon_common");
    const fullBoard = { ...stateWithHand(["red_summon_common"]), monsters: Array.from({ length: 5 }, (_, index) => ({
      id: `m${index}`, rank: "Common" as const, hp: 5, maxHp: 5,
      attackPattern: "random_living" as const, attackInterval: 2, turnsSinceLastAttack: 0, active: true
    })) };
    expect(chooseBotCards(fullBoard)).toEqual([]);
  });

  it("selects cards for manual discard and trade effects", () => {
    const state = stateWithHand(["yellow_card_trade", "yellow_forced_discard", "green_herbal_potion"]);
    const targetState = { ...state, players: state.players.map((player, index) => index === 0
      ? { ...player, hand: ["green_herbal_potion", "blue_common_sword"] }
      : index === 1 ? { ...player, hand: ["blue_common_sword", "red_instant_kill"] } : player) };
    expect(chooseBotSelectedCardId(targetState, "force_discard_selected_card", "p2")).toBe("red_instant_kill");
    expect(chooseBotSelectedCardId(targetState, "trade_for_random_card", "p2")).toBe("blue_common_sword");
  });

  it("chooses the maximum legal dice values for Control Dice", () => {
    const state = stateWithHand(["red_dice_control"]);
    expect(chooseBotDiceValues(state, "p1")).toEqual([6]);
    const withBonus = { ...state, cardRuntime: { players: { p1: {
      shields: 0, invulnerableOwnerTurns: 0, reflectionCharges: 0, attackDamageBonus: 0,
      defenseShieldBonus: 0, nextAttackDamageBonus: 0, blockedAttackCardsThisTurn: false,
      negativeStatuses: [], curseCooldownTurnsRemaining: 0, curseCooldownUses: 0, curseCooldownFresh: false,
      bonusDiceThisTurn: 2, luckyDiceUsedThisTurn: false, rerollsRemaining: 0, rerollCardUsedThisTurn: false,
      controlledDiceValues: [], diceControlUsedThisTurn: false
    } } } };
    expect(chooseBotDiceValues(withBonus, "p1")).toEqual([6, 6, 6]);
  });

  it("uses support buffs when they can improve a card still in hand", () => {
    expect(chooseBotCards(stateWithHand(["green_brave_spirit", "blue_common_sword"]))).toContain("green_brave_spirit");
    expect(chooseBotCards(stateWithHand(["green_power_armor", "blue_wooden_shield"]))).toContain("green_power_armor");
    expect(chooseBotCards(stateWithHand(["green_double_blessing"]))).toContain("green_double_blessing");
  });

  it("uses shields only when capacity remains and selects a living teammate", () => {
    const state = stateWithHand(["blue_wooden_shield", "blue_double_wall"]);
    const teamState = { ...state, players: state.players.map((player, index) => index < 2 ? { ...player, teamId: "shared-team" } : player) };
    expect(chooseBotCards(teamState)).toEqual(expect.arrayContaining(["blue_wooden_shield", "blue_double_wall"]));
    expect(chooseBotCardTargets(teamState, "blue_double_wall").targetPlayerId).toBe("p2");
    const capped = { ...teamState, cardRuntime: { players: { p1: { shields: 3 }, p2: { shields: 3 } } } as never };
    expect(chooseBotCards(capped)).toEqual([]);
  });

  it("uses area damage and distributed draws only when useful recipients exist", () => {
    expect(chooseBotCards(stateWithHand(["blue_thunderclap"]))).toContain("blue_thunderclap");
    const giftState = stateWithHand(["yellow_card_gift"]);
    const lowHandGift = { ...giftState, players: giftState.players.map((player, index) =>
      index === 0 ? { ...player, hand: ["yellow_card_gift"] } : player
    ) };
    expect(chooseBotCards(lowHandGift)).toContain("yellow_card_gift");
    const base = stateWithHand(["blue_thunderclap"]);
    const solo = { ...base, players: base.players.map((player, index) => index === 0 ? player : { ...player, status: "eliminated" as const }) };
    expect(chooseBotCards(solo)).toEqual([]);
  });

  it("uses Magic Shortcut only when the nearest special tile is useful and sufficiently far away", () => {
    const state = stateWithHand(["yellow_magic_shortcut"]);
    const generated = createBoardState({ mystery: 0, monster: 0, dice: 0 }, [], () => 0);
    const usefulTiles: BoardTile[] = generated.tiles.map(tile => ({ position: tile.position }));
    usefulTiles[5] = { position: 5, special: "mystery" };
    expect(chooseBotCards(state, Math.random, { ...generated, tiles: usefulTiles })).toEqual(["yellow_magic_shortcut"]);

    const prisonTiles: BoardTile[] = generated.tiles.map(tile => ({ position: tile.position }));
    prisonTiles[5] = { position: 5, special: "prison" };
    expect(chooseBotCards(state, Math.random, { ...generated, tiles: prisonTiles })).toEqual([]);

    const nearTiles: BoardTile[] = generated.tiles.map(tile => ({ position: tile.position }));
    nearTiles[2] = { position: 2, special: "dice" };
    expect(chooseBotCards(state, Math.random, { ...generated, tiles: nearTiles })).toEqual([]);
  });

  it("selects the newly covered targeted Curse effects without exceeding one Curse per turn", () => {
    const diceCurse = stateWithHand(["red_cursed_dice"]);
    const revealCurse = stateWithHand(["red_public_hand"]);
    expect(chooseBotCards(diceCurse)).toContain("red_cursed_dice");
    expect(chooseBotCards(revealCurse)).toContain("red_public_hand");
    expect(chooseBotCardTargets(diceCurse, "red_cursed_dice").targetPlayerId).toBe("p2");
    expect(chooseBotCardTargets(revealCurse, "red_public_hand").targetPlayerId).toBe("p2");
  });

  it("does not select targeted cards when no legal target exists", () => {
    const state = stateWithHand(["blue_common_sword", "red_instant_kill", "yellow_sleep_spell"]);
    const solo = { ...state, players: state.players.map((player, index) => index === 0 ? player : { ...player, status: "eliminated" as const }) };
    expect(chooseBotCards(solo)).toEqual([]);
  });
});

describe("bot monster offerings", () => {
  it("selects the exact card types required by a Legend offering", () => {
    const state = stateWithHand(["yellow_peek", "yellow_sleep_spell", "blue_common_sword", "green_herbal_potion"]);
    const legend = { ...state, monsters: [{ id: "l02", catalogueId: "L02", name: "Sphinxy", rank: "Legend" as const, hp: null, maxHp: null, attackPattern: "random_living" as const, attackInterval: null, turnsSinceLastAttack: 0, active: true }] };
    const offering = chooseBotLegendOffering(legend, "l02");
    expect(offering?.cardIds).toHaveLength(2);
    expect(offering?.cardIds.every(id => CARD_CATALOGUE.find(card => card.id === id)?.color === "yellow")).toBe(true);
  });
  it("contributes only the remaining number of cards to Ragnar", () => {
    const state = stateWithHand(["yellow_peek", "blue_common_sword", "green_herbal_potion", "blue_wooden_shield"]);
    const myth = { ...state, monsters: [{ id: "m06", catalogueId: "M06", name: "Ragnar", rank: "Myth" as const, hp: 99999, maxHp: 99999, attackPattern: "all_living" as const, attackInterval: 2, turnsSinceLastAttack: 0, active: true }],
      mythRuntime: { monsterId: "m06", catalogueId: "M06", offerings: { p2: ["blue_common_sword", "green_herbal_potion", "yellow_peek", "blue_wooden_shield", "green_life_core", "blue_iron_shield", "yellow_card_rain", "green_extra_heart"] } } };
    expect(chooseBotMythOffering(myth, "m06")).toHaveLength(2);
  });
  it("offers three yellow cards to Hecate and every yellow card to Granfel", () => {
    const hecateState = stateWithHand(["yellow_peek", "yellow_sleep_spell", "yellow_lucky_dice", "blue_common_sword"]);
    const hecate = { ...hecateState,
      monsters: [{ id: "hecate", catalogueId: "M01", name: "Hecate", rank: "Myth" as const,
        hp: 10000, maxHp: 10000, attackPattern: "all_living" as const, attackInterval: null,
        turnsSinceLastAttack: 0, active: true }],
      mythRuntime: { monsterId: "hecate", catalogueId: "M01", offerings: {}, hiddenHands: false }
    };
    expect(chooseBotMythOffering(hecate, "hecate")).toHaveLength(3);
    const insufficient = { ...hecate, players: hecate.players.map((player, index) =>
      index === 0 ? { ...player, hand: ["yellow_peek", "yellow_sleep_spell"] } : player
    ) };
    expect(chooseBotMythOffering(insufficient, "hecate")).toEqual([]);
    const granfel = { ...hecate, monsters: [{ ...hecate.monsters[0], id: "granfel", catalogueId: "M02" }],
      mythRuntime: { ...hecate.mythRuntime, monsterId: "granfel", catalogueId: "M02" } };
    expect(chooseBotMythOffering(granfel, "granfel")).toHaveLength(3);
  });

  it("uses one random hand card while Nyxia hides card identities", () => {
    const state = stateWithHand(["green_herbal_potion", "yellow_peek", "blue_common_sword", "green_brave_spirit"]);
    const nyxia = { ...state, mythRuntime: { monsterId: "nyxia", catalogueId: "M05", hiddenHands: true },
      monsters: [{ id: "nyxia", catalogueId: "M05", name: "Nyxia", rank: "Myth" as const,
        hp: null, maxHp: null, attackPattern: "all_living" as const, attackInterval: null,
        turnsSinceLastAttack: 0, active: true }] };
    expect(chooseBotCards(nyxia, () => 0)).toEqual(["green_herbal_potion"]);
    expect(chooseBotCards(nyxia, () => 0.99)).toEqual(["green_brave_spirit"]);
  });

  it("plans Kingo's five-card tribute using bots only and balances contributions", () => {
    const state = stateWithHand(["green_herbal_potion", "green_life_core"]);
    const kingo = { ...state,
      players: state.players.map((player, index) => ({
        ...player,
        isBot: index !== 3,
        hand: index === 0 ? ["green_herbal_potion", "green_life_core"]
          : index === 1 ? ["blue_wooden_shield"]
          : index === 2 ? ["yellow_peek", "red_summon_common"]
          : ["red_instant_kill", "blue_common_sword"]
      })),
      monsters: [{ id: "kingo", catalogueId: "L10", name: "Kingo", rank: "Legend" as const,
        hp: 220, maxHp: 220, attackPattern: "random_living" as const, attackInterval: 5,
        turnsSinceLastAttack: 0, active: true }]
    };
    const contributions = chooseBotKingoOffering(kingo, "kingo");
    expect(contributions?.flatMap(item => item.cardIds)).toHaveLength(5);
    expect(contributions?.some(item => item.playerId === "p4")).toBe(false);
    expect(chooseBotKingoOffering({ ...kingo, players: kingo.players.map(player =>
      player.id === "p1" ? { ...player, hand: ["green_herbal_potion"] } :
      player.id === "p2" ? { ...player, isBot: false } :
      player.id === "p3" ? { ...player, isBot: false } : player
    ) }, "kingo")).toBeUndefined();
  });

  it("offers only colors Ouro still needs", () => {
    const state = stateWithHand(["yellow_peek", "blue_common_sword", "green_herbal_potion", "red_instant_kill"]);
    const myth = { ...state, monsters: [{ id: "m08", catalogueId: "M08", name: "Ouro", rank: "Myth" as const, hp: null, maxHp: null, attackPattern: "all_living" as const, attackInterval: 1, turnsSinceLastAttack: 0, active: true }],
      mythRuntime: { monsterId: "m08", catalogueId: "M08", offerings: { p2: ["yellow_peek", "red_instant_kill"] } } };
    const cards = chooseBotMythOffering(myth, "m08");
    expect(cards.map(id => CARD_CATALOGUE.find(card => card.id === id)?.color).sort()).toEqual(["blue", "green"]);
  });
});
