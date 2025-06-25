import { SlashCommandBuilder, ChatInputCommandInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalSubmitInteraction, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRow, ButtonInteraction } from 'discord.js';
import { handleError } from '../../utils/errorHandler.js';
import { colors } from '../../utils/colors.js';
import { Suggestion } from '../../db/suggestions.js';

const SUGGESTION_CHANNEL_ID = '1387118202336710787';
const SUGGESTION_GUILD_ID = '1231025032214609960';
const PAGE_SIZE = 5;

export const data = new SlashCommandBuilder()
  .setName('suggestion')
  .setDescription('Propose une idée ou consulte la liste des suggestions pour le bot !')
  .addSubcommand(sub =>
    sub.setName('add')
      .setDescription('Proposer une nouvelle suggestion pour le bot')
  )
  .addSubcommand(sub =>
    sub.setName('list')
      .setDescription('Voir la liste des suggestions de la communauté')
  );

function getStatusEmoji(status: string) {
  switch (status) {
    case 'acceptee': return '✅ Acceptée';
    case 'refusee': return '❌ Refusée';
    default: return '🕓 En attente';
  }
}

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const sub = interaction.options.getSubcommand();
    if (sub === 'add') {
      const modal = new ModalBuilder()
        .setCustomId('suggestion_modal')
        .setTitle('Nouvelle suggestion pour le bot')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('suggestion_texte')
              .setLabel('Ta suggestion')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
          )
        );
      await interaction.showModal(modal);
      return;
    }
    if (sub === 'list') {
      const page = 0;
      const total = await Suggestion.countDocuments();
      const suggestions = await Suggestion.find().sort({ createdAt: -1 }).skip(page * PAGE_SIZE).limit(PAGE_SIZE);
      if (!suggestions.length) {
        return interaction.reply({ content: 'Aucune suggestion trouvée pour le moment.', flags: 64 });
      }
      const embed = new EmbedBuilder()
        .setTitle('💡 Suggestions de la communauté')
        .setDescription('Voici les idées proposées par les membres pour améliorer le bot :')
        .setFooter({ text: `Page 1 / ${Math.ceil(total / PAGE_SIZE)}` })
        .setColor(colors.PRIMARY);
      for (const s of suggestions) {
        embed.addFields({
          name: `${getStatusEmoji(s.status)} — par ${s.authorTag}`,
          value: `**Suggestion :** ${s.suggestion}\n🗓️ <t:${Math.floor(new Date(s.createdAt).getTime()/1000)}:d>\n[Voir le thread](https://discord.com/channels/${interaction.guildId}/${s.threadId})`,
          inline: false
        });
      }
      const row = new ActionRowBuilder<ButtonBuilder>();
      if (total > PAGE_SIZE) {
        row.addComponents(
          new ButtonBuilder().setCustomId('suggestions_prev_0').setLabel('Précédent').setStyle(ButtonStyle.Secondary).setDisabled(true),
          new ButtonBuilder().setCustomId('suggestions_next_0').setLabel('Suivant').setStyle(ButtonStyle.Primary)
        );
      }
      await interaction.reply({ embeds: [embed], components: total > PAGE_SIZE ? [row] : [], flags: 64 });
      return;
    }
  } catch (error) {
    await handleError(interaction, error);
  }
}

export async function handleSuggestionModal(interaction: ModalSubmitInteraction) {
  try {
    if (interaction.guildId !== SUGGESTION_GUILD_ID) {
      return interaction.reply({ content: 'Cette commande ne peut être utilisée que sur le serveur principal.', flags: 64 });
    }
    const suggestion = interaction.fields.getTextInputValue('suggestion_texte');
    const user = interaction.user;
    const guild = interaction.guild;
    if (!guild) return interaction.reply({ content: 'Erreur : serveur introuvable.', flags: 64 });
    const channel = guild.channels.cache.get(SUGGESTION_CHANNEL_ID);
    if (!channel || channel.type !== 15) {
      return interaction.reply({ content: 'Le salon de suggestions est introuvable ou mal configuré.', flags: 64 });
    }
    await interaction.deferReply({ flags: 64 });
    const thread = await (channel as any).threads.create({
      name: `Suggestion de ${user.username}`,
      autoArchiveDuration: 1440,
      message: {
        content: `Nouvelle suggestion de <@${user.id}>`,
        embeds: [
          new EmbedBuilder()
            .setTitle('💡 Nouvelle suggestion')
            .setDescription(suggestion)
            .addFields(
              { name: 'Auteur', value: `<@${user.id}>\nTag: ${user.tag}\nID: ${user.id}`, inline: true }
            )
            .setThumbnail(user.displayAvatarURL())
            .setColor(colors.PRIMARY)
            .setTimestamp()
        ],
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('suggestion_acceptee').setLabel('Acceptée').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('suggestion_refusee').setLabel('Refusée').setStyle(ButtonStyle.Danger)
          )
        ]
      },
      reason: `Suggestion de ${user.tag}`
    });
    const starterMessage = await thread.fetchStarterMessage();
    await Suggestion.create({
      threadId: thread.id,
      messageId: starterMessage?.id,
      authorId: user.id,
      authorTag: user.tag,
      suggestion,
      status: 'en_attente',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await interaction.editReply({ content: `✅ Merci ! J'ai bien transmis ta suggestion à l'équipe. On adore lire vos idées ❤️` });
  } catch (error) {
    await handleError(interaction, error);
  }
}

export async function handleSuggestionsPagination(interaction: ButtonInteraction) {
  try {
    const [_, direction, pageStr] = interaction.customId.split('_');
    let page = parseInt(pageStr, 10);
    if (direction === 'next') page++;
    if (direction === 'prev' && page > 0) page--;
    const total = await Suggestion.countDocuments();
    const suggestions = await Suggestion.find().sort({ createdAt: -1 }).skip(page * PAGE_SIZE).limit(PAGE_SIZE);
    if (!suggestions.length) {
      return interaction.reply({ content: 'Aucune suggestion trouvée pour cette page.', flags: 64 });
    }
    const embed = new EmbedBuilder()
      .setTitle('💡 Suggestions de la communauté')
      .setDescription('Voici les idées proposées par les membres pour améliorer le bot :')
      .setFooter({ text: `Page ${page + 1} / ${Math.ceil(total / PAGE_SIZE)}` })
      .setColor(colors.PRIMARY);
    for (const s of suggestions) {
      embed.addFields({
        name: `${getStatusEmoji(s.status)} — par ${s.authorTag}`,
        value: `**Suggestion :** ${s.suggestion}\n🗓️ <t:${Math.floor(new Date(s.createdAt).getTime()/1000)}:d>\n[Voir le thread](https://discord.com/channels/${interaction.guildId}/${s.threadId})`,
        inline: false
      });
    }
    const row = new ActionRowBuilder<ButtonBuilder>();
    row.addComponents(
      new ButtonBuilder().setCustomId(`suggestions_prev_${page}`).setLabel('Précédent').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
      new ButtonBuilder().setCustomId(`suggestions_next_${page}`).setLabel('Suivant').setStyle(ButtonStyle.Primary).setDisabled((page + 1) * PAGE_SIZE >= total)
    );
    await interaction.update({ embeds: [embed], components: [row] });
  } catch (error) {
    await interaction.reply({ content: 'Erreur lors de la pagination.', flags: 64 });
  }
}