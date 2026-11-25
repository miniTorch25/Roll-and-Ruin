export interface LocalTurnState {
  turnNumber: number;
  playerName: string;
  position: number;
  score: number;
  handCount: number;
}
export function createInitialTurnState(): LocalTurnState {
  return { turnNumber: 1, playerName: "ผู้เล่น 1", position: 0, score: 0, handCount: 0 };
}