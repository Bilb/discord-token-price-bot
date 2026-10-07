import {
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  TextChannel,
} from 'discord.js';
import { appCommand } from './commands/app.ts';
import { githubCommand } from './commands/github.ts';
import { networkCommand } from './commands/network.ts';
import { createOpenContractMessage, openNodeCommand } from './commands/open.ts';
import { priceCommand } from './commands/price.ts';
import {
  BOT_APP_ID,
  BOT_TOKEN,
  IGNORE_INVALID_COMMANDS,
  OPEN_NODES_CHANNEL_ID,
  OPEN_NODES_GUILD_ID,
} from './env.ts';
import {
  type OpenNodesData,
  getOpenNodes,
  onOpenNodesRefresh,
  startOpenNodesPolling,
} from './portal.ts';
import type { Command, CommandInfo } from './types.ts';

const parseCommandInfo = (command: Command): CommandInfo => {
  return {
    name: command.name,
    description: command.description,
  };
};

const commandToLoad = [priceCommand, networkCommand, appCommand, githubCommand];
const commandDetails: Array<CommandInfo> = [];
const commands: Record<string, Command> = {};

for (const command of commandToLoad) {
  commands[command.name] = command;
  commandDetails.push(parseCommandInfo(command));
}

const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

try {
  console.log('Started refreshing application (/) commands.');
  console.log(`Reloading commands: ${Object.keys(commands).join(', ')}`);

  const cmd = new SlashCommandBuilder()
    .setName(openNodeCommand.name)
    .setDescription(openNodeCommand.description)
    .addStringOption((option) =>
      option
        .setName('id')
        .setDescription('Open Node Ed25519 Key (ID)')
        .setAutocomplete(true)
        .setRequired(true),
    );

  commandDetails.push(cmd.toJSON());
  commands[openNodeCommand.name] = openNodeCommand;

  await rest.put(Routes.applicationCommands(BOT_APP_ID), { body: commandDetails });

  console.log('Successfully reloaded application (/) commands.');
} catch (error) {
  console.error(error);
}

// Slash commands and channel.send need only Guilds; no message events means no message content.
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.on(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}!`);

  if (client.user) {
    const stakingActivity = {
      name: 'Staking SESH',
      type: 5,
      application_id: '379286085710381999',
      state: 'Securing the network at the SESH',
      timestamps: { start: Date.now() },
      party: {
        id: '9dd6594e-81b3-49f6-a6b5-a679e6a060d3',
        size: [2, 2],
      },
    };
    client.user.setPresence({ activities: [stakingActivity], status: 'online' });
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = commands[interaction.commandName];
    if (!command) {
      if (IGNORE_INVALID_COMMANDS) {
        return;
      }
      await interaction.reply('Unknown command').catch(console.error);
      return;
    }

    // Bun exits the process on an unhandled rejection, so a failing command must not escape.
    try {
      await command.handler(interaction);
    } catch (error) {
      console.error(`/${interaction.commandName} failed:`, error);
      const reply = {
        content: 'Something went wrong, please try again later.',
        flags: 'Ephemeral',
      } as const;
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply).catch(console.error);
      } else {
        await interaction.reply(reply).catch(console.error);
      }
    }
    return;
  }

  if (interaction.isAutocomplete()) {
    const command = commands[interaction.commandName];
    if (!command || !('handleAutocomplete' in command) || !command.handleAutocomplete) {
      return;
    }
    try {
      await command.handleAutocomplete(interaction);
    } catch (error) {
      console.error(error);
    }
  }
});

client.login(BOT_TOKEN);
startOpenNodesPolling();

const sentNodes = new Set<string>();

client.once(Events.ClientReady, async (readyClient) => {
  if (!OPEN_NODES_GUILD_ID || !OPEN_NODES_CHANNEL_ID) {
    console.log(
      'Open-node announcements disabled: OPEN_NODES_GUILD_ID / OPEN_NODES_CHANNEL_ID not set',
    );
    return;
  }

  try {
    const guild = await readyClient.guilds.fetch(OPEN_NODES_GUILD_ID);
    if (!guild) {
      console.error(`❌ Could not find guild ${OPEN_NODES_GUILD_ID}`);
      return;
    }

    const channel = await guild.channels.fetch(OPEN_NODES_CHANNEL_ID);
    if (!channel || !(channel instanceof TextChannel)) {
      console.error(
        `❌ Could not find text channel ${OPEN_NODES_CHANNEL_ID} in guild ${OPEN_NODES_GUILD_ID}`,
      );
      return;
    }

    // Nodes already open at startup are recorded, not posted, so a restart doesn't repost them.
    // A node that opens while the bot is down is never announced.
    let seeded = false;
    const announceNewOpenNodes = (openNodes: OpenNodesData) => {
      const newNodes = [];
      for (const node of openNodes.nodes) {
        if (!sentNodes.has(node.address)) {
          newNodes.push(node);
          sentNodes.add(node.address);
        }
      }

      if (!seeded) {
        seeded = true;
        return;
      }

      for (const node of newNodes) {
        const message = createOpenContractMessage(
          node,
          'A new multicontributor Session node is open for staking!',
        );
        channel.send(message).catch(console.error);
      }
    };

    // The first refresh may already have landed while the client was logging in.
    const current = getOpenNodes();
    if (current) {
      announceNewOpenNodes(current);
    }
    onOpenNodesRefresh(announceNewOpenNodes);
  } catch (err) {
    console.error('Error setting up interval message:', err);
  }
});
