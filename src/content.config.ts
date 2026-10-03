import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const blogs = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blogs" }),
  schema: z.object({
    title: z.string().min(10).max(110),
    /** Meta description and article lead. Kept within search snippet length. */
    description: z.string().min(50).max(160),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).min(1),
    /** Optional override in minutes; otherwise computed from word count. */
    readingTime: z.number().int().positive().optional(),
    draft: z.boolean().default(false),
    /** Service slugs from src/data/site.ts shown in the "Related services" box. */
    services: z.array(z.string()).default([]),
    /** Case study slug from src/data/site.ts linked from the article sidebar. */
    caseStudy: z.string().optional(),
  }),
});

export const collections = { blogs };
