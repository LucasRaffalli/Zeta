import { ButtonInteraction, ThreadChannel, ChannelType, PermissionsBitField, TextChannel } from 'discord.js';
import { Report } from '../../db/reports.js';
import { ModAccess } from '../../db/modaccess.js';
import { handleError } from '../../utils/errorHandler.js';
import { getModerationCollection } from '../../db/moderation.js';

export async function handleReportButtons(interaction: ButtonInteraction) {
    try {
        if (!interaction.customId.startsWith('report_')) return;
        const { guild } = interaction;
        if (!guild) return;

        const [_, action, reportId] = interaction.customId.split('_');

        if (action === 'moreinfo' || action === 'process') {
            await interaction.deferReply({ ephemeral: true });
        }

        const report = await Report.findById(reportId);
        if (!report) {
            const replyPayload = { content: '❌ Signalement introuvable dans la base de données.', flags: 64 };
            return interaction.deferred ? interaction.editReply(replyPayload) : interaction.reply(replyPayload);
        }

        const channel = interaction.channel as ThreadChannel;
        if (!channel?.isThread()) {
            const replyPayload = { content: '❌ Cette action doit être effectuée dans un thread de signalement.', flags: 64 };
            return interaction.deferred ? interaction.editReply(replyPayload) : interaction.reply(replyPayload);
        }

        switch (action) {
            case 'process':
                await Report.findByIdAndUpdate(reportId, { $set: { status: 'processed', updatedAt: new Date() } });
                await interaction.editReply('✅ Report traité et tous les salons associés vont être fermés.');
                if (report.infoChannelId) {
                    const infoChannel = guild.channels.cache.get(report.infoChannelId);
                    if (infoChannel && infoChannel.isTextBased()) {
                        try {
                            await infoChannel.delete('Signalement traité - fermeture automatique');
                        } catch (e) { }
                    }
                }
                try {
                    await channel.delete('Signalement traité - fermeture automatique');
                } catch (e) { }
                try {
                    await Report.findByIdAndDelete(reportId);
                } catch (e) { }
                break;

            case 'ignore':
                await Report.findByIdAndUpdate(reportId, { $set: { status: 'ignored', updatedAt: new Date() } });
                await interaction.reply(`🚫 Signalement ignoré par ${interaction.user}.`);
                break;

            case 'moreinfo':
                await Report.findByIdAndUpdate(reportId, { $set: { status: 'more_info', updatedAt: new Date() } });
                try {
                    if (report.infoChannelId) {
                        const existing = guild.channels.cache.get(report.infoChannelId);
                        if (existing) {
                            return interaction.editReply({ content: `❌ Un salon de demande d'information existe déjà : <#${report.infoChannelId}>` });
                        }
                    }
                    const member = await guild.members.fetch(report.authorId).catch(() => null);
                    if (!member) {
                        return interaction.editReply({ content: `❌ Impossible d'ajouter l'auteur du report (<@${report.authorId}>). Il a probablement quitté le serveur.` });
                    }

                    let infoCategory = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === 'Informations signalements');
                    if (!infoCategory) {
                        infoCategory = await guild.channels.create({ name: "Informations signalements", type: ChannelType.GuildCategory, reason: 'Catégorie pour les informations signalements' });
                    }

                    const access = await ModAccess.findOne({ guildId: guild.id });
                    const allowedRoles = access?.allowedRoles || [];

                    const permissionOverwrites = [
                        {
                            id: guild.id,
                            deny: [PermissionsBitField.Flags.ViewChannel],
                        },
                        ...allowedRoles.map((roleId: string) => ({
                            id: roleId,
                            allow: [PermissionsBitField.Flags.ViewChannel],
                        })),
                        {
                            id: report.authorId,
                            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
                        },
                        {
                            id: guild.client.user!.id,
                            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels],
                        },
                    ];

                    const infoChannel = await guild.channels.create({
                        name: `plus-info-${member.user.username}-${reportId}`,
                        type: ChannelType.GuildText,
                        parent: infoCategory.id,
                        permissionOverwrites,
                        reason: `Demande d'informations pour signalement ${reportId}`,
                    });

                    await Report.findByIdAndUpdate(reportId, { $set: { infoChannelId: infoChannel.id } });

                    await infoChannel.send({
                        content: `Bonjour <@${report.authorId}>, le staff a besoin de plus d'informations concernant ton signalement. Merci de répondre ici. (Ce salon sera supprimé après la discussion)`
                    });

                    await channel.send({
                        content: `Un salon privé a été créé pour demander plus d'informations à <@${report.authorId}> : <#${infoChannel.id}>`
                    });

                    await interaction.editReply({ content: `✅ Salon privé créé : <#${infoChannel.id}>` });
                } catch (error) {
                    console.error("Erreur lors de la création du salon privé pour plus d'info:", error);
                    await interaction.editReply({ content: `❌ Impossible de créer le salon privé. Vérifiez les permissions du bot.` });
                }
                break;

            default:
                await interaction.reply({ content: '❌ Action invalide.', flags: 64 });
        }

    } catch (error) {
        console.error("Erreur inattendue dans handleReportButtons:", error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: "Une erreur est survenue.", flags: 64 }).catch(() => { });
        }
    }
} 