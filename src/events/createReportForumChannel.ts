import { Guild, ChannelType, ForumChannel, PermissionsBitField } from 'discord.js';
import { ModAccess } from '../db/modaccess.js';

export async function ensureReportForumChannel(guild: Guild): Promise<ForumChannel> {
  let forum = guild.channels.cache.find(
    c => c.type === ChannelType.GuildForum && c.name === 'reports-utilisateurs'
  ) as ForumChannel | undefined;

  if (!forum) {
    const access = await ModAccess.findOne({ guildId: guild.id });
    const allowedRoles = access?.allowedRoles || [];

    const permissionOverwrites = [
      { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      ...allowedRoles.map((roleId: string) => ({ id: roleId, allow: [PermissionsBitField.Flags.ViewChannel] })),
      { id: guild.client.user!.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageThreads] },
    ];

    forum = await guild.channels.create({
      name: 'reports-utilisateurs',
      type: ChannelType.GuildForum,
      reason: 'Forum pour les signalements utilisateurs',
      permissionOverwrites: permissionOverwrites,
    }) as ForumChannel;
  }
  return forum;
} 