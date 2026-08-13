# Session Expired

**Session Expired** is a web based deduction game. Players explore a randomly generated asylum, question one another, gather evidence, and attempt to solve a murder before their opponents do.

The game takes place inside an insane asylum whose captives are themed around historical figures. The setting is comedic horror.

The art will likely be 32 bit.

> **Project status:** Early development. This is a fledgling project, base line functionality is not yet established

## Core Concept

Each game starts the players inside a procedurally generated asylum layout. Somewhere within the institution, a murder has occurred involving a victim, a location, an object, and a method.

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
* View basic profile and game statisticsπ

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

## Authentication setup

The account system requires Node.js 18 or newer and PostgreSQL.

1. Install dependencies with `npm install`.
2. Create a PostgreSQL database named `session_expired`.
3. Copy `.env.example` to `.env`, then set the database URL and replace the session secret with a long random value.
4. Apply all tables and indexes from `sql/schema.sql` with `npm run setup`.
5. Start the server with `npm start`, then visit `http://localhost:3000/register`.

For local HTTP, leave `COOKIE_SECURE=false`. Set it to `true` when the application is served over HTTPS. Set `DATABASE_SSL=true` only when the PostgreSQL provider requires TLS.

For development, run `npm run dev`. Server, database, cookie, and asset-server settings are loaded from the root `.env`; update that file when your local configuration differs.

Before starting the server, the development command creates or refreshes four test accounts (`user1`, `user2`, `user3`, and `user4`), each with the password `password`. Their email addresses are `user1@example.com` through `user4@example.com`.

## Project Structure

*Update as needed*

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
│   ├── schema.sql
│   └──*additional as needed*
├── docs/
├── .gitignore
└── README.md
```
