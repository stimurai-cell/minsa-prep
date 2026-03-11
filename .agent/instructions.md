# MINSA Prep - Project Rules & Engineering Guidelines

This document contains critical rules to prevent regressions and "basic" bugs. All agents working on this project must follow these guidelines.

## 1. Supabase & RLS (Row-Level Security)
- **Problem**: New tables or actions often fail for Admins because RLS only allows `SELECT` by default.
- **Rule**: Every time you implement a feature that writes to the database (`INSERT`, `UPDATE`, `DELETE`), verify that an explicit RLS policy exists for the `admin` role.
- **Verification**: Check `is_current_user_admin()` function usage in policies.

## 2. Icon Naming (Lucide-React)
- **Problem**: Icons like `Megaphone` or `Layout` can conflict with component names or internal state variables, causing `ReferenceError`.
- **Rule**: Always import icons using an alias to avoid shadowing.
  - *Correct*: `import { Megaphone as MegaphoneIcon } from 'lucide-react';`
  - *Incorrect*: `import { Megaphone } from 'lucide-react';`

## 3. Admin UI & Navigation
- **Problem**: The sidebar and the internal `Admin.tsx` tabs can get out of sync.
- **Rule**:
  - Maintain a 1:1 mapping between sidebar links in `Layout.tsx` and the `activeTab` state in `Admin.tsx`.
  - **Tab Structure**:
    - `dashboard`: General stats.
    - `payments`: Approval/Rejection.
    - `users`: Dedicated user management list.
    - `content`: AI generation and catalog.
    - `support`: Tickets.
    - `social`: News and alerts.
    - `backup`: System data.
    - `profile`: Admin settings.

## 4. UI State & Race Conditions
- **Problem**: Submitting a change (like approving a payment) and instantly fetching data can return stale results due to database propagation delay.
- **Rule**: Add a small delay (approx. 800ms) after a successful write and before calling `fetch` functions to ensure the UI reflects the latest state.
- **Buttons**: Always disable action buttons (`disabled={loading}`) to prevent double-submissions.

## 5. Design Aesthetics
- **Core Strategy**: Vibrant, premium, glassmorphism.
- **Rules**:
  - Avoid simple `slate-500` or `emerald-600` on their own. Use gradients: `bg-[linear-gradient(135deg,#ffffff_0%,#f2f7ff_40%,#f4fbf7_100%)]`.
  - Use `rounded-[2rem]` for main containers and `rounded-xl` for inner elements.
  - Always add micro-animations: `animate-in fade-in duration-500`.

## 6. Language & Communication
- **Portuguese Only**: Always use Portuguese for everything. This includes:
  - Communications with the USER.
  - Code comments and documentation.
  - Console logs and error messages.
  - Artifacts (`task.md`, `implementation_plan.md`, `walkthrough.md`).
- **Updates**: When finishing a task, always update `task.md` and provide a `walkthrough.md` with file links.
