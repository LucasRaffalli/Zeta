// ... existing code ...
export const activities = [
    { name: 'protéger la communauté', type: 0 },      // Joue à
    { name: 'les nouveaux arrivants', type: 1 },      // Regarde
    { name: 'vos idées', type: 2 },                   // Écoute
    { name: 'la modération en action', type: 1 },     // Regarde
    { name: 'les discussions actives', type: 2 },     // Écoute
    { name: 'la sécurité du serveur', type: 0 },      // Joue à
    { name: 'les commandes des membres', type: 1 },   // Regarde
    { name: 'vos rapports', type: 2 },                // Écoute
];

export function setRandomActivity(client: any) {
    const activity = activities[Math.floor(Math.random() * activities.length)];
    client.user?.setPresence({
        activities: [activity],
        status: 'idle',
    });
}