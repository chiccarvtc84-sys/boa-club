# Étape 3 — Partie 1 : Fondations du backend

## Ce qui est livré dans ce premier message

✅ Structure du repo (mono-repo backend + mobile)
✅ Docker Compose pour Postgres + Redis en local
✅ Makefile avec toutes les commandes utiles
✅ Schéma de base de données complet en 6 migrations SQL
✅ Données seed du planning réel du Boa Club

## Schéma de base de données — vue d'ensemble

### 5 modules fonctionnels couverts

**1. Utilisateurs** (`migration 001`)
- Table `users` avec ceinture, grade (stripes), poids, disciplines, rôle, statut
- 3 rôles : `member`, `coach`, `admin`
- 5 ceintures JJB officielles : white, blue, purple, brown, black
- Visibilité du poids configurable (public / membres / privé)

**2. Cours du club** (`migration 002`)
- `recurring_courses` : planning hebdo récurrent (template)
- `course_instances` : instance réelle d'un cours à une date (gère les exceptions)
- `user_course_followings` : cours suivis par chaque user + préférences notifs
- Permet : annulation d'un cours précis, retard du coach, absence avec génération auto de créneau libre

**3. Créneaux libres** (`migration 003`)
- `free_slots` : créneaux publiés par les adhérents
- `free_slot_participants` : qui rejoint quoi
- `free_slots_origins` : trace si le créneau vient d'une auto-génération (coach absent)

**4. Messagerie** (`migration 004`)
- `conversations` : DM 1-à-1 OU thread d'un créneau libre (deux types unifiés)
- `conversation_participants` : avec état de lecture pour les compteurs "non lus"
- `messages` : texte / photo / vocal / système
- Trigger automatique pour mettre à jour `last_message_at`

**5. Sessions et notifs** (`migration 005`)
- `refresh_tokens` : rotation JWT, révocation possible
- `login_attempts` : anti-bruteforce (Postgres, pas Redis pour la persistance)
- `notifications` : audit complet des push envoyés + état lu/non lu

### Migration 6 : Seed
Le **vrai planning du Boa Club** est injecté automatiquement (17 cours hebdomadaires) + un compte admin pour Victor.

## Décisions techniques importantes

### Pourquoi UUID au lieu d'INT auto-incrémenté
- Pas de devinette des IDs depuis l'extérieur
- Permet de générer les IDs côté client (utile pour l'optimistic UI sur mobile)
- Pas de collision si on fusionne plusieurs BDD plus tard

### Pourquoi des ENUMs Postgres
- Validation native au niveau BDD
- Gain de place vs VARCHAR
- Documentation auto-portée
- Inconvénient : ajouter une valeur nécessite une migration (acceptable)

### Pourquoi séparer `recurring_courses` et `course_instances`
- Le coach peut annuler **un seul cours** sans casser le planning
- On peut avoir des **statistiques précises** : qui était présent à quelle séance
- On peut **changer le coach par instance** (remplaçant)
- On peut générer un **créneau libre auto** depuis une instance "coach absent"

### Soft delete via `deleted_at` (users uniquement)
- RGPD : un utilisateur peut demander la suppression
- On garde l'historique des messages mais l'auteur devient "Compte supprimé"

## Prochaines parties de l'étape 3

Dans le prochain message je livre :

**Partie 2 — Code Go : configuration et démarrage du serveur**
- `cmd/server/main.go` (point d'entrée)
- `internal/config` (chargement .env)
- `internal/database` (connexion Postgres + Redis avec pool)
- Commande `cmd/migrate` pour appliquer les migrations
- Endpoint `GET /api/health` (vérifie BDD + Redis)

**Partie 3 — Authentification complète**
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- Middleware JWT
- Rate-limiting (Redis)

**Partie 4 — Premiers handlers métier**
- `GET /api/courses/week` (planning de la semaine)
- `GET /api/free-slots` (liste des créneaux libres)
- `POST /api/free-slots` (créer un créneau)
- `POST /api/free-slots/:id/join`
