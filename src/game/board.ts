export const BOARD_SIZE = 32;
export const PRISON_TILE_COUNT = 2;
export const MAX_TILES_PER_SPECIAL_TYPE = 4;

export type SpecialTileType = "prison" | "mystery" | "monster" | "dice";

export interface SpecialTileCounts {
  mystery: number;
  monster: number;
  dice: number;
}

export interface BoardTile {
  position: number;
  special?: SpecialTileType;
}

export interface BoardState {
  tiles: BoardTile[];
  specialTileCounts: SpecialTileCounts;
  regenerationCount: number;
}

export interface BoardMovement {
  from: number;
  to: number;
  traversedPositions: number[];
  passedPositions: number[];
  landedTile?: SpecialTileType;
  completedLaps: number;
}

function randomIndex(length: number, random: () => number): number {
  return Math.min(length - 1, Math.max(0, Math.floor(random() * length)));
}

function validatePositions(positions: number[]): void {
  for (const position of positions) {
    if (!Number.isInteger(position) || position < 0 || position >= BOARD_SIZE) {
      throw new Error(`Board position must be an integer from 0 to ${BOARD_SIZE - 1}.`);
    }
  }
}

function validateCounts(counts: SpecialTileCounts, availableSpaces: number): void {
  for (const [type, count] of Object.entries(counts)) {
    if (!Number.isInteger(count) || count < 0 || count > MAX_TILES_PER_SPECIAL_TYPE) {
      throw new Error(`${type} tile count must be between 0 and ${MAX_TILES_PER_SPECIAL_TYPE}.`);
    }
  }
  const total = PRISON_TILE_COUNT + counts.mystery + counts.monster + counts.dice;
  if (total > availableSpaces) {
    throw new Error("There are not enough unoccupied spaces for the requested special tiles.");
  }
}

/** Builds a 32-space board and places exactly two Prison tiles plus configured counts of other types. */
export function createBoardState(
  specialTileCounts: SpecialTileCounts,
  occupiedPositions: number[] = [],
  random: () => number = Math.random
): BoardState {
  validatePositions(occupiedPositions);
  validateCounts(specialTileCounts, BOARD_SIZE - new Set(occupiedPositions).size);
  const occupied = new Set(occupiedPositions);
  const tiles: BoardTile[] = Array.from({ length: BOARD_SIZE }, (_, position) => ({ position }));
  const available = tiles.filter((tile) => !occupied.has(tile.position)).map((tile) => tile.position);

  const placements: SpecialTileType[] = [
    ...Array.from({ length: PRISON_TILE_COUNT }, () => "prison" as const),
    ...Array.from({ length: specialTileCounts.mystery }, () => "mystery" as const),
    ...Array.from({ length: specialTileCounts.monster }, () => "monster" as const),
    ...Array.from({ length: specialTileCounts.dice }, () => "dice" as const)
  ];

  for (const special of placements) {
    const index = randomIndex(available.length, random);
    const position = available.splice(index, 1)[0];
    tiles[position] = { position, special };
  }

  return {
    tiles,
    specialTileCounts: { ...specialTileCounts },
    regenerationCount: 0
  };
}

/** Re-rolls every special tile while preserving counts and never covering an occupied player space. */
export function regenerateSpecialTiles(
  board: BoardState,
  occupiedPositions: number[],
  random: () => number = Math.random
): BoardState {
  validatePositions(occupiedPositions);
  validateCounts(board.specialTileCounts, BOARD_SIZE - new Set(occupiedPositions).size);
  const occupied = new Set(occupiedPositions);
  const tiles: BoardTile[] = Array.from({ length: BOARD_SIZE }, (_, position) => ({ position }));
  const available = tiles.filter((tile) => !occupied.has(tile.position)).map((tile) => tile.position);
  const placements: SpecialTileType[] = [
    ...Array.from({ length: PRISON_TILE_COUNT }, () => "prison" as const),
    ...Array.from({ length: board.specialTileCounts.mystery }, () => "mystery" as const),
    ...Array.from({ length: board.specialTileCounts.monster }, () => "monster" as const),
    ...Array.from({ length: board.specialTileCounts.dice }, () => "dice" as const)
  ];

  for (const special of placements) {
    const index = randomIndex(available.length, random);
    const position = available.splice(index, 1)[0];
    tiles[position] = { position, special };
  }

  return {
    tiles,
    specialTileCounts: { ...board.specialTileCounts },
    regenerationCount: board.regenerationCount + 1
  };
}

/** Returns every space entered after leaving from, including each crossed start-space/lap. */
export function getMovementPath(from: number, steps: number): {
  positions: number[];
  completedLapPositions: number[];
} {
  validatePositions([from]);
  if (!Number.isInteger(steps) || steps < 0) {
    throw new Error("Movement steps must be a non-negative integer.");
  }
  const positions: number[] = [];
  const completedLapPositions: number[] = [];
  for (let step = 1; step <= steps; step++) {
    const position = (from + step) % BOARD_SIZE;
    positions.push(position);
    if (position === 0) completedLapPositions.push(position);
  }
  return { positions, completedLapPositions };
}

/** Only the final space is checked for ordinary special-tile landing effects. */
export function resolveBoardMovement(board: BoardState, from: number, steps: number): BoardMovement {
  const path = getMovementPath(from, steps);
  const to = path.positions.at(-1) ?? from;
  const landed = steps > 0 ? board.tiles[to]?.special : undefined;
  return {
    from,
    to,
    traversedPositions: path.positions,
    passedPositions: path.positions.slice(0, -1),
    landedTile: landed,
    completedLaps: path.completedLapPositions.length
  };
}

/** Resolves movement and regenerates the special-tile layout once for every completed lap. */
export function moveAndRegenerateBoard(
  board: BoardState,
  from: number,
  steps: number,
  occupiedPositionsAfterMove: number[],
  random: () => number = Math.random
): { board: BoardState; movement: BoardMovement } {
  const movement = resolveBoardMovement(board, from, steps);
  let nextBoard = board;
  for (let lap = 0; lap < movement.completedLaps; lap++) {
    nextBoard = regenerateSpecialTiles(nextBoard, occupiedPositionsAfterMove, random);
  }
  return { board: nextBoard, movement };
}
