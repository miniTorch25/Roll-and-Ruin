import { summonMonster, type GameMonster, type GameState, type MonsterAttackEvent } from "../game/turnEngine";
import type { CardDeckState } from "../cards/deck";
import { summonMyth, type MythId } from "./myth";
import { getRandomMonsterByRank, MONSTER_CATALOGUE, type MonsterRank } from "./catalogue";

export interface MonsterDamageEvent {
  monsterId: string;
  sourcePlayerId?: string;
  attemptedDamage: number;
  hpBefore: number | null;
  hpAfter: number | null;
  hpDamage: number;
  defeated: boolean;
  preventedBy?: "infinite_hp" | "attack_below_threshold" | "cannot_be_defeated_by_damage";
  /** Additional green-card reward Chesty grants when defeated. */
  bonusReward?: { greenCards: number };
  /** Damage reflected to the attacking player by a Legend monster. */
  reflectedDamage?: number;
  /** True when Fenny consumed its one revival instead of being defeated. */
  revived?: boolean;
  /** True when Webby's Attack-card defeat rule suppresses its normal reward. */
  rewardSuppressed?: boolean;
  /** Cards returned to their original owners when Sneaky is defeated. */
  returnedCards?: Array<{ ownerPlayerId: string; cardId: string }>;
}

export interface CatalogueSummonResult {
  state: GameState;
  monster: GameMonster;
  attack: MonsterAttackEvent;
}

export interface FullCatalogueSummonResult {
  state: GameState;
  monster: GameMonster;
  attack?: MonsterAttackEvent;
  deck?: CardDeckState;
  messages?: string[];
}

/** Selects uniformly from all 50 entries and routes Myth summons through their full rules engine. */
export function summonRandomMonsterFromCatalogue(
  state: GameState,
  instanceId: string,
  deck: CardDeckState,
  random: () => number = Math.random
): FullCatalogueSummonResult {
  if (!instanceId.trim()) throw new Error("A unique monster instance ID is required.");
  const index = Math.min(MONSTER_CATALOGUE.length - 1, Math.max(0, Math.floor(random() * MONSTER_CATALOGUE.length)));
  const definition = MONSTER_CATALOGUE[index];

  if (definition.rank === "Myth") {
    const myth = summonMyth(state, definition.id as MythId, instanceId, deck, random);
    const monster = myth.state.monsters.find(item => item.id === instanceId);
    if (!monster) throw new Error("The summoned Myth monster was not added to the game state.");
    return { state: myth.state, monster, attack: myth.attack, deck: myth.deck, messages: myth.messages };
  }

  const triggerPosition = definition.id === "R09"
    ? [0, 8, 16, 24][Math.min(3, Math.max(0, Math.floor(random() * 4)))]
    : undefined;
  const monster: Omit<GameMonster, "turnsSinceLastAttack" | "active"> = {
    id: instanceId,
    catalogueId: definition.id,
    ...(triggerPosition === undefined ? {} : { triggerPosition }),
    name: definition.name,
    rank: definition.rank,
    hp: definition.hp,
    maxHp: definition.hp,
    attackDamage: definition.attackDamage,
    attackPattern: definition.attackPattern,
    attackInterval: definition.attackInterval,
    targetCount: definition.targetCount,
    rules: [...definition.rules],
    reward: definition.reward,
    info: definition.info
  };
  const summoned = summonMonster(state, monster);
  const created = summoned.state.monsters.find(item => item.id === instanceId);
  if (!created) throw new Error("The summoned monster was not added to the game state.");
  return { state: summoned.state, monster: created, attack: summoned.attack, deck };
}

/** Adds a catalogue monster to the board and returns its mandatory first-summon attack event. */
export function summonRandomMonster(
  state: GameState,
  rank: MonsterRank,
  instanceId: string,
  random: () => number = Math.random
): CatalogueSummonResult {
  if (!instanceId.trim()) {
    throw new Error("A unique monster instance ID is required.");
  }
  const definition = getRandomMonsterByRank(rank, random);
  const triggerPosition = definition.id === "R09"
    ? [0, 8, 16, 24][Math.min(3, Math.max(0, Math.floor(random() * 4)))]
    : undefined;
  const monster = {
    id: instanceId,
    catalogueId: definition.id,
    ...(triggerPosition === undefined ? {} : { triggerPosition }),
    ...(definition.id === "L06" ? { revivalsRemaining: 1 } : {}),
    ...(definition.id === "L05" ? { exchangesRemaining: 3 } : {}),
    name: definition.name,
    rank: definition.rank,
    hp: definition.hp,
    maxHp: definition.hp,
    attackDamage: definition.attackDamage,
    attackPattern: definition.attackPattern,
    attackInterval: definition.attackInterval,
    targetCount: definition.targetCount,
    rules: [...definition.rules],
    reward: definition.reward,
    info: definition.info
  };
  const summoned = summonMonster(state, monster);
  const created = summoned.state.monsters.find((item) => item.id === instanceId);
  if (!created) throw new Error("The summoned monster was not added to the game state.");
  return { state: summoned.state, monster: created, attack: summoned.attack };
}

/** Applies ordinary damage to a finite-HP catalogue monster. Infinite-HP monsters need their listed condition. */
export function damageMonster(
  state: GameState,
  monsterId: string,
  amount: number,
  sourcePlayerId?: string
): { state: GameState; event: MonsterDamageEvent } {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error("Monster damage must be a non-negative integer.");
  }
  const monster = state.monsters.find((item) => item.id === monsterId);
  if (!monster || !monster.active) {
    throw new Error(`Active monster ${monsterId} was not found.`);
  }
  if (monster.hp === undefined) {
    throw new Error(`Monster ${monsterId} has no catalogue HP value.`);
  }

  const event: MonsterDamageEvent = {
    monsterId,
    sourcePlayerId,
    attemptedDamage: amount,
    hpBefore: monster.hp,
    hpAfter: monster.hp,
    hpDamage: 0,
    defeated: false
  };
  if (monster.hp === null) {
    event.preventedBy = "infinite_hp";
    return { state, event };
  }
  if (monster.catalogueId === "R06" && amount < 3) {
    event.preventedBy = "attack_below_threshold";
    return { state, event };
  }

  const cannotDefeatByDamage = monster.catalogueId === "M06" && amount >= monster.hp;
  const hpDamage = cannotDefeatByDamage ? Math.max(0, monster.hp - 1) : Math.min(monster.hp, amount);
  const hpAfter = cannotDefeatByDamage ? 1 : Math.max(0, monster.hp - amount);
  if (cannotDefeatByDamage) event.preventedBy = "cannot_be_defeated_by_damage";
  event.hpDamage = hpDamage;
  const phoenixRevives = hpAfter === 0 && monster.catalogueId === "L06" && (monster.revivalsRemaining ?? 0) > 0;
  event.revived = phoenixRevives;
  event.hpAfter = phoenixRevives ? (monster.maxHp ?? monster.hp) : hpAfter;
  event.defeated = hpAfter === 0 && !phoenixRevives;

  const returnedCards = event.defeated ? [...(monster.stolenCards ?? [])] : [];
  const players = returnedCards.length > 0
    ? state.players.map((player) => {
        const cards = returnedCards
          .filter((stolen) => stolen.ownerPlayerId === player.id)
          .map((stolen) => stolen.cardId);
        return cards.length > 0 ? { ...player, hand: [...player.hand, ...cards] } : player;
      })
    : state.players;
  const monsters = state.monsters.map((item) => item.id === monsterId
    ? phoenixRevives
      ? { ...item, hp: item.maxHp ?? item.hp, active: true, revivalsRemaining: (item.revivalsRemaining ?? 1) - 1 }
      : { ...item, hp: hpAfter, active: hpAfter > 0, ...(hpAfter === 0 ? { stolenCards: [] } : {}) }
    : item
  );
  if (returnedCards.length > 0) event.returnedCards = returnedCards;
  if (event.defeated && monster.catalogueId === "R02") {
    event.bonusReward = { greenCards: 1 };
  }
  return { state: { ...state, players, monsters }, event };
}

/** Deactivates every active monster; reward handling remains explicit for the caller. */
export function clearActiveMonsters(state: GameState): {
  state: GameState;
  removedMonsterIds: string[];
} {
  const removedMonsterIds = state.monsters.filter((monster) => monster.active).map((monster) => monster.id);
  return {
    state: {
      ...state,
      monsters: state.monsters.map((monster) => monster.active ? { ...monster, active: false } : monster)
    },
    removedMonsterIds
  };
}
