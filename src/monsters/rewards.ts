import { CARD_CATALOGUE, type CardColor } from "../cards/catalogue";
import type { CardDeckState } from "../cards/deck";
import type { GameState } from "../game/turnEngine";
import type { MonsterDamageEvent } from "./engine";

export interface MonsterRewardEvent {
  monsterId: string;
  playerId: string;
  cardIds: string[];
}

interface RewardRequest {
  color?: CardColor;
  allowedColors?: CardColor[];
  count: number;
}

const REWARD_COLORS: Record<string, CardColor> = {
  "ไพ่เกรียน": "yellow",
  "ไพ่เขียว": "green",
  "ไพ่คำสาป": "red",
  "ไพ่ฟ้า": "blue"
};

function parseSpecificReward(reward: string): RewardRequest[] {
  const requests: RewardRequest[] = [];
  const pattern = /(ไพ่เกรียน|ไพ่เขียว|ไพ่คำสาป|ไพ่ฟ้า)[^0-9]*([0-9]+)\s*ใบ/g;
  for (const match of reward.matchAll(pattern)) {
    const color = REWARD_COLORS[match[1]];
    const count = Number(match[2]);
    if (color && Number.isInteger(count) && count > 0) requests.push({ color, count });
  }
  if (requests.length === 0) throw new Error(`Unsupported monster reward description: ${reward}`);
  return requests;
}

function chooseCard(
  drawPile: string[],
  request: RewardRequest,
  random: () => number
): string | undefined {
  const allowed = request.allowedColors ?? (request.color ? [request.color] : []);
  const candidates = drawPile
    .map((id, index) => ({ id, index, definition: CARD_CATALOGUE.find((card) => card.id === id) }))
    .filter((entry) => entry.definition && allowed.includes(entry.definition.color));
  if (candidates.length === 0) return undefined;
  const index = Math.min(candidates.length - 1, Math.max(0, Math.floor(random() * candidates.length)));
  const selected = candidates[index];
  drawPile.splice(selected.index, 1);
  return selected.id;
}

/**
 * Resolves defeat rewards against the shared draw pile.
 * A standard defeat grants three random Prank/Curse cards; catalogue rewards replace that default.
 */
export function resolveMonsterDefeatRewards(
  inputState: GameState,
  damageEvents: MonsterDamageEvent[],
  inputDeck: CardDeckState,
  random: () => number = Math.random
): { state: GameState; deck: CardDeckState; events: MonsterRewardEvent[] } {
  let state = inputState;
  const drawPile = [...inputDeck.drawPile];
  const events: MonsterRewardEvent[] = [];

  for (const damage of damageEvents) {
    if (!damage.defeated || !damage.sourcePlayerId) continue;
    const monster = state.monsters.find((item) => item.id === damage.monsterId);
    if (!monster) continue;
    const player = state.players.find((item) => item.id === damage.sourcePlayerId);
    if (!player) continue;

    const requests: RewardRequest[] = [];
    if (!damage.rewardSuppressed) {
      if (monster.reward) {
        requests.push(...parseSpecificReward(monster.reward));
      } else {
        requests.push({ allowedColors: ["yellow", "red"], count: 3 });
      }
    }
    if (damage.bonusReward?.greenCards) {
      requests.push({ color: "green", count: damage.bonusReward.greenCards });
    }

    const awarded: string[] = [];
    for (const request of requests) {
      for (let count = 0; count < request.count; count++) {
        const cardId = chooseCard(drawPile, request, random);
        if (!cardId) break;
        awarded.push(cardId);
      }
    }
    if (awarded.length > 0) {
      state = {
        ...state,
        players: state.players.map((item) => item.id === player.id
          ? { ...item, hand: [...item.hand, ...awarded] }
          : item)
      };
    }
    events.push({ monsterId: monster.id, playerId: player.id, cardIds: awarded });
  }

  return {
    state,
    deck: { drawPile, discardPile: [...inputDeck.discardPile] },
    events
  };
}
