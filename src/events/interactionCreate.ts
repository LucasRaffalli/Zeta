import { Interaction } from 'discord.js';
import * as historyCommand from '../commands/utils/history.js';

export async function handleInteractionCreate(interaction: Interaction, commandsMap: Map<string, any>) {
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('history_')) {
    await historyCommand.handleHistoryButton(interaction);
    return;
  }
  if (interaction.isButton() && interaction.customId.startsWith('history_')) {
    await historyCommand.handleHistoryButton(interaction);
    return;
  }
  if (interaction.isButton() && interaction.customId.startsWith('report_')) {
    const { handleReportButtons } = await import('./handlers/reportButtons.js');
    await handleReportButtons(interaction);
    return;
  }
  if (interaction.isModalSubmit() && interaction.customId.startsWith('modnote_modal')) {
    const modnote = await import('../commands/moderation/modnote.js');
    await modnote.handleModNoteModal(interaction);
    return;
  }
  if (interaction.isModalSubmit() && interaction.customId.startsWith('report_modal')) {
    const report = await import('../commands/members/report.js');
    await report.handleReportModal(interaction);
    return;
  }
  if (interaction.isModalSubmit() && interaction.customId === 'modrules_modal') {
    const { handleModRulesModal } = await import('../commands/moderation/modrules.js');
    await handleModRulesModal(interaction);
    return;
  }
  if (!interaction.isChatInputCommand()) return;
  
  const command = commandsMap.get(interaction.commandName);
  
  if (command && typeof command.execute === 'function') {
    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Erreur lors de l'exécution de la commande ${interaction.commandName}:`, error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'Une erreur est survenue lors de l\'exécution de cette commande!', ephemeral: true });
      } else {
        await interaction.reply({ content: 'Une erreur est survenue lors de l\'exécution de cette commande!', ephemeral: true });
      }
    }
  } else {
    console.warn(`Aucune commande correspondante trouvée pour "${interaction.commandName}".`);
  }
} 