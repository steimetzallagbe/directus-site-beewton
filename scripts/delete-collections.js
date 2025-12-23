#!/usr/bin/env node

/**
 * delete-collections.js
 * Supprime toutes les collections personnalisées du projet Beewton
 * Usage : node delete-collections.js
 */

const https = require('https');
const http = require('http');

// ==================== CONFIGURATION ====================
const DIRECTUS_URL = 'http://localhost:8055';
const ADMIN_EMAIL = 'admin@entreprise.com';
const ADMIN_PASSWORD = 'Admin123!';

// Liste des collections à supprimer (dans l'ordre inverse de création pour éviter les erreurs de dépendances)
const COLLECTIONS_TO_DELETE = [
  'post_likes',
  'post_comments',
  'posts_categories',
  'post_categories',
  'posts',
  'projects_files',
  'projects_team_members',
  'team_members',
  'testimonials',
  'contacts',
  'newsletter_subscribers',
  'informations',
  'services',
  'projects',
  'project_categories',
  'jobs'
];
// ======================================================

function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, DIRECTUS_URL);
    const lib = url.protocol === 'https:' ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    if (token) options.headers.Authorization = `Bearer ${token}`;

    const req = lib.request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const parsed = body ? JSON.parse(body) : {};
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed);
        } else {
          reject(new Error(`HTTP ${res.statusCode} → ${JSON.stringify(parsed.errors || parsed)}`));
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function login() {
  console.log('Connexion à Directus...');
  const res = await request('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  console.log('Connecté\n');
  return res.data.access_token;
}

async function deleteCollection(collection, token) {
  console.log(`Suppression de la collection ${collection}...`);
  try {
    await request('DELETE', `/collections/${collection}`, null, token);
    console.log(`Collection ${collection} supprimée`);
  } catch (err) {
    if (err.message.includes('404')) {
      console.log(`${collection} n'existe pas (déjà supprimée ?)`);
    } else {
      console.log(`Impossible de supprimer ${collection} → ${err.message.split('→')[0]}`);
      console.log(err.message.split('→')[1]);
    }
  }
}

(async () => {
  try {
    const token = await login();

    console.log('Suppression des collections personnalisées...\n');

    for (const col of COLLECTIONS_TO_DELETE) {
      await deleteCollection(col, token);
      await new Promise(r => setTimeout(r, 800)); // petite pause pour éviter les rate-limits
    }

    console.log('\nNettoyage terminé !');
    console.log('Toutes les collections du blog/portfolio ont été supprimées.');
    console.log('Tu peux maintenant ré-importer un schema propre si tu veux repartir de zéro.\n');

  } catch (err) {
    console.error('\nErreur :', err.message);
    process.exit(1);
  }
})();