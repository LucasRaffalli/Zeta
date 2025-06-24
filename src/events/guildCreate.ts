import { Guild, EmbedBuilder, TextChannel, ChannelType } from 'discord.js';
import { colors } from '../utils/colors.js';

export async function handleGuildCreate(guild: Guild) {
  console.log(`Le bot a rejoint un nouveau serveur : ${guild.name} (ID: ${guild.id})`);

  // 1. Trouver un salon approprié pour envoyer le message
  let channelToSend: TextChannel | undefined;

  // Priorité 1 : Le salon système de Discord
  if (guild.systemChannel && guild.systemChannel.permissionsFor(guild.client.user!)?.has('SendMessages')) {
    channelToSend = guild.systemChannel;
  } else {
    // Priorité 2 : Chercher un salon commun comme 'général', 'accueil', 'bienvenue'
    const commonChannelNames = ['général', 'general', 'accueil', 'bienvenue', 'welcome','général'];
    channelToSend = guild.channels.cache.find(channel =>
      channel.type === ChannelType.GuildText &&
      commonChannelNames.includes(channel.name.toLowerCase()) &&
      channel.permissionsFor(guild.client.user!)?.has('SendMessages')
    ) as TextChannel | undefined;
  }

  // Si aucun salon commun n'est trouvé, prendre le premier salon textuel disponible
  if (!channelToSend) {
    channelToSend = guild.channels.cache.find(channel =>
      channel.type === ChannelType.GuildText &&
      channel.permissionsFor(guild.client.user!)?.has('SendMessages')
    ) as TextChannel | undefined;
  }

  if (!channelToSend) {
    console.warn(`Impossible de trouver un salon pour envoyer le message de bienvenue sur ${guild.name}.`);
    return;
  }

  // 2. Créer un bel embed de bienvenue
  const welcomeEmbed = new EmbedBuilder()
    .setColor(colors.PRIMARY)
    .setTitle('👋 Bonjour ! Je suis Zeta, votre nouvelle assistante.')
    .setDescription("Merci de m'avoir ajouté à votre serveur ! Je suis ici pour vous aider avec la modération et plus encore.")
    .addFields(
      { name: '🚀 Pour commencer', value: 'Voici quelques commandes pour bien démarrer :' },
      { name: '`/help`', value: 'Affiche la liste complète de toutes mes commandes.', inline: true },
      { name: '`/aide`', value: 'Posez-moi une question en langage naturel et je trouverai la commande pour vous.', inline: true },
      { name: 'Configuration (pour les administrateurs)', value: 'Utilisez `/modaccess` pour définir qui peut utiliser les commandes de modération et `/modrules` pour configurer les sanctions automatiques.' }
    )
    .setThumbnail(guild.client.user!.displayAvatarURL())
    .setFooter({ text: `Zeta à votre service sur ${guild.name}` })
    .setTimestamp();

  // 3. Envoyer le message
  try {
    await channelToSend.send({ embeds: [welcomeEmbed] });
  } catch (error) {
    console.error(`Impossible d'envoyer le message de bienvenue sur ${guild.name}:`, error);
  }
} 