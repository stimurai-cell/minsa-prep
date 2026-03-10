---
description: "Workflow to verify and prevent regressions in Admin tasks"
---

Follow these steps before completing any Admin panel task:

1. **Check Icon Naming**: Verify that icons imported from `lucide-react` (like `Megaphone` or `Layout`) are aliased to `...Icon` to prevent shadowing.
2. **Verify RLS Policies**: If the task involved database writes, ensure there's an explicit RLS policy for the `admin` role in Supabase.
3. **Check Tab Mapping**: Ensure sidebar links in `Layout.tsx` and sub-nav in `Admin.tsx` match perfectly.
4. **Data Handling**: Verify that `fetch` calls are delayed by ~800ms after a write to account for DB propagation.
5. **Linting**: Ensure no `ReferenceError` exists for shadowed variable names.
