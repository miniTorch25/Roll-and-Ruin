# Player Status Effects UI

The active player's panel displays every timed status effect and its remaining owner-turn duration. Prison is displayed separately because it is tracked by `prisonTurnsRemaining`, not by the timed status-effect array.

The local player list also shows each player's active effects, so a player can see who is poisoned, silenced, restricted to one die, moving in reverse, or carrying another timed condition.

The display labels are centralized in `src/ui/statusEffects.ts`. This is presentation only: it reads the existing game state and does not alter effect duration, turn order, or gameplay resolution.

Validation includes label coverage for every `PlayerStatusEffectType`, expired-effect filtering, Prison display, and the empty state.
