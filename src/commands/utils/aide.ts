import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { commandsMap } from '../../index.js'; // Importer la map des commandes
import OpenAI from 'openai';
import { env } from '../../config.js';
import { colors } from '../../utils/colors.js';

// --- CONFIGURATION DE L'IA ---
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

// --- FONCTION SIMULÉE POUR L'APPEL A L'IA ---
async function getAIHelpResponse(question: string, commandList: string): Promise<string> {
  if (!env.OPENAI_API_KEY) {
    return "L'aide intelligente n'est pas configurée. La clé API OpenAI est manquante.";
  }

  const prompt = `
    Tu es une assistante pour un bot Discord. Ta tâche est d'aider les utilisateurs à trouver la bonne commande.
    Voici la liste des commandes disponibles et leurs descriptions :
    ---
    ${commandList}
    ---
    La question de l'utilisateur est : "${question}"

    Réponds de manière concise et directe en 1 ou 2 phrases. Indique la commande la plus pertinente et explique très brièvement comment l'utiliser.
    Si aucune commande ne semble correspondre, dis-le poliment. Formate les noms de commandes avec des backticks (\`/commande\`).
  `;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
      temperature: 0.2,
    });
    return response.choices[0].message.content || "Je n'ai pas pu générer de réponse.";
  } catch (error) {
    console.error("Erreur de l'API OpenAI:", error);
    throw new Error("Erreur lors de la communication avec l'API d'aide.");
  }
}
// ----------------------------------------------------

export const data = new SlashCommandBuilder()
  .setName('aide')
  .setDescription('Posez une question et je trouverai la commande pour vous.')
  .addStringOption(option =>
    option.setName('question')
      .setDescription('Que voulez-vous faire ? (ex: "comment signaler un utilisateur?")')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const question = interaction.options.getString('question', true);

  // Formater la liste des commandes pour l'IA
  let commandList = '';
  commandsMap.forEach((command, name) => {
    const description = command.data?.description || 'Pas de description';
    commandList += `/${name}: ${description}\\n`;
  });

  try {
    const aiResponse = await getAIHelpResponse(question, commandList);

    const embed = new EmbedBuilder()
      .setTitle('💡 Aide Intelligente')
      .setColor(colors.PRIMARY)
      .addFields(
        { name: 'Votre question', value: question },
        { name: 'Ma recommandation', value: aiResponse }
      )
      .setFooter({ text: 'Cette réponse est générée par une ZenithIA.' });

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error("Erreur lors de l'appel à l'IA pour l'aide:", error);
    await interaction.editReply({ content: 'Désolé, une erreur est survenue lors de la recherche de votre commande.' });
  }
} 