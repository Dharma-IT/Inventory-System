# React + TypeScript + Vite

## Supabase setup

The inventory UI persists products and stock movements in Supabase. Before the
first run, open the project's Supabase SQL Editor and run
[`supabase-schema.sql`](./supabase-schema.sql). This creates the tables, browser
policies, and the atomic `record_movement` function used by receipts and sales.

## Sign-in and access

The app uses native Supabase email/password authentication with persistent sessions,
automatic token refresh, and sign-out. Inventory is mounted only after sign-in;
database and order requests carry the user's access token.

1. Run `supabase-schema.sql` in Supabase SQL Editor, including for an existing
   installation. It replaces anonymous inventory policies with authenticated
   policies and restricts the stock movement function to signed-in users.
2. Enable Email under Authentication ? Sign In / Providers. Create team accounts
   under Authentication ? Users ? Add user (existing accounts work).
3. Disable public sign-ups in Supabase for this internal workspace. All authenticated
   accounts in this project can read and update shared inventory and retrieve orders.
4. Configure `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` on the API server,
   using the same project as the frontend. Restart/redeploy both services.

Copy `.env.example` to `.env.local` and set the project URL and publishable key.
The secret key is server-only and is never included in the browser bundle.

```sh
npm install
npm run dev
```

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
