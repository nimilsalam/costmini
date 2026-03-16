/**
 * Composition-based drug matching system
 *
 * Normalizes drug compositions into a canonical key so that
 * "Pantoprazole(40.0 Mg)" from PharmEasy matches "Pantoprazole 40mg" from 1mg.
 *
 * Groups drugs by composition+form so users can compare prices across brands.
 */

// Common salt name aliases (same molecule, different names)
const SALT_ALIASES: Record<string, string> = {
  "acetaminophen": "paracetamol",
  "paracetamol / acetaminophen": "paracetamol",
  "amoxycillin / amoxicillin": "amoxicillin",
  "amoxycillin": "amoxicillin",
  "dicycloverine / dicyclomine": "dicyclomine",
  "dicycloverine": "dicyclomine",
  "vitamin d3 / cholecalciferol": "cholecalciferol",
  "vitamin d3": "cholecalciferol",
  "cholecalciferol": "cholecalciferol",
  "levosalbutamol / levalbuterol": "levalbuterol",
  "dextromethorphan / dextromethorphan hydrobromide": "dextromethorphan",
  "s-amlodipine": "s-amlodipine",
  "amlodipine": "amlodipine",
  "esomeprazole": "esomeprazole",
  "methylcobalamin / mecobalamin": "methylcobalamin",
  "clopidogrel / clopidogrel bisulphate": "clopidogrel",
};

// Normalize a salt/molecule name
function normalizeSalt(salt: string): string {
  let s = salt.toLowerCase().trim();
  // Remove common suffixes that don't affect identity
  s = s.replace(/\s*(hydrochloride|hcl|dihydrate|monohydrate|sodium|potassium|calcium|besylate|maleate|fumarate|succinate|tartrate|mesylate|tosylate|acetate|phosphate|sulphate|sulfate|nitrate|citrate|bromide|iodide)\s*/g, " ").trim();
  // Check alias map
  return SALT_ALIASES[s] || s;
}

// Parse a strength string like "40.0 Mg" or "500mg" → { value: number, unit: string }
function parseStrength(str: string): { value: number; unit: string } | null {
  const match = str.match(/([\d.]+)\s*(mg|g|ml|mcg|iu|%\s*w\/v|%\s*w\/w|%|units?)/i);
  if (!match) return null;
  return {
    value: parseFloat(match[1]),
    unit: match[2].toLowerCase().replace(/\s+/g, ""),
  };
}

export interface CompositionComponent {
  salt: string;        // Normalized salt name
  rawSalt: string;     // Original salt name
  strength: string;    // e.g. "40mg"
  value: number;       // e.g. 40
  unit: string;        // e.g. "mg"
}

export interface ParsedComposition {
  components: CompositionComponent[];
  compositionKey: string;     // Canonical key for matching
  displayName: string;        // Human-readable name
}

/**
 * Parse a composition string into normalized components
 *
 * Handles formats:
 * - "Pantoprazole(40.0 Mg)" (PharmEasy)
 * - "Paracetamol 650mg" (curated)
 * - "Ibuprofen 400mg + Paracetamol 325mg" (curated)
 * - "Pantoprazole(40.0 Mg)+Domperidone(30.0 Mg)" (PharmEasy)
 * - "PARACETAMOL / ACETAMINOPHEN" (generic name, no strength)
 * - "Levocetirizine(2.5 Mg)+Phenylephrine(10.0 Mg)+Paracetamol..." (multi)
 */
export function parseComposition(composition: string): ParsedComposition {
  if (!composition || composition === "Unknown") {
    return { components: [], compositionKey: "", displayName: "" };
  }

  // Split by + (separator between molecules)
  const parts = composition.split(/\s*\+\s*/);
  const components: CompositionComponent[] = [];

  for (const part of parts) {
    let salt = "";
    let strengthStr = "";
    let value = 0;
    let unit = "mg";

    // Format: "Pantoprazole(40.0 Mg)"
    const bracketMatch = part.match(/^(.+?)\s*\(([\d.]+\s*\w+(?:\/\w+)?)\)/);
    if (bracketMatch) {
      salt = bracketMatch[1].trim();
      strengthStr = bracketMatch[2].trim();
    } else {
      // Format: "Paracetamol 650mg" or "Paracetamol 650 mg"
      const spaceMatch = part.match(/^(.+?)\s+([\d.]+\s*(?:mg|g|ml|mcg|iu|%|units?))/i);
      if (spaceMatch) {
        salt = spaceMatch[1].trim();
        strengthStr = spaceMatch[2].trim();
      } else {
        // Just salt name, no strength
        salt = part.trim();
      }
    }

    if (!salt) continue;

    // Parse strength
    const parsed = parseStrength(strengthStr);
    if (parsed) {
      value = parsed.value;
      unit = parsed.unit;
      strengthStr = `${parsed.value}${parsed.unit}`;
    }

    const normalizedSalt = normalizeSalt(salt);

    components.push({
      salt: normalizedSalt,
      rawSalt: salt,
      strength: strengthStr,
      value,
      unit,
    });
  }

  // Sort components alphabetically for consistent keys
  const sorted = [...components].sort((a, b) => a.salt.localeCompare(b.salt));

  // Build canonical key
  const compositionKey = sorted
    .map((c) => `${c.salt}-${c.strength}`)
    .join("+")
    .toLowerCase()
    .replace(/[^a-z0-9+\-.]/g, "");

  // Build display name
  const displayName = components
    .map((c) => {
      const name = c.rawSalt.split("/")[0].trim();
      const capName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
      return c.strength ? `${capName} ${c.strength.toUpperCase()}` : capName;
    })
    .join(" + ");

  return { components, compositionKey, displayName };
}

/**
 * Normalize a dosage form for grouping
 */
export function normalizeDosageForm(form: string): string {
  const f = form.toUpperCase().trim();
  if (f.includes("TABLET") || f === "TAB") return "tablet";
  if (f.includes("CAPSULE") || f === "CAP") return "capsule";
  if (f.includes("SYRUP")) return "syrup";
  if (f.includes("INJECTION") || f === "INJ") return "injection";
  if (f.includes("CREAM")) return "cream";
  if (f.includes("OINTMENT")) return "ointment";
  if (f.includes("GEL")) return "gel";
  if (f.includes("DROP")) return "drops";
  if (f.includes("SUSPENSION") || f.includes("SUSP")) return "suspension";
  if (f.includes("INHALER")) return "inhaler";
  if (f.includes("SPRAY")) return "spray";
  if (f.includes("POWDER") || f.includes("SACHET")) return "powder";
  if (f.includes("LOTION")) return "lotion";
  return "other";
}

/**
 * Generate a full matching key: composition + dosage form
 * This groups all brands of "Pantoprazole 40mg Tablet" together
 */
export function getMatchingKey(composition: string, dosageForm: string): string {
  const parsed = parseComposition(composition);
  if (!parsed.compositionKey) return "";

  const form = normalizeDosageForm(dosageForm);
  return `${parsed.compositionKey}::${form}`;
}

/**
 * Get a human-readable group name
 */
export function getGroupDisplayName(composition: string, dosageForm: string): string {
  const parsed = parseComposition(composition);
  if (!parsed.displayName) return "";

  const form = dosageForm.charAt(0).toUpperCase() + dosageForm.slice(1).toLowerCase();
  return `${parsed.displayName} ${form}`;
}
