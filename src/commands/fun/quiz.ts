import { SlashCommandBuilder, ChatInputCommandInteraction, ComponentType, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { ZenithIA } from '../../utils/zenithia.js';

export const data = new SlashCommandBuilder()
  .setName('quiz')
  .setDescription('Zeta te pose une question quiz IA !')
  .addStringOption(opt =>
    opt.setName('theme')
      .setDescription('Thème du quiz (optionnel)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const theme = interaction.options.getString('theme') || undefined;
  await interaction.deferReply();
  const quiz = await ZenithIA.quiz({ userId: interaction.user.id, theme });
  if (!quiz) {
    await interaction.editReply("Désolé, je n'ai pas pu générer de quiz pour le moment. Réessaie plus tard !");
    return;
  }
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    quiz.options.map((opt, i) => new ButtonBuilder()
      .setCustomId(`quiz_${i}`)
      .setLabel(opt)
      .setStyle(ButtonStyle.Primary))
  );
  await interaction.editReply({ content: quiz.question, components: [row] });
  try {
    const btn = await interaction.channel!.awaitMessageComponent({
      filter: i => i.user.id === interaction.user.id && i.customId.startsWith('quiz_'),
      componentType: ComponentType.Button,
      time: 20000
    });
    const idx = parseInt(btn.customId.split('_')[1], 10);
    if (idx === quiz.answer) {
      await btn.reply({ content: 'Bonne réponse ! 🎉' });
    } else {
      await btn.reply({ content: `Raté ! La bonne réponse était : **${quiz.options[quiz.answer]}**.` });
    }
  } catch {
    await interaction.followUp({ content: "⏰ Temps écoulé !", ephemeral: true });
  }
}