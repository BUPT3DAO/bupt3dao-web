import type { MetadataRoute } from 'next';

const SITE_ORIGIN = 'https://bupt3dao.club';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['/', '/forum', '/articles', '/members', '/guide'].map((path) => ({
    url: new URL(path, SITE_ORIGIN).toString(),
  }));
}
