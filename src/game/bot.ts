import type { GamePlayer, PlayerAction } from "./turnEngine";

/**
 * Baseline bot policy for the local 1x4 prototype.
 * Bots refill their hand when it is low; otherwise they prioritize movement.
 * Card-play decisions are intentionally deferred until card targeting can be automated safely.
 */
export function chooseBotAction(player: Pick<GamePlayer, "hand">): Exclude<PlayerAction, "use_cards"> {
  if (player.hand.length < 3) return "draw_two_roll_one";
  return "roll_two_dice";
}
