# Sony Alpha ColorLab

### Your Color. Your Camera. Your Creative Universe.

**Discover extraordinary colors. Master your gear. Unlock your creative potential.**

An independent, community-driven creative platform for Sony Alpha photographers, filmmakers, and visual storytellers.

Explore in-camera color recipes, discover Sony imaging technology, compare equipment, learn photographic techniques, and connect creativity with knowledge — all in one ecosystem.

**Built by a creator. Made for creators. Growing with the community.**

[Explore ColorLab](https://sonycolorlab.app) · [GitHub Repository](https://github.com/thaikpham/sonyalphacolorlab) · [Star the Project](https://github.com/thaikpham/sonyalphacolorlab) · [Support Development](#support-the-project)

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?logo=supabase&logoColor=white)
![Languages](https://img.shields.io/badge/Languages-English_%7C_Vietnamese-8A9CFF)
![GitHub Stars](https://img.shields.io/github/stars/thaikpham/sonyalphacolorlab?style=social)

---

## Welcome to ColorLab

### More Than Colors. A Universe of Creative Possibilities.

**Sony Alpha ColorLab** is an independent creative technology project dedicated to making photography, color science, and Sony imaging technology more accessible, understandable, and inspiring.

What began as a simple idea — helping photographers discover beautiful colors directly inside their Sony cameras — has evolved into a broader platform connecting creative experimentation with practical technical knowledge.

Instead of treating color recipes, camera specifications, photography education, and community inspiration as separate experiences, ColorLab brings them together.

Our vision is to create a place where photographers can explore their equipment, understand the technology behind their images, and develop their own creative identity.

Whether you're taking your first photograph or refining a professional workflow, ColorLab is built to support your creative journey.

**The mission is simple: make advanced imaging knowledge accessible to everyone, and turn technical complexity into creative freedom.**

## The ColorLab Ecosystem

### 01. ColorLab — In-Camera Color Recipes

**Create distinctive looks. Straight out of your camera.**

Explore creative color recipes designed around Sony Alpha's in-camera image-processing capabilities.

ColorLab helps photographers understand and experiment with settings that influence the final appearance of their photographs.

**Key capabilities:**

- Discover color recipes built around Creative Look and Picture Profile settings.
- Explore White Balance and White Balance Shift combinations.
- Understand color temperature, contrast, saturation, and tonal rendering.
- Review detailed configurations and creative references.
- Access individual, shareable recipe pages.
- Explore community contributions and real-world examples where available.

From subtle film-inspired aesthetics to bold contemporary looks, ColorLab encourages photographers to experiment and develop an individual visual style.

**No two creative visions are the same. Your colors shouldn't have to be either.**

### 02. Sony Digital Imaging Wiki

**Know your camera. Understand your tools.**

A comprehensive reference experience for exploring Sony's digital imaging ecosystem.

Browse supported Sony Alpha cameras, ZV-series cameras, Cinema Line products, and interchangeable lenses.

**Key capabilities:**

- Camera and lens product discovery.
- Detailed technical specifications.
- Dedicated, shareable product pages.
- Product categories and structured reference information.
- Side-by-side comparison of supported camera models.
- Connections between equipment knowledge and creative techniques.

The objective goes beyond displaying specifications.

We want to help creators understand what those specifications mean for actual photography and filmmaking.

**Because choosing the right gear starts with understanding what it can do.**

### 03. Sony Personal Audio

**Discover the technology behind the listening experience.**

ColorLab also explores Sony's personal audio ecosystem through a dedicated product reference.

Discover supported headphones and audio products, review technical specifications, and explore their capabilities.

By extending beyond imaging alone, the platform aims to connect different areas of Sony's creative technology ecosystem within a consistent discovery experience.

### 04. Learn — Photography Knowledge Hub

**Learn the technology. Master the craft.**

Photography becomes more rewarding when creators understand the principles behind their equipment.

The ColorLab learning experience brings together technical explanations, articles, and structured educational resources.

Explore topics such as:

- Exposure and photographic fundamentals.
- White balance and color temperature.
- Creative Look and Picture Profile concepts.
- Camera features and shooting techniques.
- Color rendering and visual aesthetics.
- Practical equipment knowledge.
- Technical terminology and reference materials.

Educational content is designed to connect concepts with real-world applications.

The platform includes dedicated learning pages, a glossary, related resources, and links between relevant knowledge and products.

### 05. Intelligent Content Discovery

**Less searching. More creating.**

ColorLab integrates search and discovery across different types of content.

Rather than navigating isolated information sources, users can explore products, recipes, articles, and learning resources through a connected experience.

The long-term vision is to make technical knowledge increasingly contextual, relevant, and actionable.

### 06. Community & Creative Inspiration

**Great creativity deserves to be shared.**

ColorLab is built around the idea that creators learn from one another.

Community capabilities include opportunities to share photographs, discuss creative recipes, contribute feedback, and exchange practical experiences.

Our ambition is to nurture an environment where technical knowledge and creative inspiration reinforce each other.

**Create something beautiful. Share what you've learned. Inspire someone else.**

---

## Why ColorLab Exists

Photography is both an art and a technology.

Modern cameras offer extraordinary possibilities, but understanding every menu, picture parameter, color setting, and technical specification can be challenging.

A photographer shouldn't need to spend hours researching fragmented information just to understand a camera feature or recreate a creative look.

ColorLab was created to bridge that gap.

### Our Core Principles

**Explore without limits.**

Encourage experimentation and discovery instead of prescribing a single correct visual style.

**Understand the technology.**

Make technical information easier to access and translate specifications into practical knowledge.

**Create with confidence.**

Help photographers make informed creative decisions and use their equipment more effectively.

**Share what matters.**

Build a knowledge-driven community where experience, inspiration, and ideas can be exchanged.

**Keep learning accessible.**

Strive to make useful creative knowledge available to people regardless of their experience level.

### Our Philosophy

> Color is not just a camera setting. It's a creative language.

Every decision involving light, contrast, tone, saturation, and color contributes to the story told through an image.

Technology should expand those creative possibilities, not make them harder to access.

**Explore. Experiment. Create. Inspire.**

---

## Technology Stack

Sony Alpha ColorLab is built using a modern full-stack web architecture.

| Layer | Technology |
|---|---|
| Application framework | Next.js 16 — App Router |
| Frontend | React 19 |
| Language | TypeScript |
| UI styling | Tailwind CSS 4 |
| Design system | Shared design tokens and reusable components |
| Database | Supabase / PostgreSQL |
| Authentication | Supabase Auth |
| Localization | next-intl |
| Schema validation | Zod |
| AI integration | Anthropic SDK |
| Testing | Vitest |
| Code quality | ESLint and TypeScript |
| Hosting | Vercel-compatible Next.js deployment |

### Architectural Approach

The platform follows a modular architecture designed to separate content, application logic, authentication, and community interactions.

Its database infrastructure uses two distinct responsibility boundaries.

**Control Plane**

Responsible for authentication, user permissions, administrative authorization, and community data.

**Content Plane**

Responsible for the color recipe library, product catalogues, published articles, and related content.

This separation provides operational isolation between community interactions and the content-management infrastructure.

Privileged operations are handled through server-side application routes, while public-facing interfaces receive only the data and configuration they require.

The application also supports a seed-backed development mode for local work and automated testing without live Supabase credentials.

For implementation and operational details, consult the repository's technical documentation.

---

## Getting Started

Want to explore the codebase, contribute to development, or run ColorLab locally?

### Prerequisites

Make sure your development environment includes:

- Git
- Node.js compatible with Next.js 16
- npm
- Supabase credentials for database-backed functionality

### 1. Clone the Repository

```bash
git clone https://github.com/thaikpham/sonyalphacolorlab.git
cd sonyalphacolorlab
```

### 2. Install Dependencies

```bash
npm ci
```

### 3. Configure Environment Variables

Copy the example configuration:

```bash
cp .env.example .env.local
```

The project uses a separated Supabase configuration for authentication and content.

Required variables for a database-backed environment are:

```env
# Authentication / Control Plane
NEXT_PUBLIC_AUTH_SUPABASE_URL=
NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY=
AUTH_SUPABASE_SECRET_KEY=

# Content Plane
NEXT_PUBLIC_CONTENT_SUPABASE_URL=
CONTENT_SUPABASE_ANON_KEY=
CONTENT_SUPABASE_SECRET_KEY=

# Optional AI integration
ANTHROPIC_API_KEY=

# Website configuration
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**Important:** The six Supabase connection variables must either be fully configured or all remain unset for seed-backed development.

Never expose server-side secret keys through `NEXT_PUBLIC_` variables or commit credentials into source control.

### 4. Start the Development Server

```bash
npm run dev
```

Open your browser and visit:

**http://localhost:3000**

### 5. Run Quality Checks

```bash
npm run lint
npm run typecheck
npm run test
```

Run the complete verification pipeline:

```bash
npm run verify
```

The verification pipeline includes linting, type checking, automated tests, and the production build.

### Available Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Validate TypeScript |
| `npm run test` | Run Vitest tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run verify` | Run the full verification pipeline |
| `npm run doctor` | Run project diagnostics |
| `npm run tokens:emit` | Generate design-token outputs |
| `npm run search:eval` | Evaluate search behavior |

The production build checks Supabase configuration and fails when the environment is only partially configured.

---

## Project Structure

```text
sonyalphacolorlab/
│
├── src/
│   ├── app/              # Pages and API routes
│   ├── components/       # Reusable UI components
│   ├── design/           # Design primitives
│   ├── i18n/             # Localization configuration
│   ├── lib/              # Domain logic and data access
│   └── test/             # Test utilities
│
├── packages/             # Shared workspace packages
├── messages/             # English and Vietnamese translations
├── data/                 # Seed datasets and references
├── public/               # Public assets
├── scripts/              # Development and maintenance scripts
├── supabase/             # Database migrations and configuration
├── docs/                 # Architecture, guides and runbooks
│
├── AGENTS.md             # Development conventions
├── CLAUDE.md             # AI-assisted development guidance
├── DESIGN.md             # Design system specification
├── .env.example          # Example environment configuration
├── package.json
└── README.md
```

## Design Philosophy

The ColorLab interface is built around a consistent, minimal visual language.

Its design system emphasizes:

- High-contrast, readable typography.
- Dark, distraction-free surfaces.
- A restrained blue-purple visual identity.
- Responsive interfaces.
- Consistent components and spacing.
- Accessibility-conscious interaction patterns.
- Thoughtful use of motion and depth.

The goal is to let photography, visual content, and useful information take center stage.

Design conventions and shared tokens are documented in `DESIGN.md` and `packages/colorlab-tokens`.

---

## Roadmap — The Future of ColorLab

### Building the Next Generation of Creative Discovery

ColorLab is an evolving project with ambitions beyond its original color recipe library.

Our broader vision is to build an interconnected ecosystem where creative inspiration, equipment knowledge, education, and community experiences naturally connect.

### Areas of Exploration

**Advanced Color Discovery**

More intuitive methods of exploring recipes, visual aesthetics, and camera color settings.

**Camera Compatibility Intelligence**

Clearer guidance on which creative settings and features are supported by different camera models and shooting modes.

**Connected Learning Experiences**

Stronger relationships between educational content, product documentation, and practical shooting workflows.

**Smarter Search**

Continued improvements to content retrieval, technical terminology recognition, and cross-category discovery.

**AI-Assisted Creative Tools**

Exploration of responsible AI-assisted experiences that help users understand technical settings and discover relevant resources.

**Community Contributions**

Better ways for photographers to contribute photographs, share knowledge, and participate in creative discussions.

**Performance & Accessibility**

Continued improvements to loading performance, mobile usability, interface accessibility, and multilingual experiences.

These are development directions rather than guaranteed releases. Priorities may change as the project and community evolve.

**The goal isn't simply to add more features. It's to make the entire creative experience more connected, intuitive, and useful.**

---

## Contributing

### Great Projects Are Built Together

ColorLab welcomes feedback, technical contributions, documentation improvements, and creative ideas.

You don't have to be a professional developer to make a difference.

There are many ways to contribute:

- Report bugs and unexpected behavior.
- Suggest improvements to the user experience.
- Help improve English or Vietnamese translations.
- Contribute reliable technical references.
- Propose educational topics or useful resources.
- Improve accessibility and performance.
- Submit code improvements or documentation updates.
- Share the platform with other creators.

### Development Contributions

1. Open an issue to discuss a significant change.
2. Fork the repository.
3. Create a focused feature branch.
4. Follow the documented development and design conventions.
5. Run relevant automated checks.
6. Submit a pull request explaining what changed and how it was tested.

For camera specifications, firmware behavior, or compatibility information, contributions should be supported by reliable documentation, preferably official Sony Help Guides.

**Every thoughtful contribution helps ColorLab become more useful to the creative community.**

[View Issues](https://github.com/thaikpham/sonyalphacolorlab/issues) · [Explore the Source Code](https://github.com/thaikpham/sonyalphacolorlab)

---

## ❤️ Support the Project

### Help Us Build Something Extraordinary.

**ColorLab is more than a website. It's an independent creative initiative with a simple ambition: make photography knowledge and creative technology more accessible to everyone.**

Building and maintaining a platform takes more than code.

It requires research, design, development, infrastructure, testing, educational content, and a constant commitment to improvement.

Your support helps make that possible.

### ☕ Fuel the Creativity

Every contribution, no matter how small, supports the continued development of ColorLab.

Community support can help fund:

| Area | Impact |
|---|---|
| Platform infrastructure | Hosting, databases, storage, and operational services |
| Feature development | Building and refining creative tools |
| Research & education | Technical research and accessible learning content |
| Community experiences | Better ways to share photographs and knowledge |
| Accessibility | Improving usability and multilingual support |
| Innovation | Experimenting with new technologies and workflows |

**If ColorLab has helped you discover a new look, understand your camera, or learn something valuable, consider supporting its development.**

[GitHub Sponsors — Thai K. Pham](https://github.com/sponsors/thaikpham)

*GitHub Sponsors contributions require the creator's sponsorship profile to be active. Until enabled, you can reach out through the social channels below to discuss support.*

### 🤝 Become a Sponsor or Partner

We welcome collaboration with individuals and organizations that believe in accessible creative education and technology.

Potential partnership opportunities include:

- Photography education and workshops.
- Creative community initiatives.
- Educational content sponsorship.
- Technology research and technical references.
- Creator-focused tools and resources.
- Community collaborations and events.
- Long-term platform development sponsorship.

Sponsorships are intended to support the project while preserving its independent direction and editorial integrity.

**Interested in supporting or collaborating with ColorLab?**

[Contact via Facebook](https://www.facebook.com/thaikpham.art) · [Connect on Instagram](https://www.instagram.com/thaikpham)

### 🚀 Can't Donate? You Can Still Make a Difference.

Financial contributions are only one way to support ColorLab.

You can help the project grow by:

- **Starring the GitHub repository** to help other developers discover it.
- **Sharing ColorLab** with photographers, filmmakers, and friends.
- **Contributing ideas** that make the platform more useful.
- **Reporting issues** to improve reliability.
- **Sharing creative experiences** that inspire others.

Every star, every share, and every contribution matters.

**Help us bring creative knowledge to more photographers around the world.**

[⭐ Star the Repository](https://github.com/thaikpham/sonyalphacolorlab) · [🌐 Share ColorLab](https://sonycolorlab.app)

---

## A Note to the Creative Community

Photography has always been about more than equipment.

It's about how we see the world, how we interpret light, and how we express ideas that words alone cannot capture.

Technology gives us incredible tools, but creativity gives those tools meaning.

ColorLab was born from a belief that technical knowledge should never be a barrier to creative expression.

Whether you're discovering your first color recipe, experimenting with a new camera, or sharing something you've learned, you're part of what makes this project meaningful.

**Let's make photography more accessible, more expressive, and more inspiring — together.**

---

## About the Creator

### Thai K. Pham

**Creator & Independent Developer — Sony Alpha ColorLab**

A photography and imaging technology enthusiast with a passion for visual storytelling, color science, creative education, and building useful digital experiences.

With a background in photography and experience working with digital imaging technology, Thai K. Pham created Sony Alpha ColorLab to connect technical understanding with creative experimentation.

The project reflects a personal belief:

**The best technology doesn't replace creativity. It gives people more freedom to express it.**

Sony Alpha ColorLab is an independently developed personal project.

### Connect

🌐 **Website:** [sonycolorlab.app](https://sonycolorlab.app)

💻 **GitHub:** [github.com/thaikpham](https://github.com/thaikpham)

📘 **Facebook:** [facebook.com/thaikpham.art](https://www.facebook.com/thaikpham.art)

📸 **Instagram:** [instagram.com/thaikpham](https://www.instagram.com/thaikpham)

---

## Disclaimer

**Sony Alpha ColorLab is an independent project and is not affiliated with, endorsed by, or sponsored by Sony Group Corporation, Sony Electronics, or their subsidiaries.**

Sony, Sony Alpha, and other related product names and trademarks are the property of their respective owners.

All product specifications and technical information are provided for educational and reference purposes.

Camera functions, settings, and compatibility may vary by model, region, shooting mode, or firmware version.

Users should consult official Sony documentation for authoritative product information and operating instructions.

Creative color recipes are starting points for experimentation. Actual results may vary depending on lighting, exposure, camera processing, and display characteristics.

References to third-party technologies or brands do not imply endorsement.

---

## Let's Create Something Remarkable.

**Sony Alpha ColorLab is built on curiosity, powered by creativity, and shaped by the people who believe photography should be an open journey of discovery.**

If you believe in this vision, help us grow.

**Explore the platform. Share the knowledge. Support the project. Inspire the community.**

[🌐 Explore ColorLab](https://sonycolorlab.app) · [⭐ Star on GitHub](https://github.com/thaikpham/sonyalphacolorlab) · [❤️ Support Development](https://github.com/sponsors/thaikpham)

---

**Made with ❤️ for the creative community.**

**Created by [Thai K. Pham](https://github.com/thaikpham)**

*Your Color. Your Camera. Your Creative Universe.*

**Explore. Experiment. Create. Inspire.**
