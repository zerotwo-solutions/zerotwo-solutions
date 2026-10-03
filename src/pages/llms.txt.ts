import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { company, services, caseStudies, homeFaq } from "../data/site";

// Plain-text company summary for LLM crawlers, generated from the same data as the pages.
export const GET: APIRoute = async () => {
  const url = (p: string) => new URL(p, company.url).href;
  const posts = (await getCollection("blogs", ({ data }) => !data.draft)).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );
  const body = `# ${company.name}

> ${company.description}

Contact: ${company.email} · ${url("/contact/")}

## Services
${services.map((s) => `- [${s.title}](${url(`/services/${s.slug}/`)}): ${s.answer}`).join("\n")}

## Case studies
${caseStudies.map((c) => `- [${c.title}](${url(`/work/${c.slug}/`)}): ${c.summary}`).join("\n")}

## Engineering blog
${posts.map((p) => `- [${p.data.title}](${url(`/blogs/${p.id}/`)}): ${p.data.description}`).join("\n")}

## FAQ
${homeFaq.map((f) => `### ${f.q}\n${f.a}`).join("\n\n")}
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
