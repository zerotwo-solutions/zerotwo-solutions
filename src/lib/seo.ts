import { company } from "../data/site";

export const abs = (path: string) => new URL(path, company.url).href;

export const ORG_ID = `${company.url}/#organization`;
export const WEBSITE_ID = `${company.url}/#website`;

export function organizationSchema() {
  return {
    "@type": ["Organization", "ProfessionalService"],
    "@id": ORG_ID,
    name: company.name,
    legalName: company.legalName,
    url: `${company.url}/`,
    logo: { "@type": "ImageObject", url: abs("/logo.png"), width: 512, height: 512 },
    image: abs("/og.png"),
    email: company.email,
    description: company.description,
    foundingDate: company.foundingYear,
    slogan: company.tagline,
    areaServed: [
      { "@type": "Country", name: "United States" },
      { "@type": "Place", name: "Worldwide" },
    ],
    knowsAbout: [
      "AI agent development",
      "Model Context Protocol (MCP)",
      "Large language models",
      "AWS Bedrock",
      "Anthropic Claude",
      "FinTech software development",
      "Real-time market data",
      "SaaS development",
      "Voice AI",
    ],
    contactPoint: [
      { "@type": "ContactPoint", contactType: "sales", email: company.email, availableLanguage: ["English"], areaServed: "US" },
    ],
    sameAs: [company.github],
  };
}

export function websiteSchema() {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: `${company.url}/`,
    name: company.name,
    inLanguage: "en-US",
    publisher: { "@id": ORG_ID },
  };
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: abs(it.path) })),
  };
}

export function faqSchema(faq: { q: string; a: string }[]) {
  return {
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

/** Serialize a graph for <script type="application/ld+json">, safe against "</script>". */
export function ldJson(nodes: object[]) {
  return JSON.stringify({ "@context": "https://schema.org", "@graph": nodes }).replace(/</g, "\\u003c");
}
