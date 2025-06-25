import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ChannelType, ForumChannel, PermissionsBitField } from 'discord.js';
import { ModAccess } from '../../db/modaccess.js';
import { handleError } from '../../utils/errorHandler.js';
import { checkModAccess } from '../../utils/checkModAccess.js';
import { colors } from '../../utils/colors.js';

export const data = new SlashCommandBuilder()
    .setName('modaccess')
    .setDescription("Gère l'accès aux commandes de modération pour un membre ou un rôle")
    .addStringOption(option =>
        option.setName('action')
            .setDescription('Ajouter, retirer ou lister les accès')
            .addChoices(
                { name: 'Ajouter', value: 'add' },
                { name: 'Retirer', value: 'remove' },
                { name: 'Lister', value: 'list' }
            )
            .setRequired(true)
    )
    .addUserOption(option =>
        option.setName('membre')
            .setDescription('Le membre à ajouter/retirer')
            .setRequired(false)
    )
    .addRoleOption(option =>
        option.setName('role')
            .setDescription('Le rôle à ajouter/retirer')
            .setRequired(false)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        const action = interaction.options.getString('action', true) as 'add' | 'remove' | 'list';
        const guild = interaction.guild;
        if (!guild) return interaction.reply({ content: 'Commande utilisable uniquement sur un serveur.', flags: 64 });

        if (action === 'list') {
            const access = await ModAccess.findOne({ guildId: interaction.guild!.id });
            const allowedUsers = access?.allowedUsers?.map((id: string) => `<@${id}>`).join(', ') || 'Aucun';
            const allowedRoles = access?.allowedRoles?.map((id: string) => `<@&${id}>`).join(', ') || 'Aucun';
            const embed = new EmbedBuilder()
                .setTitle('Accès modération')
                .addFields(
                    { name: 'Membres autorisés', value: allowedUsers, inline: false },
                    { name: 'Rôles autorisés', value: allowedRoles, inline: false }
                )
                .setColor(colors.PRIMARY);
            return interaction.reply({ embeds: [embed], flags: 64 });
        }

        const member = interaction.options.getUser('membre');
        const role = interaction.options.getRole('role');
        let type: 'user' | 'role' | undefined;
        if (member) type = 'user';
        if (role) type = 'role';
        if (!type) {
            return interaction.reply({ content: 'Merci de préciser un membre ou un rôle.', flags: 64 });
        }

        const hasAccess = await checkModAccess(guild, interaction.member as any);
        if (!hasAccess) {
            return interaction.reply({ content: 'Tu ne peux pas utiliser cette commande.', flags: 64 });
        }

        let cibleId = type === 'user' ? member!.id : role!.id;
        let field = type === 'user' ? 'allowedUsers' : 'allowedRoles';
        let update;

        if (action === 'add') {
            update = { $addToSet: { [field]: cibleId } };
        } else {
            update = { $pull: { [field]: cibleId } };
        }

        if (update) {
            await ModAccess.updateOne({ guildId: guild.id }, update, { upsert: true });

            if (type === 'role') {
                const forum = guild.channels.cache.find(
                    c => c.type === ChannelType.GuildForum && c.name === 'signaler-utilisateurs'
                ) as ForumChannel | undefined;

                if (forum) {
                    const updatedAccess = await ModAccess.findOne({ guildId: guild.id });
                    const allowedRoles = updatedAccess?.allowedRoles || [];

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
                            id: guild.client.user!.id,
                            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageThreads],
                        },
                    ];

                    await forum.edit({ permissionOverwrites });
                }
            }
        }

        const cibleName = type === 'user' ? `<@${cibleId}>` : `<@&${cibleId}>`;
        const embed = new EmbedBuilder()
            .setTitle('Gestion des accès modération')
            .setDescription(`${action === 'add' ? 'Ajouté' : 'Retiré'} : ${cibleName} (${type === 'user' ? 'Membre' : 'Rôle'})`)
            .setColor(action === 'add' ? colors.SUCCESS : colors.ERROR);
        await interaction.reply({ embeds: [embed], flags: 64 });

    } catch (error) {
        await handleError(interaction, error);
    }
}