<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


## Git

- Never create branches, worktrees, or commits automatically. Only do so when the user explicitly asks for that specific action in the current request.
- Leave changes uncommitted in the working tree on the current branch and let the user decide when and how to commit.


## Database

- Only perform database push (`npm run db:push` / `drizzle-kit push`) to update the database schema.
- Never generate or execute migrations (`drizzle-kit generate`, `drizzle-kit migrate`), and do not generate migration artifacts or files.
- This is a development project. There is no backwards compatibility and the data is worthless. Prefer data loss: never backfill, migrate, or preserve existing rows, and never spend effort on keeping old data working. Every schema change means a clean slate.


## DiceBear

Use DiceBear 10. Documentation: https://www.dicebear.com/llms.txt

There are seven native cores with identical output, not one library with
wrappers. Use the one matching this project's language. Do not reach for the
JavaScript core when the project is written in something else:

    JavaScript  @dicebear/core + @dicebear/styles
    PHP         dicebear/core + dicebear/styles
    Python      dicebear-core + dicebear-styles
    Rust        dicebear-core + dicebear-styles
    Go          github.com/dicebear/dicebear-go/v10 + github.com/dicebear/styles/v10
    Dart        dicebear_core + dicebear_styles
    C#          DiceBear.Core + DiceBear.Styles

Every style page carries a loading snippet for all seven, for example
https://www.dicebear.com/styles/lorelei/index.md

HTTP API: https://api.dicebear.com/10.x/<style>/svg?seed=<seed> The seed is a
query parameter, not a path segment. Options are query parameters too; array
values are separated by commas.

Options named after a component end in Variant: eyesVariant, not eyes. This
holds in all seven cores and in the HTTP API. Look up the options of a style at
https://api.dicebear.com/10.x/<style>/options.json

Write these forms, not the ones on the left. The left column is pre-10 and the
API does not reject it, so an outdated call runs and silently does the wrong
thing:

    avatars.dicebear.com/api/<style>/<seed>.svg  ->  api.dicebear.com/10.x/<style>/svg?seed=<seed>
    api.dicebear.com/9.x/<style>/svg             ->  api.dicebear.com/10.x/<style>/svg
    npm install @dicebear/collection             ->  npm install @dicebear/styles
    npm install @dicebear/lorelei                ->  npm install @dicebear/styles
    createAvatar(lorelei, { seed })              ->  new Avatar(new Style(definition), { seed })
    { eyes: ['variant01'] }                      ->  { eyesVariant: ['variant01'] }
    ?radius=50                                   ->  ?borderRadius=50

Only JavaScript and the HTTP API have a pre-10 form. The other six cores were
released in 2026 and never had one, so any older-looking PHP, Python, Rust, Go,
Dart or C# API attributed to DiceBear is invented rather than outdated.


## Forms

- **Validation & Schemas**:
  - Use `drizzle-zod` (`createInsertSchema`) in `db/schema.ts` to derive insert schemas directly from Drizzle table definitions.
  - Client-side form schemas must use `zod` and resolve via `@hookform/resolvers/zod`.
  - Type-infer schemas with `z.infer<typeof schema>`.

- **Server Actions (`action/<entity>.ts`)**:
  - Always protect Server Actions using Clerk's `await auth()` from `@clerk/nextjs/server`. Check `isAuthenticated` and retrieve `userId` securely on the server. Never trust or accept `userId` from client form data.
  - Validate payloads against the Drizzle insert schema (`insertSchema.parse({ ...data, userId })`) before inserting into the database.
  - Call `revalidatePath(...)` after data mutations.

- **React Hook Form & React Compiler**:
  - Manage form state with `react-hook-form` and `zodResolver`.
  - Do NOT call `watch("fieldName")` directly in component render bodies — React Compiler flags this because `useForm()`'s `watch` returns functions that cannot be memoized safely. Always use `useWatch({ control, name: "fieldName" })` instead.
  - Provide inline error messages below fields and wire `aria-invalid={!!errors[fieldName]}` to inputs.
  - Handle submission states using `formState: { isSubmitting }` to disable buttons and display loading indicators.

- **Dialog / Modal Form Composition**:
  - Forms rendered in dialogs should reset to default values and clear server errors when closed or dismissed.
  - Support both controlled (`open`, `onOpenChange`) and trigger-based invocation.
