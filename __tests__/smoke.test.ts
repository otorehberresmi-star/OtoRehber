import fs from "node:fs";
import path from "node:path";
import { communities } from "../utils/communities";
import { validateCleanContent } from "../utils/contentModeration";
import {
  LEGAL_DOCUMENTS,
  LEGAL_DOCUMENT_VERSION,
} from "../data/legalDocuments";

const root = path.resolve(__dirname, "..");
const readProjectFile = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const readFilesRecursively = (directory: string): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return readFilesRecursively(entryPath);
    return entryPath.endsWith(".tsx") ? [fs.readFileSync(entryPath, "utf8")] : [];
  });

describe("OtoRehber smoke checks", () => {
  it("blocks profanity before user content is submitted", () => {
    const result = validateCleanContent([
      { label: "Yorum", value: "Bu araç çok iyi ama amk demek istemiyorum" },
    ]);

    expect(result.ok).toBe(false);
    expect(result.message).toContain("Yorum");
  });

  it("allows clean automotive content", () => {
    const result = validateCleanContent([
      { label: "Deneyim", value: "Uzun yolda yakıt tüketimi düşük ve konforlu." },
    ]);

    expect(result.ok).toBe(true);
  });

  it("contains the required community categories", () => {
    const communityNames = communities.map((community) => community.name);

    expect(communityNames).toEqual(
      expect.arrayContaining([
        "Araç Önerileri",
        "Oto Muhabbet",
        "Modifiye, Konsept & Aksesuar",
        "Bakım & Onarım",
      ]),
    );
  });

  it("keeps moderation schema ready for reports and actions", () => {
    const sql = readProjectFile("supabase/moderation_schema.sql");

    expect(sql).toContain("create table if not exists public.content_reports");
    expect(sql).toContain("create or replace function public.moderate_content_report");
    expect(sql).toContain("create or replace function public.set_user_moderation_status");
    expect(sql).toContain("is_hidden boolean not null default false");
  });

  it("keeps push cron secret out of checked-in mobile code", () => {
    const cronSql = readProjectFile("supabase/cron_push_setup.sql");
    const pushFunction = readProjectFile(
      "supabase/functions/dispatch-push-notifications/index.ts",
    );

    expect(cronSql).toContain("generate_due_notification_jobs()");
    expect(cronSql).toContain("YOUR_DISPATCH_PUSH_SECRET");
    expect(pushFunction).toContain("DISPATCH_PUSH_SECRET");
    expect(pushFunction).toContain("x-cron-secret");
    expect(pushFunction).toContain('"generate_due_notification_jobs"');
  });

  it("registers push tokens through the secure Edge Function gateway", () => {
    const pushClient = readProjectFile("utils/pushNotifications.ts");
    const secureApi = readProjectFile("utils/secureApi.ts");
    const gateway = readProjectFile("supabase/functions/otorehber-api/index.ts");

    expect(pushClient).toContain('"push-tokens/register"');
    expect(pushClient).not.toContain('from("push_tokens")');
    expect(pushClient).not.toContain("from('push_tokens')");
    expect(secureApi).toContain("Authorization: `Bearer ${session.access_token}`");
    expect(gateway).toContain('route === "push-tokens/register"');
    expect(gateway).toContain('from("push_tokens")');
  });

  it("keeps email notifications server-side through Resend", () => {
    const emailFunction = readProjectFile(
      "supabase/functions/dispatch-email-notifications/index.ts",
    );
    const emailCron = readProjectFile("supabase/cron_email_setup.sql");
    const schema = readProjectFile("supabase/notification_settings_schema.sql");
    const appSource = readFilesRecursively(path.join(root, "app")).join("\n");

    expect(emailFunction).toContain("RESEND_API_KEY");
    expect(emailFunction).toContain("DISPATCH_EMAIL_SECRET");
    expect(emailFunction).toContain('"generate_due_notification_jobs"');
    expect(emailFunction).toContain("https://api.resend.com/emails");
    expect(emailFunction).toContain("email_enabled");
    expect(emailFunction).toContain("email_sent_at");
    expect(emailCron).toContain("YOUR_DISPATCH_EMAIL_SECRET");
    expect(emailCron).toContain("SMS is intentionally not configured");
    expect(schema).toContain("email_provider_id");
    expect(schema).toContain("notifications_pending_email_idx");
    expect(appSource).not.toContain("RESEND_API_KEY");
    expect(appSource).not.toContain("api.resend.com");
  });

  it("creates private image signed URLs through the secure Edge Function gateway", () => {
    const storageClient = readProjectFile("utils/storageUpload.ts");
    const gateway = readProjectFile("supabase/functions/otorehber-api/index.ts");

    const privateResolverStart = storageClient.indexOf(
      "export async function resolvePrivateFileUrl",
    );
    const privateResolverEnd = storageClient.indexOf(
      "export async function resolvePrivateFileUrls",
    );
    const privateResolver = storageClient.slice(
      privateResolverStart,
      privateResolverEnd,
    );

    expect(privateResolver).toContain('"storage/private-signed-url"');
    expect(privateResolver).not.toContain("createSignedUrl");
    expect(gateway).toContain('route === "storage/private-signed-url"');
    expect(gateway).toContain('resolvedBucket !== "private-user-images"');
    expect(gateway).toContain("resolvedPath.startsWith(`${userId}/`)");
    expect(gateway).toContain("createSignedUrl");
  });

  it("uses production bundle identifiers and EAS project id", () => {
    const appJson = JSON.parse(readProjectFile("app.json"));

    expect(appJson.expo.ios.bundleIdentifier).toBe("com.otorehber.app");
    expect(appJson.expo.android.package).toBe("com.otorehber.app");
    expect(appJson.expo.extra.eas.projectId).toBeTruthy();
  });

  it("keeps production monitoring and offline handling wired", () => {
    const layout = readProjectFile("app/_layout.tsx");
    const reporting = readProjectFile("utils/errorReporting.ts");
    const productionConsole = readProjectFile("utils/productionConsole.ts");
    const connectionBanner = readProjectFile("components/ConnectionStatusBanner.tsx");
    const envCheck = readProjectFile("scripts/verify-production-env.js");
    const releaseChecklist = readProjectFile("docs/production-release-checklist.md");
    const appJson = JSON.parse(readProjectFile("app.json"));
    const easJson = JSON.parse(readProjectFile("eas.json"));
    const packageJson = JSON.parse(readProjectFile("package.json"));

    expect(packageJson.dependencies["@sentry/react-native"]).toBeTruthy();
    expect(packageJson.dependencies["@react-native-community/netinfo"]).toBeTruthy();
    expect(packageJson.scripts["eas-build-pre-install"]).toContain(
      "verify-production-env",
    );
    expect(appJson.expo.plugins).toContain("@sentry/react-native/expo");
    expect(easJson.build.production.env.EXPO_PUBLIC_SUPABASE_URL).toContain(
      "nmixkbylzczztbylzyde.supabase.co",
    );
    expect(reporting).toContain("EXPO_PUBLIC_SENTRY_DSN");
    expect(reporting).toContain("Sentry.init");
    expect(layout).toContain("withErrorReporting(RootLayout)");
    expect(layout).toContain("ConnectionStatusBanner");
    expect(productionConsole).toContain("process.env.NODE_ENV === \"production\"");
    expect(productionConsole).toContain("console.log = () => {}");
    expect(envCheck).toContain("EXPO_PUBLIC_SENTRY_DSN");
    expect(envCheck).toContain("SENTRY_AUTH_TOKEN");
    expect(envCheck).toContain("SENTRY_ORG");
    expect(envCheck).toContain("SENTRY_PROJECT");
    expect(releaseChecklist).toContain("eas env:create");
    expect(releaseChecklist).toContain("npm audit --omit=dev");
    expect(releaseChecklist).toContain("Do not run `npm audit fix --force`");
    expect(releaseChecklist).toContain("separate upgrade branch for Expo SDK 56");
    expect(connectionBanner).toContain("NetInfo.addEventListener");
    expect(connectionBanner).toContain("İnternet bağlantısı yok");
  });

  it("pins the Hermes-compatible Supabase client", () => {
    const packageJson = JSON.parse(readProjectFile("package.json"));

    expect(packageJson.dependencies["@supabase/supabase-js"]).toBe("2.105.3");
  });

  it("does not expose backend setup instructions in user screens", () => {
    const appSource = readFilesRecursively(path.join(root, "app")).join("\n");

    expect(appSource).not.toContain("Supabase SQL Editor");
    expect(appSource).not.toContain(".sql dosyasını");
    expect(appSource).not.toContain("Supabase şeması güncellenmeli");
  });

  it("supports in-app account deletion through the secure gateway", () => {
    const securityScreen = readProjectFile("app/profile-routes/security.tsx");
    const gateway = readProjectFile("supabase/functions/otorehber-api/index.ts");

    expect(securityScreen).toContain("Hesabımı Sil");
    expect(securityScreen).toContain('"account/delete"');
    expect(securityScreen).toContain("Kalıcı Olarak Sil");
    expect(securityScreen).toContain("SİL");
    expect(securityScreen).not.toContain("Hesap Silme Kullanılamıyor");
    expect(securityScreen).not.toContain("auth.admin.deleteUser");
    expect(gateway).toContain('route === "account/delete"');
    expect(gateway).toContain("auth.admin.deleteUser(userId)");
    expect(gateway).toContain('from("profiles")');
  });

  it("requires versioned legal acknowledgements during registration", () => {
    const loginScreen = readProjectFile("app/profile-routes/login.tsx");
    const consentSql = readProjectFile("supabase/legal_consents_schema.sql");
    const gateway = readProjectFile("supabase/functions/otorehber-api/index.ts");

    expect(Object.keys(LEGAL_DOCUMENTS)).toEqual([
      "terms",
      "kvkk",
      "privacy",
      "marketing-consent",
    ]);
    expect(LEGAL_DOCUMENT_VERSION).toBe("2026-06-27");
    expect(JSON.stringify(LEGAL_DOCUMENTS)).not.toContain("taslak");
    expect(JSON.stringify(LEGAL_DOCUMENTS)).not.toContain("yayın öncesi");
    expect(JSON.stringify(LEGAL_DOCUMENTS)).not.toContain("MERSİS");
    expect(loginScreen).toContain("termsAccepted");
    expect(loginScreen).toContain("privacyAcknowledged");
    expect(loginScreen).toContain("marketingConsentAccepted");
    expect(loginScreen).toContain("fieldErrors");
    expect(loginScreen).toContain("inputWrapperError");
    expect(loginScreen).toContain("Ad soyad zorunlu.");
    expect(loginScreen).toContain("Şifre tekrarı zorunlu.");
    expect(loginScreen).toContain("marketing-consent");
    expect(LEGAL_DOCUMENTS.terms.sections.map((section) => section.title)).toEqual(
      expect.arrayContaining([
        "5651 Sayılı Kanun ve İçerik Denetimi",
        "Yasaklı İçerik, Sahte İlan ve Dolandırıcılık Yasağı",
        "Veri Yedekleme ve Hizmet Kesintileri",
        "Uyuşmazlık Çözümü",
      ]),
    );
    expect(LEGAL_DOCUMENTS.terms.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Yasaklı İçerik, Sahte İlan ve Dolandırıcılık Yasağı",
          paragraphs: expect.arrayContaining([
            expect.stringContaining("sahte ilan"),
            expect.stringContaining("Dolandırıcılık"),
            expect.stringContaining("yasak olan ürün ve hizmetlerin"),
          ]),
        }),
        expect.objectContaining({
          paragraphs: expect.arrayContaining([
            expect.stringContaining("otorehberresmi@gmail.com"),
          ]),
        }),
      ]),
    );
    expect(LEGAL_DOCUMENTS.privacy.sections.map((section) => section.title)).toEqual(
      expect.arrayContaining([
        "Veri İşlemenin Hukuki Sebepleri",
        "Veri Doğrulama ve Güvenlik",
        "Rekabet ve Çapraz Kullanım Sınırlaması",
      ]),
    );
    expect(LEGAL_DOCUMENTS.privacy.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          paragraphs: expect.arrayContaining([
            expect.stringContaining("otorehberresmi@gmail.com"),
          ]),
        }),
      ]),
    );
    expect(loginScreen).toContain('router.push(`/legal/${document}`');
    expect(loginScreen).toContain('"legal-consents/register"');
    expect(loginScreen).not.toContain("from(\"legal_consents\")");
    expect(loginScreen).not.toContain("from('legal_consents')");
    expect(gateway).toContain('route === "legal-consents/register"');
    expect(gateway).toContain('from("legal_consents")');
    expect(gateway).toContain("user_id: userId");
    expect(gateway).toContain("marketing_consent_accepted");
    expect(gateway).toContain("marketing_consent");
    expect(consentSql).toContain(
      "create table if not exists public.legal_consents",
    );
    expect(consentSql).toContain("marketing_consent");
    expect(consentSql).not.toContain("for update");
    expect(consentSql).not.toContain("for delete");
  });

  it("keeps key list screens covered by empty states", () => {
    const screens = [
      "app/reviews.tsx",
      "app/community/[id].tsx",
      "app/notifications-feed.tsx",
      "app/profile-routes/saved-cars.tsx",
      "app/profile-routes/my-reviews.tsx",
      "app/profile-routes/following.tsx",
      "app/(tabs)/garage.tsx",
      "app/(tabs)/communities.tsx",
      "app/admin/moderation.tsx",
      "app/user/[id].tsx",
    ];

    screens.forEach((screenPath) => {
      const source = readProjectFile(screenPath);
      expect(source).toMatch(/empty|Empty|Henüz|henüz|Kuyruk boş|ListEmptyComponent/);
    });
  });

  it("supports forgot-password and recovery password update flow", () => {
    const loginScreen = readProjectFile("app/profile-routes/login.tsx");
    const resetScreen = readProjectFile("app/profile-routes/reset-password.tsx");
    const layout = readProjectFile("app/_layout.tsx");

    expect(loginScreen).toContain("Şifremi unuttum");
    expect(loginScreen).toContain("resetPasswordForEmail");
    expect(loginScreen).toContain("profile-routes/reset-password");
    expect(resetScreen).toContain("Yeni Şifre Belirle");
    expect(resetScreen).toContain("exchangeCodeForSession");
    expect(resetScreen).toContain("setSession");
    expect(resetScreen).toContain("updateUser({ password })");
    expect(layout).toContain('name="profile-routes/reset-password"');
  });

  it("allows compare picker to use the selected catalog level", () => {
    const picker = readProjectFile("components/VehicleCatalogPicker.tsx");
    const discover = readProjectFile("app/(tabs)/index.tsx");
    const comparisonDetail = readProjectFile("app/comparison/[id].tsx");

    expect(picker).toContain("allowCurrentLevelSelect");
    expect(picker).toContain("Seçilen model seviyesinde kıyaslamaya ekle");
    expect(picker).toContain("Seçilen motor seviyesinde kıyaslamaya ekle");
    expect(discover).toContain("selectCatalogVehicleLevel");
    expect(discover).toContain("onSelectCurrentLevel={selectCatalogVehicleLevel}");
    expect(discover).toContain("Tüm motor/donanımlar");
    expect(discover).toContain("Tüm donanımlar");
    expect(discover).toContain("buildCatalogFallbackId");
    expect(discover).not.toContain("Katalog henüz veritabanına aktarılmadı");
    expect(discover).toContain("buildCompareSelectionLabel(selected)");
    expect(discover).toContain("car1Engine");
    expect(discover).toContain("car2Fuel");
    expect(discover).toContain("car1Transmission");
    expect(comparisonDetail).toContain("effectiveVehicleSpecs");
    expect(comparisonDetail).toContain("OtoRehber katalog seçimi");
    expect(comparisonDetail).toContain("seçtiğin katalog seviyesindeki teknik");
  });

  it("keeps catalog and experience search optimized without Redis", () => {
    const searchSql = readProjectFile("supabase/catalog_search_optimization_schema.sql");
    const discover = readProjectFile("app/(tabs)/index.tsx");
    const catalog = readProjectFile("utils/vehicleCatalog.ts");

    expect(searchSql).toContain("create extension if not exists pg_trgm");
    expect(searchSql).toContain("public.normalize_search_text");
    expect(searchSql).toContain("brands_search_text_trgm_idx");
    expect(searchSql).toContain("models_search_text_trgm_idx");
    expect(searchSql).toContain("posts_experience_search_text_trgm_idx");
    expect(searchSql).toContain("reviews_search_text_trgm_idx");
    expect(searchSql).toContain("vehicle_specs_search_text_trgm_idx");
    expect(discover).toContain('ilike("search_text"');
    expect(catalog).toContain("catalogModelsCache");
    expect(catalog).toContain("catalogEnginesCache");
    expect(catalog).toContain("catalogVariantsCache");
  });
});
