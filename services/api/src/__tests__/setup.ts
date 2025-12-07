/**
 * Setup global pour les tests
 * Définit les variables d'environnement nécessaires
 */

// Variables d'environnement pour les tests
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-service-key';
process.env.UNUSUAL_WHALES_API_KEY = process.env.UNUSUAL_WHALES_API_KEY || 'test-uw-key';
process.env.FMP_API_KEY = process.env.FMP_API_KEY || 'test-fmp-key';

