import { z } from "zod";

/** ORGANIZATIONS **/
export const SenderProfile = z.object({
  sender_name: z.string().min(1),
  sender_title: z.string().min(1),
  mail_from_domain: z.string().min(1), // ex: hello.yourcompany.com
  reply_to_email: z.string().email().optional(),
});

export const Compliance = z.object({
  mode: z.enum(["B2B", "B2C"]),
  unsubscribe_link_template: z.string().optional(),
  legal_country: z.string().optional(),
});

// Fonction helper pour valider et normaliser les URLs
const urlSchema = z.string()
  .min(1, "URL is required")
  .transform((val) => {
    // Normaliser l'URL si elle n'a pas de protocole
    let normalized = val.trim();
    if (!normalized.match(/^https?:\/\//i)) {
      if (normalized.match(/^www\./i)) {
        normalized = `https://${normalized}`;
      } else {
        normalized = `https://${normalized}`;
      }
    }
    return normalized.replace(/\/$/, "");
  })
  .refine((val) => {
    try {
      const url = new URL(val);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, {
    message: "Invalid URL format",
  });

export const CreateOrganizationInput = z.object({
  company_website_url: urlSchema,
  company_domain: z.string().optional(), // sera normalisé automatiquement
  user_position: z.string().min(1), // rôle de l'utilisateur dans l'entreprise
  brand_logo_url: z.string().url().optional().or(z.literal("")),
  brand_primary_color: z.string().optional(),
  sender_profile: SenderProfile.optional(),
  compliance: Compliance.optional(),
});

// Schéma pour le snapshot d'enrichissement (version simplifiée pour édition manuelle)
export const EnrichmentSnapshotInput = z.object({
  description: z.string().min(10).optional(),
  industries: z.array(z.string()).optional(),
  techStack: z.array(z.string()).optional(),
  products: z.array(z.string()).optional(),
  targetCustomers: z.array(z.string()).optional(),
  pains: z.array(z.string()).optional(),
  competitors: z.array(z.string()).optional(),
  campaign: z.object({
    angle: z.string().min(1),
    talkingPoints: z.array(z.string()),
    firstMessage: z.string().min(1),
  }).optional(),
  size: z.object({
    employees: z.number().optional(),
    range: z.string().optional(),
  }).optional(),
  locations: z.array(z.string()).optional(),
  socials: z.object({
    linkedin: z.string().url().optional().or(z.literal("")),
    twitter: z.string().url().optional().or(z.literal("")),
    github: z.string().url().optional().or(z.literal("")),
    youtube: z.string().url().optional().or(z.literal("")),
  }).optional(),
}).partial(); // Tous les champs sont optionnels pour permettre des mises à jour partielles

export const UpdateOrganizationInput = z.object({
  company_website_url: urlSchema.optional(),
  brand_logo_url: z.string().url().optional().or(z.literal("")),
  brand_primary_color: z.string().optional(),
  sender_profile: SenderProfile.optional(),
  compliance: Compliance.optional(),
  enrichment_snapshot: EnrichmentSnapshotInput.optional(), // Permettre mise à jour manuelle du snapshot
});

export type CreateOrganizationInput = z.infer<typeof CreateOrganizationInput>;
export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationInput>;
export type EnrichmentSnapshotInput = z.infer<typeof EnrichmentSnapshotInput>;

/** ENRICHMENT REFRESH **/
export const EnrichmentRefreshInput = z.object({
  force: z.boolean().optional(), // optionnel
});

/** ENRICHMENT EVENT (pour EventBridge) **/
export const EnrichmentEventInput = z.object({
  org_id: z.string().min(1),
  company_domain: z.string().min(1),
  company_website_url: z.string().url(),
  user_position: z.string().optional(),
});

export type EnrichmentEventInput = z.infer<typeof EnrichmentEventInput>;

/** CAMPAIGNS **/
export const CreateCampaignInput = z.object({
  org_id: z.string().min(1),
  name: z.string().min(1),
  language: z.enum(["en", "fr", "ar"]),
  objective_type: z.enum(["lead_gen", "recruiting", "other"]),
  objective_details: z.string().min(1),
  target_persona: z.string().min(1),
  personalization_focus: z.string().optional(),
  company_context_source: z.enum(["org_snapshot", "custom_override"]).default("org_snapshot"),
  company_context: z.object({
    about: z.string().optional(),
    value_props: z.array(z.string()).optional(),
  }).optional()
});

export const UpdateCampaignInput = CreateCampaignInput.partial().extend({
  status: z.enum(["draft", "ready", "launched"]).optional(),
});

export type CreateCampaignInput = z.infer<typeof CreateCampaignInput>;
export type UpdateCampaignInput = z.infer<typeof UpdateCampaignInput>;
