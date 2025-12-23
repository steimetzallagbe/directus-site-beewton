#!/usr/bin/env node

/**
 * Script pour configurer les permissions du rôle Public
 * Basé sur l'image fournie
 */

const DIRECTUS_URL = 'http://localhost:8055';
const ADMIN_EMAIL = 'admin@entreprise.com';
const ADMIN_PASSWORD = 'Admin123!';

// Permissions selon l'image
const PERMISSIONS = [
    // Create + Read
    { collection: 'applications', create: true, read: true },
    { collection: 'contacts', create: true, read: true },
    { collection: 'directus_files', create: true, read: true },

    // Read only
    { collection: 'informations', read: true },
    { collection: 'jobs', read: true },
    { collection: 'post_categories', read: true },
    { collection: 'post_comments', read: true },
    { collection: 'post_likes', read: true },
    { collection: 'posts', read: true },
    { collection: 'project_categories', read: true },
    { collection: 'projects', read: true },
    { collection: 'projects_files', read: true },
    { collection: 'projects_team_members', read: true },
    { collection: 'services', read: true },
    { collection: 'team_members', read: true },
    { collection: 'testimonials', read: true },
];

async function setupPublicPermissions() {
    console.log('🔐 Configuration des permissions du rôle Public...\n');

    try {
        // Authentification
        console.log('1️⃣ Connexion à Directus...');
        const loginResponse = await fetch(`${DIRECTUS_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
        });

        if (!loginResponse.ok) {
            throw new Error('Échec de l\'authentification');
        }

        const { data } = await loginResponse.json();
        const token = data.access_token;
        console.log('✅ Connecté\n');

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        // Récupérer ou créer le rôle Public
        console.log('2️⃣ Récupération du rôle Public...');
        const rolesResponse = await fetch(`${DIRECTUS_URL}/roles?filter[name][_eq]=Public`, { headers });
        const rolesData = await rolesResponse.json();

        let publicRoleId;

        if (!rolesData.data || rolesData.data.length === 0) {
            // Créer le rôle Public s'il n'existe pas
            console.log('⚠️  Rôle Public non trouvé, création en cours...');
            const createRoleResponse = await fetch(`${DIRECTUS_URL}/roles`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    name: 'Public',
                    icon: 'public',
                    description: 'Rôle pour les utilisateurs non authentifiés',
                    admin_access: false,
                    app_access: false
                })
            });

            if (!createRoleResponse.ok) {
                const error = await createRoleResponse.json();
                throw new Error(`Échec création rôle Public: ${JSON.stringify(error)}`);
            }

            const newRole = await createRoleResponse.json();
            publicRoleId = newRole.data.id;
            console.log(`✅ Rôle Public créé: ${publicRoleId}\n`);
        } else {
            publicRoleId = rolesData.data[0].id;
            console.log(`✅ Rôle Public trouvé: ${publicRoleId}\n`);
        }

        // Supprimer les permissions existantes pour éviter les doublons
        console.log('3️⃣ Nettoyage des permissions existantes...');
        const existingPermsResponse = await fetch(
            `${DIRECTUS_URL}/permissions?filter[role][_eq]=${publicRoleId}`,
            { headers }
        );
        const existingPerms = await existingPermsResponse.json();

        for (const perm of existingPerms.data || []) {
            await fetch(`${DIRECTUS_URL}/permissions/${perm.id}`, {
                method: 'DELETE',
                headers
            });
        }
        console.log(`✅ ${existingPerms.data?.length || 0} permissions supprimées\n`);

        // Créer les nouvelles permissions
        console.log('4️⃣ Création des nouvelles permissions...');
        let created = 0;

        for (const perm of PERMISSIONS) {
            const permissionData = {
                role: publicRoleId,
                collection: perm.collection,
                action: 'read',
                permissions: {},
                fields: ['*']
            };

            // Permission de lecture
            if (perm.read) {
                await fetch(`${DIRECTUS_URL}/permissions`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(permissionData)
                });
                created++;
            }

            // Permission de création
            if (perm.create) {
                await fetch(`${DIRECTUS_URL}/permissions`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        ...permissionData,
                        action: 'create'
                    })
                });
                created++;
            }

            const actions = [];
            if (perm.create) actions.push('Create');
            if (perm.read) actions.push('Read');
            console.log(`   ✅ ${perm.collection}: ${actions.join(', ')}`);
        }

        console.log(`\n✅ ${created} permissions créées avec succès!\n`);
        console.log('🎉 Configuration terminée!');
        console.log('   Le rôle Public peut maintenant:');
        console.log('   - Créer et lire: applications, contacts, directus_files');
        console.log('   - Lire: toutes les autres collections\n');

    } catch (error) {
        console.error('❌ Erreur:', error.message);
        process.exit(1);
    }
}

setupPublicPermissions();
