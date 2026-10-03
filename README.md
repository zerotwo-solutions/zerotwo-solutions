<div align="center">

# ⚡ ZeroTwo Solutions

### We turn AI ideas into revenue-generating products.

**AI Agents · FinTech Platforms · Enterprise SaaS** — engineered to scale from day one.

<br>

[![Website](https://img.shields.io/badge/🌐_Visit_Website-0A66C2?style=for-the-badge)](https://www.zerotwosolutions.com)
[![Book a Call](https://img.shields.io/badge/📅_Start_Your_Project-16A34A?style=for-the-badge)](https://www.zerotwosolutions.com)
[![Email](https://img.shields.io/badge/📧_info@zerotwosolutions.com-EA4335?style=for-the-badge)](mailto:info@zerotwosolutions.com)

</div>

<br>

## 🚀 What We Deliver

| | | |
|:---:|:---:|:---:|
| 🤖 **AI Engineering** | 📈 **FinTech Systems** | ☁️ **Cloud & SaaS** |
| AI Agents, RAG, Chatbots & Automation that work in production — not just demos | Trading platforms & real-time market data infra built for speed and zero downtime | Enterprise SaaS on AWS & Kubernetes, secure and ready for scale |

<br>

## 💡 Why Clients Stay With Us

> 🎯 **Ship in weeks, not months** — battle-tested architecture from day one
>
> ⚡ **Real-time by default** — WebSocket & low-latency systems for data-heavy products
>
> 🤝 **A partner, not a vendor** — we own outcomes, from first commit to production scale

<br>

## 🛠️ Our Stack

<div align="center">

![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)
![Django](https://img.shields.io/badge/Django-092E20?style=flat-square&logo=django&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![AWS](https://img.shields.io/badge/AWS-232F3E?style=flat-square&logo=amazonwebservices&logoColor=white)
![Kubernetes](https://img.shields.io/badge/Kubernetes-326CE5?style=flat-square&logo=kubernetes&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat-square&logo=openai&logoColor=white)
![Anthropic](https://img.shields.io/badge/Anthropic-191919?style=flat-square)
![LangChain](https://img.shields.io/badge/LangChain-1C3C3C?style=flat-square&logo=langchain&logoColor=white)

</div>

<br>

## ⭐ Open Source & Insights

We open-source tools in **AI Engineering, FinTech, Django & DevOps** and publish deep-dives on our [Engineering Blog](https://www.zerotwosolutions.com/blogs).

**Follow this org** — new projects and articles every month.

<br>

---

<div align="center">

## 💬 Have a project in mind?

**Most clients get a technical roadmap within 48 hours of first contact.**

<br>

[![Get Started](https://img.shields.io/badge/🚀_Get_Your_Free_Consultation-2563EB?style=for-the-badge&logoColor=white)](https://www.zerotwosolutions.com)

📧 **info@zerotwosolutions.com** · 🌐 **[zerotwosolutions.com](https://www.zerotwosolutions.com)**

</div>

---

## 🧑‍💻 Website development

This repository contains the source of [zerotwosolutions.com](https://www.zerotwosolutions.com): a static [Astro](https://astro.build) site with lazily loaded three.js scenes, zero UI-framework runtime, and build-time SEO checks.

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # astro check + static build to dist/ + SEO/link/privacy verification
npm run preview   # serve dist/
npm run og        # regenerate og.png, icons and favicons from SVG
```

- **Content** lives in `src/data/site.ts` (services, case studies, process, FAQ) and `src/content/blogs/*.md` (blog).
- **Design tokens** (type scale, colors, spacing) live in `src/styles/global.css`; every page uses them.
- **Contact form**: set `PUBLIC_FORM_ENDPOINT` (Formspree, Web3Forms, etc.) at build time; without it the form falls back to `mailto:`.
- **SEO**: per-page canonical/OG/Twitter tags, JSON-LD (Organization, Service, BreadcrumbList, BlogPosting, FAQPage), `sitemap-index.xml`, `robots.txt`, `llms.txt` and `rss.xml` are generated at build. `scripts/verify-build.mjs` fails the build on missing metadata, duplicate titles, broken internal links, more than one H1, or JS-budget regressions.
- **Deploy**: any static host (Cloudflare Pages, Netlify, Vercel, S3 + CloudFront). Output directory: `dist/`.
