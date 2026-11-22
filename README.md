# Prépa 70.3 : l'app iPhone

Application web installable (PWA) pour suivre la préparation à l'IRONMAN 70.3 Rapperswil-Jona du 6 juin 2027.

## Ce qu'elle fait
- **Aujourd'hui** : les séances du jour avec les allures et les watts cibles calculés depuis tes zones, les séances des deux jours suivants, le bilan de la semaine, le prochain test et un conseil du jour.
- **Semaine** : le prévu comparé au réalisé par sport, avec les séances jour par jour. Une séance est validée automatiquement par Strava, ou à la main avec un RPE et un commentaire.
- **Plan** : les 28 semaines par phase, les courses de 2027, tes zones et le plan de course.
- **Suivi** : le volume hebdomadaire comparé au prévu, la charge (CTL, ATL et TSB, estimées) et tes dernières activités.
- **Réglages** : les notifications, la connexion à Strava et tes références (FTP, CSS, seuil, poids).
- Elle fonctionne hors ligne et affiche une pastille sur l'icône avec le nombre de séances restantes du jour.

## Installation sur iPhone
1. Ouvre l'adresse de l'app dans **Safari**.
2. Touche **Partager**, puis **Sur l'écran d'accueil**.
3. Ouvre l'app depuis l'icône, puis va dans **Réglages › Activer les notifications** (iOS 16.4 ou plus récent).

## Notifications push (GitHub Actions)
- Elles sont envoyées tous les jours à 6 h 45 (heure de Zurich, été comme hiver), avec la séance du jour.
- Le dimanche à 19 h ou 20 h, tu reçois l'aperçu de la semaine suivante.
- Pour les mettre en place, copie le code affiché dans l'app (Réglages › Notifications) dans un secret du dépôt nommé `PUSH_CONFIG` : *Settings › Secrets and variables › Actions › New repository secret*.
- Pour tester, va dans l'onglet *Actions › Notifications › Run workflow*.

Autre solution sans serveur : le bouton « Ajouter le plan au calendrier » importe `plan.ics`. Tu obtiens un événement par jour d'entraînement, avec un rappel à 7 h.

## Strava
1. Crée une application API sur strava.com/settings/api. Pour « Authorization Callback Domain », indique le domaine de l'app, par exemple `pseudo.github.io`.
2. Saisis le Client ID et le Client Secret dans Réglages › Strava, puis touche Connecter.
3. Tes activités se synchronisent ensuite à chaque ouverture de l'app. Les identifiants restent stockés sur le téléphone.

## Fichiers
- `data/plan.json` : le plan, généré depuis `plan/Plan_70.3_Rapperswil_2027.xlsx`.
- `data/activities.json` : un instantané Strava (résumés, sans tracé GPS).
- `scripts/notify.mjs` et `.github/workflows/notifications.yml` : l'envoi des notifications push.
