import { GuildMember, TextChannel, OverwriteType, ChannelType } from 'discord.js';
import { ModRules } from '../db/modrules.js';
import { getModerationCollection, ModerationHistory } from '../db/moderation.js';

export async function checkSanctionAutomatique(member: GuildMember, channel: TextChannel) {
    const guild = member.guild;
    const rules = await ModRules.findOne({ guildId: guild.id });
    if (!rules) return;

    const modCollection = await getModerationCollection();
    let modHistory = await modCollection.findOne({ guildId: guild.id, userId: member.id }) as ModerationHistory;
    if (!modHistory) return;

    const warns = modHistory.warns?.length || 0;
    const mutes = modHistory.mutes?.length || 0;
    
    // Logique de Mute automatique
    if (rules.mute_after_warns && warns >= rules.warn_limit) {
        let mutedRole = guild.roles.cache.find(r => r.name === 'Muted');
        if (!mutedRole) {
            try {
                mutedRole = await guild.roles.create({
                    name: 'Muted',
                    color: '#514f48',
                    permissions: [],
                    reason: 'Rôle pour les utilisateurs mis en sourdine'
                });
                guild.channels.cache.forEach(async (chan) => {
                    if (chan.type === ChannelType.GuildText || chan.type === ChannelType.GuildVoice || chan.type === ChannelType.GuildAnnouncement) {
                        await chan.permissionOverwrites.edit(mutedRole!.id, { SendMessages: false, Speak: false, SendMessagesInThreads: false });
                    }
                });
            } catch (error) {
                console.error("Erreur lors de la création du rôle Muted:", error);
                await channel.send("Impossible de créer le rôle 'Muted'. Vérifiez les permissions du bot.");
                return;
            }
        }
        
        if (mutedRole && !member.roles.cache.has(mutedRole.id)) {
            // **Correctif de sécurité**
            // On récupère tous les rôles actuels du membre, sauf @everyone
            const currentRoles = member.roles.cache.filter(r => r.id !== guild.id);
            // On ajoute le rôle Muted à la liste
            const newRoles = [...currentRoles.values(), mutedRole];

            try {
                // On applique l'ensemble des rôles (anciens + nouveau)
                await member.roles.set(newRoles);
            } catch (error) {
                console.error("Erreur lors de l'assignation du rôle Muted (set roles):", error);
                await channel.send("Une erreur est survenue lors de l'assignation du rôle Muted. L'utilisateur n'a peut-être pas été mis en sourdine.");
                return;
            }

            await modCollection.updateOne(
                { guildId: guild.id, userId: member.id },
                { $push: { mutes: new Date().toISOString() } },
                { upsert: true }
            );
            await channel.send(`🔇 ${member.user.tag} a été automatiquement mis en sourdine après avoir atteint ${rules.warn_limit} avertissements.`);
            // Re-fetch l'historique car il a été modifié
            modHistory = await modCollection.findOne({ guildId: guild.id, userId: member.id }) as ModerationHistory;
        }
    }

    // Logique de Kick automatique
    if (member.kickable && modHistory.mutes?.length >= rules.kick_after_mutes) {
        try {
            await member.kick(`Kick automatique après avoir atteint ${rules.kick_after_mutes} mutes.`);
            await modCollection.updateOne(
                { guildId: guild.id, userId: member.id },
                { $push: { kicks: new Date().toISOString() } },
                { upsert: true }
            );
            await channel.send(`👢 ${member.user.tag} a été automatiquement kick après avoir atteint ${rules.kick_after_mutes} mutes.`);
            // Re-fetch l'historique car il a été modifié
            modHistory = await modCollection.findOne({ guildId: guild.id, userId: member.id }) as ModerationHistory;
        } catch (error) {
            console.error("Erreur lors du kick automatique:", error);
        }
    }

    // Logique de Ban automatique
    if (member.bannable && modHistory.kicks?.length >= rules.ban_after_kicks) {
        try {
            await member.ban({ reason: `Ban automatique après avoir atteint ${rules.ban_after_kicks} kicks.` });
            await modCollection.updateOne(
                { guildId: guild.id, userId: member.id },
                { $push: { bans: new Date().toISOString() } },
                { upsert: true }
            );
            await channel.send(`🔨 ${member.user.tag} a été automatiquement banni après avoir atteint ${rules.ban_after_kicks} kicks.`);
        } catch (error) {
            console.error("Erreur lors du ban automatique:", error);
        }
    }
} 