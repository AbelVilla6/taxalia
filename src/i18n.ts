export const languages = {
  en: {
    label: 'US',
    name: 'American English',
    htmlLang: 'en-US',
  },
  es: {
    label: 'ES',
    name: 'Español de España',
    htmlLang: 'es-ES',
  },
} as const;

export type Lang = keyof typeof languages;
export type NavKey = 'about' | 'contact' | 'services' | 'blog';

export const defaultLang: Lang = 'en';

export function basePathFromPathname(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '') || '/';

  if (trimmed === '/es') {
    return '/';
  }

  if (trimmed.startsWith('/es/')) {
    return trimmed.slice(3) || '/';
  }

  return trimmed;
}

export function localizePath(lang: Lang, path: string): string {
  if (path.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(path)) {
    return path;
  }

  const normalizedPath = path === '/' ? '/' : `/${path.replace(/^\/+|\/+$/g, '')}`;

  if (lang === 'en') {
    return normalizedPath;
  }

  return normalizedPath === '/' ? '/es/' : `/es${normalizedPath}`;
}

export const ui = {
  en: {
    meta: {
      home: {
        title: 'LB & CO Global Advisors - Trusted Advisory. Insightful Valuations.',
        description:
          'Independent, data-driven advisory and valuation services to help businesses, investors, and professionals make informed decisions across the United States.',
      },
      about: {
        title: 'About Us - LB & CO Global Advisors',
        description: 'Learn about LB & CO Global Advisors, our mission, and our team.',
      },
      services: {
        title: 'Services - LB & CO Global Advisors',
        description:
          'Advisory, valuation, and financial guidance services from LB & CO Global Advisors.',
      },
      contact: {
        title: 'Contact Us - LB & CO Global Advisors',
        description:
          'Get in touch with LB & CO Global Advisors. Book a consultation or send us a message.',
      },
      blog: {
        title: 'Blog - LB & CO Global Advisors',
        description: 'Insights, analysis, and expert perspectives from LB & CO Global Advisors.',
      },
    },
    header: {
      homeLabel: 'LB & CO Global Advisors Home',
      navLabel: 'Main navigation',
      mobileNavLabel: 'Mobile navigation',
      menu: 'Menu',
      openMenu: 'Open menu',
      closeMenu: 'Close menu',
      languageSelector: 'Language selector',
      switchTo: {
        en: 'Switch to American English',
        es: 'Switch to Spanish from Spain',
      },
      nav: {
        about: 'About Us',
        contact: 'Contact Us',
        services: 'Services',
        blog: 'Blog',
      },
      book: 'Book a Consultation',
    },
    hero: {
      ariaLabel: 'Hero',
      kicker: 'About Us',
      title: ['Trusted Advisory.', 'Insightful Valuations.', 'Confident Decisions.'],
      text:
        'We deliver independent, data-driven advisory and valuation services to help businesses, investors, and professionals make informed decisions across the United States.',
      book: 'Book a Consultation',
      explore: 'Explore Our Services',
      trustLocation: 'Serving clients across the United States',
      trustValues: 'Independent. Objective. Trusted.',
      imageAlt: 'Two advisors reviewing financial charts and data in a professional setting',
    },
    services: {
      eyebrow: 'Our Services',
      pageEyebrow: 'What We Do',
      pageTitle: 'Our Services',
      title: 'Solutions That Drive Clarity and Confidence',
      learnMore: 'Learn More',
      learnMoreAria: 'Learn more about',
      items: [
        {
          title: 'Advisory Services',
          description:
            'Strategic advice and business consulting services to support growth, transactions, and operational excellence.',
          href: '/services/advisory',
        },
        {
          title: 'Valuation Support',
          description:
            'Independent valuations for businesses, real estate, and intangible assets delivered with rigor and integrity.',
          href: '/services/valuation',
        },
        {
          title: 'Financial Guidance',
          description:
            'Financial analysis, reporting, and planning to help you make smarter, data-driven decisions.',
          href: '/services/financial',
        },
      ],
    },
    blog: {
      eyebrow: 'From Our Blog',
      title: 'Insights That Matter',
      readMore: 'Read More',
      posts: [
        {
          date: 'May 10, 2024',
          title: '2024 U.S. Real Estate Market Outlook: Key Trends and Opportunities',
          excerpt:
            'We break down the factors shaping the U.S. real estate market and what investors and business owners should watch.',
          href: '/blog/2024-us-real-estate-market-outlook',
          image: '/assets/images/blog-real-estate.webp',
          imageAlt: 'Aerial view of a major US city skyline at dusk',
        },
        {
          date: 'April 23, 2024',
          title: 'Business Valuation 101: What You Need to Know',
          excerpt:
            'A practical guide to understanding business valuation methods and how they support better decision-making.',
          href: '/blog/business-valuation-101',
          image: '/assets/images/blog-valuation.webp',
          imageAlt: 'Financial charts and pen on a desk',
        },
      ],
    },
    cta: {
      title: "Let's Work Together",
      lead: "Have questions or ready to get started? We're here to help.",
      getInTouch: 'Get in Touch',
      followUs: 'Follow us',
    },
    footer: {
      rights: 'All rights reserved.',
      independent: 'Independent',
      confidential: 'Confidential',
      excellence: 'Committed to Excellence',
      multilingual: 'Available in English and Spanish',
    },
    chat: {
      ariaLabel: 'AI Assistant',
      imageAlt: 'Lexi, AI Assistant',
      status: 'AI Assistant',
      close: 'Close chat widget',
      bubble: "Hi! I'm Lexi, your AI Assistant. How can I help you today?",
      action: 'Ask a Question',
    },
    pages: {
      about: {
        eyebrow: 'Who We Are',
        title: 'About LB & CO Global Advisors',
        lead:
          'LB & CO Global Advisors is an independent firm specializing in business advisory, valuations, and financial guidance. We are committed to objectivity, integrity, and data-driven insights that empower our clients to make confident decisions.',
      },
      contact: {
        eyebrow: 'Get In Touch',
        title: 'Contact Us',
        consultation: 'Book a Consultation',
        name: 'Full Name',
        namePlaceholder: 'Your full name',
        email: 'Email Address',
        emailPlaceholder: 'you@company.com',
        message: 'Message',
        messagePlaceholder: 'Tell us about your needs...',
        send: 'Send Message',
      },
    },
  },
  es: {
    meta: {
      home: {
        title: 'LB & CO Global Advisors - Asesoramiento fiable. Valoraciones claras.',
        description:
          'Servicios independientes de asesoramiento y valoración basados en datos para ayudar a empresas, inversores y profesionales a tomar decisiones informadas en Estados Unidos.',
      },
      about: {
        title: 'Sobre nosotros - LB & CO Global Advisors',
        description: 'Conoce LB & CO Global Advisors, nuestra misión y nuestro equipo.',
      },
      services: {
        title: 'Servicios - LB & CO Global Advisors',
        description:
          'Servicios de asesoramiento, valoración y orientación financiera de LB & CO Global Advisors.',
      },
      contact: {
        title: 'Contacto - LB & CO Global Advisors',
        description:
          'Contacta con LB & CO Global Advisors. Reserva una consulta o envíanos un mensaje.',
      },
      blog: {
        title: 'Blog - LB & CO Global Advisors',
        description:
          'Análisis, perspectivas y opinión experta de LB & CO Global Advisors.',
      },
    },
    header: {
      homeLabel: 'Inicio de LB & CO Global Advisors',
      navLabel: 'Navegación principal',
      mobileNavLabel: 'Navegación móvil',
      menu: 'Menú',
      openMenu: 'Abrir menú',
      closeMenu: 'Cerrar menú',
      languageSelector: 'Selector de idioma',
      switchTo: {
        en: 'Cambiar a inglés estadounidense',
        es: 'Cambiar a español de España',
      },
      nav: {
        about: 'Sobre nosotros',
        contact: 'Contacto',
        services: 'Servicios',
        blog: 'Blog',
      },
      book: 'Reservar una consulta',
    },
    hero: {
      ariaLabel: 'Hero',
      kicker: 'Sobre nosotros',
      title: ['Asesoramiento fiable.', 'Valoraciones claras.', 'Decisiones con confianza.'],
      text:
        'Ofrecemos servicios independientes de asesoramiento y valoración basados en datos para ayudar a empresas, inversores y profesionales a tomar decisiones informadas en Estados Unidos.',
      book: 'Reservar una consulta',
      explore: 'Ver servicios',
      trustLocation: 'Atendemos a clientes en Estados Unidos',
      trustValues: 'Independientes. Objetivos. De confianza.',
      imageAlt:
        'Dos asesores revisando gráficos financieros y datos en un entorno profesional',
    },
    services: {
      eyebrow: 'Nuestros servicios',
      pageEyebrow: 'Qué hacemos',
      pageTitle: 'Nuestros servicios',
      title: 'Soluciones que aportan claridad y confianza',
      learnMore: 'Saber más',
      learnMoreAria: 'Saber más sobre',
      items: [
        {
          title: 'Servicios de asesoramiento',
          description:
            'Asesoramiento estratégico y consultoría empresarial para apoyar el crecimiento, las operaciones y las transacciones.',
          href: '/services/advisory',
        },
        {
          title: 'Soporte en valoraciones',
          description:
            'Valoraciones independientes de empresas, inmuebles y activos intangibles realizadas con rigor e integridad.',
          href: '/services/valuation',
        },
        {
          title: 'Orientación financiera',
          description:
            'Análisis financiero, reporting y planificación para ayudarte a tomar decisiones más inteligentes basadas en datos.',
          href: '/services/financial',
        },
      ],
    },
    blog: {
      eyebrow: 'Desde nuestro blog',
      title: 'Ideas que importan',
      readMore: 'Leer más',
      posts: [
        {
          date: '10 de mayo de 2024',
          title:
            'Perspectivas del mercado inmobiliario de EE. UU. en 2024: tendencias y oportunidades',
          excerpt:
            'Analizamos los factores que están dando forma al mercado inmobiliario de EE. UU. y lo que inversores y empresas deben tener en cuenta.',
          href: '/blog/2024-us-real-estate-market-outlook',
          image: '/assets/images/blog-real-estate.webp',
          imageAlt: 'Vista aérea de una gran ciudad estadounidense al atardecer',
        },
        {
          date: '23 de abril de 2024',
          title: 'Valoración de empresas 101: lo que necesitas saber',
          excerpt:
            'Una guía práctica para entender los métodos de valoración de empresas y cómo ayudan a tomar mejores decisiones.',
          href: '/blog/business-valuation-101',
          image: '/assets/images/blog-valuation.webp',
          imageAlt: 'Gráficos financieros y un bolígrafo sobre un escritorio',
        },
      ],
    },
    cta: {
      title: 'Trabajemos juntos',
      lead: '¿Tienes preguntas o quieres empezar? Estamos aquí para ayudarte.',
      getInTouch: 'Contactar',
      followUs: 'Síguenos',
    },
    footer: {
      rights: 'Todos los derechos reservados.',
      independent: 'Independientes',
      confidential: 'Confidencial',
      excellence: 'Compromiso con la excelencia',
      multilingual: 'Disponible en inglés y español',
    },
    chat: {
      ariaLabel: 'Asistente de IA',
      imageAlt: 'Lexi, asistente de IA',
      status: 'Asistente de IA',
      close: 'Cerrar widget de chat',
      bubble: 'Hola, soy Lexi, tu asistente de IA. ¿Cómo puedo ayudarte hoy?',
      action: 'Hacer una pregunta',
    },
    pages: {
      about: {
        eyebrow: 'Quiénes somos',
        title: 'Sobre LB & CO Global Advisors',
        lead:
          'LB & CO Global Advisors es una firma independiente especializada en asesoramiento empresarial, valoraciones y orientación financiera. Nos comprometemos con la objetividad, la integridad y el análisis basado en datos para que nuestros clientes tomen decisiones con confianza.',
      },
      contact: {
        eyebrow: 'Ponte en contacto',
        title: 'Contacto',
        consultation: 'Reservar una consulta',
        name: 'Nombre completo',
        namePlaceholder: 'Tu nombre completo',
        email: 'Correo electrónico',
        emailPlaceholder: 'tu@empresa.com',
        message: 'Mensaje',
        messagePlaceholder: 'Cuéntanos qué necesitas...',
        send: 'Enviar mensaje',
      },
    },
  },
} as const;
