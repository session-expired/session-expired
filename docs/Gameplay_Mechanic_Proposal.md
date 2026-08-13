# Gameplay Mechanics Proposal

## Gameboard

- 30 columns x 24 rows
  - 1x1 square = 1 unit
- Warden's Office
  - 8x9 in the center of the board
  - Never changes
- 4 Corner Rooms
  - 2 at 9x7
  - 2 at 9x8
- 4 Edge Rooms
  - 2 at 8x5
  - 2 at 8x6
- 8 Spawn Points in hallways
- Secret Passages
  - Connects NE↔SW and NW↔SE corners
  - Free to use, no movement cost
- Minimum 2 players
  - Possibly 3, like classic Hint
- Maximum 4 players
  - Possibly 6, like classic Hint

## Core Structure

- Classic Hint rules
  - Everybody is a detective
- No physical cards
- Suspects
  - Either names, or crude drawings in player journal
- Cause of Death OR Items
  - Will either utilize potential murder weapons or instead go with causes of death
  - If causes, the causes will be written in the journal
  - If weapons, could be a crude drawing in the journal or an actual item in the player's inventory
    - (This would require an inventory function as opposed to just a journal)
- Locations
  - Either a crude drawing of the room, or just the title of the room written in the journal
- 6 suspects
- 6 weapons
- 9 locations
- Three are randomly selected as the killer, weapon of choice (or cause of death), and the location of the murder at the beginning
  - Correctly guessing all three results in a win
  - Must head to Warden's Office to make your guess
- Potential sanity feature
  - If you make an incorrect accusation in classic Hint, you're out of the game
  - Potential feature where you have 2-3 accusations, and each accusation deteriorates your sanity; losing your sanity is a lose condition
    - This could potentially be too OP with multiple accusations — if implemented, max should be 2 accusations
- Players get a notebook with various information inside of it
  - Notebook will log your guesses and which player showed you something, or if nobody showed you anything

## Movement

- 1d8 roll
  - Our board is slightly larger than Hint's, which uses a 1d6, so 1d8 to compensate
- No partial moves, must use the full roll
- Each space = 1 point of movement
  - Entering/exiting a room costs 1 point of movement
- Secret passages are free
- Can't move onto/through an occupied hallway square
- Multiple players are allowed in one room

### Player Turn / Guessing

- Turn order will be determined at the beginning
  - Classic Hint goes clockwise from the person who dealt cards; we will just assign an unseen value 1-4 to keep player order
- Entering a room ends movement for the turn
  - "Guess" button will appear while in a room
  - Make a guess or end your turn
  - Next turn, if still in the room, you may make a guess, no movement needed
  - If starting in a room and you choose to roll, you forfeit the ability to guess
- One guess per turn
- Sole survivor must still guess correctly — doesn't win by being the last person standing
- Legally, players can suggest cards they already have

## Guesses, Disprove & Accusations

- Guess = suspect + murder weapon (cause of death); must be physically in the room you're naming, which will auto-fill as the location
- Self-suggestion/accusation allowed
  - Works lore-wise since everyone is a mental patient
- Mandatory disprove
  - A player with a match must show something, no bluffing/refusing
  - Their only choice is which one to show if they hold multiple of what the other player guessed
- When a player is being shown information, there will be a fixed ~10 second window to show the information you're receiving, and the information is populated in your journal
  - Players will see that the person guessing is viewing this window, even if no information is given — this happens regardless, so nobody knows if you're getting a card or getting no card
- Only the first player in turn order with a match will reveal the card; anyone past the first person with a match never gets asked
- Since you must go to the Warden's Office to accuse, the Warden's Office is not included in the solution pool as a location
- If everybody guesses wrong (or loses their sanity), the game ends with no winner and the solution is revealed

## Journal Functions

- Starts with dealt suspects/locations/(weapons or causes of death)
- Auto-records info shown during disproves
- Auto-populating page per suggestion
  - Your guess + what was shown and by whom, or "nobody showed anything"

## Open Questions

- Should the accused suspect be moved physically to the suggested room, like traditional Hint?
- When a player is eliminated, are they sent back to their padded cell and still involved in the disprove process (like classic Hint), or is all their info disseminated to other players?
