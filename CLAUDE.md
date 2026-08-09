# BCBA Workspace — Claude Instructions

@DEVELOPMENT_DIRECTION.md

Before any implementation task:

1. Read and follow `DEVELOPMENT_DIRECTION.md`.
2. Run `git status`.
3. Run `git pull origin main`.
4. Confirm the current working tree and commit before editing.
5. Inspect the existing implementation before creating new architecture.

Work in the existing local `bcba-workspace-ai-studio` clone.

GitHub `main` is the shared remote source of truth.

Do not work in the older `bcba-workspace` project unless explicitly requested.

Do not automatically start another feature after completing the requested slice.

Preserve existing clinical architecture and shared utilities unless the requested task explicitly requires changing them.

Never commit credentials, tokens, secrets, `.env` contents, or authenticated Git URLs.
