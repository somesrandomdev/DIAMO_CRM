# 🚰 Diam'o — Système de Gestion de Franchise d'Eau

CRM pour kiosques de vente d'eau : ventes, clients, offres, objectifs et analyses, avec mode hors-ligne (PWA) et génération de tickets PDF.

## Rôles

- **Fontainier** : ventes rapides, gestion de ses clients, historique
- **Commercial** : analyses, objectifs, gestion de son portefeuille
- **Administrateur** : gestion complète (kiosques, offres, tarifs, utilisateurs, rapports)

## Stack

React 19 · TypeScript · Vite 7 · Tailwind CSS 4 · Zustand · Supabase (Postgres + Auth + Storage) · React Router 7 · Recharts · PWA (Workbox via vite-plugin-pwa)

## Schéma Base de Données

| Table | Champs | Description |
|-------|--------|-------------|
| **kiosques** | id, nom, adresse, created_at | Informations des kiosques |
| **profiles** | id, username, role, kiosque_id, created_at | Profils utilisateurs avec rôles |
| **offres** | id, nom, volume_ml, description, created_at | Produits disponibles |
| **offres_kiosque** | id, kiosque_id, offre_id, prix, est_actif, created_at | Prix par kiosque et offre |
| **clients** | id, kiosque_id, nom, telephone, situation_familiale, adresse, notes, created_at | Informations clients |
| **ventes** | id, kiosque_id, client_id, offre_id, quantite, montant_total, lien_ticket, created_at | Historique des ventes |

Migration SQL : `supabase/migrations/`. RLS obligatoire sur toutes les tables.

## Installation

Prérequis : Node.js 18+, un compte Supabase.

```bash
git clone <repository-url>
cd diamo-app
npm install
# créer un .env.local à la racine (voir variables ci-dessous)
npm run dev
```

Variables d'environnement requises (`.env.local`) :

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## Scripts

```bash
npm run dev            # développement
npm run build          # build production (tsc + vite)
npm run preview        # prévisualiser le build
npm run lint           # ESLint
npm test               # tests unitaires (Jest)
npm run cy:open        # Cypress interactif
npm run test:e2e       # tests e2e Cypress
```
