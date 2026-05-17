# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in Terse — whether in this repository, in our published npm packages (`terse-cli`, `terse-sdk`, `terse-types`), or in the hosted product at [useterse.ai](https://useterse.ai) — please email **[security@useterse.ai](mailto:security@useterse.ai)** with the details.

Please **do not** open a public GitHub issue, discussion, or pull request for security-sensitive reports.

Useful things to include if you can:

- A description of the issue and the impact you observed
- Steps to reproduce (a minimal proof-of-concept is ideal)
- The affected version, commit, or URL
- Any logs, screenshots, or HTTP traces that help
- How you would like to be credited in the public disclosure (or whether you'd prefer to stay anonymous)

## What to expect

- We aim to acknowledge new reports within **3 business days**.
- We'll keep you updated as we triage, reproduce, and work on a fix.
- Once a fix has shipped, we'll coordinate a public disclosure with you and credit you in the release notes if you'd like.

## Scope

In scope:

- Code in this repository (backend, frontend, CLI, SDK, types, Probot app, docs site)
- The published npm packages listed above
- The hosted product at `app.useterse.ai` and supporting infrastructure

Out of scope:

- Issues that require physical access to a user's device
- Social-engineering attacks against Terse staff or users
- Findings against third-party services we integrate with (please report those to the vendor directly)
- Best-practice recommendations without a demonstrable security impact (we still appreciate them — open a regular issue or email us)

## Safe harbor

We won't pursue legal action against good-faith security researchers who:

- Make a reasonable effort to avoid privacy violations, data destruction, and service disruption
- Only access data that belongs to their own account or test accounts they control
- Give us a reasonable window to fix the issue before any public disclosure

Thank you for helping keep Terse and our users safe.
