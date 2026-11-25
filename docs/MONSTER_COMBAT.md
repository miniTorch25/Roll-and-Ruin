# Monster Combat Foundation

The monster catalogue is connected to the game-state monster records through `src/monsters/engine.ts`.

- `summonRandomMonster` chooses one monster from a requested rank, copies its catalogue HP, damage, interval, targeting pattern, special-rule text, reward, and lore into a live instance, and returns the mandatory first-summon attack event.
- A maximum of four active monsters is enforced by the existing turn engine.
- `damageMonster` applies ordinary damage to finite-HP monsters and deactivates them at zero HP.
- Catalogue entries with `hp: null` remain immune to ordinary damage; their listed special conditions must be implemented explicitly.
- Monsters with `attackInterval: null` can still emit their first-summon event, but are not included in later scheduled attacks.
- `clearActiveMonsters` deactivates all active monsters while retaining their records; reward resolution remains explicit.

## Monster attack damage

`resolveMonsterAttackEvents` consumes the attack events returned by the turn engine or by a summon card and applies the monster's catalogue attack damage to each still-living target.

- Player shields absorb ordinary monster damage before HP.
- Catalogue rules containing the explicit shield-bypass wording bypass shields (currently Vampy and Ragnar).
- Player invulnerability prevents ordinary monster damage.
- A player's one-hit reflection charge can reflect the HP damage back to the attacking monster.
- Vampy restores 2 HP after an attack, up to its maximum HP.

This is the shared baseline, not a complete implementation of all 50 monsters. Special attack effects, target selection exceptions, triggered tile attacks, poison and other status effects, instant-kill rules, monster-specific removal conditions, death rewards, and BoardScene integration remain separate work.


## Implemented monster-applied player statuses

- **Stoney (R04):** a successful attack applies a one-turn one-die limit.
- **Scorpy (R07):** a successful attack applies Poison for three owner turns. Poison deals 1 HP directly at the start of each affected player's turn, before their action; it bypasses shields and can trigger the normal heart-loss, Resurrection, and elimination flow.
- **Frosty (R10):** a successful attack limits the target to two cards during their next turn.
- Status effects are refreshed when the same monster applies the same status again. Invulnerability-prevented attacks and attacks that already caused a death do not apply these secondary effects.


## Implemented Common monster abilities

- **Zomzom (C03):** restores 1 HP after each attack, up to its catalogue maximum HP.
- **Fang (C06):** each Fang deals +1 damage while at least two active Fang/Wolf instances are on the board. The bonus is recalculated for every attack, so it disappears when the pack is reduced to one active Wolf.
