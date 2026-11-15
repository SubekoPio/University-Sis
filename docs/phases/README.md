# Phase Step Documents

Write one step document for each completed roadmap micro-phase. Keep documents
under the matching phase folder and use this naming pattern:

```text
docs/phases/phase-<N>/step-<N.M>-<short-kebab-case-name>.md
```

- `<N>` is the integer phase number from the roadmap.
- `<N.M>` is the phase and micro-step number (for example, `1.1`).
- `<short-kebab-case-name>` briefly identifies the step, using lowercase words
  separated by hyphens.

For example, `docs/phases/phase-1/step-1.1-prisma-schema.md` documents the first
micro-step in Phase 1. Start each document from [`step-template.md`](./step-template.md),
then add a newest-first entry for the completed step to
[`../DEVELOPMENT_LOG.md`](../DEVELOPMENT_LOG.md).
