# Card Deck Core

The game uses the authoritative 60-card list in `Roll_and_Ruin_Rules.txt`, represented in `src/cards/catalogue.ts`.

- Blue: 12 Attack / Defense cards.
- Yellow: 12 Prank cards.
- Green: 12 Healing / Buff cards.
- Red: 5 Summon cards and 19 Curse cards.
- The catalogue stores the source names, descriptions, effect identifiers, parameters, and confirmed score values.
- Curse cost options are recorded as HP cost 5–10, discard 2 cards, or a 3-turn curse cooldown. Cooldown is eligible only when HP or cards are insufficient and may be used at most 3 times per player per game.
- Summon cards have no cost and summon one random monster from the matching rank.
- The deck core handles shuffle, draw, hand removal, and explicit discard. It does not resolve card effects automatically.
- The local prototype now shuffles the 60 real catalogue IDs and deals four starting cards to each player.
- `playCatalogueCard` now removes a real catalogue card, applies its confirmed score value, and returns its effect definition.
- Used cards are not automatically placed in the discard pile; the caller must explicitly discard them after effect resolution.
- The effect resolver, target-selection UI, curse-cost selection, and discard timing still need integration.
