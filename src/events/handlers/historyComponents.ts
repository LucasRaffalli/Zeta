import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} from 'discord.js';

const PAGE_SIZE = 5;
const CATEGORIES = ['home', 'warns', 'mutes', 'notes'] as const;
type Category = typeof CATEGORIES[number];

export function buildActionRows(category: Category, page: number, total: number, userId: string) {
  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Ligne 1 : pagination (pas de bouton Home)
  const row1 = new ActionRowBuilder<ButtonBuilder>();
  if (category !== 'home') {
    row1.addComponents(
      new ButtonBuilder()
        .setCustomId(`history_prev_${category}_${page}_${userId}`)
        .setLabel('⬅️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId(`history_next_${category}_${page}_${userId}`)
        .setLabel('➡️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page >= maxPage - 1)
    );
  }
  // Ligne 2 : menu déroulant pour toutes les catégories (y compris Home)
  const select = new StringSelectMenuBuilder()
    .setCustomId(`history_selectcat_${page}_${userId}`)
    .setPlaceholder('Choisir une catégorie')
    .addOptions(
      CATEGORIES.map(cat => ({
        label: cat === 'home' ? '🏠 Home' : cat.charAt(0).toUpperCase() + cat.slice(1),
        value: cat,
        default: cat === category
      }))
    );
  const row2 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
  // Retourne uniquement les lignes non vides
  const rows = [row1, row2].filter(row => row.components.length > 0);
  return rows;
}

export { PAGE_SIZE, CATEGORIES, Category }; 