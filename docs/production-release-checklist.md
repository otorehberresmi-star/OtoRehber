# Production Release Checklist

## Environment

Public production values are pinned in `eas.json`:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_EAS_PROJECT_ID`

Sentry values must be configured in EAS before the store build:

```bash
eas env:create --environment production --name EXPO_PUBLIC_SENTRY_DSN --value "https://..."
eas env:create --environment production --name SENTRY_ORG --value "your-sentry-org"
eas env:create --environment production --name SENTRY_PROJECT --value "your-sentry-project"
eas env:create --environment production --name SENTRY_AUTH_TOKEN --value "sntrys_..." --visibility secret
```

The production build runs `scripts/verify-production-env.js` through
`eas-build-pre-install`. If any required value is missing, the build fails before
native compilation starts.

## Final Checks

Run locally before release:

```bash
npm run env:check
npx tsc --noEmit
npm test
npm audit --omit=dev
```

Expected audit status before the current store release: no critical or high
severity issues. Moderate Expo/React Native advisory fixes require a major Expo
SDK upgrade and should be handled in a separate upgrade cycle.

## Expo SDK Upgrade Decision

Do not run `npm audit fix --force` on the store-release branch. The current
moderate audit advisories are in the Expo/React Native dependency chain, and
npm's forced fix path upgrades to a newer major Expo SDK / React Native line.

Release plan:

1. Ship the current SDK 54 line after internal production build testing.
2. Create a separate upgrade branch for Expo SDK 56.
3. Re-test native push, Sentry, image picker, auth redirects, router navigation,
   biometric security, and EAS production builds on that branch.
4. Merge the SDK upgrade only after parity testing passes on real iOS and
   Android devices.
