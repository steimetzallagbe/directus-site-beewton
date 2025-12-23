#!/usr/bin/env node

/**
 * Script pour créer le Flow de notification admin pour les nouveaux contacts
 */

const DIRECTUS_URL = 'http://localhost:8055';
const ADMIN_EMAIL = 'admin@entreprise.com';
const ADMIN_PASSWORD = 'Admin123!';
const NOTIFICATION_EMAIL = 'contact@beewton.com';

async function setupContactNotificationFlow() {
  console.log('🚀 Configuration du Flow de notification admin contact...\n');

  try {
    // 1. Authentification
    console.log('1️⃣ Connexion à Directus...');
    const loginResponse = await fetch(`${DIRECTUS_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
      })
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

    // 2. Créer le Flow
    console.log('2️⃣ Création du Flow...');
    const flowResponse = await fetch(`${DIRECTUS_URL}/flows`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Admin Contact Notification',
        icon: 'notifications',
        color: '#f59e0b',
        status: 'active',
        trigger: 'event',
        accountability: "all",
        options: {
          type: 'action',
          scope: ['items.create'],
          collections: ['contacts']
        }
      })
    });

    if (!flowResponse.ok) {
      const error = await flowResponse.json();
      throw new Error(`Échec création Flow: ${JSON.stringify(error)}`);
    }

    const flowData = await flowResponse.json();
    const flowId = flowData.data.id;
    console.log(`✅ Flow créé avec ID: ${flowId}\n`);

    // 3. Template email admin
    const adminEmailTemplate = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; }
    .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); padding: 30px 20px; text-align: center; }
    .header-icon { font-size: 48px; margin-bottom: 10px; }
    .header-title { color: #ffffff; font-size: 24px; font-weight: 700; margin: 0; }
    .content { padding: 30px; }
    .alert-box { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 25px; border-radius: 4px; }
    .alert-text { margin: 0; color: #92400e; font-weight: 600; font-size: 16px; }
    .section { margin-bottom: 20px; }
    .label { font-weight: 600; color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
    .value { color: #111827; font-size: 16px; padding: 10px; background-color: #f9fafb; border-radius: 4px; margin-bottom: 15px; }
    .message-box { background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin-top: 15px; }
    .message-text { color: #374151; line-height: 1.6; white-space: pre-wrap; margin: 0; }
    .footer { background-color: #1f2937; padding: 20px; text-align: center; color: #9ca3af; font-size: 14px; }
    .button { display: inline-block; margin-top: 20px; padding: 12px 30px; background-color: #f59e0b; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <div class="header-icon">📬</div>
      <h1 class="header-title">Nouveau message de contact</h1>
    </div>
    
    <div class="content">
      <div class="alert-box">
        <p class="alert-text">🔔 Un nouveau message a été reçu via le formulaire de contact du site Beewton</p>
      </div>
      
      <div class="section">
        <div class="label">Nom complet</div>
        <div class="value">{{$trigger.payload.name}}</div>
      </div>
      
      <div class="section">
        <div class="label">Email</div>
        <div class="value">
          <a href="mailto:{{$trigger.payload.email}}" style="color: #f59e0b; text-decoration: none;">
            {{$trigger.payload.email}}
          </a>
        </div>
      </div>
      
      <div class="section">
        <div class="label">Téléphone</div>
        <div class="value">{{$trigger.payload.phone}}</div>
      </div>
      
      <div class="section">
        <div class="label">Sujet</div>
        <div class="value">{{$trigger.payload.subject}}</div>
      </div>
      
      <div class="section">
        <div class="label">Message</div>
        <div class="message-box">
          <p class="message-text">{{$trigger.payload.message}}</p>
        </div>
      </div>
      
      <div style="text-align: center;">
        <a href="mailto:{{$trigger.payload.email}}" class="button">
          📧 Répondre directement
        </a>
      </div>
    </div>
    
    <div class="footer">
      <p style="margin: 5px 0;">Notification automatique - Beewton</p>
      <p style="margin: 5px 0; font-size: 12px;">
        Reçu le {{$trigger.payload.date_created}} via le site web
      </p>
    </div>
  </div>
</body>
</html>`;

    // 4. Créer l'opération email
    console.log('3️⃣ Création de l\'opération email admin...');
    const operationResponse = await fetch(`${DIRECTUS_URL}/operations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        flow: flowId,
        name: 'Send Admin Notification',
        key: 'send_admin_email',
        type: 'mail',
        position_x: 19,
        position_y: 1,
        options: {
          to: NOTIFICATION_EMAIL,
          subject: '🔔 Nouveau message de contact - {{$trigger.payload.name}}',
          body: adminEmailTemplate,
          type: 'wysiwyg'
        }
      })
    });

    if (!operationResponse.ok) {
      const error = await operationResponse.json();
      throw new Error(`Échec création opération: ${JSON.stringify(error)}`);
    }

    const operationData = await operationResponse.json();
    console.log(`✅ Opération créée avec ID: ${operationData.data.id}\n`);

    console.log('🎉 Configuration terminée avec succès!');
    console.log(`\n📧 L'admin recevra maintenant un email à ${NOTIFICATION_EMAIL}`);
    console.log('   pour chaque nouveau message de contact.\n');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

setupContactNotificationFlow();
