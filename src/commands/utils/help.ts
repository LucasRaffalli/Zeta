import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { commandsMap } from '../../index.js';
import { colors } from '../../utils/colors.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Affiche la liste de toutes les commandes disponibles.');

// Un peu de style pour les catégories
const categoryEmojis: { [key: string]: string } = {
  moderation: '🛡️',
  members: '👥',
  utils: '🛠️',
  default: '➡️',
};

export async function execute(interaction: ChatInputCommandInteraction) {
  const commandsByCategory = new Map<string, any[]>();

  // Regrouper les commandes par catégorie
  commandsMap.forEach((command) => {
    const category = command.category || 'Général';
    if (!commandsByCategory.has(category)) {
      commandsByCategory.set(category, []);
    }
    commandsByCategory.get(category)!.push(command);
  });

  const embed = new EmbedBuilder()
    .setTitle('📜 Liste des Commandes')
    .setDescription('Voici toutes les commandes que vous pouvez utiliser, groupées par catégorie :')
    .setColor(colors.PRIMARY);

  // Créer un champ pour chaque catégorie
  commandsByCategory.forEach((commands, category) => {
    const commandList = commands
      .map(cmd => `\`/${cmd.data.name}\` - ${cmd.data.description}`)
      .join('\n');
    
    // Mettre la première lettre en majuscule et ajouter un emoji
    const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
    const emoji = categoryEmojis[category.toLowerCase()] || categoryEmojis.default;

    embed.addFields({ name: `**${emoji} ${categoryName}**`, value: commandList });
  });

  await interaction.reply({ embeds: [embed], ephemeral: true });
} 