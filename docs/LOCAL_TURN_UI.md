# Local Turn UI Prototype

This iteration connects the Phaser board to the existing TypeScript turn engine.

## What can be tested
- Four local placeholder players take turns in sequence.
- The active player can roll a D6 and move along the isometric path.
- The active player can draw one generic prototype card.
- Player position, score, hand size, hearts, turn number, and active player are reflected in the interface.
- The game engine advances through monster attack, action choice, movement, special-tile check, status check, and turn end phases.

## Prototype-only values and limitations
- The four players are local stand-ins, not network-connected people or bots.
- Three starting hearts are a temporary UI test setting, not a confirmed final rule.
- The draw pile contains generic placeholder IDs only. No card names, categories, or effects are implied.
- The Use Card button remains disabled until the approved card catalogue and effects are connected.
- The current path is a visual test board. Its length and tile effects are not the final board specification.
- No monster is spawned automatically because monster encounter timing and damage data are not yet integrated into this UI.
- This is not multiplayer and does not provide server-authoritative state.

## Next integration steps
1. Connect the approved card catalogue and card-effect resolver.
2. Add special-tile definitions and their event handlers.
3. Add monster encounter data and damage resolution.
4. Replace local placeholder players with room-based player sessions and a server-authoritative match state.
