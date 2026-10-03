import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getCollection } from "astro:content";
import { company } from "../data/site";

export async function GET(context: APIContext) {
  const posts = (await getCollection("blogs", ({ data }) => !data.draft)).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );

  return rss({
    title: `${company.name} Engineering Blog`,
    description:
      "Field notes from production: AI agents on Claude and AWS Bedrock, MCP servers, real-time market data pipelines and voice AI.",
    site: context.site ?? company.url,
    trailingSlash: true,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/blogs/${post.id}/`,
      categories: post.data.tags,
      author: `${company.email} (${company.name})`,
    })),
    customData: `<language>en-us</language><copyright>${company.name}</copyright>`,
  });
}
