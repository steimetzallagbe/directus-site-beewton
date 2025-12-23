#!/usr/bin/env node

/**
 * Script pour corriger l'email du Flow (remplacer email en dur par variable)
 */

const DIRECTUS_URL = 'http://localhost:8055';
const ADMIN_EMAIL = 'admin@entreprise.com';
const ADMIN_PASSWORD = 'Admin123!';

async function fixFlowEmail() {
    console.log('🔧 Correction de l\'email du Flow...\n');

    try {
        // Authentification
        const loginResponse = await fetch(`${DIRECTUS_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
        });

        const { data } = await loginResponse.json();
        const token = data.access_token;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };

        // 1. Trouver le Flow
        console.log('1️⃣ Recherche du Flow...');
        const flowsResponse = await fetch(`${DIRECTUS_URL}/flows`, { headers });
        const flowsData = await flowsResponse.json();
        const emailFlow = flowsData.data.find(f => f.name === 'Application Confirmation Email');

        if (!emailFlow) {
            console.log('❌ Flow non trouvé');
            process.exit(1);
        }

        console.log(`✅ Flow trouvé: ${emailFlow.id}\n`);

        // 2. Trouver l'opération email
        console.log('2️⃣ Recherche de l\'opération email...');
        const opsResponse = await fetch(
            `${DIRECTUS_URL}/operations?filter[flow][_eq]=${emailFlow.id}`,
            { headers }
        );
        const opsData = await opsResponse.json();

        if (opsData.data.length === 0) {
            console.log('❌ Aucune opération trouvée');
            process.exit(1);
        }

        const mailOp = opsData.data.find(op => op.type === 'mail');

        if (!mailOp) {
            console.log('❌ Opération mail non trouvée');
            process.exit(1);
        }

        console.log(`✅ Opération trouvée: ${mailOp.id}`);
        console.log(`   Email actuel: ${mailOp.options.to}\n`);

        // 3. Mettre à jour l'opération
        console.log('3️⃣ Mise à jour de l\'email...');
        const updateResponse = await fetch(
            `${DIRECTUS_URL}/operations/${mailOp.id}`,
            {
                method: 'PATCH',
                headers,
                body: JSON.stringify({
                    options: {
                        ...mailOp.options,
                        to: '{{$trigger.payload.email}}' // Variable dynamique
                    }
                })
            }
        );

        if (!updateResponse.ok) {
            const error = await updateResponse.json();
            console.log('❌ Erreur:', JSON.stringify(error, null, 2));
            process.exit(1);
        }

        console.log('✅ Email mis à jour avec la variable dynamique!\n');
        console.log('📧 Le Flow enverra maintenant l\'email à :');
        console.log('   {{$trigger.payload.email}}');
        console.log('   (email du candidat qui soumet le formulaire)\n');

    } catch (error) {
        console.error('❌ Erreur:', error.message);
        process.exit(1);
    }
}

fixFlowEmail();
