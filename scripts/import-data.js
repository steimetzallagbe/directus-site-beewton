#!/usr/bin/env node

/**
 * import-data.js - Script d'import des données dans Directus
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// Configuration
const DIRECTUS_URL = 'http://localhost:8055';
const ADMIN_EMAIL = 'admin@entreprise.com';
const ADMIN_PASSWORD = 'Admin123!';
const DATA_DIR = path.join(__dirname, '../data');

// Ordre d'import des collections (important pour les relations)
const COLLECTIONS_ORDER = [
  'informations',
  'post_categories',
  'project_categories',
  'services',
  'projects',
  'posts',
  'posts_categories',
  'testimonials',
  'contacts',
  'newsletter_subscribers',
  'jobs'
];

// Cache pour stocker les IDs des entités importées
const cache = new Map();

/**
 * Effectue une requête HTTP
 */
async function request(method, path, data = null, token = null) {
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
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
          }
        } catch (e) {
          reject(new Error(`Erreur d'analyse JSON: ${body}`));
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

/**
 * Charge les données d'un fichier JSON
 */
function loadData(collection) {
  const filePath = path.join(DATA_DIR, `${collection}.json`);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Fichier de données manquant: ${filePath}`);
    return [];
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(data) ? data : [data]; // Gère à la fois les tableaux et les objets uniques
  } catch (error) {
    console.error(`❌ Erreur lors de la lecture du fichier ${filePath}:`, error.message);
    return [];
  }
}

/**
 * Trouve un élément existant dans la collection
 */
async function findExisting(collection, item, token) {
  // Pour les collections avec un slug
  if (item.slug) {
    const result = await request('GET', `/items/${collection}?filter[slug][_eq]=${item.slug}`, null, token);
    return result.data && result.data.length > 0 ? result.data[0] : null;
  }
  
  // Pour les settings (singleton)
  if (collection === 'settings') {
    const result = await request('GET', '/settings', null, token);
    return result.data || null;
  }
  
  // Pour les contacts (recherche par email)
  if (collection === 'contacts' && item.email) {
    const result = await request('GET', `/items/contacts?filter[email][_eq]=${item.email}`, null, token);
    return result.data && result.data.length > 0 ? result.data[0] : null;
  }
  
  return null;
}

/**
 * Obtient un identifiant lisible pour le log
 */
function getItemIdentifier(item) {
  if (item.title) return item.title;
  if (item.name) return item.name;
  if (item.email) return item.email;
  if (item.author_name) return item.author_name;
  return 'ID inconnu';
}

/**
 * Importe les données d'une collection
 */
async function importCollection(collection, token) {
  console.log(`\n📥 Import de la collection: ${collection}`);
  const items = loadData(collection);
  
  if (items.length === 0) {
    console.log(`ℹ️  Aucune donnée à importer pour ${collection}`);
    return [];
  }

  const results = [];
  
  for (const item of items) {
    try {
      // Vérifier si l'élément existe déjà
      const existing = await findExisting(collection, item, token);
      
      if (existing) {
        // Mise à jour si l'élément existe
        console.log(`  🔄 Mise à jour de ${collection} (${getItemIdentifier(item)})`);
        const result = await request('PATCH', `/items/${collection}/${existing.id}`, item, token);
        results.push({ ...result, action: 'updated' });
      } else {
        // Création d'un nouvel élément
        await new Promise(r => setTimeout(r, 2000)); // ← 1,2 seconde d'attente

        console.log(`  ➕ Création de ${collection} (${getItemIdentifier(item)})`);
        const result = await request('POST', `/items/${collection}`, item, token);
        results.push({ ...result, action: 'created' });
      }
    } catch (error) {
      console.error(`  ❌ Erreur lors de l'import de l'élément dans ${collection}:`, error.message);
      results.push({ error: error.message, item });
    }
  }
  
  // Mise en cache des IDs pour les relations
  if (results.length > 0 && results[0].data) {
    cache.set(collection, results.map(r => r.data.id));
  }
  
  return results;
}

/**
 * Fonction principale
 */
async function main() {
  try {
    console.log('🚀 Début de l\'import des données dans Directus');
    
    // Authentification
    console.log('🔐 Connexion...\n');
    const authRes = await request('POST', '/auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    const token = authRes.data.access_token;

    // Importer les collections dans l'ordre défini
    for (const collection of COLLECTIONS_ORDER) {
      try {
        console.log(`\n📦 Traitement de la collection: ${collection}`);
        const results = await importCollection(collection, token);
        
        if (results && results.length > 0) {
          const stats = results.reduce((acc, r) => {
            if (r.action) {
              acc[r.action] = (acc[r.action] || 0) + 1;
            }
            return acc;
          }, {});
          
          console.log(`✅ ${collection}:`, JSON.stringify(stats, null, 2));
        }
      } catch (error) {
        console.error(`❌ Erreur lors de l'import de ${collection}:`, error.message);
      }
    }
    
    console.log('\n✨ Import terminé avec succès !');
    console.log('\nProchaines étapes:');
    console.log('1. Vérifiez les données dans l\'interface d\'administration de Directus');
    console.log('2. Configurez les permissions pour les différentes collections');
    console.log('3. Testez le site pour vous assurer que tout fonctionne correctement\n');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'import des données:', error.message);
    process.exit(1);
  }
}

// Démarrer l'import
main().catch(error => {
  console.error('❌ Erreur inattendue:', error);
  process.exit(1);
});
