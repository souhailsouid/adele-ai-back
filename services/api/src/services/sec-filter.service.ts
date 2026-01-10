/**
 * Service de filtrage des formulaires SEC pertinents
 * Filtre les formulaires selon leur pertinence pour le suivi institutionnel
 */

// Types de formulaires pertinents pour le suivi institutionnel
export const RELEVANT_FORM_TYPES = [
  '13F-HR',        // Rapport trimestriel complet (stock)
  '13F-HR/A',      // Amendement du rapport trimestriel
  'SC 13G',        // Déclaration de propriété > 5% (flux - réactif)
  'SC 13G/A',      // Amendement de déclaration 13G
  'SC 13D',        // Déclaration de propriété > 5% (intention active)
  '13D',           // Variante de SC 13D
  '13D/A',         // Amendement 13D
] as const;

// Types de formulaires à ignorer (bruit)
export const IGNORED_FORM_TYPES = [
  '4',             // Form 4 - Mouvements internes (insider trading)
  '3',             // Form 3 - Déclaration initiale d'insider
  '5',             // Form 5 - Transactions annuelles d'insider
] as const;

export type RelevantFormType = typeof RELEVANT_FORM_TYPES[number];
export type IgnoredFormType = typeof IGNORED_FORM_TYPES[number];

/**
 * Vérifie si un type de formulaire est pertinent
 */
export function isRelevantFormType(formType: string | null | undefined): boolean {
  if (!formType) return false;
  
  // Normaliser le form type (enlever espaces, convertir en majuscules)
  const normalized = formType.trim().toUpperCase();
  
  // Vérifier si c'est un type ignoré
  if (IGNORED_FORM_TYPES.some(ignored => normalized.includes(ignored))) {
    return false;
  }
  
  // Vérifier si c'est un type pertinent
  return RELEVANT_FORM_TYPES.some(relevant => normalized.includes(relevant));
}

/**
 * Détermine le type de formulaire depuis le titre ou l'URL EDGAR
 */
export function determineFormType(
  title?: string | null,
  link?: string | null
): string | null {
  if (!title && !link) return null;
  
  const searchText = `${title || ''} ${link || ''}`.toUpperCase();
  
  // Ordre de priorité : chercher les types les plus spécifiques d'abord
  if (searchText.includes('13F-HR/A') || searchText.includes('13F-HR/AMEND')) {
    return '13F-HR/A';
  }
  if (searchText.includes('13F-HR')) {
    return '13F-HR';
  }
  if (searchText.includes('SC 13G/A') || searchText.includes('13G/A')) {
    return 'SC 13G/A';
  }
  if (searchText.includes('SC 13G') || searchText.includes('13G')) {
    return 'SC 13G';
  }
  if (searchText.includes('SC 13D/A') || searchText.includes('13D/A')) {
    return 'SC 13D/A';
  }
  if (searchText.includes('SC 13D') || searchText.includes('13D')) {
    return 'SC 13D';
  }
  
  return null;
}

/**
 * Filtre les filings pour ne garder que les pertinents
 */
export function filterRelevantFilings<T extends { form_type?: string | null; title?: string | null; link?: string | null }>(
  filings: T[]
): T[] {
  return filings.filter(filing => {
    // Si form_type est déjà défini, utiliser isRelevantFormType
    if (filing.form_type) {
      return isRelevantFormType(filing.form_type);
    }
    
    // Sinon, déterminer depuis title/link
    const detectedType = determineFormType(filing.title, filing.link);
    return detectedType !== null && isRelevantFormType(detectedType);
  });
}

/**
 * Génère une description lisible pour l'utilisateur
 */
export function getFormTypeDescription(formType: string): string {
  const normalized = formType.toUpperCase();
  
  if (normalized.includes('13F-HR')) {
    return normalized.includes('/A') 
      ? 'Rapport trimestriel amendé' 
      : 'Rapport trimestriel complet';
  }
  if (normalized.includes('13G')) {
    return normalized.includes('/A')
      ? 'Modification de position majeure (>5%)'
      : 'Nouvelle position majeure (>5%)';
  }
  if (normalized.includes('13D')) {
    return normalized.includes('/A')
      ? 'Modification d\'intention active'
      : 'Nouvelle intention active';
  }
  
  return formType;
}

/**
 * Génère un message utilisateur pour un filing
 */
export function getFilingUserMessage(
  fundName: string,
  formType: string,
  companyName?: string | null
): string {
  const normalized = formType.toUpperCase();
  
  if (normalized.includes('13F-HR') && !normalized.includes('/A')) {
    return `${fundName} a publié son rapport de portefeuille trimestriel`;
  }
  if (normalized.includes('13F-HR/A')) {
    return `${fundName} a amendé son rapport de portefeuille trimestriel`;
  }
  if (normalized.includes('13G')) {
    const company = companyName ? ` dans ${companyName}` : '';
    return normalized.includes('/A')
      ? `${fundName} a modifié sa position majeure${company}`
      : `${fundName} a pris une position majeure${company}`;
  }
  if (normalized.includes('13D')) {
    const company = companyName ? ` dans ${companyName}` : '';
    return normalized.includes('/A')
      ? `${fundName} a modifié son intention active${company}`
      : `${fundName} a déclaré une intention active${company}`;
  }
  
  return `${fundName} a déposé un formulaire ${formType}`;
}
