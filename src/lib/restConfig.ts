/**
 * Config REST brute pour les appels fetch directs (keepalive, batch inserts)
 * — import.meta.env n'est pas lisible sous ts-jest CJS, d'où ce module testé
 * via le même chemin que le runtime Vite.
 */
export const REST_URL = import.meta.env.VITE_SUPABASE_URL as string
export const REST_API_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string
