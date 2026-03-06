const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const vaultDir = path.join(root, 'vault');
const filesDir = path.join(vaultDir, 'files');
const categories = ['school', 'work', 'personal'];

function getVisibleFiles(category) {
  const categoryDir = path.join(filesDir, category);

  if (!fs.existsSync(categoryDir)) {
    return [];
  }

  return fs
    .readdirSync(categoryDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith('.') && name !== '.gitkeep')
    .sort((a, b) => a.localeCompare(b));
}

function renderLinks(category, label) {
  const files = getVisibleFiles(category);

  if (!files.length) {
    return `<section class="card"><h2>${label}</h2><p>No files yet.</p></section>`;
  }

  const links = files
    .map((file) => {
      const href = `/vault/files/${category}/${encodeURIComponent(file)}`;
      return `<li><a href="${href}">${file}</a></li>`;
    })
    .join('\n            ');

  return `<section class="card">
          <h2>${label}</h2>
          <ul>
            ${links}
          </ul>
        </section>`;
}

const schoolSection = renderLinks('school', 'School');
const workSection = renderLinks('work', 'Work');
const personalSection = renderLinks('personal', 'Personal');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vault | Liam Becker</title>
  <link rel="stylesheet" href="/assets/style.css" />
</head>
<body>
  <header class="site-header">
    <div class="nav-wrap">
      <a class="brand" href="/index.html">Liam Becker</a>
      <nav aria-label="Main navigation">
        <ul>
          <li><a href="/index.html">Home</a></li>
          <li><a href="/projects.html">Projects</a></li>
          <li><a href="/resume.html">Resume</a></li>
          <li><a href="/contact.html">Contact</a></li>
          <li><a class="active" href="/vault/">Vault</a></li>
        </ul>
      </nav>
    </div>
  </header>

  <main>
    <section class="section">
      <h1>Vault</h1>
      <p class="lead">Protected file archive. After authentication, choose a section to access files.</p>
      <div class="vault-columns">
        ${schoolSection}
        ${workSection}
        ${personalSection}
      </div>
    </section>
  </main>

  <footer>
    © <span id="year"></span> Liam Becker
  </footer>

  <script>document.getElementById('year').textContent = new Date().getFullYear();</script>
</body>
</html>
`;

fs.writeFileSync(path.join(vaultDir, 'index.html'), html, 'utf8');
console.log('Generated vault/index.html');
