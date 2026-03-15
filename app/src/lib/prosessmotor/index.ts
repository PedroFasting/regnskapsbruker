/**
 * Prosessmotor – Public API
 *
 * Re-eksporterer alt fra prosessmotoren for enkel import:
 *   import { genererSyklus, finnMatchendeRegel } from "@/lib/prosessmotor";
 */

export { lesRegelfil, lastAlleRegler, finnMatchendeRegel } from "./regler";
export { genererSyklus, genererSyklusFraRegel } from "./syklus";
