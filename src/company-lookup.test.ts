import assert from "node:assert/strict";
import { normalizeTaxNumber, mapViesResponse } from "./company-lookup.js";

// normalization: all accepted input shapes reduce to the 8-digit core
assert.equal(normalizeTaxNumber("10484878"), "10484878");
assert.equal(normalizeTaxNumber("10484878-2-44"), "10484878");
assert.equal(normalizeTaxNumber("HU10484878"), "10484878");
assert.equal(normalizeTaxNumber(" hu 10484878 "), "10484878");
assert.throws(() => normalizeTaxNumber("1234"), /Invalid Hungarian tax number/);
assert.throws(() => normalizeTaxNumber("HUABCDEFGH"), /Invalid Hungarian tax number/);

// VALID -> company data, charged
{
  const r = mapViesResponse("10484878", {
    isValid: true,
    userError: "VALID",
    name: "RICHTER GEDEON NYRT. ",
    address: " GYÖMRÖI U 19-21 1103 BUDAPEST",
  });
  assert.equal(r.vatValid, true);
  assert.equal(r.name, "RICHTER GEDEON NYRT.");
  assert.equal(r.address, "GYÖMRÖI U 19-21 1103 BUDAPEST");
}

// INVALID -> still a real answer (charged), with the VAT-group caveat
{
  const r = mapViesResponse("10537914", { isValid: false, userError: "INVALID" });
  assert.equal(r.vatValid, false);
  assert.match(r.note!, /VAT group/);
}

// service errors -> throw, so the payment wrapper cancels instead of settling
for (const userError of ["MS_UNAVAILABLE", "MS_MAX_CONCURRENT_REQ", "TIMEOUT"]) {
  assert.throws(() => mapViesResponse("10484878", { isValid: false, userError }), /VIES lookup failed/);
}

console.log("company-lookup.test.ts OK");
