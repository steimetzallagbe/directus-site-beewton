#!/usr/bin/env node

/**
 * manage-settings.js - Gestion de la collection singleton Settings
 */

const http = require('http');
const fs = require('fs');

const DIRECTUS_URL = 'http://localhost:8055';
const ADMIN_EMAIL = 'admin@entreprise.com';
const ADMIN_PASSWORD = 'Admin123!';

function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, DIRECTUS_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method,
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            const errorMsg = parsed.errors?.[0]?.message || parsed.message || body;
            reject(new Error(`HTTP ${res.statusCode}: ${errorMsg}`));
          }
        } catch (e) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ data: body });
          } else {
            reject(new Error(`Parse error (${res.statusCode}): ${body}`));
          }
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function login() {
  console.log('🔐 Connexion...');
  const res = await request('POST', '/auth/login', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD
  });
  console.log('✅ Connecté\n');
  return res.data.access_token;
}

async function getSettings(token) {
  console.log('📖 Lecture des settings actuels...\n');
  try {
    const res = await request('GET', '/items/settings', null, token);
    const settings = res.data || res;
    console.log(JSON.stringify(settings, null, 2));
    return settings;
  } catch (err) {
    if (err.message.includes('404')) {
      console.log('⚠️  Aucun settings trouvé (normal pour un nouveau singleton)\n');
      return null;
    }
    throw err;
  }
}

async function createOrUpdateSettings(token, settingsData) {
  console.log('💾 Création/mise à jour des settings...');
  
  try {
    // Pour un singleton, on fait un PATCH sans ID
    // Si ça n'existe pas, Directus le crée automatiquement
    const res = await request('PATCH', '/items/settings', settingsData, token);
    console.log('✅ Settings enregistrés avec succès!\n');
    return res.data || res;
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    throw err;
  }
}

async function importFromFile(token, filepath) {
  console.log(`📥 Import depuis ${filepath}...\n`);
  
  if (!fs.existsSync(filepath)) {
    console.error(`❌ Fichier non trouvé: ${filepath}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  
  // Nettoyer les champs auto-générés
  const { id, date_updated, user_updated, ...cleanData } = data;
  
  await createOrUpdateSettings(token, cleanData);
}

// Menu interactif
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    const token = await login();

    switch (command) {
      case 'get':
        await getSettings(token);
        break;

      case 'set':
        if (!args[1]) {
          console.log('❌ Usage: node manage-settings.js set <fichier.json>');
          process.exit(1);
        }
        await importFromFile(token, args[1]);
        break;

      case 'init':
        // Initialiser avec des valeurs par défaut
        const defaultSettings = {
          site_title: 'Mon Site',
          site_description: 'Description de mon site',
          site_url: 'https://example.com',
          company_name: 'Ma Société',
          company_email: 'contact@example.com',
          maintenance_mode: false
        };
        await createOrUpdateSettings(token, defaultSettings);
        break;

      default:
        console.log(`
╔════════════════════════════════════════════╗
║   Gestion des Settings Directus            ║
╚════════════════════════════════════════════╝

Usage:
  node manage-settings.js <commande> [options]

Commandes:
  get                 Afficher les settings actuels
  set <fichier.json>  Importer settings depuis un fichier
  init                Initialiser avec des valeurs par défaut

Exemples:
  node manage-settings.js get
  node manage-settings.js set ./data/settings.json
  node manage-settings.js init
        `);
    }

  } catch (err) {
    console.error('\n❌ Erreur:', err.message);
    process.exit(1);
  }
}

main();