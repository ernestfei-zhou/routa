---
title: Developer Guide Overview
---

# Developer Guide

This section is for contributors, operators, and advanced users who need to understand how
Routa is structured, how it is developed, and which repository rules matter before making
changes.

## Start Here

<div className="routa-doc-map">
  <a href="/routa/developer-guide/project-structure">
    <strong>Project Structure</strong>
    Learn how the web app, desktop shell, Rust services, and documentation are organized in
    the repository.
  </a>
  <a href="/routa/ARCHITECTURE">
    <strong>Architecture</strong>
    Read the canonical system boundaries, runtime topology, and dual-backend invariants.
  </a>
  <a href="/routa/coding-style">
    <strong>Code Style</strong>
    Review naming, file-organization, frontend, Rust, and testing conventions before editing
    code.
  </a>
  <a href="/routa/developer-guide/testing">
    <strong>Testing</strong>
    Understand the `entrix` validation flow, fitness tiers, and what should run before review
    or merge.
  </a>
  <a href="/routa/developer-guide/git-workflow">
    <strong>Git Workflow</strong>
    Follow the repository's baby-step commit model, issue-first discipline, and PR
    expectations.
  </a>
  <a href="/routa/developer-guide/contributing">
    <strong>Contributing</strong>
    Use the local setup, branch hygiene, and PR checklist when you are preparing a change.
  </a>
</div>

## Product Surfaces

Routa exposes the same core domain model across multiple runtime surfaces:

- [Use Routa](/use-routa) for `Session`, `Kanban`, and `Team`
- [Platforms](/platforms) for `Desktop`, `CLI`, and `Web`
- [Administration](/administration) for self-hosting, deployment, and release-oriented work
- [Configuration](/configuration) for providers, models, and environment variables

## Recommended Reading Order

1. Read [Project Structure](/developer-guide/project-structure).
2. Read [Architecture](/ARCHITECTURE) for the cross-backend model.
3. Read [Code Style](/coding-style) before touching source.
4. Read [Testing](/developer-guide/testing) before validating changes.
5. Read [Git Workflow](/developer-guide/git-workflow) and [Contributing](/developer-guide/contributing) before opening a PR.
