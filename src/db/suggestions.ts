import mongoose, { Schema, model } from 'mongoose';

const suggestionSchema = new Schema({
  threadId: { type: String, required: true, unique: true },
  messageId: { type: String },
  authorId: { type: String, required: true },
  authorTag: { type: String, required: true },
  suggestion: { type: String, required: true },
  status: { type: String, enum: ['en_attente', 'acceptee', 'refusee'], default: 'en_attente' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const Suggestion = mongoose.models.Suggestion || model('Suggestion', suggestionSchema); 