import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { commandsMap } from '../../index.js'; // Importer la map des commandes
import { ZenithIA } from '../../utils/zenithia.js';
import { colors } from '../../utils/colors.js';

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

  let commandList = '';
  commandsMap.forEach((command, name) => {
    const description = command.data?.description || 'Pas de description';
    commandList += `/${name}: ${description}\n`;
  });

  const prompt = `Tu es une assistante pour un bot Discord. Ta tâche est d'aider les utilisateurs à trouver la bonne commande. Toutes les commandes commencent par un slash (/) et jamais par un préfixe !. Voici la liste des commandes disponibles et leurs descriptions :\n---\n${commandList}\n---\nLa question de l'utilisateur est : "${question}"\nRéponds de manière concise et directe en 1 ou 2 phrases. Indique la commande la plus pertinente et explique très brièvement comment l'utiliser. Si aucune commande ne semble correspondre, dis-le poliment. Formate les noms de commandes avec des backticks (\`/commande\`).`;

  const aiResponse = await ZenithIA.simple({ userId: interaction.user.id, prompt, type: 'simple', max_tokens: 150, temperature: 0.2 });

  if (!aiResponse) {
    await interaction.editReply({ content: 'Désolé, une erreur est survenue lors de la recherche de votre commande.' });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('💡 Aide Intelligente')
    .setColor(colors.PRIMARY)
    .addFields(
      { name: 'Votre question', value: question },
      { name: 'Ma recommandation', value: aiResponse }
    )
    .setFooter({ text: 'Cette réponse est générée par une ZenithIA.' });

  await interaction.editReply({ embeds: [embed] });
} 