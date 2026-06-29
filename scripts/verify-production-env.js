const fs = require("fs");
const path = require("path");

const readDotEnv = (filePath) => {
  if (!fs.existsSync(filePath)) return {};

  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce((values, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return values;

      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) return values;

      const [, key, rawValue] = match;
      values[key] = rawValue
        .trim()
        .replace(/^['"]|['"]$/g, "");
      return values;
    }, {});
};

const readEasEnv = (profile) => {
  const easPath = path.join(process.cwd(), "eas.json");
  if (!fs.existsSync(easPath)) return {};

  try {
    const eas = JSON.parse(fs.readFileSync(easPath, "utf8"));
    return eas?.build?.[profile]?.env || {};
  } catch (error) {
    console.warn(`eas.json okunamadı: ${error.message}`);
    return {};
  }
};

const requiredPublicEnv = [
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "EXPO_PUBLIC_EAS_PROJECT_ID",
];

const recommendedProductionEnv = [
  "EXPO_PUBLIC_SENTRY_DSN",
  "SENTRY_AUTH_TOKEN",
  "SENTRY_ORG",
  "SENTRY_PROJECT",
];

const isProductionBuild =
  process.env.EAS_BUILD_PROFILE === "production" ||
  process.env.APP_ENV === "production" ||
  process.argv.includes("--production");

const easProfile =
  process.env.EAS_BUILD_PROFILE || (isProductionBuild ? "production" : "development");
const fileEnv = {
  ...readDotEnv(path.join(process.cwd(), ".env")),
  ...readEasEnv(easProfile),
};

const envValue = (key) => process.env[key] || fileEnv[key];

const missing = requiredPublicEnv.filter(
  (key) => !envValue(key) || envValue(key)?.includes("your-"),
);
const missingRecommended = isProductionBuild
  ? recommendedProductionEnv.filter(
      (key) => !envValue(key) || envValue(key)?.includes("your-"),
    )
  : [];

if (missing.length > 0) {
  console.error(
    [
      "Production environment check failed.",
      `Missing: ${missing.join(", ")}`,
      "",
      "Set public values in eas.json or EAS env, and keep SENTRY_AUTH_TOKEN as an EAS secret.",
    ].join("\n"),
  );
  process.exit(1);
}

if (missingRecommended.length > 0) {
  console.warn(
    [
      "Production optional environment values are missing.",
      `Missing: ${missingRecommended.join(", ")}`,
      "Sentry upload/reporting will be skipped until these are set in EAS env/secrets.",
      "",
    ].join("\n"),
  );
}

console.log(
  isProductionBuild
    ? "Production environment check passed."
    : "Public environment check passed.",
);
