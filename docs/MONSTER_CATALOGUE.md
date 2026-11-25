# Monster Catalogue

`src/monsters/catalogue.ts` contains the 50 monster definitions transcribed from the Monster List in `Roll_and_Ruin_Rules.txt`.

- Five ranks: Common, Rare, Epic, Legend, and Myth.
- Ten monsters per rank.
- Each entry preserves its name, species, HP, attack damage, fixed attack interval when one is explicitly specified, target pattern/count where the rules make it explicit, special-rule bullets, reward text, and lore text.
- `hp: null` represents the rules' explicit `infinity` value. It is not a guessed numeric HP.
- `attackInterval: null` means the rules do not define a fixed scheduled attack interval; summon-only and event-driven behavior remains in the verbatim `rules` field.
- `getRandomMonsterByRank` uses an injectable random source for deterministic tests.

This is a data catalogue, not a monster combat engine. It does not yet resolve monster abilities, HP damage, reflection, death/revival, summon-time attacks, special tile positions, or rewards. Those remain separate integrations so the exact special rules are not approximated by generic attacks.
