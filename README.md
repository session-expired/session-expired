# Session Expired

**Session Expired** is an online, turn-based deduction game inspired by classic murder-mystery board games. Players explore a procedurally arranged institution, question one another, gather evidence, and attempt to determine the truth behind an incident before their opponents do.

The game takes place inside a heavily stylized and historically inaccurate asylum whose wards are themed around exaggerated interpretations of historical figures. The setting is intended as dark satire and fictional horror.

> **Project status:** Early development. This repository currently contains the initial project structure.

## Core Concept

Each game places several players inside a newly generated asylum layout. Somewhere within the institution, a murder has occurred involving a victim, a location, an object, and a method.

Players take turns moving between wards, making suggestions, revealing information, communicating with other players, finding hints, and eventually submitting an accusation.

The exact rules will evolve during development, but the central gameplay loop will remain focused on:

* Deduction
* Partial information
* Player deception
* Turn-based movement
* Private and public communication
* Random board layouts

## Planned Features

### Multiplayer Accounts

Players will be able to:

* Create an account
* Log in and log out
* Join or create games
* Reconnect to active games
* View current and completed matches
* Maintain basic profile and game statistics

Authentication data will be stored securely. Passwords will never be stored as plain text.

### Concurrent Turn-Based Games

Multiple games may run at the same time.

Each game will maintain its own:

* Players
* Turn order
* Current turn
* Board layout
* Player locations
* Evidence distribution
* Chat history
* Suggestions
* Accusations
* Win or loss state

Gameplay will be turn-based, but the application will support multiple connected users viewing updates concurrently.

### Changing Game Board

The asylum layout will change between games.

Possible board variations include:

* Ward placement
* Hallway connections
* Locked passages
* Secret routes
* Restricted areas
* Starting positions
* Special room effects

The board should remain logically playable even when its layout changes.

### Communication

The game will include several forms of communication.

**Global chat** will allow all players in a match to communicate.

**Private chat** will allow direct communication between individual players using sockets.

Future versions may also include:

* Ward-based chat
* Spectator chat
* System announcements
* Moderation tools
* Chat history and timestamps

## Technology

The client interface will use:

* HTML
* CSS
* JavaScript

Persistent application data will use a SQL database.

Because browsers should not connect directly to a SQL database, the completed application will also require a server-side application layer. The backend technology has not yet been selected.

The backend will eventually be responsible for:

* Authentication
* Database access
* Game creation
* Turn validation
* Board generation
* Chat delivery
* Authorization
* Concurrent game state
* Server-side rule enforcement

The client must never be trusted to determine legal moves, evidence ownership, turn order, or game results.

## Proposed Project Structure

```text
asylum/
├── public/
│   ├── index.html
│   ├── login.html
│   ├── lobby.html
│   ├── game.html
│   ├── css/
│   │   ├── global.css
│   │   ├── lobby.css
│   │   └── game.css
│   ├── js/
│   │   ├── auth.js
│   │   ├── lobby.js
│   │   ├── game.js
│   │   ├── board.js
│   │   └── chat.js
│   └── assets/
│       ├── images/
│       ├── icons/
│       └── audio/
├── server/
│   ├── routes/
│   ├── services/
│   ├── middleware/
│   └── database/
├── sql/
│   ├── schema.sql
│   ├── seed.sql
│   └── migrations/
├── tests/
├── docs/
├── .gitignore
├── LICENSE
└── README.md
```

This structure is in development and will change as the project evolves.

## Preliminary Database Model

The database will likely include tables representing:

* Users
* Sessions
* Games
* Game players
* Boards
* Wards
* Board spaces
* Board connections
* Characters
* Evidence cards
* Player evidence
* Turns
* Moves
* Suggestions
* Accusations
* Global messages
* Private conversations
* Private messages

A simplified relationship model might resemble:

```text
users
  └── game_players
        ├── games
        ├── player_evidence
        ├── turns
        └── moves

games
  ├── boards
  ├── suggestions
  ├── accusations
  └── global_messages

private_conversations
  ├── conversation_members
  └── private_messages
```

The database schema should preserve enough game history to recover a match after a temporary disconnection or server restart.

## Game-State Principles

The server will be the authoritative source of game state.

The client may request an action, but the server must determine whether that action is legal.

For example, when a player attempts to move, the server should verify:

1. The game is active.
2. The player belongs to the game.
3. It is the player’s turn.
4. The destination exists.
5. The destination is connected to the current space.
6. The movement does not exceed the allowed distance.
7. The player is not blocked by another rule.
8. The submitted state matches the current server state.

Only after validation should the move be stored and broadcast to the other players.


## Security Goals

Security must be considered from the beginning rather than added after the game is complete.

The project should eventually include:

* Salted password hashing
* Parameterized SQL queries
* Server-side input validation
* Output escaping
* Authentication expiration
* Authorization checks on every protected action
* Rate limiting
* Chat-length restrictions
* Protection against cross-site scripting
* Protection against SQL injection
* Protection against cross-site request forgery where applicable
* Secure cookie settings
* Environment variables for secrets
* Audit logging for important game actions

No database credentials, API keys, session secrets, or production configuration files should be committed to the repository.

## Development Roadmap

### Phase 1: Static Prototype

* Create the main visual style
* Build a static board
* Add placeholder characters and wards
* Create local movement controls
* Build nonfunctional login and lobby screens
* Prototype global and private chat interfaces

### Phase 2: Core Backend

* Select the server-side technology
* Create the SQL schema
* Add account registration and login
* Add sessions
* Add game creation and joining
* Store game and player records

### Phase 3: Multiplayer Game State

* Implement turn order
* Validate movement
* Generate variable boards
* Distribute hidden evidence
* Add suggestions and evidence reveals
* Add accusations
* Add victory and defeat states

### Phase 4: Real-Time Features

* Broadcast game-state changes
* Add global chat
* Add private chat
* Add reconnect support
* Add player-presence indicators
* Handle abandoned games and timeouts

### Phase 5: Content and Polish

* Expand ward themes
* Add character artwork
* Add animation and sound
* Improve mobile layouts
* Add accessibility testing
* Add moderation and reporting tools
* Balance game rules
* Conduct multiplayer testing