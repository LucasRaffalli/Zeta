import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ZenithIA } from '../../utils/zenithia.js';

export const data = new SlashCommandBuilder()
    .setName('blague')
    .setDescription('Zeta te raconte une blague IA !');

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const prompt = `Raconte une blague courte, drôle et adaptée à Discord. Réponds uniquement par la blague.`;
    const blague = await ZenithIA.simple({ userId: interaction.user.id, prompt, type: 'simple', max_tokens: 80, temperature: 0.8 });
    if (!blague) {
        await interaction.editReply("Désolé, je n'ai pas pu trouver de blague pour le moment. Réessaie plus tard !");
        return;
    }
    await interaction.editReply({ content: blague });
}