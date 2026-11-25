# Card Effect Resolver — Attacks, Pranks, Drawing, Curses, and Statuses

The authoritative card descriptions and numeric values remain in `Roll_and_Ruin_Rules.txt` and `src/cards/catalogue.ts`.

## Implemented attack effects

- **ดาบสามัญ:** 3 damage to one selected opposing living player.
- **ธนูแม่นยำ:** 2 damage that bypasses shields; shields are not consumed.
- **ขวานผ่าเกราะ:** removes all target shields, then deals 3 damage.
- **ฟ้าผ่าเปรี้ยง:** deals 2 damage to every other living player.
- **ดาบสองคม:** deals 6 damage to one target, then charges the user 2 HP separately from shields.
- **หมัดเอาคืน:** deals 4 damage if the target's current HP is lower than the user's; otherwise 2.

Attack bonuses from the current runtime are added to each attack action. A timed Weakness status reduces attack-card damage by 2, to a minimum of 1. The next-attack bonus is consumed once by the next attack card, not once per target in an area attack.

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
- **มนต์หลับ:** marks the selected player to skip their next turn.
- **ลูกเต๋าอาถรรพ์:** limits the selected player's next turn to one die.

## Implemented Curse payments

Every supported Curse effect requires an explicit `cursePayment`:

- **HP payment:** choose an integer cost from 5 to 10, not exceeding current HP. It is paid before the effect and can trigger the normal death/respawn flow.
- **Discard payment:** choose exactly two different cards from the active player's hand. Their IDs are returned in `discardedCardIds` for the caller to move to the deck discard pile.
- **Cooldown payment:** available only when current HP is below 5 or the hand has fewer than 2 cards. It starts a 3-owner-turn cooldown and can be used at most 3 times per player per game. The turn engine preserves the cooldown through the casting turn and decrements it at the end of the player's next three owner turns.

`endPlayerTurn` advances cooldown automatically when the game state has card runtime. `advanceCurseCooldown` remains available for isolated integrations that do not use the turn-engine end-turn path; do not call both for the same owner turn.

## Implemented player-targeted Curse effects

- **สังหารทันที:** deals enough damage to pass through the target's shields and reduce HP to zero; invulnerability blocks it.
- **คุกบังคับ:** sends the selected living player to prison for 3 turns.
- **พลิกโต๊ะ:** sends every other living player to position 0.
- **สูบเลือด:** deals 4 damage through the normal shield/invulnerability rules and heals the user by the HP damage actually dealt.
- **สิ้นหวัง:** halves target current HP, rounded down, without consuming shields.
- **สลายโล่:** removes all shields from every other living player.
- **สลับชะตา:** swaps the user's and target's current HP values exactly.
- **อ่อนแรง:** reduces the target's attack-card damage by 2 for 3 of their turns.
- **เงียบงัน:** prevents the target from using cards for 1 turn while still allowing dice actions.
- **พันธนาการ:** prevents movement for 2 turns while allowing card use.
- **เดินถอยหลัง:** reverses movement direction for the target's next turn.
- **เต๋าต้องคำสาป:** reduces each die face by 2, with a minimum of 1, for 2 turns.
- **เปิดไพ่ประจานตัว:** stores a 3-turn reveal status; the UI can read it to show the target's hand.
- **ปล้นมือ:** discards half of a selected living player's hand, rounded up, at random; returns discarded card IDs for explicit deck handling.
- **ปล้นสุสาน:** transfers every card held by one eliminated player to the active player.
- **ล้างพลัง:** removes the target's shields, invulnerability, reflection charges, and positive combat buffs; timed negative statuses remain.
- **เหยื่อล่า:** marks every currently active monster to target the selected living player on that monster's next scheduled attack. Each monster consumes its own one-shot override when it attacks; if the target is no longer alive, its normal targeting pattern is used instead.

## Dice manipulation effects

- **ลูกเต๋าโชคดี:** grants one extra D6 for the current Use Cards movement roll. It can be used once per turn; the total number of dice never exceeds three, and a one-die status takes precedence.
- **ใบโคลเวอร์นำโชค:** grants one reroll charge. After the movement roll from Use Cards, the caller can use `rerollOneDie(state, diceRolls, dieIndex, random)` to replace one die and update the movement total. The reroll respects cursed-die reductions.
- **ควบคุมลูกเต๋า:** accepts `diceValues` in the effect options, one integer value from 1 to 6 for each die that will be rolled. It may be used once per turn and supports up to three dice. Active one-die limits reduce the required choice count to one. Cursed-die reduction is applied to the selected faces when the roll is finalized.

The dice effects modify only the next movement roll within the current Use Cards activity. They do not change the separate Draw or Roll activities.

## Green status/buff effects

- **พรอมตะ:** invulnerability lasts for 3 owner turns and ticks at the end of each protected player's turn.
- **สุรากล้าหาญ:** attack-card damage increases by 2 for the current turn.
- **เกราะเสริมพลัง:** defense cards gain +1 shield for the current turn, subject to the normal shield cap of 3.
- **น้ำศักดิ์สิทธิ์:** removes the user's timed negative statuses.
- **พรสองชั้น:** grants one shield immediately and adds +1 damage to the next attack card.

Armor Seal prevents further attack cards during the current turn. Its effect is enforced when `playCatalogueCard` passes the catalogue card kind into `playCardFromHand`.

## Integration contract

Call `resolveCardEffect(state, cardDefinitionOrId, options)` after `playCatalogueCard`. Player-targeted effects require `targetPlayerId`; effects requiring a hand choice also require `selectedCardId`. Draw effects require `deck` and return the updated deck plus `drawEvents`. Curse cards require `cursePayment`. Results include `damageEvents`, `revealedHands`, and `discardedCardIds` for the caller/UI. Used and forcibly discarded cards still require explicit deck discard handling by the caller.

## Not yet implemented

Grenade splash needs monster/player target integration; Monster Hunter needs the monster HP catalogue and damage rules. Resurrection sequencing, remaining monster/tile effects, monster HP/damage and reward resolution, and BoardScene dice/card-choice integration remain separate work.
