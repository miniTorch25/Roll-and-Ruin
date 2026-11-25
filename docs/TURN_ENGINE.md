# Turn Engine — Confirmed Rules

This document records the rules implemented by the first game-logic layer. It deliberately leaves unspecified values and card/tile effects configurable.

## Match formats
- **1x4:** 4 teams, 1 player per team.
- **2x4:** 4 teams, 2 players per team.
- Starting hearts are supplied as match configuration; no unconfirmed starting-heart number is hardcoded.

## Player-turn sequence
1. Monster attack phase.
2. Player turn starts.
3. Player chooses exactly one action: use a card, draw a card, or roll the die.
4. Movement phase.
5. Special-tile check.
6. Player-status check.
7. Turn ends and passes to the next living player.

## Monsters
- A newly summoned monster immediately targets every living player.
- After the summon turn, its scheduled attack timer counts completed player turns.
- It attacks once after every two completed player turns by default.
- A scheduled monster using the normal pattern selects one random living player.
- Special attack patterns are represented as data and can be expanded without changing the turn engine.
- Damage values and monster-specific effects are intentionally not hardcoded because they have not been confirmed.

## Death and elimination
- Death removes one heart.
- The player returns to the starting tile.
- If the player has at least 4 cards, randomly discard half, rounded up.
- If the player has fewer than 4 cards, discard none.
- A player with no hearts remaining is marked eliminated.

## Scoring
- Individual and team scores may be negative.
- Team totals include points from eliminated members.

## Not yet specified
- Initial heart count.
- Exact card effects and card draw rules.
- Special tile effects.
- Monster damage and unique monster behaviours.
- Victory condition and match-end scoring.
