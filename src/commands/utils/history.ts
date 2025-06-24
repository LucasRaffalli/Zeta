import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ButtonInteraction, GuildMember, StringSelectMenuInteraction, Guild } from 'discord.js';
import { getModerationCollection, ModerationHistory } from '../../db/moderation.js';
import { handleError } from '../../utils/errorHandler.js';
import { buildActionRows, PAGE_SIZE, CATEGORIES, Category } from '../../events/handlers/historyComponents.js';
import { colors } from '../../utils/colors.js';
import { ModAccess } from '../../db/modaccess.js';

function buildHomeEmbed(history: ModerationHistory | null, member: GuildMember) {
  return new EmbedBuilder()
    .setTitle(`Résumé de ${member.user.tag}`)
    .setThumbnail(member.user.displayAvatarURL())
    .addFields(
      { name: 'Warns', value: `${history?.warns?.length || 0}`, inline: true },
      { name: 'Mutes', value: `${history?.mutes?.length || 0}`, inline: true },
      { name: 'Notes', value: `${history?.notes?.length || 0}`, inline: true },
      { name: 'Arrivé sur le serveur', value: `<t:${Math.floor(member.joinedTimestamp! / 1000)}:F>`, inline: false },
      { name: 'ID', value: member.id, inline: false }
    )
    .setColor(colors.PRIMARY)
}

function buildEmbed(history: ModerationHistory | null, targetTag: string, category: Category, page: number, userId: string) {
  if (category === 'home') {
    return new EmbedBuilder().setTitle('Erreur').setDescription('Page inconnue.');
  }
  let items: any[] = [];
  if (history) {
    const arr = history[category as keyof Omit<ModerationHistory, 'userId' | 'guildId'>];
    items = Array.isArray(arr) ? arr : [];
  }

  let total = items.length;
  let start = page * PAGE_SIZE;
  let end = start + PAGE_SIZE;
  let pageItems = items.slice(start, end);
  let desc = '';

  if (category === 'warns') {
    desc = (pageItems as any[]).length
      ? (pageItems as any[]).map((w: any, i: number) => `#${start + i + 1} • **${w.reason}**\nPar: ${w.author}\nDate: <t:${Math.floor(new Date(w.date).getTime() / 1000)}:f>`).join('\n\n')
      : 'Aucun avertissement.';
  } else if (category === 'notes') {
    desc = (pageItems as any[]).length
      ? (pageItems as any[]).map((n: any, i: number) => `#${start + i + 1} • **${n.note}**\nPar: ${n.author}\nDate: <t:${Math.floor(new Date(n.date).getTime() / 1000)}:f>`).join('\n\n')
      : 'Aucune note.';
  } else {
    desc = (pageItems as string[]).length
      ? (pageItems as string[]).map((v: string, i: number) => `#${start + i + 1} • ${v}`).join('\n')
      : 'Aucun mute.';
  }

  return new EmbedBuilder()
    .setTitle(`Historique de ${targetTag} — ${category.charAt(0).toUpperCase() + category.slice(1)}`)
    .setDescription(desc)
    .setFooter({ text: `userId:${userId}` })
    .setColor(colors.PRIMARY);
}

export const data = new SlashCommandBuilder()
  .setName('history')
  .setDescription("Affiche l'historique de modération d'un utilisateur")
  .addUserOption(option =>
    option.setName('utilisateur')
      .setDescription("L'utilisateur à consulter")
      .setRequired(true)
  );

async function checkModAccess(guild: Guild, user: GuildMember) {
  const ownerId = (await guild.fetchOwner()).id;
  if (user.id === ownerId) return true;

  const access = await ModAccess.findOne({ guildId: guild.id });
  if (!access) return false;
  if (access.allowedUsers && access.allowedUsers.includes(user.id)) return true;
  if (access.allowedRoles && user.roles && user.roles.cache) {
    const userRoles = user.roles.cache.map((r: any) => r.id);
    if (access.allowedRoles.some((rid: string) => userRoles.includes(rid))) return true;
  }
  return false;
}

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const target = interaction.options.getUser('utilisateur', true);
    const guild = interaction.guild;
    if (!guild) return interaction.reply({ content: 'Commande utilisable uniquement sur un serveur.', ephemeral: true });
    const hasAccess = await checkModAccess(guild, interaction.member as GuildMember);
    if (!hasAccess) {
      return interaction.reply({ content: 'Tu ne peux pas utiliser cette commande.', ephemeral: true });
    }
    const collection = await getModerationCollection();
    const history = await collection.findOne<ModerationHistory>({ guildId: guild.id, userId: target.id });
    const member = await guild.members.fetch(target.id);
    const category: Category = 'home';
    const page = 0;
    const embed = buildHomeEmbed(history, member);
    const rowArr = buildActionRows(category, page, 0, member.id);
    const sent = await interaction.reply({ embeds: [embed], components: rowArr.filter(Boolean), ephemeral: false, fetchReply: true });
    setTimeout(() => {
      sent.delete().catch(() => { });
    }, 300000); // 5 minutes
  } catch (error) {
    await handleError(interaction, error);
  }
}

export async function handleHistoryButton(interaction: ButtonInteraction | StringSelectMenuInteraction) {
  try {
    let action, category, pageStr, userId;
    if (interaction.isStringSelectMenu()) {
      const parts = interaction.customId.split('_');
      action = parts[1];
      pageStr = parts[2];
      userId = parts[3];
      category = interaction.values[0];
    } else {
      const parts = interaction.customId.split('_');
      action = parts[1];
      category = parts[2];
      pageStr = parts[3];
      userId = parts[4];
    }
    let page = parseInt(pageStr, 10);
    let cat = category as Category;
    if (!CATEGORIES.includes(cat)) cat = 'home';
    const guild = interaction.guild;
    if (!guild) return interaction.reply({ content: 'Serveur introuvable.', ephemeral: true });
    let member: GuildMember | undefined;
    try {
      member = await guild.members.fetch(userId);
    } catch {
      return interaction.reply({ content: 'Utilisateur introuvable ou a quitté le serveur.', ephemeral: true });
    }
    const collection = await getModerationCollection();
    const history = await collection.findOne<ModerationHistory>({ guildId: guild.id, userId: member.id });
    if (action === 'cat' || action === 'selectcat') page = 0;
    if (action === 'prev' && page > 0) page--;
    if (action === 'next') page++;
    const catCategory = cat as Category;
    const isHome = (cat as any) === 'home';
    const embed = isHome
      ? buildHomeEmbed(history, member)
      : buildEmbed(history, member.user.tag, cat, page, member.id);
    let totalItems = 0;
    if (!isHome && history) {
      totalItems = history[cat as Exclude<Category, 'home'>]?.length || 0;
    }
    const rowArr = buildActionRows(catCategory, page, totalItems, member.id);
    await interaction.update({ embeds: [embed], components: rowArr.filter(Boolean) });
  } catch (error) {
    await handleError(interaction, error);
  }
}