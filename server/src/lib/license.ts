export const LICENSE_FAMILIES = [
  "MIT",
  "Apache-2.0",
  "GPL family",
  "BSD family",
  "MPL-2.0",
  "Other",
] as const;

export type LicenseFamily = (typeof LICENSE_FAMILIES)[number];

export function licenseFamily(license: string): LicenseFamily {
  if (license.includes("GPL")) return "GPL family";
  if (license.startsWith("MIT")) return "MIT";
  if (license.includes("Apache")) return "Apache-2.0";
  if (license.includes("BSD")) return "BSD family";
  if (license.includes("MPL")) return "MPL-2.0";
  return "Other";
}
