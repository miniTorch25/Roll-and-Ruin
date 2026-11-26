# Monster Combat Foundation

The monster catalogue is connected to the game-state monster records through `src/monsters/engine.ts`.

- `summonRandomMonster` chooses one monster from a requested rank, copies its catalogue HP, damage, interval, targeting pattern, special-rule text, reward, and lore into a live instance, and returns the mandatory first-summon attack event.
- A maximum of five active monsters is enforced, with per-rank limits: Common 5, Rare 5, Epic 4, Legend 3, Myth 1.
- Summon cards return a structured warning instead of summoning when the board-wide or rank-specific limit is reached.
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

This is the shared baseline, not a complete implementation of all 50 monsters. Several Common, Rare, Legend, and Myth exceptions are implemented in dedicated modules and BoardScene integration, but the remaining catalogue rules still require a monster-by-monster audit and regression coverage.


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
- **Webby (C05):** an Attack-card defeat marks its monster-damage event with `rewardSuppressed: true`, including Monster Hunter and Grenade splash. The centralized reward resolver skips the normal reward for this event.
- **Batty (C08):** uses a fresh random target selection for each scheduled attack; no target is remembered.
- **Sneaky (C10):** on each scheduled attack, steals one random card from every selected target who has a card. The stolen cards are stored on Sneaky and returned to their original owners when it is defeated.


## Additional Rare monster abilities

- **Bob (R01):** a successful attack applies Slow for the target's next owner turn, reducing movement by one step.
- **Chesty (R02):** scheduled attacks target a living player with the largest hand; ties are selected randomly. Its extra green-card defeat reward is included in the defeat event and consumed by the centralized reward resolver.
- **Wizzy (R03):** after a successful attack, the target rolls one D6; on 1–2, a second 2-damage blast is applied.
- **Stoney (R04):** limits the target to one die on their next turn.
- **Vampy (R05):** bypasses Defense shields and heals 2 HP after attacking, up to maximum HP.
- **Ghosty (R06):** ignores damage below 3. The current damage API is used by Attack-card monster damage paths.
- **Scorpy (R07):** applies three-turn Poison that deals 1 direct HP at the start of the target's turns.
- **Harpy (R08):** after attacking, discards one random card from the target if they still have cards.
- **Minoo (R09):** receives a random corner position when summoned; crossing that position emits a movement-trigger attack event and the scene resolves it immediately.
- **Frosty (R10):** limits the target to two cards on their next turn.


## Minoo and Chesty reward metadata

- **Minoo (R09):** receives a randomly selected corner position (0, 8, 16, or 24) when summoned. Movement across that position emits a movement-trigger attack event against the moving player, and the scene resolves the event immediately.
- **Chesty (R02):** its defeat event includes `bonusReward: { greenCards: 1 }`; the centralized reward resolver grants this in addition to the normal three-card reward.


## Centralized monster reward resolution

- A defeated monster normally grants three random cards from the Prank (yellow) or Curse (red) pools.
- A monster with a catalogue-specific reward uses that reward instead of the default three-card reward.
- Chesty adds one green card to its default reward.
- Webby's `rewardSuppressed` event flag withholds its normal reward.
- `resolveMonsterDefeatRewards` consumes eligible cards from the supplied shared draw pile and adds them to the defeating player's hand. It does not recycle the discard pile when a category is depleted.
- `resolveCardEffect` automatically resolves monster rewards when a deck is supplied in its options; callers without a deck can invoke the reward resolver separately.


## Legend monster offerings and Phoenix revival

- **Lizzie (L01):** leaves after receiving four Support cards.
- **Sphinxy (L02):** leaves after receiving two Prank (yellow) cards.
- **Gini (L03):** trades three contributed cards for one card selected from the draw pile.
- **Unico (L04):** leaves after two green cards and heals every living player by 10 HP (up to max HP).
- **Lepri (L05):** trades one contributed card for two random draw-pile cards, up to three times; leaves after the third exchange.
- **Fenny (L06):** revives once at full HP when defeated; a second defeat is final. It also leaves when given a Resurrection card.
- **Mirro (L07):** leaves after two blue Defense cards.
- **Treeo (L08):** leaves after three green cards.
- **Dwarfy (L09):** leaves after two blue cards and grants up to three random blue Defense cards.
- **Kingo (L10):** accepts five contributed cards from one or more players, leaves, and gives one random Curse card to a player tied for the largest contribution.
- Offerings are resolved through `resolveLegendOffering`; callers provide explicit card selections and the current shared deck. Contributions move to the discard pile.


### Legend reflection damage

- **Sphinxy (L02), Dwarfy (L09), and Kingo (L10):** reflect 50% of HP damage dealt to them.
- **Lepri (L05) and Treeo (L08):** reflect 30% of HP damage dealt to them.
- **Unico (L04) and Mirro (L07):** reflect 100% of HP damage dealt to them.
- Reflected damage is rounded down to a whole HP. Mirro's reflected damage bypasses Defense shields; the other Legend reflections can be absorbed by shields.
- Reflection is applied to Monster Hunter hits and monster splash hits from Grenade.
