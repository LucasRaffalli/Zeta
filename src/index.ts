export const commandsMap = new Map();
import { Client, GatewayIntentBits, REST, Routes, InteractionType, ChatInputCommandInteraction } from 'discord.js';
import { MongoClient } from 'mongodb';
import { env } from './config.js';
import * as historyCommand from './commands/utils/history.js';
import { registerAllCommands } from './events/registerCommands.js';
import { readdirSync, statSync } from 'fs';
import { join, extname, basename, relative, sep } from 'path';
import { pathToFileURL } from 'url';
import { connectToDB } from './db/index.js';
import { handleInteractionCreate } from './events/interactionCreate.js';
import { handleGuildCreate } from './events/guildCreate.js';

async function connectDB() {
  const mongoClient = new MongoClient(env.MONGO_URI);
  try {
    await mongoClient.connect();
    console.log('📦 Successfully connected to MongoDB.');
    return mongoClient;
  } catch (error) {
    console.error('❌ Could not connect to MongoDB.', error);
    process.exit(1);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ],
});

client.once('ready', async () => {
  console.log(`🤖 Bot is ready! Logged in as ${client.user?.tag}`);
  try {
    await registerAllCommands(env.CLIENT_ID!, env.BOT_TOKEN!);
    console.log('✅ Toutes les commandes slash ont été enregistrées');
  } catch (error) {
    console.error('❌ Erreur lors de l\'enregistrement des commandes', error);
  }
});

client.on('messageCreate', (message) => {
  if (message.author.bot) return;

  if (message.content === 'ping') {
    message.reply('pong');
  }
});

// Chargement dynamique des commandes pour l'exécution
const commandsDir = join(process.cwd(), 'src', 'commands');

function getCommandFiles(dir: string): string[] {
  let results: string[] = [];
  const list = readdirSync(dir);
  list.forEach((file) => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getCommandFiles(filePath));
    } else if (extname(file) === '.ts') {
      results.push(filePath);
    }
  });
  return results;
}
const commandFiles = getCommandFiles(commandsDir);

for (const file of commandFiles) {
  const moduleUrl = pathToFileURL(file).href;
  import(moduleUrl).then((command) => {
    if (command.data && command.execute) {
      const relativePath = relative(commandsDir, file);
      const category = relativePath.split(sep)[0] || 'Général';
      if (typeof command.execute === 'function') {
        commandsMap.set(command.data.name, { ...command, category });
      }
    }
  });
}

client.on('interactionCreate', (interaction) => {
  handleInteractionCreate(interaction, commandsMap);
});

client.on('guildCreate', handleGuildCreate);

async function start() {
  try {
    await connectToDB();
    await client.login(env.BOT_TOKEN);
  } catch (error) {
    console.error("Failed to start the bot:", error);
    process.exit(1);
  }
}

start(); 