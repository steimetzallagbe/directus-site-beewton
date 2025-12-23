#!/usr/bin/env node

/**
 * Script d'import du schéma Directus
 * Usage: node import-schema.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Configuration
const DIRECTUS_URL = 'http://localhost:8055';
const ADMIN_EMAIL = 'admin@entreprise.com';
const ADMIN_PASSWORD = 'Admin123!';

// Schéma à importer
// Récupération du schéma depuis le fichier JSON
const schemaPath = path.join(__dirname, '..', 'schema', 'schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

// Fonction pour faire des requêtes HTTP
function makeRequest(method, path, data, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, DIRECTUS_URL);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = lib.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
          }
        } catch (e) {
          reject(new Error(`Parse error: ${body}`));
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Fonction principale
async function importSchema() {
  try {
    console.log('🔐 Authentification...');
    const authResponse = await makeRequest('POST', '/auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    const token = authResponse.data.access_token;
    console.log('✅ Authentifié avec succès\n');

    // Créer les collections
    console.log('📦 Création des collections...');
    for (const collection of schema.collections) {
      try {
        console.log(`  - Création de ${collection.collection}...`);
        await makeRequest('POST', '/collections', collection, token);
        console.log(`  ✅ ${collection.collection} créée`);
      } catch (error) {
        console.log(`  ⚠️  ${collection.collection} existe déjà ou erreur: ${error.message}`);
      }
    }

    // Attendre un peu pour que les collections soient prêtes
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Créer les relations
    console.log('\n🔗 Création des relations...');
    for (const relation of schema.relations) {
      try {
        console.log(`  - Relation ${relation.collection}.${relation.field} → ${relation.related_collection}...`);
        await makeRequest('POST', '/relations', relation, token);
        console.log(`  ✅ Relation créée`);
      } catch (error) {
        console.log(`  ⚠️  Relation existe déjà ou erreur: ${error.message}`);
      }
    }

    // Créer les champs alias (M2M et O2M)
    try {
      console.log('\n🔧 Création des champs spéciaux...');
      for (const field of schema.fields) {
        try {
          console.log(`  - Champ ${field.collection}.${field.field}...`);
          await makeRequest('POST', `/fields/${field.collection}`, field, token);
          console.log(`  ✅ Champ créé`);
        } catch (error) {
          console.log(`  ⚠️  Champ existe déjà ou erreur: ${error.message}`);
        }
      }
    } catch (error) {
      console.log('\n⚠️  Aucun champ spécial à créer (schema.fields non disponible)');
    }

    console.log('\n✨ Import terminé avec succès!');
    console.log('\n📝 Prochaines étapes:');
    console.log('1. Accédez à http://localhost:8055');
    console.log('2. Connectez-vous avec vos identifiants');
    console.log('3. Commencez à ajouter vos projets!\n');

  } catch (error) {
    console.error('❌ Erreur lors de l\'import:', error.message);
    process.exit(1);
  }
}

// Exécuter
importSchema();