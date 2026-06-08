// Backend (FastAPI) base URL. Defaults to the deployed Azure Container App; override with
// NEXT_PUBLIC_API_BASE for local dev (e.g. http://localhost:8000). `||` so an empty build-arg
// still falls back to the live API rather than same-origin.
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  "https://ca-api-taaq4xfj2gl.mangofield-bb2f9c8d.eastus2.azurecontainerapps.io";
