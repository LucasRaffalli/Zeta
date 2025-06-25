import { SlashCommandBuilder, ChatInputCommandInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalSubmitInteraction, EmbedBuilder, Guild, ButtonBuilder, ButtonStyle } from 'discord.js';
import { handleError } from '../../utils/errorHandler.js';
import { ensureReportForumChannel } from '../../events/createReportForumChannel.js';
import { Report } from '../../db/reports.js';
import { getModerationCollection } from '../../db/moderation.js';
import { ModAccess } from '../../db/modaccess.js';
import { colors } from '../../utils/colors.js';

export const data = new SlashCommandBuilder()
    .setName('signaler')
    .setDescription("Signaler un utilisateur au staff (formulaire)")
    .addUserOption(option =>
        option.setName('utilisateur')
            .setDescription("L'utilisateur à signaler")
            .setRequired(true)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        const target = interaction.options.getUser('utilisateur', true);
        if (target.id === interaction.user.id) {
            return interaction.reply({ content: 'Tu ne peux pas te signaler toi-même.', flags: 64 });
        }
        const modal = new ModalBuilder()
            .setCustomId(`report_modal_${target.id}`)
            .setTitle('Signaler un utilisateur')
            .addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(
                    new TextInputBuilder()
                        .setCustomId('raison')
                        .setLabel('Raison du signalement')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                ),
                new ActionRowBuilder<TextInputBuilder>().addComponents(
                    new TextInputBuilder()
                        .setCustomId('preuve')
                        .setLabel('Preuve (lien, optionnel)')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(false)
                )
            );
        await interaction.showModal(modal);
    } catch (error) {
        await handleError(interaction, error);
    }
}

export async function handleReportModal(interaction: ModalSubmitInteraction) {
    try {
        const { client, guild } = interaction;
        if (!guild) return interaction.reply({ content: 'Commande utilisable uniquement sur un serveur.', flags: 64  });

        const userId = interaction.customId.split('_')[2];
        const raison = interaction.fields.getTextInputValue('raison');
        const preuve = interaction.fields.getTextInputValue('preuve');
        const target = await guild.members.fetch(userId).then(m => m.user).catch(() => null);
        if (!target) return interaction.reply({ content: 'Utilisateur introuvable.', flags: 64  });

        await interaction.deferReply({ ephemeral: true });

        const forum = await ensureReportForumChannel(guild);

        const embed = new EmbedBuilder()
            .setTitle('Nouveau signalement utilisateur')
            .addFields(
                { name: 'Signalé', value: `<@${target.id}>\nTag: ${target.tag}\nID: ${target.id}`, inline: true },
                { name: 'Auteur du signalement', value: `<@${interaction.user.id}>\nTag: ${interaction.user.tag}\nID: ${interaction.user.id}`, inline: true },
                { name: 'Raison', value: raison, inline: false },
                { name: 'Channel d\'origine', value: `<#${interaction.channelId}>`, inline: false }
            )
            .setThumbnail(target.displayAvatarURL())
            .setFooter({ text: `Signalement créé par ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp()
            .setColor(colors.REPORT);

        if (preuve) {
            embed.addFields({ name: 'Preuve', value: preuve, inline: false });
            if (preuve.match(/^https?:\/\//)) embed.setImage(preuve);
        }

        const modCollection = await getModerationCollection();
        const modHistory = await modCollection.findOne({ guildId: guild.id, userId: target.id });

        if (modHistory?.notes && modHistory.notes.length > 0) {
            const notesText = modHistory.notes
                .map(note => `[${new Date(note.date).toLocaleDateString()}] ${note.note} (par ${note.author})`)
                .join('\n');
            embed.addFields({
                name: '📝 Notes de modération existantes',
                value: notesText.length > 1024 ? notesText.slice(0, 1021) + '...' : notesText,
                inline: false
            });
        }

        // Récupérer les rôles à notifier
        const access = await ModAccess.findOne({ guildId: guild.id });
        const rolesToPing = access?.allowedRoles?.map((id: string) => `<@&${id}>`).join(' ') || '';

        // On utilise la méthode standard pour créer le thread
        const thread = await forum.threads.create({
            name: `Signalement: ${target.tag} (${target.id})`,
            autoArchiveDuration: 1440,
            message: {
                content: `Nouveau Signalement de <@${interaction.user.id}> concernant <@${target.id}>\n\n**Notification :** ${rolesToPing}`,
                embeds: [embed],
            },
            reason: `Signalement de ${interaction.user.tag} contre ${target.tag}`,
        });

        const report = await Report.create({
            threadId: thread.id,
            targetId: target.id,
            authorId: interaction.user.id,
            reason: raison,
            proof: preuve || null
        });

        embed.addFields({ name: 'ID du signalement', value: report.id, inline: false });

        const buttons = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder().setCustomId(`report_process_${report.id}`).setLabel('Fermer').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`report_moreinfo_${report.id}`).setLabel('Demander plus d\'informations').setStyle(ButtonStyle.Primary)
            );

        const starterMessage = await thread.fetchStarterMessage();
        if (starterMessage) {
            await starterMessage.edit({ embeds: [embed], components: [buttons] });
        }

        await interaction.editReply({ content: '✅ Ton signalement a bien été transmis au staff. Je vais te contacter en message privé pour l\'ajout de preuves.' });

        try {
            const dmChannel = await interaction.user.createDM();
            await dmChannel.send('Vous pouvez envoyer votre preuve (image, fichier ou lien) ici. Vous avez 2 minutes. Votre message sera transmis de manière confidentielle au staff.');

            const filter = (m: any) => m.author.id === interaction.user.id && (m.attachments.size > 0 || m.content.match(/^https?:\/\/[^\s]+/));

            const collected = await dmChannel.awaitMessages({ filter, max: 1, time: 120_000, errors: ['time'] });
            const msg = collected.first();

            if (msg) {
                const files = msg.attachments.map((a: any) => a.url);
                const proofLink = msg.content.match(/^https?:\/\/[^\s]+/)?.[0];
                let proofContent = '';

                if (files.length > 0) {
                    proofContent = files[0];
                    await thread.send({ content: `Preuve ajoutée par <@${interaction.user.id}> :`, files });
                } else if (proofLink) {
                    proofContent = proofLink;
                    await thread.send({ content: `Preuve (lien) ajoutée par <@${interaction.user.id}> : ${proofLink}` });
                }

                if (proofContent) {
                    await Report.findByIdAndUpdate(report.id, { $set: { proof: proofContent } });
                }

                await dmChannel.send('✅ Preuve ajoutée au signalement.');
            }
        } catch (error) {
            if (error instanceof Error && error.message.includes('time')) {
                await interaction.user.send('⌛ Temps écoulé pour ajouter une preuve.').catch(() => { });
            } else {
                await interaction.followUp({
                    content: '⚠️ Je n\'ai pas pu vous contacter en message privé. Vos MPs sont peut-être fermés. Si vous souhaitez ajouter une preuve, contactez un membre du staff.',
                    ephemeral: true
                }).catch(() => { });
            }
        }

    } catch (error) {
        await handleError(interaction, error);
    }
} 