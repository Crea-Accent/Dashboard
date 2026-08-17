# Changesets

This folder contains the configuration and future changesets for this project.

## How to use

1. When you make a change that warrants a version bump, run:
   ```bash
   pnpm changeset
   ```
2. Follow the prompts to select the version bump type (major/minor/patch) and provide a changelog message.
3. This will create a markdown file in this folder. Commit it along with your changes.
4. When you are ready to release, run:
   ```bash
   pnpm changeset version
   ```
5. This will bump the package versions and update the CHANGELOG.md file. Commit these changes.
