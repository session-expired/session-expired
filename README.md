# Session Expired

**Session Expired** is a web-based multiplayer murder mystery game set inside an asylum populated by captives themed around historical figures.

Players explore the institution, search rooms for hints, question one another, and piece together the circumstances of a murder before another player solves it first.

The setting combines **comedic horror, historical absurdity, and murder mystery**. The characters resemble famous historical figures, though the institution's relationship with historical accuracy is questionable at best.

> **Project Status:** Active development. The core game is playable from account creation through a completed match and winning state. Gameplay, balance, presentation, and additional features are still being developed.

## Core Concept

Each game places players inside the asylum with a murder to solve.

The solution consists of several pieces of information hidden throughout the game. Players take turns moving through the institution and searching locations for hints that eliminate possibilities and gradually narrow the solution.

Players can also communicate with and question one another. Information does not necessarily have to be shared honestly—or at all.

Once a player believes they have solved the murder, they can submit an accusation. A correct accusation ends the game and records the winner.

The central gameplay loop focuses on:

* Exploration and searching
* Deduction through partial information
* Gathering and interpreting hints
* Player deception and cooperation
* Turn-based movement
* Private and public communication
* Risk and reward when making accusations

## Current Features

### Accounts

Players can:

* Create an account
* Log in and log out
* Create games
* Join existing games
* Leave and later rejoin active games without losing their game state
* Play through a complete match
* Win by correctly solving the murder

Player statistics and a high-score system are still in development.

### Concurrent Games

Multiple games can run at the same time.

Each game maintains its own:

* Players
* Turn order
* Current turn
* Player locations
* Hint distribution
* Chat history
* Accusations
* Solution
* Win state

### Game Board

Players explore an asylum divided into rooms, hallways, and searchable areas.

Movement is turn-based, and different locations contain points of interest that players can search for information about the murder. Search results may provide useful hints—or reveal that a location contains nothing useful.

The current board layout is fixed. Board randomization and additional layout variations may be explored later in development.

### Searching and Hints

Searching is the primary way players gather information.

Hints found throughout the asylum eliminate possible elements of the murder and allow players to gradually narrow down the correct solution.

Searchable locations can contain multiple hints, while others may contain nothing. Once searched, locations reflect their changed state so players can make informed decisions about where to investigate next.

The goal is not simply to find a single decisive piece of evidence, but to collect enough partial information to determine what happened before another player does.

### Communication

**Lobby Chat** allows players to communicate while organizing games.

**Global Chat** allows players within a match to communicate with everyone currently playing.

**Private Chat** allows direct communication between individual players using Socket.IO.

Players can use communication to exchange information, question one another, cooperate, mislead opponents, or simply refuse to reveal what they have discovered.

### Winning

Players win by gathering enough information to correctly identify the solution and successfully submit an accusation.

A correct accusation ends the match and records the winning player.

A persistent high-score and player-statistics system is planned.

## Technology

The client-side application uses:

* HTML
* CSS
* JavaScript

The server uses **Node.js** with **Express** and **Socket.IO** for application logic and real-time multiplayer communication.

Persistent application data is stored in **PostgreSQL**.

## Authentication and Local Setup

The account system requires Node.js 18 or newer and PostgreSQL.

1. Install dependencies with `npm install`.
2. Create a PostgreSQL database named `session_expired`.
3. Copy `.env.example` to `.env`, set the database URL, and replace the session secret with a long random value.
4. Apply pending versioned migrations with `npm run migrate`. `npm run setup` is also available as an alias.
5. Start the server with `npm start`, then visit `http://localhost:3000/register`.

For local HTTP development, leave `COOKIE_SECURE=false`. Set it to `true` when the application is served over HTTPS.

Set `DATABASE_SSL=true` only when the PostgreSQL provider requires TLS.

### Development Mode

Run:

`npm run dev`

Server, database, cookie, and asset-server settings are loaded from the root `.env` file.

Development mode resets application data and creates four test accounts:

* `user1`
* `user2`
* `user3`
* `user4`

Each account uses the password `password`, with email addresses ranging from `user1@example.com` through `user4@example.com`.

### Production

For Render deployments, set the pre-deploy command to:

`npm run migrate`

Migrations in `sql/migrations` are applied once in filename order and tracked in the `schema_migrations` table.

Never modify a migration that has already been applied. Database changes should instead be added as new numbered SQL migration files.

Production startup removes the four exact development accounts and their dependent data in a transaction before accepting traffic. All other user accounts are preserved.

The same cleanup can be run manually with:

`npm run reset`

## Project Structure

> Update this section as the project evolves.

```text
session-expired/
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
│   ├── database/
│   └── server.js
├── sql/
│   ├── migrations/
│   └── schema.sql
├── docs/
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Development Status

The major multiplayer systems are functional: accounts, authentication, game creation and joining, persistent game membership, turn-based play, searching, communication, accusations, and a winning state.

Current development is focused on expanding and refining the game itself rather than simply making the multiplayer infrastructure work.

Planned work includes:

* High scores and player statistics
* Additional hints and searchable interactions
* Gameplay balancing
* Improved visual feedback and animation
* Additional character and environmental flavor
* Expanded accusation and deduction mechanics
* UI and accessibility improvements
* Further differentiation of the game from traditional deduction board games
