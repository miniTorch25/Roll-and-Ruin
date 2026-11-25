# Monster Combat Foundation

The monster catalogue is connected to the game-state monster records through `src/monsters/engine.ts`.

- `summonRandomMonster` chooses one monster from a requested rank, copies its catalogue HP, damage, interval, targeting pattern, special-rule text, reward, and lore into a live instance, and returns the mandatory first-summon attack event.
- A maximum of four active monsters is enforced by the existing turn engine.
- `damageMonster` applies ordinary damage to finite-HP monsters and deactivates them at zero HP.
- Catalogue entries with `hp: null` remain immune to ordinary damage; their listed special conditions must be implemented explicitly.
- Monsters with `attackInterval: null` can still emit their first-summon event, but are not included in later scheduled attacks.
- `clearActiveMonsters` deactivates all active monsters while retaining their records; reward resolution remains explicit.

This is the shared data/combat foundation. Monster-specific abilities, attack damage application to players, death rewards, special tile triggers, and card/UI integration are not implied by these generic functions.
