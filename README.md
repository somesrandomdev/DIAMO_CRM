# DIAMO CRM

Système de gestion CRM pour le réseau de franchises Diam'O au Sénégal.

## Fonctionnalités

- **Gestion des ventes** : Enregistrement des ventes avec génération de tickets PDF
- **Gestion des clients** : Base de données clients avec historique des achats et import CSV
- **Supervision multi-kiosques** : Dashboard pour commerciaux supervisant plusieurs kiosques
- **Suivi des objectifs** : Objectifs mensuels par kiosque avec suivi en temps réel
- **Analytics admin** : Performance des fontainiers, comparaison des kiosques, alertes d'inactivité client
- **Mode hors ligne** : Ventes et création de clients possibles sans connexion internet, synchronisation automatique à la reconnexion
- **Export de données** : Export CSV et PDF des rapports

## Rôles

- **Administrateur** : Accès complet, gestion des utilisateurs et kiosques
- **Commercial** : Supervision de plusieurs kiosques (table `commercials_kiosques`), lecture et correction des ventes/clients/objectifs
- **Fontainier** : Ventes et gestion des clients de son kiosque

## Stack technique

- **Frontend** : React 19, TypeScript 5.8, Tailwind CSS 4, Recharts, Zustand
- **Backend** : Supabase (PostgreSQL, Auth, Storage, Realtime)
- **PWA** : Service workers avec Workbox pour le mode hors ligne
- **Déploiement** : Vercel

## Installation

```bash
npm install
```

Créer un fichier `.env` :
```
VITE_SUPABASE_URL=votre_url_supabase
VITE_SUPABASE_ANON_KEY=votre_cle_anon
```

Lancer en développement :
```bash
npm run dev
```

Build pour production :
```bash
npm run build
```

## Tests

```bash
npm test
```

## Structure du projet

```
src/
├── features/     # Modules fonctionnels (vente, etc.)
├── pages/        # Pages de l'application
├── components/   # Composants réutilisables (UI, POS, dialogs)
├── stores/       # État global (Zustand)
├── lib/          # Utilitaires et helpers (Supabase, stats, scope)
└── utils/        # Fonctions utilitaires (offline, prix, CSV)
```

## Sécurité

- Row Level Security (RLS) activé sur toutes les tables
- Politiques RLS basées sur les rôles utilisateurs
- Tickets stockés dans un bucket privé, servis via URLs signées
- CSP strict configuré dans vercel.json
