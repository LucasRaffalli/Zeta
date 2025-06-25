import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalSubmitInteraction } from 'discord.js';
import { ModRules } from '../../db/modrules.js';
import { colors } from '../../utils/colors.js';

export const data = new SlashCommandBuilder()
  .setName('modrules')
  .setDescription('Gérer les règles de modération')
  .addSubcommand(sub =>
    sub.setName('liste').setDescription('Voir les règles de modération')
  )
  .addSubcommand(sub =>
    sub.setName('modifier').setDescription('Modifier les règles de modération')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guildId!;

  if (sub === 'liste') {
    let rules = await ModRules.findOne({ guildId });
    if (!rules) {
      rules = await ModRules.create({ guildId });
    }
    const embed = new EmbedBuilder()
      .setTitle('Règles de modération')
      .addFields(
        { name: 'Limite de warns', value: rules.warn_limit.toString(), inline: true },
        { name: 'Mute après warns', value: rules.mute_after_warns ? 'Oui' : 'Non', inline: true },
        { name: 'Kick après mutes', value: rules.kick_after_mutes.toString(), inline: true },
        { name: 'Ban après kicks', value: rules.ban_after_kicks.toString(), inline: true },
      )
      .setColor(colors.PRIMARY);
    await interaction.reply({ embeds: [embed], flags: 64 });
  }

  if (sub === 'modifier') {
    let rules = await ModRules.findOne({ guildId });
    if (!rules) {
      rules = await ModRules.create({ guildId });
    }
    const modal = new ModalBuilder()
      .setCustomId('modrules_modal')
      .setTitle('Modifier les règles de modération')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('warn_limit')
            .setLabel('Limite de warns')
            .setStyle(TextInputStyle.Short)
            .setValue(rules.warn_limit.toString())
            .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('mute_after_warns')
            .setLabel('Mute après warns (true/false)')
            .setStyle(TextInputStyle.Short)
            .setValue(rules.mute_after_warns ? 'true' : 'false')
            .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('kick_after_mutes')
            .setLabel('Kick après mutes')
            .setStyle(TextInputStyle.Short)
            .setValue(rules.kick_after_mutes.toString())
            .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('ban_after_kicks')
            .setLabel('Ban après kicks')
            .setStyle(TextInputStyle.Short)
            .setValue(rules.ban_after_kicks.toString())
            .setRequired(true)
        )
      );
    await interaction.showModal(modal);
  }
}

export async function handleModRulesModal(interaction: ModalSubmitInteraction) {
  const guildId = interaction.guildId!;
  const warn_limit = parseInt(interaction.fields.getTextInputValue('warn_limit'));
  const mute_after_warns = interaction.fields.getTextInputValue('mute_after_warns') === 'true';
  const kick_after_mutes = parseInt(interaction.fields.getTextInputValue('kick_after_mutes'));
  const ban_after_kicks = parseInt(interaction.fields.getTextInputValue('ban_after_kicks'));
  await ModRules.findOneAndUpdate(
    { guildId },
    { $set: { warn_limit, mute_after_warns, kick_after_mutes, ban_after_kicks } },
    { upsert: true }
  );
  await interaction.reply({ content: '✅ Règles de modération mises à jour.', flags: 64 });
}