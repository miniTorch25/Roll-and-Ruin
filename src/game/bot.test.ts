import { describe, expect, it } from "vitest";
import { chooseBotAction } from "./bot";
import type { GamePlayer } from "./turnEngine";

function player(hand: string[]): Pick<GamePlayer, "hand"> {
  return { hand };
}

describe("chooseBotAction", () => {
  it("draws when the bot has fewer than three cards", () => {
    expect(chooseBotAction(player(["a", "b"]))).toBe("draw_two_roll_one");
    expect(chooseBotAction(player([]))).toBe("draw_two_roll_one");
  });

  it("prioritizes movement when the bot has enough cards", () => {
    expect(chooseBotAction(player(["a", "b", "c"]))).toBe("roll_two_dice");
    expect(chooseBotAction(player(["a", "b", "c", "d"]))).toBe("roll_two_dice");
  });

  it("only selects movement or draw actions, never a card-play action", () => {
    expect(chooseBotAction(player(["a"]))).toBe("draw_two_roll_one");
    expect(chooseBotAction(player(["a", "b", "c"]))).toBe("roll_two_dice");
  });
});
