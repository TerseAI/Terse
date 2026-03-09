import "dotenv/config"

console.error("[migrate-secrets] Deprecated: GSM hard cutover is active and DB secret columns were removed.")
console.error("[migrate-secrets] No migration is required. Secrets must now be managed in Google Secret Manager only.")
process.exit(1)
