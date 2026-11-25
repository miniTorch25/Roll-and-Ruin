# Card Effect Resolver — Player Attacks

The authoritative card descriptions and numeric values remain in `Roll_and_Ruin_Rules.txt` and `src/cards/catalogue.ts`.

## Implemented attack effects

- **ดาบสามัญ:** 3 damage to one selected opposing living player.
- **ธนูแม่นยำ:** 2 damage that bypasses shields; shields are not consumed.
- **ขวานผ่าเกราะ:** removes all target shields, then deals 3 damage.
- **ฟ้าผ่าเปรี้ยง:** deals 2 damage to every other living player.
- **ดาบสองคม:** deals 6 damage to one target, then charges the user 2 HP separately from shields.
- **หมัดเอาคืน:** deals 4 damage if the target's current HP is lower than the user's; otherwise 2.

Attack bonuses from the current runtime are added to each attack action. The next-attack bonus is consumed once by the next attack card, not once per target in an area attack.

## Incoming damage order

1. Invulnerability prevents ordinary damage.
2. Shields absorb damage before HP, at one shield per damage.
3. Piercing attacks bypass shields without consuming them.
4. Remaining damage reduces HP.
5. A player reaching 0 HP uses the existing turn-engine death flow: lose one heart, return to start with full HP, and randomly discard half of the hand rounded up when holding at least four cards.
6. A reflection charge reflects the HP damage actually received back to the player who caused it. The reflected hit follows normal shield/invulnerability checks but cannot trigger another reflection.

The axe removes shields before its hit is checked. Double-Edged Sword's self-HP cost bypasses shields and does not count as an incoming attack.

## Integration contract

Call `resolveCardEffect(state, cardDefinitionOrId, options)` after `playCatalogueCard`. Targeted effects require `targetPlayerId`. The result includes `damageEvents` and any death outcomes so the caller can present combat feedback. Used cards still require explicit discard by the caller.

## Not yet implemented

Grenade splash needs monster/player target integration; Monster Hunter needs the monster HP catalogue and damage rules. Instant Kill, Resurrection sequencing, curses and their payment, status expiry, movement/dice changes, and deck manipulation remain separate work. BoardScene still does not route card selections into this resolver.
