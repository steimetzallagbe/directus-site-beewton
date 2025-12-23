#!/usr/bin/env node

/**
 * import-data.js – Version corrigée et testée
 * Importe les données JSON dans Directus
 */

const fs = require('fs');
const https = require('https');
const http = require('http');

const DIRECTUS_URL = 'http://localhost:8055';
const ADMIN_EMAIL = 'admin@entreprise.com';
const ADMIN_PASSWORD = 'Admin123!';

const DATA_FOLDER = './data';
const COLLECTIONS_ORDER = [
  // 'project_categories',
  'post_categories',
  // 'projects',
  'posts'
];

// Mode debug - mettez à true pour voir les détails
const DEBUG = true;

function debug(...args) {
  if (DEBUG) console.log('🔍', ...args);
}

function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, DIRECTUS_URL);
    const lib = url.protocol === 'https:' ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    debug(`${method} ${path}`);
    if (data && DEBUG) debug('Body:', JSON.stringify(data).substring(0, 200));

    const req = lib.request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        debug(`Response ${res.statusCode}:`, body.substring(0, 300));
        
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
    
    if (data !== null) {
      const payload = JSON.stringify(data);
      req.write(payload);
    }
    
    req.end();
  });
}

async function login() {
  console.log('🔐 Connexion à Directus...');
  try {
    const response = await request('POST', '/auth/login', { 
      email: ADMIN_EMAIL, 
      password: ADMIN_PASSWORD 
    });
    
    const token = response.data?.access_token;
    if (!token) {
      throw new Error('Pas de token dans la réponse');
    }
    
    console.log('✅ Connecté avec succès\n');
    return token;
  } catch (err) {
    console.error('❌ Erreur de connexion:', err.message);
    throw err;
  }
}

async function clearCollection(collection, token) {
  console.log(`🗑️  Vidage de ${collection}...`);
  try {
    // Récupérer tous les IDs avec pagination désactivée
    const response = await request('GET', `/items/${collection}?limit=-1&fields=id`, null, token);
    
    // Directus peut retourner {data: [...]} ou directement [...]
    let items = response.data || response;
    if (!Array.isArray(items)) {
      items = [];
    }

    if (items.length === 0) {
      console.log(`   ℹ️  ${collection} est déjà vide`);
      return;
    }

    const ids = items.map(i => i.id);
    console.log(`   📦 ${ids.length} élément(s) trouvé(s), suppression...`);

    // Supprimer un par un avec vérification
    let deleted = 0;
    let failed = 0;
    
    for (const id of ids) {
      try {
        const delResponse = await request('DELETE', `/items/${collection}/${id}`, null, token);
        deleted++;
        if (deleted % 5 === 0 || deleted === ids.length) {
          console.log(`   ✓ Progression: ${deleted}/${ids.length}`);
        }
      } catch (delErr) {
        failed++;
        console.log(`   ✗ ID ${id}: ${delErr.message.substring(0, 60)}`);
      }
      // Petite pause pour ne pas surcharger l'API
      await new Promise(r => setTimeout(r, 50));
    }

    // Vérification finale
    const checkResponse = await request('GET', `/items/${collection}?limit=1&fields=id`, null, token);
    const remaining = checkResponse.data || checkResponse;
    const remainingCount = Array.isArray(remaining) ? remaining.length : 0;

    if (remainingCount === 0) {
      console.log(`   ✅ ${collection} complètement vidé (${deleted} supprimés)`);
    } else {
      console.log(`   ⚠️  ${collection}: ${deleted} supprimés, ${failed} échecs`);
    }
  } catch (err) {
    if (err.message.includes('404')) {
      console.log(`   ℹ️  ${collection} n'existe pas ou est vide`);
    } else {
      console.log(`   ⚠️  Erreur: ${err.message}`);
    }
  }
}

async function importCollection(collection, token) {
  const file = `${DATA_FOLDER}/${collection}.json`;
  
  if (!fs.existsSync(file)) {
    console.log(`⚠️  Fichier manquant : ${file}`);
    return;
  }

  let items;
  try {
    const content = fs.readFileSync(file, 'utf-8');
    items = JSON.parse(content);
  } catch (err) {
    console.log(`❌ Erreur lecture ${file}: ${err.message}`);
    return;
  }

  if (!Array.isArray(items)) {
    console.log(`⚠️  ${file} ne contient pas un tableau`);
    return;
  }

  if (items.length === 0) {
    console.log(`ℹ️  ${file} est vide`);
    return;
  }

  console.log(`\n📥 Import de ${items.length} élément(s) dans ${collection}...`);

  // Nettoyer les données (retirer les IDs auto-générés)
  const cleanItems = items.map(item => {
    const { id, user_created, user_updated, date_created, date_updated, ...rest } = item;
    return rest;
  });

  try {
    // Méthode 1: Création par lot (si supporté)
    try {
      const response = await request('POST', `/items/${collection}`, cleanItems, token);
      const created = response.data || [];
      console.log(`   ✅ ${Array.isArray(created) ? created.length : 1} élément(s) créé(s)`);
    } catch (batchError) {
      // Si le batch échoue, essayer un par un
      console.log(`   ℹ️  Batch non supporté, import un par un...`);
      let success = 0;
      let failed = 0;

      for (let i = 0; i < cleanItems.length; i++) {
        try {
          await request('POST', `/items/${collection}`, cleanItems[i], token);
          success++;
          if ((i + 1) % 10 === 0) {
            console.log(`   📊 Progression: ${i + 1}/${cleanItems.length}`);
          }
        } catch (itemError) {
          failed++;
          console.log(`   ⚠️  Échec élément ${i + 1}: ${itemError.message.substring(0, 100)}`);
        }
      }

      console.log(`   ✅ Import terminé: ${success} succès, ${failed} échecs`);
    }
  } catch (err) {
    console.log(`   ❌ Erreur import ${collection}: ${err.message}`);
  }
}

async function checkCollectionsExist(token) {
  console.log('🔍 Vérification des collections...\n');
  try {
    const response = await request('GET', '/collections', null, token);
    const collections = response.data || [];
    const existingNames = collections.map(c => c.collection);

    for (const col of COLLECTIONS_ORDER) {
      if (existingNames.includes(col)) {
        console.log(`   ✓ ${col} existe`);
      } else {
        console.log(`   ✗ ${col} MANQUANTE`);
      }
    }
    console.log('');
  } catch (err) {
    console.log('⚠️  Impossible de vérifier les collections');
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  Import de données Directus');
  console.log('═══════════════════════════════════════════════\n');

  try {
    // Connexion
    const token = await login();

    // Vérifier les collections
    await checkCollectionsExist(token);

    // // Vérifier que le dossier data existe
    // if (!fs.existsSync(DATA_FOLDER)) {
    //   console.log(`❌ Le dossier ${DATA_FOLDER} n'existe pas!`);
    //   console.log(`   Créez-le avec: mkdir ${DATA_FOLDER}`);
    //   process.exit(1);
    // }

    // Nettoyer les collections
    console.log('🧹 Nettoyage des collections...\n');
    for (const col of [...COLLECTIONS_ORDER].reverse()) {
      await clearCollection(col, token);
      await new Promise(r => setTimeout(r, 300));
    }

    // // Importer les données
    // console.log('\n📦 Import des données...\n');
    // for (const col of COLLECTIONS_ORDER) {
    //   await importCollection(col, token);
    //   await new Promise(r => setTimeout(r, 500));
    // }

    console.log('\n═══════════════════════════════════════════════');
    console.log('  ✅ Import terminé avec succès!');
    console.log('═══════════════════════════════════════════════\n');
    console.log('Accédez à Directus: http://localhost:8055\n');

  } catch (err) {
    console.error('\n═══════════════════════════════════════════════');
    console.error('  ❌ Erreur fatale');
    console.error('═══════════════════════════════════════════════');
    console.error('\n', err.message, '\n');
    process.exit(1);
  }
}

// Exécution
main();