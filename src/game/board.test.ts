import { describe, expect, it } from "vitest";
import {
  BOARD_SIZE,
  createBoardState,
  type BoardTile,
  getMovementPath,
  moveAndRegenerateBoard,
  regenerateSpecialTiles,
  resolveBoardMovement
} from "./board";

describe("Roll and Ruin board rules", () => {
  it("creates exactly 32 spaces and places two Prison tiles", () => {
    const board = createBoardState({ mystery: 2, monster: 3, dice: 1 }, [], () => 0);
    expect(board.tiles).toHaveLength(BOARD_SIZE);
    expect(board.tiles.filter((tile) => tile.special === "prison")).toHaveLength(2);
    expect(board.tiles.filter((tile) => tile.special === "mystery")).toHaveLength(2);
    expect(board.tiles.filter((tile) => tile.special === "monster")).toHaveLength(3);
    expect(board.tiles.filter((tile) => tile.special === "dice")).toHaveLength(1);
  });

  it("never places a special tile on an occupied player space", () => {
    const occupied = [0, 1, 2, 31];
    const board = createBoardState({ mystery: 4, monster: 4, dice: 4 }, occupied, () => 0);
    for (const position of occupied) {
      expect(board.tiles[position].special).toBeUndefined();
    }
  });

  it("rejects counts above four and invalid board capacity", () => {
    expect(() => createBoardState({ mystery: 5, monster: 0, dice: 0 })).toThrow();
    expect(() => createBoardState({ mystery: 4, monster: 4, dice: 4 }, Array.from({ length: 20 }, (_, i) => i))).toThrow();
  });

  it("regenerates tile positions while preserving configured counts and occupied spaces", () => {
    const initial = createBoardState({ mystery: 1, monster: 2, dice: 3 }, [0, 8], () => 0);
    const next = regenerateSpecialTiles(initial, [0, 4, 8], () => 0.5);
    expect(next.regenerationCount).toBe(1);
    expect(next.specialTileCounts).toEqual(initial.specialTileCounts);
    expect(next.tiles.filter((tile) => tile.special === "prison")).toHaveLength(2);
    expect(next.tiles.filter((tile) => tile.special === "mystery")).toHaveLength(1);
    expect(next.tiles.filter((tile) => tile.special === "monster")).toHaveLength(2);
    expect(next.tiles.filter((tile) => tile.special === "dice")).toHaveLength(3);
    expect(next.tiles[0].special).toBeUndefined();
    expect(next.tiles[4].special).toBeUndefined();
    expect(next.tiles[8].special).toBeUndefined();
  });

  it("tracks every passed space and each completed lap", () => {
    const path = getMovementPath(30, 4);
    expect(path.positions).toEqual([31, 0, 1, 2]);
    expect(path.completedLapPositions).toEqual([0]);
  });

  it("regenerates the layout once per completed lap after movement", () => {
    const initial = createBoardState({ mystery: 1, monster: 1, dice: 1 }, [0], () => 0);
    const result = moveAndRegenerateBoard(initial, 30, 4, [2, 0], () => 0.5);
    expect(result.movement.completedLaps).toBe(1);
    expect(result.board.regenerationCount).toBe(1);
    expect(result.board.tiles[0].special).toBeUndefined();
    expect(result.board.tiles[2].special).toBeUndefined();
  });

  it("fires the ordinary special-tile check only on the landing space", () => {
    const generated = createBoardState({ mystery: 0, monster: 0, dice: 0 }, [], () => 0);
    const tiles: BoardTile[] = generated.tiles.map((tile) => ({ position: tile.position }));
    tiles[5] = { position: 5, special: "prison" };
    tiles[10] = { position: 10, special: "prison" };
    const board = { ...generated, tiles };
    const movement = resolveBoardMovement(board, 4, 2);
    expect(movement.passedPositions).toContain(5);
    expect(movement.landedTile).toBeUndefined();

    const landed = resolveBoardMovement(board, 4, 1);
    expect(landed.landedTile).toBe("prison");
  });

  it("does not trigger a landing event when the player does not move", () => {
    const board = createBoardState({ mystery: 0, monster: 0, dice: 0 }, [], () => 0);
    const prison = board.tiles.find((tile) => tile.special === "prison");
    const movement = resolveBoardMovement(board, prison!.position, 0);
    expect(movement.landedTile).toBeUndefined();
  });
});
