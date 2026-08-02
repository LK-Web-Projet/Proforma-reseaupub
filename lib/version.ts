/**
 * Numéro de version de l'application (semver — voir README.md, section "Versioning").
 * Source unique de vérité : le champ "version" de package.json, injecté au build
 * par next.config.ts (NEXT_PUBLIC_APP_VERSION). Ne jamais coder la version en dur ailleurs :
 * importer APP_VERSION depuis ce fichier partout où elle doit être affichée.
 */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
