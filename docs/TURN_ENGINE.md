# Turn Engine — Rule-Aligned Core

The authoritative source is `Roll_and_Ruin_Rules.txt`. This document describes implemented engine behavior; tile effects, monster-specific effects, and match victory resolution remain separate systems.

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
- Timed status effects start empty.

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

A player skipped by Sleep or Prison enters Turn End without taking an action. Monster attack counters still advance on skipped turns.

## Player activities
- **Use cards:** play up to 3 cards during the activity. The card layer resolves each card's effect. Card play does not consume a movement die; the movement roll remains one D6.
- **Draw:** draw up to 2 cards from the deck, then roll exactly one D6.
- **Roll:** normally roll exactly two D6 and move by their sum. A one-die status limits this activity to one D6.
- **Silence:** blocks the Use Cards activity but still allows dice activities.

Dice reduction is applied to each die face individually, with the configured minimum applied after reduction.

During the Use Cards activity, movement normally uses one D6. Lucky Dice can add one bonus die (the turn runtime supports at most two bonus dice, so the total never exceeds three). A one-die status takes precedence over bonus dice. Control Dice can replace the die faces for the current movement roll; active cursed-die reduction is still applied to the selected values. After the roll, temporary bonus and controlled values are consumed.

Lucky Clover grants one reroll charge. `rerollOneDie` replaces one selected die after the Use Cards movement roll, updates the movement total, and consumes the charge. The reroll also respects active cursed-die reduction.

The engine accepts drawn card IDs from the deck layer and does not create placeholder catalogue entries.

## Timed player statuses
Statuses are stored on each player with an owner-turn duration and are decremented at the end of that player's turn.

- **Sleep:** skips one upcoming turn.
- **Cursed Dice:** limits the next turn to one die.
- **Silence:** prevents card use for the configured turn.
- **Binding:** allows actions/cards but sets movement to zero for the configured turns.
- **Reverse Walk:** reverses movement direction for the next turn.
- **Cursed Die Faces:** reduces each die result by 2, with a minimum face value of 1, for the configured turns.
- **Weakness:** reduces attack-card damage by 2 for the configured turns.
- **Public Hand:** records a reveal-hand status for the configured turns; the caller/UI reads this status to keep the target hand visible.

Holy Water clears the player's timed negative statuses. Reapplying the same status type refreshes its duration rather than stacking duplicate entries.

## Movement and scoring
- Movement wraps around the 32-space board in either direction.
- Reverse movement counts a completed lap only when movement crosses the start boundary; moving backward from position 0 to position 31 does not award a lap by itself.
- Each completed full lap awards 2 points.
- Binding prevents movement without preventing the player's action or dice roll.
- Special-tile entry/pass-through effects are handled by the board/tile system, not invented here.

## Turn-scoped card runtime
- Invulnerability decreases at the end of the protected player's turn.
- Current-turn attack and defense-card bonuses expire at the end of that player's turn.
- Armor Seal blocks attack-card play for the remainder of the current turn.
- Curse cooldown turns are advanced by `endPlayerTurn` when card runtime is present.

## Monsters
- A newly summoned monster immediately targets all living players once.
- Its scheduled attack counter then starts at zero.
- Every monster must provide its own positive `attackInterval`; no global interval is assumed.
- Scheduled attacks support random living targets, a target count, or all living players.
- A maximum of four active monsters may be present at once.
- The monster data/effect layer remains responsible for exact targeting exceptions, damage, statuses, and rewards.

## Death and elimination
- Death removes one heart and restores HP to maximum at the starting space.
- If the player has at least 4 cards after any automatic Resurrection is consumed, randomly discard half, rounded up; otherwise discard none.
- If the final heart is lost while the player's hand contains `yellow_resurrection`, that card is consumed before random hand loss, and the player returns with 1 heart instead of being eliminated.
- An eliminated player can also be revived manually by another player's Resurrection card. Revival restores 1 heart, full HP, and position 0.

## Not implemented by this engine
- Special-tile event execution and board regeneration integration.
- Monster damage, HP, status effects, per-monster special behavior, and rewards.
- Automated bot decision-making, mode timers, and match victory/tie resolution.
- Online multiplayer, rooms, server-authoritative state, and reconnection handling.
