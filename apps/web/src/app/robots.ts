import type { MetadataRoute } from 'next';

const SITE_ORIGIN = 'https://bupt3dao.club';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/'],
      disallow: [
        '/admin',
        '/api/',
        '/notifications',
        '/settings',
        '/articles/new',
        '/articles/*/edit',
      ],
    },
    sitemap: new URL('/sitemap.xml', SITE_ORIGIN).toString(),
    host: SITE_ORIGIN,
  };
}
