import { CARD_CATALOGUE } from "../cards/catalogue";
import { drawCards, type CardDeckState } from "../cards/deck";
import {
  applyPlayerDeath,
  resurrectPlayer,
  summonMonster,
  type GameState,
  type GameMonster
} from "../game/turnEngine";

export type MythId = "M01" | "M02" | "M03" | "M04" | "M05" | "M06" | "M07" | "M08" | "M09" | "M10";

export interface MythRuntime {
  monsterId: string;
  catalogueId: MythId;
  turnsRemaining: number;
  linkedHp: boolean;
  hiddenHands: boolean;
  granfelTarget: number;
  granfelReceived: number;
  granfelIdleTurns: number;
  offerings: Record<string, string[]>;
  lucyAcceptedPlayerIds: string[];
}

export type MythGameState = GameState & { mythRuntime?: MythRuntime };

export interface MythActionResult {
  state: MythGameState;
  deck?: CardDeckState;
  messages: string[];
  removed: boolean;
}

const MYTH_RULES: Record<MythId, readonly string[]> = {
  M01: ["สังหารผู้เล่น 1 คนทันทีเมื่อถูกอัญเชิญ โดยไม่สนอมตะหรือเกราะ", "เชื่อม HP: เมื่อผู้เล่นคนหนึ่งได้รับความเสียหาย ผู้เล่นทุกคนได้รับความเสียหายเท่ากัน", "ถวายไพ่เหลือง 3 ใบเพื่อรับไพ่คำสาป 4 ใบ", "หากกำจัด Hecate ด้วยความเสียหาย รับไพ่คำสาป 2 ใบ", "หายไปภายใน 6 เทิร์น"],
  M02: ["โจมตีทุกคนเฉพาะตอนถูกอัญเชิญ", "แลกไพ่เหลืองทั้งหมดกับไพ่คำสาปแบบสุ่มได้", "หายไปเมื่อแจกไพ่คำสาปครบ 4–12 ใบ หรือไม่มีการแลกเปลี่ยน 3 เทิร์น", "ก่อนหายไป มอบไพ่ชุบชีวิตให้ผู้เล่นสุ่ม 2 คน"],
  M03: ["ผู้เล่นทุกคนข้ามเทิร์นถัดไป 1 ครั้ง", "ผู้เล่นที่ใช้ไพ่ครบ 3 ใบในเทิร์นต้องทิ้งไพ่สุ่ม 1 ใบ", "หายไปภายใน 5 เทิร์น"],
  M04: ["เมื่อปรากฏตัว ชุบชีวิตผู้เล่นที่ตกรอบแบบสุ่ม 1 คน", "ผู้เล่นที่มี HP ต่ำสุดเสียหัวใจ 1 ดวง", "กำจัดได้ด้วยไพ่สังหารทันทีเท่านั้น"],
  M05: ["ผู้เล่นมองไม่เห็นไพ่ในมือและต้องใช้ไพ่แบบสุ่ม", "หายไปภายใน 4 เทิร์น หรือเมื่อมีผู้เล่นใช้ไพ่ Luck"],
  M06: ["โจมตีผู้เล่นทุกคนทุก 2 เทิร์น ดาเมจ 15 ทะลุโล่", "กำจัดด้วยเครื่องบูชาไพ่รวม 10 ใบ หรือไพ่สังหารทันที", "หายไปภายใน 8 เทิร์น"],
  M07: ["เมื่อถูกอัญเชิญ ผู้เล่นทุกคนจั่วไพ่สุ่ม 3 ใบ", "หายไปทันทีหลังแจกไพ่"],
  M08: ["โจมตีผู้เล่นทุกคนทุก 1 เทิร์น ดาเมจ 3", "ฟื้น HP เต็มทุกครั้งหลังโจมตี จึงกำจัดด้วยดาเมจไม่ได้", "ถวายไพ่ฟ้า เหลือง เขียว และแดง อย่างละ 1 ใบเพื่อกำจัด"],
  M09: ["โจมตีผู้เล่นทุกคนทันทีเมื่อถูกอัญเชิญ 1 ครั้ง", "ผู้เล่นแต่ละคนเลือกเสียหัวใจ 1 ดวงเพื่อรับไพ่ Immortality และ Reflect", "หายไปภายใน 3 เทิร์น"],
  M10: ["เมื่อถูกอัญเชิญ ผู้เล่นทุกคนทิ้งไพ่ครึ่งมือ ปัดขึ้นและสุ่ม", "หายไปทันทีเมื่อผู้เล่นคนใดคนหนึ่งตาย หรือครบ 5 เทิร์น"]
};

const MYTH_DATA: Record<MythId, Pick<GameMonster, "name" | "hp" | "maxHp" | "attackDamage" | "attackInterval" | "attackPattern">> = {
  M01: { name: "Hecate", hp: 10000, maxHp: 10000, attackDamage: 0, attackInterval: null, attackPattern: "all_living" },
  M02: { name: "Granfel", hp: null, maxHp: null, attackDamage: 1, attackInterval: null, attackPattern: "all_living" },
  M03: { name: "Chronos", hp: null, maxHp: null, attackDamage: 0, attackInterval: null, attackPattern: "all_living" },
  M04: { name: "Anubix", hp: null, maxHp: null, attackDamage: 0, attackInterval: null, attackPattern: "all_living" },
  M05: { name: "Nyxia", hp: null, maxHp: null, attackDamage: 0, attackInterval: null, attackPattern: "all_living" },
  M06: { name: "Ragnar", hp: 99999, maxHp: 99999, attackDamage: 15, attackInterval: 2, attackPattern: "all_living" },
  M07: { name: "Pandy", hp: null, maxHp: null, attackDamage: 0, attackInterval: null, attackPattern: "all_living" },
  M08: { name: "Ouro", hp: null, maxHp: null, attackDamage: 3, attackInterval: 1, attackPattern: "all_living" },
  M09: { name: "Lucy", hp: null, maxHp: null, attackDamage: 5, attackInterval: null, attackPattern: "all_living" },
  M10: { name: "Void", hp: null, maxHp: null, attackDamage: 0, attackInterval: null, attackPattern: "all_living" }
};

function randomIndex(length: number, random: () => number): number {
  if (length <= 0) return -1;
  return Math.min(length - 1, Math.max(0, Math.floor(random() * length)));
}

function activeRuntime(state: MythGameState): MythRuntime {
  if (!state.mythRuntime) throw new Error("There is no active Myth Monster.");
  const monster = state.monsters.find(item => item.id === state.mythRuntime?.monsterId && item.active);
  if (!monster) throw new Error("The active Myth Monster is missing from the board.");
  return state.mythRuntime;
}

function removeMyth(state: MythGameState): MythGameState {
  const runtime = state.mythRuntime;
  if (!runtime) return state;
  return {
    ...state,
    monsters: state.monsters.map(monster => monster.id === runtime.monsterId ? { ...monster, active: false } : monster),
    mythRuntime: { ...runtime, linkedHp: false, hiddenHands: false }
  };
}

function leaveGranfel(state: MythGameState, random: () => number): MythGameState {
  const removed = removeMyth(state);
  const recipients = [...removed.players];
  const awarded = new Set<string>();
  while (awarded.size < 2 && awarded.size < recipients.length) {
    const remaining = recipients.filter(player => !awarded.has(player.id));
    const selected = remaining[randomIndex(remaining.length, random)];
    if (!selected) break;
    awarded.add(selected.id);
  }
  return {
    ...removed,
    players: removed.players.map(player => awarded.has(player.id)
      ? { ...player, hand: [...player.hand, "yellow_resurrection"] }
      : player)
  };
}

function drawMatching(deck: CardDeckState, hand: readonly string[], predicate: (id: string) => boolean, count: number, random: () => number): { deck: CardDeckState; cards: string[] } {
  const pile = [...deck.drawPile];
  const cards: string[] = [];
  for (let i = 0; i < count; i++) {
    const candidates = pile.filter(id => predicate(id));
    const eligible = candidates.filter(id => {
      const definition = CARD_CATALOGUE.find(card => card.id === id);
      return definition?.effectId !== "instant_kill" || !hand.some(handId => CARD_CATALOGUE.find(card => card.id === handId)?.effectId === "instant_kill");
    });
    const index = randomIndex(eligible.length, random);
    if (index < 0) break;
    const selected = eligible[index];
    cards.push(selected);
    pile.splice(pile.indexOf(selected), 1);
  }
  return { deck: { drawPile: pile, discardPile: [...deck.discardPile] }, cards };
}

/** Creates one Myth monster and applies its immediate summon effects. */
export function summonMyth(
  input: GameState,
  catalogueId: MythId,
  monsterId: string,
  deck: CardDeckState,
  random: () => number = Math.random
): MythActionResult {
  if (input.monsters.some(monster => monster.active && monster.rank === "Myth")) {
    throw new Error("Only one Myth Monster may be active at a time.");
  }
  const data = MYTH_DATA[catalogueId];
  const monster = {
    id: monsterId,
    catalogueId,
    rank: "Myth" as const,
    ...data,
    rules: [...MYTH_RULES[catalogueId]],
    reward: catalogueId === "M01" ? "ไพ่คำสาป 2 ใบ" : null,
    info: null
  };
  const summoned = summonMonster(input, monster);
  let state: MythGameState = {
    ...summoned.state,
    mythRuntime: {
      monsterId,
      catalogueId,
      turnsRemaining: ({ M01: 6, M03: 5, M05: 4, M06: 8, M09: 3, M10: 5 } as Partial<Record<MythId, number>>)[catalogueId] ?? 0,
      linkedHp: catalogueId === "M01",
      hiddenHands: catalogueId === "M05",
      granfelTarget: 4 + randomIndex(9, random),
      granfelReceived: 0,
      granfelIdleTurns: 0,
      offerings: {},
      lucyAcceptedPlayerIds: []
    }
  };
  let nextDeck = deck;
  const messages: string[] = [];

  if (catalogueId === "M01") {
    const living = state.players.filter(player => player.status === "alive");
    const target = living[randomIndex(living.length, random)];
    if (target) {
      state = applyPlayerDeath(state, target.id, random).state;
      messages.push(`Hecate instantly kills ${target.id}; defenses and invulnerability are ignored.`);
    }
  } else if (catalogueId === "M03") {
    state = { ...state, players: state.players.map(player => player.status === "alive"
      ? { ...player, statusEffects: [...player.statusEffects.filter(effect => effect.type !== "skip_turn"), { type: "skip_turn", turnsRemaining: 1 }] }
      : player) };
    messages.push("All living players must skip their next turn.");
  } else if (catalogueId === "M04") {
    const eliminated = state.players.filter(player => player.status === "eliminated");
    const revived = eliminated[randomIndex(eliminated.length, random)];
    if (revived) state = resurrectPlayer(state, revived.id);
    const lowest = state.players.filter(player => player.status === "alive").sort((a, b) => a.hp - b.hp)[0];
    if (lowest) {
      state = { ...state, players: state.players.map(player => player.id !== lowest.id ? player
        : player.hearts <= 1
          ? { ...player, hearts: 0, status: "eliminated" as const }
          : { ...player, hearts: player.hearts - 1 }) };
    }
    messages.push("Anubix revives one eliminated player if possible and takes one heart from the lowest-HP living player.");
  } else if (catalogueId === "M07") {
    for (const player of state.players) {
      const result = drawCards(player.hand, nextDeck, 3);
      nextDeck = result.deck;
      state = { ...state, players: state.players.map(item => item.id === player.id ? { ...item, hand: result.hand } : item) };
    }
    state = removeMyth(state);
    messages.push("Pandy distributes three cards to every living player and disappears.");
  } else if (catalogueId === "M10") {
    state = { ...state, players: state.players.map(player => {
      if (player.hand.length === 0) return player;
      const hand = [...player.hand];
      const discardCount = Math.ceil(hand.length / 2);
      for (let i = 0; i < discardCount; i++) hand.splice(randomIndex(hand.length, random), 1);
      return { ...player, hand };
    }) };
    messages.push("Void makes every living player discard half their hand, rounded up.");
  } else if (catalogueId === "M02") {
    messages.push("Granfel attacks once on summon; players may exchange all yellow cards for random curses.");
  } else if (catalogueId === "M06") {
    messages.push("Ragnar attacks all living players every two turns; ten contributed cards or Instant Kill removes it.");
  } else if (catalogueId === "M08") {
    messages.push("Ouro attacks every turn and requires one card of each color to complete the cycle.");
  } else if (catalogueId === "M09") {
    messages.push("Lucy attacks once on summon and offers Immortality plus Reflect for one heart.");
  }
  return { state, deck: nextDeck, messages, removed: !state.monsters.some(item => item.id === monsterId && item.active) };
}

/** Hecate accepts exactly three yellow cards and rewards four random Curse cards. */
export function offerHecateCards(
  input: GameState,
  playerId: string,
  cardIds: string[],
  deck: CardDeckState,
  random: () => number = Math.random
): MythActionResult {
  const state = input as MythGameState;
  const runtime = activeRuntime(state);
  if (runtime.catalogueId !== "M01") throw new Error("Only Hecate accepts this offering.");
  if (cardIds.length !== 3 || cardIds.some(id => CARD_CATALOGUE.find(card => card.id === id)?.color !== "yellow")) {
    throw new Error("Hecate requires exactly three yellow cards.");
  }
  const player = state.players.find(item => item.id === playerId && item.status === "alive");
  if (!player) throw new Error("A living player must make the offering.");
  const requested = new Map<string, number>();
  for (const id of cardIds) requested.set(id, (requested.get(id) ?? 0) + 1);
  for (const [id, count] of requested) {
    if (player.hand.filter(cardId => cardId === id).length < count) throw new Error("Every offered card must be in the contributor's hand.");
  }
  const remainingHand = player.hand.filter((id, index) => {
    const priorOccurrences = player.hand.slice(0, index).filter(cardId => cardId === id).length;
    return priorOccurrences >= (requested.get(id) ?? 0);
  });
  const reward = drawMatching(deck, remainingHand, id => CARD_CATALOGUE.find(card => card.id === id)?.kind === "curse", 4, random);
  let next: MythGameState = {
    ...state,
    players: state.players.map(item => item.id === playerId ? { ...item, hand: [...remainingHand, ...reward.cards] } : item),
    monsters: state.monsters.map(monster => monster.id === runtime.monsterId ? { ...monster, active: false } : monster),
    mythRuntime: { ...runtime, linkedHp: false, hiddenHands: false }
  };
  const nextDeck = { ...reward.deck, discardPile: [...reward.deck.discardPile, ...cardIds] };
  return { state: next, deck: nextDeck, messages: [`Hecate accepts three yellow cards and grants ${reward.cards.length} Curse card(s).`], removed: true };
}

/** While Nyxia is active, this is the only card ID the UI should reveal as playable. */
export function chooseNyxiaRandomCard(input: GameState, playerId: string, random: () => number = Math.random): string {
  const state = input as MythGameState;
  const runtime = activeRuntime(state);
  if (runtime.catalogueId !== "M05" || !runtime.hiddenHands) throw new Error("Nyxia's hidden-hand effect is not active.");
  const player = state.players.find(item => item.id === playerId && item.status === "alive");
  if (!player || player.hand.length === 0) throw new Error("The selected player has no playable card.");
  return player.hand[randomIndex(player.hand.length, random)];
}

/** Applies Hecate's shared damage rule to every living player. Call instead of ordinary single-target HP damage while linked. */
export function applyHecateLinkedDamage(input: GameState, amount: number, random: () => number = Math.random): GameState {
  const state = input as MythGameState;
  const runtime = activeRuntime(state);
  if (runtime.catalogueId !== "M01" || !runtime.linkedHp) throw new Error("Hecate's HP link is not active.");
  if (!Number.isInteger(amount) || amount < 0) throw new Error("Damage must be a non-negative integer.");
  let next = state;
  const targets = state.players.filter(player => player.status === "alive");
  for (const target of targets) {
    const current = next.players.find(player => player.id === target.id);
    if (!current || current.status !== "alive") continue;
    if (current.hp <= amount) next = applyPlayerDeath(next, current.id, random).state;
    else next = { ...next, players: next.players.map(player => player.id === current.id ? { ...player, hp: player.hp - amount } : player) };
  }
  return next;
}

/** Granfel trades every yellow card held by one player for the same number of random curse cards. */
export function offerGranfelTrade(input: GameState, playerId: string, deck: CardDeckState, random: () => number = Math.random): MythActionResult {
  const state = input as MythGameState;
  const runtime = activeRuntime(state);
  if (runtime.catalogueId !== "M02") throw new Error("Only Granfel accepts this trade.");
  const player = state.players.find(item => item.id === playerId && item.status === "alive");
  if (!player) throw new Error("A living player is required.");
  const offered = player.hand.filter(id => CARD_CATALOGUE.find(card => card.id === id)?.color === "yellow");
  if (!offered.length) throw new Error("The player has no yellow cards to exchange.");
  const remaining = player.hand.filter(id => !offered.includes(id));
  const trade = drawMatching(deck, remaining, id => CARD_CATALOGUE.find(card => card.id === id)?.kind === "curse", offered.length, random);
  const cards = [...remaining, ...trade.cards];
  let next: MythGameState = {
    ...state,
    players: state.players.map(item => item.id === playerId ? { ...item, hand: cards } : item),
    mythRuntime: { ...runtime, granfelReceived: runtime.granfelReceived + trade.cards.length, granfelIdleTurns: 0 }
  };
  const removed = next.mythRuntime!.granfelReceived >= runtime.granfelTarget;
  if (removed) next = leaveGranfel(next, random);
  return {
    state: next,
    deck: { ...trade.deck, discardPile: [...trade.deck.discardPile, ...offered] },
    messages: [`Granfel exchanged ${offered.length} yellow card(s) for ${trade.cards.length} curse card(s).`],
    removed
  };
}

/** Resolves a voluntary multi-player offering to Ragnar or Ouro. */
export function offerMythCards(input: GameState, contributions: Array<{ playerId: string; cardIds: string[] }>): MythActionResult {
  const state = input as MythGameState;
  const runtime = activeRuntime(state);
  if (runtime.catalogueId !== "M06" && runtime.catalogueId !== "M08") throw new Error("This Myth Monster does not accept group offerings.");
  const offered = contributions.flatMap(item => item.cardIds);
  for (const item of contributions) {
    const player = state.players.find(candidate => candidate.id === item.playerId && candidate.status === "alive");
    if (!player) throw new Error("Every contributor must be a living player.");
    const requested = new Map<string, number>();
    for (const id of item.cardIds) requested.set(id, (requested.get(id) ?? 0) + 1);
    for (const [id, count] of requested) {
      if (player.hand.filter(cardId => cardId === id).length < count) throw new Error("Every offered card must belong to its contributor.");
    }
  }
  let complete = false;
  if (runtime.catalogueId === "M06") {
    const totalOffered = Object.values(runtime.offerings).reduce((sum, ids) => sum + ids.length, 0) + offered.length;
    if (totalOffered > 10) throw new Error("Ragnar requires exactly ten offered cards in total.");
    complete = totalOffered === 10;
  } else {
    const offeredColors = offered.map(id => CARD_CATALOGUE.find(card => card.id === id)?.color);
    const previousColors = Object.values(runtime.offerings).flat().map(id => CARD_CATALOGUE.find(card => card.id === id)?.color);
    const allColors = [...previousColors, ...offeredColors];
    if (offeredColors.some(color => !["blue", "yellow", "green", "red"].includes(color ?? "")) || new Set(allColors).size !== allColors.length) {
      throw new Error("Ouro requires exactly one card of each color: blue, yellow, green, and red.");
    }
    const colors = new Set(allColors);
    complete = (["blue", "yellow", "green", "red"] as const).every(color => colors.has(color));
  }
  const offerings = { ...runtime.offerings };
  for (const item of contributions) offerings[item.playerId] = [...(offerings[item.playerId] ?? []), ...item.cardIds];
  const next: MythGameState = {
    ...state,
    players: state.players.map(player => {
      const item = contributions.find(entry => entry.playerId === player.id);
      return item ? { ...player, hand: player.hand.filter(id => !item.cardIds.includes(id)) } : player;
    }),
    monsters: state.monsters.map(monster => monster.id === runtime.monsterId && complete ? { ...monster, active: false } : monster),
    mythRuntime: { ...runtime, offerings, linkedHp: complete ? false : runtime.linkedHp, hiddenHands: complete ? false : runtime.hiddenHands }
  };
  return { state: next, messages: [complete ? "The Myth offering is complete; the monster leaves the board." : "Offering recorded."], removed: complete };
}

/** Lucy's one-time bargain costs one heart and awards one Immortality and one Reflect card. */
export function acceptLucyOffer(input: GameState, playerId: string, deck: CardDeckState, random: () => number = Math.random): MythActionResult {
  const state = input as MythGameState;
  const runtime = activeRuntime(state);
  if (runtime.catalogueId !== "M09") throw new Error("Lucy is not offering a bargain.");
  const player = state.players.find(item => item.id === playerId && item.status === "alive");
  if (!player) throw new Error("A living player is required.");
  if (runtime.lucyAcceptedPlayerIds.includes(playerId)) throw new Error("Each player may accept Lucy's offer only once.");
  if (player.hearts < 1) throw new Error("A player must have at least one heart to accept Lucy's offer.");
  const remaining = { ...runtime, lucyAcceptedPlayerIds: [...runtime.lucyAcceptedPlayerIds, playerId] };
  const eligible = CARD_CATALOGUE.filter(card => card.effectId === "grant_invulnerability" || card.effectId === "reflect_next_damage");
  let pile = [...deck.drawPile];
  const awarded: string[] = [];
  for (const effectId of ["grant_invulnerability", "reflect_next_damage"]) {
    const candidates = pile.filter(id => eligible.some(card => card.id === id && card.effectId === effectId));
    const selected = candidates[randomIndex(candidates.length, random)];
    if (selected) { awarded.push(selected); pile.splice(pile.indexOf(selected), 1); }
  }
  const next: MythGameState = {
    ...state,
    players: state.players.map(item => item.id === playerId ? { ...item, hearts: item.hearts - 1, status: item.hearts <= 1 ? "eliminated" as const : item.status, hand: [...item.hand, ...awarded] } : item),
    mythRuntime: remaining
  };
  return { state: next, deck: { drawPile: pile, discardPile: [...deck.discardPile] }, messages: [`Lucy grants ${awarded.length} pact card(s) to ${playerId}.`], removed: false };
}

/** Removes a Myth monster with the Instant Kill curse, regardless of infinite HP. */
export function instantKillMyth(input: GameState, monsterId: string): MythActionResult {
  const state = input as MythGameState;
  const runtime = activeRuntime(state);
  if (runtime.monsterId !== monsterId) throw new Error("The selected Myth Monster is not active.");
  const next = removeMyth(state);
  return { state: next, messages: [`${runtime.catalogueId} was removed by Instant Kill.`], removed: true };
}

/** Call once per completed player turn to advance global Myth timers and idle conditions. */
export function advanceMythTurn(input: GameState, playerId: string, random: () => number = Math.random): MythActionResult {
  const state = input as MythGameState;
  const runtime = activeRuntime(state);
  let nextRuntime = { ...runtime };
  let workingState: MythGameState = state;
  if (runtime.catalogueId === "M03") {
    const player = state.players.find(item => item.id === playerId && item.status === "alive");
    if (player && player.cardsPlayedThisTurn >= 3 && player.hand.length > 0) {
      const discardedIndex = randomIndex(player.hand.length, random);
      workingState = {
        ...workingState,
        players: workingState.players.map(item => item.id === playerId
          ? { ...item, hand: item.hand.filter((_, index) => index !== discardedIndex) }
          : item)
      };
    }
  }
  if (runtime.catalogueId === "M02") {
    nextRuntime.granfelIdleTurns = runtime.granfelIdleTurns + 1;
    if (nextRuntime.granfelIdleTurns >= 3) {
      const removed = leaveGranfel({ ...workingState, mythRuntime: nextRuntime }, random);
      return { state: removed, messages: ["Granfel leaves after three turns without a trade and grants Resurrection to two random players."], removed: true };
    }
  }
  if (runtime.catalogueId === "M01" || runtime.catalogueId === "M03" || runtime.catalogueId === "M05" || runtime.catalogueId === "M06" || runtime.catalogueId === "M09" || runtime.catalogueId === "M10") {
    nextRuntime.turnsRemaining = Math.max(0, runtime.turnsRemaining - 1);
  }
  let next: MythGameState = { ...workingState, mythRuntime: nextRuntime };
  if (nextRuntime.turnsRemaining === 0 && runtime.turnsRemaining > 0) next = removeMyth(next);
  if (runtime.catalogueId === "M05" && !next.monsters.some(monster => monster.active && monster.catalogueId === "M05")) {
    next = { ...next, mythRuntime: { ...next.mythRuntime!, hiddenHands: false } };
  }
  return { state: next, messages: [`Myth timer advanced by player ${playerId}.`], removed: !next.monsters.some(monster => monster.id === runtime.monsterId && monster.active) };
}

/** Nyxia leaves immediately when any player successfully uses a Luck card. */
export function notifyLuckCardUsed(input: GameState): MythActionResult {
  const state = input as MythGameState;
  const runtime = activeRuntime(state);
  if (runtime.catalogueId !== "M05") throw new Error("Nyxia is not active.");
  return { state: removeMyth(state), messages: ["Nyxia disappears after a Luck card is used."], removed: true };
}

/** Void disappears immediately after any player death. */
export function notifyPlayerDeathToMyth(input: GameState): MythActionResult {
  const state = input as MythGameState;
  const runtime = state.mythRuntime;
  if (!runtime || runtime.catalogueId !== "M10") return { state, messages: [], removed: false };
  const isActive = state.monsters.some(monster => monster.id === runtime.monsterId && monster.active);
  return { state: isActive ? removeMyth(state) : state, messages: ["Void disappears after a player dies."], removed: true };
}

/** Engine/UI adapter: exposes the state needed to render Myth interactions without implying a UI exists. */
export function getMythInteractionState(input: GameState): {
  catalogueId: MythId; monsterId: string; turnsRemaining: number; hiddenHands: boolean;
  linkedHp: boolean; offerings: Record<string, string[]>; lucyAcceptedPlayerIds: string[];
} | null {
  const state = input as MythGameState;
  const runtime = state.mythRuntime;
  if (!runtime) return null;
  const isActive = state.monsters.some(monster => monster.id === runtime.monsterId && monster.active);
  return {
    catalogueId: runtime.catalogueId,
    monsterId: runtime.monsterId,
    turnsRemaining: runtime.turnsRemaining,
    hiddenHands: isActive && runtime.hiddenHands,
    linkedHp: isActive && runtime.linkedHp,
    offerings: runtime.offerings,
    lucyAcceptedPlayerIds: runtime.lucyAcceptedPlayerIds
  };
}
