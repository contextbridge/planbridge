# Security Policy

PlanBridge is open source, and we take security reports seriously. If you find a vulnerability, please report it privately so we can investigate and ship a fix before details become public.

## How to report

You have two private channels. Either is fine; pick whichever you prefer.

1. **GitHub Private Vulnerability Reporting** (preferred): [open a report](https://github.com/contextbridge/planbridge/security/advisories/new). This routes through GitHub's coordinated disclosure workflow and keeps the conversation tied to the repo.
2. **Email**: send details to [security@contextbridge.ai](mailto:security@contextbridge.ai).

**Please do not** file a public GitHub issue, post in Slack, or share details on social media until we have investigated and responded.

When reporting, include:

- A description of the vulnerability and its impact.
- Steps to reproduce, ideally with a minimal test case.
- The output of `contextbridge --version` (if the CLI is affected).
- Any patches or workarounds you have already identified.

## What to expect

- We aim to acknowledge new reports within **3 business days**.
- We will work with you to confirm the report, assess severity, and agree on a disclosure timeline based on the issue. There is no fixed deadline; we coordinate based on impact and complexity.
- Once a fix is available, we will credit you in the release notes and the security advisory unless you prefer to stay anonymous.

## Supported versions

PlanBridge is pre-1.0 and ships from `main`. We patch security issues against the latest released version. If you are on an older release, please upgrade before reporting and confirm the issue still reproduces.
