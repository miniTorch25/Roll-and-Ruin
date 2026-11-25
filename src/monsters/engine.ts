import { summonMonster, type GameMonster, type GameState, type MonsterAttackEvent } from "../game/turnEngine";
import { getRandomMonsterByRank, type MonsterRank } from "./catalogue";

export interface MonsterDamageEvent {
  monsterId: string;
  sourcePlayerId?: string;
  attemptedDamage: number;
  hpBefore: number | null;
  hpAfter: number | null;
  hpDamage: number;
  defeated: boolean;
  preventedBy?: "infinite_hp" | "attack_below_threshold";
  /** Additional green-card reward Chesty grants when defeated. */
  bonusReward?: { greenCards: number };
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

  const hpDamage = Math.min(monster.hp, amount);
  const hpAfter = Math.max(0, monster.hp - amount);
  event.hpDamage = hpDamage;
  event.hpAfter = hpAfter;
  event.defeated = hpAfter === 0;

  const returnedCards = hpAfter === 0 ? [...(monster.stolenCards ?? [])] : [];
  const players = returnedCards.length > 0
    ? state.players.map((player) => {
        const cards = returnedCards
          .filter((stolen) => stolen.ownerPlayerId === player.id)
          .map((stolen) => stolen.cardId);
        return cards.length > 0 ? { ...player, hand: [...player.hand, ...cards] } : player;
      })
    : state.players;
  const monsters = state.monsters.map((item) => item.id === monsterId
    ? { ...item, hp: hpAfter, active: hpAfter > 0, ...(hpAfter === 0 ? { stolenCards: [] } : {}) }
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
