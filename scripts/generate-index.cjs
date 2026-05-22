const fs = require('fs');
const path = require('path');

function findManifestFile() {
    const dir = path.join(__dirname, '..', 'dist', 'server', 'assets');
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir);
    const file = files.find((f) => f.startsWith('_tanstack-start-manifest'));
    return file ? path.join(dir, file) : null;
}

function findClientCss() {
    const clientAssetsDir = path.join(__dirname, '..', 'dist', 'client', 'assets');
    if (!fs.existsSync(clientAssetsDir)) return null;
    const files = fs.readdirSync(clientAssetsDir);
    const css = files.find((f) => f.endsWith('.css'));
    return css ? `/assets/${css}` : null;
}

function generateIndex(clientEntry, cssHref) {
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Bitfall</title>
    ${cssHref ? `<link rel="stylesheet" href="${cssHref}">` : ''}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${clientEntry}"></script>
  </body>
</html>`;
    return html;
}

function main() {
    const manifestFile = findManifestFile();
    if (!manifestFile) {
        console.error('Could not find _tanstack-start-manifest file in dist/server/assets');
        process.exit(0);
    }

    const content = fs.readFileSync(manifestFile, 'utf8');
    const match = content.match(/clientEntry:\s*"([^"]+)"/);
    if (!match) {
        console.error('clientEntry not found in manifest file');
        process.exit(0);
    }

    const clientEntry = match[1];
    const cssHref = findClientCss();

    const indexHtml = generateIndex(clientEntry, cssHref);

    const outDir = path.join(__dirname, '..', 'dist', 'client');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), indexHtml, 'utf8');
    console.log('Generated dist/client/index.html ->', clientEntry);
}

main();
