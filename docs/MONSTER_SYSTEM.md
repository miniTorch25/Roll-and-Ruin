# Monster Catalogue — Source-Aligned Foundation

The authoritative monster list is the **50-monster section** in `Roll_and_Ruin_Rules.txt`. The structured definitions are stored in `src/game/monsterCatalogue.ts`.

## Catalogue coverage

| Rank | Count |
|---|---:|
| Common | 10 |
| Rare | 10 |
| Epic | 10 |
| Legend | 10 |
| Myth | 10 |
| **Total** | **50** |

Each definition records its source ID, display name, species, rank, base HP, damage, attack interval, optional target count, optional all-living-player targeting, shield bypass where stated, and a summary of its special rules.

## Data conventions

- `hp: null` represents a monster whose HP is listed as infinity in the source rules. It is not the same as 0 HP.
- `attackInterval: null` means the monster has no recurring scheduled attack in the catalogue; its summon-time event or special ability is handled separately.
- A missing `targetCount` uses one random living target for scheduled attacks.
- `targetCount` is used for monsters with a defined multi-target attack.
- `attackPattern: "all_living"` is used for Ragnar, whose scheduled attack targets every living player.
- Source abilities and reward notes are preserved in `specialRules` so later implementation can be checked against the original design instead of invented.

## Current integration

- All five Summon cards choose one random definition from the matching rank.
- Summoned instances copy catalogue identity, rank, HP, maximum HP, damage, attack cadence, target count, attack pattern, and shield-bypass metadata.
- Summoning uses the existing four-active-monster limit.
- The summon operation returns the existing immediate attack event against all living players.
- The turn engine skips recurring attack scheduling for monsters whose interval is `null`.

## Not implemented yet

The catalogue is structured data, not a complete monster AI/combat resolver. Monster attack events are not yet applied as HP/shield damage by the local UI. Special abilities, reflection, status application, card theft/return, timed disappearance, tribute/offer interactions, defeat rewards, Minoo pass-through ambushes, and monster-specific exceptions remain separate work.
