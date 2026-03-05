# Contributing to HLBuilder

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

Help us keep HLBuilder open and inclusive. Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

### Additional Terms (pursuant to section 7)

You must retain the following attribution notice in all copies or substantial portions of the Software:

"Original creator: Butterski. Author homepage: https://mkuch.pl"

If you modify the Software, you must ensure that the attribution notice remains intact and visible.

By contributing code to this project, you agree that your contributions will be licensed under the same license as the project (AGPL-3.0 with additional attribution terms). You also grant the project maintainer the right to use your contributions in the official hosted version of the project, as well as any future versions under the same or a compatible license.
