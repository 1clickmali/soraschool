# Templates PDF SoraSchool

Ces fichiers HTML sont des templates Handlebars destinés aux documents PDF. Ils contiennent volontairement des expressions comme `{{primary_color}}`, `{{#if logo_ecole}}` ou `{{/each}}`.

Les PDF actuellement servis par l'API sont générés côté backend avec PDFKit dans `src/modules/pdf/pdf.service.ts`. Les templates HTML restent utiles comme références de design et pour une future migration vers un moteur HTML-to-PDF.

Pour éviter les faux problèmes dans VS Code, le workspace associe `src/modules/pdf/templates/*.html` au langage `handlebars` dans `.vscode/settings.json`.
