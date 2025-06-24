import mongoose from 'mongoose';

const modRulesSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  warn_limit: { type: Number, default: 2 },
  mute_after_warns: { type: Boolean, default: true },
  kick_after_mutes: { type: Number, default: 1 },
  ban_after_kicks: { type: Number, default: 1 },
});

export const ModRules = mongoose.models.ModRules || mongoose.model('ModRules', modRulesSchema); 