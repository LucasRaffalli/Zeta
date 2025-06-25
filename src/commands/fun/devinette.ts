import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel, Message } from 'discord.js';
import { ZenithIA } from '../../utils/zenithia.js';

export const data = new SlashCommandBuilder()
    .setName('devinette')
    .setDescription('Zeta te pose une devinette IA !');

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const prompt = `Génère une devinette amusante pour Discord. Réponds au format JSON : { "question": "...", "answer": "..." }`;
    const res = await ZenithIA.simple({ userId: interaction.user.id, prompt, type: 'simple', max_tokens: 100, temperature: 0.7 });
    if (!res) {
        await interaction.editReply("Désolé, je n'ai pas pu générer de devinette pour le moment. Réessaie plus tard !");
        return;
    }
    let question = '', answer = '';
    try {
        const json = JSON.parse(res.match(/\{[\s\S]*\}/)?.[0] || res);
        question = json.question;
        answer = json.answer;
    } catch {
        await interaction.editReply("Erreur lors de la génération de la devinette. Réessaie !");
        return;
    }
    await interaction.editReply({ content: question });
    try {
        const channel = interaction.channel as TextChannel;
        const collected = await channel.awaitMessages({
            filter: (m: Message) => m.author.id === interaction.user.id,
            max: 1,
            time: 20000,
            errors: ['time']
        });
        const rep = collected.first()!.content.trim().toLowerCase();
        if (rep.includes(answer.toLowerCase())) {
            await interaction.followUp({ content: 'Bravo, bonne réponse ! 🎉' });
        } else {
            await interaction.followUp({ content: `Raté ! La réponse était : **${answer}**.` });
        }
    } catch {
        await interaction.followUp({ content: "⏰ Temps écoulé !", ephemeral: true });
    }
}