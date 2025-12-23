const fs = require('fs');
const https = require('https');
const http = require('http');

const DIRECTUS_URL = 'http://localhost:8055';
const ADMIN_EMAIL = 'admin@entreprise.com';
const ADMIN_PASSWORD = 'Admin123!';

// Lecture du fichier alias
const schema = JSON.parse(fs.readFileSync('alias-fields.json', 'utf-8'));

// Fonction pour faire des requêtes HTTP
function makeRequest(method, path, data, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, DIRECTUS_URL);
    const lib = url.protocol === 'https:' ? https : http;
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = lib.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(parsed);
          else reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
        } catch (e) { reject(new Error(`Parse error: ${body}`)); }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function addAliasFields() {
  try {
    console.log('🔐 Authentification...');
    const auth = await makeRequest('POST', '/auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    const token = auth.data.access_token;
    console.log('✅ Authentifié\n');

    console.log('🔧 Création des champs alias...');
    for (const collection of schema.collections) {
      for (const field of collection.fields) {
        try {
          console.log(`  - Création du champ alias ${collection.collection}.${field.field}...`);
          await makeRequest('POST', `/fields/${collection.collection}`, field, token);
          console.log(`    ✅ Champ alias créé`);
        } catch (err) {
          console.log(`    ⚠️ Champ alias déjà existant ou erreur: ${err.message}`);
        }
      }
    }

    console.log('\n✨ Tous les champs alias ont été traités !');
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

addAliasFields();
