# Déploiement SoraSchool

## Test téléphone sur le même Wi-Fi

1. Démarrer l'API depuis la racine :
   `pnpm dev`
2. Démarrer le frontend mobile :
   `cd admin-ui && npm run dev:lan`
3. Ouvrir sur le téléphone :
   `http://ADRESSE_IP_DU_MAC:3000`

L'interface remplace automatiquement `localhost:4000` par l'adresse IP du Mac quand elle est ouverte depuis un téléphone.

## Mise en ligne web

Backend Railway :
- Service backend depuis la racine du projet local.
- Variables obligatoires : `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN`, `PUBLIC_API_URL`, `MOCK_SMS`.
- `PUBLIC_API_URL` doit être l'URL HTTPS publique du backend.
- `CORS_ORIGIN` doit contenir l'URL HTTPS du frontend.

Frontend Vercel ou Railway :
- Projet depuis `admin-ui`.
- Variable obligatoire : `NEXT_PUBLIC_API_URL=https://URL_DU_BACKEND`.

## Application mobile

Le frontend est préparé comme PWA installable :
- Android Chrome : ouvrir l'URL HTTPS, puis `Installer l'application`.
- iPhone Safari : ouvrir l'URL HTTPS, puis `Partager > Sur l'écran d'accueil`.

Pour publier une vraie app Play Store / App Store, il faudra ensuite générer un wrapper Capacitor ou React Native autour de l'URL HTTPS finale.
