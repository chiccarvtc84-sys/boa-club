# Boa Club

Application mobile pour le Clube Desportivo Boa (Sorgues / Vedène).

Coordination des cours, créneaux libres entre adhérents, messagerie privée et notifications push.

## Stack technique

- **Backend** : Go 1.22 + Gin
- **BDD** : PostgreSQL 16
- **Cache** : Redis 7
- **Push** : Firebase Cloud Messaging
- **Stockage fichiers** : Cloudflare R2
- **Mobile** : React Native + Expo + TypeScript

## Structure du repo (mono-repo)

```
boa-club/
├── api/                    # Backend Go
│   ├── cmd/
│   │   └── server/         # Point d'entrée
│   │       └── main.go
│   ├── internal/
│   │   ├── auth/           # Authentification, JWT
│   │   ├── config/         # Variables d'environnement
│   │   ├── database/       # Connexion Postgres, Redis
│   │   ├── handlers/       # Handlers HTTP (un par ressource)
│   │   ├── middleware/     # Auth, logs, rate-limit
│   │   ├── models/         # Structs (User, Course, Slot, etc.)
│   │   ├── notifications/  # Logique FCM
│   │   ├── services/       # Logique métier
│   │   └── storage/        # R2 / S3
│   ├── migrations/         # Fichiers SQL de migration
│   ├── go.mod
│   ├── go.sum
│   └── .env.example
│
├── mobile/                 # App React Native
│   └── (sera créé à l'étape 4)
│
├── docker-compose.yml      # Postgres + Redis pour le dev local
├── Makefile                # Commandes raccourcies
├── .gitignore
└── README.md
```

## Prérequis

- Docker + Docker Compose
- Go 1.22+
- Make (optionnel mais recommandé)
- Node.js 20+ (pour la partie mobile, plus tard)

## Démarrer en local

```bash
# Cloner le repo
git clone https://github.com/<ton-user>/boa-club.git
cd boa-club

# Démarrer Postgres + Redis dans Docker
make db-up

# Copier le fichier d'environnement
cp api/.env.example api/.env
# (Édite api/.env si besoin)

# Lancer les migrations
make migrate

# Démarrer le serveur Go
make run
```

Le serveur écoute sur `http://localhost:8080`.

Pour vérifier que tout va bien :
```bash
curl http://localhost:8080/api/health
# {"status":"ok","db":"ok","redis":"ok"}
```

## Commandes Make disponibles

| Commande | Effet |
|---|---|
| `make db-up` | Démarre Postgres + Redis dans Docker |
| `make db-down` | Arrête les services Docker |
| `make db-reset` | Reset complet de la BDD (⚠ supprime tout) |
| `make migrate` | Applique les migrations SQL |
| `make migrate-create NAME=foo` | Crée une nouvelle migration |
| `make run` | Lance le serveur Go (avec hot reload) |
| `make test` | Lance les tests |
| `make build` | Compile le binaire de production |

## Variables d'environnement

Voir `api/.env.example` — copie ce fichier en `api/.env` et personnalise.

## Roadmap

- ✅ Étape 1-2 : Spec + prototype visuel
- 🚧 **Étape 3 : Backend Go (en cours)**
- ⏳ Étape 4 : Setup React Native + Expo
- ⏳ Étape 5 : Sprint Auth end-to-end
- ⏳ Étape 6 : Sprint Planning
- ⏳ Étape 7 : Sprint Créneaux libres
- ⏳ Étape 8 : Sprint Notifs + DM
- ⏳ Étape 9 : Pont Instagram + polish
- ⏳ Étape 10 : Publication stores
