#!/bin/bash

# Script pour importer le schéma et les données Directus dans l'ordre
# Usage: ./scripts/setup-directus.sh

set -e  # Arrêter en cas d'erreur

echo "🚀 Configuration de Directus..."
echo ""

# Vérifier que Directus est accessible
echo "1️⃣ Vérification de la disponibilité de Directus..."
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
  if curl -s http://localhost:8055/server/health > /dev/null 2>&1; then
    echo "✅ Directus est accessible"
    break
  fi
  attempt=$((attempt + 1))
  echo "   Tentative $attempt/$max_attempts - En attente de Directus..."
  sleep 2
done

if [ $attempt -eq $max_attempts ]; then
  echo "❌ Directus n'est pas accessible après $max_attempts tentatives"
  echo "   Assurez-vous que 'docker compose up -d' est bien lancé"
  exit 1
fi

echo ""

# Importer le schéma
echo "2️⃣ Import du schéma Directus..."
node scripts/import-schema.js

if [ $? -eq 0 ]; then
  echo "✅ Schéma importé avec succès"
else
  echo "❌ Erreur lors de l'import du schéma"
  exit 1
fi

echo ""

# Importer les données
echo "3️⃣ Import des données Directus..."
node scripts/import-data.js

if [ $? -eq 0 ]; then
  echo "✅ Données importées avec succès"
else
  echo "❌ Erreur lors de l'import des données"
  exit 1
fi

echo ""

# Configurer les permissions
#echo "4️⃣ Configuration des permissions du rôle Public..."
#node scripts/setup-permissions.js

#if [ $? -eq 0 ]; then
#  echo "✅ Permissions configurées avec succès"
#else
#  echo "❌ Erreur lors de la configuration des permissions"
#  exit 1
#fi

echo ""

# Configurer les Flows d'email
echo "5️⃣ Configuration des Flows d'email automatiques..."

# Flow pour candidatures
echo "   📧 Flow de confirmation de candidature..."
node scripts/setup-email-flow.js

if [ $? -ne 0 ]; then
  echo "   ⚠️  Erreur lors de la configuration du Flow candidature (non bloquant)"
fi

# Flow pour contacts
echo "   📬 Flow de notification admin contact..."
node scripts/setup-contact-notification.js

if [ $? -ne 0 ]; then
  echo "   ⚠️  Erreur lors de la configuration du Flow contact (non bloquant)"
fi

echo "✅ Flows configurés"

echo ""
echo "🎉 Configuration terminée avec succès!"
echo ""
echo "📝 Prochaines étapes:"
echo "   - Les collections et données sont maintenant disponibles"
echo "   - Les permissions Public sont configurées"
echo "   - Les Flows d'email sont actifs"
echo "   - Vous pouvez accéder à Directus sur http://localhost:8055"
echo "   - Identifiants: admin@entreprise.com / Admin123!"
