# LB & CO — Tareas pendientes

## Imágenes (requeridas para que la web se vea completa)
- [ ] Añadir `hero-advisory.jpg` (foto de dos asesores revisando gráficos, 960×1080 px) en `public/assets/images/`
- [ ] Añadir `blog-real-estate.jpg` (skyline de ciudad) en `public/assets/images/`
- [ ] Añadir `blog-valuation.jpg` (gráficos financieros sobre escritorio) en `public/assets/images/`
- [ ] Añadir `agent-lexi.jpg` (avatar del chatbot) en `public/assets/images/`
- [ ] Optimizar todas las imágenes a WebP (usar Squoosh o similar)

## Formulario de contacto
- [ ] Conectar el formulario en `contact.astro` a un backend real (Netlify Forms, Formspree, o endpoint propio)
- [ ] Añadir validación del lado cliente y mensajes de error/éxito
- [ ] Añadir campo de teléfono y selector de servicio de interés

## Contenido / páginas interiores
- [ ] Página `/about` — añadir bios del equipo, historia de la empresa y sección de valores
- [ ] Páginas individuales de servicios (`/services/advisory`, `/services/valuation`, `/services/financial`)
- [ ] Sistema de blog completo (Astro Content Collections) con páginas individuales de post
- [ ] Paginación y filtros en `/blog`

## Chat widget
- [ ] Sustituir widget estático por integración real (Intercom, Crisp, o API propia de IA)
- [ ] El botón "Ask a Question" del chat debe abrir un flujo de chat, no redirigir a /contact

## SEO / técnico
- [ ] Añadir `sitemap.xml` (paquete `@astrojs/sitemap`)
- [ ] Añadir `robots.txt`
- [ ] Configurar Open Graph y Twitter Card meta tags en `Base.astro`
- [ ] Añadir schema JSON-LD (LocalBusiness / ProfessionalService)
- [ ] Imagen OG (1200×630 px)

## Accesibilidad
- [ ] Añadir `<a href="#main-content" class="skip-link">Skip to content</a>` visible en focus
- [ ] Probar contraste de colores con herramienta WCAG (el dorado sobre blanco puede ser bajo)
- [ ] Probar navegación completa con teclado

## Internacionalización (ES)
- [ ] Definir estrategia i18n (`/es/` rutas o dominio separado)
- [ ] Traducir todos los textos al español
- [ ] El botón ES del nav no hace nada actualmente

## Performance
- [ ] Usar `<Image />` de `@astrojs/image` para optimización automática
- [ ] Lazy load del chat widget (no cargar hasta scroll)
- [ ] Configurar caché de assets estáticos (headers del servidor)

## Footer
- [ ] Añadir sección de navegación secundaria (Privacy Policy, Terms of Service, Sitemap)
- [ ] Enlace de Instagram `@hitaxalia` → sustituir por cuenta real si cambia
