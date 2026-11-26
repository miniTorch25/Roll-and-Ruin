# Match Timer and Speedrun

## Modes

The local match setup offers these presets:

- **Standard:** no time limit.
- **Speedrun:** 5 or 10 minutes.
- **Timed match:** 15 or 20 minutes.

The countdown starts after the setup dialogs and board initialization are complete. It uses a wall-clock deadline, so a backgrounded browser tab does not pause or extend the match.

## When time expires

The match ends immediately and player actions are disabled. The result is calculated using the existing scoring rules:

1. Highest combined team score wins.
2. If teams are tied on score, the team with more surviving players wins.
3. If both score and surviving-player count are tied, the result is a draw.

The results panel shows each team's score and surviving-player count. Matches without a time limit continue to end under the normal elimination rules.

## Scope

The timer is local to the current browser session. It is not server-authoritative and does not provide synchronized multiplayer timing; those remain separate multiplayer/backend tasks.
