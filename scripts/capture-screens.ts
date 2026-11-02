import http from 'http';
import fs from 'fs';
import path from 'path';
import { chromium } from '@playwright/test';

const distDir = path.resolve(process.cwd(), 'apps/web/dist');
const screensDir = path.resolve(process.cwd(), 'docs/screens');

if (!fs.existsSync(screensDir)) {
  fs.mkdirSync(screensDir, { recursive: true });
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html':
      return 'text/html';
    case '.js':
      return 'application/javascript';
    case '.css':
      return 'text/css';
    case '.woff':
      return 'font/woff';
    case '.woff2':
      return 'font/woff2';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    default:
      return 'application/octet-stream';
  }
}

async function startServer(): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url ?? '/', 'http://localhost');
      let pathname = parsedUrl.pathname;
      if (pathname === '/') pathname = '/index.html';

      let targetPath = path.join(distDir, pathname);
      if (!fs.existsSync(targetPath) || fs.statSync(targetPath).isDirectory()) {
        targetPath = path.join(distDir, 'index.html');
      }

      try {
        const content = fs.readFileSync(targetPath);
        res.writeHead(200, { 'Content-Type': getMimeType(targetPath) });
        res.end(content);
      } catch (err) {
        res.writeHead(500);
        res.end(String(err));
      }
    });

    server.listen(4173, () => {
      resolve({ server, port: 4173 });
    });
    server.on('error', reject);
  });
}

async function captureScreens() {
  console.info('Starting local preview server on port 4173...');
  const { server } = await startServer();

  console.info('Launching Chromium via Playwright...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  const routes = [
    { name: '01-landing-page.png', path: '/', darkMode: false },
    { name: '02-documents-page.png', path: '/documents', darkMode: false },
    { name: '03-chat-page.png', path: '/chat', darkMode: false },
    { name: '04-admin-page.png', path: '/admin', darkMode: false },
    { name: '05-landing-dark.png', path: '/', darkMode: true },
  ];

  for (const r of routes) {
    const page = await context.newPage();
    const url = `http://localhost:4173${r.path}`;
    await page.goto(url, { waitUntil: 'networkidle' });

    if (r.darkMode) {
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
      });
      await page.waitForTimeout(300);
    }

    const outPath = path.join(screensDir, r.name);
    await page.screenshot({ path: outPath, fullPage: false });
    console.info(`✓ Captured ${r.name}`);
    await page.close();
  }

  await browser.close();
  server.close();
  console.info(`✅ Successfully saved ${routes.length} screenshots to ${screensDir}`);
}

captureScreens().catch((err) => {
  console.error('Failed to capture screenshots:', err);
  process.exit(1);
});
