# Card Effect Resolver — Foundation

The authoritative 60-card definitions remain in `Roll_and_Ruin_Rules.txt` and `src/cards/catalogue.ts`.

This first resolver slice handles deterministic player-state effects:
- HP healing (including the maximum-HP cap).
- Permanent maximum-HP increases.
- Hearts, capped at three.
- Shields, capped at three.
- Team shield and team healing with an explicit teammate selection; the rules' solo-team fallback is supported.
- Greater Heal's stop-card-play condition.
- Current-turn attack/defense bonuses, invulnerability, reflection, and the next-attack bonus.
- Clearing negative statuses tracked by the card runtime.

Call `resolveCardEffect(state, cardDefinitionOrId, options)` after `playCatalogueCard`. The card must already have been removed from the hand and its catalogue score applied. The resolver does not move played cards into the discard pile.

The resolver stores card-specific runtime data in an additive `cardRuntime` field on the game state so the existing turn-engine player schema remains compatible. Shield values are capped at three.

Not yet implemented: target-driven attacks and pranks, monster interactions and summon effects, resurrection/death sequencing, curse payment and cooldowns, movement/dice manipulation, and status-duration ticking. These effects fail explicitly instead of silently pretending to resolve. The local BoardScene is not connected to this resolver yet.
