# Myth Monsters M01–M10

This module implements the Myth-specific state and player interaction rules from `Roll_and_Ruin_Rules.txt`.

## Engine APIs

- `summonMyth`: creates one Myth monster and resolves its immediate summon effects.
- `applyHecateLinkedDamage`: applies the linked-HP damage rule to all living players.
- `offerGranfelTrade`: exchanges a player's yellow cards for random curse cards.
- `offerMythCards`: records multi-player offerings for Ragnar and Ouro.
- `acceptLucyOffer`: resolves Lucy's one-time heart-for-buffs bargain.
- `instantKillMyth`: removes the active Myth regardless of infinite HP.
- `advanceMythTurn`: advances turn-based expiration and Granfel's idle counter.
- `notifyLuckCardUsed` / `notifyPlayerDeathToMyth`: explicit removal-condition hooks.
- `getMythInteractionState`: read-only data for a future UI adapter.

## Rules represented

| ID | Engine coverage |
|---|---|
| M01 Hecate | Summon kill, shared-HP state, six-turn expiry |
| M02 Granfel | Initial attack event, yellow-to-curse trade, random 4–12 trade target, three idle turns |
| M03 Chronos | Skip-next-turn statuses, five-turn expiry |
| M04 Anubix | Random resurrection and heart penalty to lowest-HP player |
| M05 Nyxia | Hidden-hand flag, four-turn expiry, Luck removal hook |
| M06 Ragnar | 15 damage, all-living target pattern, two-turn interval, ten-card group offering, eight-turn expiry |
| M07 Pandy | Three-card distribution per living player and immediate removal |
| M08 Ouro | Three damage, all-living target pattern, one-turn interval, four-color offering |
| M09 Lucy | Five damage on summon, three-turn expiry, one-time heart-for-Immortality-and-Reflect offer |
| M10 Void | Half-hand discard on summon, five-turn expiry, player-death removal hook |

## Integration boundary

This is an engine module, not a completed player-facing interface. The caller must:
- route Myth summon cards to `summonMyth`;
- pass the returned deck state to the active deck owner;
- resolve the returned first-summon attack event;
- call `advanceMythTurn` once at the agreed global turn boundary;
- call `notifyLuckCardUsed` and `notifyPlayerDeathToMyth` from the card and death pipelines;
- use `getMythInteractionState` to render offerings and hidden-hand indicators.

The existing BoardScene does not yet provide the offering dialogs or hidden-hand overlay. Those are tracked as UI integration work and must not be marked complete based on engine coverage alone.
