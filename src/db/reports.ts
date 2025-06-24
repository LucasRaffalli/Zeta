import mongoose, { Schema, model } from 'mongoose';

const reportSchema = new Schema({
  threadId: { type: String, required: true, unique: true },
  reportId: { type: String },
  targetId: { type: String, required: true },
  authorId: { type: String, required: true },
  reason: { type: String, required: true },
  proof: { type: String },
  status: { type: String, enum: ['pending', 'processed', 'ignored', 'more_info'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  notes: [{ 
    content: String, 
    authorId: String, 
    createdAt: { type: Date, default: Date.now }
  }],
  infoChannelId: { type: String },
});

export const Report = mongoose.models.Report || model('Report', reportSchema); 