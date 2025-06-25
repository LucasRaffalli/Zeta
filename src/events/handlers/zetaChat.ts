import OpenAI from 'openai';
import { env } from '../../config.js';
import { Message, Client, TextBasedChannel } from 'discord.js';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/index.js';
import { readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { Suggestion } from '../../db/suggestions.js';

const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
});

const userHistories = new Map<string, ChatCompletionMessageParam[]>();

const userOpenAICount: Map<string, { count: number, reset: number }> = new Map();
const OPENAI_LIMIT = 20;
const OPENAI_WINDOW = 24 * 60 * 60 * 1000;

const SUGGESTION_CHANNEL_ID = '1387118202336710787';
const SUGGESTION_GUILD_ID = '1231025032214609960';

async function getCommandStructure(commandName: string): Promise<string | null> {
    const commandsDir = join(process.cwd(), 'src', 'commands');
    function findCommandFile(dir: string): string | null {
        const files = readdirSync(dir);
        for (const file of files) {
            const filePath = join(dir, file);
            const stat = statSync(filePath);
            if (stat.isDirectory()) {
                const found = findCommandFile(filePath);
                if (found) return found;
            } else if (file.endsWith('.ts') && file.toLowerCase().includes(commandName.split(' ')[0].toLowerCase())) {
                return filePath;
            }
        }
        return null;
    }
    const filePath = findCommandFile(commandsDir);
    if (!filePath) return null;
    try {
        const module = await import(filePath.replace(/\\/g, '/'));
        if (!module.data) return null;
        const data = module.data;
        const parts = commandName.split(' ');
        let structure = '';
        if (parts.length > 1 && data.options) {
            const sub = data.options.find((opt: any) => (opt.type === 1 || opt.type === 2) && (opt.name === parts[1]));
            if (sub) {
                structure = `Nom : \`/${data.name} ${sub.name}\`\nDescription : ${sub.description}`;
                if (sub.options && sub.options.length > 0) {
                    structure += '\nOptions :';
                    for (const opt of sub.options) {
                        structure += `\n- \`${opt.name}\` : ${opt.description} (${opt.required ? 'obligatoire' : 'optionnel'})`;
                    }
                }
                return structure;
            }
        }
        structure = `Nom : \`/${data.name}\`\nDescription : ${data.description}`;
        if (data.options && data.options.length > 0) {
            structure += '\nOptions :';
            for (const opt of data.options) {
                structure += `\n- \`${opt.name}\` : ${opt.description} (${opt.required ? 'obligatoire' : 'optionnel'})`;
            }
        }
        if (data.options && data.options.some((o: any) => o.type === 1)) {
            structure += '\nSous-commandes :';
            for (const opt of data.options.filter((o: any) => o.type === 1)) {
                structure += `\n- \`${opt.name}\` : ${opt.description}`;
            }
        }
        return structure;
    } catch {
        return null;
    }
}

async function createSuggestionForZeta(client: Client, suggestion: string, userId?: string): Promise<string> {
    try {
        const guild = client.guilds.cache.get(SUGGESTION_GUILD_ID);
        let authorTag = 'Utilisateur inconnu';
        let authorId = userId || 'inconnu';
        if (userId && guild) {
            try {
                const member = await guild.members.fetch(userId);
                authorTag = member.user.tag;
                authorId = member.user.id;
            } catch { }
        }
        if (!guild) {
            await Suggestion.create({
                threadId: 'zeta',
                messageId: undefined,
                authorId,
                authorTag,
                suggestion,
                status: 'en_attente',
                createdAt: new Date(),
                updatedAt: new Date()
            });
            return "Ta suggestion a bien été enregistrée, mais le serveur principal n'a pas été trouvé. Elle sera prise en compte par l'équipe !";
        }
        const channel = guild.channels.cache.get(SUGGESTION_CHANNEL_ID);
        if (!channel || channel.type !== 15) { // 15 = GuildForum
            await Suggestion.create({
                threadId: 'zeta',
                messageId: undefined,
                authorId,
                authorTag,
                suggestion,
                status: 'en_attente',
                createdAt: new Date(),
                updatedAt: new Date()
            });
            return "Ta suggestion a bien été enregistrée, mais le salon suggestions n'a pas été trouvé. Elle sera prise en compte par l'équipe !";
        }
        const thread = await (channel as any).threads.create({
            name: `Suggestion de ${authorTag}`,
            autoArchiveDuration: 1440,
            message: {
                content: `Nouvelle suggestion de ${authorTag} (via Zeta)`,
                embeds: [
                    {
                        title: '💡 Nouvelle suggestion',
                        description: suggestion,
                        fields: [
                            { name: 'Auteur', value: `${authorTag} (<@${authorId}>)`, inline: true }
                        ],
                        color: 0x5865F2,
                        timestamp: new Date().toISOString(),
                        footer: { text: `Suggestion envoyée via Zeta` }
                    }
                ]
            },
            reason: `Suggestion automatique de ${authorTag} via Zeta`
        });
        const starterMessage = await thread.fetchStarterMessage();
        await Suggestion.create({
            threadId: thread.id,
            messageId: starterMessage?.id,
            authorId,
            authorTag,
            suggestion,
            status: 'en_attente',
            createdAt: new Date(),
            updatedAt: new Date()
        });
        return "Ta suggestion a bien été envoyée dans le salon suggestions ! Merci pour ta contribution :)";
    } catch (error) {
        return "Erreur lors de la création de la suggestion : " + (error as Error).message;
    }
}

async function getChatResponse(userId: string, question: string, client?: Client): Promise<string> {
    const now = Date.now();
    const usage = userOpenAICount.get(userId);
    if (usage) {
        if (now > usage.reset) {
            userOpenAICount.set(userId, { count: 1, reset: now + OPENAI_WINDOW });
        } else if (usage.count >= OPENAI_LIMIT) {
            const waitH = Math.ceil((usage.reset - now) / (60 * 60 * 1000));
            return `Tu as atteint la limite de ${OPENAI_LIMIT} questions à l'IA pour aujourd'hui. Merci de patienter ${waitH}h avant de pouvoir continuer à discuter avec moi !`;
        } else {
            usage.count++;
            userOpenAICount.set(userId, usage);
        }
    } else {
        userOpenAICount.set(userId, { count: 1, reset: now + OPENAI_WINDOW });
    }
    if (!env.OPENAI_API_KEY) {
        return "L'IA n'est pas configurée. La clé API OpenAI est manquante.";
    }
    let history: ChatCompletionMessageParam[] = userHistories.get(userId) || [];
    history.push({ role: 'user', content: question });
    if (history.length > 10) history = history.slice(history.length - 10);

    let structureInfo = '';
    const structureRegex = /(?:structure|détail|détails|detaillé|détaillée)\s+(?:de|du|d'|:)?\s*\/?([a-zA-Z0-9_-]+)/i;
    const match = question.match(structureRegex);
    if (match && match[1]) {
        const cmdName = match[1].replace(/^\//, '');
        const structure = await getCommandStructure(cmdName);
        if (structure) {
            structureInfo = `**Structure de la commande** :\n${structure}\n\n`;
        }
    }

    const colonSuggestMatch = question.match(/suggestion\s*:\s*(.+)$/i);
    if (colonSuggestMatch) {
        const suggestionText = colonSuggestMatch[1]?.trim();
        if (!suggestionText) {
            const botMention = client ? `<@${client.user?.id}>` : '@Zeta';
            return `Pour me demander de créer une suggestion, écris par exemple : ${botMention} suggestion: ajouter une commande fun`;
        }
        if (client) {
            const result = await createSuggestionForZeta(client, suggestionText, userId);
            return result;
        } else {
            return "Je peux créer une suggestion pour moi, mais je n'ai pas accès au client Discord dans ce contexte.";
        }
    }

    const suggestRegex = /(?:crée|fait|propose|suggère|envoie)\s+(?:une|la)?\s*suggestion.*(?:pour toi|toi-même|zeta|le bot|automatique|auto)/i;
    const matchSuggest = question.match(suggestRegex);
    let suggestionText = '';
    if (matchSuggest) {
        const contentMatch = question.match(/suggestion\s*:?\s*(.+)$/i);
        suggestionText = contentMatch ? contentMatch[1] : 'Suggestion automatique générée par Zeta.';
        if (client) {
            const result = await createSuggestionForZeta(client, suggestionText, userId);
            return result;
        } else {
            return "Je peux créer une suggestion pour moi, mais je n'ai pas accès au client Discord dans ce contexte.";
        }
    }

    try {
        const aiResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: history,
            max_tokens: 1000,
            temperature: 0.7,
        });
        const aiMessage = aiResponse.choices[0].message?.content || "Désolé, une erreur est survenue lors de la génération de la réponse.";
        return structureInfo + aiMessage;
    } catch (error) {
        console.error("Erreur de l'API OpenAI:", error);
        return "Désolé, une erreur est survenue lors de la génération de la réponse.";
    }
}

export async function handleZetaChat(message: Message, client: Client) {
    if (message.author.bot) return;

    const isMention = message.mentions.has(client.user!);
    const isReplyToZeta = !!(message.reference && message.reference.messageId);
    let repliedToZeta = false;
    if (isReplyToZeta) {
        try {
            const repliedMsg = await message.channel.messages.fetch(message.reference!.messageId!);
            if (repliedMsg.author.id === client.user!.id) repliedToZeta = true;
        } catch { }
    }
    if (!isMention && !repliedToZeta) return;

    let question = message.content;
    if (isMention) {
        const mentionRegex = new RegExp(`^<@!?${client.user?.id}>[,:\s]*`, 'i');
        question = question.replace(mentionRegex, '').trim();
    }
    if (question.length === 0) {
        await message.reply("Oui ? Pose-moi ta question !");
        return;
    }
    if ('sendTyping' in message.channel && typeof message.channel.sendTyping === 'function') {
        await message.channel.sendTyping();
    }
    const aiResponse = await getChatResponse(message.author.id, question, client);
    await message.reply(aiResponse);
    return;
}