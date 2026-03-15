/**
 * Prosessmotor – Regelparser
 *
 * Leser YAML-regelfiler fra rules/-mappen og returnerer dem som
 * typede Regelkonfigurasjon-objekter.
 */

import fs from "fs";
import path from "path";
import YAML from "yaml";
import type { Regelkonfigurasjon, Selskapsattributter } from "@/types/prosessmotor";

const RULES_DIR = path.join(process.cwd(), "rules");

/**
 * Les og parse én regelfil fra disk.
 */
export function lesRegelfil(filePath: string): Regelkonfigurasjon {
  const content = fs.readFileSync(filePath, "utf-8");
  const parsed = YAML.parse(content) as Regelkonfigurasjon;
  return parsed;
}

/**
 * Last inn alle regelfiler fra rules/-mappen.
 */
export function lastAlleRegler(): Regelkonfigurasjon[] {
  if (!fs.existsSync(RULES_DIR)) {
    return [];
  }

  const files = fs
    .readdirSync(RULES_DIR)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

  return files.map((f) => lesRegelfil(path.join(RULES_DIR, f)));
}

/**
 * Finn den regelen som matcher et sett med selskapsattributter.
 *
 * Matching er eksakt: alle krav i regelen må stemme overens med
 * selskapets attributter. Returnerer undefined hvis ingen regel matcher.
 */
export function finnMatchendeRegel(
  attributter: Selskapsattributter
): Regelkonfigurasjon | undefined {
  const regler = lastAlleRegler();

  return regler.find((regel) => {
    const krav = regel.krav;
    return (
      krav.selskapstype === attributter.selskapstype &&
      krav.mva_registrert === attributter.mva_registrert &&
      krav.har_ansatte === attributter.har_ansatte &&
      krav.prosessmodell === attributter.prosessmodell
    );
  });
}
