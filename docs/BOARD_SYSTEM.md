# Board System — Rule-Aligned Core

The authoritative source is `Roll_and_Ruin_Rules.txt`.

## Board layout
- Exactly 32 spaces.
- Four sides with nine spaces per side; shared corner spaces are counted once.
- The visual prototype draws a 32-space isometric perimeter.

## Special spaces
- **Prison:** exactly 2 spaces; a player who lands here skips their next 3 turns.
- **Mystery:** draw 1 random card.
- **Monster:** summon 1 random monster.
- **Dice:** gain 1 additional die (the exact random-die behavior remains configurable until its resolution timing is finalized).

The rules specify a maximum of 4 Mystery, 4 Monster, and 4 Dice spaces, but do not specify exact counts. Therefore `createBoardState` requires those counts as configuration instead of silently choosing values. Prison is always placed exactly twice.

## Placement and regeneration
- Special spaces are randomly distributed.
- A special space cannot be placed on a position occupied by a player.
- When a player completes a full lap, the special-space layout is regenerated using the same configured counts.
- `moveAndRegenerateBoard` handles full-lap regeneration and accepts the post-movement occupied positions.

## Movement events
- `getMovementPath` returns every space entered, including spaces crossed before landing and each completed start-space crossing.
- Ordinary special-tile effects are checked on the landing space after movement.
- Passed spaces remain available to movement-triggered monster rules such as Minoo's corner ambush; those monster-specific effects are handled by the monster layer.

## Prison turn handling
- Prison sets a three-turn skip counter.
- A skipped turn still passes through the Monster Attack phase and advances each active monster's own turn counter.
- The local prototype automatically advances past imprisoned players.
- Monster damage resolution remains a separate system; being imprisoned does not make a player immune to monster attacks.

## Remaining integration
- The board core exposes special tile placement, movement paths, landing events, and regeneration.
- Mystery draw and Monster summon require the real card/monster catalogues to be connected.
- Dice tile bonus timing and random-die resolution need a final explicit rule before they are hardcoded.
