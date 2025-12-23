#!/usr/bin/env node

/**
 * Script pour créer automatiquement le Flow Directus d'envoi d'emails de confirmation
 * Usage: node setup-email-flow.js
 */

const DIRECTUS_URL = 'http://localhost:8055';
const ADMIN_EMAIL = 'admin@entreprise.com';
const ADMIN_PASSWORD = 'Admin123!';

async function setupEmailFlow() {
  console.log('🚀 Configuration du Flow d\'email de confirmation...\n');

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
      throw new Error('Échec de l\'authentification. Vérifiez les identifiants admin.');
    }

    const { data } = await loginResponse.json();
    const token = data.access_token;
    console.log('✅ Connecté avec succès\n');

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
        name: 'Application Confirmation Email',
        icon: 'mail',
        color: '#2563eb',
        status: 'active',
        trigger: 'event',
        accountability: "all",
        options: {
          type: 'action',
          scope: ['items.create'],
          collections: ['applications']
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

    // 3. Créer l'opération "Send Email"
    console.log('3️⃣ Création de l\'opération d\'envoi d\'email...');
    const operationResponse = await fetch(`${DIRECTUS_URL}/operations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        flow: flowId,
        name: 'Send Confirmation Email',
        key: 'send_email',
        type: 'mail',
        position_x: 19,
        position_y: 1,
        options: {
          from: 'noreply@beewton.com',
          to: '{{$trigger.payload.email}}',
          subject: 'Confirmation de réception de votre candidature - Beewton',
          body: `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmation de candidature</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f3f4f6;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
      padding: 40px 20px;
      text-align: center;
    }
    .logo {
      max-width: 180px;
      height: auto;
      margin-bottom: 20px;
    }
    .header-title {
      color: #ffffff;
      font-size: 24px;
      font-weight: 700;
      margin: 0;
    }
    .content {
      padding: 40px 30px;
      color: #374151;
      line-height: 1.6;
    }
    .greeting {
      font-size: 18px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 20px;
    }
    .message {
      font-size: 16px;
      margin-bottom: 15px;
    }
    .highlight {
      background-color: #fef3c7;
      padding: 20px;
      border-left: 4px solid #f59e0b;
      margin: 25px 0;
      border-radius: 4px;
    }
    .highlight-text {
      margin: 0;
      color: #92400e;
      font-weight: 500;
    }
    .signature {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
    }
    .signature-text {
      margin: 5px 0;
      color: #6b7280;
    }
    .signature-team {
      font-weight: 600;
      color: #f59e0b;
    }
    .footer {
      background-color: #1f2937;
      padding: 30px 20px;
      text-align: center;
      color: #9ca3af;
      font-size: 14px;
    }
    .footer-links {
      margin: 15px 0;
    }
    .footer-link {
      color: #f59e0b;
      text-decoration: none;
      margin: 0 10px;
    }
    .footer-link:hover {
      text-decoration: underline;
    }
    .social-icons {
      margin: 20px 0;
    }
    .social-icon {
      display: inline-block;
      margin: 0 8px;
      color: #9ca3af;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <!-- Header avec logo -->
    <div class="header">
      <img src="https://beewton.com/Huge@2x.svg" alt="Beewton Logo" class="logo">
      <h1 class="header-title">Candidature bien reçue ✓</h1>
    </div>
    
    <!-- Contenu principal -->
    <div class="content">
      <p class="greeting">Bonjour {{$trigger.payload.first_name}} {{$trigger.payload.last_name}},</p>
      
      <p class="message">
        Nous vous remercions d'avoir postulé chez <strong>Beewton</strong> et de l'intérêt que vous portez à notre entreprise.
      </p>
      
      <div class="highlight">
        <p class="highlight-text">
          ✅ Votre candidature a bien été reçue et est actuellement en cours d'examen par notre équipe RH.
        </p>
      </div>
      
      <p class="message">
        Nous étudions attentivement chaque dossier et nous nous engageons à vous tenir informé(e) de la suite donnée à votre candidature dans les meilleurs délais.
      </p>
      
      <p class="message">
        Si votre profil correspond à nos besoins, nous vous recontacterons prochainement pour poursuivre le processus de recrutement.
      </p>
      
      <!-- Signature -->
      <div class="signature">
        <p class="signature-text">Bien cordialement,</p>
        <p class="signature-team">L'équipe RH Beewton</p>
      </div>
    </div>
    
    <!-- Footer -->
    <div class="footer">
      <div class="footer-links">
        <a href="https://beewton.com" class="footer-link">Site web</a>
        <a href="https://beewton.com/careers" class="footer-link">Carrières</a>
        <a href="https://beewton.com/contact" class="footer-link">Contact</a>
      </div>
      
      <p style="margin: 15px 0 5px;">
        © ${new Date().getFullYear()} Beewton. Tous droits réservés.
      </p>
      
      <p style="margin: 5px 0; font-size: 12px;">
        Ceci est un email automatique, merci de ne pas y répondre directement.
      </p>
    </div>
  </div>
</body>
</html>`,
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
    console.log('\n📧 Le Flow est maintenant actif et enverra automatiquement un email');
    console.log('   de confirmation moderne avec le logo Beewton à chaque candidature.\n');

  } catch (error) {
    console.error('❌ Erreur lors de la configuration:', error.message);
    process.exit(1);
  }
}

// Exécution
setupEmailFlow();
