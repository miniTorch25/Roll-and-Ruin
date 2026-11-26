# Myth Monsters M01–M10

This module implements the Myth-specific state and player interaction rules from `Roll_and_Ruin_Rules.txt`.

## Engine APIs

- `summonMyth`: creates one Myth monster and applies its summon effects.
- `applyHecateLinkedDamage`: direct API for Hecate's shared-HP rule; ordinary card and monster damage is also routed through the shared-damage hook.
- `offerHecateCards`: consumes exactly three yellow cards and awards four random Curse cards.
- `offerGranfelTrade`: exchanges all yellow cards in a player's hand for random Curse cards.
- `offerMythCards`: records multi-player offerings for Ragnar and Ouro.
- `acceptLucyOffer`: resolves Lucy's one-time heart-for-Immortality-and-Reflect bargain per player.
- `chooseNyxiaRandomCard`: selects a random card ID without exposing the hand list.
- `instantKillMyth`: removes the active Myth regardless of its HP.
- `advanceMythTurn`: advances timers, Granfel's idle counter, and Chronos's three-card penalty.
- `notifyLuckCardUsed` / `notifyPlayerDeathToMyth`: explicit removal-condition hooks for non-BoardScene callers.
- `getMythInteractionState`: read-only state for UI rendering.

## Rules represented

| ID | Engine coverage |
|---|---|
| M01 Hecate | Summon kill, shared HP damage, three-yellow/four-Curse offering, two-Curse defeat reward, six-turn expiry |
| M02 Granfel | First-summon attack, yellow-to-Curse exchange, random 4–12 threshold, three idle turns, two Resurrection gifts |
| M03 Chronos | Skip-next-turn statuses, discard one card after three card plays, five-turn expiry |
| M04 Anubix | Random resurrection and one-heart penalty to the lowest-HP player; Instant Kill removal |
| M05 Nyxia | Hidden hand, random card selection, four-turn expiry, Luck removal |
| M06 Ragnar | 15 damage, all-living attack every two turns, shield piercing, ten-card group offering, eight-turn expiry |
| M07 Pandy | Three-card distribution to every living player and immediate removal |
| M08 Ouro | Three damage to all living players every turn, infinite-HP behavior, four-color offering |
| M09 Lucy | First-summon attack, three-turn expiry, one-time heart-for-two-buffs bargain per player |
| M10 Void | Half-hand discard on summon, five-turn expiry, automatic removal in the player-death pipeline |

## Player-facing integration

The Phaser BoardScene now:
- routes Myth summon cards through `summonMyth` and resolves first-summon attacks;
- resolves scheduled monster attacks before player turns;
- advances Myth timers at player-turn boundaries, including skipped turns;
- displays active monster names, HP, attack values, and rules;
- exposes Hecate, Granfel, Ragnar, Ouro, and Lucy interaction buttons;
- hides card identities during Nyxia and offers a random-card action;
- connects Instant Kill to active Myth targets;
- passes the shared deck through card resolution and reward consumption.

Legend offering buttons are also available in the same monster panel.

## Remaining UI limitations

- Target selection currently uses browser prompts rather than custom in-game dialogs.
- Kingo's UI currently accepts the full five-card offering from the active player; the engine supports multi-player contributions, but the UI does not yet provide a multi-player contribution editor.
- This remains a local four-player prototype, not network multiplayer.
