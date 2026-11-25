# Turn Engine — Rule-Aligned Core

The authoritative source is `Roll_and_Ruin_Rules.txt`. This document describes only the engine behavior implemented here; card effects, tile effects, monster-specific effects, and match victory resolution remain separate systems.

## Match formats
- **1v1:** 2 players, 2 teams, 1 player per team.
- **1x4:** 4 players, 4 teams, 1 player per team.
- **2v2:** 4 players, 2 teams, 2 players per team.
- **2x4:** 8 players, 4 teams, 2 players per team.

## Starting player values
- HP: 20 (maximum HP: 20).
- Hearts: 3.
- Starting hand: exactly 4 card IDs supplied by the deck/catalogue layer.
- Board: 32 spaces, four sides with nine spaces per side and corners counted once.

The engine does not invent card IDs. The caller supplies the four starting cards from the authoritative 60-card catalogue. Human player counts may range from 1 to the selected mode's capacity. Missing seats are filled with bot players, and the deck layer must supply four starting cards for each generated bot.

Bot seats and team assignments are represented in state; automated bot decision-making is a separate controller that has not yet been implemented.

## Turn sequence
1. Monster Attack.
2. Turn Start.
3. Player Action.
4. Movement.
5. Special Tile Check.
6. Status Check.
7. Turn End.

## Player activities
- **Use cards:** play up to 3 cards during the activity. The card layer resolves each card's effect. Card play does not consume a card beyond those actually played. The movement roll remains one D6.
- **Draw:** draw up to 2 cards from the deck, then roll exactly one D6.
- **Roll:** roll exactly two D6 and move by their sum.

The engine accepts drawn card IDs from the deck layer and does not create placeholder catalogue entries.

## Movement and scoring
- Movement wraps around the 32-space board.
- Each completed full lap awards 2 points.
- Special-tile entry/pass-through effects are handled by the board/tile system, not invented here.

## Monsters
- A newly summoned monster immediately targets all living players once.
- Its scheduled attack counter then starts at zero.
- Every monster must provide its own positive `attackInterval`; no global interval is assumed.
- Scheduled attacks support random living targets, a target count, or all living players.
- A maximum of four active monsters may be present at once.
- The monster data/effect layer remains responsible for exact targeting exceptions, damage, statuses, and summon-cap enforcement is handled by this engine.

## Death and elimination
- Death removes one heart and restores HP to maximum at the starting space.
- If the player has at least 4 cards, randomly discard half, rounded up; otherwise discard none.
- A player with no hearts is eliminated. Resurrection card handling is resolved by the card/effect layer before final elimination.

## Not implemented by this engine
- Card catalogue/effects and discard-pile policy.
- Prison, Mystery, Monster, and Dice tile events and board regeneration.
- Monster damage, status effects, per-monster special behavior, rewards, and summon cap.
- Mode timers, automated bot decision-making, and match victory/tie resolution.
