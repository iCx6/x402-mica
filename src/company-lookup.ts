// Hungarian company verification via the official EU VIES REST API.
// ponytail: VIES only answers by tax number (no name search, no cégjegyzékszám,
// no officers) — upgrade path is the paid OCCSZ XML service or cegadatapi.hu
// if full company extracts are ever needed.

const VIES_URL = "https://ec.europa.eu/taxation_customs/vies/rest-api/ms/HU/vat/";

export interface CompanyVerification {
  taxNumber: string; // first 8 digits of the adószám
  vatValid: boolean;
  name?: string;
  address?: string;
  note?: string;
}

interface ViesResponse {
  isValid: boolean;
  userError: string;
  name?: string;
  address?: string;
}

/** Accepts "12345678", "12345678-1-23" or "HU12345678"; returns the 8-digit core. */
export function normalizeTaxNumber(input: string): string {
  const digits = input.trim().replace(/^HU/i, "").replace(/\D/g, "");
  if (digits.length < 8) {
    throw new Error(`Invalid Hungarian tax number "${input}" — need at least the first 8 digits`);
  }
  return digits.slice(0, 8);
}

export function mapViesResponse(taxNumber: string, res: ViesResponse): CompanyVerification {
  if (res.userError === "VALID") {
    return { taxNumber, vatValid: true, name: res.name?.trim(), address: res.address?.trim() };
  }
  if (res.userError === "INVALID") {
    return {
      taxNumber,
      vatValid: false,
      note:
        "No valid EU VAT registration for this tax number: the company does not exist, " +
        "was deregistered, or is a member of a Hungarian VAT group (áfa-csoport) — " +
        "VAT-group members always report as INVALID in VIES.",
    };
  }
  // MS_UNAVAILABLE, MS_MAX_CONCURRENT_REQ, TIMEOUT, ... — the lookup itself failed;
  // throwing makes the payment wrapper cancel instead of settle, so the caller is not charged.
  throw new Error(`VIES lookup failed: ${res.userError}`);
}

export async function verifyHungarianCompany(input: string): Promise<CompanyVerification> {
  const taxNumber = normalizeTaxNumber(input);
  const res = await fetch(VIES_URL + taxNumber, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`VIES HTTP ${res.status}`);
  return mapViesResponse(taxNumber, (await res.json()) as ViesResponse);
}
