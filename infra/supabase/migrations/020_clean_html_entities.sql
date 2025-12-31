-- Migration : Nettoyer les entités HTML dans les données existantes
-- Cette migration nettoie les entités HTML qui auraient pu être stockées avant l'ajout de decodeHtmlEntities

-- Fonction pour décoder les entités HTML (PostgreSQL compatible)
-- Note: PostgreSQL ne supporte pas les callbacks dans les regex, on utilise des remplacements séquentiels
CREATE OR REPLACE FUNCTION clean_html_entities(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
  IF input_text IS NULL OR input_text = '' THEN
    RETURN input_text;
  END IF;
  
  RETURN regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  regexp_replace(
                    regexp_replace(
                      regexp_replace(
                        regexp_replace(
                          regexp_replace(
                            regexp_replace(
                              input_text,
                              '&#x2019;', '''', 'g'
                            ),
                            '&#x2018;', '''', 'g'
                          ),
                          '&#x201C;', '"', 'g'
                        ),
                        '&#x201D;', '"', 'g'
                      ),
                      '&#x2026;', '...', 'g'
                    ),
                    '&amp;', '&', 'g'
                  ),
                  '&lt;', '<', 'g'
                ),
                '&gt;', '>', 'g'
              ),
              '&quot;', '"', 'g'
            ),
            '&#39;', '''', 'g'
          ),
          '&apos;', '''', 'g'
        ),
        '&nbsp;', ' ', 'g'
      ),
      '\s+', ' ', 'g'  -- Nettoyer les espaces multiples
    ),
    '^\s+|\s+$', '', 'g'  -- Trim
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Nettoyer les titres
UPDATE signals
SET raw_data = jsonb_set(
  raw_data,
  '{title}',
  to_jsonb(clean_html_entities(raw_data->>'title'))
)
WHERE source = 'rss'
AND raw_data->>'title' IS NOT NULL
AND (
  raw_data->>'title' ~ '&#|&amp;|&lt;|&gt;|&quot;|&apos;|&nbsp;'
);

-- Nettoyer les descriptions
UPDATE signals
SET raw_data = jsonb_set(
  raw_data,
  '{description}',
  to_jsonb(clean_html_entities(raw_data->>'description'))
)
WHERE source = 'rss'
AND raw_data->>'description' IS NOT NULL
AND (
  raw_data->>'description' ~ '&#|&amp;|&lt;|&gt;|&quot;|&apos;|&nbsp;'
);

-- Vérification : Compter les signaux nettoyés
DO $$
DECLARE
  cleaned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO cleaned_count
  FROM signals
  WHERE source = 'rss'
  AND (
    raw_data->>'title' ~ '&#|&amp;|&lt;|&gt;|&quot;|&apos;|&nbsp;' OR
    raw_data->>'description' ~ '&#|&amp;|&lt;|&gt;|&quot;|&apos;|&nbsp;'
  );
  
  IF cleaned_count > 0 THEN
    RAISE NOTICE '⚠️  Il reste % signaux avec des entités HTML non nettoyées', cleaned_count;
  ELSE
    RAISE NOTICE '✅ Tous les signaux RSS ont été nettoyés';
  END IF;
END $$;

-- Nettoyer la fonction temporaire (optionnel, on peut la garder pour usage futur)
-- DROP FUNCTION IF EXISTS clean_html_entities(TEXT);

COMMENT ON FUNCTION clean_html_entities IS 'Nettoie les entités HTML d''un texte (utilisé pour nettoyer les données RSS existantes)';

