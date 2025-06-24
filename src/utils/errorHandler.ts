import { Interaction } from 'discord.js';

export async function handleError(interaction: Interaction, error: unknown) {
  console.error('Une erreur est survenue :', error);
  if (interaction.isRepliable()) {
    try {
      await interaction.reply({
        content: '❌ Une erreur est survenue. Merci de réessayer plus tard.',
        ephemeral: true
      });
    } catch {
      // Si la réponse a déjà été envoyée
      try {
        await interaction.followUp({
          content: '❌ Une erreur est survenue. Merci de réessayer plus tard.',
          ephemeral: true
        });
      } catch {}
    }
  }
} 