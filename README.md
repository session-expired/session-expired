# Session Expired

**Session Expired** is a web based, turn driven deduction game. Players explore a randomly generated asylum, question one another, gather evidence, and attempt to determine the truth behind a murder before their opponents do.

The game takes place inside an insane asylum whose captives are themed around historical figures. The setting is comedic horror.

> **Project status:** Early development. This is a fledgling project, base line functionality is not yet established

## Core Concept

Each game places several players inside a uniquely generated asylum layout. Somewhere within the institution, a murder has occurred involving a victim, a location, an object, and a method.

Players take turns moving between rooms, gathering information, communicating with other players, finding hints, and submitting accusations.

The rules will evolve during development, but the central gameplay loop will focus on:

* Deduction
* Partial information
* Player deception / cooperation
* Turn-based movement
* Private and public communication
* Random board layouts

## Planned Features

### Accounts

Players will be able to:

* Create an account
* Log in and log out
* Join or create games
* Reconnect to active games, without losing their game state
* View current games as a spectator
* View the winners of completed matches
* View basic profile and game statistics

### Concurrent Games

Multiple games can run at the same time.

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

### Random Game Board

The asylum layout will change between games.

Board variations include:

* Room placement
* Hallway connections
* Locked passages (maybe)
* Secret routes (maybe)
* Restricted areas
* Starting positions

### Communication

The game will include:

**Lobby Chat** will allow players to chat with other players looking for a game.

**Global chat** will allow all players in a match to communicate.

**Private chat** will allow direct communication between individual players using sockets.

## Technology

The project will ONLY use:

* HTML
* CSS
* JavaScript

Persistent application data will use a SQL database.

## Initial Project Structure

*Update as needed*

```text
asylum/
├── public/
│   ├── pages/
│   │   ├── login.html
│   │   ├── lobby.html
│   │   └── game.html
│   ├── index.html
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
│   └── database/
├── sql/
│   ├── schema.sql
|   ├── *additional as needed*
├── tests/
├── docs/
└── README.md
```

## Development Roadmap

### Phase I: Prototype

* Create the main visual style
* Build a static board
* Add placeholder characters and wards (replace as the art is developed)
* Create local movement controls
* Build basic pages
* Prototype global and private chat interfaces

### Phase II: Core Backend

* Create the SQL schema
* Add account registration and login
* Add sessions
* Add game creation and joining
* Store game and player records

### Phase III: Multiplayer Game State

* Implement turn order (concurrent?)
* Validate movement
* Generate random boards
* Distribute hidden hints
* Add suggestions
* Add accusations
* Add victory states

### Phase IV: Real-Time Features

* Add global chat
* Add private chat
* Add reconnect support
* Add player-presence indicators
* Handle abandoned games and timeouts

### Phase 5: Polish

* Finalize artwork
* Finalize animation and sound
* Balance game rules
* Conduct multiplayer testing