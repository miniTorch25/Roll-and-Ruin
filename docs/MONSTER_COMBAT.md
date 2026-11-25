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


## Additional Common monster defeat abilities

- **Shroomy (C07):** when a player defeats Shroomy with an Attack card, its spores deal 1 direct HP loss to that player. This loss bypasses shields and uses the normal death/Resurrection flow.
- **Rocky (C09):** Attack-card damage against Rocky is reduced by 1, with a minimum of 1 damage. This applies to Monster Hunter and monster splash damage from Grenade.


## Additional Common monster targeting and card-theft abilities

- **Gob (C01):** remembers the player it targeted on its previous scheduled attack. If that player is still alive, Gob targets them again with a 60% chance; otherwise, or on the remaining 40%, it chooses a different living player when one exists.
- **Bone (C02):** targets up to two distinct living players per scheduled attack. Its catalogue already defines the two-target count.
- **Ratty (C04):** attacks every turn, as defined by its one-turn interval.
- **Webby (C05):** an Attack-card defeat marks its monster-damage event with `rewardSuppressed: true`, including Monster Hunter and Grenade splash. The reward consumer can use this flag to withhold the normal reward.
- **Batty (C08):** uses a fresh random target selection for each scheduled attack; no target is remembered.
- **Sneaky (C10):** on each scheduled attack, steals one random card from every selected target who has a card. The stolen cards are stored on Sneaky and returned to their original owners when it is defeated.
