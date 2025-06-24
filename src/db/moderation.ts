import { Collection, Db } from 'mongodb';
import { env } from '../config.js';
import { connectToDB } from './index.js';
import mongoose from 'mongoose';

async function getDb(): Promise<Db> {
  await connectToDB();
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Database not connected, but connectToDB did not throw.");
  }
  return db;
}

export async function getModerationCollection(): Promise<Collection<ModerationHistory>> {
  const db = await getDb();
  return db.collection<ModerationHistory>('moderation');
}

export type Warn = {
  reason: string;
  author: string;
  date: string;
};

export type ModNote = {
  note: string;
  author: string;
  date: string;
};

export type ModerationHistory = {
  guildId: string;
  userId: string;
  warns: Warn[];
  mutes: string[];
  kicks: string[];
  bans: string[];
  notes: ModNote[];
  messageId?: string;
};

export type ModerationAccess = {
  guildId: string;
  allowed: string[]; // userIds
}; 