import OpenAI from 'openai';
import { env } from '../config.js';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/index.js';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

const userLimits = new Map<string, { [type: string]: { count: number, reset: number } }>();
const LIMITS = {
    chat: { max: 20, window: 24 * 60 * 60 * 1000 },
    quiz: { max: 10, window: 24 * 60 * 60 * 1000 },
    simple: { max: 20, window: 24 * 60 * 60 * 1000 }
};

const userHistories = new Map<string, ChatCompletionMessageParam[]>();

export const ZenithIA = {
    async chat({ userId, question, systemPrompt }: {
        userId: string,
        question: string,
        systemPrompt?: string
    }): Promise<string | null> {
        // Historique
        let history: ChatCompletionMessageParam[] = userHistories.get(userId) || [];
        history.push({ role: 'user', content: question });
        if (history.length > 10) history = history.slice(history.length - 10);
        // Prompt système par défaut
        const system: ChatCompletionMessageParam = {
            role: 'system',
            content: systemPrompt || "Tu es Zeta, une assistante Discord chaleureuse, drôle et accessible. Réponds toujours en français, de façon naturelle, claire et utile."
        };
        const res = await this._call({
            userId,
            messages: [system, ...history],
            type: 'chat',
            max_tokens: 200,
            temperature: 0.7
        });
        if (res) {
            history.push({ role: 'assistant', content: res });
            if (history.length > 10) history = history.slice(history.length - 10);
            userHistories.set(userId, history);
        }
        return res;
    },

    async quiz({ userId, theme }: { userId?: string, theme?: string }): Promise<{ question: string, options: string[], answer: number } | null> {
        const prompt = `Génère un quiz à choix multiple pour Discord. ${theme ? `Thème : ${theme}.` : ''} Donne la question, 4 propositions, et le numéro (0 à 3) de la bonne réponse. Format JSON : { "question": "...", "options": ["...", "...", "...", "..."], "answer": 2 }`;
        const res = await this._call({
            userId,
            messages: [{ role: 'user', content: prompt }],
            type: 'quiz',
            max_tokens: 200,
            temperature: 0.7
        });
        if (!res) return null;
        try {
            const json = JSON.parse(res.match(/\{[\s\S]*\}/)?.[0] || res);
            if (json.question && Array.isArray(json.options) && typeof json.answer === 'number') {
                return json;
            }
        } catch { }
        return null;
    },

    async simple({ userId, prompt, type = 'simple', max_tokens = 100, temperature = 0.7 }: {
        userId?: string,
        prompt: string,
        type?: keyof typeof LIMITS,
        max_tokens?: number,
        temperature?: number
    }): Promise<string | null> {
        return this._call({ userId, messages: [{ role: 'user', content: prompt }], type, max_tokens, temperature });
    },

    async _call({ userId, messages, type = 'simple', max_tokens = 200, temperature = 0.7 }: {
        userId?: string,
        messages: ChatCompletionMessageParam[],
        type?: keyof typeof LIMITS,
        max_tokens?: number,
        temperature?: number
    }): Promise<string | null> {
        if (userId && LIMITS[type]) {
            const now = Date.now();
            const user = userLimits.get(userId) || {};
            const usage = user[type];
            if (usage) {
                if (now > usage.reset) {
                    user[type] = { count: 1, reset: now + LIMITS[type].window };
                } else if (usage.count >= LIMITS[type].max) {
                    return null;
                } else {
                    usage.count++;
                }
            } else {
                user[type] = { count: 1, reset: now + LIMITS[type].window };
            }
            userLimits.set(userId, user);
        }
        try {
            const response = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages,
                max_tokens,
                temperature
            });
            return response.choices[0].message.content || null;
        } catch (error) {
            console.error('[ZenithIA] Erreur OpenAI:', error);
            return null;
        }
    }
}; 