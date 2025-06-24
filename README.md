# Zeta - Votre Assistante de Modération Intelligente pour Discord

![Zeta Banner](URL_DE_VOTRE_BANNIERE_ICI)  <!-- Pensez à ajouter une bannière visuelle pour votre projet ! -->

**Zeta** est bien plus qu'un simple bot de modération. C'est une assistante complète, conçue pour rendre la gestion de votre serveur Discord plus simple, plus intuitive et plus efficace. Grâce à son intégration de l'IA et à ses fonctionnalités avancées, Zeta veille sur votre communauté avec intelligence et précision.

---

## 🚀 Fonctionnalités Clés

-   **Système de Modération Complet** :
    -   `/warn`, avec un historique complet pour chaque membre (`/history`).
    -   Gestion des notes de modération privées (`/modnote`).
    -   Système de signalement (`/report`) avec création de threads privés pour le staff.

-   **Automatisation Intelligente (Auto-Mod)** :
    -   Configurez des règles de sanctions automatiques avec `/modrules`.
    -   Exemple : Mute automatique après 3 avertissements, kick après 2 mutes, etc.

-   **Aide Intelligente Propulsée par l'IA** :
    -   Une commande `/aide` qui comprend le langage naturel pour guider les utilisateurs vers la bonne commande.

-   **Gestion Fine des Permissions** :
    -   Contrôlez précisément qui peut utiliser les commandes de modération avec `/modaccess`.

-   **Interface Claire et Agréable** :
    -   Toutes les interactions se font via des embeds soignés et des composants interactifs (boutons, modaux).

---

## ⚙️ Installation et Configuration

Pour inviter Zeta sur votre serveur et la rendre opérationnelle, suivez ces étapes.

### 1. Prérequis

-   [Node.js](https://nodejs.org/) (v18 ou supérieur recommandé)
-   Un compte [MongoDB](https://www.mongodb.com/) pour le stockage des données.
-   (Optionnel mais recommandé) Une clé API [OpenAI](https://platform.openai.com/) pour la commande `/aide`.

### 2. Installation

1.  **Clonez le dépôt :**
    ```bash
    git clone [URL_DE_VOTRE_DEPOT_GIT]
    cd [NOM_DU_DOSSIER]
    ```

2.  **Installez les dépendances :**
    ```bash
    pnpm install
    ```
    *(Si vous n'avez pas pnpm, installez-le avec `npm install -g pnpm`)*

### 3. Configuration

1.  **Créez un fichier `.env`** à la racine du projet en copiant le modèle `.env.example`.

2.  **Remplissez le fichier `.env`** avec vos informations :
    ```env
    # Token de votre bot Discord
    BOT_TOKEN=VOTRE_TOKEN_DISCORD

    # ID Client de votre application Discord
    CLIENT_ID=VOTRE_ID_CLIENT

    # URI de connexion à votre base de données MongoDB
    MONGO_URI=VOTRE_URI_MONGODB

    # (Optionnel) Clé API OpenAI
    OPENAI_API_KEY=VOTRE_CLE_OPENAI
    ```

### 4. Lancement

-   **Pour le développement (avec rechargement automatique) :**
    ```bash
    npm run dev  # ou la commande que vous utilisez pour nodemon
    ```

-   **Pour la production :**
    ```bash
    npm start # ou la commande de démarrage que vous utilisez
    ```

---

##  कमांड्स Principales

Voici un aperçu de ce que Zeta peut faire :

| Commande        | Description                                                 |
| --------------- | ----------------------------------------------------------- |
| `/help`         | Affiche la liste complète de toutes les commandes.          |
| `/aide`         | Demandez de l'aide en langage naturel.                      |
| `/report`       | Signaler un utilisateur au staff via un formulaire privé.   |
| `/history`      | Consulter l'historique de modération d'un membre.           |
| `/modaccess`    | Gérer les permissions des commandes de modération.          |
| `/modrules`     | Configurer les règles de sanctions automatiques.            |
| `/warn`         | Ajouter un avertissement à un utilisateur.                  |

---

##🤝 Contribution

Les contributions sont les bienvenues ! Si vous souhaitez améliorer Zeta, n'hésitez pas à forker le dépôt et à soumettre une Pull Request.

---

*Ce projet est développé avec ❤️ et beaucoup de TypeScript.* 