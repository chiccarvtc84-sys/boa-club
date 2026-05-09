# Fiches App Store / Play Store — Boa Club

Tout ce qu'il te faut pour remplir les formulaires de soumission Apple et Google.

---

## 📱 Métadonnées générales

| Champ | Valeur |
|---|---|
| Nom de l'app | **Boa Club** |
| Sous-titre (iOS, 30 chars) | `Le club Bōa, dans ta poche` |
| Bundle ID iOS / Package Android | `fr.boaclub.app` |
| Catégorie principale | Sports |
| Catégorie secondaire | Santé et remise en forme |
| Tranche d'âge | 17+ (utilisateurs adultes uniquement) |
| Langue principale | Français (France) |
| Pays de disponibilité | France (extension Europe possible plus tard) |

## 🎯 Description courte (Play Store, 80 chars)

> Le planning, les créneaux et les messages du Clube Desportivo Boa, en un clic.

## 📝 Description longue (App Store + Play Store)

```
Boa Club, l'app dédiée aux adhérents du Clube Desportivo Boa (Sorgues & Vedène).

Fini les groupes WhatsApp surchargés et les infos noyées sur Instagram : tout ce dont tu as besoin pour ta pratique du JJB, du Grappling et du MMA est désormais dans une seule application, conçue par et pour le club.

🥋 PLANNING OFFICIEL
Consulte le planning hebdomadaire du club par jour, avec les coachs, les lieux et le type de cours. Active des notifications cours par cours pour être prévenu si le coach est en retard ou absent.

👥 CRÉNEAUX LIBRES
Tu veux drill 30 minutes après le cours ? Faire du sparring No-Gi un samedi matin ? Publie un créneau libre, les autres adhérents peuvent le rejoindre. Chaque créneau a sa discussion publique pour s'organiser ensemble.

💬 MESSAGERIE
Discute en privé avec les autres adhérents pour partager une technique, organiser un entraînement, ou poser une question au coach. Style Messenger, simple et rapide.

🛡️ ESPACE COACH (réservé aux coachs et admins)
Annonce un retard ou une absence en deux clics, modifie un cours pour une journée donnée, envoie une alerte générale à tout le club avec une durée d'affichage paramétrable.

🔒 RESPECT DE TA VIE PRIVÉE
Tes données restent en France et chez des hébergeurs européens (Hetzner). La visibilité de ton poids est paramétrable (Public, Adhérents seulement, Privé). Tu peux supprimer ton compte à tout moment, conformément au RGPD.

⚠ Application réservée aux adhérents majeurs (18+) du Clube Desportivo Boa. Pour t'inscrire au club : https://www.clubedesportivoboa.fr/

— Codé avec passion par le club, pour le club.
```

## 🔑 Mots-clés App Store (100 chars)

```
jjb,grappling,mma,sorgues,vedene,jiu-jitsu,boa,club,sparring,planning,sport,combat,arts martiaux
```

## 🔗 URLs requises

| Champ | URL |
|---|---|
| Site web (marketing) | https://www.clubedesportivoboa.fr/ |
| Politique de confidentialité | https://www.clubedesportivoboa.fr/privacy *(à publier)* |
| Conditions d'utilisation | https://www.clubedesportivoboa.fr/terms *(à publier)* |
| Email de support | `contact@clubedesportivoboa.fr` |
| URL de soutien (App Store) | https://www.clubedesportivoboa.fr/support |

> Action requise : héberge `docs/PRIVACY_POLICY.md` et `docs/TERMS_OF_SERVICE.md` (transformés en HTML simple) sur ces URLs avant la soumission.

## 📸 Screenshots requis

### iOS (envoie au moins 3 screenshots par taille, 5 max)
| Format | Taille recommandée | Devices visés |
|---|---|---|
| 6.7" | 1290 × 2796 ou 1320 × 2868 | iPhone 16 Pro Max, 15 Pro Max |
| 6.5" | 1284 × 2778 ou 1242 × 2688 | iPhone 14 Plus, 11 Pro Max |
| 5.5" | 1242 × 2208 | iPhone 8 Plus *(facultatif depuis iOS 16)* |
| iPad 13" | 2064 × 2752 | iPad Pro 13" *(seulement si tu vises l'iPad)* |

### Android (Play Store)
| Format | Taille |
|---|---|
| Téléphone | min 1080 × 1920 (ratio 9:16) |
| 7" tablette *(facultatif)* | min 1200 × 1920 |
| 10" tablette *(facultatif)* | min 1600 × 2560 |

### Suggestions de captures à faire

1. **Écran Login** avec le logo Bōa centré (montre l'identité visuelle)
2. **Planning Mardi** avec les 3 cours et un coach en retard (ça raconte une histoire)
3. **Liste des créneaux libres** groupés par jour avec les avatars (montre le côté communautaire)
4. **Détail d'un créneau** avec la discussion publique (le cœur de l'app)
5. **Profil** avec le bandeau « Clube Desportivo Boa » et le badge ceinture (identification au club)

> Astuce : utilise le simulator iOS (xcrun simctl io booted screenshot ~/Desktop/screen.png) ou Android Studio (Device → Screenshot) pour des captures parfaitement nettes.

## 🎨 Assets graphiques requis

| Asset | Taille | État |
|---|---|---|
| Icône App Store | 1024 × 1024 PNG, sans alpha | ⏳ À refaire avec un logo HD |
| Adaptive icon Android | 1024 × 1024 (foreground) + couleur background | ⏳ À refaire |
| Splash screen | 1024 × 1024 | ⏳ À refaire |
| Image vedette Play Store | 1024 × 500 PNG | À créer |

> Les assets actuels sont des placeholders extraits du proto (logo basse résolution). Pour le visual final, demande à Victor un fichier `.psd` ou `.ai` du logo officiel du club, exporte-le en 2048×2048 PNG transparent, place-le dans `mobile/src/theme/logo-source.png`, et adapte `scripts/generate-assets.py` pour le lire au lieu du base64.

## 📋 Réponses au questionnaire App Store

| Question | Réponse |
|---|---|
| Contient du contenu généré par l'utilisateur ? | **Oui** (messages + créneaux). Modération sur signalement. |
| Tracking publicitaire ? | **Non** |
| Achats in-app ? | **Non** |
| Crypto ? | **Non** (`ITSAppUsesNonExemptEncryption: false` déjà dans app.json) |
| Localisation requise ? | **Non** |
| Accès caméra ? | Oui — pour les photos dans les messages |
| Accès micro ? | Oui — pour les notes vocales |
| Accès photothèque ? | Oui — pour partager des photos |

## 📋 Compliance Apple — points de vigilance

- ✓ Suppression de compte intégrée (App Store Review Guidelines 5.1.1(v))
- ✓ Privacy nutrition labels : à remplir manuellement dans App Store Connect (cf. POLITIQUE de confidentialité §2)
- ✓ Sign in with Apple : **non requis** ici car on utilise email + password (pas de provider tiers Google/Facebook)
- ✓ Restriction âge 17+ déclarée

## 📋 Compliance Google Play — points de vigilance

- ✓ Suppression de compte intégrée (Data Safety policy 2024)
- ✓ Data Safety form : à remplir dans Play Console (mêmes infos que la privacy policy)
- ✓ Pas de target audience < 13 ans → pas de Designed for Families program

---

## ⏭ Workflow de soumission recommandé

1. Premier build EAS preview → installer sur ton iPhone et un Android via internal testing
2. Faire un tour de l'app et capturer les screenshots
3. Héberger les 2 documents légaux en HTML sur ton site `clubedesportivoboa.fr`
4. Build EAS production → eas submit
5. Apple : review en 24-72h (parfois rejets pour des broutilles, l'IPA est facile à corriger)
6. Google : review en 4-24h (en général moins strict mais plus aléatoire)
