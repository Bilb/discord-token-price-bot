import { getPriceData } from '../api.ts';
import { PRICE_CHANNEL_ID, PRICE_SOURCE_DISCLAIMER, TOKEN_SYMBOL } from '../env.ts';
import type { Command } from '../types.ts';

async function getFormattedPriceData() {
  const priceData = await getPriceData();
  if (!priceData) {
    return null;
  }

  const tokenPrice = priceData.usd.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });

  const marketCap = priceData.usd_market_cap.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });

  const circulatingSupply = `${priceData.circulating_supply.toLocaleString('en-US', {
    roundingMode: 'trunc',
  })} ${TOKEN_SYMBOL}`;

  // t_stale is t_price + 10 min, when the price is due a refresh; it would read as a future time.
  const minutesSinceUpdate = Math.trunc((priceData.t_price - Date.now() / 1000) / 60);

  const relativeTimeSinceLastUpdate = new Intl.RelativeTimeFormat('en-US', {
    numeric: 'auto',
    style: 'narrow',
  }).format(minutesSinceUpdate, 'minutes');

  const disclaimer = `Price data provided by ${PRICE_SOURCE_DISCLAIMER} ${relativeTimeSinceLastUpdate}`;

  return {
    tokenPrice,
    marketCap,
    circulatingSupply,
    disclaimer,
  };
}

export const priceCommand = {
  name: 'price',
  description: `Get the price info for ${TOKEN_SYMBOL}`,
  handler: async (interaction) => {
    const channelId = interaction.channel?.id;
    if (channelId !== PRICE_CHANNEL_ID) {
      await interaction.reply({
        content: 'This command can only be used in the price channel!',
        flags: 'Ephemeral',
      });
      return;
    }

    const data = await getFormattedPriceData();
    if (!data) {
      await interaction.reply('Failed to get price data');
      return;
    }

    await interaction.reply({
      embeds: [
        {
          title: `${TOKEN_SYMBOL} Price Information`,
          color: 0x00f782,
          fields: [
            {
              name: 'Price (USD)',
              value: data.tokenPrice,
              inline: true,
            },
            {
              name: 'Market Cap (USD)',
              value: data.marketCap,
              inline: true,
            },
            {
              name: 'Circulating Supply',
              value: data.circulatingSupply,
              inline: true,
            },
          ],
          footer: {
            text: data.disclaimer,
          },
        },
      ],
    });
  },
} satisfies Command;
