import type { GameMonster, MonsterAttackPattern } from "./turnEngine";

export type MonsterRank = "Common" | "Rare" | "Epic" | "Legend" | "Myth";

export interface MonsterDefinition {
  id: string;
  name: string;
  species: string;
  rank: MonsterRank;
  /** null represents the infinity HP values in the source rules. */
  hp: number | null;
  damage: number;
  /** null means the monster has no recurring scheduled attack. */
  attackInterval: number | null;
  attackPattern?: MonsterAttackPattern;
  targetCount?: number;
  ignoresShields?: boolean;
  specialRules: readonly string[];
}

export const MONSTER_CATALOGUE: readonly MonsterDefinition[] = [
  // COMMON (10)
  { id: "C01", name: "Gob", species: "Goblin", rank: "Common", hp: 5, damage: 1, attackInterval: 2, specialRules: ["60% chance to repeat its previous target"] },
  { id: "C02", name: "Bone", species: "Skeleton", rank: "Common", hp: 1, damage: 2, attackInterval: 2, targetCount: 2, specialRules: ["Attacks two targets"] },
  { id: "C03", name: "Zomzom", species: "Zombie", rank: "Common", hp: 20, damage: 1, attackInterval: 1, specialRules: ["Heals 1 HP after each attack"] },
  { id: "C04", name: "Ratty", species: "Giant Rat", rank: "Common", hp: 3, damage: 1, attackInterval: 1, specialRules: [] },
  { id: "C05", name: "Webby", species: "Cave Spider", rank: "Common", hp: 4, damage: 2, attackInterval: 3, specialRules: ["Dies when hit by an Attack card; its attacker receives no card reward"] },
  { id: "C06", name: "Fang", species: "Wolf", rank: "Common", hp: 8, damage: 2, attackInterval: 2, specialRules: ["Gains +1 damage while more than one Wolf is active"] },
  { id: "C07", name: "Shroomy", species: "Mushroom Man", rank: "Common", hp: 6, damage: 1, attackInterval: 2, specialRules: ["When eliminated, its attacker loses 1 HP"] },
  { id: "C08", name: "Batty", species: "Giant Bat", rank: "Common", hp: 2, damage: 1, attackInterval: 1, specialRules: ["Chooses a new random target for every attack"] },
  { id: "C09", name: "Rocky", species: "Stone Golem Pup", rank: "Common", hp: 15, damage: 1, attackInterval: 3, specialRules: ["Attack cards deal 1 less damage, minimum 1"] },
  { id: "C10", name: "Sneaky", species: "Kobold Thief", rank: "Common", hp: 4, damage: 0, attackInterval: 2, specialRules: ["Steals one random card from its target; returns stolen cards when eliminated"] },

  // RARE (10)
  { id: "R01", name: "Bob", species: "Slime", rank: "Rare", hp: 40, damage: 3, attackInterval: 3, specialRules: ["A player who attacks it becomes Slowed: movement steps -1"] },
  { id: "R02", name: "Chesty", species: "Mimic", rank: "Rare", hp: 30, damage: 4, attackInterval: 3, specialRules: ["Targets the living player with the most cards; grants one extra Green card when eliminated"] },
  { id: "R03", name: "Wizzy", species: "Apprentice Mage", rank: "Rare", hp: 15, damage: 3, attackInterval: 3, specialRules: ["Target rolls one die; on 1–2, takes 2 additional damage"] },
  { id: "R04", name: "Stoney", species: "Basilisk", rank: "Rare", hp: 20, damage: 3, attackInterval: 3, specialRules: ["Target is Petrified and may roll only one die on their next turn"] },
  { id: "R05", name: "Vampy", species: "Vampire", rank: "Rare", hp: 25, damage: 2, attackInterval: 2, specialRules: ["Attacks bypass shields; heals 2 HP after each attack"] },
  { id: "R06", name: "Ghosty", species: "Poltergeist", rank: "Rare", hp: 12, damage: 2, attackInterval: 2, specialRules: ["Unaffected by Attack cards dealing less than 3 damage"] },
  { id: "R07", name: "Scorpy", species: "Giant Scorpion", rank: "Rare", hp: 18, damage: 3, attackInterval: 3, specialRules: ["Applies Poison: lose 1 HP at the start of own turns for 3 turns"] },
  { id: "R08", name: "Harpy", species: "Harpy", rank: "Rare", hp: 14, damage: 2, attackInterval: 2, specialRules: ["If the target has cards, steals one random card and discards it"] },
  { id: "R09", name: "Minoo", species: "Minotaur", rank: "Rare", hp: 35, damage: 4, attackInterval: 4, specialRules: ["Ambushes a player who passes through or lands on its assigned corner once"] },
  { id: "R10", name: "Frosty", species: "Ice Elemental", rank: "Rare", hp: 22, damage: 3, attackInterval: 3, specialRules: ["Applies Frozen: target may use at most 2 cards on their next turn"] },

  // EPIC (10)
  { id: "E01", name: "Ogrok", species: "Ogre", rank: "Epic", hp: 60, damage: 6, attackInterval: 3, specialRules: ["Reward: 4 Prank cards"] },
  { id: "E02", name: "Trollo", species: "Cave Troll", rank: "Epic", hp: 70, damage: 5, attackInterval: 2, specialRules: ["Reward: 3 Prank cards and 1 Green card"] },
  { id: "E03", name: "Wyvo", species: "Wyvern", rank: "Epic", hp: 55, damage: 7, attackInterval: 3, specialRules: ["Reward: 3 Curse cards"] },
  { id: "E04", name: "Cerby", species: "Cerberus", rank: "Epic", hp: 80, damage: 4, attackInterval: 2, targetCount: 3, specialRules: ["Attacks three targets; reward: 5 Prank cards"] },
  { id: "E05", name: "Hydro", species: "Hydra", rank: "Epic", hp: 90, damage: 5, attackInterval: 3, targetCount: 2, specialRules: ["Attacks two targets; reward: 3 Prank cards and 2 Curse cards"] },
  { id: "E06", name: "Kraky", species: "Kraken", rank: "Epic", hp: 100, damage: 6, attackInterval: 4, targetCount: 4, specialRules: ["Attacks four targets; reward: 4 Green cards"] },
  { id: "E07", name: "Gargo", species: "Gargoyle", rank: "Epic", hp: 65, damage: 6, attackInterval: 3, specialRules: ["Reward: 4 Blue cards and 2 Prank cards"] },
  { id: "E08", name: "Mantic", species: "Manticore", rank: "Epic", hp: 75, damage: 7, attackInterval: 3, specialRules: ["Reward: 4 Curse cards"] },
  { id: "E09", name: "Cyclo", species: "Cyclops", rank: "Epic", hp: 120, damage: 8, attackInterval: 4, specialRules: ["Reward: 6 Prank cards"] },
  { id: "E10", name: "Drako", species: "Drake Lord", rank: "Epic", hp: 150, damage: 9, attackInterval: 4, specialRules: ["Reward: 4 Prank cards, 2 Curse cards, and 2 Green cards"] },

  // LEGEND (10)
  { id: "L01", name: "Lizzie", species: "Baby Dragon", rank: "Legend", hp: 100, damage: 10, attackInterval: 6, specialRules: ["Give it 4 Buff cards to make it leave immediately"] },
  { id: "L02", name: "Sphinxy", species: "Sphinx", rank: "Legend", hp: 150, damage: 8, attackInterval: 5, specialRules: ["Reflects 50% of damage; give it 2 Prank cards to make it leave"] },
  { id: "L03", name: "Gini", species: "Genie", rank: "Legend", hp: 120, damage: 6, attackInterval: 6, specialRules: ["Give it any 3 cards; choose one card from the deck and it leaves"] },
  { id: "L04", name: "Unico", species: "Unicorn", rank: "Legend", hp: 130, damage: 7, attackInterval: 5, specialRules: ["Reflects 100% of damage; give it 2 Green cards to heal all players by 10 HP and make it leave"] },
  { id: "L05", name: "Lepri", species: "Leprechaun", rank: "Legend", hp: 80, damage: 5, attackInterval: 4, specialRules: ["Reflects 30% of damage; trade 1 card for 2 random cards up to three times, then it leaves"] },
  { id: "L06", name: "Fenny", species: "Phoenix", rank: "Legend", hp: 200, damage: 8, attackInterval: 5, specialRules: ["Revives once with full HP; give it 1 Resurrection card to make it leave"] },
  { id: "L07", name: "Mirro", species: "Mirror Knight", rank: "Legend", hp: 160, damage: 6, attackInterval: 4, specialRules: ["Reflects 100% of damage without regard to shields; give it 2 Blue Defense cards to make it leave"] },
  { id: "L08", name: "Treeo", species: "Ancient Treant", rank: "Legend", hp: 250, damage: 7, attackInterval: 6, specialRules: ["Reflects 30% of damage; give it 3 Green cards to make it leave"] },
  { id: "L09", name: "Dwarfy", species: "Dwarf Merchant", rank: "Legend", hp: 90, damage: 4, attackInterval: 4, specialRules: ["Reflects 50% of damage; pay 2 Blue cards for 3 Blue Defense cards once, then it leaves"] },
  { id: "L10", name: "Kingo", species: "Fallen King", rank: "Legend", hp: 220, damage: 9, attackInterval: 5, specialRules: ["Reflects 50% of damage; collect 5 tribute cards from players, then it leaves and curses the biggest contributor"] },

  // MYTH (10)
  { id: "M01", name: "Hecate", species: "The Curse Witch", rank: "Myth", hp: 10000, damage: 0, attackInterval: null, specialRules: ["On summon, instantly kills one player regardless of shields or invulnerability; links all players' HP damage; accepts 3 Prank cards for 4 Curse cards; leaves after 6 turns; linked HP effect ends with her"] },
  { id: "M02", name: "Granfel", species: "God of Trolling", rank: "Myth", hp: null, damage: 1, attackInterval: null, specialRules: ["Attacks only on summon; exchange all Prank cards for random Curses until 4–12 are received or no one trades for 3 turns; gives Resurrection cards to 2 random players before leaving"] },
  { id: "M03", name: "Chronos", species: "Time Eater", rank: "Myth", hp: null, damage: 0, attackInterval: null, specialRules: ["On summon, all players skip their next turn; players using 3 cards in a turn discard one random card; leaves after 5 turns"] },
  { id: "M04", name: "Anubix", species: "Judge of the Dead", rank: "Myth", hp: null, damage: 0, attackInterval: null, specialRules: ["On summon, revives one eliminated player at random and removes one heart from the lowest-HP player; only Instant Kill can eliminate it"] },
  { id: "M05", name: "Nyxia", species: "Goddess of Night", rank: "Myth", hp: null, damage: 0, attackInterval: null, specialRules: ["Players cannot see their own hands until she leaves after 4 turns or a player uses Luck"] },
  { id: "M06", name: "Ragnar", species: "Doomsday Titan", rank: "Myth", hp: 99999, damage: 15, attackInterval: 2, attackPattern: "all_living", ignoresShields: true, specialRules: ["Attacks all players through shields; eliminated by a combined offering of 10 cards or Instant Kill; leaves after 8 turns"] },
  { id: "M07", name: "Pandy", species: "Pandora", rank: "Myth", hp: null, damage: 0, attackInterval: null, specialRules: ["On summon, each player draws 3 random cards with a possible hidden Curse; leaves immediately after distribution"] },
  { id: "M08", name: "Ouro", species: "World Serpent", rank: "Myth", hp: null, damage: 3, attackInterval: 1, specialRules: ["Heals to full HP after each attack and cannot be killed by damage; requires one card of each color to eliminate"] },
  { id: "M09", name: "Lucy", species: "Lord of Fallen Angels", rank: "Myth", hp: null, damage: 5, attackInterval: null, specialRules: ["Attacks once on summon; offers Immortality and Reflect in exchange for one heart; leaves after 3 turns"] },
  { id: "M10", name: "Void", species: "The Nameless One", rank: "Myth", hp: null, damage: 0, attackInterval: null, specialRules: ["On summon, all players discard half their hand rounded up; leaves when a player dies or after 5 turns"] }
];

export function getMonsterDefinition(monsterId: string): MonsterDefinition | undefined {
  return MONSTER_CATALOGUE.find((monster) => monster.id === monsterId);
}

export function getMonstersByRank(rank: MonsterRank): readonly MonsterDefinition[] {
  return MONSTER_CATALOGUE.filter((monster) => monster.rank === rank);
}

export function createMonsterInstance(
  definition: MonsterDefinition,
  instanceId: string
): Omit<GameMonster, "turnsSinceLastAttack" | "active"> {
  return {
    id: instanceId,
    catalogueId: definition.id,
    name: definition.name,
    rank: definition.rank,
    hp: definition.hp,
    maxHp: definition.hp,
    damage: definition.damage,
    attackInterval: definition.attackInterval,
    attackPattern: definition.attackPattern ?? "random_living",
    targetCount: definition.targetCount,
    ignoresShields: definition.ignoresShields
  };
}
