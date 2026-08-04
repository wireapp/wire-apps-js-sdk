# Release

This package is published to npm through GitHub Actions using npm trusted publishing.
The workflow does not use an `NPM_TOKEN`; npm authenticates the publish through OIDC.

## Prerequisites

Configure the trusted publisher on npmjs.com for `@wireapp/wire-apps-js-sdk`:

- Publisher: GitHub Actions
- Organization or user: `wireapp`
- Repository: `wire-apps-js-sdk`
- Workflow filename: `publish.yml`
- Allowed action: `npm publish`
- Environment name: leave empty unless the GitHub workflow is changed to use a matching environment

The workflow filename must match exactly and must exist in `.github/workflows/`.

## Pre-release Check

Before publishing a GitHub Release, run:

```shell
npm run release:check
```

This runs linting, the SDK build, the sample build, the typechecked coverage test suite,
the packed install smoke test, and a dry-run npm pack.

## Publish

1. Verify `package.json` has the intended version.
2. Create a GitHub Release for the version tag.
3. Publish the GitHub Release.

Publishing the GitHub Release triggers `.github/workflows/publish.yml`.
The workflow publishes the package to npm with public access and the `latest` dist-tag.

## After the First Trusted Publish

After confirming trusted publishing works:

1. In the npm package settings, require 2FA and disallow token-based publishing.
2. Revoke obsolete npm automation tokens.
3. Keep the trusted publisher configuration limited to `.github/workflows/publish.yml`.

Trusted publishing continues to work after token-based publishing is disabled because it uses OIDC.
