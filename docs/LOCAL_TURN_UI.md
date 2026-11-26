# Local Turn UI

The Phaser BoardScene now uses the approved card catalogue, turn engine, monster combat resolver, and shared card deck.

## Player actions
- Roll two dice.
- Draw two cards and roll one die.
- Choose the use-cards activity, play up to three cards, then finish the activity to roll one die and move.
- Card effects resolve through `playCatalogueCard` and `resolveCardEffect`.
- Card draws, monster rewards, curse costs, and used-card discards update the shared deck.
- Summon-capacity failures are shown in the game message.
- Effects that require a target use a native browser prompt to select a player, monster, or card.

## Monster interactions
- Scheduled monster attacks are resolved before the next player's turn.
- First-summon attacks are resolved immediately after a summon card.
- Active monsters and their combat data are shown in the side panel.
- Myth actions include Hecate's three-card offering, Granfel's yellow-card exchange, Ragnar/Ouro offerings, and Lucy's bargain.
- Legend monsters expose their offering action and validate offerings through the Legend engine.
- Nyxia hides card identities and exposes only a random-card action.
- Webby's reward suppression reaches the reward resolver because the UI passes the shared deck into card resolution.

## Engine versus UI status
| Feature | Engine | Player-facing UI |
|---|---|---|
| Catalogue card effects | Implemented | Connected; target prompts used where needed |
| Myth M01–M10 | Implemented | Basic status and offering controls connected |
| Legend offerings | Implemented | Single-player offering flow connected |
| Monster scheduled attacks | Implemented | Resolved during turn preparation |
| Summon capacity warnings | Implemented | Displayed |
| Webby reward suppression | Implemented | Passed through the shared reward consumer |

## Remaining prototype limitations
- The four local players are placeholders in one browser session, not network-connected players.
- Target selection uses browser prompts rather than custom in-game modal windows.
- Kingo's five-card payment is currently offered by one player in the UI; the engine supports multi-player contributions.
- Myth and Legend interaction controls are functional but still need visual polish and richer feedback.
- Special-tile UI and authoritative multiplayer sessions remain separate work.
