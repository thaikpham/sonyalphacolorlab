# Sony Alpha ColorLab

**Explore color. Understand your gear. Create with confidence.**

An independent creative knowledge platform for Sony Alpha photographers, filmmakers, and creators.

[**Explore Website →**](https://sonycolorlab.app) · [**GitHub Repository**](https://github.com/thaikpham/sonyalphacolorlab) · [**Report an Issue**](https://github.com/thaikpham/sonyalphacolorlab/issues)

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)
![React](https://img.shields.io/badge/React-19-149eca?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ecf8e?logo=supabase)
![Languages](https://img.shields.io/badge/Languages-English%20%7C%20Vietnamese-blue)

---

## Overview

**Sony Alpha ColorLab** is a modern, bilingual web platform dedicated to exploring creative color possibilities, understanding Sony imaging technology, and making informed equipment decisions.

Originally conceived around Sony in-camera color recipes, ColorLab has evolved into a broader creative ecosystem connecting color science, photography education, product knowledge, and community-driven discovery.

Our mission is simple:

**Make sophisticated imaging technology accessible, understandable, and inspiring for every creator.**

Whether you are experimenting with cinematic color, learning how your camera works, comparing equipment, or discovering new creative techniques, ColorLab provides a place to explore.

## Features

### 🎨 Color Recipe Library

Discover and experiment with in-camera color recipes designed around Sony's imaging technologies.

- Explore Picture Profile configurations.
- Discover Creative Look combinations.
- Experiment with White Balance Shift and color temperature.
- Understand individual color parameters.
- Access detailed, shareable recipe pages.
- Explore community photographs and discussions.

Color recipes provide creative starting points rather than guaranteed results. Appearance varies with exposure, lighting, camera compatibility, and viewing conditions.

### 📷 Sony Digital Imaging Wiki

A product reference designed to make Sony camera and lens information easier to navigate.

- Browse Sony Alpha cameras, ZV cameras, Cinema Line equipment, and lenses.
- Explore technical specifications and product features.
- Access dedicated product pages.
- Compare supported camera models side by side.
- Discover relevant technical information and educational resources.

The goal is to move beyond specification sheets and help creators understand how technology translates into real-world shooting experiences.

### 🎧 Sony Personal Audio

Explore a dedicated product reference for Sony personal audio technology.

- Browse supported audio products.
- Review product specifications.
- Discover features and related technical information.
- Learn about audio technology within the broader Sony ecosystem.

### 📚 Articles & Learning

Learn through technical explanations, educational articles, and structured reference content.

Topics include camera technology, photography principles, color settings, and creative workflows.

The platform includes:

- Educational articles and technical references.
- A photography terminology glossary.
- Related resources across recipes and product pages.
- Searchable learning content.
- English and Vietnamese localization.

### 🔎 Unified Discovery

Explore recipes, products, and knowledge through the platform's integrated search experience.

Rather than treating color recipes, equipment specifications, and educational materials as disconnected resources, ColorLab aims to make them part of a coherent discovery experience.

### 🌏 Bilingual Experience

ColorLab supports **English and Vietnamese**, making technical photography knowledge more accessible to an international audience and the Vietnamese creator community.

## Our Philosophy

**Color is a creative language, not just a camera setting.**

Every color adjustment can influence how a photograph feels.

White balance, contrast, saturation, color rendering, and tonal response are not merely technical parameters. Together, they shape visual storytelling.

ColorLab combines three principles:

**Explore.** Discover techniques, settings, and creative possibilities.

**Understand.** Learn why a particular configuration works and when to use it.

**Create.** Apply knowledge to build a recognizable personal visual style.

We believe the best tools should help creators spend less time searching for technical answers and more time creating.

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 — App Router |
| Frontend | React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Database | Supabase / PostgreSQL |
| Authentication | Supabase Auth |
| Internationalization | next-intl |
| Validation | Zod |
| AI integration | Anthropic SDK |
| Testing | Vitest |
| Code quality | ESLint, TypeScript |
| Deployment | Vercel-compatible Next.js hosting |

### Architecture

ColorLab uses a full-stack architecture based on Next.js, with a separation between application logic, persistent content, authentication, and community features.

Its Supabase infrastructure is divided into two logical environments:

**Control Plane**

Handles authentication, user permissions, administration, and community interactions.

**Content Plane**

Manages color recipes, product catalogues, technical articles, and associated content.

This separation improves operational isolation and allows the platform's editorial and community systems to evolve independently.

The project also supports seed-backed development without database credentials.

## Getting Started

### Prerequisites

- Node.js compatible with Next.js 16
- npm
- Git
- Supabase project credentials for database-backed functionality

### Installation

Clone the repository:

```bash
git clone https://github.com/thaikpham/sonyalphacolorlab.git
cd sonyalphacolorlab
```

Install dependencies:

```bash
npm ci
```

Create your local environment configuration:

```bash
cp .env.example .env.local
```

Configure the required environment variables according to `.env.example`.

For offline development, all six Supabase connection variables can remain unset. Database-backed environments must configure the complete set.

Start the development server:

```bash
npm run dev
```

Open:

**http://localhost:3000**

### Available Commands

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Create production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Check TypeScript |
| `npm run test` | Run automated tests |
| `npm run verify` | Run the complete verification pipeline |
| `npm run doctor` | Run project diagnostics |

## Project Structure

```text
sonyalphacolorlab/
├── src/
│   ├── app/           # Pages and API routes
│   ├── components/    # Reusable UI components
│   ├── design/        # Design primitives
│   ├── i18n/          # Localization
│   ├── lib/           # Business and domain logic
│   └── test/          # Test utilities
├── packages/          # Shared packages
├── messages/          # English and Vietnamese copy
├── data/              # Seed data and reference datasets
├── public/            # Static assets
├── scripts/           # Development and maintenance tools
├── supabase/           # Database migrations
├── docs/               # Technical documentation
├── DESIGN.md           # Design system guidance
├── AGENTS.md           # Development conventions
└── package.json
```

## Contributing

We welcome constructive feedback, bug reports, documentation improvements, and contributions that help make creative technology more accessible.

To contribute:

1. Review the existing issues or open a new issue describing your proposal.
2. Fork the repository and create a feature branch.
3. Follow the conventions documented in `AGENTS.md` and `DESIGN.md`.
4. Run the relevant quality checks before submitting changes.
5. Submit a pull request with a clear explanation of your contribution.

Technical claims about Sony cameras, lenses, and supported settings should be backed by reliable references, preferably official Sony documentation.

## Roadmap

Future development priorities include:

- More intuitive color recipe discovery.
- Broader educational and technical content.
- Improved search and knowledge navigation.
- Greater integration between recipes and camera compatibility information.
- Enhanced community participation.
- Further improvements to performance, accessibility, and mobile usability.

These are development directions, not commitments to specific release dates.

## Disclaimer

Sony Alpha ColorLab is an **independent project** and is not affiliated with, endorsed by, or sponsored by Sony Group Corporation or its subsidiaries.

Sony, Alpha, and other related names are trademarks of their respective owners.

Product specifications, features, and available settings may differ by model, region, firmware version, and shooting mode. Always consult official Sony documentation for authoritative information.

## Creator

**Thai K. Pham**

Photography enthusiast, imaging technology specialist, and creator of Sony Alpha ColorLab.

Built with a passion for photography, color science, technology, and creative education.

🌐 [Website](https://sonycolorlab.app) · 💻 [GitHub](https://github.com/thaikpham) · 📘 [Facebook](https://www.facebook.com/thaikpham.art) · 📸 [Instagram](https://www.instagram.com/thaikpham)

---

**Made for creators who believe color is part of the story.**

*Explore. Experiment. Create.*

---

**Made for creators who believe color is part of the story.**

*Explore. Experiment. Create.*

