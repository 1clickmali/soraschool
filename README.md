# SoraSchool Backend

Backend professionnel multi-tenant pour écoles, universités, centres de formation et instituts.

## Démarrage local

```bash
cd /Users/boolb/Desktop/sorasaas
cp .env.example .env
pnpm install
docker compose up -d
pnpm prisma:generate
pnpm prisma:push
pnpm prisma:seed
pnpm dev
```

API : `http://localhost:4000`

Swagger : `http://localhost:4000/docs`

Health : `http://localhost:4000/health`

## Comptes seed

- Super Admin : `+22507000000001`
- Directeur ISCF : `+22507597799139`
- Professeur ISCF : `+22507123456789`
- Parent ISCF : `+2250701020304`

Le backend utilise un OTP mock en local. Le code apparaît dans le terminal avec `[MOCK SMS]`.
