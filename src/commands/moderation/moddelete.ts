import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getModerationCollection } from '../../db/moderation.js';
import { handleError } from '../../utils/errorHandler.js';
import { checkModAccess } from '../../utils/checkModAccess.js';
import { colors } from '../../utils/colors.js';

export const data = new SlashCommandBuilder()
  .setName('moddelete')
  .setDescription("Supprime un warn ou une note d'un utilisateur")
  .addUserOption(option =>
    option.setName('utilisateur')
      .setDescription("L'utilisateur ciblé")
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('type')
      .setDescription('Type à supprimer')
      .addChoices(
        { name: 'Warn', value: 'warns' },
        { name: 'Note', value: 'notes' }
      )
      .setRequired(true)
  )
  .addIntegerOption(option =>
    option.setName('index')
      .setDescription("Numéro de l'élément à supprimer (1 = premier)")
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const target = interaction.options.getUser('utilisateur', true);
    const type = interaction.options.getString('type', true) as 'warns' | 'notes';
    const index = interaction.options.getInteger('index', true) - 1;
    const guild = interaction.guild;
    if (!guild) return interaction.reply({ content: 'Commande utilisable uniquement sur un serveur.', flags: 64 });
    const hasAccess = await checkModAccess(guild, interaction.member as any);
    if (!hasAccess) {
      return interaction.reply({ content: 'Tu ne peux pas utiliser cette commande.', flags: 64 });
    }
    const collection = await getModerationCollection();
    const filter = { guildId: guild.id, userId: target.id };
    const userHistory = await collection.findOne(filter);
    if (!userHistory || !Array.isArray(userHistory[type]) || userHistory[type].length === 0) {
      return interaction.reply({ content: `Aucun ${type === 'warns' ? 'warn' : 'note'} à supprimer.`, flags: 64 });
    }
    if (index < 0 || index >= userHistory[type].length) {
      return interaction.reply({ content: `Index invalide. L'utilisateur a ${userHistory[type].length} ${type === 'warns' ? 'warn(s)' : 'note(s)'}.`, flags: 64 });
    }
    userHistory[type].splice(index, 1);
    await collection.updateOne(filter, { $set: { [type]: userHistory[type] } });
    const embed = new EmbedBuilder()
      .setTitle('Suppression effectuée')
      .setDescription(`Le ${type === 'warns' ? 'warn' : 'note'} #${index + 1} de ${target.tag} a été supprimé.`)
      .setColor(colors.SUCCESS)
      .setThumbnail(target.displayAvatarURL());
    await interaction.reply({ embeds: [embed], flags: 64 });
  } catch (error) {
    await handleError(interaction, error);
  }
}