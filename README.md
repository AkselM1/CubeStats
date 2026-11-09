# CubeStats V3 — version de test

Cette version rassemble les principales briques pour un premier test fonctionnel : comptes, profils, records, recherche de profils publics, classements simples, administration du catalogue et niveaux, import/export JSON et chronomètre.

## Important : ce n'est pas encore un service public prêt à ouvrir
Il faut configurer Supabase, effectuer des tests de sécurité avec plusieurs comptes et corriger les limites signalées ci-dessous avant tout lancement public.

## Mise en ligne depuis un téléphone Android
Le projet peut être publié sans ordinateur en utilisant le navigateur du téléphone, GitHub et Vercel. Il faut toutefois téléverser les fichiers en conservant leur arborescence (racine, `src/` et `supabase/migrations/`). Sur GitHub mobile, le plus simple est d'extraire le ZIP avec l'application Fichiers, puis d'envoyer les fichiers dossier par dossier. Vercel effectue ensuite l'installation des dépendances et la compilation dans le cloud.

## Installation locale
1. Installer Node.js LTS sur un ordinateur.
2. Décompresser le ZIP.
3. Ouvrir un terminal dans le dossier `CubeStats-v3`.
4. Exécuter `npm install`.
5. Copier `.env.example` en `.env` et renseigner l'URL Supabase et la clé publique `anon`/publishable.
6. Dans Supabase > SQL Editor, exécuter `supabase/migrations/001_schema.sql`.
7. Exécuter `npm run dev`, puis ouvrir l'adresse locale donnée par Vite.

Sans Supabase, seul le chronomètre local est utilisable. Ne jamais mettre une clé `service_role` dans `.env` côté navigateur ni partager de clés ou mots de passe dans une conversation.

## Attribuer l'administration au propriétaire
Après inscription du compte propriétaire, retrouver son UUID dans Supabase > Authentication > Users puis exécuter dans SQL Editor :
```sql
insert into public.admin_users(user_id)
values ('UUID-DU-COMPTE-PROPRIETAIRE');
```
Déconnecte-toi puis reconnecte-toi dans CubeStats. Il n'existe volontairement aucun bouton d'auto-attribution du rôle admin.

## Parcours de test suggéré
- Créer deux comptes de test avec des pseudonymes distincts.
- Vérifier que chacun peut modifier son profil et uniquement ses propres records.
- Vérifier que le profil public d'un compte est consultable par son pseudonyme.
- Vérifier qu'un profil privé n'est pas visible aux visiteurs.
- Ajouter / renommer / désactiver une discipline avec le compte admin.
- Ajouter une statistique et un seuil de niveau.
- Exporter ses données puis tester l'import dans le même compte.
- Essayer de modifier/supprimer le record de l'autre compte : l'opération doit être refusée par RLS.

## Limites fonctionnelles connues à ce stade
- Le classement liste les records enregistrés dans la statistique choisie; il ne calcule pas encore les Ao5/Ao12/Ao100 à partir des temps bruts.
- Les champs de pénalité sont conservés, mais le calcul officiel des pénalités (+2 et DNF) et les moyennes WCA ne sont pas encore gérés de bout en bout.
- Les disciplines blind, Fewest Moves et Multi-Blind demandent des formulaires et règles propres; le chronomètre générique ne suffit pas.
- Le générateur `cubing.js` ne garantit pas qu'un scramble soit disponible pour chaque discipline. Vérifier chaque puzzle avant de le proposer comme pris en charge.
- L'administration des statistiques permet ajout, suppression, visibilité et inclusion au classement; la modification du libellé/unité directement dans la liste reste à ajouter.
- Les niveaux sont enregistrés et configurables, mais leur affichage automatique sur chaque profil/classement reste à connecter.
- Pas encore de badges, comparaison de deux cubers, validation e-mail personnalisée, réinitialisation de mot de passe dans l'interface, limitation anti-abus ni tests automatisés.
- Les règles RLS fournies sont un point de départ. Faire un audit de sécurité et tester les accès interdits avant une mise en ligne.

## Vie privée
Ne collecte que les données nécessaires. Préfère un pseudonyme; ne publie ni e-mail, ni nom complet, ni adresse, ni informations personnelles dans la biographie. Respecte les conditions d'âge des services utilisés; un parent ou tuteur peut devoir gérer la création du projet fournisseur.
