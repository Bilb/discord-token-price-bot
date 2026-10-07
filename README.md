# Discord Token Price Bot

This is a Discord bot that provides information about the price of a crypto token.

## Usage

Copy `.env.local.template` to `.env.local` and fill it in. Bun loads it from the working directory.

Required:

- `BOT_TOKEN`: The bot token. You can get it from the Discord Developer Portal.
- `BOT_APP_ID`: The bot application ID. You can get it from the Discord Developer Portal.
- `SESSION_STAKING_PORTAL_URL`: Base URL of the staking portal, used for open nodes and their links.
- `TOKEN_SYMBOL`: The symbol of the token.
- `PRICE_CHANNEL_ID`: The only channel `/price` answers in.

Optional:

- `SESSION_NETWORK_API_URL`: The network info API. Without it, `/price` and `/network` do not work.
- `PRICE_SOURCE_DISCLAIMER`: The name of the source of the price data. eg: "CoinGecko"
- `IGNORE_INVALID_COMMANDS`: Set to ignore unknown commands rather than respond with "Unknown command". Any non-empty value enables it.
- `OPEN_NODES_GUILD_ID`, `OPEN_NODES_CHANNEL_ID`: Server and text channel to announce newly open multicontributor nodes in. Set both or neither; neither disables the announcements.

Discord IDs: enable Developer Mode (User Settings > Advanced), then right-click a server or channel and use "Copy Server ID" / "Copy Channel ID".

## Commands

- `/price`: Get the price info for the token.
- `/network`: Get Session network info.
- `/open`: Get info on an open multicontributor node.
- `/app`: Session Messenger download link.
- `/github`: Session GitHub repositories.

## Development

### Prerequisites

- [bun](https://bun.sh)

### Installation

To install dependencies:

```sh
bun install
```

To run:

```sh
bun start
```

### Running under pm2

Have pm2 launch the `bun` binary, not `index.ts` with `interpreter: bun`. pm2 6 loads Bun scripts through `require()`, which Bun refuses for a module with top-level `await`, so the bot exits on every start.

```sh
pm2 start "$(command -v bun)" --name seshbot --cwd /path/to/bot --interpreter none \
  --exp-backoff-restart-delay=1000 -- run index.ts
pm2 save
```
