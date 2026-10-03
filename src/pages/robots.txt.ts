import type { APIRoute } from "astro";

// AI search and answer engines are explicitly allowed: being cited by them is a lead source.
export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL("sitemap-index.xml", site).href;
  const body = `User-agent: *
Allow: /
Disallow: /404/

User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

Sitemap: ${sitemap}
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
