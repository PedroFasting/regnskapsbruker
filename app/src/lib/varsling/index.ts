/**
 * Varsling – Offentlig API
 *
 * Eksporterer hendelsesbaserte funksjoner som kan kalles fra API-rutene.
 * Alle funksjoner er fire-and-forget (fanger feil internt).
 */

export {
  varsleOmLevering,
  varsleOmTrengerMer,
  varsleOmGodkjenningKlar,
  varsleOmGodkjenning,
  varsleOmSpoersmaal,
} from "./motor";
