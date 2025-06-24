import mongoose from 'mongoose';
import { env } from '../config.js';

let isConnected = false;

export async function connectToDB() {
  if (isConnected) {
    console.log('=> using existing database connection');
    return;
  }

  try {
    await mongoose.connect(env.MONGO_URI!);
    isConnected = true;
    console.log('🗂️  database connection');
  } catch (error) {
    console.error('=> error connecting to database:', error);
    throw new Error('Database connection failed');
  }
} 