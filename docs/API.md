# SoraSchool API - résumé des endpoints

Base URL locale : `http://localhost:4000`

## Auth

- `POST /api/auth/request-otp` : demande un OTP.
- `POST /api/auth/verify-otp` : vérifie OTP et retourne `accessToken` + `refreshToken`.
- `POST /api/auth/refresh` : renouvelle la session.
- `GET /api/auth/me` : utilisateur connecté.
- `POST /api/auth/logout` : déconnexion.

## Super Admin

- `GET /api/super-admin/dashboard`
- `GET /api/super-admin/plans`
- `POST /api/super-admin/plans`
- `GET /api/super-admin/institutions`
- `POST /api/super-admin/institutions`
- `PATCH /api/super-admin/institutions/:id/status`
- `DELETE /api/super-admin/institutions/:id`
- `POST /api/super-admin/subscriptions/suspend-expired`

## Établissement

- `GET /api/institutions/slug/:slug`
- `GET /api/institutions/settings`
- `PATCH /api/institutions/settings`

## Académique

- `GET|POST /api/academics/academic-years`
- `GET|POST /api/academics/levels`
- `GET|POST /api/academics/classes`
- `GET|POST /api/academics/subjects`
- `GET|POST /api/academics/assignments`

## Élèves / professeurs / parents

- `GET|POST /api/students`
- `GET|PATCH /api/students/:id`
- `GET /api/students/:id/enrollment-form`
- `GET /api/students/:id/card`
- `GET|POST /api/teachers`
- `GET|PATCH /api/teachers/:id`
- `GET /api/teachers/:id/card`
- `GET /api/teachers/me/salary`
- `GET|POST /api/parents`
- `GET /api/parents/dashboard`
- `POST /api/parents/reports`

## Notes, présences, discipline

- `GET|POST /api/grades/periods`
- `GET|POST /api/grades`
- `POST /api/attendance/student-sessions`
- `GET /api/attendance/students`
- `POST /api/attendance/teachers/me/justify`
- `GET|POST /api/discipline`

## Paiements, boutique, documents, messages

- `GET|POST /api/payments/invoices`
- `POST /api/payments`
- `GET /api/payments/:id/receipt`
- `GET|POST /api/shop/categories`
- `POST /api/shop/suppliers`
- `GET|POST /api/shop/products`
- `POST /api/shop/movements`
- `POST /api/shop/sales`
- `GET /api/shop/low-stock`
- `GET|POST /api/documents`
- `GET /api/documents/:id/download`
- `DELETE /api/documents/:id`
- `GET /api/documents/bundle.zip`
- `GET /api/messages/conversations`
- `POST /api/messages/conversations/private`
- `POST /api/messages/conversations/group/all`
- `GET|POST /api/messages/conversations/:id/messages`

Tous les endpoints métier sont isolés par `institutionId` depuis le JWT. Le rôle `SUPER_ADMIN` n’appartient à aucun établissement.
