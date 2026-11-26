# Local Turn UI

The Phaser BoardScene now uses the approved card catalogue, turn engine, monster combat resolver, and shared card deck.

## Player actions
- Roll two dice.
- Draw two cards and roll one die.
- Choose the use-cards activity, play up to three cards, then finish the activity to roll one die and move.
- Card effects resolve through `playCatalogueCard` and `resolveCardEffect`.
- Card draws, monster rewards, curse costs, and used-card discards update the shared deck.
- Summon-capacity failures are shown in the game message.
- Effects that require a target use in-game modal dialogs for player, monster, card, and dice-value selection.

## Monster interactions
- Scheduled monster attacks are resolved before the next player's turn.
- The board's special-tile layout is configured at match start; Mystery draws one eligible card, Monster summons uniformly from the 50-entry catalogue and resolves its first attack, and Prison skips the affected player's next three turns.
- Passing a space does not trigger its ordinary landing effect; only the final landing tile is checked. Completing a lap regenerates the special-tile layout while keeping occupied player spaces clear.
- Dice tiles are rendered and counted, but their bonus-die timing remains inactive until the rule is confirmed.
- First-summon attacks are resolved immediately after a summon card.
- Active monsters and their combat data are shown in the side panel.
- Myth actions include Hecate's three-card offering, Granfel's yellow-card exchange, Ragnar/Ouro offerings, and Lucy's bargain.
- Legend monsters expose their offering action and validate offerings through the Legend engine.
- Kingo (L10) uses a dedicated in-game contribution dialog: all living local players can select cards, and the dialog enables confirmation only when exactly five unique cards are selected.
- Nyxia hides card identities and exposes only a random-card action.
- Myth summon cards choose M01–M10 and run the Myth summon effect before resolving any first-summon attack.
- Webby's Attack-card defeat flag is passed into `resolveMonsterDefeatRewards`; its normal reward is suppressed while the shared deck remains unchanged.

## Engine versus UI status
| Feature | Engine | Player-facing UI |
|---|---|---|
| Catalogue card effects | Implemented | Connected; target selection uses in-game dialogs |
| Myth M01–M10 | Implemented | Basic status and offering controls connected |
| Legend offerings | Implemented | Single-player offerings plus cooperative Kingo contribution dialog |
| Monster scheduled attacks | Implemented | Resolved during turn preparation |
| Summon capacity warnings | Implemented | Displayed |
| Webby reward suppression | Implemented and covered by effect-resolver test | Consumed by shared reward resolver |

## Remaining prototype limitations
- The four local players are placeholders in one browser session, not network-connected players.
- Player, monster, card, and dice-value selection now use in-game dialogs; the Kingo contribution flow is a separate shared-screen dialog.
- The Kingo dialog is a local shared-screen contribution flow; it does not provide private simultaneous input or network multiplayer.
- Myth and Legend interaction controls are functional but still need visual polish and richer feedback.
- Dice-tile bonus behavior remains pending a confirmed rule; online multiplayer remains separate work.
