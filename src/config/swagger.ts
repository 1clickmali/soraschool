import swaggerJsdoc from 'swagger-jsdoc'
import { env } from './env'

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: `${env.APP_NAME} API`,
      version: '0.1.0',
      description: 'API backend multi-tenant pour établissements scolaires.'
    },
    servers: [
      {
        url: 'http://localhost:4000',
        description: 'Local'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    paths: {
      '/health': {
        get: { summary: 'Vérifie l’état de l’API', responses: { 200: { description: 'API active' } } }
      },
      '/api/auth/request-otp': {
        post: { summary: 'Demande un OTP par téléphone', tags: ['Auth'], responses: { 200: { description: 'OTP envoyé' } } }
      },
      '/api/auth/verify-otp': {
        post: { summary: 'Vérifie OTP et retourne JWT', tags: ['Auth'], responses: { 200: { description: 'Session ouverte' } } }
      },
      '/api/super-admin/dashboard': {
        get: { summary: 'Statistiques globales SaaS', tags: ['Super Admin'], responses: { 200: { description: 'Dashboard global' } } }
      },
      '/api/super-admin/institutions': {
        get: { summary: 'Liste des établissements', tags: ['Super Admin'], responses: { 200: { description: 'Liste' } } },
        post: { summary: 'Crée un établissement avec abonnement et directeur', tags: ['Super Admin'], responses: { 201: { description: 'Établissement créé' } } }
      },
      '/api/academics/classes': {
        get: { summary: 'Liste des classes selon rôle', tags: ['Academics'], responses: { 200: { description: 'Classes' } } },
        post: { summary: 'Crée une classe (direction/admin uniquement)', tags: ['Academics'], responses: { 201: { description: 'Classe créée' } } }
      },
      '/api/students': {
        get: { summary: 'Liste/recherche élèves', tags: ['Students'], responses: { 200: { description: 'Élèves' } } },
        post: { summary: 'Inscrit un élève', tags: ['Students'], responses: { 201: { description: 'Élève créé' } } }
      },
      '/api/teachers': {
        get: { summary: 'Liste professeurs', tags: ['Teachers'], responses: { 200: { description: 'Professeurs' } } },
        post: { summary: 'Crée un professeur et autorise son téléphone', tags: ['Teachers'], responses: { 201: { description: 'Professeur créé' } } }
      },
      '/api/grades': {
        get: { summary: 'Liste des notes', tags: ['Grades'], responses: { 200: { description: 'Notes' } } },
        post: { summary: 'Saisie note par professeur assigné', tags: ['Grades'], responses: { 201: { description: 'Note créée' } } }
      },
      '/api/shop/products': {
        get: { summary: 'Liste produits boutique', tags: ['Shop'], responses: { 200: { description: 'Produits' } } },
        post: { summary: 'Crée un produit stock sans erreur', tags: ['Shop'], responses: { 201: { description: 'Produit créé' } } }
      },
      '/api/documents': {
        get: { summary: 'Liste documents sécurisés', tags: ['Documents'], responses: { 200: { description: 'Documents' } } },
        post: { summary: 'Upload PDF/JPG/PNG multi-fichiers', tags: ['Documents'], responses: { 201: { description: 'Documents uploadés' } } }
      },
      '/api/messages/conversations/group/all': {
        post: { summary: 'Crée/récupère le groupe général de l’établissement', tags: ['Messages'], responses: { 201: { description: 'Conversation groupe' } } }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  apis: ['src/**/*.ts']
})
