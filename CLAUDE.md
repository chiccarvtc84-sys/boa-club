# CLAUDE.md — Brief complet du projet Boa Club

> **Fichier prioritaire pour Claude Code.**
> Lis ce fichier en premier avant toute action. Il contient tout le contexte nécessaire pour reprendre le développement.

## 🎯 Ton rôle

Tu reprends le développement d'une application mobile pour le **Clube Desportivo Boa**, une salle de Jiu-Jitsu Brésilien / Grappling / MMA située à Sorgues et Vedène (France). Le développeur (le user) maîtrise Go, React Native et PostgreSQL, et il code seul en s'aidant de toi.

Le projet est en **étape 3 sur 10** : le schéma de base de données est posé, mais le code Go n'a pas encore été écrit. Tu dois prendre le relais et finir le backend, puis attaquer le mobile.

## 📋 Contexte produit

### Le problème à résoudre
- Salle de ~100-200 adhérents
- La coordination passe actuellement par Instagram → trop bruyant, infos noyées
- Besoin d'un outil dédié pour : voir le planning, savoir si un coach est en retard/absent, organiser des entraînements libres entre adhérents, échanger en privé

### Le périmètre MVP (validé)

1. **Planning officiel** : cours récurrents hebdomadaires, navigation par jour avec swipe, filtre par cours suivis
2. **Créneaux libres** : un adhérent publie, d'autres rejoignent. Pas de validation, pas de limite. Chaque créneau a un fil de discussion public entre participants.
3. **Notifications coach** : retard ou absence avec push. Si un cours est annulé pour absence du coach, un créneau libre est généré automatiquement à la même heure.
4. **Messagerie privée** : DM 1-à-1 + threads de créneaux. Distinction visuelle public/privé claire.
5. **Profil** : photo facultative, ceinture (avec couleur native), grade (stripes), poids (visibilité paramétrable), bio, disciplines pratiquées.
6. **Réglages** : notifications granulaires par cours.

### Ce qui n'est PAS dans le MVP
- Paiement, gestion des cotisations
- Vidéos d'entraînement
- Gamification (badges, classements)
- Multi-club / SaaS (le projet est mono-club pour l'instant — Boa uniquement)

## 🛠️ Stack technique (validée par le user)

| Couche | Choix |
|---|---|
| **Backend** | Go 1.22 + Gin |
| **BDD** | PostgreSQL 16 |
| **Cache / sessions** | Redis 7 |
| **Push** | Firebase Cloud Messaging |
| **Stockage fichiers** | Cloudflare R2 |
| **Email** | Resend ou Brevo (gratuit, à configurer) |
| **Mobile** | React Native + Expo + TypeScript |
| **Hébergement** | Hetzner CX22 (~5€/mois) + Neon Postgres free + Upstash Redis free |

**Budget total cible : ~15€/mois** (hors frais stores Apple 99$/an et Google 25$ unique).

## ✅ Décisions importantes prises

1. **Mono-repo** (backend + mobile dans le même dépôt Git)
2. **Authentification : email + mot de passe uniquement** (pas de SMS, gratuit)
3. **Inscription libre** mais avec statut `pending`/`active` dans la BDD (le user a précisé qu'il ne voulait rien de payant — pas de SMS de validation. La modération via le statut sera optionnelle au niveau du code.)
4. **Identité visuelle** : nom = "Boa Club", couleurs = noir #1a1a1a + rouge Bōa #DC2626 + blanc, logo officiel du club fourni
5. **5 ceintures JJB** avec couleurs natives : white, blue (#1E3A8A), purple (#6D28D9), brown (#7C2D12), black (#1a1a1a)
6. **Pont Instagram en V2** uniquement (V1 = backend génère une story prête, admin la partage manuellement)

## 📁 État actuel du repo

```
boa-club/
├── README.md                    ✅ Fait
├── Makefile                     ✅ Fait (commandes db-up, migrate, run, etc.)
├── docker-compose.yml           ✅ Fait (Postgres 16 + Redis 7)
├── .gitignore                   ✅ Fait
├── CLAUDE.md                    ← Ce fichier
├── api/
│   ├── .env.example             ✅ Fait
│   └── migrations/              ✅ 6 migrations SQL complètes
│       ├── 001_create_users.{up,down}.sql
│       ├── 002_create_courses.{up,down}.sql
│       ├── 003_create_free_slots.{up,down}.sql
│       ├── 004_create_messaging.{up,down}.sql
│       ├── 005_create_sessions_notifications.{up,down}.sql
│       └── 006_seed_boa_club.{up,down}.sql
└── docs/
    └── (specs et brief)
```

## 🗄️ Schéma de base de données

Le schéma BDD couvre 5 modules fonctionnels :

### Module 1 : Utilisateurs (`migration 001`)
- Table `users` avec : email, password_hash, first_name, last_name_initial, avatar_url, bio, belt, stripes, weight_kg, weight_visibility, disciplines (TEXT[]), role, status, fcm_token
- ENUMs : `belt_color`, `user_role` (member/coach/admin), `user_status` (pending/active/suspended/deleted), `weight_visibility` (public/members/private)
- Soft delete via `deleted_at`
- Trigger auto pour `updated_at`

### Module 2 : Cours du club (`migration 002`)
- `recurring_courses` : template hebdomadaire (name, day_of_week, start_time, end_time, location, discipline, intensity, default_coach_id, valid_from/until)
- `course_instances` : instance réelle d'un cours à une date donnée (permet exceptions : annulation, retard, absence)
- `user_course_followings` : préférences notifs par cours pour chaque user
- ENUMs : `course_discipline` (jjb_gi, jjb_nogi, mma, wrestling, open_mat, mixed), `course_intensity`, `course_status`

### Module 3 : Créneaux libres (`migration 003`) — cœur du produit
- `free_slots` : créateur, horaires, titre, description, discipline, intensité, lieu, statut
- `free_slot_participants` : qui rejoint quoi (PK composée slot_id + user_id)
- `free_slots_origins` : trace si auto-généré (cours annulé pour absence coach)

### Module 4 : Messagerie (`migration 004`)
- `conversations` : type 'direct' (DM) OU 'slot_thread' (lié à un free_slot)
- `conversation_participants` : avec `last_read_at` pour les compteurs non lus
- `messages` : type text/photo/voice/system, contenu + media_url
- Trigger auto pour mettre à jour `conversations.last_message_at`

### Module 5 : Sessions et notifs (`migration 005`)
- `refresh_tokens` : rotation JWT, révocation possible, infos appareil
- `login_attempts` : anti-bruteforce
- `notifications` : audit + état lu, JSONB pour deep links

### Migration 6 : Seed
- 17 cours hebdomadaires du Boa Club (vrai planning du site officiel)
- Compte admin Victor Almeida (email: victor@boaclub.fr)

## 🚀 Ta mission : finir l'étape 3 + 4

### Ce qui reste à faire en étape 3 (backend Go)

**Partie 2 : Setup serveur**
- [ ] `api/go.mod` avec les dépendances (gin, pgx/v5, go-redis/v9, jwt-go/v5, bcrypt, godotenv, validator/v10)
- [ ] `api/cmd/server/main.go` : point d'entrée, charge config, init DB+Redis, monte les routes
- [ ] `api/cmd/migrate/main.go` : commande pour appliquer les migrations (utiliser golang-migrate ou implémentation simple)
- [ ] `api/internal/config/config.go` : charge .env via godotenv, validation des variables
- [ ] `api/internal/database/postgres.go` : connexion via pgxpool, helpers
- [ ] `api/internal/database/redis.go` : client Redis
- [ ] `api/internal/handlers/health.go` : `GET /api/health` avec check DB + Redis
- [ ] `api/internal/middleware/logger.go` : logs structurés des requêtes
- [ ] `api/internal/middleware/cors.go` : CORS pour le mobile
- [ ] Vérifier que `make run` démarre le serveur sur :8080

**Partie 3 : Authentification**
- [ ] `api/internal/auth/jwt.go` : génération/validation access + refresh tokens
- [ ] `api/internal/auth/password.go` : bcrypt
- [ ] `api/internal/services/auth_service.go` : logique métier
- [ ] `api/internal/handlers/auth.go` : 
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/refresh`
  - `POST /api/auth/logout`
  - `POST /api/auth/forgot-password`
  - `POST /api/auth/reset-password`
- [ ] `api/internal/middleware/auth.go` : middleware JWT
- [ ] `api/internal/middleware/ratelimit.go` : limite via Redis (10 tentatives login / 15 min)

**Partie 4 : Endpoints métier core**
- [ ] `GET /api/me` : profil utilisateur connecté
- [ ] `PATCH /api/me` : modifier profil
- [ ] `GET /api/courses/week?from=YYYY-MM-DD` : planning de la semaine (génère les instances depuis le récurrent à la volée si manquantes)
- [ ] `POST /api/courses/:id/follow` : suivre un cours
- [ ] `DELETE /api/courses/:id/follow` : ne plus suivre
- [ ] `POST /api/coach/notify` (rôle coach) : signaler retard ou absence
- [ ] `GET /api/free-slots` : créneaux libres à venir
- [ ] `POST /api/free-slots` : créer un créneau
- [ ] `GET /api/free-slots/:id` : détail d'un créneau
- [ ] `POST /api/free-slots/:id/join` : rejoindre
- [ ] `DELETE /api/free-slots/:id/join` : quitter
- [ ] `DELETE /api/free-slots/:id` : annuler (créateur uniquement)
- [ ] `GET /api/conversations` : liste des conversations DM
- [ ] `GET /api/conversations/:id/messages?before=...` : messages paginés
- [ ] `POST /api/conversations/:id/messages` : envoyer un message
- [ ] `POST /api/conversations/:id/read` : marquer comme lu
- [ ] WebSocket pour la messagerie temps réel (optionnel V1, polling acceptable)

### Étape 4 : Mobile (après le backend)

- Setup Expo + TypeScript + React Navigation
- Écrans correspondant aux 7 écrans du prototype
- API client avec gestion auto refresh token
- AsyncStorage pour persister la session
- Push notifications via expo-notifications

## 🎨 Référence visuelle

Le user a itéré ~10 fois sur un prototype HTML/CSS interactif. La direction visuelle finale est validée :

- **Téléphone** : 340px largeur dans la maquette
- **Header** : logo Boa officiel à gauche + "Boa Club" + sous-titre "Sorgues · Vedène"
- **Onglets jours** : pastilles blanches sur fond blanc, bordure grise fine ; sélectionné = fond gris clair (#E5E7EB) + bordure rouge (#DC2626) ; numéros en noir, label "LUN/MAR/..." en rouge, point rouge SI une info coach (retard, absence)
- **Tabbar bas** : fond blanc, 4 onglets de 70px centrés (Planning / Créneaux / Messages / Profil), inactif = gris #6B7280, actif = rouge Bōa
- **Style messagerie** : Facebook Messenger (bulles rouges #DC2626 pour moi, grises #F1F1F2 pour l'autre)
- **Couleurs ceintures** par grade :
  - White : fond blanc + bordure noire
  - Blue : #1E3A8A (bleu marine)
  - Purple : #6D28D9
  - Brown : #7C2D12
  - Black : #1a1a1a
  - Coach : badge rouge #DC2626 (en plus de la ceinture)
- **Messages non lus** : nom en gras + point rouge à droite + compteur "X non lus" dans header
- **Scrollbars** : masquées partout

## 📐 Règles de code à respecter

### Backend Go
- Architecture en couches : `handlers` (HTTP) → `services` (logique métier) → `database` (SQL via pgx). Jamais de SQL dans les handlers.
- Validation des inputs via `go-playground/validator/v10`
- Erreurs structurées : type custom avec code HTTP + message client + détails internes
- Logs structurés avec `slog` (pas `fmt.Println`)
- Tests unitaires sur les services métier, tests d'intégration sur les handlers (avec testcontainers ou Postgres en mémoire)
- Variables sensibles via `.env` uniquement, jamais en dur
- JWT : access token 15min, refresh token 30 jours, rotation à chaque refresh

### Mobile (à venir)
- TypeScript strict
- Composants fonctionnels + hooks uniquement
- React Query (TanStack Query) pour les appels API
- Zustand ou Context pour l'état global léger
- Pas de styled-components — StyleSheet natif ou nativewind

## 🔐 Sécurité — points critiques

1. **Jamais** de token, mot de passe ou secret commité (déjà géré par .gitignore)
2. **Bcrypt** cost minimum 12 pour les mots de passe
3. **Rate limiting** sur les endpoints publics (login, register, forgot-password)
4. **CORS** strict en prod, permissif en dev
5. **Validation** stricte de tous les inputs (longueur email, complexité mot de passe, etc.)
6. **Soft delete** des utilisateurs (RGPD)
7. **HTTPS only** en prod
8. **Refresh token rotation** : à chaque refresh, l'ancien est révoqué

## 📦 Dépendances Go recommandées

```go
// go.mod minimum
module github.com/boa-club/api

go 1.22

require (
    github.com/gin-gonic/gin v1.10.0
    github.com/jackc/pgx/v5 v5.5.5
    github.com/redis/go-redis/v9 v9.5.1
    github.com/golang-jwt/jwt/v5 v5.2.1
    golang.org/x/crypto v0.22.0
    github.com/joho/godotenv v1.5.1
    github.com/go-playground/validator/v10 v10.19.0
    github.com/google/uuid v1.6.0
    github.com/golang-migrate/migrate/v4 v4.17.1
)
```

## 🧪 Comment vérifier que tout va bien

Après avoir codé chaque partie, le user doit pouvoir lancer :

```bash
# 1. Démarrer la BDD
make db-up

# 2. Appliquer les migrations
make migrate

# 3. Lancer le serveur
make run

# 4. Tester
curl http://localhost:8080/api/health
# Attendu: {"status":"ok","db":"ok","redis":"ok"}

# 5. Test register
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.fr","password":"Test1234!","first_name":"Jean","last_name_initial":"D."}'

# 6. Test login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.fr","password":"Test1234!"}'
```

## 🤝 Comment travailler avec le user

- **Le user parle français** — tous les commentaires de code, les commits et les explications doivent être en français
- **Il préfère des étapes courtes et incrémentales** : finis une partie, fais valider, passe à la suivante
- **Il code sur son temps libre** — ne lui livre jamais une PR de 1500 lignes sans découpage logique
- **Il vient de la spec produit** — explique les choix techniques quand ils ont un impact métier
- **Il aime les logs visuels propres** dans le terminal, les commandes Make, les README clairs
- **Pour la prochaine étape, demande validation explicite** ("ok pour la partie 2 ?") avant d'enchaîner

## 🗺️ Roadmap complète (rappel)

- ✅ **Étape 1** : Spec MVP rédigée
- ✅ **Étape 2** : Prototype visuel cliquable validé
- 🚧 **Étape 3** : Backend Go (← TU EN ES ICI, partie 1 faite, parties 2-4 à coder)
- ⏳ **Étape 4** : Setup mobile React Native + Expo
- ⏳ **Étape 5** : Sprint Auth end-to-end (backend + mobile)
- ⏳ **Étape 6** : Sprint Planning
- ⏳ **Étape 7** : Sprint Créneaux libres (cœur du produit)
- ⏳ **Étape 8** : Sprint Notifs + DM
- ⏳ **Étape 9** : Pont Instagram + polish
- ⏳ **Étape 10** : Publication stores iOS + Android

## 🎯 Première action recommandée

Quand le user te demande de continuer, propose-lui de commencer par :

> **"Je commence par créer le module Go (`go.mod`), la config, la connexion BDD/Redis, et l'endpoint /health. Une fois ça en place et testé, on enchaîne sur l'auth. Tu valides ?"**

Puis génère les fichiers un par un, en expliquant brièvement chaque choix structurant.

---

**Version de ce brief : 1.0 — généré le 3 mai 2026 par Claude (web)**
**Auteur du projet : le user (développeur Go/RN à Sorgues, France)**
