import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { env } from '../config.js';
import { readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { pathToFileURL } from 'url';

// Récupère récursivement tous les fichiers .ts dans un dossier
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

export async function registerAllCommands(clientId: string, token: string) {
  const commands: any[] = [];
  const commandFiles = getCommandFiles(join(process.cwd(), 'src', 'commands'));
  for (const file of commandFiles) {
    const moduleUrl = pathToFileURL(file).href;
    const command = await import(moduleUrl);
    if (command.data && command.data instanceof SlashCommandBuilder) {
      commands.push(command.data.toJSON());
    }
  }
  const rest = new REST({ version: '10' }).setToken(token);
  await rest.put(
    Routes.applicationCommands(clientId),
    { body: commands }
  );
  return commands;
} 