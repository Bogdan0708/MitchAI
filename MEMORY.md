# MEMORY.md - Long-Term Memory

## The Empire

### Mitch from Transylvania
Romanian street food with theatrical Dracula branding. First-mover in the London market.

**Founder:** Vasile Bogdan Godja (Bogdan)
- 15+ years hospitality experience (UK luxury hotels/restaurants)
- Restaurant manager at Oren Hampstead
- Technical Lead at Ticino Luxury Service (Switzerland)
- Tech-native entrepreneur
- Working full-time since Commercial Street closed (Aug 2025)
- Schedule: Finishes 5pm Mon, OFF Tue-Wed, starts 13:30 Thu

**Previous Location:** 82A Commercial Street, E1 — **CLOSED** (August 2025)
- £3k/month for 3x2m space was unsustainable
- Daily marquee setup/teardown was impractical
- Had 5-star reviews on Google and delivery platforms

**Camden Application:** Waiting for council approval (not confirmed yet)
- Also considering other Camden opportunities
- Looking for a **closable unit** or **dark kitchen**

**Current Search:**
- Dark kitchen anywhere in London (must fit grill concept)
- Target: 3 nights/week (Mon-Wed evenings)
- Bogdan lives in NW11 area

**Menu Highlights:**
- Mici (Romanian skinless sausages)
- Shashlik (charcoal-grilled skewers)
- Homemade sausages, marinated cuts
- Hand-cut chips, homemade sauces
- Vegan/vegetarian options available

**Brand USP:**
- Immersive Dracula theming
- Instagrammable presentation
- Sous-vide + grill technique
- Sustainable/compostable packaging

### Tech Stack — Mitch AI Suite Ecosystem

1. **SaaS Infrastructure** (`/home/godja/hospitality-saas`)
   - Digital ordering, automated inventory, integrated POS
   - The backbone of operations

2. **Mitch Coin** (`C:\Dev\blockchain\mitch-coin`)
   - Crypto token for the ecosystem
   - TBD: loyalty, payments, tokenomics

3. **Physical Operations** (on hold, pivoting)
   - Looking for dark kitchen: 3 nights/week (Mon-Wed)
   - Or closable unit anywhere in London
   - Must accommodate grill concept

4. **Investor Route**
   - Pursuing investors for SaaS/software side
   - Running parallel to dark kitchen search

---

## Bogdan's Hardware

**HP ZBook G1A**
- AMD Strix Halo 395+ Max
- 128GB unified RAM
- Up to 96GB VRAM
- Can run GPT-OSS 120B at 30-40 tokens/sec
- NPU available (currently only Adobe apps use it)

---

## Technical Notes

### Local AI Setup
**LM Studio:**
- GPT models perform better (optimized for machine or LM Studio)
- Bigger models: load one at a time
- Smaller models: can batch together
- Reachable at http://192.168.1.102:1234

**Ollama (Windows):**
- Listening on port 11434
- Pulled models: llama3.1:8b, qwen3:8b, deepseek-r1:8b
- Also has: nomic-embed-text, qwen3-coder:30b, whisper

**Cloud APIs Configured (Jan 28):**
- Perplexity (Sonar Pro) ✅
- OpenAI (GPT-4) ✅
- Google Gemini ✅
- Groq (Llama 3.3 70B) ✅

### Tech Stack
- WSL/Docker
- n8n workflows
- MCP servers
- LM Studio + Ollama for local AI

---

## Key Contacts

**Business:**
- Email: vbgsolutionlimited@gmail.com
- Mobile: +44 7471 060258
- Website: mitch-from-transylvania.square.site
- Instagram: @mitchfromtransylvania

---

## Session History

### 2026-01-27
- First boot! Named myself Grumpy 😏
- Did full audit of Bogdan's machine and projects
- Discussed hospitality-saas deployment cost breakdown
- Set up multi-model parallel AI testing
- Tested Ollama and LM Studio integrations

### 2026-01-28
- Added API keys: Perplexity, OpenAI, Gemini, Groq
- Tested Groq and Perplexity sub-agents
- Pulled more Ollama models
- Context recovery from session transcripts

---

*Last updated: 2026-01-28*
