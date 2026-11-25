# Card Deck Core

This module provides generic deck operations without assuming card categories, card effects, draw counts, or reshuffle rules.

## Implemented
- Create a deck from a supplied list of card IDs.
- Shuffle with Fisher-Yates and an injectable random source.
- Draw one or more cards from the top of the draw pile.
- Stop drawing when the draw pile is empty.
- Remove a selected card from a player's hand and return its ID for effect resolution.
- Add a card to the discard pile only when explicitly requested.

## Deliberately not assumed
- Card categories and card definitions.
- Number of cards drawn by each card/action.
- Whether used cards are discarded, exhausted, or returned.
- Whether an empty draw pile recycles the discard pile.
- Any card-specific effect.

These values will be connected to the approved card catalogue and rules.
