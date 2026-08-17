import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CATALOG_PATH = path.join(__dirname, 'mcp-catalog.json');
const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let _catalogCache = null;
let _catalogCachedAt = 0;

export function normalizeMcpMarketplaceCommand(command) {
  if (!Array.isArray(command)) return undefined;
  const normalized = command
    .flatMap((part) => (Array.isArray(part) ? part : [part]))
    .filter((part) => typeof part === 'string')
    .map((part) => part.trim())
    .filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeMcpMarketplaceIntegrations(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const command = normalizeMcpMarketplaceCommand(item.command);
      if (command) return { ...item, command };
      const { command: _command, ...integration } = item;
      return integration;
    });
}

/**
 * Fetch catalog from live registry URL (env: MARKETPLACE_REGISTRY_URL),
 * falling back to the local mcp-catalog.json on error.
 */
async function fetchCatalogFromRegistry() {
  const registryUrl = process.env.MARKETPLACE_REGISTRY_URL;
  if (!registryUrl) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${registryUrl.replace(/\/+$/, '')}/catalog.json`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.integrations) ? data.integrations : Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

/**
 * Read integrations from the local catalog file.
 */
function readLocalCatalog() {
  try {
    if (!fs.existsSync(CATALOG_PATH)) return [];
    const raw = fs.readFileSync(CATALOG_PATH, 'utf8');
    const data = JSON.parse(raw);
    return data.integrations || [];
  } catch (error) {
    console.error('[MCP Marketplace] Failed to read local catalog:', error);
    return [];
  }
}

/**
 * Get all available integrations — tries registry first, falls back to local.
 * Results are cached for CATALOG_CACHE_TTL_MS to avoid hammering the registry.
 */
export async function getMcpMarketplaceIntegrations() {
  const now = Date.now();
  if (_catalogCache && now - _catalogCachedAt < CATALOG_CACHE_TTL_MS) {
    return _catalogCache;
  }

  const remote = await fetchCatalogFromRegistry();
  const integrations = normalizeMcpMarketplaceIntegrations(remote ?? readLocalCatalog());
  _catalogCache = integrations;
  _catalogCachedAt = now;
  return integrations;
}

/**
 * Invalidate the in-memory catalog cache (e.g. after a manual refresh).
 */
export function invalidateCatalogCache() {
  _catalogCache = null;
  _catalogCachedAt = 0;
}

/**
 * Get a single integration by ID.
 */
export async function getMcpMarketplaceIntegration(id) {
  const integrations = await getMcpMarketplaceIntegrations();
  return integrations.find((item) => item.id === id) || null;
}

/**
 * Search the marketplace.
 */
export async function searchMcpMarketplace(query) {
  const integrations = await getMcpMarketplaceIntegrations();
  if (!query) return integrations;
  const normalizedQuery = query.toLowerCase();
  return integrations.filter(
    (item) =>
      (item.name || item.displayName || '').toLowerCase().includes(normalizedQuery) ||
      (item.description || '').toLowerCase().includes(normalizedQuery) ||
      (item.category || '').toLowerCase().includes(normalizedQuery),
  );
}
