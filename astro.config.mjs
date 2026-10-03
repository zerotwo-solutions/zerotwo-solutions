// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export const SITE_URL = "https://www.zerotwosolutions.com";

export default defineConfig({
  site: SITE_URL,
  trailingSlash: "always",
  build: { format: "directory", inlineStylesheets: "auto" },
  prefetch: { prefetchAll: false, defaultStrategy: "hover" },
  integrations: [
    sitemap({
      filter: (page) => !page.includes("/404"),
      changefreq: "weekly",
      priority: 0.7,
      serialize(item) {
        if (item.url === `${SITE_URL}/`) item.priority = 1.0;
        else if (/\/(services|work)\/$/.test(item.url)) item.priority = 0.9;
        return item;
      },
    }),
  ],
});
