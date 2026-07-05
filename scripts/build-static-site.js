const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'website');
const assetsDir = path.join(outDir, 'assets');

const site = {
  baseUrl: 'https://oto-rehber.com',
  iosUrl: 'https://apps.apple.com/app/id6785478665',
  androidUrl: 'https://play.google.com/store/apps/details?id=com.otorehber.app',
  supportEmail: 'otorehberresmi@gmail.com',
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let paragraph = [];
  let listOpen = false;

  function flushParagraph() {
    if (paragraph.length) {
      html.push(`<p>${paragraph.map(escapeHtml).join(' ')}</p>`);
      paragraph = [];
    }
  }

  function closeList() {
    if (listOpen) {
      html.push('</ul>');
      listOpen = false;
    }
  }

  for (const line of lines) {
    if (/^# /.test(line)) {
      flushParagraph();
      closeList();
      html.push(`<h1>${escapeHtml(line.slice(2).trim())}</h1>`);
    } else if (/^## /.test(line)) {
      flushParagraph();
      closeList();
      html.push(`<h2>${escapeHtml(line.slice(3).trim())}</h2>`);
    } else if (/^- /.test(line)) {
      flushParagraph();
      if (!listOpen) {
        html.push('<ul>');
        listOpen = true;
      }
      html.push(`<li>${escapeHtml(line.slice(2).trim())}</li>`);
    } else if (line.trim() === '') {
      flushParagraph();
      closeList();
    } else {
      paragraph.push(line.trim());
    }
  }

  flushParagraph();
  closeList();
  return html.join('\n');
}

function page({ title, description, body, canonicalPath = '/' }) {
  const canonicalUrl = `${site.baseUrl}${canonicalPath}`;
  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${canonicalUrl}" />
  <link rel="icon" href="/assets/app-icon.png" />
  <link rel="stylesheet" href="/assets/styles.css" />
</head>
<body>
  <header class="site-header">
    <a class="brand" href="/">
      <img src="/assets/app-icon.png" alt="" />
      <span>OtoRehber</span>
    </a>
    <nav aria-label="Yasal bağlantılar">
      <a href="/destek/">Destek</a>
      <a href="/gizlilik/">Gizlilik</a>
      <a href="/kullanim-sartlari/">Şartlar</a>
    </nav>
  </header>
  <main>
${body}
  </main>
</body>
</html>`;
}

function legalPage({ source, title, description, route }) {
  const markdown = fs.readFileSync(path.join(root, source), 'utf8');
  const body = `    <article class="legal">
      ${markdownToHtml(markdown)}
    </article>`;
  const dir = path.join(outDir, route);
  ensureDir(dir);
  fs.writeFileSync(
    path.join(dir, 'index.html'),
    page({ title, description, body, canonicalPath: `/${route}/` })
  );
}

async function main() {
  ensureDir(assetsDir);
  fs.copyFileSync(path.join(root, 'store-assets/ios/app-icon-1024.png'), path.join(assetsDir, 'app-icon.png'));

  await QRCode.toFile(path.join(assetsDir, 'qr-ios.png'), site.iosUrl, {
    width: 680,
    margin: 2,
    color: { dark: '#101827', light: '#ffffff' },
  });
  await QRCode.toFile(path.join(assetsDir, 'qr-android.png'), site.androidUrl, {
    width: 680,
    margin: 2,
    color: { dark: '#101827', light: '#ffffff' },
  });

  fs.writeFileSync(path.join(assetsDir, 'styles.css'), `:root {
  color-scheme: light;
  --ink: #101827;
  --muted: #617089;
  --line: #e1e7f0;
  --surface: #f6f8fb;
  --orange: #ff6b13;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--ink);
  background: var(--surface);
}
a { color: inherit; }
.site-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 22px clamp(20px, 5vw, 72px);
  background: #fff;
  border-bottom: 1px solid var(--line);
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  font-weight: 800;
  font-size: 24px;
  text-decoration: none;
  min-width: 0;
}
.brand span { overflow-wrap: anywhere; }
.brand img { width: 44px; height: 44px; border-radius: 10px; }
nav { display: flex; gap: 18px; flex-wrap: wrap; color: var(--muted); font-weight: 700; }
nav a { text-decoration: none; }
.hero {
  max-width: 1100px;
  margin: 0 auto;
  padding: clamp(44px, 7vw, 88px) 20px 28px;
  text-align: center;
}
.hero h1 {
  margin: 0 auto 14px;
  max-width: 760px;
  font-size: clamp(32px, 7vw, 76px);
  line-height: 1;
  letter-spacing: 0;
  overflow-wrap: anywhere;
}
.hero p {
  margin: 0 auto;
  max-width: 680px;
  color: var(--muted);
  font-size: clamp(18px, 2.4vw, 24px);
  line-height: 1.45;
}
.qr-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  max-width: 920px;
  margin: 34px auto 0;
  padding: 0 20px 72px;
}
.qr-card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: clamp(18px, 3vw, 28px);
  text-align: center;
}
.qr-card h2 { margin: 0 0 8px; font-size: 28px; }
.qr-card p { margin: 0 0 18px; color: var(--muted); line-height: 1.45; }
.qr-card img { width: min(100%, 320px); height: auto; }
.store-link {
  display: inline-flex;
  margin-top: 16px;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  padding: 0 18px;
  background: var(--orange);
  color: #fff;
  font-weight: 800;
  text-decoration: none;
}
.legal {
  max-width: 880px;
  margin: 0 auto;
  padding: clamp(34px, 5vw, 64px) 20px 72px;
}
.legal h1 { font-size: clamp(34px, 5vw, 52px); margin: 0 0 22px; }
.legal h2 { margin: 34px 0 12px; font-size: 24px; }
.legal p, .legal li { color: #344154; font-size: 17px; line-height: 1.7; }
.legal ul { padding-left: 24px; }
@media (max-width: 720px) {
  .site-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 16px;
    padding: 18px 20px;
  }
  .brand { font-size: 22px; }
  nav { gap: 14px; font-size: 16px; }
  .hero { padding-top: 38px; }
  .hero h1 { font-size: 38px; line-height: 1.08; }
  .hero p { font-size: 17px; }
  .qr-grid { grid-template-columns: 1fr; }
  .qr-card img { width: min(100%, 260px); }
}
`);

  const indexBody = `    <section class="hero">
      <h1>OtoRehber'i telefonuna indir</h1>
      <p>iOS ve Android için QR kodu okut, araç yorumları, topluluklar ve garaj takibini cebine al.</p>
    </section>
    <section class="qr-grid" aria-label="Uygulama indirme bağlantıları">
      <article class="qr-card">
        <h2>iOS</h2>
        <p>App Store bağlantısı için QR kodu okut.</p>
        <img src="/assets/qr-ios.png" alt="OtoRehber iOS App Store QR kodu" />
        <a class="store-link" href="${site.iosUrl}">App Store'a Git</a>
      </article>
      <article class="qr-card">
        <h2>Android</h2>
        <p>Google Play bağlantısı için QR kodu okut.</p>
        <img src="/assets/qr-android.png" alt="OtoRehber Android Google Play QR kodu" />
        <a class="store-link" href="${site.androidUrl}">Google Play'e Git</a>
      </article>
    </section>`;

  fs.writeFileSync(
    path.join(outDir, 'index.html'),
    page({
      title: 'OtoRehber - iOS ve Android',
      description: 'OtoRehber iOS ve Android indirme QR kodları.',
      body: indexBody,
      canonicalPath: '/',
    })
  );

  legalPage({
    source: 'docs/support-tr.md',
    title: 'OtoRehber Destek',
    description: 'OtoRehber destek ve iletişim bilgileri.',
    route: 'destek',
  });
  legalPage({
    source: 'docs/privacy-policy-tr.md',
    title: 'OtoRehber Gizlilik Politikası',
    description: 'OtoRehber gizlilik politikası.',
    route: 'gizlilik',
  });
  legalPage({
    source: 'docs/terms-of-use-tr.md',
    title: 'OtoRehber Kullanım Şartları',
    description: 'OtoRehber kullanım şartları.',
    route: 'kullanim-sartlari',
  });
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
