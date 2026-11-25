# Card Effect Resolver — Player Attacks, Pranks, and Drawing

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

## Implemented targeted yellow effects

- **แอบดู:** returns the selected player's current hand as a reveal result for the caller/UI; the hand itself is unchanged.
- **ล้วงกระเป๋า:** transfers one random card from the selected living player's hand to the active player.
- **สลับที่:** swaps the active player's and selected target's board positions.
- **แลกไพ่:** transfers one user-selected card to the target and one random card from the target back to the user.
- **บังคับทิ้ง:** removes one card selected by the target and returns its ID in `discardedCardIds` for the caller to place in the discard pile.
- **ฝนไพ่:** draws up to four cards for the active player.
- **แจกไพ่:** draws up to two cards for the active player, then up to one card for each other living player in seat order.

Random choices accept an injected random source for deterministic tests. Empty target hands make Pickpocket a no-op; Card Trade requires the target to have a card. Draw effects require the caller to pass the current shared deck.

## Integration contract

Call `resolveCardEffect(state, cardDefinitionOrId, options)` after `playCatalogueCard`. Player-targeted effects require `targetPlayerId`; effects requiring the target to choose a hand card also require `selectedCardId`. Draw effects require `deck` and return the updated deck plus `drawEvents`. Results also include `damageEvents`, `revealedHands`, and `discardedCardIds` for the caller/UI. Used and forcibly discarded cards still require explicit deck discard handling by the caller.

## Not yet implemented

Grenade splash needs monster/player target integration; Monster Hunter needs the monster HP catalogue and damage rules. Instant Kill, Resurrection sequencing, curse payment, bonus dice and rerolls, status expiry, movement/dice changes, turn-skipping, and BoardScene integration remain separate work.
