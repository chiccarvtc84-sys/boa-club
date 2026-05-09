# Politique de confidentialité — Boa Club

**Dernière mise à jour : 5 mai 2026**

La présente politique décrit comment l'application **Boa Club** (« nous », « l'application ») collecte, utilise et protège tes données personnelles. Elle s'inscrit dans le cadre du Règlement Général sur la Protection des Données (RGPD).

## 1. Qui sommes-nous ?

L'application Boa Club est éditée par le **Clube Desportivo Boa**, association sportive située à Sorgues et Vedène (Vaucluse, France).

- **Site web** : https://www.clubedesportivoboa.fr/
- **Email de contact** : contact@clubedesportivoboa.fr
- **Délégué à la protection des données (DPO)** : Victor Almeida — `dpo@clubedesportivoboa.fr`

## 2. Quelles données collectons-nous ?

Lors de la création de ton compte et de l'utilisation de l'application, nous collectons :

### Données obligatoires
- **Email** : pour t'identifier et te permettre de te connecter
- **Mot de passe** (chiffré) : nous ne le voyons jamais en clair (hash bcrypt)
- **Prénom** et **initiale du nom de famille** (ex: « D. ») : pour t'identifier auprès des autres adhérents

### Données facultatives (que tu choisis de fournir)
- Photo de profil
- Bio courte
- Ceinture (Blanche, Bleue, Violette, Marron, Noire) et nombre de stripes
- Poids (en kg) avec un paramètre de visibilité (Public, Adhérents seulement, Privé)
- Disciplines pratiquées (JJB Gi, JJB No-Gi, MMA, Wrestling)

### Données techniques
- **Token de notification push** (FCM) : pour t'envoyer les alertes du club
- **Adresse IP** et **user-agent** : pour la sécurité (anti-bruteforce)
- **Tentatives de connexion** : conservées 30 jours pour la sécurité du compte
- **Date de dernière connexion**

### Données générées par ton usage
- Messages privés que tu envoies à d'autres adhérents
- Créneaux libres que tu publies ou auxquels tu t'inscris
- Préférences de notifications par cours

## 3. Pourquoi collectons-nous ces données ?

| Donnée | Finalité | Base légale |
|---|---|---|
| Email + mot de passe | Authentification | Exécution du contrat (CGU) |
| Prénom + initiale | Identification entre adhérents | Exécution du contrat |
| Ceinture, stripes, disciplines | Affichage de profil | Consentement |
| Poids | Statistique sportive personnelle (visibilité au choix) | Consentement |
| Token push FCM | Envoi de notifications | Consentement |
| Logs techniques (IP, user-agent) | Sécurité du compte | Intérêt légitime |
| Messages, créneaux | Fonctionnement de l'app | Exécution du contrat |

## 4. Avec qui partageons-nous tes données ?

**Avec les autres adhérents du club**, dans la limite de tes paramètres :
- Ton profil (prénom + initiale + ceinture + bio + photo) est visible par les adhérents connectés
- Ton poids n'est visible que selon le paramètre `Visibilité du poids` que tu choisis (Public / Adhérents / Privé)
- Tes messages privés sont visibles par toi et ton interlocuteur uniquement
- Les messages dans la discussion publique d'un créneau libre sont visibles par tous les inscrits à ce créneau

**Avec nos prestataires techniques** (sous-traitants RGPD) :
- **Hetzner Online GmbH** (Allemagne, UE) : hébergement du serveur
- **Neon Inc.** (États-Unis) : base de données managée. Données chiffrées au repos et en transit. Transfert hors UE encadré par les Clauses Contractuelles Types.
- **Upstash Inc.** (États-Unis) : cache de session. Idem CCT.
- **Resend Inc.** (États-Unis) : envoi des emails (mot de passe oublié). CCT.
- **Google LLC / Firebase** (États-Unis) : envoi des notifications push. CCT.

**Aucune donnée n'est revendue ou cédée à des tiers à des fins commerciales.**

## 5. Combien de temps gardons-nous tes données ?

- Données de compte : tant que ton compte est actif
- Logs de connexion : 30 jours maximum
- Messages : 3 ans après ton dernier message
- Créneaux libres : 1 an après la date du créneau
- **Suppression du compte** : 24h pour anonymisation, suppression définitive après 30 jours

## 6. Tes droits RGPD

Tu disposes des droits suivants, exerçables à tout moment :

- **Droit d'accès** : demande une copie de tes données
- **Droit de rectification** : corrige toi-même via l'app, ou écris-nous
- **Droit à l'effacement** : supprime ton compte depuis l'app (Profil → Supprimer mon compte) ou par email
- **Droit à la portabilité** : reçois tes données dans un format machine-readable
- **Droit d'opposition** : refuse certains traitements (ex: notifications)
- **Droit de retrait du consentement** : à tout moment, sans motif

**Pour exercer un droit** : envoie un email à `dpo@clubedesportivoboa.fr` avec une preuve d'identité. Nous répondons sous 30 jours maximum.

**Réclamation** : tu peux saisir la CNIL à tout moment via https://www.cnil.fr/fr/plaintes.

## 7. Sécurité

Nous mettons en œuvre les mesures suivantes :

- Chiffrement TLS 1.3 pour toutes les communications
- Hash bcrypt (cost 12) pour les mots de passe
- Tokens d'accès JWT à courte durée (15 min) avec rotation
- Anti-bruteforce sur le login (max 10 tentatives par 15 min)
- Mise à jour régulière des dépendances logicielles
- Sauvegardes chiffrées quotidiennes

## 8. Mineurs

L'application Boa Club est **réservée aux personnes majeures (18 ans et plus)**. En créant un compte, tu déclares avoir au moins 18 ans.

Si tu es l'adulte responsable d'un mineur qui s'entraîne au club, l'inscription du mineur est gérée directement avec l'administration du club, hors de l'application.

## 9. Cookies

L'application mobile n'utilise **pas de cookies**. Les sessions sont stockées localement sur ton appareil (AsyncStorage) et révoquables à tout moment via la déconnexion.

## 10. Modifications

Nous pouvons mettre à jour cette politique. Tu seras informé via une notification dans l'app au moins 30 jours avant l'application des changements significatifs.

---

**Pour toute question** : `dpo@clubedesportivoboa.fr`
