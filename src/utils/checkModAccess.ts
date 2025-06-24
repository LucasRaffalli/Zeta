import { Guild, GuildMember } from 'discord.js';
import { ModAccess } from '../db/modaccess.js';

export async function checkModAccess(guild: Guild, member: GuildMember): Promise<boolean> {
  if (member.id === guild.ownerId) return true;

  const access = await ModAccess.findOne({ guildId: guild.id });
  if (!access) return false;

  const hasRole = member.roles.cache.some(role => access.allowedRoles.includes(role.id));
  if (hasRole) return true;

  const hasUser = access.allowedUsers.includes(member.id);
  if (hasUser) return true;

  return false;
} 