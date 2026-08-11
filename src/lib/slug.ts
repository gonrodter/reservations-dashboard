/**
 * The reservation backend resolves a booking by restaurantSlug, and for
 * production restaurants that slug is the restaurant's own domain. Everything
 * a superadmin might paste — a full URL, a www host, a trailing slash — has to
 * collapse to the same canonical value.
 */
export function normalizeDomain(input: string): string {
  let value = input.trim().toLowerCase();

  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, ""); // protocol
  value = value.replace(/^[^@/]*@/, ""); // credentials
  value = value.split(/[/?#]/)[0]; // path, query, fragment
  value = value.replace(/:\d+$/, ""); // port
  value = value.replace(/^www\./, "");
  value = value.replace(/\.+$/, ""); // trailing dots

  return value;
}

/** A domain is usable as a slug when it has a label, a dot and a real TLD. */
export function isValidDomain(domain: string): boolean {
  if (domain.length === 0 || domain.length > 253) return false;
  return /^(?!-)[a-z0-9-]+(?<!-)(\.(?!-)[a-z0-9-]+(?<!-))*\.[a-z]{2,}$/.test(domain);
}
