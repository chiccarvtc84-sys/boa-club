# 📋 Récapitulatif complet — Projet Boa Club

## Ce que tu as entre les mains

Un dossier complet à mettre directement dans Claude Code pour qu'il reprenne le projet là où on l'a laissé.

## Comment l'utiliser avec Claude Code

### Option A — En local
1. Décompresse le ZIP dans un dossier `boa-club/`
2. Initialise Git : `cd boa-club && git init && git add . && git commit -m "Initial setup from web"`
3. Lance Claude Code dans ce dossier : `claude`
4. **Ton premier message à Claude Code** :
   > « Lis le fichier CLAUDE.md à la racine, c'est le brief complet du projet. On en est à l'étape 3 partie 2 : il faut coder le serveur Go (config, connexion BDD/Redis, endpoint /health). On part là-dessus. »

### Option B — Sur GitHub
1. Crée un repo `boa-club` sur GitHub
2. Pousse le contenu du ZIP
3. Ouvre le repo dans Claude Code (web ou desktop)
4. Même premier message qu'en option A

## ✅ Ce qui a été fait jusqu'ici

### Étape 1 — Spec produit
- Document `Spec_MVP_App_Salle_Combat.docx` (256 paragraphes)
- 11 sections : vision, personas, périmètre fonctionnel, transition Instagram, modèle BDD, architecture, écrans, roadmap, V2, risques, prochaines étapes

### Étape 2 — Prototype visuel
- ~10 itérations sur un prototype HTML/CSS/JS interactif
- Identité visuelle finale : noir + rouge Bōa + blanc
- Logo officiel du club intégré
- Vrai planning du Boa Club intégré (17 cours)
- 7 écrans : Planning, Créneaux libres, Détail créneau, Profil utilisateur, Messagerie, Réglages, Création de créneau

### Étape 3 partie 1 — Fondations backend ✅
**Inclus dans ce bundle :**

| Fichier | Rôle |
|---|---|
| `CLAUDE.md` | **Brief prioritaire pour Claude Code (à lire en premier !)** |
| `README.md` | Documentation publique du projet |
| `Makefile` | Commandes : `make db-up`, `make migrate`, `make run`, etc. |
| `docker-compose.yml` | Postgres 16 + Redis 7 en local |
| `.gitignore` | Fichiers à ignorer par Git |
| `api/.env.example` | Template des variables d'environnement |
| `api/migrations/001_create_users.{up,down}.sql` | Table users + rôles + ceintures |
| `api/migrations/002_create_courses.{up,down}.sql` | Cours récurrents + instances |
| `api/migrations/003_create_free_slots.{up,down}.sql` | Créneaux libres + participants |
| `api/migrations/004_create_messaging.{up,down}.sql` | DM + threads de créneaux |
| `api/migrations/005_create_sessions_notifications.{up,down}.sql` | JWT + audit notifs |
| `api/migrations/006_seed_boa_club.{up,down}.sql` | Vrai planning du Boa Club + compte Victor |

## 🚧 Ce qu'il reste à faire (pour Claude Code)

### Étape 3 partie 2 — Setup serveur Go
- `api/go.mod` avec les bonnes dépendances
- `api/cmd/server/main.go` (point d'entrée)
- `api/cmd/migrate/main.go` (commande de migration)
- `api/internal/config/` (chargement .env)
- `api/internal/database/` (Postgres + Redis)
- `api/internal/handlers/health.go`
- `api/internal/middleware/` (logger + CORS)

### Étape 3 partie 3 — Authentification
- JWT (access 15min + refresh 30j avec rotation)
- Bcrypt
- 6 endpoints : register, login, refresh, logout, forgot-password, reset-password
- Middleware auth + rate limiting

### Étape 3 partie 4 — Endpoints métier
- Profil utilisateur (`/api/me`)
- Planning (`/api/courses/week`)
- Notifs coach (retard / absent)
- CRUD créneaux libres
- Messagerie

### Étape 4 — Mobile (React Native + Expo)
- Setup Expo TypeScript
- 7 écrans correspondants au prototype
- Client API + auto-refresh token
- Push notifications

## 🎯 Décisions verrouillées (à ne pas remettre en question)

1. **Mono-repo** (backend + mobile)
2. **Email + mot de passe** (pas de SMS — gratuit)
3. **Inscription libre** (statut pending/active dans la BDD)
4. **Stack** : Go + Gin + Postgres 16 + Redis 7 + FCM + R2
5. **Hébergement** : Hetzner CX22 + Neon + Upstash → ~15€/mois
6. **Identité visuelle** : noir #1a1a1a + rouge #DC2626 + blanc, logo Bōa officiel
7. **Pont Instagram** repoussé en V2

## 💡 Conseils pour bien lancer Claude Code

### Si Claude Code te propose de tout coder d'un coup
→ Réponds : « Non, étape par étape. On commence par le module Go + config + connexion BDD + endpoint /health. Tu me livres ça, on teste, et après on enchaîne. »

### Si Claude Code te propose une stack différente
→ Renvoie-le vers `CLAUDE.md` : tous les choix sont verrouillés, ce n'est pas négociable pour ce projet.

### Si tu veux modifier un choix
→ Dis-le explicitement : « Je change d'avis, je veux finalement utiliser X au lieu de Y, mets à jour CLAUDE.md et le code en conséquence. »

### Pour valider chaque étape
→ Aie le réflexe de toujours demander : « Comment je teste que ça marche ? » Claude Code doit te donner une commande `curl` ou un test unitaire à lancer.

## 📞 Référence rapide

- **Site du club** : https://www.clubedesportivoboa.fr/
- **Coach principal** : Victor Almeida (admin de l'app)
- **Localisations** : Sorgues (dojo principal) + Vedène (cours MMA + cage été)
- **~100-200 adhérents** estimés
- **Budget cible** : ~15€/mois en hébergement

---

Bon dev ! Quand tu veux, tu peux revenir ici pour des ajustements UX, des questions stratégiques, ou pour faire le bilan d'une étape.
