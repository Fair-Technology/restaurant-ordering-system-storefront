# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Where the product spec is

The Restaurant Ordering System is one product across several repositories, and almost every rule that
matters — how money is represented, how orders move, who may see what — cuts
across all of them. Keeping one copy of the spec is what stops several copies
drifting apart.

The spec is shared and lives in the **rs-backend** repo:

- in a checkout with the standard layout: `rs-backend/docs/spec.md` (sibling checkout)
- on GitHub: https://github.com/Fair-Technology/restaurant-ordering-system-backend/blob/main/docs/spec.md

Don't restate product rules here — a frontend only hides controls a user cannot
use; the rules are enforced in the backend. If you learn something new about how
the product behaves, edit the spec, not this file.
