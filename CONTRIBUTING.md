# Contributing to Homelab Builder

First, thanks for taking the time to contribute!

## Development Setup

1. Clone the repository
2. Set up the environment variables (`cp .env.example .env`)
3. Spin up the development environment using Docker:
   ```bash
   docker compose up -d
   ```

## Pull Request Process

We strictly follow a "One PR = One Feature/Fix" philosophy to keep reviews fast and code stable.

1. Ensure any install or build dependencies are removed before the end of the layer when doing a build.
2. Update the README.md with details of changes to the interface, if applicable.
3. Your PR must pass all GitHub Action CI tests before it can be merged.
4. If you have modified backend backend service logic, you MUST write an accompanying test in `*_test.go`.

## Code of Conduct

Help us keep Homelab Builder open and inclusive. Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).
