import { ButtonInteraction, EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ThreadChannel, ChannelType, MessageActionRowComponentBuilder } from 'discord.js';
import { handleError } from '../../utils/errorHandler.js';
import { Suggestion } from '../../db/suggestions.js';

export async function handleSuggestionButtons(interaction: ButtonInteraction) {
  try {
    if (!interaction.customId.startsWith('suggestion_')) return;
    const { guild, member, message, user } = interaction;
    if (!guild || !member || !message) return;

    // Vérification staff simple : owner OU permission Gérer le serveur
    const isStaff = (guild.ownerId === user.id) || (interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild));
    if (!isStaff) {
      return interaction.reply({ content: 'Seul le staff peut traiter/refuser une suggestion.', flags: 64  });
    }

    const action = interaction.customId === 'suggestion_acceptee' ? 'acceptée' : 'refusée';
    const dbStatus = action === 'acceptée' ? 'acceptee' : 'refusee';
    const color = action === 'acceptée' ? 0x57F287 : 0xED4245;
    const statusText = action === 'acceptée' ? '✅ Suggestion acceptée' : '❌ Suggestion refusée';

    // Récupère l'embed d'origine
    const oldEmbed = message.embeds[0];
    if (!oldEmbed) return interaction.reply({ content: 'Embed introuvable.', flags: 64  });

    // Construit le nouvel embed
    const newEmbed = EmbedBuilder.from(oldEmbed)
      .setColor(color)
      .addFields({ name: 'Statut', value: `${statusText} par ${user.tag} (<@${user.id}>)\n<t:${Math.floor(Date.now()/1000)}:F>`, inline: false });

    // Désactive les boutons en reconstruisant un ActionRowBuilder<ButtonBuilder>
    let row = interaction.message.components[0];
    let newRow: ActionRowBuilder<ButtonBuilder> | undefined = undefined;
    if (row && row.type === 1) { // 1 = ActionRow
      const buttons = row.components.map((c: any) => {
        if (c.data) {
          return ButtonBuilder.from(c).setDisabled(true);
        } else {
          // Si c'est déjà un ButtonBuilder
          return c.setDisabled(true);
        }
      });
      newRow = new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);
    }

    // MAJ du statut en base
    const threadId = interaction.channel?.isThread() ? interaction.channel.id : null;
    if (threadId) {
      await Suggestion.findOneAndUpdate(
        { threadId },
        { $set: { status: dbStatus, updatedAt: new Date() } }
      );
    }

    await interaction.update({ embeds: [newEmbed], components: newRow ? [newRow] : [] });
    // Notifie dans le thread
    if (interaction.channel && interaction.channel.type === ChannelType.PublicThread) {
      await (interaction.channel as ThreadChannel).send({ content: `La suggestion a été ${action} par <@${user.id}>.` });
    }
    // Optionnel : DM à l'auteur (si on veut, à activer si besoin)
    // const auteurId = oldEmbed.fields.find(f => f.name === 'Auteur')?.value.match(/<@(\d+)>/)?.[1];
    // if (auteurId) {
    //   try {
    //     const auteur = await guild.members.fetch(auteurId);
    //     await auteur.send(`Ta suggestion a été ${action} par le staff.`);
    //   } catch {}
    // }
  } catch (error) {
    await handleError(interaction, error);
  }
} 