import { describe, expect, it } from "vitest";
import { chooseBotAction } from "./bot";
import type { GamePlayer } from "./turnEngine";

function player(hand: string[], statusEffects: GamePlayer["statusEffects"] = []): Pick<GamePlayer, "hand" | "statusEffects"> {
  return { hand, statusEffects };
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

  it("does not rely on card actions while card use is silenced", () => {
    expect(chooseBotAction(player(["a"], [{ type: "cards_silenced", turnsRemaining: 2 }]))).toBe("draw_two_roll_one");
  });
});
