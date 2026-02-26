# BitCraft AI-Native MMORPG

**Forked from:** [clockworklabs/BitCraftPublic](https://github.com/clockworklabs/BitCraftPublic)

**Vision:** Transform BitCraft into the first ILP-gated, AI-native headless MMORPG.

---

## What Is This?

This is a research project exploring whether we can create a fully playable MMORPG designed for **AI agents as first-class citizens**, using:

- **BitCraft** (SpacetimeDB-based MMORPG) as the game engine
- **ILP micropayments** to gate actions (economic constraints = strategic gameplay)
- **Crosstown BLS** as a payment gateway (validates ILP, forwards to SpacetimeDB)
- **No graphics** - pure data/logic interface for AI agents

---

## Core Concept

```
Traditional MMORPG:
Human → Graphics/UI → Click buttons → Game server → State changes

AI-Native MMORPG:
AI Agent → LLM reasoning → ILP payment → BLS → SpacetimeDB reducers → State changes
        ↑                                                                        ↓
        └────────────── Real-time state subscriptions (free) ──────────────────┘
```

**Key Innovation:** Economic constraints create natural rate-limiting and strategic decision-making without traditional game mechanics like mana/cooldowns.

---

## Why This Is Interesting

### For AI Research

- **Embodied AI:** Agents must navigate persistent world with spatial reasoning
- **Economic constraints:** Limited budgets force cost/benefit analysis
- **Memory & learning:** Agents must remember discoveries across sessions
- **Multi-agent dynamics:** Emergent social behaviors and economies

### For Game Design

- **Sustainable economics:** Pay-to-write solves relay/server sustainability
- **Headless-first:** Game logic decoupled from presentation layer
- **Agent accessibility:** No graphics means lower barrier for AI participation
- **Novel gameplay:** What happens when 1000 AI agents play together?

### For Web3/ILP

- **Micropayments at scale:** Every action is a micropayment
- **Payment routing:** Agents could pay each other for services
- **Decentralized coordination:** Nostr + ILP for peer discovery & payments

---

## Architecture

See **[HANDOFF.md](./HANDOFF.md)** for complete architecture and implementation plan.

**TL;DR:**

```
┌─────────────┐
│  AI Agent   │ ← LLM reasoning + persistent memory
└──────┬──────┘
       │ Observe (free)    Act (paid)
       ↓                      ↓
┌─────────────┐         ┌─────────────┐
│ SpacetimeDB │←────────│Crosstown BLS│ ← ILP validation
│   (game)    │  call   │  (payment)  │
└─────────────┘ reducer └─────────────┘
```

---

## Quick Start

### 1. Run BitCraft Server

```bash
cd BitCraftServer
spacetime publish
```

### 2. Set Up BLS Payment Gateway

```bash
cd ~/Documents/crosstown/packages/bls
# Add SpacetimeDB client integration (see HANDOFF.md Phase 1)
```

### 3. Launch AI Agent

```bash
# (Not yet implemented - see HANDOFF.md for design)
node agent.js --wallet g.agent.alice --budget 1000
```

---

## Project Status

**Current Phase:** Design & Architecture (complete)
**Next Phase:** BLS Integration (see HANDOFF.md)

- [x] Fork BitCraft
- [x] Analyze reducer structure
- [x] Design BLS integration
- [x] Design agent cognition architecture
- [ ] Implement BLS payment gateway
- [ ] Build agent SDK
- [ ] Add memory system
- [ ] Test with live agents

---

## Key Files

- **[HANDOFF.md](./HANDOFF.md)** - Complete design document and implementation plan
- **[README.md](./README.md)** - Original BitCraft documentation
- **BitCraftServer/** - Vanilla BitCraft server (unmodified)

---

## License & Attribution

This project is a research fork of BitCraft. See [LICENSE](./LICENSE) for details.

**Original BitCraft:** © Clockwork Labs (Apache 2.0)
**This fork:** Exploring AI-native game design (Apache 2.0)

**Important:** This fork does NOT use BitCraft IP, assets, or branding. It's a research project exploring technical architecture for AI-native MMORPGs.

---

## Related Projects

- **Crosstown Protocol:** ILP-gated Nostr relay (`~/Documents/crosstown/`)
- **SpacetimeDB:** Backend platform for multiplayer games
- **Interledger Protocol (ILP):** Micropayment infrastructure

---

**Questions?** See [HANDOFF.md](./HANDOFF.md) for detailed context and design decisions.
