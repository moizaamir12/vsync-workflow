# CLAUDE.md - Project Guidelines for vsync

## TypeScript
- Strict mode everywhere — no `any`, no `@ts-ignore`
- All imports use `@vsync/` aliases (e.g., `import { Thing } from "@vsync/shared-types"`)

## Code Style
- Comments explain WHY, not WHAT
- Naming: camelCase for variables/functions, PascalCase for types/classes/interfaces, kebab-case for file names

## Testing
- Never mock in tests — use `throw new Error("Not implemented")` instead
- Run `pnpm build` before `pnpm test`

## Block Properties
- All block properties must be prefixed: `<block_type>_<property>` (e.g., `text_content`, `image_src`)

## API Responses
- All API responses follow the shape: `{ data, error, meta }`

## Build
- Use `pnpm build` to build all packages via Turborepo
- Use `pnpm dev` for development mode
- Use `pnpm typecheck` to verify types across the monorepo
