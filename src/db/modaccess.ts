import mongoose from 'mongoose';

const modAccessSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  allowedUsers: { type: [String], default: [] },
  allowedRoles: { type: [String], default: [] },
});

export const ModAccess = mongoose.models.ModAccess || mongoose.model('ModAccess', modAccessSchema); 