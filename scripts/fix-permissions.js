#!/usr/bin/env node

/**
 * fix-permissions.js - Configure les permissions pour toutes les collections
 */

const http = require('http');

const DIRECTUS_URL = 'http://localhost:8055';
const ADMIN_EMAIL = 'admin@entreprise.com';
const ADMIN_PASSWORD = 'Admin123!';

const COLLECTIONS = [
  'settings',
  'projects',
  'posts',
  'project_categories',
  'post_categories',
  'post_comments',
  'post_likes',
  'projects_files'
];

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
            reject(new Error(`${res.statusCode}: ${body.substring(0, 200)}`));
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

async function getRoles(token) {
  console.log('📋 Récupération des rôles...');
  const res = await request('GET', '/roles', null, token);
  return res.data || [];
}

async function getPermissions(token, roleId) {
  const res = await request('GET', `/permissions?filter[role][_eq]=${roleId}`, null, token);
  return res.data || [];
}

async function createPermission(token, permission) {
  try {
    await request('POST', '/permissions', permission, token);
    return true;
  } catch (err) {
    if (err.message.includes('RECORD_NOT_UNIQUE')) {
      return false; // Permission existe déjà
    }
    throw err;
  }
}

async function fixPermissions(token) {
  // Récupérer tous les rôles
  const roles = await getRoles(token);
  console.log(`Trouvé ${roles.length} rôle(s)\n`);

  // Trouver le rôle Administrator
  const adminRole = roles.find(r => r.name === 'Administrator' || r.admin_access === true);
  
  if (!adminRole) {
    console.log('❌ Rôle Administrator non trouvé');
    return;
  }

  console.log(`🔑 Rôle Administrator: ${adminRole.id}\n`);

  // Vérifier les permissions existantes
  const existingPerms = await getPermissions(token, adminRole.id);
  const existingCollections = new Set(existingPerms.map(p => p.collection));

  console.log('📦 Configuration des permissions pour chaque collection:\n');

  for (const collection of COLLECTIONS) {
    if (existingCollections.has(collection)) {
      console.log(`   ✓ ${collection} (déjà configuré)`);
      continue;
    }

    console.log(`   + ${collection}...`);

    // Créer permissions complètes pour les admins
    const actions = ['create', 'read', 'update', 'delete'];
    
    for (const action of actions) {
      const permission = {
        role: adminRole.id,
        collection: collection,
        action: action,
        permissions: {}, // Pas de restrictions
        validation: {},
        fields: ['*']
      };

      try {
        const created = await createPermission(token, permission);
        if (created) {
          process.stdout.write('.');
        }
      } catch (err) {
        console.log(`\n      ⚠️  ${action}: ${err.message.substring(0, 80)}`);
      }
    }
    console.log(' ✅');
  }

  console.log('\n✅ Configuration des permissions terminée!\n');
}

async function main() {
  try {
    const token = await login();
    await fixPermissions(token);
    
    console.log('═══════════════════════════════════════════════');
    console.log('Vous pouvez maintenant accéder à toutes les collections!');
    console.log('Essayez: node manage-settings.js get');
    console.log('═══════════════════════════════════════════════\n');

  } catch (err) {
    console.error('\n❌ Erreur:', err.message);
    process.exit(1);
  }
}

main();