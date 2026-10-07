import { ActionRowBuilder, ButtonBuilder, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { SESSION_STAKING_PORTAL_URL, TOKEN_SYMBOL } from '../env.ts';
import { type ContributionContract, getOpenNodes } from '../portal.ts';
import type { Command } from '../types.ts';

/**
 * Collapses a string by replacing characters between the leading and trailing characters with a triple ellipsis unicode character (length 1).
 * The final length of the string will be the sum of the leading and trailing characters plus 1.
 * @param str - The input string to collapse.
 * @param leadingChars - The number of characters to keep at the beginning of the string.
 * @param trailingChars - The number of characters to keep at the end of the string.
 * @returns The collapsed string.
 */
const collapseString = (str: string, leadingChars = 6, trailingChars = 4): string => {
  if (str.length <= leadingChars + trailingChars + 3) return str;
  return `${str.slice(0, leadingChars)}…${str.slice(-trailingChars)}`;
};

// Contract amounts are in atomic units: 1 SESH = 10^9.
const STAKING_REQUIREMENT = 25_000 * 10 ** 9;
const MAX_CONTRIBUTORS = 10;

const formatSESH = (value: number) => {
  return `${(value / 10 ** 9).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 })} ${TOKEN_SYMBOL}`;
};

export function createOpenContractEmbed(contract: ContributionContract, description?: string) {
  const contributorStrings = contract.contributors.map(
    ({ address, amount, reserved }) =>
      `${collapseString(address)}: ${amount > 0 ? formatSESH(amount) : `${formatSESH(amount)} (${formatSESH(reserved)} reserved)`}`,
  );

  const contributorField = {
    name: `Contributors (${contract.contributors.length}/${MAX_CONTRIBUTORS})`,
    value: contributorStrings.join('\n'),
  };

  const formattedFee = (contract.fee / 10_000).toLocaleString('en-US', {
    maximumFractionDigits: 2,
    style: 'percent',
  });

  let totalStaked = 0;
  for (const contributor of contract.contributors) {
    totalStaked += contributor.amount || contributor.reserved;
  }

  const remainingStakeFormatted = formatSESH(STAKING_REQUIREMENT - totalStaked);

  const fields = [
    contributorField,
    { name: 'Operator', value: collapseString(contract.operator_address), inline: true },
    { name: 'Fee', value: formattedFee, inline: true },
    { name: 'Remaining Contribution', value: remainingStakeFormatted, inline: true },
  ];

  const embedBuilder = new EmbedBuilder()
    .setColor(0x00f782)
    .setTitle(`Open Multicontributor Node: ${collapseString(contract.service_node_pubkey, 8, 4)}`)
    .setURL(`${SESSION_STAKING_PORTAL_URL}/stake/${contract.address}`)
    .addFields(fields)
    .addFields([])
    .setTimestamp();

  if (description) {
    embedBuilder.setDescription(description);
  }

  return embedBuilder;
}

function createActionRow(contract: ContributionContract) {
  const button = new ButtonBuilder()
    .setLabel('View Open Node')
    .setURL(`${SESSION_STAKING_PORTAL_URL}/stake/${contract.address}`)
    .setStyle(5);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(button);
}

export function createOpenContractMessage(contract: ContributionContract, description?: string) {
  const embed = createOpenContractEmbed(contract, description);
  const row = createActionRow(contract);
  return {
    embeds: [embed.toJSON()],
    components: [row],
  };
}

export const openNodeCommand = {
  name: 'open',
  description: 'Get open Session node info',
  stringOptions: [{ description: 'Enter Node Ed25519 Key (ID)', autocomplete: true }],
  handleAutocomplete: async (interaction) => {
    const focusedValue = interaction.options.getFocused();

    const ids = getOpenNodes()?.ids ?? [];

    const filtered = ids.filter((choice) => choice.startsWith(focusedValue)).slice(0, 24);
    await interaction.respond(filtered.map((choice) => ({ name: choice, value: choice })));
  },
  handler: async (interaction) => {
    const id = interaction.options.getString('id');
    if (!id) {
      await interaction.reply({
        content: `Unable to find id: ${id}`,
        flags: 'Ephemeral',
      });
      return;
    }

    const openNodes = getOpenNodes();
    if (!openNodes) {
      await interaction.reply({ content: 'Failed to get open nodes', flags: 'Ephemeral' });
      return;
    }

    const contract = openNodes.nodes.find((node) => node.service_node_pubkey === id);

    if (!contract) {
      await interaction.reply('Open node not found!');
      return;
    }

    await interaction.reply(createOpenContractMessage(contract));
  },
} satisfies Command;
