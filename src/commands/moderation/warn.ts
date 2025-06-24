import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, GuildMember, TextChannel } from 'discord.js';
import { getModerationCollection } from '../../db/moderation.js';
import { handleError } from '../../utils/errorHandler.js';
import { checkModAccess } from '../../utils/checkModAccess.js';
import { checkSanctionAutomatique } from '../../features/automod.js';
import { colors } from '../../utils/colors.js';

export const data = new SlashCommandBuilder()
  .setName('warn')
  .setDescription("Ajoute un avertissement à un utilisateur")
  .addUserOption(option =>
    option.setName('utilisateur')
      .setDescription("L'utilisateur à avertir")
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('raison')
      .setDescription('Raison de l\'avertissement')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const target = interaction.options.getUser('utilisateur', true);
    const reason = interaction.options.getString('raison') || 'Aucune raison spécifiée';
    const guild = interaction.guild;
    if (!guild) return interaction.reply({ content: 'Commande utilisable uniquement sur un serveur.', ephemeral: true });

    const hasAccess = await checkModAccess(guild, interaction.member as any);
    if (!hasAccess) {
      return interaction.reply({ content: 'Tu ne peux pas utiliser cette commande.', ephemeral: true });
    }

    const warnObj = {
      reason,
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
        warns: [warnObj],
        bans: [],
        kicks: [],
        mutes: [],
        notes: []
      });
    } else {
      if (!Array.isArray(existing.warns)) {
        await collection.updateOne(filter, { $set: { warns: [] } });
      }
      await collection.updateOne(filter, { $push: { warns: warnObj } });
    }

    const embed = new EmbedBuilder()
      .setTitle('Avertissement ajouté')
      .setDescription(`L'utilisateur ${target.tag} a été averti.`)
      .addFields(
        { name: 'Raison', value: reason, inline: false },
        { name: 'Auteur', value: interaction.user.tag, inline: true },
        { name: 'Date', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true }
      )
      .setColor(colors.SUCCESS)
      .setThumbnail(target.displayAvatarURL());

    await interaction.reply({ embeds: [embed], ephemeral: true });

    // Vérifier les sanctions automatiques
    const targetMember = await guild.members.fetch(target.id);
    await checkSanctionAutomatique(targetMember, interaction.channel as TextChannel);
  } catch (error) {
    await handleError(interaction, error);
  }
} 