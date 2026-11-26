# Monster Catalogue

`src/monsters/catalogue.ts` contains the 50 monster definitions transcribed from the Monster List in `Roll_and_Ruin_Rules.txt`.

- Five ranks: Common, Rare, Epic, Legend, and Myth.
- Ten monsters per rank.
- Each entry preserves its name, species, HP, attack damage, fixed attack interval when one is explicitly specified, target pattern/count where the rules make it explicit, special-rule bullets, reward text, and lore text.
- `hp: null` represents the rules' explicit `infinity` value. It is not a guessed numeric HP.
- `attackInterval: null` means the rules do not define a fixed scheduled attack interval; summon-only and event-driven behavior remains in the verbatim `rules` field.
- `getRandomMonsterByRank` uses an injectable random source for deterministic tests.

## Runtime integration status

The catalogue is connected to the game logic for all 50 monsters. The data remains separate from the runtime so each exception is implemented explicitly rather than inferred from descriptive text.

- Shared engine: summoning, rank/board limits, first-summon attacks, scheduled attack intervals, target counts, finite/infinite HP, and defeat state.
- Common and Rare exceptions: dedicated combat effects, status application, targeting, theft/return, and movement-trigger attacks.
- Epic entries: scheduled attack data and exact catalogue-specific reward categories/counts.
- Legend entries: offering/exchange conditions, reflection, revival, and leave conditions.
- Myth entries: summon-time effects, timed rules, group offerings, player bargains, Instant Kill removal, and reward handling.

Regression tests for these integrations are maintained in `src/game/turnEngine.test.ts`, `src/monsters/*.test.ts`, and `src/cards/effectResolver.test.ts`. Browser end-to-end playtesting is tracked separately in the project roadmap.
