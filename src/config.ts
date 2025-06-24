import { config } from 'dotenv';

config({ path: '.env' });

const { BOT_TOKEN, CLIENT_ID, MONGO_URI } = process.env;

if (!BOT_TOKEN || !CLIENT_ID || !MONGO_URI) {
    throw new Error('Missing environment variables. Check .env file.');
}

export const env = {
    BOT_TOKEN,
    CLIENT_ID,
    MONGO_URI,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
};