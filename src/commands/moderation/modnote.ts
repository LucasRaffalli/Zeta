import { SlashCommandBuilder, ChatInputCommandInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalSubmitInteraction, EmbedBuilder } from 'discord.js';
import { getModerationCollection } from '../../db/moderation.js';
import { handleError } from '../../utils/errorHandler.js';
import { checkModAccess } from '../../utils/checkModAccess.js';
import { colors } from '../../utils/colors.js';

export const data = new SlashCommandBuilder()
  .setName('modnote')
  .setDescription("Ajoute une note de modération à un utilisateur (formulaire)")
  .addUserOption(option =>
    option.setName('utilisateur')
      .setDescription("L'utilisateur à noter")
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const target = interaction.options.getUser('utilisateur', true);
    const modal = new ModalBuilder()
      .setCustomId(`modnote_modal_${target.id}`)
      .setTitle('Ajouter une note de modération')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('note')
            .setLabel(`Note pour ${target.tag}`)
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        )
      );
    await interaction.showModal(modal);
  } catch (error) {
    await handleError(interaction, error);
  }
}

export async function handleModNoteModal(interaction: ModalSubmitInteraction) {
  try {
    const userId = interaction.customId.split('_')[2];
    const note = interaction.fields.getTextInputValue('note');
    const guild = interaction.guild;
    if (!guild) return interaction.reply({ content: 'Commande utilisable uniquement sur un serveur.', flags: 64  });
    const hasAccessModal = await checkModAccess(guild, interaction.member as any);
    if (!hasAccessModal) {
      return interaction.reply({ content: 'Tu ne peux pas utiliser cette commande.', flags: 64  });
    }
    const target = await guild.members.fetch(userId).then(m => m.user).catch(() => null);
    if (!target) return interaction.reply({ content: 'Utilisateur introuvable.', flags: 64  });
    const noteObj = {
      note,
      author: interaction.user.tag,
      date: new Date().toISOString()
    };
    const collection = await getModerationCollection();
    const filter = { guildId: guild.id, userId: target.id };
    const existing = await collection.findOne(filter);
    if (!existing) {
      await collection.insertOne({
        guildId: guild.id,
        userId: target.id,
        bans: [],
        kicks: [],
        warns: [],
        mutes: [],
        notes: [noteObj]
      });
    } else {
      if (!Array.isArray(existing.notes)) {
        await collection.updateOne(filter, { $set: { notes: [] } });
      }
      await collection.updateOne(filter, { $push: { notes: noteObj } });
    }
    const embed = new EmbedBuilder()
      .setTitle('Note de modération ajoutée')
      .setDescription(`Une note a été ajoutée à ${target.tag}.`)
      .addFields(
        { name: 'Note', value: note, inline: false },
        { name: 'Auteur', value: interaction.user.tag, inline: true },
        { name: 'Date', value: `<t:${Math.floor(Date.now()/1000)}:f>`, inline: true }
      )
      .setColor(colors.SUCCESS)
      .setThumbnail(target.displayAvatarURL());
    await interaction.reply({ embeds: [embed], flags: 64  });
  } catch (error) {
    await handleError(interaction, error);
  }
} 