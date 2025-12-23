module.exports = function registerHook({ filter, action }, { services, getSchema }) {
    const { MailService } = services;

    // Hook qui se déclenche APRÈS la création d'une application
    action('applications.items.create', async (meta, context) => {
        // Exécuter de manière asynchrone pour ne pas bloquer la création
        setImmediate(async () => {
            try {
                const { payload, key } = meta;
                const { first_name, last_name, email } = payload;

                if (!email || !first_name || !last_name) {
                    console.log('[Hook] Missing email data, skipping');
                    return;
                }

                console.log(`[Hook] Sending email to ${email}...`);

                const htmlTemplate = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; }
    .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); padding: 40px 20px; text-align: center; }
    .logo { max-width: 180px; height: auto; margin-bottom: 20px; }
    .header-title { color: #ffffff; font-size: 24px; font-weight: 700; margin: 0; }
    .content { padding: 40px 30px; color: #374151; line-height: 1.6; }
    .greeting { font-size: 18px; font-weight: 600; color: #111827; margin-bottom: 20px; }
    .message { font-size: 16px; margin-bottom: 15px; }
    .highlight { background-color: #fef3c7; padding: 20px; border-left: 4px solid #f59e0b; margin: 25px 0; border-radius: 4px; }
    .highlight-text { margin: 0; color: #92400e; font-weight: 500; }
    .signature { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
    .signature-text { margin: 5px 0; color: #6b7280; }
    .signature-team { font-weight: 600; color: #f59e0b; }
    .footer { background-color: #1f2937; padding: 30px 20px; text-align: center; color: #9ca3af; font-size: 14px; }
    .footer-link { color: #f59e0b; text-decoration: none; margin: 0 10px; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <img src="https://beewton.com/Huge@2x.svg" alt="Beewton Logo" class="logo">
      <h1 class="header-title">Candidature bien reçue ✓</h1>
    </div>
    <div class="content">
      <p class="greeting">Bonjour ${first_name} ${last_name},</p>
      <p class="message">Nous vous remercions d'avoir postulé chez <strong>Beewton</strong> et de l'intérêt que vous portez à notre entreprise.</p>
      <div class="highlight">
        <p class="highlight-text">✅ Votre candidature a bien été reçue et est actuellement en cours d'examen par notre équipe RH.</p>
      </div>
      <p class="message">Nous étudions attentivement chaque dossier et nous nous engageons à vous tenir informé(e) de la suite donnée à votre candidature dans les meilleurs délais.</p>
      <p class="message">Si votre profil correspond à nos besoins, nous vous recontacterons prochainement pour poursuivre le processus de recrutement.</p>
      <div class="signature">
        <p class="signature-text">Bien cordialement,</p>
        <p class="signature-team">L'équipe RH Beewton</p>
      </div>
    </div>
    <div class="footer">
      <a href="https://beewton.com" class="footer-link">Site web</a>
      <a href="https://beewton.com/careers" class="footer-link">Carrières</a>
      <a href="https://beewton.com/contact" class="footer-link">Contact</a>
      <p style="margin: 15px 0 5px;">© ${new Date().getFullYear()} Beewton. Tous droits réservés.</p>
      <p style="margin: 5px 0; font-size: 12px;">Ceci est un email automatique, merci de ne pas y répondre directement.</p>
    </div>
  </div>
</body>
</html>`;

                // Utiliser le MailService de Directus avec accountability admin (bypass restrictions)
                const schema = await getSchema();
                const mailService = new MailService({
                    schema,
                    accountability: { admin: true, role: null }
                });

                await mailService.send({
                    to: email,
                    subject: 'Confirmation de réception de votre candidature - Beewton',
                    html: htmlTemplate,
                });

                console.log(`[Hook] ✅ Email sent successfully to ${email}`);
            } catch (error) {
                console.error('[Hook] ❌ Failed to send email:', error.message);
                console.error('[Hook] Stack:', error.stack);
            }
        });
    });
};
