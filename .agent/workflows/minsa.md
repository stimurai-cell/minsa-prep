---
description: "Master project principles and architectural rules for MINSA Prep"
---

This workflow serves as the 'Central Skill' for the project. When starting any new feature or refactor, read this to maintain consistency.

### 1. Vision & Architecture (from the original manifest)
- **Objective**: Lightweight, 3G-optimized educational platform for Angola.
- **Stack**: React, Supabase (Auth/DB), Vercel, Gemini (Admin Gen).
- **Core Principle**: Extreme performance and simplicity for 3G mobile connections. No heavy animations or libraries.

### 2. Engineering Standards ('The Skills')
- **Database (RLS)**: Always verify `admin` role policies for `INSERT/UPDATE/DELETE`. See [instructions.md](file:///c:/MINSA%20Prep/.agent/instructions.md).
- **Icons**: Always alias `lucide-react` icons (e.g., `Megaphone as MegaphoneIcon`).
- **UI Architecture**:
  - Consistent tab mapping between `Layout.tsx` and `Admin.tsx`.
  - Use `rounded-[2rem]` for containers, `rounded-xl` for items.
  - Gradients for premium feel (vibrant, not flat).
- **Data Flow**: Use a 800ms delay after DB writes before refreshing stats to avoid stale data.

### 3. Roles & Permissions
- Free: 10 questions/day, 1 simulation/week.
- Premium: Unlimited.
- Admin: Full content management access.

### 4. Support & Maintenance
- Simple code, modular components.
- Single-developer maintenance focus.
