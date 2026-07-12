import type { MetadataRoute } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    // Only /api/ is robots-blocked. Private pages (/gift, /song, /create,
    // /my-songs) use meta noindex instead — a robots block would stop
    // crawlers from ever seeing the noindex, and would break gift link
    // previews (Meta's preview crawler respects robots.txt).
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
