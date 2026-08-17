import express from 'express';
import path from 'path';
import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import http from 'http';
import net from 'net';
import { Readable } from 'stream';
import { isDeepStrictEqual } from 'util';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import os from 'os';
import crypto from 'crypto';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createUiAuth } from './lib/opencode/ui-auth.js';
import {
  KRONOS_GATEWAY_WS_PATH,
  buildKronosGatewayBrowserUrl,
  proxyKronosGatewayConnection,
} from './lib/opencode/gateway-proxy.js';
import { createNocobaseUiAuth } from './lib/opencode/nocobase-auth.js';
import { createBusinessRouter } from './lib/business/index.js';
import { createCanvasState, registerCanvasRoutes } from './lib/canvas/index.js';
import { createOpsState, registerOpsRoutes } from './lib/ops/index.js';
import { createRuntimeState, registerRuntimeRoutes } from './lib/runtime/index.js';
import { createSocialRouter, createSocialState } from './lib/social/index.js';
import { createVideoRouter, createVideoState } from './lib/video/index.js';
import { autoStartServices, getServiceLogs, getServiceStatus, startPostiz, startSupoClip } from './lib/auto-start-services.js';
import { ensureSandboxMcpImageInstalled } from './lib/desktop-sandbox/sandbox-mcp-provider.js';
import { startCloudflareTunnel, printTunnelWarning, checkCloudflaredAvailable } from './lib/cloudflare-tunnel.js';
import { prepareNotificationLastMessage } from './lib/notifications/index.js';
import { getMcpMarketplaceIntegrations, getMcpMarketplaceIntegration, searchMcpMarketplace } from './lib/opencode/mcp-marketplace.js';
import {
  TERMINAL_INPUT_WS_MAX_PAYLOAD_BYTES,
  TERMINAL_INPUT_WS_PATH,
  createTerminalInputWsControlFrame,
  isRebindRateLimited,
  normalizeTerminalInputWsMessageToText,
  parseRequestPathname,
  pruneRebindTimestamps,
  readTerminalInputWsControlFrame,
} from './lib/terminal/index.js';
import { resolveEmbeddedWorkspace, scopeSettingsToEmbeddedWorkspace } from './lib/runtime/embedded-workspace.js';
import dotenv from 'dotenv';
dotenv.config();
import webPush from 'web-push';
import { registerMcpRoutes, setChamberBaseUrl, setWorkspaceToolHandlers } from './chamber-mcp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_PORT = 3000;
const DESKTOP_NOTIFY_PREFIX = '[OpenChamberDesktopNotify] ';
const uiNotificationClients = new Set();
const HEALTH_CHECK_INTERVAL = 15000;
const SHUTDOWN_TIMEOUT = 10000;
const MODELS_DEV_API_URL = 'https://models.dev/api.json';
const MODELS_METADATA_CACHE_TTL = 5 * 60 * 1000;
const MODELS_METADATA_SOURCE_HEADER = 'x-openchamber-metadata-source';
const MODELS_METADATA_FRESHNESS_HEADER = 'x-openchamber-metadata-freshness';
const MODELS_METADATA_STALE_HEADER = 'x-openchamber-metadata-stale';
const MODELS_METADATA_AGE_HEADER = 'x-openchamber-metadata-age';
const MODELS_METADATA_FAILURE_LOG_DEDUPE_MS = 15000;
const DESKTOP_APP_DISCOVERY_CACHE_TTL_MS = 15000;
const N8N_VENDOR_NODES_DIR = path.resolve(__dirname, '../../../vendor/n8n/source/packages/nodes-base/nodes');
const N8N_VENDOR_MANIFEST_PATH = path.resolve(__dirname, '../../../vendor/n8n/upstream-manifest.json');
const MACOS_APP_DIRECTORIES = Object.freeze(['/Applications', '/System/Applications', path.join(os.homedir(), 'Applications')]);
const EMBEDDED_KRONTERM_WORKSPACE = resolveEmbeddedWorkspace({
  env: process.env,
  isDirectory: (directory) => {
    try {
      return fs.statSync(directory).isDirectory();
    } catch {
      return false;
    }
  },
});

let n8nExecutionLibraryCache = null;
const chamberWorkflowRuns = new Map();

const toTitleCase = (value) =>
  String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const inferWorkflowExecutionFamily = (nodeType, categories = []) => {
  const haystack = `${nodeType || ''} ${categories.join(' ')}`.toLowerCase();
  if (haystack.includes('trigger') || haystack.includes('webhook')) return 'trigger';
  if (haystack.includes('transform') || haystack.includes('code') || haystack.includes('function')) return 'transform';
  if (haystack.includes('ai') || haystack.includes('openai') || haystack.includes('agent')) return 'agent';
  if (haystack.includes('communication') || haystack.includes('marketing')) return 'webhook';
  return 'runtime';
};

const walkFilesSync = (root, predicate, output = []) => {
  if (!fs.existsSync(root)) return output;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      walkFilesSync(absolutePath, predicate, output);
      continue;
    }
    if (predicate(absolutePath)) output.push(absolutePath);
  }
  return output;
};

const readJsonFileSync = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
};

const buildN8nExecutionLibrary = () => {
  if (n8nExecutionLibraryCache) return n8nExecutionLibraryCache;

  const manifest = readJsonFileSync(N8N_VENDOR_MANIFEST_PATH);
  const repoRoot = path.resolve(__dirname, '../../../');
  const nodeFiles = walkFilesSync(N8N_VENDOR_NODES_DIR, (filePath) => filePath.endsWith('.node.json'));
  const executions = nodeFiles
    .map((filePath) => {
      const payload = readJsonFileSync(filePath);
      if (!payload || typeof payload !== 'object') return null;
      const nodeType = typeof payload.node === 'string' ? payload.node : '';
      if (!nodeType) return null;

      const categories = Array.isArray(payload.categories) ? payload.categories.filter((item) => typeof item === 'string') : [];
      const aliases = Array.isArray(payload.alias) ? payload.alias.filter((item) => typeof item === 'string') : [];
      const relativePath = path.relative(repoRoot, filePath).split(path.sep).join('/');
      const baseName = path.basename(filePath).replace(/\.node\.json$/i, '');
      const label = toTitleCase(baseName) || nodeType.replace(/^n8n-nodes-base\./, '');
      const docsUrl =
        payload.resources?.primaryDocumentation?.find?.((item) => typeof item?.url === 'string')?.url ??
        payload.resources?.credentialDocumentation?.find?.((item) => typeof item?.url === 'string')?.url ??
        null;

      return {
        id: `n8n:${nodeType}`,
        source: 'n8n',
        label,
        nodeType,
        nodeVersion: typeof payload.nodeVersion === 'string' ? payload.nodeVersion : null,
        family: inferWorkflowExecutionFamily(nodeType, categories),
        categories,
        aliases,
        docsUrl,
        sourcePath: relativePath,
        description:
          categories.length > 0
            ? `${categories.join(' / ')} execution imported from n8n nodes-base.`
            : 'Execution imported from n8n nodes-base.',
        configTemplate: {
          node: nodeType,
          parameters: {},
          credentials: {},
        },
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.label.localeCompare(b.label));

  const categories = Array.from(new Set(executions.flatMap((item) => item.categories))).sort((a, b) => a.localeCompare(b));
  n8nExecutionLibraryCache = {
    source: 'n8n',
    imported: fs.existsSync(N8N_VENDOR_NODES_DIR),
    vendorPath: path.relative(repoRoot, N8N_VENDOR_NODES_DIR).split(path.sep).join('/'),
    manifest: manifest
      ? {
          commit: manifest.commit || null,
          fileCount: manifest.fileCount || null,
          importedAt: manifest.importedAt || null,
          guardrails: manifest.guardrails || null,
        }
      : null,
    count: executions.length,
    categories,
    executions,
  };
  return n8nExecutionLibraryCache;
};

const createChamberWorkflowRunID = () => `cwfr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const CHAMBER_PLAYBOOKS = Object.freeze([
  {
    id: 'plan_todo_task_bootstrap',
    name: 'Plan -> Todo -> Task Bootstrap',
    description: 'Legacy preset. Use the execution library for graph-first workflows.',
    nodes: [
      { nodeID: 'trigger', nodeType: 'manual.trigger', label: 'Objective Trigger', workflowStage: 'trigger', position: 0 },
      { nodeID: 'agent', nodeType: 'agent.run', label: 'Agent Planner', workflowStage: 'agent', position: 1 },
    ],
  },
  {
    id: 'todo_execution_cycle',
    name: 'Todo Execution Cycle',
    description: 'Legacy preset for todo-oriented run inspection.',
    nodes: [
      { nodeID: 'trigger', nodeType: 'manual.trigger', label: 'Todo Trigger', workflowStage: 'trigger', position: 0 },
      { nodeID: 'runtime', nodeType: 'runtime.action', label: 'Runtime Step', workflowStage: 'runtime', position: 1 },
    ],
  },
  {
    id: 'review_wrapup',
    name: 'Review + Wrap-up',
    description: 'Legacy preset for review-oriented run inspection.',
    nodes: [{ nodeID: 'review', nodeType: 'review.user_changes', label: 'Review', workflowStage: 'review', position: 0 }],
  },
]);

const createWorkflowReliability = (status, confidence, recoverable, suggestedNextAction) => ({
  status,
  confidence,
  recoverable,
  ...(suggestedNextAction ? { suggested_next_action: suggestedNextAction } : {}),
});

const sanitizeWorkflowStage = (value, fallback) => {
  const text = String(value || fallback || 'node').trim();
  return text.length > 0 ? text.slice(0, 80) : 'node';
};

const normalizeChamberGraph = (payload) => {
  const graph = payload?.graph && typeof payload.graph === 'object' ? payload.graph : null;
  const sourceNodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const sourceEdges = Array.isArray(graph?.edges) ? graph.edges : [];

  const nodes = sourceNodes
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null;
      const id = String(entry.id || `node_${index + 1}`).slice(0, 120);
      const label = String(entry.label || entry.name || id).slice(0, 160);
      const executor = String(entry.executor || entry.nodeType || entry.type || 'runtime.action').slice(0, 220);
      const family = String(entry.family || 'runtime').slice(0, 80);
      const stage = sanitizeWorkflowStage(entry.stage, label.toLowerCase().replace(/[^a-z0-9]+/gi, '_'));
      const config =
        entry.config && typeof entry.config === 'object' && !Array.isArray(entry.config)
          ? entry.config
          : entry.parameters && typeof entry.parameters === 'object' && !Array.isArray(entry.parameters)
            ? entry.parameters
            : {};
      return {
        workflow_run_id: '',
        node_id: id,
        node_type: executor,
        label,
        family,
        workflow_stage: stage,
        status: 'pending',
        position: index,
        time_started: undefined,
        time_completed: undefined,
        error: undefined,
        metadata: {
          config,
          position: entry.position || null,
        },
      };
    })
    .filter(Boolean);

  return {
    nodes,
    edges: sourceEdges
      .map((edge, index) => {
        if (!edge || typeof edge !== 'object') return null;
        return {
          id: String(edge.id || `edge_${index + 1}`),
          source: String(edge.source || ''),
          target: String(edge.target || ''),
        };
      })
      .filter((edge) => edge?.source && edge?.target),
  };
};

const createChamberRunFromRows = (run) => ({
  id: run.workflow_run_id,
  workflow_run_id: run.workflow_run_id,
  session_id: run.session_id,
  workflow_id: run.workflow_id,
  playbook_id: run.playbook_id,
  workflow_stage: run.workflow_stage,
  status: run.status,
  workflow_outcome: run.workflow_outcome,
  session_resume_token: run.session_resume_token,
  idempotency_key: run.idempotency_key,
  input: run.input,
  output: run.output,
  error: run.error,
  time: run.time,
  nodes: run.nodes.map((node) => ({ ...node, workflow_run_id: run.workflow_run_id })),
});

const updateChamberRun = (runID, patch) => {
  const run = chamberWorkflowRuns.get(runID);
  if (!run) return null;
  const next = {
    ...run,
    ...patch,
    time: {
      ...run.time,
      ...(patch.time || {}),
      updated: Date.now(),
    },
  };
  chamberWorkflowRuns.set(runID, next);
  return next;
};

const updateChamberNode = (runID, nodeID, patch) => {
  const run = chamberWorkflowRuns.get(runID);
  if (!run) return null;
  const nodes = run.nodes.map((node) => (node.node_id === nodeID ? { ...node, ...patch } : node));
  const next = { ...run, nodes, time: { ...run.time, updated: Date.now() } };
  chamberWorkflowRuns.set(runID, next);
  return next;
};

const runTerminalWorkflowNode = (config = {}) =>
  new Promise((resolve, reject) => {
    const command = typeof config.command === 'string' ? config.command.trim() : '';
    if (!command) {
      reject(new Error('terminal.exec requires config.command'));
      return;
    }

    const timeoutMs = Math.min(Math.max(Number(config.timeoutMs) || 30000, 1000), 120000);
    const cwd = typeof config.cwd === 'string' && config.cwd.trim() ? config.cwd.trim() : process.cwd();
    const child = spawn(process.env.SHELL || '/bin/zsh', ['-lc', command], {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`terminal.exec timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      if (stdout.length > 64_000) stdout = stdout.slice(-64_000);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 64_000) stderr = stderr.slice(-64_000);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr, cwd, command });
    });
  });

const runHttpWorkflowNode = async (config = {}) => {
  const url =
    typeof config.url === 'string'
      ? config.url
      : typeof config.parameters?.url === 'string'
        ? config.parameters.url
        : typeof config.request?.url === 'string'
          ? config.request.url
          : '';
  if (!url) {
    throw new Error('http request execution requires config.url or config.parameters.url');
  }

  const method = String(config.method || config.parameters?.method || 'GET').toUpperCase();
  const timeoutMs = Math.min(Math.max(Number(config.timeoutMs) || 30000, 1000), 120000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method,
      headers: config.headers && typeof config.headers === 'object' ? config.headers : undefined,
      body: typeof config.body === 'string' ? config.body : undefined,
      signal: controller.signal,
    });
    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await response.json().catch(() => null) : await response.text();
    return {
      status: response.status,
      ok: response.ok,
      contentType,
      body,
    };
  } finally {
    clearTimeout(timer);
  }
};

const executeChamberWorkflowNode = async (node, context) => {
  const executor = String(node.node_type || '').toLowerCase();
  const config = node.metadata?.config && typeof node.metadata.config === 'object' ? node.metadata.config : {};

  if (executor.includes('terminal') || executor.includes('command') || executor === 'terminal.exec') {
    const result = await runTerminalWorkflowNode(config);
    return {
      output: result,
      reliability: createWorkflowReliability(result.code === 0 ? 'success' : 'failed', result.code === 0 ? 0.92 : 0.35, true),
    };
  }

  if (executor.includes('httprequest') || executor.includes('http.request') || executor === 'n8n-nodes-base.httprequest') {
    const result = await runHttpWorkflowNode(config);
    return {
      output: result,
      reliability: createWorkflowReliability(result.ok ? 'success' : 'degraded', result.ok ? 0.9 : 0.55, true),
    };
  }

  if (executor.includes('manual') || executor.includes('trigger') || executor.includes('webhook')) {
    return {
      output: {
        ok: true,
        event: 'trigger.accepted',
        input: context.input,
      },
      reliability: createWorkflowReliability('success', 0.9, true),
    };
  }

  if (executor.includes('transform') || executor.includes('set')) {
    return {
      output: {
        ok: true,
        previous: context.previousOutput,
        mapper: config.mapper || config.expression || null,
      },
      reliability: createWorkflowReliability(
        config.mapper || config.expression ? 'degraded' : 'success',
        config.mapper || config.expression ? 0.68 : 0.9,
        true,
        config.mapper || config.expression
          ? 'Transform expressions are captured but not evaluated until the expression sandbox lands.'
          : undefined,
      ),
    };
  }

  if (executor.includes('approval')) {
    throw new Error('approval.wait requires the approval queue adapter before it can execute');
  }

  if (executor.startsWith('n8n-nodes-base.')) {
    throw new Error(`adapter_not_configured: ${node.node_type} requires a Chamber adapter and credentials before execution`);
  }

  return {
    output: {
      ok: true,
      nodeType: node.node_type,
      config,
      previous: context.previousOutput,
    },
    reliability: createWorkflowReliability('degraded', 0.62, true, 'Add a dedicated executor adapter for this node type.'),
  };
};

const runChamberWorkflow = async (runID) => {
  let run = chamberWorkflowRuns.get(runID);
  if (!run || !['queued', 'running'].includes(run.status)) return;
  const startedAt = Date.now();
  run = updateChamberRun(runID, {
    status: 'running',
    workflow_stage: run.nodes[0]?.workflow_stage || 'running',
    time: { started: startedAt },
  });

  const output = {};
  let previousOutput = run?.input || {};

  for (const node of run?.nodes || []) {
    const current = chamberWorkflowRuns.get(runID);
    if (!current || current.status === 'cancelled') {
      updateChamberNode(runID, node.node_id, {
        status: 'cancelled',
        error: 'Run cancelled',
        time_completed: Date.now(),
      });
      continue;
    }

    const nodeStart = Date.now();
    updateChamberRun(runID, { status: 'running', workflow_stage: node.workflow_stage });
    updateChamberNode(runID, node.node_id, { status: 'running', time_started: nodeStart });

    try {
      const execution = await executeChamberWorkflowNode(node, {
        run: current,
        input: current.input,
        output,
        previousOutput,
      });
      previousOutput = execution.output;
      output[node.node_id] = execution.output;
      updateChamberNode(runID, node.node_id, {
        status: 'completed',
        time_started: nodeStart,
        time_completed: Date.now(),
        metadata: {
          ...(node.metadata || {}),
          output: execution.output,
          reliability: execution.reliability,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      updateChamberNode(runID, node.node_id, {
        status: 'failed',
        time_started: nodeStart,
        time_completed: Date.now(),
        error: message,
        metadata: {
          ...(node.metadata || {}),
          reliability: createWorkflowReliability(
            'failed',
            0.25,
            true,
            'Configure this node adapter or replace it with an executable Chamber node.',
          ),
        },
      });
      updateChamberRun(runID, {
        status: 'failed',
        workflow_stage: node.workflow_stage,
        workflow_outcome: 'failed',
        output,
        error: message,
        time: { completed: Date.now() },
      });
      return;
    }
  }

  const latest = chamberWorkflowRuns.get(runID);
  if (!latest || latest.status === 'cancelled') return;
  updateChamberRun(runID, {
    status: 'completed',
    workflow_stage: 'complete',
    workflow_outcome: 'success',
    output,
    time: { completed: Date.now() },
  });
};

// Windows app directories
const WINDOWS_APP_DIRECTORIES = Object.freeze([
  path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WindowsApps'),
  path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
  'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs',
  'C:\\Program Files',
  'C:\\Program Files (x86)',
]);

// Linux app directories
const LINUX_APP_DIRECTORIES = Object.freeze([
  path.join(os.homedir(), '.local', 'share', 'applications'),
  '/usr/share/applications',
  '/usr/local/share/applications',
  '/var/lib/flatpak/exports/share/applications',
  path.join(os.homedir(), '.local', 'share', 'flatpak', 'exports', 'applications'),
]);
const MODELS_METADATA_FALLBACK = Object.freeze({
  opencode: {
    id: 'opencode',
    models: {
      'big-pickle': {
        id: 'big-pickle',
        name: 'big-pickle',
        tool_call: true,
        reasoning: true,
        temperature: true,
        attachment: true,
        modalities: {
          input: ['text'],
          output: ['text'],
        },
      },
    },
  },
});
const BROWSER_SESSION_CACHE_TTL_MS = 4000;
const BROWSER_STATE_FAILURE_THRESHOLD = 3;
const BROWSER_STATE_FAILURE_WINDOW_MS = 45000;
const BROWSER_STATE_RECOVERY_COOLDOWN_MS = 30000;
const CLIENT_RELOAD_DELAY_MS = 800;
const OPEN_CODE_READY_GRACE_MS = 12000;
const LONG_REQUEST_TIMEOUT_MS = 4 * 60 * 1000;
const OPENCLAW_DISCOVERY_TIMEOUT_MS = 8000;
const NOCOBASE_PROXY_BASE_PATH = '/business';
const SOCIAL_PROXY_BASE_PATH = '/social';
const VIDEO_PROXY_BASE_PATH = '/video';
const JAAZ_PROXY_BASE_PATH = '/imports/jaaz';
const DEFAULT_NOCOBASE_AUTHENTICATOR = 'basic';
const DEFAULT_NOCOBASE_APP = 'main';
const DEFAULT_NOCOBASE_TIMEOUT_MS = 12000;
const CREATIVE_JAAZ_DEFAULT_API_URL = 'https://jaaz.app/api/v1';
const CREATIVE_JAAZ_REQUEST_TIMEOUT_MS = (() => {
  const raw = Number(process.env.OPENCHAMBER_JAAZ_TIMEOUT_MS || process.env.KRONOSCHAMBER_JAAZ_TIMEOUT_MS);
  if (!Number.isFinite(raw) || raw <= 0) {
    return 120000;
  }
  return Math.max(15000, Math.min(10 * 60 * 1000, Math.round(raw)));
})();
const CREATIVE_JAAZ_POLL_INTERVAL_MS = (() => {
  const raw = Number(process.env.OPENCHAMBER_JAAZ_POLL_INTERVAL_MS || process.env.KRONOSCHAMBER_JAAZ_POLL_INTERVAL_MS);
  if (!Number.isFinite(raw) || raw <= 0) {
    return 2000;
  }
  return Math.max(500, Math.min(10000, Math.round(raw)));
})();
const CREATIVE_JAAZ_MAX_POLL_ATTEMPTS = (() => {
  const raw = Number(process.env.OPENCHAMBER_JAAZ_MAX_POLL_ATTEMPTS || process.env.KRONOSCHAMBER_JAAZ_MAX_POLL_ATTEMPTS);
  if (!Number.isFinite(raw) || raw <= 0) {
    return 150;
  }
  return Math.max(10, Math.min(600, Math.round(raw)));
})();
const CREATIVE_JAAZ_MAX_INPUT_IMAGES = 4;
const CREATIVE_JAAZ_COPILOT_POLL_INTERVAL_MS = (() => {
  const raw = Number(process.env.OPENCHAMBER_JAAZ_COPILOT_POLL_INTERVAL_MS);
  if (!Number.isFinite(raw) || raw <= 0) {
    return 1200;
  }
  return Math.max(500, Math.min(5000, Math.round(raw)));
})();
const CREATIVE_JAAZ_COPILOT_MAX_POLL_ATTEMPTS = (() => {
  const raw = Number(process.env.OPENCHAMBER_JAAZ_COPILOT_MAX_POLL_ATTEMPTS);
  if (!Number.isFinite(raw) || raw <= 0) {
    return 60;
  }
  return Math.max(10, Math.min(240, Math.round(raw)));
})();
const VERBOSE_SETTINGS_LOGS = process.env.OPENCHAMBER_VERBOSE_SETTINGS_LOGS === '1';
const VERBOSE_REQUEST_LOGS = process.env.OPENCHAMBER_VERBOSE_REQUEST_LOGS === '1';
const SETTINGS_PAYLOAD_CACHE_TTL_MS = 2000;
const AGENT_MODE_ALLOWED_VALUES = new Set(['off', 'sandbox', 'native']);
const DEFAULT_AGENT_MODE = 'sandbox';
const AGENT_MODE_TASK_TTL_MS = 30 * 60 * 1000;
const AGENT_MODE_TASK_TIMEOUT_MS = (() => {
  const raw = Number(process.env.OPENCHAMBER_AGENT_MODE_TIMEOUT_MS);
  if (!Number.isFinite(raw) || raw <= 0) {
    return 5 * 60 * 1000;
  }
  return Math.max(5000, Math.min(30 * 60 * 1000, Math.round(raw)));
})();
const fsPromises = fs.promises;

const findRepoRootPath = () => {
  const candidates = [
    path.resolve(__dirname, '..', '..', '..', '..'),
    path.resolve(__dirname, '..', '..', '..', '..', '..'),
    path.resolve(process.cwd()),
    path.resolve(process.cwd(), '..'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'third_party', 'upstream'))) {
      return candidate;
    }
  }

  return candidates[0];
};

const REPO_ROOT_PATH = findRepoRootPath();
const UPSTREAM_REPOS_PATH = path.join(REPO_ROOT_PATH, 'third_party', 'upstream');
const DEFAULT_FILE_SEARCH_LIMIT = 60;
const MAX_FILE_SEARCH_LIMIT = 400;
const FILE_SEARCH_MAX_CONCURRENCY = 5;
const FILE_SEARCH_EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.turbo',
  '.cache',
  'coverage',
  'tmp',
  'logs',
]);

async function bootstrapLocalDesktopSandbox() {
  const configuredProvider =
    typeof process.env.OPENCHAMBER_DESKTOP_SANDBOX_PROVIDER === 'string'
      ? process.env.OPENCHAMBER_DESKTOP_SANDBOX_PROVIDER.trim().toLowerCase()
      : '';

  if (configuredProvider && configuredProvider !== 'sandbox-mcp') {
    return;
  }

  try {
    const result = await ensureSandboxMcpImageInstalled({ logger: console });
    if (!result?.ok) return;

    if (!process.env.OPENCHAMBER_DESKTOP_SANDBOX_PROVIDER) {
      process.env.OPENCHAMBER_DESKTOP_SANDBOX_PROVIDER = 'sandbox-mcp';
    }
    if (!process.env.OPENCHAMBER_DESKTOP_SANDBOX_USE_BROKER) {
      process.env.OPENCHAMBER_DESKTOP_SANDBOX_USE_BROKER = 'false';
    }

    console.log(`[desktop-sandbox] defaulting to local provider ${process.env.OPENCHAMBER_DESKTOP_SANDBOX_PROVIDER}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[desktop-sandbox] local sandbox image bootstrap skipped: ${message}`);
  }
}

// Lock to prevent race conditions in persistSettings
let persistSettingsLock = Promise.resolve();
let recentSettingsPayloadCache = { key: '', expiresAt: 0, response: null };
const agentModeTasks = new Map();

const normalizeDirectoryPath = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (trimmed === '~') {
    return os.homedir();
  }

  if (trimmed.startsWith('~/') || trimmed.startsWith('~\\')) {
    return path.join(os.homedir(), trimmed.slice(2));
  }

  if (trimmed.startsWith('~')) {
    const match = trimmed.match(/^~([^/\\]+)(?:[/\\](.*))?$/);
    if (match) {
      const requestedUser = match[1];
      const restPath = match[2] || '';
      const currentHome = os.homedir();
      const currentUser = (() => {
        try {
          return os.userInfo().username;
        } catch {
          return null;
        }
      })();
      if (currentUser && requestedUser === currentUser) {
        return restPath ? path.join(currentHome, restPath) : currentHome;
      }
      if (process.platform === 'win32') {
        const usersRoot = path.dirname(currentHome);
        return restPath ? path.join(usersRoot, requestedUser, restPath) : path.join(usersRoot, requestedUser);
      }
      const usersRoot = currentHome.startsWith('/Users/') ? '/Users' : '/home';
      return restPath ? path.join(usersRoot, requestedUser, restPath) : path.join(usersRoot, requestedUser);
    }
  }

  return trimmed;
};

const normalizeAgentModeSetting = (value) => {
  if (typeof value !== 'string') {
    return DEFAULT_AGENT_MODE;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'off') {
    return 'off';
  }
  if (normalized === 'sandbox' || normalized === 'sandbox-mcp') {
    return 'sandbox';
  }
  if (normalized === 'openbrowser' || normalized === 'open-browser') {
    return 'sandbox';
  }
  if (normalized === 'native' || normalized === 'desktop-browser' || normalized === 'desktopbrowser') {
    return 'native';
  }
  return DEFAULT_AGENT_MODE;
};

const isSupportedAgentMode = (value) => {
  if (typeof value !== 'string') return false;
  return AGENT_MODE_ALLOWED_VALUES.has(value);
};

const extractCommandBinary = (command) => {
  if (typeof command !== 'string') return '';
  const trimmed = command.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('"')) {
    const end = trimmed.indexOf('"', 1);
    if (end > 1) {
      return trimmed.slice(1, end);
    }
  }

  if (trimmed.startsWith("'")) {
    const end = trimmed.indexOf("'", 1);
    if (end > 1) {
      return trimmed.slice(1, end);
    }
  }

  return trimmed.split(/\s+/)[0] || '';
};

const isCommandOnPath = (command) => {
  const binary = extractCommandBinary(command);
  if (!binary) return false;

  try {
    const lookup = process.platform === 'win32' ? 'where' : 'which';
    const result = spawnSync(lookup, [binary], { stdio: 'ignore' });
    return result.status === 0;
  } catch {
    return false;
  }
};

const truncateText = (value, maxLength = 12000) => {
  if (typeof value !== 'string') {
    return '';
  }
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}\n...[truncated ${value.length - maxLength} chars]`;
};

const runOpenClawCommand = async (args = []) => {
  if (!isCommandOnPath('openclaw')) {
    return {
      ok: false,
      code: null,
      stdout: '',
      stderr: 'openclaw CLI is not installed or not available on PATH',
      command: ['openclaw', ...args].join(' '),
    };
  }

  return await new Promise((resolve) => {
    const child = spawn('openclaw', args, {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, OPENCLAW_DISCOVERY_TIMEOUT_MS);

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    const finalize = (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({
        ok: !timedOut && code === 0,
        code: typeof code === 'number' ? code : null,
        stdout: truncateText(stdout.trim(), 16000),
        stderr: truncateText((timedOut ? `${stderr}\nCommand timed out` : stderr).trim(), 4000),
        command: ['openclaw', ...args].join(' '),
      });
    };

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({
        ok: false,
        code: null,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        command: ['openclaw', ...args].join(' '),
      });
    });

    child.on('close', (code) => finalize(code));
  });
};

const normalizeOptionalString = (value) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const resolveNocobaseOrigin = () => {
  const candidate =
    normalizeOptionalString(process.env.OPENCHAMBER_NOCOBASE_ORIGIN) ||
    normalizeOptionalString(process.env.KRONOSCHAMBER_NOCOBASE_ORIGIN) ||
    // Backward-compatible fallback for older env naming.
    normalizeOptionalString(process.env.OPENCHAMBER_NOCOBASE_URL) ||
    normalizeOptionalString(process.env.KRONOSCHAMBER_NOCOBASE_URL);
  if (!candidate) return null;
  return candidate.replace(/\/+$/, '');
};

const resolvePostizOrigin = () =>
  normalizeOptionalString(process.env.OPENCHAMBER_POSTIZ_ORIGIN) ||
  normalizeOptionalString(process.env.KRONOSCHAMBER_POSTIZ_ORIGIN) ||
  normalizeOptionalString(process.env.POSTIZ_ORIGIN) ||
  normalizeOptionalString(process.env.POSTIZ_URL) ||
  'http://localhost:4007';

const resolveSupoClipOrigin = () =>
  normalizeOptionalString(process.env.OPENCHAMBER_SUPOCLIP_ORIGIN) ||
  normalizeOptionalString(process.env.KRONOSCHAMBER_SUPOCLIP_ORIGIN) ||
  normalizeOptionalString(process.env.SUPOCLIP_ORIGIN) ||
  normalizeOptionalString(process.env.SUPOCLIP_URL) ||
  'http://localhost:4310';

const resolveNocobaseAuthenticator = () =>
  normalizeOptionalString(process.env.OPENCHAMBER_NOCOBASE_AUTHENTICATOR) ||
  normalizeOptionalString(process.env.KRONOSCHAMBER_NOCOBASE_AUTHENTICATOR) ||
  DEFAULT_NOCOBASE_AUTHENTICATOR;

const resolveNocobaseApp = () =>
  normalizeOptionalString(process.env.OPENCHAMBER_NOCOBASE_APP) ||
  normalizeOptionalString(process.env.KRONOSCHAMBER_NOCOBASE_APP) ||
  DEFAULT_NOCOBASE_APP;

const resolveNocobaseTimeoutMs = () => {
  const raw = Number(process.env.OPENCHAMBER_NOCOBASE_TIMEOUT_MS || process.env.KRONOSCHAMBER_NOCOBASE_TIMEOUT_MS);
  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_NOCOBASE_TIMEOUT_MS;
  }
  return Math.max(2000, Math.min(120000, Math.round(raw)));
};

const resolveJaazWorkspaceOrigin = () => {
  const candidate =
    normalizeOptionalString(process.env.OPENCHAMBER_JAAZ_APP_ORIGIN) ||
    normalizeOptionalString(process.env.KRONOSCHAMBER_JAAZ_APP_ORIGIN) ||
    normalizeOptionalString(process.env.JAAZ_APP_ORIGIN);
  if (!candidate) return null;
  return candidate.replace(/\/+$/, '');
};

const getUpstreamRepoStatus = (repoName) => {
  const repoPath = path.join(UPSTREAM_REPOS_PATH, repoName);
  const gitPath = path.join(repoPath, '.git');
  if (fs.existsSync(gitPath)) {
    return {
      available: true,
      health: 'available',
      reason: `${repoName} upstream checkout is present`,
      path: repoPath,
    };
  }
  return {
    available: false,
    health: 'unavailable',
    reason: `${repoName} upstream checkout is missing from third_party/upstream`,
    path: repoPath,
  };
};

const getBusinessWorkspaceStatus = (nocobaseOrigin) => {
  if (!nocobaseOrigin) {
    return {
      available: false,
      health: 'unavailable',
      reason: 'OPENCHAMBER_NOCOBASE_ORIGIN is not configured',
      setup: 'Set OPENCHAMBER_NOCOBASE_ORIGIN (or OPENCHAMBER_NOCOBASE_URL for compatibility) and NOCOBASE_DATABASE_URL',
    };
  }

  const hasDbUrl = Boolean(normalizeOptionalString(process.env.NOCOBASE_DATABASE_URL));
  return {
    available: true,
    health: hasDbUrl ? 'available' : 'degraded',
    reason: hasDbUrl ? 'NocoBase proxy configured' : 'NOCOBASE_DATABASE_URL is not configured in this process',
  };
};

const getSocialWorkspaceStatus = (postizOrigin) => ({
  available: true,
  health: 'available',
  upstreamProxyConfigured: Boolean(postizOrigin),
  reason: postizOrigin
    ? 'Postiz full-stack workspace proxy available'
    : 'Set OPENCHAMBER_POSTIZ_ORIGIN or enable OPENCHAMBER_AUTOSTART_POSTIZ to embed Postiz.',
});

const getVideoWorkspaceStatus = (supoClipOrigin) => ({
  available: true,
  health: 'available',
  upstreamProxyConfigured: Boolean(supoClipOrigin),
  reason: supoClipOrigin
    ? 'SupoClip full-stack workspace proxy available'
    : 'Set OPENCHAMBER_SUPOCLIP_ORIGIN or enable OPENCHAMBER_AUTOSTART_SUPOCLIP to embed SupoClip.',
});

const normalizeCapabilityStatus = (status) => {
  if (status === 'available' || status === 'degraded' || status === 'unavailable' || status === 'not_implemented') {
    return status;
  }
  return 'unavailable';
};

const capabilityFromAvailability = (available, health) => {
  if (available === true && health !== 'degraded') return 'available';
  if (available === true) return 'degraded';
  if (health === 'not_implemented') return 'not_implemented';
  if (health === 'degraded') return 'degraded';
  return 'unavailable';
};

const buildCapabilityRecord = ({
  id,
  title,
  surface,
  provider,
  status,
  message,
  actions = [],
  routes = [],
  evidence = {},
  setupAction = null,
  risk = 'low',
  provenance = null,
}) => ({
  id,
  title,
  surface,
  provider,
  status: normalizeCapabilityStatus(status),
  message: message || null,
  actions: Array.isArray(actions) ? actions.filter(Boolean) : [],
  routes: Array.isArray(routes) ? routes.filter(Boolean) : [],
  evidence: evidence && typeof evidence === 'object' ? evidence : {},
  setupAction: setupAction || null,
  risk,
  provenance,
  lastVerifiedAt: new Date().toISOString(),
});

const summarizeCapabilities = (capabilities) => {
  const summary = {
    total: capabilities.length,
    available: 0,
    degraded: 0,
    unavailable: 0,
    notImplemented: 0,
    bySurface: {},
  };

  for (const capability of capabilities) {
    if (capability.status === 'available') summary.available += 1;
    if (capability.status === 'degraded') summary.degraded += 1;
    if (capability.status === 'unavailable') summary.unavailable += 1;
    if (capability.status === 'not_implemented') summary.notImplemented += 1;
    const current = summary.bySurface[capability.surface] || {
      total: 0,
      available: 0,
      degraded: 0,
      unavailable: 0,
      notImplemented: 0,
    };
    current.total += 1;
    if (capability.status === 'available') current.available += 1;
    if (capability.status === 'degraded') current.degraded += 1;
    if (capability.status === 'unavailable') current.unavailable += 1;
    if (capability.status === 'not_implemented') current.notImplemented += 1;
    summary.bySurface[capability.surface] = current;
  }

  return summary;
};

const getDiskEvidence = (targetPath) => {
  try {
    if (typeof fs.statfsSync !== 'function') {
      return { available: null, reason: 'fs.statfsSync is unavailable in this runtime' };
    }
    const stats = fs.statfsSync(targetPath);
    const freeBytes = Number(stats.bavail || 0) * Number(stats.bsize || 0);
    const totalBytes = Number(stats.blocks || 0) * Number(stats.bsize || 0);
    return {
      available: true,
      path: targetPath,
      freeBytes,
      totalBytes,
      freeGb: Number((freeBytes / 1024 / 1024 / 1024).toFixed(2)),
      totalGb: Number((totalBytes / 1024 / 1024 / 1024).toFixed(2)),
    };
  } catch (error) {
    return {
      available: false,
      path: targetPath,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
};

const buildWorkspaceProxyMiddleware = (origin, basePath, label) =>
  createProxyMiddleware({
    target: origin,
    changeOrigin: true,
    ws: true,
    xfwd: true,
    secure: false,
    cookieDomainRewrite: {
      '*': '',
    },
    pathRewrite: (pathValue) => {
      const rewritten = pathValue.replace(new RegExp(`^${basePath}`), '');
      return rewritten.length > 0 ? rewritten : '/';
    },
    onError(error, _req, res) {
      const message = error instanceof Error ? error.message : `${label} workspace proxy failed`;
      if (!res.headersSent) {
        res.status(502).json({ error: message });
      }
    },
  });

const buildBusinessProxyMiddleware = (origin) => buildWorkspaceProxyMiddleware(origin, NOCOBASE_PROXY_BASE_PATH, 'Business');
const buildSocialProxyMiddleware = (origin) => buildWorkspaceProxyMiddleware(origin, SOCIAL_PROXY_BASE_PATH, 'Social');
const buildVideoProxyMiddleware = (origin) => buildWorkspaceProxyMiddleware(origin, VIDEO_PROXY_BASE_PATH, 'Video');

const buildJaazProxyMiddleware = (origin) =>
  createProxyMiddleware({
    target: origin,
    changeOrigin: true,
    ws: true,
    xfwd: true,
    secure: false,
    cookieDomainRewrite: {
      '*': '',
    },
    pathRewrite: (pathValue) => {
      const rewritten = pathValue.replace(/^\/imports\/jaaz/, '');
      return rewritten.length > 0 ? rewritten : '/';
    },
    onError(error, _req, res) {
      const message = error instanceof Error ? error.message : 'Jaaz import adapter proxy failed';
      if (!res.headersSent) {
        res.status(502).json({ error: message });
      }
    },
  });

const normalizeJaazApiBaseUrl = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const withoutTrailingSlash = trimmed.replace(/\/+$/, '');
  if (withoutTrailingSlash.endsWith('/api/v1')) {
    return withoutTrailingSlash;
  }
  return `${withoutTrailingSlash}/api/v1`;
};

const resolveCreativeJaazConfig = () => {
  const apiUrl =
    normalizeOptionalString(process.env.OPENCHAMBER_JAAZ_API_URL) ||
    normalizeOptionalString(process.env.KRONOSCHAMBER_JAAZ_API_URL) ||
    normalizeOptionalString(process.env.JAAZ_API_URL) ||
    normalizeOptionalString(process.env.BASE_API_URL) ||
    CREATIVE_JAAZ_DEFAULT_API_URL;
  const apiKey =
    normalizeOptionalString(process.env.OPENCHAMBER_JAAZ_API_KEY) ||
    normalizeOptionalString(process.env.KRONOSCHAMBER_JAAZ_API_KEY) ||
    normalizeOptionalString(process.env.JAAZ_API_KEY) ||
    normalizeOptionalString(process.env.OPENCHAMBER_JAAZ_TOKEN) ||
    normalizeOptionalString(process.env.KRONOSCHAMBER_JAAZ_TOKEN) ||
    normalizeOptionalString(process.env.JAAZ_API_TOKEN);

  return {
    apiUrl: normalizeJaazApiBaseUrl(apiUrl),
    apiKey: apiKey || null,
  };
};

const resolveCreativeJaazHttpBaseUrl = (apiUrl) => {
  const normalized = normalizeJaazApiBaseUrl(apiUrl || '');
  if (!normalized) {
    return 'https://jaaz.app';
  }
  return normalized.replace(/\/api\/v1$/, '');
};

const resolveCreativeJaazAuthToken = async () => {
  const fromDisk = await readJaazAuthFromDisk();
  if (typeof fromDisk.token === 'string' && fromDisk.token.length > 0) {
    return {
      token: fromDisk.token,
      source: 'stored',
      user: fromDisk.user || null,
      updatedAt: fromDisk.updatedAt || null,
    };
  }

  const config = resolveCreativeJaazConfig();
  if (config.apiKey) {
    return {
      token: config.apiKey,
      source: 'env',
      user: null,
      updatedAt: null,
    };
  }

  return {
    token: null,
    source: 'none',
    user: null,
    updatedAt: null,
  };
};

const safeJsonParse = (raw) => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const delayMs = async (ms) => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const isLikelyMediaUrl = (value) => {
  if (typeof value !== 'string') {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed) return false;
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('data:video/')
  );
};

const extractJaazErrorMessage = (payload) => {
  const candidates = [
    payload?.error,
    payload?.message,
    payload?.detail,
    payload?.data?.error,
    payload?.data?.message,
    payload?.data?.detail,
    payload?.task?.error,
    payload?.task?.message,
    payload?.data?.task?.error,
    payload?.data?.task?.message,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
};

const extractJaazTaskId = (payload) => {
  const candidates = [
    payload?.task_id,
    payload?.taskId,
    payload?.id,
    payload?.task?.id,
    payload?.task?.task_id,
    payload?.task?.taskId,
    payload?.data?.task_id,
    payload?.data?.taskId,
    payload?.data?.id,
    payload?.data?.task?.id,
    payload?.data?.task?.task_id,
    payload?.data?.task?.taskId,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
};

const extractJaazTaskStatus = (payload) => {
  const candidates = [payload?.status, payload?.task?.status, payload?.data?.status, payload?.data?.task?.status];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim().toLowerCase();
    }
  }
  return null;
};

const extractJaazMediaUrls = (payload) => {
  if (!payload) {
    return [];
  }

  const urls = new Set();
  const queue = [payload];
  const seen = new Set();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    if (typeof current === 'string') {
      if (isLikelyMediaUrl(current)) {
        urls.add(current.trim());
      }
      continue;
    }

    if (typeof current !== 'object') {
      continue;
    }

    if (seen.has(current)) {
      continue;
    }
    seen.add(current);

    if (Array.isArray(current)) {
      for (const item of current) {
        queue.push(item);
      }
      continue;
    }

    for (const [key, value] of Object.entries(current)) {
      if (typeof value === 'string') {
        const normalizedKey = key.trim().toLowerCase();
        if (
          normalizedKey.includes('url') ||
          normalizedKey.includes('image') ||
          normalizedKey.includes('video') ||
          normalizedKey.includes('result')
        ) {
          if (isLikelyMediaUrl(value)) {
            urls.add(value.trim());
          }
        }
        continue;
      }

      if (value && typeof value === 'object') {
        queue.push(value);
      }
    }
  }

  return Array.from(urls);
};

const normalizeCreativeMode = (value) => {
  if (typeof value !== 'string') return 'image';
  const normalized = value.trim().toLowerCase();
  return normalized === 'video' ? 'video' : 'image';
};

const normalizeCreativeAspectRatio = (value, mode) => {
  if (typeof value !== 'string') {
    return mode === 'video' ? '16:9' : '1:1';
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === 'auto') {
    return mode === 'video' ? '16:9' : '1:1';
  }
  return value.trim();
};

const normalizeCreativeQuantity = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }
  return Math.max(1, Math.min(8, Math.round(parsed)));
};

const normalizeCreativeDuration = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 5;
  }
  return Math.max(2, Math.min(15, Math.round(parsed)));
};

const normalizeCreativeInputImages = (body) => {
  const urls = [];
  const pushCandidate = (candidate) => {
    if (typeof candidate !== 'string') return;
    const normalized = candidate.trim();
    if (!isLikelyMediaUrl(normalized)) return;
    urls.push(normalized);
  };

  if (Array.isArray(body?.inputImages)) {
    for (const candidate of body.inputImages) {
      pushCandidate(candidate);
    }
  }

  if (Array.isArray(body?.attachments)) {
    for (const attachment of body.attachments) {
      if (!attachment || typeof attachment !== 'object') continue;
      pushCandidate(attachment.dataUrl);
      pushCandidate(attachment.url);
    }
  }

  return Array.from(new Set(urls)).slice(0, CREATIVE_JAAZ_MAX_INPUT_IMAGES);
};

const requestJaazApi = async ({ apiUrl, apiKey, route, method = 'POST', payload, timeoutMs = CREATIVE_JAAZ_REQUEST_TIMEOUT_MS }) => {
  const normalizedRoute = route.startsWith('/') ? route : `/${route}`;
  const target = `${apiUrl}${normalizedRoute}`;
  const headers = {
    Accept: 'application/json, text/plain;q=0.9',
    Authorization: `Bearer ${apiKey}`,
  };
  if (payload !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(target, {
    method,
    headers,
    body: payload === undefined ? undefined : JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const raw = await response.text().catch(() => '');
  const json = safeJsonParse(raw);
  if (!response.ok) {
    const upstreamMessage = extractJaazErrorMessage(json) || raw || `HTTP ${response.status}`;
    throw new Error(`JAAZ request failed (${response.status}): ${truncateText(upstreamMessage, 800)}`);
  }

  return {
    status: response.status,
    target,
    raw,
    json,
  };
};

const waitForJaazTaskCompletion = async (config, taskId) => {
  for (let attempt = 0; attempt < CREATIVE_JAAZ_MAX_POLL_ATTEMPTS; attempt += 1) {
    const response = await requestJaazApi({
      apiUrl: config.apiUrl,
      apiKey: config.apiKey,
      route: `/task/${encodeURIComponent(taskId)}`,
      method: 'GET',
      payload: undefined,
      timeoutMs: Math.max(CREATIVE_JAAZ_REQUEST_TIMEOUT_MS, 30000),
    });

    const status = extractJaazTaskStatus(response.json);
    if (!status) {
      const urls = extractJaazMediaUrls(response.json);
      if (urls.length > 0) {
        return { ...response, status: 'succeeded' };
      }
    }

    if (status === 'succeeded' || status === 'success' || status === 'completed' || status === 'done') {
      return { ...response, status };
    }

    if (status === 'failed' || status === 'error' || status === 'cancelled') {
      const errorMessage = extractJaazErrorMessage(response.json) || `Task ${taskId} failed with status ${status}`;
      throw new Error(errorMessage);
    }

    if (attempt < CREATIVE_JAAZ_MAX_POLL_ATTEMPTS - 1) {
      await delayMs(CREATIVE_JAAZ_POLL_INTERVAL_MS);
    }
  }

  throw new Error(`JAAZ task ${taskId} timed out after ${CREATIVE_JAAZ_MAX_POLL_ATTEMPTS} polling attempts`);
};

const requestJaazHttpApi = async ({
  baseUrl,
  route,
  method = 'GET',
  payload,
  token = null,
  requireAuth = true,
  timeoutMs = CREATIVE_JAAZ_REQUEST_TIMEOUT_MS,
}) => {
  const normalizedBase = typeof baseUrl === 'string' && baseUrl.trim().length > 0 ? baseUrl.replace(/\/+$/, '') : 'https://jaaz.app';
  const normalizedRoute = route.startsWith('/') ? route : `/${route}`;
  const target = `${normalizedBase}${normalizedRoute}`;
  const headers = {
    Accept: 'application/json, text/plain;q=0.9',
  };
  if (payload !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (requireAuth && typeof token === 'string' && token.trim().length > 0) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }

  const response = await fetch(target, {
    method,
    headers,
    body: payload === undefined ? undefined : JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const raw = await response.text().catch(() => '');
  const json = safeJsonParse(raw);
  if (!response.ok) {
    const upstreamMessage = extractJaazErrorMessage(json) || raw || `HTTP ${response.status}`;
    throw new Error(`JAAZ request failed (${response.status}): ${truncateText(upstreamMessage, 800)}`);
  }

  return { status: response.status, target, raw, json };
};

const normalizeJaazCopilotMessages = (messages) => {
  if (!Array.isArray(messages)) {
    return [];
  }

  const normalized = [];
  for (const candidate of messages) {
    if (!candidate || typeof candidate !== 'object') continue;
    const role = typeof candidate.role === 'string' ? candidate.role.trim().toLowerCase() : '';
    if (!role || (role !== 'user' && role !== 'assistant' && role !== 'tool')) continue;
    const text = typeof candidate.text === 'string' ? candidate.text : typeof candidate.content === 'string' ? candidate.content : '';
    const trimmed = text.trim();
    if (!trimmed) continue;
    normalized.push({ role, content: trimmed });
  }

  return normalized.slice(-20);
};

const extractJaazMessageText = (content) => {
  if (typeof content === 'string') {
    return content;
  }

  if (!Array.isArray(content)) {
    return '';
  }

  const segments = [];
  for (const part of content) {
    if (!part || typeof part !== 'object') continue;
    if (part.type === 'text' && typeof part.text === 'string' && part.text.trim().length > 0) {
      segments.push(part.text.trim());
      continue;
    }
    if (typeof part.content === 'string' && part.content.trim().length > 0) {
      segments.push(part.content.trim());
    }
  }

  return segments.join('\n\n').trim();
};

const extractJaazMessageMedia = (content) => {
  if (!Array.isArray(content)) {
    return [];
  }

  const outputs = [];
  for (const part of content) {
    if (!part || typeof part !== 'object') continue;
    if (part.type === 'image_url' && part.image_url && typeof part.image_url.url === 'string' && part.image_url.url.trim().length > 0) {
      outputs.push({
        kind: 'image',
        url: part.image_url.url.trim(),
      });
      continue;
    }
    if (part.type === 'video_url' && part.video_url && typeof part.video_url.url === 'string' && part.video_url.url.trim().length > 0) {
      outputs.push({
        kind: 'video',
        url: part.video_url.url.trim(),
      });
    }
  }

  return outputs;
};

const findLatestJaazAssistantMessage = (messages) => {
  if (!Array.isArray(messages)) {
    return null;
  }
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const candidate = messages[index];
    if (!candidate || typeof candidate !== 'object') continue;
    if (candidate.role === 'assistant') {
      return candidate;
    }
  }
  return null;
};

const pollJaazCopilotSession = async ({ baseUrl, token, sessionId }) => {
  for (let attempt = 0; attempt < CREATIVE_JAAZ_COPILOT_MAX_POLL_ATTEMPTS; attempt += 1) {
    const response = await requestJaazHttpApi({
      baseUrl,
      route: `/api/chat_session/${encodeURIComponent(sessionId)}`,
      method: 'GET',
      token,
      requireAuth: true,
      timeoutMs: Math.max(CREATIVE_JAAZ_REQUEST_TIMEOUT_MS, 30000),
    });
    const messages = Array.isArray(response.json) ? response.json : [];
    const assistant = findLatestJaazAssistantMessage(messages);
    const text = assistant ? extractJaazMessageText(assistant.content) : '';
    const media = assistant ? extractJaazMessageMedia(assistant.content) : [];

    if ((text && text.trim().length > 0) || media.length > 0) {
      return {
        status: 'ready',
        messages,
        assistant,
        assistantText: text,
        mediaOutputs: media,
      };
    }

    if (attempt < CREATIVE_JAAZ_COPILOT_MAX_POLL_ATTEMPTS - 1) {
      await delayMs(CREATIVE_JAAZ_COPILOT_POLL_INTERVAL_MS);
    }
  }

  return {
    status: 'pending',
    messages: [],
    assistant: null,
    assistantText: '',
    mediaOutputs: [],
  };
};

const resolveAgentModeConnectorConfig = (mode) => {
  if (mode === 'native') {
    return { mode, apiUrl: null, command: null };
  }

  if (mode === 'sandbox') {
    return {
      mode,
      apiUrl: normalizeOptionalString(process.env.OPENCHAMBER_SANDBOX_MCP_URL) || '/api/desktop-sandbox',
      command: null,
    };
  }

  return { mode, apiUrl: null, command: null };
};

const buildAgentModeConnectorStatus = (mode) => {
  if (mode === 'native') {
    const rawBackend = normalizeOptionalString(process.env.KRONOSCHAMBER_DESKTOP_BROWSER_BACKEND) || 'embedded-browseros-bridge';
    const backend = rawBackend === 'fallback' ? 'embedded-fallback' : rawBackend;
    const isFallback = backend === 'embedded-fallback';
    return {
      mode,
      provider: 'desktop',
      available: true,
      health: isFallback ? 'degraded' : 'available',
      apiConfigured: false,
      command: null,
      commandAvailable: true,
      endpoint: null,
      backend,
      backendError: isFallback ? 'BrowserOS embedded bridge is unavailable; using embedded desktop browser fallback.' : null,
      supportsSelection: !isFallback,
      supportsHighFidelityScreenshot: false,
    };
  }

  const config = resolveAgentModeConnectorConfig(mode);
  const commandAvailable = Boolean(config.command && isCommandOnPath(config.command));
  const provider = config.apiUrl ? 'api' : commandAvailable ? 'command' : 'none';
  const available = provider !== 'none';
  const health = available ? 'available' : 'degraded';
  const error = available
    ? null
    : mode === 'sandbox'
      ? 'Sandbox desktop is not configured. Check the local sandbox image and desktop sandbox server.'
      : 'Connector is not configured or unavailable.';

  return {
    mode,
    provider,
    available,
    health,
    error,
    apiConfigured: Boolean(config.apiUrl),
    command: config.command || null,
    commandAvailable,
    endpoint: config.apiUrl || null,
    backend: null,
    backendError: null,
    supportsSelection: false,
    supportsHighFidelityScreenshot: false,
  };
};

const DEFAULT_DESKTOP_AGENT_NAME = normalizeOptionalString(process.env.OPENCHAMBER_DESKTOP_AGENT_NAME) || 'hephaestus';

const resolveDesktopAgentName = (mode, requestedAgentName) => {
  const normalized = normalizeOptionalString(requestedAgentName);
  if (normalized) {
    return normalized;
  }

  if (mode === 'sandbox' || mode === 'native' || mode === 'openbrowser') {
    return DEFAULT_DESKTOP_AGENT_NAME;
  }

  return null;
};

const buildAgentModeInstructionBlock = (task) => {
  const connector = buildAgentModeConnectorStatus(task.mode);
  const lines = ['[Desktop Runtime Instructions]', `Mode: ${task.mode}`, `Agent: ${task.agentName || DEFAULT_DESKTOP_AGENT_NAME}`];

  if (task.mode === 'sandbox') {
    lines.push('Environment: Local XFCE sandbox managed by the Chamber desktop sandbox server.');
    lines.push("Use the sandbox only. Do not act on the user's host desktop.");
    lines.push('Primary tools: sandbox desktop control and bash inside the sandbox.');
  } else if (task.mode === 'native') {
    lines.push('Environment: User native desktop via the Chamber desktop bridge.');
    lines.push('Use native desktop MCP tools only. Do not launch or rely on the sandbox.');
  }

  if (connector.endpoint) {
    lines.push(`Connector endpoint: ${connector.endpoint}`);
  } else if (connector.command) {
    lines.push(`Connector command: ${connector.command}`);
  }

  lines.push(
    'Available tool surfaces: filesystem access, terminal/bash, connected KronosCode MCP providers, and the Chamber MCP server for desktop control.',
  );
  lines.push(
    'MCP access is not blocked. Use the MCP tools already exposed by KronosCode plus the Chamber desktop MCP surface that matches the selected mode.',
  );

  return `${lines.join('\n')}\n\n${task.prompt}`;
};

const buildAgentModeTaskPayload = (task) => ({
  taskID: task.taskID,
  mode: task.mode,
  prompt: buildAgentModeInstructionBlock(task),
  sessionID: task.sessionID || null,
  providerID: task.providerID || null,
  modelID: task.modelID || null,
  agentName: resolveDesktopAgentName(task.mode, task.agentName),
  background: true,
  startedAt: task.startedAt || Date.now(),
});

const AGENT_MODE_SESSION_ID_KEYS = ['runtimeSessionID', 'runtime_session_id', 'sessionID', 'sessionId', 'taskSessionID', 'taskSessionId'];

const AGENT_MODE_LIVE_URL_KEYS = ['liveUrl', 'live_url', 'streamUrl', 'stream_url', 'url'];

const readFirstStringField = (source, keys) => {
  if (!source || typeof source !== 'object') {
    return null;
  }

  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
};

const normalizeLogLines = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry) => entry.length > 0)
      .slice(0, 120);
  }

  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .slice(0, 120);
  }

  return [];
};

const normalizeArtifacts = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry, index) => {
      if (typeof entry === 'string') {
        const trimmed = entry.trim();
        if (!trimmed) {
          return null;
        }
        return {
          id: `artifact-${index + 1}`,
          name: null,
          path: trimmed,
          url: null,
          mimeType: null,
          size: null,
        };
      }
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const candidate = entry;
      const id = typeof candidate.id === 'string' && candidate.id.trim().length > 0 ? candidate.id.trim() : `artifact-${index + 1}`;
      const name = typeof candidate.name === 'string' && candidate.name.trim().length > 0 ? candidate.name.trim() : null;
      const path = typeof candidate.path === 'string' && candidate.path.trim().length > 0 ? candidate.path.trim() : null;
      const url = typeof candidate.url === 'string' && candidate.url.trim().length > 0 ? candidate.url.trim() : null;
      const mimeType = typeof candidate.mimeType === 'string' && candidate.mimeType.trim().length > 0 ? candidate.mimeType.trim() : null;
      const size = typeof candidate.size === 'number' && Number.isFinite(candidate.size) ? candidate.size : null;

      if (!path && !url) {
        return null;
      }

      return {
        id,
        name,
        path,
        url,
        mimeType,
        size,
      };
    })
    .filter(Boolean)
    .slice(0, 200);
};

const parseStructuredTaskOutput = (value) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const collectAgentModeRuntimeMetadata = (executionResult) => {
  const objects = [];
  if (executionResult && typeof executionResult === 'object') {
    objects.push(executionResult);
    if (executionResult.result && typeof executionResult.result === 'object') {
      objects.push(executionResult.result);
    }
    if (executionResult.structured && typeof executionResult.structured === 'object') {
      objects.push(executionResult.structured);
    }
    if (executionResult.data && typeof executionResult.data === 'object') {
      objects.push(executionResult.data);
    }
  }

  let runtimeSessionID = null;
  let liveUrl = null;
  const logs = [];
  const artifacts = [];

  for (const candidate of objects) {
    if (!runtimeSessionID) {
      runtimeSessionID = readFirstStringField(candidate, AGENT_MODE_SESSION_ID_KEYS);
    }
    if (!liveUrl) {
      liveUrl = readFirstStringField(candidate, AGENT_MODE_LIVE_URL_KEYS);
    }

    const candidateLogs = normalizeLogLines(candidate.logs || candidate.log);
    if (candidateLogs.length > 0) {
      logs.push(...candidateLogs);
    }

    const candidateArtifacts = normalizeArtifacts(candidate.artifacts || candidate.files || candidate.outputs);
    if (candidateArtifacts.length > 0) {
      artifacts.push(...candidateArtifacts);
    }
  }

  if (typeof executionResult?.stdout === 'string' && executionResult.stdout.trim().length > 0) {
    logs.push(...normalizeLogLines(executionResult.stdout));
  }
  if (typeof executionResult?.stderr === 'string' && executionResult.stderr.trim().length > 0) {
    logs.push(...normalizeLogLines(executionResult.stderr));
  }

  return {
    runtimeSessionID,
    liveUrl,
    logs: Array.from(new Set(logs)).slice(0, 120),
    artifacts: Array.from(
      new Map(artifacts.map((artifact) => [`${artifact.path || ''}|${artifact.url || ''}|${artifact.name || ''}`, artifact])).values(),
    ).slice(0, 120),
  };
};

const serializeAgentModeTask = (task) => ({
  taskID: task.taskID,
  mode: task.mode,
  status: task.status,
  success: typeof task.success === 'boolean' ? task.success : null,
  prompt: task.prompt,
  sessionID: task.sessionID ?? null,
  providerID: task.providerID ?? null,
  modelID: task.modelID ?? null,
  agentName: task.agentName ?? null,
  connector: task.connector ?? null,
  runtimeSessionID: task.runtimeSessionID ?? null,
  liveUrl: task.liveUrl ?? null,
  artifacts: Array.isArray(task.artifacts) ? task.artifacts : [],
  logs: Array.isArray(task.logs) ? task.logs : [],
  error: task.error ?? null,
  result: task.result ?? null,
  createdAt: task.createdAt ?? null,
  startedAt: task.startedAt ?? null,
  finishedAt: task.finishedAt ?? null,
  updatedAt: task.updatedAt ?? null,
});

const serializeRuntimeArtifactsForTask = (task) => {
  const artifacts = Array.isArray(task?.artifacts) ? task.artifacts : [];
  return artifacts.map((artifact, index) => ({
    id: typeof artifact?.id === 'string' ? artifact.id : `artifact-${index + 1}`,
    name: typeof artifact?.name === 'string' ? artifact.name : null,
    path: typeof artifact?.path === 'string' ? artifact.path : null,
    url: typeof artifact?.url === 'string' ? artifact.url : null,
    mimeType: typeof artifact?.mimeType === 'string' ? artifact.mimeType : null,
    size: typeof artifact?.size === 'number' && Number.isFinite(artifact.size) ? artifact.size : null,
    taskID: task?.taskID ?? null,
    sessionID: task?.sessionID ?? null,
    mode: task?.mode ?? null,
    prompt: typeof task?.prompt === 'string' ? task.prompt : null,
    updatedAt: typeof task?.updatedAt === 'number' ? task.updatedAt : null,
  }));
};

const inferMimeTypeFromPath = (filePath, fallback = 'application/octet-stream') => {
  const ext = path.extname(filePath || '').toLowerCase();
  const mimeMap = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.bmp': 'image/bmp',
    '.avif': 'image/avif',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
    '.m4v': 'video/mp4',
    '.mkv': 'video/x-matroska',
  };
  return mimeMap[ext] || fallback;
};

const broadcastAgentModeTaskEvent = (task, reason = 'updated') => {
  if (!task || typeof task !== 'object' || uiNotificationClients.size === 0) {
    return;
  }

  const payload = {
    type: 'openchamber:agent-mode-task',
    properties: {
      task: serializeAgentModeTask(task),
      reason,
      timestamp: Date.now(),
    },
  };

  for (const res of uiNotificationClients) {
    try {
      writeSseEvent(res, payload);
    } catch {
      // ignore
    }
  }
};

const broadcastRuntimeArtifactEvent = (task, reason = 'updated') => {
  if (!task || typeof task !== 'object' || uiNotificationClients.size === 0) {
    return;
  }

  const artifacts = serializeRuntimeArtifactsForTask(task);
  if (artifacts.length === 0) {
    return;
  }

  const payload = {
    type: 'openchamber:runtime-artifact',
    properties: {
      task: serializeAgentModeTask(task),
      artifacts,
      sessionID: task.sessionID ?? null,
      reason,
      timestamp: Date.now(),
    },
  };

  for (const res of uiNotificationClients) {
    try {
      writeSseEvent(res, payload);
    } catch {
      // ignore
    }
  }
};

const runAgentModeApiTask = async (endpointUrl, payload) => {
  const target = (() => {
    const trimmed = endpointUrl.trim().replace(/\/+$/, '');
    if (trimmed.endsWith('/task')) {
      return trimmed;
    }
    return `${trimmed}/task`;
  })();

  const response = await fetch(target, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain;q=0.9',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(AGENT_MODE_TASK_TIMEOUT_MS),
  });

  const rawBody = await response.text().catch(() => '');
  let parsedBody = null;
  if (rawBody) {
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      parsedBody = null;
    }
  }

  if (!response.ok) {
    const upstreamMessage =
      parsedBody && typeof parsedBody === 'object' && typeof parsedBody.error === 'string'
        ? parsedBody.error
        : rawBody || `HTTP ${response.status}`;
    throw new Error(`Connector API failed (${response.status}): ${truncateText(upstreamMessage, 500)}`);
  }

  return {
    type: 'api',
    endpoint: target,
    status: response.status,
    result: parsedBody ?? rawBody,
    rawBody: truncateText(rawBody, 24000),
  };
};

const runAgentModeCommandTask = async (command, payload) => {
  const shell = process.env.SHELL || (process.platform === 'win32' ? 'cmd.exe' : '/bin/sh');
  const shellFlag = process.platform === 'win32' ? '/c' : '-lc';

  return await new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const child = spawn(shell, [shellFlag, command], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        OPENCHAMBER_AGENT_MODE: payload.mode,
        OPENCHAMBER_AGENT_PROMPT: payload.prompt,
        OPENCHAMBER_AGENT_TASK_ID: payload.taskID,
        OPENCHAMBER_AGENT_SESSION_ID: payload.sessionID || '',
        OPENCHAMBER_AGENT_PROVIDER_ID: payload.providerID || '',
        OPENCHAMBER_AGENT_MODEL_ID: payload.modelID || '',
        OPENCHAMBER_AGENT_NAME: payload.agentName || '',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch {}
    }, AGENT_MODE_TASK_TIMEOUT_MS);

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on('close', (code, signal) => {
      clearTimeout(timeout);
      const exitCode = typeof code === 'number' ? code : -1;
      const trimmedStdout = stdout.trim();
      const trimmedStderr = stderr.trim();
      const structured = parseStructuredTaskOutput(trimmedStdout);
      const output = {
        type: 'command',
        command,
        exitCode,
        signal: signal || null,
        stdout: truncateText(trimmedStdout, 24000),
        stderr: truncateText(trimmedStderr, 12000),
        structured,
      };

      if (timedOut) {
        reject(new Error(`Connector command timed out after ${AGENT_MODE_TASK_TIMEOUT_MS}ms`));
        return;
      }

      if (exitCode !== 0) {
        const failure = trimmedStderr || trimmedStdout || `Connector command failed with exit code ${exitCode}`;
        reject(new Error(truncateText(failure, 1000)));
        return;
      }

      resolve(output);
    });

    try {
      child.stdin?.write(`${JSON.stringify(payload)}\n`);
      child.stdin?.end();
    } catch {
      try {
        child.stdin?.end();
      } catch {}
    }
  });
};

const pruneAgentModeTasks = () => {
  const now = Date.now();
  for (const [taskId, task] of agentModeTasks.entries()) {
    if (!task || typeof task !== 'object') {
      agentModeTasks.delete(taskId);
      continue;
    }
    const updatedAt = typeof task.updatedAt === 'number' ? task.updatedAt : 0;
    if (updatedAt > 0 && now - updatedAt > AGENT_MODE_TASK_TTL_MS) {
      agentModeTasks.delete(taskId);
    }
  }
};

const OPENCHAMBER_USER_CONFIG_ROOT = path.join(os.homedir(), '.config', 'openchamber');
const OPENCHAMBER_USER_THEMES_DIR = path.join(OPENCHAMBER_USER_CONFIG_ROOT, 'themes');

const MAX_THEME_JSON_BYTES = 512 * 1024;

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const isValidThemeColor = (value) => isNonEmptyString(value);

const normalizeThemeJson = (raw) => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const metadata = raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : null;
  const colors = raw.colors && typeof raw.colors === 'object' ? raw.colors : null;
  if (!metadata || !colors) {
    return null;
  }

  const id = metadata.id;
  const name = metadata.name;
  const variant = metadata.variant;
  if (!isNonEmptyString(id) || !isNonEmptyString(name) || (variant !== 'light' && variant !== 'dark')) {
    return null;
  }

  const primary = colors.primary;
  const surface = colors.surface;
  const interactive = colors.interactive;
  const status = colors.status;
  const syntax = colors.syntax;
  const syntaxBase = syntax && typeof syntax === 'object' ? syntax.base : null;
  const syntaxHighlights = syntax && typeof syntax === 'object' ? syntax.highlights : null;

  if (!primary || !surface || !interactive || !status || !syntaxBase || !syntaxHighlights) {
    return null;
  }

  // Minimal fields required by CSSVariableGenerator and diff/syntax rendering.
  const required = [
    primary.base,
    primary.foreground,
    surface.background,
    surface.foreground,
    surface.muted,
    surface.mutedForeground,
    surface.elevated,
    surface.elevatedForeground,
    surface.subtle,
    interactive.border,
    interactive.selection,
    interactive.selectionForeground,
    interactive.focusRing,
    interactive.hover,
    status.error,
    status.errorForeground,
    status.errorBackground,
    status.errorBorder,
    status.warning,
    status.warningForeground,
    status.warningBackground,
    status.warningBorder,
    status.success,
    status.successForeground,
    status.successBackground,
    status.successBorder,
    status.info,
    status.infoForeground,
    status.infoBackground,
    status.infoBorder,
    syntaxBase.background,
    syntaxBase.foreground,
    syntaxBase.keyword,
    syntaxBase.string,
    syntaxBase.number,
    syntaxBase.function,
    syntaxBase.variable,
    syntaxBase.type,
    syntaxBase.comment,
    syntaxBase.operator,
    syntaxHighlights.diffAdded,
    syntaxHighlights.diffRemoved,
    syntaxHighlights.lineNumber,
  ];

  if (!required.every(isValidThemeColor)) {
    return null;
  }

  const tags = Array.isArray(metadata.tags) ? metadata.tags.filter((tag) => typeof tag === 'string' && tag.trim().length > 0) : [];

  return {
    ...raw,
    metadata: {
      ...metadata,
      id: id.trim(),
      name: name.trim(),
      description: typeof metadata.description === 'string' ? metadata.description : '',
      version: typeof metadata.version === 'string' && metadata.version.trim().length > 0 ? metadata.version : '1.0.0',
      variant,
      tags,
    },
  };
};

const readCustomThemesFromDisk = async () => {
  try {
    const entries = await fsPromises.readdir(OPENCHAMBER_USER_THEMES_DIR, { withFileTypes: true });
    const themes = [];
    const seen = new Set();

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.toLowerCase().endsWith('.json')) continue;

      const filePath = path.join(OPENCHAMBER_USER_THEMES_DIR, entry.name);
      try {
        const stat = await fsPromises.stat(filePath);
        if (!stat.isFile()) continue;
        if (stat.size > MAX_THEME_JSON_BYTES) {
          console.warn(`[themes] Skip ${entry.name}: too large (${stat.size} bytes)`);
          continue;
        }

        const rawText = await fsPromises.readFile(filePath, 'utf8');
        const parsed = JSON.parse(rawText);
        const normalized = normalizeThemeJson(parsed);
        if (!normalized) {
          console.warn(`[themes] Skip ${entry.name}: invalid theme JSON`);
          continue;
        }

        const id = normalized.metadata.id;
        if (seen.has(id)) {
          console.warn(`[themes] Skip ${entry.name}: duplicate theme id "${id}"`);
          continue;
        }

        seen.add(id);
        themes.push(normalized);
      } catch (error) {
        console.warn(`[themes] Failed to read ${entry.name}:`, error);
      }
    }

    return themes;
  } catch (error) {
    // Missing dir is fine.
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return [];
    }
    console.warn('[themes] Failed to list custom themes dir:', error);
    return [];
  }
};

const isPathWithinRoot = (resolvedPath, rootPath) => {
  const resolvedRoot = path.resolve(rootPath || os.homedir());
  const relative = path.relative(resolvedRoot, resolvedPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return false;
  }
  return true;
};

const resolveWorkspacePath = (targetPath, baseDirectory) => {
  const normalized = normalizeDirectoryPath(targetPath);
  if (!normalized || typeof normalized !== 'string') {
    return { ok: false, error: 'Path is required' };
  }

  const resolved = path.resolve(normalized);
  const resolvedBase = path.resolve(baseDirectory || os.homedir());

  if (isPathWithinRoot(resolved, resolvedBase)) {
    return { ok: true, base: resolvedBase, resolved };
  }

  // Allow writing KronosChamber per-project config under ~/.config/openchamber.
  // LEGACY_PROJECT_CONFIG: migration target root; allowed outside workspace.
  if (isPathWithinRoot(resolved, OPENCHAMBER_USER_CONFIG_ROOT)) {
    return { ok: true, base: path.resolve(OPENCHAMBER_USER_CONFIG_ROOT), resolved };
  }

  return { ok: false, error: 'Path is outside of active workspace' };
};

const resolveWorkspacePathFromWorktrees = async (targetPath, baseDirectory) => {
  const normalized = normalizeDirectoryPath(targetPath);
  if (!normalized || typeof normalized !== 'string') {
    return { ok: false, error: 'Path is required' };
  }

  const resolved = path.resolve(normalized);
  const resolvedBase = path.resolve(baseDirectory || os.homedir());

  try {
    const { getWorktrees } = await import('./lib/git/index.js');
    const worktrees = await getWorktrees(resolvedBase);

    for (const worktree of worktrees) {
      const candidatePath =
        typeof worktree?.path === 'string' ? worktree.path : typeof worktree?.worktree === 'string' ? worktree.worktree : '';
      const candidate = normalizeDirectoryPath(candidatePath);
      if (!candidate) {
        continue;
      }
      const candidateResolved = path.resolve(candidate);
      if (isPathWithinRoot(resolved, candidateResolved)) {
        return { ok: true, base: candidateResolved, resolved };
      }
    }
  } catch (error) {
    console.warn('Failed to resolve worktree roots:', error);
  }

  return { ok: false, error: 'Path is outside of active workspace' };
};

const resolveWorkspacePathFromContext = async (req, targetPath) => {
  const resolvedProject = await resolveProjectDirectory(req);
  if (!resolvedProject.directory) {
    return { ok: false, error: resolvedProject.error || 'Active workspace is required' };
  }

  const resolved = resolveWorkspacePath(targetPath, resolvedProject.directory);
  if (resolved.ok || resolved.error !== 'Path is outside of active workspace') {
    return resolved;
  }

  return resolveWorkspacePathFromWorktrees(targetPath, resolvedProject.directory);
};

const normalizeRelativeSearchPath = (rootPath, targetPath) => {
  const relative = path.relative(rootPath, targetPath) || path.basename(targetPath);
  return relative.split(path.sep).join('/') || targetPath;
};

const shouldSkipSearchDirectory = (name, includeHidden) => {
  if (!name) {
    return false;
  }
  if (!includeHidden && name.startsWith('.')) {
    return true;
  }
  return FILE_SEARCH_EXCLUDED_DIRS.has(name.toLowerCase());
};

const listDirectoryEntries = async (dirPath) => {
  try {
    return await fsPromises.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
};

/**
 * Fuzzy match scoring function.
 * Returns a score > 0 if the query fuzzy-matches the candidate, null otherwise.
 * Higher scores indicate better matches.
 */
const fuzzyMatchScoreNormalized = (normalizedQuery, candidate) => {
  if (!normalizedQuery) return 0;

  const q = normalizedQuery;
  const c = candidate.toLowerCase();

  // Fast path: exact substring match gets high score
  if (c.includes(q)) {
    const idx = c.indexOf(q);
    // Bonus for match at start or after word boundary
    let bonus = 0;
    if (idx === 0) {
      bonus = 20;
    } else {
      const prev = c[idx - 1];
      if (prev === '/' || prev === '_' || prev === '-' || prev === '.' || prev === ' ') {
        bonus = 15;
      }
    }
    return 100 + bonus - Math.min(idx, 20) - Math.floor(c.length / 5);
  }

  // Fuzzy match: all query chars must appear in order
  let score = 0;
  let lastIndex = -1;
  let consecutive = 0;

  for (let i = 0; i < q.length; i++) {
    const ch = q[i];
    if (!ch || ch === ' ') continue;

    const idx = c.indexOf(ch, lastIndex + 1);
    if (idx === -1) {
      return null; // No match
    }

    const gap = idx - lastIndex - 1;
    if (gap === 0) {
      consecutive++;
    } else {
      consecutive = 0;
    }

    score += 10;
    score += Math.max(0, 18 - idx); // Prefer matches near start
    score -= Math.min(gap, 10); // Penalize gaps

    // Bonus for word boundary matches
    if (idx === 0) {
      score += 12;
    } else {
      const prev = c[idx - 1];
      if (prev === '/' || prev === '_' || prev === '-' || prev === '.' || prev === ' ') {
        score += 10;
      }
    }

    score += consecutive > 0 ? 12 : 0; // Bonus for consecutive matches
    lastIndex = idx;
  }

  // Prefer shorter paths
  score += Math.max(0, 24 - Math.floor(c.length / 3));

  return score;
};

const searchFilesystemFiles = async (rootPath, options) => {
  const { limit, query, includeHidden, respectGitignore } = options;
  const includeHiddenEntries = Boolean(includeHidden);
  const normalizedQuery = query.trim().toLowerCase();
  const matchAll = normalizedQuery.length === 0;
  const queue = [rootPath];
  const visited = new Set([rootPath]);
  const shouldRespectGitignore = respectGitignore !== false;
  // Collect more candidates for fuzzy matching, then sort and trim
  const collectLimit = matchAll ? limit : Math.max(limit * 3, 200);
  const candidates = [];

  while (queue.length > 0 && candidates.length < collectLimit) {
    const batch = queue.splice(0, FILE_SEARCH_MAX_CONCURRENCY);

    const dirResults = await Promise.all(
      batch.map(async (dir) => {
        if (!shouldRespectGitignore) {
          return { dir, dirents: await listDirectoryEntries(dir), ignoredPaths: new Set() };
        }

        try {
          const dirents = await listDirectoryEntries(dir);
          const pathsToCheck = dirents.map((dirent) => dirent.name).filter(Boolean);
          if (pathsToCheck.length === 0) {
            return { dir, dirents, ignoredPaths: new Set() };
          }

          const result = await new Promise((resolve) => {
            const child = spawn('git', ['check-ignore', '--', ...pathsToCheck], {
              cwd: dir,
              stdio: ['ignore', 'pipe', 'pipe'],
            });

            let stdout = '';
            child.stdout.on('data', (data) => {
              stdout += data.toString();
            });
            child.on('close', () => resolve(stdout));
            child.on('error', () => resolve(''));
          });

          const ignoredNames = new Set(
            String(result)
              .split('\n')
              .map((name) => name.trim())
              .filter(Boolean),
          );

          return { dir, dirents, ignoredPaths: ignoredNames };
        } catch {
          return { dir, dirents: await listDirectoryEntries(dir), ignoredPaths: new Set() };
        }
      }),
    );

    for (const { dir: currentDir, dirents, ignoredPaths } of dirResults) {
      for (const dirent of dirents) {
        const entryName = dirent.name;
        if (!entryName || (!includeHiddenEntries && entryName.startsWith('.'))) {
          continue;
        }

        if (shouldRespectGitignore && ignoredPaths.has(entryName)) {
          continue;
        }

        const entryPath = path.join(currentDir, entryName);

        if (dirent.isDirectory()) {
          if (shouldSkipSearchDirectory(entryName, includeHiddenEntries)) {
            continue;
          }
          if (!visited.has(entryPath)) {
            visited.add(entryPath);
            queue.push(entryPath);
          }
          continue;
        }

        if (!dirent.isFile()) {
          continue;
        }

        const relativePath = normalizeRelativeSearchPath(rootPath, entryPath);
        const extension = entryName.includes('.') ? entryName.split('.').pop()?.toLowerCase() : undefined;

        if (matchAll) {
          candidates.push({
            name: entryName,
            path: entryPath,
            relativePath,
            extension,
            score: 0,
          });
        } else {
          // Try fuzzy match against relative path (includes filename)
          const score = fuzzyMatchScoreNormalized(normalizedQuery, relativePath);
          if (score !== null) {
            candidates.push({
              name: entryName,
              path: entryPath,
              relativePath,
              extension,
              score,
            });
          }
        }

        if (candidates.length >= collectLimit) {
          queue.length = 0;
          break;
        }
      }

      if (candidates.length >= collectLimit) {
        break;
      }
    }
  }

  // Sort by score descending, then by path length, then alphabetically
  if (!matchAll) {
    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.relativePath.length !== b.relativePath.length) {
        return a.relativePath.length - b.relativePath.length;
      }
      return a.relativePath.localeCompare(b.relativePath);
    });
  }

  // Return top results without the score field
  return candidates.slice(0, limit).map(({ name, path: filePath, relativePath, extension }) => ({
    name,
    path: filePath,
    relativePath,
    extension,
  }));
};

const createTimeoutSignal = (timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timer),
  };
};

/** Humanize a project label: replace dashes/underscores with spaces, title-case each word. Mirrors the UI's formatProjectLabel. */
const formatProjectLabel = (label) => {
  if (!label || typeof label !== 'string') return '';
  return label.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

const resolveNotificationTemplate = (template, variables) => {
  if (!template || typeof template !== 'string') return '';
  return template.replace(/\{(\w+)\}/g, (_match, key) => {
    const value = variables[key];
    if (value === undefined || value === null) return '';
    return String(value);
  });
};

const shouldApplyResolvedTemplateMessage = (template, resolved, variables) => {
  if (!resolved) {
    return false;
  }

  if (typeof template !== 'string') {
    return true;
  }

  if (template.includes('{last_message}')) {
    return typeof variables?.last_message === 'string' && variables.last_message.trim().length > 0;
  }

  return true;
};

const ZEN_DEFAULT_MODEL = 'gpt-5-nano';
const ZEN_DEFAULT_BASE_URL = 'https://opencode.ai/zen/v1';

const resolveZenBaseUrl = () => {
  const configured = normalizeOptionalString(process.env.KRONOSCHAMBER_ZEN_BASE_URL || process.env.KRONOSCODE_ZEN_BASE_URL);
  if (!configured) {
    return ZEN_DEFAULT_BASE_URL;
  }
  return configured.replace(/\/+$/, '');
};

const ZEN_BASE_URL = resolveZenBaseUrl();

const resolveZenApiKey = () => {
  const candidates = ['KRONOSCHAMBER_ZEN_API_KEY', 'KRONOSCODE_ZEN_API_KEY', 'ZENMUX_API_KEY'];
  for (const key of candidates) {
    const value = normalizeOptionalString(process.env[key]);
    if (value) {
      return { value, source: key };
    }
  }
  return { value: null, source: null };
};

const getZenRequestHeaders = ({ json = false, extra = {} } = {}) => {
  const headers = {
    Accept: 'application/json',
    ...extra,
  };
  if (json) {
    headers['Content-Type'] = 'application/json';
  }
  const apiKey = resolveZenApiKey();
  if (apiKey.value) {
    headers.Authorization = `Bearer ${apiKey.value}`;
  }
  return headers;
};

const parseZenRetryDelayMs = (response, attempt) => {
  const retryAfterMs = Number.parseFloat(response.headers?.get?.('retry-after-ms') || '');
  if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) return retryAfterMs;

  const retryAfter = response.headers?.get?.('retry-after') || '';
  const retryAfterSeconds = Number.parseFloat(retryAfter);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) return retryAfterSeconds * 1000;

  const retryAfterDateMs = Date.parse(retryAfter) - Date.now();
  if (Number.isFinite(retryAfterDateMs) && retryAfterDateMs > 0) return retryAfterDateMs;

  return Math.min(1000 * Math.pow(2, Math.max(0, attempt)), 8000);
};

const sleepZen = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));

const fetchZenWithRetry = async (pathname, options = {}) => {
  const { method = 'GET', body = undefined, signal, headers = {}, retries = 2 } = options;

  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(`${ZEN_BASE_URL}${pathname}`, {
      method,
      headers: getZenRequestHeaders({
        json: body !== undefined,
        extra: headers,
      }),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });

    const shouldRetry = (response.status === 429 || response.status >= 500) && attempt < retries;
    if (!shouldRetry) {
      return response;
    }
    const delayMs = parseZenRetryDelayMs(response, attempt);
    await sleepZen(delayMs);
  }
};

/**
 * Validated fallback zen model determined at startup by checking available free
 * models from the zen API. When `null`, startup validation hasn't run yet (or
 * failed), so `resolveZenModel` falls back to `ZEN_DEFAULT_MODEL`.
 */
let validatedZenFallback = null;

/** Cached free zen models response and timestamp (shared by startup + endpoint). */
let cachedZenModels = null;
let cachedZenModelsTimestamp = 0;
const ZEN_MODELS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch free models from the zen API with caching. Returns an array of
 * `{ id, owned_by }` objects (may be empty on failure). Results are cached
 * for `ZEN_MODELS_CACHE_TTL` ms.
 */
const fetchFreeZenModels = async () => {
  const now = Date.now();
  if (cachedZenModels && now - cachedZenModelsTimestamp < ZEN_MODELS_CACHE_TTL) {
    return cachedZenModels.models;
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), 8000) : null;
  try {
    const response = await fetchZenWithRetry('/models', {
      signal: controller?.signal,
      retries: 1,
    });
    if (!response.ok) {
      throw new Error(`zen/v1/models responded with status ${response.status}`);
    }
    const data = await response.json();
    const allModels = Array.isArray(data?.data) ? data.data : [];
    const freeModels = allModels
      .filter((m) => typeof m?.id === 'string' && m.id.endsWith('-free'))
      .map((m) => ({ id: m.id, owned_by: m.owned_by }));

    cachedZenModels = { models: freeModels };
    cachedZenModelsTimestamp = Date.now();
    return freeModels;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

/**
 * Resolve the zen model to use. Checks the provided override first,
 * then falls back to the stored zenModel setting, then to the validated
 * startup fallback, then to the hardcoded default.
 */
const resolveZenModel = async (override) => {
  if (typeof override === 'string' && override.trim().length > 0) {
    return override.trim();
  }
  try {
    const settings = await readSettingsFromDisk();
    if (typeof settings?.zenModel === 'string' && settings.zenModel.trim().length > 0) {
      return settings.zenModel.trim();
    }
  } catch {
    // ignore
  }
  return validatedZenFallback || ZEN_DEFAULT_MODEL;
};

const summarizeText = async (text, targetLength, zenModel) => {
  if (!text || typeof text !== 'string' || text.trim().length === 0) return text;

  try {
    const prompt = `Summarize the following text in approximately ${targetLength} characters. Be concise and capture the key point. Output ONLY the summary text, nothing else.\n\nText:\n${text}`;

    const completionTimeout = createTimeoutSignal(15000);
    let response;
    try {
      response = await fetchZenWithRetry('/responses', {
        method: 'POST',
        body: {
          model: zenModel || ZEN_DEFAULT_MODEL,
          input: [{ role: 'user', content: prompt }],
          max_output_tokens: 1000,
          stream: false,
          reasoning: { effort: 'low' },
        },
        signal: completionTimeout.signal,
        retries: 1,
      });
    } finally {
      completionTimeout.cleanup();
    }

    if (!response.ok) return text;

    const data = await response.json();
    const summary = data?.output
      ?.find((item) => item?.type === 'message')
      ?.content?.find((item) => item?.type === 'output_text')
      ?.text?.trim();

    return summary || text;
  } catch {
    return text;
  }
};

const NOTIFICATION_BODY_MAX_CHARS = 1000;

/**
 * Extract text from parts array (used when parts are available inline or fetched from API).
 */
const extractTextFromParts = (parts, maxLength = NOTIFICATION_BODY_MAX_CHARS) => {
  if (!Array.isArray(parts) || parts.length === 0) return '';

  const textParts = parts
    .filter((p) => p && (p.type === 'text' || typeof p.text === 'string' || typeof p.content === 'string'))
    .map((p) => p.text || p.content || '')
    .filter(Boolean);

  let text = textParts.length > 0 ? textParts.join('\n').trim() : '';

  // Truncate to prevent oversized notification payloads
  if (maxLength > 0 && text.length > maxLength) {
    text = text.slice(0, maxLength);
  }

  return text;
};

/**
 * Try to extract message text from the payload itself (fast path).
 * Note: message.updated events from the OpenCode SSE stream typically do NOT include
 * parts inline — parts are sent via separate message.part.updated events. This function
 * is a fast path for the rare case where parts are included.
 */
const extractLastMessageText = (payload, maxLength = NOTIFICATION_BODY_MAX_CHARS) => {
  const info = payload?.properties?.info;
  if (!info) return '';

  // Try inline parts on info or on properties
  const parts = info.parts || payload?.properties?.parts;
  const text = extractTextFromParts(parts, maxLength);
  if (text) return text;

  // Fallback: try content array (legacy)
  const content = info.content;
  if (Array.isArray(content)) {
    const textContent = content
      .filter((c) => c && (c.type === 'text' || typeof c.text === 'string'))
      .map((c) => c.text || '')
      .filter(Boolean);
    if (textContent.length > 0) {
      let result = textContent.join('\n').trim();
      if (maxLength > 0 && result.length > maxLength) {
        result = result.slice(0, maxLength);
      }
      return result;
    }
  }

  return '';
};

/**
 * Fetch the last assistant message text from the OpenCode API.
 * This is needed because message.updated events don't include parts;
 * we must fetch them separately via the session messages endpoint.
 */
const fetchLastAssistantMessageText = async (sessionId, messageId, maxLength = NOTIFICATION_BODY_MAX_CHARS) => {
  if (!sessionId) return '';

  try {
    // Fetch last few messages to find the one that triggered the notification
    const url = buildOpenCodeUrl(`/session/${encodeURIComponent(sessionId)}/message`, '');
    const response = await fetch(`${url}?limit=5`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...getOpenCodeAuthHeaders(),
      },
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) return '';

    const messages = await response.json().catch(() => null);
    if (!Array.isArray(messages)) return '';

    // Find the specific message by ID, or fall back to the last assistant message
    let target = null;
    if (messageId) {
      target = messages.find((m) => m?.info?.id === messageId && m?.info?.role === 'assistant');
    }
    if (!target) {
      // Find the last assistant message with finish === 'stop'
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m?.info?.role === 'assistant' && m?.info?.finish === 'stop') {
          target = m;
          break;
        }
      }
    }

    if (!target || !Array.isArray(target.parts)) return '';

    return extractTextFromParts(target.parts, maxLength);
  } catch {
    return '';
  }
};

/**
 * In-memory cache of session titles populated from SSE session.updated / session.created events.
 * This is the preferred source for session titles since it is populated passively and doesn't
 * require a separate API call.
 */
const sessionTitleCache = new Map();

const cacheSessionTitle = (sessionId, title) => {
  if (typeof sessionId === 'string' && sessionId.length > 0 && typeof title === 'string' && title.length > 0) {
    sessionTitleCache.set(sessionId, title);
  }
};

const getCachedSessionTitle = (sessionId) => {
  return sessionTitleCache.get(sessionId) ?? null;
};

/**
 * Extract and cache session title from session.updated / session.created SSE events.
 * Called by the global event watcher to passively maintain the title cache.
 */
const maybeCacheSessionInfoFromEvent = (payload) => {
  if (!payload || typeof payload !== 'object') return;
  const type = payload.type;
  if (type !== 'session.updated' && type !== 'session.created') return;
  const info = payload.properties?.info;
  if (!info || typeof info !== 'object') return;
  const sessionId = info.id;
  const title = info.title;
  cacheSessionTitle(sessionId, title);
};

/**
 * Fetch session metadata (title, directory) from the OpenCode API.
 * Cached for 60s per session to avoid repeated API calls.
 */
const sessionInfoCache = new Map();
const SESSION_INFO_CACHE_TTL_MS = 60 * 1000;

const fetchSessionInfo = async (sessionId) => {
  if (!sessionId) return null;

  const cached = sessionInfoCache.get(sessionId);
  if (cached && Date.now() - cached.at < SESSION_INFO_CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const url = buildOpenCodeUrl(`/session/${encodeURIComponent(sessionId)}`, '');
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) {
      console.warn(`[Notification] fetchSessionInfo: ${response.status} for session ${sessionId}`);
      return null;
    }
    const data = await response.json().catch(() => null);
    if (data && typeof data === 'object') {
      sessionInfoCache.set(sessionId, { data, at: Date.now() });
      return data;
    }
    return null;
  } catch (err) {
    console.warn(`[Notification] fetchSessionInfo failed for ${sessionId}:`, err?.message || err);
    return null;
  }
};

const buildTemplateVariables = async (payload, sessionId) => {
  const info = payload?.properties?.info || {};

  // Session title — try inline payload, then SSE cache, then API fetch
  let sessionTitle =
    payload?.properties?.sessionTitle ||
    payload?.properties?.session?.title ||
    (typeof info.sessionTitle === 'string' ? info.sessionTitle : '') ||
    '';

  // Try the SSE-populated session title cache (filled from session.updated / session.created events)
  if (!sessionTitle && sessionId) {
    const cached = getCachedSessionTitle(sessionId);
    if (cached) {
      sessionTitle = cached;
    }
  }

  // Last resort: fetch session info from the API
  let sessionInfo = null;
  if (!sessionTitle && sessionId) {
    sessionInfo = await fetchSessionInfo(sessionId);
    if (sessionInfo && typeof sessionInfo.title === 'string') {
      sessionTitle = sessionInfo.title;
      // Populate the SSE cache so future notifications don't need an API call
      cacheSessionTitle(sessionId, sessionTitle);
    }
  }

  // Agent name from mode or agent field (v2 has both mode and agent)
  const agentName = (() => {
    const mode =
      typeof info.agent === 'string' && info.agent.trim().length > 0
        ? info.agent.trim()
        : typeof info.mode === 'string'
          ? info.mode.trim()
          : '';
    if (!mode) return 'Agent';
    return mode
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
      .join(' ');
  })();

  // Model name — v2 has modelID directly on info, v1 user messages nest it under info.model.modelID
  const modelName = (() => {
    const raw =
      typeof info.modelID === 'string' ? info.modelID.trim() : typeof info.model?.modelID === 'string' ? info.model.modelID.trim() : '';
    if (!raw) return 'Assistant';
    return raw
      .split(/[-_]+/)
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ');
  })();

  // Project name, branch, worktree — derived from multiple sources with fallbacks
  let projectName = '';
  let branch = '';
  let worktreeDir = '';

  // 1. Primary source: the message payload's path (always accurate for the session)
  const infoPath = info.path;
  if (typeof infoPath?.root === 'string' && infoPath.root.length > 0) {
    worktreeDir = infoPath.root;
  } else if (typeof infoPath?.cwd === 'string' && infoPath.cwd.length > 0) {
    worktreeDir = infoPath.cwd;
  }

  // 2. Look up the user-facing project label from stored settings
  try {
    const settings = await readSettingsFromDisk();
    const projects = Array.isArray(settings.projects) ? settings.projects : [];

    if (worktreeDir) {
      // Match the session directory against stored projects to find the label
      const normalizedDir = worktreeDir.replace(/\/+$/, '');
      const matchedProject = projects.find((p) => {
        if (!p || typeof p.path !== 'string') return false;
        return p.path.replace(/\/+$/, '') === normalizedDir;
      });
      if (matchedProject && typeof matchedProject.label === 'string' && matchedProject.label.trim().length > 0) {
        projectName = matchedProject.label.trim();
      } else {
        // No label stored — derive from directory name
        projectName = normalizedDir.split('/').filter(Boolean).pop() || '';
      }
    } else {
      // No directory from payload — fall back to active project
      const activeId = typeof settings.activeProjectId === 'string' ? settings.activeProjectId : '';
      const activeProject = activeId ? projects.find((p) => p && p.id === activeId) : projects[0];
      if (activeProject) {
        projectName =
          typeof activeProject.label === 'string' && activeProject.label.trim().length > 0
            ? activeProject.label.trim()
            : typeof activeProject.path === 'string'
              ? activeProject.path.split('/').pop() || ''
              : '';
        worktreeDir = typeof activeProject.path === 'string' ? activeProject.path : '';
      }
    }
  } catch {
    // Settings read failed — derive from directory if available
    if (worktreeDir && !projectName) {
      projectName = worktreeDir.split('/').filter(Boolean).pop() || '';
    }
  }

  // 3. Get branch from git
  if (worktreeDir) {
    try {
      const { simpleGit } = await import('simple-git');
      const git = simpleGit(worktreeDir);
      branch = await Promise.race([
        git.revparse(['--abbrev-ref', 'HEAD']),
        new Promise((_, reject) => setTimeout(() => reject(new Error('git timeout')), 3000)),
      ]).catch(() => '');
    } catch {
      // ignore — git may not be available
    }
  }

  return {
    project_name: formatProjectLabel(projectName),
    worktree: worktreeDir,
    branch: typeof branch === 'string' ? branch.trim() : '',
    session_name: sessionTitle,
    agent_name: agentName,
    model_name: modelName,
    last_message: '', // Populated by caller
    session_id: sessionId || '',
  };
};

const stripJsonMarkdownWrapper = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  let trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.startsWith('```')) {
    trimmed = trimmed.replace(/^```(?:json)?\s*/i, '');
    const closingFenceIndex = trimmed.lastIndexOf('```');
    if (closingFenceIndex !== -1) {
      trimmed = trimmed.slice(0, closingFenceIndex);
    }
    trimmed = trimmed.trim();
  }
  if (trimmed.endsWith('```')) {
    trimmed = trimmed.slice(0, -3).trim();
  }
  return trimmed;
};

const extractJsonObject = (value) => {
  if (typeof value !== 'string') {
    return null;
  }
  const source = value.trim();
  if (!source) {
    return null;
  }
  let start = source.indexOf('{');
  while (start !== -1) {
    let end = source.indexOf('}', start + 1);
    while (end !== -1) {
      const candidate = source.slice(start, end + 1);
      try {
        JSON.parse(candidate);
        return candidate;
      } catch {
        end = source.indexOf('}', end + 1);
      }
    }
    start = source.indexOf('{', start + 1);
  }
  return null;
};

const OPENCHAMBER_DATA_DIR = process.env.OPENCHAMBER_DATA_DIR
  ? path.resolve(process.env.OPENCHAMBER_DATA_DIR)
  : path.join(os.homedir(), '.config', 'openchamber');
const SETTINGS_FILE_PATH = path.join(OPENCHAMBER_DATA_DIR, 'settings.json');
const PUSH_SUBSCRIPTIONS_FILE_PATH = path.join(OPENCHAMBER_DATA_DIR, 'push-subscriptions.json');
const JAAZ_AUTH_FILE_PATH = path.join(OPENCHAMBER_DATA_DIR, 'jaaz-auth.json');
const RETENTION_ANALYTICS_FILE_PATH = path.join(OPENCHAMBER_DATA_DIR, 'retention-analytics.json');
const RETENTION_ANALYTICS_VERSION = 1;
const RETENTION_RERUN_WINDOW_MS = 20 * 60 * 1000;

const readSettingsFromDisk = async () => {
  try {
    const raw = await fsPromises.readFile(SETTINGS_FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
    return {};
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return {};
    }
    console.warn('Failed to read settings file:', error);
    return {};
  }
};

const writeSettingsToDisk = async (settings) => {
  try {
    await fsPromises.mkdir(path.dirname(SETTINGS_FILE_PATH), { recursive: true });
    await fsPromises.writeFile(SETTINGS_FILE_PATH, JSON.stringify(settings, null, 2), 'utf8');
  } catch (error) {
    console.warn('Failed to write settings file:', error);
    throw error;
  }
};

const readJaazAuthFromDisk = async () => {
  try {
    const raw = await fsPromises.readFile(JAAZ_AUTH_FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { token: null, user: null, updatedAt: null };
    }
    const token = typeof parsed.token === 'string' && parsed.token.trim().length > 0 ? parsed.token.trim() : null;
    const user = parsed.user && typeof parsed.user === 'object' ? parsed.user : null;
    const updatedAt = Number.isFinite(parsed.updatedAt) ? parsed.updatedAt : null;
    return { token, user, updatedAt };
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return { token: null, user: null, updatedAt: null };
    }
    console.warn('[JAAZ] Failed to read auth file:', error);
    return { token: null, user: null, updatedAt: null };
  }
};

const writeJaazAuthToDisk = async ({ token, user }) => {
  const next = {
    token: typeof token === 'string' ? token.trim() : '',
    user: user && typeof user === 'object' ? user : null,
    updatedAt: Date.now(),
  };

  await fsPromises.mkdir(path.dirname(JAAZ_AUTH_FILE_PATH), { recursive: true });
  await fsPromises.writeFile(JAAZ_AUTH_FILE_PATH, JSON.stringify(next, null, 2), 'utf8');
};

const clearJaazAuthFromDisk = async () => {
  try {
    await fsPromises.rm(JAAZ_AUTH_FILE_PATH, { force: true });
  } catch (error) {
    console.warn('[JAAZ] Failed to clear auth file:', error);
  }
};

const PUSH_SUBSCRIPTIONS_VERSION = 1;
let persistPushSubscriptionsLock = Promise.resolve();
let persistRetentionAnalyticsLock = Promise.resolve();

const readPushSubscriptionsFromDisk = async () => {
  try {
    const raw = await fsPromises.readFile(PUSH_SUBSCRIPTIONS_FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { version: PUSH_SUBSCRIPTIONS_VERSION, subscriptionsBySession: {} };
    }
    if (typeof parsed.version !== 'number' || parsed.version !== PUSH_SUBSCRIPTIONS_VERSION) {
      return { version: PUSH_SUBSCRIPTIONS_VERSION, subscriptionsBySession: {} };
    }

    const subscriptionsBySession =
      parsed.subscriptionsBySession && typeof parsed.subscriptionsBySession === 'object' ? parsed.subscriptionsBySession : {};

    return { version: PUSH_SUBSCRIPTIONS_VERSION, subscriptionsBySession };
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return { version: PUSH_SUBSCRIPTIONS_VERSION, subscriptionsBySession: {} };
    }
    console.warn('Failed to read push subscriptions file:', error);
    return { version: PUSH_SUBSCRIPTIONS_VERSION, subscriptionsBySession: {} };
  }
};

const writePushSubscriptionsToDisk = async (data) => {
  await fsPromises.mkdir(path.dirname(PUSH_SUBSCRIPTIONS_FILE_PATH), { recursive: true });
  await fsPromises.writeFile(PUSH_SUBSCRIPTIONS_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
};

const persistPushSubscriptionUpdate = async (mutate) => {
  persistPushSubscriptionsLock = persistPushSubscriptionsLock.then(async () => {
    await fsPromises.mkdir(path.dirname(PUSH_SUBSCRIPTIONS_FILE_PATH), { recursive: true });
    const current = await readPushSubscriptionsFromDisk();
    const next = mutate({
      version: PUSH_SUBSCRIPTIONS_VERSION,
      subscriptionsBySession: current.subscriptionsBySession || {},
    });
    await writePushSubscriptionsToDisk(next);
    return next;
  });

  return persistPushSubscriptionsLock;
};

const emptyRetentionAnalytics = () => ({
  version: RETENTION_ANALYTICS_VERSION,
  users: {},
  counters: {
    resume_attempts: 0,
    resume_successes: 0,
    rerun_eligible_errors: 0,
    rerun_after_error: 0,
  },
  rerun_pending_by_session: {},
});

const normalizeDayKey = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
};

const normalizeRetentionAnalytics = (raw) => {
  const base = emptyRetentionAnalytics();
  if (!raw || typeof raw !== 'object') {
    return base;
  }

  const users = {};
  if (raw.users && typeof raw.users === 'object') {
    for (const [rawKey, rawValue] of Object.entries(raw.users)) {
      if (typeof rawKey !== 'string' || rawKey.trim().length === 0) continue;
      if (!rawValue || typeof rawValue !== 'object') continue;

      const activeDays = Array.isArray(rawValue.active_days)
        ? Array.from(new Set(rawValue.active_days.map(normalizeDayKey).filter(Boolean))).toSorted()
        : [];

      const firstSeenAtRaw = Number(rawValue.first_seen_at);
      const lastSeenAtRaw = Number(rawValue.last_seen_at);
      const firstSeenAt = Number.isFinite(firstSeenAtRaw) ? firstSeenAtRaw : Date.now();
      const lastSeenAt = Number.isFinite(lastSeenAtRaw) ? lastSeenAtRaw : firstSeenAt;
      const resumeCountRaw = Number(rawValue.resume_count);
      const resumeCount = Number.isFinite(resumeCountRaw) ? Math.max(0, Math.round(resumeCountRaw)) : 0;
      const resumeLastAtRaw = Number(rawValue.resume_last_at);
      const resumeLastAt = Number.isFinite(resumeLastAtRaw) ? resumeLastAtRaw : null;

      users[rawKey.trim()] = {
        first_seen_at: firstSeenAt,
        last_seen_at: Math.max(firstSeenAt, lastSeenAt),
        active_days: activeDays,
        resume_count: resumeCount,
        resume_last_at: resumeLastAt,
      };
    }
  }

  const countersRaw = raw.counters && typeof raw.counters === 'object' ? raw.counters : {};
  const numberOrZero = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.round(parsed);
  };

  const rerunPendingBySession = {};
  const pendingRaw = raw.rerun_pending_by_session && typeof raw.rerun_pending_by_session === 'object' ? raw.rerun_pending_by_session : {};
  for (const [sessionID, value] of Object.entries(pendingRaw)) {
    if (typeof sessionID !== 'string' || sessionID.trim().length === 0) continue;
    if (!value || typeof value !== 'object') continue;
    const at = Number(value.at);
    if (!Number.isFinite(at) || at <= 0) continue;
    rerunPendingBySession[sessionID] = {
      at,
      message_id: typeof value.message_id === 'string' && value.message_id.trim().length > 0 ? value.message_id : null,
    };
  }

  return {
    version: RETENTION_ANALYTICS_VERSION,
    users,
    counters: {
      resume_attempts: numberOrZero(countersRaw.resume_attempts),
      resume_successes: numberOrZero(countersRaw.resume_successes),
      rerun_eligible_errors: numberOrZero(countersRaw.rerun_eligible_errors),
      rerun_after_error: numberOrZero(countersRaw.rerun_after_error),
    },
    rerun_pending_by_session: rerunPendingBySession,
  };
};

const readRetentionAnalyticsFromDisk = async () => {
  try {
    const raw = await fsPromises.readFile(RETENTION_ANALYTICS_FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return normalizeRetentionAnalytics(parsed);
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return emptyRetentionAnalytics();
    }
    console.warn('Failed to read retention analytics file:', error);
    return emptyRetentionAnalytics();
  }
};

const writeRetentionAnalyticsToDisk = async (data) => {
  await fsPromises.mkdir(path.dirname(RETENTION_ANALYTICS_FILE_PATH), { recursive: true });
  await fsPromises.writeFile(RETENTION_ANALYTICS_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
};

const persistRetentionAnalyticsUpdate = async (mutate) => {
  persistRetentionAnalyticsLock = persistRetentionAnalyticsLock.then(async () => {
    const current = await readRetentionAnalyticsFromDisk();
    const candidate = mutate(normalizeRetentionAnalytics(current));
    const next = normalizeRetentionAnalytics(candidate);
    await writeRetentionAnalyticsToDisk(next);
    return next;
  });

  return persistRetentionAnalyticsLock;
};

const readRetentionAnalyticsConsistent = async () => {
  try {
    await persistRetentionAnalyticsLock;
  } catch {
    // previous mutation failed, continue with best-effort snapshot
  }
  return readRetentionAnalyticsFromDisk();
};

const resolveDirectoryCandidate = (value) => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = normalizeDirectoryPath(trimmed);
  return path.resolve(normalized);
};

const validateDirectoryPath = async (candidate) => {
  const resolved = resolveDirectoryCandidate(candidate);
  if (!resolved) {
    return { ok: false, error: 'Directory parameter is required' };
  }
  try {
    const stats = await fsPromises.stat(resolved);
    if (!stats.isDirectory()) {
      return { ok: false, error: 'Specified path is not a directory' };
    }
    return { ok: true, directory: resolved };
  } catch (error) {
    const err = error;
    if (err && typeof err === 'object' && err.code === 'ENOENT') {
      return { ok: false, error: 'Directory not found' };
    }
    if (err && typeof err === 'object' && err.code === 'EACCES') {
      return { ok: false, error: 'Access to directory denied' };
    }
    return { ok: false, error: 'Failed to validate directory' };
  }
};

const resolveProjectDirectory = async (req) => {
  if (EMBEDDED_KRONTERM_WORKSPACE) {
    return { directory: EMBEDDED_KRONTERM_WORKSPACE, error: null };
  }

  const headerDirectory = typeof req.get === 'function' ? req.get('x-opencode-directory') : null;
  const queryDirectory = Array.isArray(req.query?.directory) ? req.query.directory[0] : req.query?.directory;
  const requested = headerDirectory || queryDirectory || null;

  if (requested) {
    const validated = await validateDirectoryPath(requested);
    if (!validated.ok) {
      return { directory: null, error: validated.error };
    }
    return { directory: validated.directory, error: null };
  }

  const settings = await readSettingsFromDiskMigrated();
  const projects = sanitizeProjects(settings.projects) || [];
  if (projects.length === 0) {
    return { directory: null, error: 'Directory parameter or active project is required' };
  }

  const activeId = typeof settings.activeProjectId === 'string' ? settings.activeProjectId : '';
  const active = projects.find((project) => project.id === activeId) || projects[0];
  if (!active || !active.path) {
    return { directory: null, error: 'Directory parameter or active project is required' };
  }

  const validated = await validateDirectoryPath(active.path);
  if (!validated.ok) {
    return { directory: null, error: validated.error };
  }

  return { directory: validated.directory, error: null };
};

const resolveOptionalProjectDirectory = async (req) => {
  const headerDirectory = typeof req.get === 'function' ? req.get('x-opencode-directory') : null;
  const queryDirectory = Array.isArray(req.query?.directory) ? req.query.directory[0] : req.query?.directory;
  const requested = headerDirectory || queryDirectory || null;

  if (!requested) {
    return { directory: null, error: null };
  }

  const validated = await validateDirectoryPath(requested);
  if (!validated.ok) {
    return { directory: null, error: validated.error };
  }

  return { directory: validated.directory, error: null };
};

const sanitizeTypographySizesPartial = (input) => {
  if (!input || typeof input !== 'object') {
    return undefined;
  }
  const candidate = input;
  const result = {};
  let populated = false;

  const assign = (key) => {
    if (typeof candidate[key] === 'string' && candidate[key].length > 0) {
      result[key] = candidate[key];
      populated = true;
    }
  };

  assign('markdown');
  assign('code');
  assign('uiHeader');
  assign('uiLabel');
  assign('meta');
  assign('micro');

  return populated ? result : undefined;
};

const normalizeStringArray = (input) => {
  if (!Array.isArray(input)) {
    return [];
  }
  return Array.from(new Set(input.filter((entry) => typeof entry === 'string' && entry.length > 0)));
};

const sanitizeModelRefs = (input, limit) => {
  if (!Array.isArray(input)) {
    return undefined;
  }

  const result = [];
  const seen = new Set();

  for (const entry of input) {
    if (!entry || typeof entry !== 'object') continue;
    const providerID = typeof entry.providerID === 'string' ? entry.providerID.trim() : '';
    const modelID = typeof entry.modelID === 'string' ? entry.modelID.trim() : '';
    if (!providerID || !modelID) continue;
    const key = `${providerID}/${modelID}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ providerID, modelID });
    if (result.length >= limit) break;
  }

  return result;
};

const sanitizeSkillCatalogs = (input) => {
  if (!Array.isArray(input)) {
    return undefined;
  }

  const result = [];
  const seen = new Set();

  for (const entry of input) {
    if (!entry || typeof entry !== 'object') continue;

    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    const label = typeof entry.label === 'string' ? entry.label.trim() : '';
    const source = typeof entry.source === 'string' ? entry.source.trim() : '';
    const subpath = typeof entry.subpath === 'string' ? entry.subpath.trim() : '';
    const gitIdentityId = typeof entry.gitIdentityId === 'string' ? entry.gitIdentityId.trim() : '';

    if (!id || !label || !source) continue;
    if (seen.has(id)) continue;
    seen.add(id);

    result.push({
      id,
      label,
      source,
      ...(subpath ? { subpath } : {}),
      ...(gitIdentityId ? { gitIdentityId } : {}),
    });
  }

  return result;
};

const sanitizeProjects = (input) => {
  if (!Array.isArray(input)) {
    return undefined;
  }

  const result = [];
  const seenIds = new Set();
  const seenPaths = new Set();

  for (const entry of input) {
    if (!entry || typeof entry !== 'object') continue;

    const candidate = entry;
    const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
    const rawPath = typeof candidate.path === 'string' ? candidate.path.trim() : '';
    const normalizedPath = rawPath ? path.resolve(normalizeDirectoryPath(rawPath)) : '';
    const label = typeof candidate.label === 'string' ? candidate.label.trim() : '';
    const icon = typeof candidate.icon === 'string' ? candidate.icon.trim() : '';
    const color = typeof candidate.color === 'string' ? candidate.color.trim() : '';
    const addedAt = Number.isFinite(candidate.addedAt) ? Number(candidate.addedAt) : null;
    const lastOpenedAt = Number.isFinite(candidate.lastOpenedAt) ? Number(candidate.lastOpenedAt) : null;

    if (!id || !normalizedPath) continue;
    if (seenIds.has(id)) continue;
    if (seenPaths.has(normalizedPath)) continue;

    seenIds.add(id);
    seenPaths.add(normalizedPath);

    const project = {
      id,
      path: normalizedPath,
      ...(label ? { label } : {}),
      ...(icon ? { icon } : {}),
      ...(color ? { color } : {}),
      ...(Number.isFinite(addedAt) && addedAt >= 0 ? { addedAt } : {}),
      ...(Number.isFinite(lastOpenedAt) && lastOpenedAt >= 0 ? { lastOpenedAt } : {}),
    };

    if (typeof candidate.sidebarCollapsed === 'boolean') {
      project.sidebarCollapsed = candidate.sidebarCollapsed;
    }

    result.push(project);
  }

  return result;
};

const sanitizeSettingsUpdate = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  const candidate = payload;
  const result = {};

  if (typeof candidate.themeId === 'string' && candidate.themeId.length > 0) {
    result.themeId = candidate.themeId;
  }
  if (typeof candidate.themeVariant === 'string' && (candidate.themeVariant === 'light' || candidate.themeVariant === 'dark')) {
    result.themeVariant = candidate.themeVariant;
  }
  if (typeof candidate.useSystemTheme === 'boolean') {
    result.useSystemTheme = candidate.useSystemTheme;
  }
  if (typeof candidate.lightThemeId === 'string' && candidate.lightThemeId.length > 0) {
    result.lightThemeId = candidate.lightThemeId;
  }
  if (typeof candidate.darkThemeId === 'string' && candidate.darkThemeId.length > 0) {
    result.darkThemeId = candidate.darkThemeId;
  }
  if (typeof candidate.lastDirectory === 'string' && candidate.lastDirectory.length > 0) {
    result.lastDirectory = candidate.lastDirectory;
  }
  if (typeof candidate.homeDirectory === 'string' && candidate.homeDirectory.length > 0) {
    result.homeDirectory = candidate.homeDirectory;
  }

  // Absolute path to the opencode CLI binary (optional override).
  // Accept empty-string to clear (we persist an empty string sentinel so the running
  // process can reliably drop a previously applied OPENCODE_BINARY override).
  if (typeof candidate.opencodeBinary === 'string') {
    const normalized = normalizeDirectoryPath(candidate.opencodeBinary).trim();
    result.opencodeBinary = normalized;
  }
  if (typeof candidate.aiBrowserEnabled === 'boolean') {
    result.aiBrowserEnabled = candidate.aiBrowserEnabled;
  }
  if (typeof candidate.agentMode === 'string') {
    result.agentMode = normalizeAgentModeSetting(candidate.agentMode);
  }
  if (candidate.agentModeByProject && typeof candidate.agentModeByProject === 'object') {
    const map = {};
    for (const [rawKey, rawValue] of Object.entries(candidate.agentModeByProject)) {
      const key = typeof rawKey === 'string' ? rawKey.trim() : '';
      if (!key) continue;
      const value = normalizeAgentModeSetting(rawValue);
      if (value !== 'off') {
        map[key] = value;
      }
    }
    result.agentModeByProject = map;
  }
  if (typeof candidate.browserOpenAtStartup === 'boolean') {
    result.browserOpenAtStartup = candidate.browserOpenAtStartup;
  }
  if (Array.isArray(candidate.projects)) {
    const projects = sanitizeProjects(candidate.projects);
    if (projects) {
      result.projects = projects;
    }
  }
  if (typeof candidate.activeProjectId === 'string' && candidate.activeProjectId.length > 0) {
    result.activeProjectId = candidate.activeProjectId;
  }

  if (Array.isArray(candidate.approvedDirectories)) {
    result.approvedDirectories = normalizeStringArray(candidate.approvedDirectories);
  }
  if (Array.isArray(candidate.securityScopedBookmarks)) {
    result.securityScopedBookmarks = normalizeStringArray(candidate.securityScopedBookmarks);
  }
  if (Array.isArray(candidate.pinnedDirectories)) {
    result.pinnedDirectories = normalizeStringArray(candidate.pinnedDirectories);
  }

  if (typeof candidate.uiFont === 'string' && candidate.uiFont.length > 0) {
    result.uiFont = candidate.uiFont;
  }
  if (typeof candidate.monoFont === 'string' && candidate.monoFont.length > 0) {
    result.monoFont = candidate.monoFont;
  }
  if (typeof candidate.markdownDisplayMode === 'string' && candidate.markdownDisplayMode.length > 0) {
    result.markdownDisplayMode = candidate.markdownDisplayMode;
  }
  if (typeof candidate.githubClientId === 'string') {
    const trimmed = candidate.githubClientId.trim();
    if (trimmed.length > 0) {
      result.githubClientId = trimmed;
    }
  }
  if (typeof candidate.githubScopes === 'string') {
    const trimmed = candidate.githubScopes.trim();
    if (trimmed.length > 0) {
      result.githubScopes = trimmed;
    }
  }
  if (typeof candidate.showReasoningTraces === 'boolean') {
    result.showReasoningTraces = candidate.showReasoningTraces;
  }
  if (typeof candidate.showTextJustificationActivity === 'boolean') {
    result.showTextJustificationActivity = candidate.showTextJustificationActivity;
  }
  if (typeof candidate.nativeNotificationsEnabled === 'boolean') {
    result.nativeNotificationsEnabled = candidate.nativeNotificationsEnabled;
  }
  if (typeof candidate.notificationMode === 'string') {
    const mode = candidate.notificationMode.trim();
    if (mode === 'always' || mode === 'hidden-only') {
      result.notificationMode = mode;
    }
  }
  if (typeof candidate.notifyOnSubtasks === 'boolean') {
    result.notifyOnSubtasks = candidate.notifyOnSubtasks;
  }
  if (typeof candidate.notifyOnCompletion === 'boolean') {
    result.notifyOnCompletion = candidate.notifyOnCompletion;
  }
  if (typeof candidate.notifyOnError === 'boolean') {
    result.notifyOnError = candidate.notifyOnError;
  }
  if (typeof candidate.notifyOnQuestion === 'boolean') {
    result.notifyOnQuestion = candidate.notifyOnQuestion;
  }
  if (candidate.notificationTemplates && typeof candidate.notificationTemplates === 'object') {
    result.notificationTemplates = candidate.notificationTemplates;
  }
  if (typeof candidate.summarizeLastMessage === 'boolean') {
    result.summarizeLastMessage = candidate.summarizeLastMessage;
  }
  if (typeof candidate.summaryThreshold === 'number' && Number.isFinite(candidate.summaryThreshold)) {
    result.summaryThreshold = Math.max(0, Math.round(candidate.summaryThreshold));
  }
  if (typeof candidate.summaryLength === 'number' && Number.isFinite(candidate.summaryLength)) {
    result.summaryLength = Math.max(10, Math.round(candidate.summaryLength));
  }
  if (typeof candidate.maxLastMessageLength === 'number' && Number.isFinite(candidate.maxLastMessageLength)) {
    result.maxLastMessageLength = Math.max(10, Math.round(candidate.maxLastMessageLength));
  }
  if (typeof candidate.usageAutoRefresh === 'boolean') {
    result.usageAutoRefresh = candidate.usageAutoRefresh;
  }
  if (typeof candidate.usageRefreshIntervalMs === 'number' && Number.isFinite(candidate.usageRefreshIntervalMs)) {
    result.usageRefreshIntervalMs = Math.max(30000, Math.min(300000, Math.round(candidate.usageRefreshIntervalMs)));
  }
  if (Array.isArray(candidate.usageDropdownProviders)) {
    result.usageDropdownProviders = normalizeStringArray(candidate.usageDropdownProviders);
  }
  if (typeof candidate.autoDeleteEnabled === 'boolean') {
    result.autoDeleteEnabled = candidate.autoDeleteEnabled;
  }
  if (typeof candidate.autoDeleteAfterDays === 'number' && Number.isFinite(candidate.autoDeleteAfterDays)) {
    const normalizedDays = Math.max(1, Math.min(365, Math.round(candidate.autoDeleteAfterDays)));
    result.autoDeleteAfterDays = normalizedDays;
  }

  const typography = sanitizeTypographySizesPartial(candidate.typographySizes);
  if (typography) {
    result.typographySizes = typography;
  }

  if (typeof candidate.defaultModel === 'string') {
    const trimmed = candidate.defaultModel.trim();
    result.defaultModel = trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof candidate.defaultVariant === 'string') {
    const trimmed = candidate.defaultVariant.trim();
    result.defaultVariant = trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof candidate.defaultAgent === 'string') {
    const trimmed = candidate.defaultAgent.trim();
    result.defaultAgent = trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof candidate.defaultGitIdentityId === 'string') {
    const trimmed = candidate.defaultGitIdentityId.trim();
    result.defaultGitIdentityId = trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof candidate.queueModeEnabled === 'boolean') {
    result.queueModeEnabled = candidate.queueModeEnabled;
  }
  if (typeof candidate.autoCreateWorktree === 'boolean') {
    result.autoCreateWorktree = candidate.autoCreateWorktree;
  }
  if (typeof candidate.gitmojiEnabled === 'boolean') {
    result.gitmojiEnabled = candidate.gitmojiEnabled;
  }
  if (typeof candidate.zenModel === 'string') {
    const trimmed = candidate.zenModel.trim();
    result.zenModel = trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof candidate.toolCallExpansion === 'string') {
    const mode = candidate.toolCallExpansion.trim();
    if (mode === 'collapsed' || mode === 'activity' || mode === 'detailed') {
      result.toolCallExpansion = mode;
    }
  }
  if (typeof candidate.fontSize === 'number' && Number.isFinite(candidate.fontSize)) {
    result.fontSize = Math.max(50, Math.min(200, Math.round(candidate.fontSize)));
  }
  if (typeof candidate.terminalFontSize === 'number' && Number.isFinite(candidate.terminalFontSize)) {
    result.terminalFontSize = Math.max(9, Math.min(52, Math.round(candidate.terminalFontSize)));
  }
  if (typeof candidate.padding === 'number' && Number.isFinite(candidate.padding)) {
    result.padding = Math.max(50, Math.min(200, Math.round(candidate.padding)));
  }
  if (typeof candidate.cornerRadius === 'number' && Number.isFinite(candidate.cornerRadius)) {
    result.cornerRadius = Math.max(0, Math.min(32, Math.round(candidate.cornerRadius)));
  }
  if (typeof candidate.inputBarOffset === 'number' && Number.isFinite(candidate.inputBarOffset)) {
    result.inputBarOffset = Math.max(0, Math.min(100, Math.round(candidate.inputBarOffset)));
  }

  const favoriteModels = sanitizeModelRefs(candidate.favoriteModels, 64);
  if (favoriteModels) {
    result.favoriteModels = favoriteModels;
  }

  const recentModels = sanitizeModelRefs(candidate.recentModels, 16);
  if (recentModels) {
    result.recentModels = recentModels;
  }
  if (typeof candidate.diffLayoutPreference === 'string') {
    const mode = candidate.diffLayoutPreference.trim();
    if (mode === 'dynamic' || mode === 'inline' || mode === 'side-by-side') {
      result.diffLayoutPreference = mode;
    }
  }
  if (typeof candidate.diffViewMode === 'string') {
    const mode = candidate.diffViewMode.trim();
    if (mode === 'single' || mode === 'stacked') {
      result.diffViewMode = mode;
    }
  }
  if (typeof candidate.directoryShowHidden === 'boolean') {
    result.directoryShowHidden = candidate.directoryShowHidden;
  }
  if (typeof candidate.filesViewShowGitignored === 'boolean') {
    result.filesViewShowGitignored = candidate.filesViewShowGitignored;
  }
  if (typeof candidate.openInAppId === 'string') {
    const trimmed = candidate.openInAppId.trim();
    if (trimmed.length > 0) {
      result.openInAppId = trimmed;
    }
  }

  // Message limit — single setting for fetch / trim / Load More chunk
  if (typeof candidate.messageLimit === 'number' && Number.isFinite(candidate.messageLimit)) {
    result.messageLimit = Math.max(10, Math.min(500, Math.round(candidate.messageLimit)));
  }

  const skillCatalogs = sanitizeSkillCatalogs(candidate.skillCatalogs);
  if (skillCatalogs) {
    result.skillCatalogs = skillCatalogs;
  }

  // Usage model selections - which models appear in dropdown
  if (candidate.usageSelectedModels && typeof candidate.usageSelectedModels === 'object') {
    const sanitized = {};
    for (const [providerId, models] of Object.entries(candidate.usageSelectedModels)) {
      if (typeof providerId === 'string' && Array.isArray(models)) {
        const validModels = models.filter((m) => typeof m === 'string' && m.length > 0);
        if (validModels.length > 0) {
          sanitized[providerId] = validModels;
        }
      }
    }
    if (Object.keys(sanitized).length > 0) {
      result.usageSelectedModels = sanitized;
    }
  }

  // Usage page collapsed families - for "Other Models" section
  if (candidate.usageCollapsedFamilies && typeof candidate.usageCollapsedFamilies === 'object') {
    const sanitized = {};
    for (const [providerId, families] of Object.entries(candidate.usageCollapsedFamilies)) {
      if (typeof providerId === 'string' && Array.isArray(families)) {
        const validFamilies = families.filter((f) => typeof f === 'string' && f.length > 0);
        if (validFamilies.length > 0) {
          sanitized[providerId] = validFamilies;
        }
      }
    }
    if (Object.keys(sanitized).length > 0) {
      result.usageCollapsedFamilies = sanitized;
    }
  }

  // Header dropdown expanded families (inverted - stores EXPANDED, default all collapsed)
  if (candidate.usageExpandedFamilies && typeof candidate.usageExpandedFamilies === 'object') {
    const sanitized = {};
    for (const [providerId, families] of Object.entries(candidate.usageExpandedFamilies)) {
      if (typeof providerId === 'string' && Array.isArray(families)) {
        const validFamilies = families.filter((f) => typeof f === 'string' && f.length > 0);
        if (validFamilies.length > 0) {
          sanitized[providerId] = validFamilies;
        }
      }
    }
    if (Object.keys(sanitized).length > 0) {
      result.usageExpandedFamilies = sanitized;
    }
  }

  // Custom model groups configuration
  if (candidate.usageModelGroups && typeof candidate.usageModelGroups === 'object') {
    const sanitized = {};
    for (const [providerId, config] of Object.entries(candidate.usageModelGroups)) {
      if (typeof providerId !== 'string') continue;

      const providerConfig = {};

      // customGroups: array of {id, label, models, order}
      if (Array.isArray(config.customGroups)) {
        const validGroups = config.customGroups
          .filter((g) => g && typeof g.id === 'string' && typeof g.label === 'string')
          .map((g) => ({
            id: g.id.slice(0, 64),
            label: g.label.slice(0, 128),
            models: Array.isArray(g.models) ? g.models.filter((m) => typeof m === 'string').slice(0, 500) : [],
            order: typeof g.order === 'number' ? g.order : 0,
          }));
        if (validGroups.length > 0) {
          providerConfig.customGroups = validGroups;
        }
      }

      // modelAssignments: Record<modelName, groupId>
      if (config.modelAssignments && typeof config.modelAssignments === 'object') {
        const assignments = {};
        for (const [model, groupId] of Object.entries(config.modelAssignments)) {
          if (typeof model === 'string' && typeof groupId === 'string') {
            assignments[model] = groupId;
          }
        }
        if (Object.keys(assignments).length > 0) {
          providerConfig.modelAssignments = assignments;
        }
      }

      // renamedGroups: Record<groupId, label>
      if (config.renamedGroups && typeof config.renamedGroups === 'object') {
        const renamed = {};
        for (const [groupId, label] of Object.entries(config.renamedGroups)) {
          if (typeof groupId === 'string' && typeof label === 'string') {
            renamed[groupId] = label.slice(0, 128);
          }
        }
        if (Object.keys(renamed).length > 0) {
          providerConfig.renamedGroups = renamed;
        }
      }

      if (Object.keys(providerConfig).length > 0) {
        sanitized[providerId] = providerConfig;
      }
    }
    if (Object.keys(sanitized).length > 0) {
      result.usageModelGroups = sanitized;
    }
  }

  return result;
};

const mergePersistedSettings = (current, changes) => {
  const baseApproved = Array.isArray(changes.approvedDirectories)
    ? changes.approvedDirectories
    : Array.isArray(current.approvedDirectories)
      ? current.approvedDirectories
      : [];

  const additionalApproved = [];
  if (typeof changes.lastDirectory === 'string' && changes.lastDirectory.length > 0) {
    additionalApproved.push(changes.lastDirectory);
  }
  if (typeof changes.homeDirectory === 'string' && changes.homeDirectory.length > 0) {
    additionalApproved.push(changes.homeDirectory);
  }
  const projectEntries = Array.isArray(changes.projects) ? changes.projects : Array.isArray(current.projects) ? current.projects : [];
  projectEntries.forEach((project) => {
    if (project && typeof project.path === 'string' && project.path.length > 0) {
      additionalApproved.push(project.path);
    }
  });
  const approvedSource = [...baseApproved, ...additionalApproved];

  const baseBookmarks = Array.isArray(changes.securityScopedBookmarks)
    ? changes.securityScopedBookmarks
    : Array.isArray(current.securityScopedBookmarks)
      ? current.securityScopedBookmarks
      : [];

  const nextTypographySizes = changes.typographySizes
    ? {
        ...(current.typographySizes || {}),
        ...changes.typographySizes,
      }
    : current.typographySizes;

  const next = {
    ...current,
    ...changes,
    approvedDirectories: Array.from(new Set(approvedSource.filter((entry) => typeof entry === 'string' && entry.length > 0))),
    securityScopedBookmarks: Array.from(new Set(baseBookmarks.filter((entry) => typeof entry === 'string' && entry.length > 0))),
    typographySizes: nextTypographySizes,
  };

  return next;
};

const formatSettingsResponse = (settings) => {
  const scopedSettings = scopeSettingsToEmbeddedWorkspace(settings, EMBEDDED_KRONTERM_WORKSPACE);
  const sanitized = sanitizeSettingsUpdate(scopedSettings);
  const approved = normalizeStringArray(scopedSettings.approvedDirectories);
  const bookmarks = normalizeStringArray(scopedSettings.securityScopedBookmarks);

  return {
    ...sanitized,
    approvedDirectories: approved,
    securityScopedBookmarks: bookmarks,
    pinnedDirectories: normalizeStringArray(scopedSettings.pinnedDirectories),
    typographySizes: sanitizeTypographySizesPartial(scopedSettings.typographySizes),
    showReasoningTraces:
      typeof scopedSettings.showReasoningTraces === 'boolean'
        ? scopedSettings.showReasoningTraces
        : typeof sanitized.showReasoningTraces === 'boolean'
          ? sanitized.showReasoningTraces
          : false,
  };
};

const validateProjectEntries = async (projects) => {
  console.log(`[validateProjectEntries] Starting validation for ${projects.length} projects`);

  if (!Array.isArray(projects)) {
    console.warn(`[validateProjectEntries] Input is not an array, returning empty`);
    return [];
  }

  const validations = projects.map(async (project) => {
    if (!project || typeof project.path !== 'string' || project.path.length === 0) {
      console.error(`[validateProjectEntries] Invalid project entry: missing or empty path`, project);
      return null;
    }
    try {
      const stats = await fsPromises.stat(project.path);
      if (!stats.isDirectory()) {
        console.error(`[validateProjectEntries] Project path is not a directory: ${project.path}`);
        return null;
      }
      return project;
    } catch (error) {
      const err = error;
      console.error(`[validateProjectEntries] Failed to validate project "${project.path}": ${err.code || err.message || err}`);
      if (err && typeof err === 'object' && err.code === 'ENOENT') {
        console.log(`[validateProjectEntries] Removing project with ENOENT: ${project.path}`);
        return null;
      }
      console.log(`[validateProjectEntries] Keeping project despite non-ENOENT error: ${project.path}`);
      return project;
    }
  });

  const results = (await Promise.all(validations)).filter((p) => p !== null);

  console.log(`[validateProjectEntries] Validation complete: ${results.length}/${projects.length} projects valid`);
  return results;
};

const migrateSettingsFromLegacyLastDirectory = async (current) => {
  const settings = current && typeof current === 'object' ? current : {};
  const now = Date.now();

  const sanitizedProjects = sanitizeProjects(settings.projects) || [];
  let nextProjects = sanitizedProjects;
  let nextActiveProjectId = typeof settings.activeProjectId === 'string' ? settings.activeProjectId : undefined;

  let changed = false;

  if (nextProjects.length === 0) {
    const legacy = typeof settings.lastDirectory === 'string' ? settings.lastDirectory.trim() : '';
    const candidate = legacy ? resolveDirectoryCandidate(legacy) : null;

    if (candidate) {
      try {
        const stats = await fsPromises.stat(candidate);
        if (stats.isDirectory()) {
          const id = crypto.randomUUID();
          nextProjects = [
            {
              id,
              path: candidate,
              addedAt: now,
              lastOpenedAt: now,
            },
          ];
          nextActiveProjectId = id;
          changed = true;
        }
      } catch {
        // ignore invalid lastDirectory
      }
    }
  }

  if (nextProjects.length > 0) {
    const active = nextProjects.find((project) => project.id === nextActiveProjectId) || null;
    if (!active) {
      nextActiveProjectId = nextProjects[0].id;
      changed = true;
    }
  } else if (nextActiveProjectId) {
    nextActiveProjectId = undefined;
    changed = true;
  }

  if (!changed) {
    return { settings, changed: false };
  }

  const merged = mergePersistedSettings(settings, {
    ...settings,
    projects: nextProjects,
    ...(nextActiveProjectId ? { activeProjectId: nextActiveProjectId } : { activeProjectId: undefined }),
  });

  return { settings: merged, changed: true };
};

const migrateSettingsFromLegacyThemePreferences = async (current) => {
  const settings = current && typeof current === 'object' ? current : {};

  const themeId = typeof settings.themeId === 'string' ? settings.themeId.trim() : '';
  const themeVariant = typeof settings.themeVariant === 'string' ? settings.themeVariant.trim() : '';

  const hasLight = typeof settings.lightThemeId === 'string' && settings.lightThemeId.trim().length > 0;
  const hasDark = typeof settings.darkThemeId === 'string' && settings.darkThemeId.trim().length > 0;

  if (hasLight && hasDark) {
    return { settings, changed: false };
  }

  const defaultLight = 'flexoki-light';
  const defaultDark = 'flexoki-dark';

  let nextLightThemeId = hasLight ? settings.lightThemeId : undefined;
  let nextDarkThemeId = hasDark ? settings.darkThemeId : undefined;

  if (!hasLight) {
    if (themeId && themeVariant === 'light') {
      nextLightThemeId = themeId;
    } else {
      nextLightThemeId = defaultLight;
    }
  }

  if (!hasDark) {
    if (themeId && themeVariant === 'dark') {
      nextDarkThemeId = themeId;
    } else {
      nextDarkThemeId = defaultDark;
    }
  }

  const merged = mergePersistedSettings(settings, {
    ...settings,
    ...(nextLightThemeId ? { lightThemeId: nextLightThemeId } : {}),
    ...(nextDarkThemeId ? { darkThemeId: nextDarkThemeId } : {}),
  });

  return { settings: merged, changed: true };
};

const migrateSettingsFromLegacyCollapsedProjects = async (current) => {
  const settings = current && typeof current === 'object' ? current : {};
  const collapsed = Array.isArray(settings.collapsedProjects) ? normalizeStringArray(settings.collapsedProjects) : [];

  if (collapsed.length === 0 || !Array.isArray(settings.projects)) {
    if (collapsed.length === 0) {
      return { settings, changed: false };
    }
    // Nothing to apply to; drop legacy key.
    const next = { ...settings };
    delete next.collapsedProjects;
    return { settings: next, changed: true };
  }

  const set = new Set(collapsed);
  const projects = sanitizeProjects(settings.projects) || [];
  let changed = false;

  const nextProjects = projects.map((project) => {
    const shouldCollapse = set.has(project.id);
    if (project.sidebarCollapsed !== shouldCollapse) {
      changed = true;
      return { ...project, sidebarCollapsed: shouldCollapse };
    }
    return project;
  });

  if (!changed) {
    // Still drop legacy key if present.
    if (Object.prototype.hasOwnProperty.call(settings, 'collapsedProjects')) {
      const next = { ...settings };
      delete next.collapsedProjects;
      return { settings: next, changed: true };
    }
    return { settings, changed: false };
  }

  const next = { ...settings, projects: nextProjects };
  delete next.collapsedProjects;
  return { settings: next, changed: true };
};

const DEFAULT_NOTIFICATION_TEMPLATES = {
  completion: { title: '{agent_name} is ready', message: '{model_name} completed the task' },
  error: { title: 'Tool error', message: '{last_message}' },
  question: { title: 'Input needed', message: '{last_message}' },
  subtask: { title: '{agent_name} is ready', message: '{model_name} completed the task' },
};

const ensureNotificationTemplateShape = (templates) => {
  const input = templates && typeof templates === 'object' ? templates : {};
  let changed = false;
  const next = {};

  for (const event of Object.keys(DEFAULT_NOTIFICATION_TEMPLATES)) {
    const currentEntry = input[event];
    const base = DEFAULT_NOTIFICATION_TEMPLATES[event];
    const currentTitle = typeof currentEntry?.title === 'string' ? currentEntry.title : base.title;
    const currentMessage = typeof currentEntry?.message === 'string' ? currentEntry.message : base.message;
    if (!currentEntry || typeof currentEntry.title !== 'string' || typeof currentEntry.message !== 'string') {
      changed = true;
    }
    next[event] = { title: currentTitle, message: currentMessage };
  }

  return { templates: next, changed };
};

const migrateSettingsNotificationDefaults = async (current) => {
  const settings = current && typeof current === 'object' ? current : {};
  let changed = false;
  const next = { ...settings };

  if (typeof settings.notifyOnSubtasks !== 'boolean') {
    next.notifyOnSubtasks = true;
    changed = true;
  }
  if (typeof settings.notifyOnCompletion !== 'boolean') {
    next.notifyOnCompletion = true;
    changed = true;
  }
  if (typeof settings.notifyOnError !== 'boolean') {
    next.notifyOnError = true;
    changed = true;
  }
  if (typeof settings.notifyOnQuestion !== 'boolean') {
    next.notifyOnQuestion = true;
    changed = true;
  }

  const { templates, changed: templatesChanged } = ensureNotificationTemplateShape(settings.notificationTemplates);
  if (templatesChanged || !settings.notificationTemplates || typeof settings.notificationTemplates !== 'object') {
    next.notificationTemplates = templates;
    changed = true;
  }

  return { settings: changed ? next : settings, changed };
};

const migrateSettingsBrowserFirstAgentMode = async (current) => {
  const settings = current && typeof current === 'object' ? current : {};
  let changed = false;
  const next = { ...settings };

  const normalizedAgentMode = normalizeAgentModeSetting(settings.agentMode);
  if (normalizedAgentMode !== settings.agentMode) {
    next.agentMode = normalizedAgentMode;
    changed = true;
  }

  const originalMap = settings.agentModeByProject && typeof settings.agentModeByProject === 'object' ? settings.agentModeByProject : null;
  if (originalMap) {
    const filtered = {};
    for (const [rawKey, rawValue] of Object.entries(originalMap)) {
      const key = typeof rawKey === 'string' ? rawKey.trim() : '';
      if (!key) continue;
      const mode = normalizeAgentModeSetting(rawValue);
      if (mode !== 'off') {
        filtered[key] = mode;
      }
    }
    const before = JSON.stringify(originalMap);
    const after = JSON.stringify(filtered);
    if (before !== after) {
      next.agentModeByProject = filtered;
      changed = true;
    }
  }

  return { settings: changed ? next : settings, changed };
};

const readSettingsFromDiskMigrated = async () => {
  const current = await readSettingsFromDisk();
  const migration1 = await migrateSettingsFromLegacyLastDirectory(current);
  const migration2 = await migrateSettingsFromLegacyThemePreferences(migration1.settings);
  const migration3 = await migrateSettingsFromLegacyCollapsedProjects(migration2.settings);
  const migration4 = await migrateSettingsNotificationDefaults(migration3.settings);
  const migration5 = await migrateSettingsBrowserFirstAgentMode(migration4.settings);
  if (migration1.changed || migration2.changed || migration3.changed || migration4.changed || migration5.changed) {
    await writeSettingsToDisk(migration5.settings);
  }
  return migration5.settings;
};

const getOrCreateVapidKeys = async () => {
  const settings = await readSettingsFromDiskMigrated();
  const existing = settings?.vapidKeys;
  if (existing && typeof existing.publicKey === 'string' && typeof existing.privateKey === 'string') {
    return { publicKey: existing.publicKey, privateKey: existing.privateKey };
  }

  const generated = webPush.generateVAPIDKeys();
  const next = {
    ...settings,
    vapidKeys: {
      publicKey: generated.publicKey,
      privateKey: generated.privateKey,
    },
  };

  await writeSettingsToDisk(next);
  return { publicKey: generated.publicKey, privateKey: generated.privateKey };
};

const getUiSessionTokenFromRequest = (req) => {
  const cookieHeader = req?.headers?.cookie;
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return null;
  }
  const segments = cookieHeader.split(';');
  for (const segment of segments) {
    const [rawName, ...rest] = segment.split('=');
    const name = rawName?.trim();
    if (!name) continue;
    if (name !== 'oc_ui_session') continue;
    const value = rest.join('=').trim();
    try {
      return decodeURIComponent(value || '');
    } catch {
      return value || null;
    }
  }
  return null;
};

const TERMINAL_INPUT_WS_MAX_REBINDS_PER_WINDOW = 128;
const TERMINAL_INPUT_WS_REBIND_WINDOW_MS = 60 * 1000;
const TERMINAL_INPUT_WS_HEARTBEAT_INTERVAL_MS = 15 * 1000;

const rejectWebSocketUpgrade = (socket, statusCode, reason) => {
  if (!socket || socket.destroyed) {
    return;
  }

  const message = typeof reason === 'string' && reason.trim().length > 0 ? reason.trim() : 'Bad Request';
  const body = Buffer.from(message, 'utf8');
  const statusText =
    {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      500: 'Internal Server Error',
    }[statusCode] || 'Bad Request';

  try {
    socket.write(
      `HTTP/1.1 ${statusCode} ${statusText}\r\n` +
        'Connection: close\r\n' +
        'Content-Type: text/plain; charset=utf-8\r\n' +
        `Content-Length: ${body.length}\r\n\r\n`,
    );
    socket.write(body);
  } catch {}

  try {
    socket.destroy();
  } catch {}
};

const getRequestOriginCandidates = async (req) => {
  const origins = new Set();
  const forwardedProto =
    typeof req.headers['x-forwarded-proto'] === 'string' ? req.headers['x-forwarded-proto'].split(',')[0].trim().toLowerCase() : '';
  const protocol = forwardedProto || (req.socket?.encrypted ? 'https' : 'http');

  const forwardedHost = typeof req.headers['x-forwarded-host'] === 'string' ? req.headers['x-forwarded-host'].split(',')[0].trim() : '';
  const host = forwardedHost || (typeof req.headers.host === 'string' ? req.headers.host.trim() : '');

  if (host) {
    origins.add(`${protocol}://${host}`);
    const [hostname, port] = host.split(':');
    const normalizedHost = typeof hostname === 'string' ? hostname.toLowerCase() : '';
    const portSuffix = typeof port === 'string' && port.length > 0 ? `:${port}` : '';
    if (normalizedHost === 'localhost') {
      origins.add(`${protocol}://127.0.0.1${portSuffix}`);
      origins.add(`${protocol}://[::1]${portSuffix}`);
    } else if (normalizedHost === '127.0.0.1' || normalizedHost === '[::1]') {
      origins.add(`${protocol}://localhost${portSuffix}`);
    }
  }

  try {
    const settings = await readSettingsFromDiskMigrated();
    if (typeof settings?.publicOrigin === 'string' && settings.publicOrigin.trim().length > 0) {
      origins.add(new URL(settings.publicOrigin.trim()).origin);
    }
  } catch {}

  return origins;
};

const isRequestOriginAllowed = async (req) => {
  const originHeader = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
  if (!originHeader) {
    return false;
  }

  let normalizedOrigin = '';
  try {
    normalizedOrigin = new URL(originHeader).origin;
  } catch {
    return false;
  }

  const allowedOrigins = await getRequestOriginCandidates(req);
  return allowedOrigins.has(normalizedOrigin);
};

const normalizePushSubscriptions = (record) => {
  if (!Array.isArray(record)) return [];
  return record
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const endpoint = entry.endpoint;
      const p256dh = entry.p256dh;
      const auth = entry.auth;
      if (typeof endpoint !== 'string' || typeof p256dh !== 'string' || typeof auth !== 'string') {
        return null;
      }
      return {
        endpoint,
        p256dh,
        auth,
        createdAt: typeof entry.createdAt === 'number' ? entry.createdAt : null,
      };
    })
    .filter(Boolean);
};

const getPushSubscriptionsForUiSession = async (uiSessionToken) => {
  if (!uiSessionToken) return [];
  const store = await readPushSubscriptionsFromDisk();
  const record = store.subscriptionsBySession?.[uiSessionToken];
  return normalizePushSubscriptions(record);
};

const addOrUpdatePushSubscription = async (uiSessionToken, subscription, userAgent) => {
  if (!uiSessionToken) {
    return;
  }

  await ensurePushInitialized();

  const now = Date.now();

  await persistPushSubscriptionUpdate((current) => {
    const subsBySession = { ...(current.subscriptionsBySession || {}) };
    const existing = Array.isArray(subsBySession[uiSessionToken]) ? subsBySession[uiSessionToken] : [];

    const filtered = existing.filter((entry) => entry && typeof entry.endpoint === 'string' && entry.endpoint !== subscription.endpoint);

    filtered.unshift({
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
      createdAt: now,
      lastSeenAt: now,
      userAgent: typeof userAgent === 'string' && userAgent.length > 0 ? userAgent : undefined,
    });

    subsBySession[uiSessionToken] = filtered.slice(0, 10);

    return { version: PUSH_SUBSCRIPTIONS_VERSION, subscriptionsBySession: subsBySession };
  });
};

const removePushSubscription = async (uiSessionToken, endpoint) => {
  if (!uiSessionToken || !endpoint) return;

  await ensurePushInitialized();

  await persistPushSubscriptionUpdate((current) => {
    const subsBySession = { ...(current.subscriptionsBySession || {}) };
    const existing = Array.isArray(subsBySession[uiSessionToken]) ? subsBySession[uiSessionToken] : [];
    const filtered = existing.filter((entry) => entry && typeof entry.endpoint === 'string' && entry.endpoint !== endpoint);
    if (filtered.length === 0) {
      delete subsBySession[uiSessionToken];
    } else {
      subsBySession[uiSessionToken] = filtered;
    }
    return { version: PUSH_SUBSCRIPTIONS_VERSION, subscriptionsBySession: subsBySession };
  });
};

const removePushSubscriptionFromAllSessions = async (endpoint) => {
  if (!endpoint) return;

  await ensurePushInitialized();

  await persistPushSubscriptionUpdate((current) => {
    const subsBySession = { ...(current.subscriptionsBySession || {}) };
    for (const [token, entries] of Object.entries(subsBySession)) {
      if (!Array.isArray(entries)) continue;
      const filtered = entries.filter((entry) => entry && typeof entry.endpoint === 'string' && entry.endpoint !== endpoint);
      if (filtered.length === 0) {
        delete subsBySession[token];
      } else {
        subsBySession[token] = filtered;
      }
    }
    return { version: PUSH_SUBSCRIPTIONS_VERSION, subscriptionsBySession: subsBySession };
  });
};

const buildSessionDeepLinkUrl = (sessionId) => {
  if (!sessionId || typeof sessionId !== 'string') {
    return '/';
  }
  return `/?session=${encodeURIComponent(sessionId)}`;
};

const sendPushToSubscription = async (sub, payload) => {
  await ensurePushInitialized();
  const body = JSON.stringify(payload);

  const pushSubscription = {
    endpoint: sub.endpoint,
    keys: {
      p256dh: sub.p256dh,
      auth: sub.auth,
    },
  };

  try {
    await webPush.sendNotification(pushSubscription, body);
  } catch (error) {
    const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : null;
    if (statusCode === 410 || statusCode === 404) {
      await removePushSubscriptionFromAllSessions(sub.endpoint);
      return;
    }
    console.warn('[Push] Failed to send notification:', error);
  }
};

const sendPushToAllUiSessions = async (payload, options = {}) => {
  const requireNoSse = options.requireNoSse === true;
  const store = await readPushSubscriptionsFromDisk();
  const sessions = store.subscriptionsBySession || {};
  const subscriptionsByEndpoint = new Map();

  for (const [token, record] of Object.entries(sessions)) {
    const subscriptions = normalizePushSubscriptions(record);
    if (subscriptions.length === 0) continue;

    for (const sub of subscriptions) {
      if (!subscriptionsByEndpoint.has(sub.endpoint)) {
        subscriptionsByEndpoint.set(sub.endpoint, sub);
      }
    }
  }

  await Promise.all(
    Array.from(subscriptionsByEndpoint.entries()).map(async ([endpoint, sub]) => {
      if (requireNoSse && isAnyUiVisible()) {
        return;
      }
      await sendPushToSubscription(sub, payload);
    }),
  );
};

let pushInitialized = false;

const UI_VISIBILITY_TTL_MS = 30 * 1000;
const uiVisibilityByToken = new Map();

const normalizeHeaderValue = (value) => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  if (Array.isArray(value)) {
    const first = value.find((entry) => typeof entry === 'string' && entry.trim().length > 0);
    return typeof first === 'string' ? first.trim() : null;
  }
  return null;
};

const resolveRequestClientIdentity = (req) => {
  const clientId = normalizeHeaderValue(req.headers['x-client-id']) || req.ip || 'anonymous';
  const windowId = normalizeHeaderValue(req.headers['x-window-id']);
  const key = windowId ? `${clientId}:${windowId}` : clientId;
  return { clientId, windowId, key };
};

const dayKeyFromTimestamp = (value) => {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return null;
  }
  try {
    return new Date(timestamp).toISOString().slice(0, 10);
  } catch {
    return null;
  }
};

const dayKeyWithOffset = (dayKey, offsetDays) => {
  const normalized = normalizeDayKey(dayKey);
  if (!normalized) return null;
  const base = Date.parse(`${normalized}T00:00:00.000Z`);
  if (!Number.isFinite(base)) return null;
  const next = new Date(base + offsetDays * 24 * 60 * 60 * 1000);
  return next.toISOString().slice(0, 10);
};

const retentionRate = (numerator, denominator) => (denominator > 0 ? Number((numerator / denominator).toFixed(4)) : 0);

const resolveRetentionUserKey = (req) => {
  const token = getUiSessionTokenFromRequest(req);
  if (typeof token === 'string' && token.trim().length > 0) {
    const hashed = crypto.createHash('sha256').update(token).digest('hex').slice(0, 24);
    return `ui:${hashed}`;
  }
  const identity = resolveRequestClientIdentity(req);
  if (identity.key && identity.key.trim().length > 0) {
    return `client:${identity.key.trim().slice(0, 120)}`;
  }
  return null;
};

const touchRetentionUser = (store, userKey, now = Date.now()) => {
  if (!userKey || typeof userKey !== 'string') {
    return null;
  }

  const users = store.users || (store.users = {});
  const existing = users[userKey];
  const dayKey = dayKeyFromTimestamp(now);
  const activeDays = Array.isArray(existing?.active_days) ? existing.active_days.slice() : [];
  if (dayKey && !activeDays.includes(dayKey)) {
    activeDays.push(dayKey);
    activeDays.sort();
  }

  const profile = {
    first_seen_at: existing && Number.isFinite(Number(existing.first_seen_at)) ? Number(existing.first_seen_at) : Number(now),
    last_seen_at: Number(now),
    active_days: activeDays,
    resume_count: existing && Number.isFinite(Number(existing.resume_count)) ? Math.max(0, Math.round(existing.resume_count)) : 0,
    resume_last_at: existing && Number.isFinite(Number(existing.resume_last_at)) ? Number(existing.resume_last_at) : null,
  };

  users[userKey] = profile;
  return profile;
};

const pruneRetentionPendingReruns = (store, now = Date.now()) => {
  if (!store.rerun_pending_by_session || typeof store.rerun_pending_by_session !== 'object') {
    store.rerun_pending_by_session = {};
    return;
  }
  for (const [sessionID, pending] of Object.entries(store.rerun_pending_by_session)) {
    const at = Number(pending?.at);
    if (!Number.isFinite(at) || now - at > RETENTION_RERUN_WINDOW_MS) {
      delete store.rerun_pending_by_session[sessionID];
    }
  }
};

const trackRetentionResumeInvocation = async (req, success) => {
  const userKey = resolveRetentionUserKey(req);
  const now = Date.now();
  await persistRetentionAnalyticsUpdate((current) => {
    touchRetentionUser(current, userKey, now);
    current.counters.resume_attempts += 1;
    if (success) {
      current.counters.resume_successes += 1;
      const user = touchRetentionUser(current, userKey, now);
      if (user) {
        user.resume_count += 1;
        user.resume_last_at = now;
      }
    }
    pruneRetentionPendingReruns(current, now);
    return current;
  });
};

const trackRetentionToolError = async (sessionID, messageID) => {
  if (typeof sessionID !== 'string' || sessionID.trim().length === 0) return;
  const now = Date.now();
  await persistRetentionAnalyticsUpdate((current) => {
    pruneRetentionPendingReruns(current, now);
    const existing = current.rerun_pending_by_session[sessionID];
    const duplicateMessage =
      typeof messageID === 'string' &&
      messageID.trim().length > 0 &&
      typeof existing?.message_id === 'string' &&
      existing.message_id === messageID &&
      Number.isFinite(Number(existing?.at)) &&
      now - Number(existing.at) < RETENTION_RERUN_WINDOW_MS;

    if (!duplicateMessage) {
      current.counters.rerun_eligible_errors += 1;
    }

    current.rerun_pending_by_session[sessionID] = {
      at: now,
      message_id: typeof messageID === 'string' && messageID.trim().length > 0 ? messageID.trim() : null,
    };
    return current;
  });
};

const trackRetentionUserMessageSent = async (req, sessionID) => {
  if (typeof sessionID !== 'string' || sessionID.trim().length === 0) {
    return;
  }
  const userKey = resolveRetentionUserKey(req);
  const now = Date.now();
  await persistRetentionAnalyticsUpdate((current) => {
    touchRetentionUser(current, userKey, now);
    pruneRetentionPendingReruns(current, now);
    const pending = current.rerun_pending_by_session[sessionID];
    const pendingAt = Number(pending?.at);
    if (Number.isFinite(pendingAt) && now - pendingAt <= RETENTION_RERUN_WINDOW_MS) {
      current.counters.rerun_after_error += 1;
      delete current.rerun_pending_by_session[sessionID];
    }
    return current;
  });
};

const buildRetentionKpi = (store, now = Date.now()) => {
  const users = Object.values(store.users || {});
  const totalUsers = users.length;
  const adoptedUsers = users.filter((user) => Number(user.resume_count || 0) > 0).length;
  const returningUsers = users.filter((user) => Array.isArray(user.active_days) && user.active_days.length > 1).length;
  const sessionReturnEvents = users.reduce((total, user) => {
    const dayCount = Array.isArray(user.active_days) ? user.active_days.length : 0;
    return total + Math.max(0, dayCount - 1);
  }, 0);

  let d1Eligible = 0;
  let d1Returned = 0;
  let d7Eligible = 0;
  let d7Returned = 0;

  const nowDayKey = dayKeyFromTimestamp(now);
  const nowDayStart = nowDayKey ? Date.parse(`${nowDayKey}T00:00:00.000Z`) : now;

  for (const user of users) {
    const firstDay = normalizeDayKey(user.active_days?.[0]) || dayKeyFromTimestamp(user.first_seen_at);
    if (!firstDay) continue;
    const firstStart = Date.parse(`${firstDay}T00:00:00.000Z`);
    if (!Number.isFinite(firstStart)) continue;
    const daysElapsed = Math.floor((nowDayStart - firstStart) / (24 * 60 * 60 * 1000));
    const activeDaySet = new Set((Array.isArray(user.active_days) ? user.active_days : []).map(normalizeDayKey).filter(Boolean));

    if (daysElapsed >= 1) {
      d1Eligible += 1;
      const d1Key = dayKeyWithOffset(firstDay, 1);
      if (d1Key && activeDaySet.has(d1Key)) {
        d1Returned += 1;
      }
    }

    if (daysElapsed >= 7) {
      d7Eligible += 1;
      const d7Key = dayKeyWithOffset(firstDay, 7);
      if (d7Key && activeDaySet.has(d7Key)) {
        d7Returned += 1;
      }
    }
  }

  const rerunEligibleErrors = Number(store.counters?.rerun_eligible_errors || 0);
  const rerunAfterError = Number(store.counters?.rerun_after_error || 0);
  const resumeAttempts = Number(store.counters?.resume_attempts || 0);
  const resumeSuccesses = Number(store.counters?.resume_successes || 0);

  return {
    generated_at: now,
    users: {
      total: totalUsers,
      returning: returningUsers,
      session_return_events: sessionReturnEvents,
    },
    retention: {
      d1: {
        eligible: d1Eligible,
        returned: d1Returned,
        rate: retentionRate(d1Returned, d1Eligible),
      },
      d7: {
        eligible: d7Eligible,
        returned: d7Returned,
        rate: retentionRate(d7Returned, d7Eligible),
      },
    },
    resume: {
      attempts: resumeAttempts,
      successes: resumeSuccesses,
      success_rate: retentionRate(resumeSuccesses, resumeAttempts),
      adopted_users: adoptedUsers,
      adoption_rate: retentionRate(adoptedUsers, totalUsers),
    },
    rerun: {
      eligible_errors: rerunEligibleErrors,
      rerun_after_error: rerunAfterError,
      rerun_rate: retentionRate(rerunAfterError, rerunEligibleErrors),
      window_ms: RETENTION_RERUN_WINDOW_MS,
    },
  };
};

const pruneUiVisibility = () => {
  const now = Date.now();
  for (const [key, value] of uiVisibilityByToken.entries()) {
    if (!value || now - value.updatedAt > UI_VISIBILITY_TTL_MS) {
      uiVisibilityByToken.delete(key);
    }
  }
};

const resolveVisibilityKey = (token, identity) => {
  const suffix = identity?.key || 'anonymous';
  return `${token}:${suffix}`;
};

const updateUiVisibility = (token, visible, identity) => {
  if (!token) return;
  const now = Date.now();
  const nextVisible = Boolean(visible);
  const key = resolveVisibilityKey(token, identity);
  uiVisibilityByToken.set(key, {
    token,
    clientId: identity?.clientId || 'anonymous',
    windowId: identity?.windowId || null,
    visible: nextVisible,
    updatedAt: now,
  });
  pruneUiVisibility();
};

const isAnyUiVisible = () => {
  pruneUiVisibility();
  for (const value of uiVisibilityByToken.values()) {
    if (value?.visible === true) {
      return true;
    }
  }
  return false;
};

const isUiVisible = (token) => {
  pruneUiVisibility();
  for (const value of uiVisibilityByToken.values()) {
    if (value?.token === token && value?.visible === true) {
      return true;
    }
  }
  return false;
};

// Session activity tracking (mirrors desktop session_activity.rs)
const sessionActivityPhases = new Map(); // sessionId -> { phase: 'idle'|'busy'|'cooldown', updatedAt: number }
const sessionActivityCooldowns = new Map(); // sessionId -> timeoutId
const SESSION_COOLDOWN_DURATION_MS = 2000;

// Complete session status tracking - source of truth for web clients
// This maintains the authoritative state, clients only cache it
const sessionStates = new Map(); // sessionId -> {
//   status: 'idle'|'busy'|'retry',
//   lastUpdateAt: number,
//   lastEventId: string,
//   metadata: { attempt?: number, message?: string, next?: number }
// }
const SESSION_STATE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_STATE_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

const updateSessionState = (sessionId, status, eventId, metadata = {}) => {
  if (!sessionId || typeof sessionId !== 'string') return;

  const now = Date.now();
  const existing = sessionStates.get(sessionId);

  // Only update if this is a newer event (simple ordering protection)
  if (existing && existing.lastUpdateAt > now - 5000 && status === existing.status) {
    // Same status within 5 seconds, skip to reduce noise
    return;
  }

  sessionStates.set(sessionId, {
    status,
    lastUpdateAt: now,
    lastEventId: eventId || `server-${now}`,
    metadata: { ...existing?.metadata, ...metadata },
  });

  // Update attention tracking state (must be called before broadcasting)
  updateSessionAttentionStatus(sessionId, status, eventId);

  // Broadcast status change to connected web clients via SSE
  // This enables real-time updates without polling
  // Include needsAttention in the same event to ensure atomic updates
  if (uiNotificationClients.size > 0 && (!existing || existing.status !== status)) {
    const state = sessionStates.get(sessionId);
    const attentionState = sessionAttentionStates.get(sessionId);
    for (const res of uiNotificationClients) {
      try {
        writeSseEvent(res, {
          type: 'openchamber:session-status',
          properties: {
            sessionId,
            status: state.status,
            timestamp: state.lastUpdateAt,
            metadata: state.metadata,
            needsAttention: attentionState?.needsAttention ?? false,
          },
        });
      } catch {
        // Client disconnected, will be cleaned up by close handler
      }
    }
  }

  // Also update activity phases for backward compatibility
  const phase = status === 'busy' || status === 'retry' ? 'busy' : 'idle';
  setSessionActivityPhase(sessionId, phase);
};

const getSessionStateSnapshot = () => {
  const result = {};
  const now = Date.now();

  for (const [sessionId, data] of sessionStates) {
    // Skip very old states (session likely gone)
    if (now - data.lastUpdateAt > SESSION_STATE_MAX_AGE_MS) continue;

    result[sessionId] = {
      status: data.status,
      lastUpdateAt: data.lastUpdateAt,
      metadata: data.metadata,
    };
  }

  return result;
};

const getSessionState = (sessionId) => {
  if (!sessionId) return null;
  return sessionStates.get(sessionId) || null;
};

// Session attention tracking - authoritative source for unread/needs-attention state
// Tracks which sessions need user attention based on activity and view state
const sessionAttentionStates = new Map(); // sessionId -> {
//   needsAttention: boolean,
//   lastUserMessageAt: number | null,
//   lastStatusChangeAt: number,
//   viewedByClients: Set<clientId>,
//   status: 'idle' | 'busy' | 'retry'
// }
const SESSION_ATTENTION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

const getOrCreateAttentionState = (sessionId) => {
  if (!sessionId || typeof sessionId !== 'string') return null;

  let state = sessionAttentionStates.get(sessionId);
  if (!state) {
    state = {
      needsAttention: false,
      lastUserMessageAt: null,
      lastStatusChangeAt: Date.now(),
      viewedByClients: new Set(),
      status: 'idle',
    };
    sessionAttentionStates.set(sessionId, state);
  }
  return state;
};

const updateSessionAttentionStatus = (sessionId, status, eventId) => {
  const state = getOrCreateAttentionState(sessionId);
  if (!state) return;

  const prevStatus = state.status;
  state.status = status;
  state.lastStatusChangeAt = Date.now();

  // Check if we need to mark as needsAttention
  // Condition: transitioning from busy/retry to idle + user sent message + not currently viewed
  // Note: The actual broadcast with needsAttention is done in updateSessionState
  // to ensure both status and attention are sent in a single event
  if ((prevStatus === 'busy' || prevStatus === 'retry') && status === 'idle') {
    if (state.lastUserMessageAt && state.viewedByClients.size === 0) {
      state.needsAttention = true;
    }
  }
};

const markSessionViewed = (sessionId, clientId) => {
  const state = getOrCreateAttentionState(sessionId);
  if (!state) return;

  const wasNeedsAttention = state.needsAttention;
  state.viewedByClients.add(clientId);

  // Clear needsAttention when viewed
  if (wasNeedsAttention) {
    state.needsAttention = false;

    // Broadcast attention cleared event
    if (uiNotificationClients.size > 0) {
      for (const res of uiNotificationClients) {
        try {
          writeSseEvent(res, {
            type: 'openchamber:session-status',
            properties: {
              sessionId,
              status: state.status,
              timestamp: Date.now(),
              metadata: {},
              needsAttention: false,
            },
          });
        } catch {
          // Client disconnected
        }
      }
    }
  }
};

const markSessionUnviewed = (sessionId, clientId) => {
  const state = sessionAttentionStates.get(sessionId);
  if (!state) return;

  state.viewedByClients.delete(clientId);
};

const markUserMessageSent = (sessionId, clientId) => {
  const state = getOrCreateAttentionState(sessionId);
  if (!state) return;

  state.lastUserMessageAt = Date.now();
  if (typeof clientId === 'string' && clientId.trim().length > 0) {
    state.viewedByClients.add(clientId.trim());
    if (state.needsAttention) {
      state.needsAttention = false;
    }
  }
};

const getSessionAttentionSnapshot = () => {
  const result = {};
  const now = Date.now();

  for (const [sessionId, state] of sessionAttentionStates) {
    // Skip very old states
    if (now - state.lastStatusChangeAt > SESSION_ATTENTION_MAX_AGE_MS) continue;

    result[sessionId] = {
      needsAttention: state.needsAttention,
      lastUserMessageAt: state.lastUserMessageAt,
      lastStatusChangeAt: state.lastStatusChangeAt,
      status: state.status,
      isViewed: state.viewedByClients.size > 0,
    };
  }

  return result;
};

const getSessionAttentionState = (sessionId) => {
  if (!sessionId) return null;
  const state = sessionAttentionStates.get(sessionId);
  if (!state) return null;

  return {
    needsAttention: state.needsAttention,
    lastUserMessageAt: state.lastUserMessageAt,
    lastStatusChangeAt: state.lastStatusChangeAt,
    status: state.status,
    isViewed: state.viewedByClients.size > 0,
  };
};

const cleanupOldSessionStates = () => {
  const now = Date.now();
  let cleaned = 0;

  for (const [sessionId, data] of sessionStates) {
    if (now - data.lastUpdateAt > SESSION_STATE_MAX_AGE_MS) {
      sessionStates.delete(sessionId);
      cleaned++;
    }
  }

  // Also cleanup attention states
  for (const [sessionId, state] of sessionAttentionStates) {
    if (now - state.lastStatusChangeAt > SESSION_ATTENTION_MAX_AGE_MS) {
      sessionAttentionStates.delete(sessionId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.info(`[SessionState] Cleaned up ${cleaned} old session states`);
  }
};

// Start periodic cleanup
setInterval(cleanupOldSessionStates, SESSION_STATE_CLEANUP_INTERVAL_MS);

const setSessionActivityPhase = (sessionId, phase) => {
  if (!sessionId || typeof sessionId !== 'string') return false;

  const current = sessionActivityPhases.get(sessionId);
  if (current?.phase === phase) return false; // No change

  // Match desktop semantics: only enter cooldown from busy.
  if (phase === 'cooldown' && current?.phase !== 'busy') {
    return false;
  }

  // Cancel existing cooldown timer only on phase change.
  const existingTimer = sessionActivityCooldowns.get(sessionId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    sessionActivityCooldowns.delete(sessionId);
  }

  sessionActivityPhases.set(sessionId, { phase, updatedAt: Date.now() });

  // Schedule transition from cooldown to idle
  if (phase === 'cooldown') {
    const timer = setTimeout(() => {
      const now = sessionActivityPhases.get(sessionId);
      if (now?.phase === 'cooldown') {
        sessionActivityPhases.set(sessionId, { phase: 'idle', updatedAt: Date.now() });
      }
      sessionActivityCooldowns.delete(sessionId);
    }, SESSION_COOLDOWN_DURATION_MS);
    sessionActivityCooldowns.set(sessionId, timer);
  }

  return true;
};

const getSessionActivitySnapshot = () => {
  const result = {};
  for (const [sessionId, data] of sessionActivityPhases) {
    result[sessionId] = { type: data.phase };
  }
  return result;
};

const resetAllSessionActivityToIdle = () => {
  // Cancel all cooldown timers
  for (const timer of sessionActivityCooldowns.values()) {
    clearTimeout(timer);
  }
  sessionActivityCooldowns.clear();

  // Reset all phases to idle
  const now = Date.now();
  for (const [sessionId] of sessionActivityPhases) {
    sessionActivityPhases.set(sessionId, { phase: 'idle', updatedAt: now });
  }
};

const resolveVapidSubject = async () => {
  const configured = process.env.OPENCHAMBER_VAPID_SUBJECT;
  if (typeof configured === 'string' && configured.trim().length > 0) {
    return configured.trim();
  }

  const originEnv = process.env.OPENCHAMBER_PUBLIC_ORIGIN;
  if (typeof originEnv === 'string' && originEnv.trim().length > 0) {
    const trimmed = originEnv.trim();
    // Convert http://localhost to mailto for VAPID compatibility
    if (trimmed.startsWith('http://localhost')) {
      return 'mailto:openchamber@localhost';
    }
    return trimmed;
  }

  try {
    const settings = await readSettingsFromDiskMigrated();
    const stored = settings?.publicOrigin;
    if (typeof stored === 'string' && stored.trim().length > 0) {
      const trimmed = stored.trim();
      // Convert http://localhost to mailto for VAPID compatibility
      if (trimmed.startsWith('http://localhost')) {
        return 'mailto:openchamber@localhost';
      }
      return trimmed;
    }
  } catch {
    // ignore
  }

  return 'mailto:openchamber@localhost';
};

const ensurePushInitialized = async () => {
  if (pushInitialized) return;
  const keys = await getOrCreateVapidKeys();
  const subject = await resolveVapidSubject();

  if (subject === 'mailto:openchamber@localhost') {
    console.warn('[Push] No public origin configured for VAPID; set OPENCHAMBER_VAPID_SUBJECT or enable push once from a real origin.');
  }

  webPush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
  pushInitialized = true;
};

const persistSettings = async (changes) => {
  // Serialize concurrent calls using lock
  persistSettingsLock = persistSettingsLock.then(async () => {
    if (VERBOSE_SETTINGS_LOGS) {
      console.log(`[persistSettings] Called with changes:`, JSON.stringify(changes, null, 2));
    }
    const current = await readSettingsFromDisk();
    if (VERBOSE_SETTINGS_LOGS) {
      console.log(`[persistSettings] Current projects count:`, Array.isArray(current.projects) ? current.projects.length : 'N/A');
    }
    const sanitized = sanitizeSettingsUpdate(changes);
    const hasProjectListUpdate = Object.prototype.hasOwnProperty.call(sanitized, 'projects');
    const hasActiveProjectUpdate = Object.prototype.hasOwnProperty.call(sanitized, 'activeProjectId');
    let next = mergePersistedSettings(current, sanitized);

    if (hasProjectListUpdate && Array.isArray(next.projects)) {
      if (VERBOSE_SETTINGS_LOGS) {
        console.log(`[persistSettings] Validating ${next.projects.length} projects...`);
      }
      const validated = await validateProjectEntries(next.projects);
      if (VERBOSE_SETTINGS_LOGS) {
        console.log(`[persistSettings] After validation: ${validated.length} projects remain`);
      }
      next = { ...next, projects: validated };
    }

    if ((hasProjectListUpdate || hasActiveProjectUpdate) && Array.isArray(next.projects) && next.projects.length > 0) {
      const activeId = typeof next.activeProjectId === 'string' ? next.activeProjectId : '';
      const active = next.projects.find((project) => project.id === activeId) || null;
      if (!active) {
        if (VERBOSE_SETTINGS_LOGS) {
          console.log(`[persistSettings] Active project ID ${activeId} not found, switching to ${next.projects[0].id}`);
        }
        next = { ...next, activeProjectId: next.projects[0].id };
      }
    } else if ((hasProjectListUpdate || hasActiveProjectUpdate) && next.activeProjectId) {
      if (VERBOSE_SETTINGS_LOGS) {
        console.log(`[persistSettings] No projects found, clearing activeProjectId ${next.activeProjectId}`);
      }
      next = { ...next, activeProjectId: undefined };
    }

    if (isDeepStrictEqual(current, next)) {
      if (VERBOSE_SETTINGS_LOGS) {
        console.log(`[persistSettings] No-op update detected; skipping disk write`);
      }
      return formatSettingsResponse(current);
    }

    await writeSettingsToDisk(next);
    if (VERBOSE_SETTINGS_LOGS) {
      console.log(`[persistSettings] Successfully saved ${next.projects?.length || 0} projects to disk`);
    }
    return formatSettingsResponse(next);
  });

  return persistSettingsLock;
};

// HMR-persistent state via globalThis
// These values survive Vite HMR reloads to prevent zombie OpenCode processes
const HMR_STATE_KEY = '__openchamberHmrState';
const getHmrState = () => {
  if (!globalThis[HMR_STATE_KEY]) {
    globalThis[HMR_STATE_KEY] = {
      openCodeProcess: null,
      openCodePort: null,
      openCodeWorkingDirectory: EMBEDDED_KRONTERM_WORKSPACE || process.cwd(),
      isShuttingDown: false,
      signalsAttached: false,
      userProvidedOpenCodePassword: undefined,
      openCodeAuthPassword: null,
      openCodeAuthSource: null,
    };
  }
  return globalThis[HMR_STATE_KEY];
};
const hmrState = getHmrState();

const normalizeOpenCodePassword = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
};

if (typeof hmrState.userProvidedOpenCodePassword === 'undefined') {
  const initialPassword = normalizeOpenCodePassword(process.env.KRONOSCODE_SERVER_PASSWORD || process.env.OPENCODE_SERVER_PASSWORD);
  hmrState.userProvidedOpenCodePassword = initialPassword || null;
}

// Non-HMR state (safe to reset on reload)
let healthCheckInterval = null;
let server = null;
let cachedModelsMetadata = null;
let cachedModelsMetadataTimestamp = 0;
let lastModelsMetadataFailureLogAt = 0;
let cachedOpenCodeSessions = [];
let cachedOpenCodeSessionsTimestamp = 0;
const browserStateFailureTracker = new Map();
let expressApp = null;
let currentRestartPromise = null;
let isRestartingOpenCode = false;
let openCodeApiPrefix = '';
let openCodeApiPrefixDetected = true;
let openCodeApiDetectionTimer = null;
let lastOpenCodeError = null;
let isOpenCodeReady = false;
let openCodeNotReadySince = 0;
let isExternalOpenCode = false;
let exitOnShutdown = true;
let uiAuthController = null;
let cloudflareTunnelController = null;
let terminalInputWsServer = null;
let kronosGatewayWsServer = null;
let businessProxyMiddleware = null;
let socialProxyMiddleware = null;
let videoProxyMiddleware = null;
let jaazProxyMiddleware = null;
const userProvidedOpenCodePassword =
  typeof hmrState.userProvidedOpenCodePassword === 'string' && hmrState.userProvidedOpenCodePassword.length > 0
    ? hmrState.userProvidedOpenCodePassword
    : null;
let openCodeAuthPassword =
  typeof hmrState.openCodeAuthPassword === 'string' && hmrState.openCodeAuthPassword.length > 0
    ? hmrState.openCodeAuthPassword
    : userProvidedOpenCodePassword;
const openCodeAuthUsername = process.env.KRONOSCODE_SERVER_USERNAME || process.env.OPENCODE_SERVER_USERNAME || 'kronoscode';
let openCodeAuthSource =
  typeof hmrState.openCodeAuthSource === 'string' && hmrState.openCodeAuthSource.length > 0
    ? hmrState.openCodeAuthSource
    : userProvidedOpenCodePassword
      ? 'user-env'
      : null;

// Sync helper - call after modifying any HMR state variable
const syncToHmrState = () => {
  hmrState.openCodeProcess = openCodeProcess;
  hmrState.openCodePort = openCodePort;
  hmrState.isShuttingDown = isShuttingDown;
  hmrState.signalsAttached = signalsAttached;
  hmrState.openCodeWorkingDirectory = openCodeWorkingDirectory;
  hmrState.openCodeAuthPassword = openCodeAuthPassword;
  hmrState.openCodeAuthSource = openCodeAuthSource;
};

// Sync helper - call to restore state from HMR (e.g., on module reload)
const syncFromHmrState = () => {
  openCodeProcess = hmrState.openCodeProcess;
  openCodePort = hmrState.openCodePort;
  isShuttingDown = hmrState.isShuttingDown;
  signalsAttached = hmrState.signalsAttached;
  openCodeWorkingDirectory = hmrState.openCodeWorkingDirectory;
  openCodeAuthPassword =
    typeof hmrState.openCodeAuthPassword === 'string' && hmrState.openCodeAuthPassword.length > 0
      ? hmrState.openCodeAuthPassword
      : userProvidedOpenCodePassword;
  openCodeAuthSource =
    typeof hmrState.openCodeAuthSource === 'string' && hmrState.openCodeAuthSource.length > 0
      ? hmrState.openCodeAuthSource
      : userProvidedOpenCodePassword
        ? 'user-env'
        : null;
};

// Module-level variables that shadow HMR state
// These are synced to/from hmrState to survive HMR reloads
let openCodeProcess = hmrState.openCodeProcess;
let openCodePort = hmrState.openCodePort;
let isShuttingDown = hmrState.isShuttingDown;
let signalsAttached = hmrState.signalsAttached;
let openCodeWorkingDirectory = hmrState.openCodeWorkingDirectory;

/**
 * Check if an existing OpenCode process is still alive and responding
 * Used to reuse process across HMR reloads
 */
async function isOpenCodeProcessHealthy() {
  if (!openCodeProcess || !openCodePort) {
    return false;
  }

  // Health check via HTTP since SDK object doesn't expose exitCode
  try {
    const response = await fetch(buildOpenCodeUrl('/session'), {
      method: 'GET',
      headers: getOpenCodeAuthHeaders(),
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Probe if an external OpenCode instance is already running on the given port.
 * Unlike isOpenCodeProcessHealthy(), this doesn't require openCodeProcess to be set.
 * Used to auto-detect and connect to an existing OpenCode instance on startup.
 */
async function probeExternalOpenCode(port) {
  if (!port || port <= 0) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`http://127.0.0.1:${port}/global/health`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...getOpenCodeAuthHeaders(),
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return false;
    const body = await response.json().catch(() => null);
    return body?.healthy === true;
  } catch {
    return false;
  }
}

async function validateConfiguredOpenCode() {
  if (!ENV_CONFIGURED_OPENCODE_URL && !ENV_CONFIGURED_OPENCODE_PORT) {
    return null;
  }
  const baseUrl = ENV_CONFIGURED_OPENCODE_URL || `http://127.0.0.1:${ENV_CONFIGURED_OPENCODE_PORT}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(`${baseUrl}/global/health`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...getOpenCodeAuthHeaders(),
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`health check returned HTTP ${response.status}`);
    }
    const health = await response.json();
    if (
      health?.healthy !== true ||
      health?.protocolVersion !== '1.0' ||
      health?.capabilities?.gateway !== true ||
      health?.capabilities?.asyncPrompt !== true
    ) {
      throw new Error('backend is missing the required KronosCode desktop capabilities');
    }
    return { baseUrl, health };
  } finally {
    clearTimeout(timeout);
  }
}

const ENV_CONFIGURED_OPENCODE_PORT = (() => {
  const raw = process.env.OPENCODE_PORT || process.env.OPENCHAMBER_OPENCODE_PORT || process.env.OPENCHAMBER_INTERNAL_PORT;
  if (!raw) {
    return null;
  }
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
})();
const ENV_CONFIGURED_OPENCODE_URL = (() => {
  const raw = process.env.KRONOSCODE_SERVER_URL || process.env.OPENCODE_SERVER_URL;
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
})();
const ENV_DISABLE_OPENCODE_AUTODETECT = String(process.env.OPENCHAMBER_DISABLE_OPENCODE_AUTODETECT || '').toLowerCase() === 'true';

const ENV_SKIP_OPENCODE_START = process.env.OPENCODE_SKIP_START === 'true' || process.env.OPENCHAMBER_SKIP_OPENCODE_START === 'true';
const ENV_DESKTOP_NOTIFY = process.env.OPENCHAMBER_DESKTOP_NOTIFY === 'true';

// OpenCode server authentication

/**
 * Returns auth headers for OpenCode server requests if OPENCODE_SERVER_PASSWORD is set.
 * Uses the standardized KronosCode username and password environment variables.
 */
function getOpenCodeAuthHeaders() {
  const password = normalizeOpenCodePassword(
    openCodeAuthPassword || process.env.KRONOSCODE_SERVER_PASSWORD || process.env.OPENCODE_SERVER_PASSWORD || '',
  );

  if (!password) {
    return {};
  }

  const credentials = Buffer.from(`${openCodeAuthUsername}:${password}`).toString('base64');
  return { Authorization: `Basic ${credentials}` };
}

function isOpenCodeConnectionSecure() {
  return Object.prototype.hasOwnProperty.call(getOpenCodeAuthHeaders(), 'Authorization');
}

function generateSecureOpenCodePassword() {
  return crypto.randomBytes(32).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function isValidOpenCodePassword(password) {
  return typeof password === 'string' && password.trim().length > 0;
}

function setOpenCodeAuthState(password, source) {
  const normalized = normalizeOpenCodePassword(password);
  if (!isValidOpenCodePassword(normalized)) {
    openCodeAuthPassword = null;
    openCodeAuthSource = null;
    delete process.env.KRONOSCODE_SERVER_PASSWORD;
    delete process.env.OPENCODE_SERVER_PASSWORD;
    syncToHmrState();
    return null;
  }

  openCodeAuthPassword = normalized;
  openCodeAuthSource = source;
  process.env.KRONOSCODE_SERVER_PASSWORD = normalized;
  process.env.OPENCODE_SERVER_PASSWORD = normalized;
  syncToHmrState();
  return normalized;
}

async function ensureLocalOpenCodeServerPassword({ rotateManaged = false } = {}) {
  if (isValidOpenCodePassword(userProvidedOpenCodePassword)) {
    return setOpenCodeAuthState(userProvidedOpenCodePassword, 'user-env');
  }

  if (rotateManaged) {
    const rotatedPassword = setOpenCodeAuthState(generateSecureOpenCodePassword(), 'rotated');
    console.log('Rotated secure password for managed local KronosCode instance');
    return rotatedPassword;
  }

  if (isValidOpenCodePassword(openCodeAuthPassword)) {
    return setOpenCodeAuthState(openCodeAuthPassword, openCodeAuthSource || 'generated');
  }

  const generatedPassword = setOpenCodeAuthState(generateSecureOpenCodePassword(), 'generated');
  console.log('Generated secure password for managed local OpenCode instance');
  return generatedPassword;
}

let cachedLoginShellEnvSnapshot = undefined;

function parseNullSeparatedEnvSnapshot(raw) {
  if (typeof raw !== 'string' || raw.length === 0) {
    return null;
  }

  const result = {};
  const entries = raw.split('\0');
  for (const entry of entries) {
    if (!entry) {
      continue;
    }
    const idx = entry.indexOf('=');
    if (idx <= 0) {
      continue;
    }
    const key = entry.slice(0, idx);
    const value = entry.slice(idx + 1);
    result[key] = value;
  }

  return Object.keys(result).length > 0 ? result : null;
}

function getLoginShellEnvSnapshot() {
  if (cachedLoginShellEnvSnapshot !== undefined) {
    return cachedLoginShellEnvSnapshot;
  }

  if (process.platform === 'win32') {
    const windowsSnapshot = getWindowsShellEnvSnapshot();
    cachedLoginShellEnvSnapshot = windowsSnapshot;
    return windowsSnapshot;
  }

  const shellCandidates = [process.env.SHELL, '/bin/zsh', '/bin/bash', '/bin/sh'].filter(Boolean);

  for (const shellPath of shellCandidates) {
    if (!isExecutable(shellPath)) {
      continue;
    }

    try {
      const result = spawnSync(shellPath, ['-lic', 'env -0'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 10 * 1024 * 1024,
      });

      if (result.status !== 0) {
        continue;
      }

      const parsed = parseNullSeparatedEnvSnapshot(result.stdout || '');
      if (parsed) {
        cachedLoginShellEnvSnapshot = parsed;
        return parsed;
      }
    } catch {
      // ignore
    }
  }

  cachedLoginShellEnvSnapshot = null;
  return null;
}

function getWindowsShellEnvSnapshot() {
  const parseResult = (stdout) => parseNullSeparatedEnvSnapshot(typeof stdout === 'string' ? stdout : '');

  const psScript =
    "Get-ChildItem Env: | ForEach-Object { [Console]::Out.Write($_.Name); [Console]::Out.Write('='); [Console]::Out.Write($_.Value); [Console]::Out.Write([char]0) }";

  const powershellCandidates = [
    'pwsh.exe',
    'powershell.exe',
    path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
  ];

  for (const shellPath of powershellCandidates) {
    try {
      const result = spawnSync(shellPath, ['-NoLogo', '-Command', psScript], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 10 * 1024 * 1024,
      });
      if (result.status !== 0) {
        continue;
      }
      const parsed = parseResult(result.stdout);
      if (parsed) {
        return parsed;
      }
    } catch {
      // ignore
    }
  }

  const comspec = process.env.ComSpec || 'cmd.exe';
  try {
    const result = spawnSync(comspec, ['/d', '/s', '/c', 'set'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024,
    });
    if (result.status === 0 && typeof result.stdout === 'string' && result.stdout.length > 0) {
      return parseNullSeparatedEnvSnapshot(result.stdout.replace(/\r?\n/g, '\0'));
    }
  } catch {
    // ignore
  }

  return null;
}

function mergePathValues(preferred, fallback) {
  const merged = new Set();

  const addSegments = (value) => {
    if (typeof value !== 'string' || !value) {
      return;
    }
    for (const segment of value.split(path.delimiter)) {
      if (segment) {
        merged.add(segment);
      }
    }
  };

  addSegments(preferred);
  addSegments(fallback);

  return Array.from(merged).join(path.delimiter);
}

function applyLoginShellEnvSnapshot() {
  const snapshot = getLoginShellEnvSnapshot();
  if (!snapshot) {
    return;
  }

  const skipKeys = new Set(['PWD', 'OLDPWD', 'SHLVL', '_']);

  for (const [key, value] of Object.entries(snapshot)) {
    if (skipKeys.has(key)) {
      continue;
    }
    const existing = process.env[key];
    if (typeof existing === 'string' && existing.length > 0) {
      continue;
    }
    process.env[key] = value;
  }

  process.env.PATH = mergePathValues(snapshot.PATH || '', process.env.PATH || '');
}

applyLoginShellEnvSnapshot();

const ENV_CONFIGURED_API_PREFIX = normalizeApiPrefix(process.env.OPENCODE_API_PREFIX || process.env.OPENCHAMBER_API_PREFIX || '');

if (ENV_CONFIGURED_API_PREFIX && ENV_CONFIGURED_API_PREFIX !== '') {
  console.warn('Ignoring configured OpenCode API prefix; API runs at root.');
}

let globalEventWatcherAbortController = null;

let resolvedOpencodeBinary = null;
let resolvedOpencodeBinarySource = null;
let resolvedNodeBinary = null;
let resolvedBunBinary = null;

function isExecutable(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return false;
    if (process.platform === 'win32') {
      const ext = path.extname(filePath).toLowerCase();
      if (!ext) return true;
      return ['.exe', '.cmd', '.bat', '.com'].includes(ext);
    }
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function prependToPath(dir) {
  const trimmed = typeof dir === 'string' ? dir.trim() : '';
  if (!trimmed) return;
  const current = process.env.PATH || '';
  const parts = current.split(path.delimiter).filter(Boolean);
  if (parts.includes(trimmed)) return;
  process.env.PATH = [trimmed, ...parts].join(path.delimiter);
}

function searchPathFor(binaryName) {
  const current = process.env.PATH || '';
  const parts = current.split(path.delimiter).filter(Boolean);
  for (const dir of parts) {
    const candidate = path.join(dir, binaryName);
    if (isExecutable(candidate)) {
      return candidate;
    }
  }
  return null;
}

function resolveOpencodeCliPath() {
  const explicit = [
    process.env.KRONOSCODE_BINARY,
    process.env.OPENCODE_BINARY,
    process.env.KRONOSCODE_PATH,
    process.env.OPENCODE_PATH,
    process.env.OPENCHAMBER_OPENCODE_PATH,
    process.env.OPENCHAMBER_OPENCODE_BIN,
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);

  for (const candidate of explicit) {
    if (isExecutable(candidate)) {
      resolvedOpencodeBinarySource = 'env';
      return candidate;
    }
  }

  const resolvedFromPathKronosCode = searchPathFor('kronoscode');
  if (resolvedFromPathKronosCode) {
    resolvedOpencodeBinarySource = 'path';
    return resolvedFromPathKronosCode;
  }

  const resolvedFromPath = searchPathFor('opencode');
  if (resolvedFromPath) {
    resolvedOpencodeBinarySource = 'path';
    return resolvedFromPath;
  }

  const home = os.homedir();
  const unixFallbacks = [
    path.join(home, '.kronoscode', 'bin', 'kronoscode'),
    path.join(home, '.bun', 'bin', 'kronoscode'),
    path.join(home, '.local', 'bin', 'kronoscode'),
    path.join(home, 'bin', 'kronoscode'),
    '/opt/homebrew/bin/kronoscode',
    '/usr/local/bin/kronoscode',
    '/usr/bin/kronoscode',
    '/bin/kronoscode',
    path.join(home, '.opencode', 'bin', 'opencode'),
    path.join(home, '.bun', 'bin', 'opencode'),
    path.join(home, '.local', 'bin', 'opencode'),
    path.join(home, 'bin', 'opencode'),
    '/opt/homebrew/bin/opencode',
    '/usr/local/bin/opencode',
    '/usr/bin/opencode',
    '/bin/opencode',
  ];

  const winFallbacks = (() => {
    const userProfile = process.env.USERPROFILE || home;
    const appData = process.env.APPDATA || '';
    const localAppData = process.env.LOCALAPPDATA || '';
    const programData = process.env.ProgramData || 'C:\\ProgramData';

    return [
      path.join(userProfile, '.kronoscode', 'bin', 'kronoscode.exe'),
      path.join(userProfile, '.kronoscode', 'bin', 'kronoscode.cmd'),
      path.join(appData, 'npm', 'kronoscode.cmd'),
      path.join(userProfile, 'scoop', 'shims', 'kronoscode.cmd'),
      path.join(programData, 'chocolatey', 'bin', 'kronoscode.exe'),
      path.join(programData, 'chocolatey', 'bin', 'kronoscode.cmd'),
      path.join(userProfile, '.bun', 'bin', 'kronoscode.exe'),
      path.join(userProfile, '.bun', 'bin', 'kronoscode.cmd'),
      localAppData ? path.join(localAppData, 'Programs', 'kronoscode', 'kronoscode.exe') : '',
      path.join(userProfile, '.opencode', 'bin', 'opencode.exe'),
      path.join(userProfile, '.opencode', 'bin', 'opencode.cmd'),
      path.join(appData, 'npm', 'opencode.cmd'),
      path.join(userProfile, 'scoop', 'shims', 'opencode.cmd'),
      path.join(programData, 'chocolatey', 'bin', 'opencode.exe'),
      path.join(programData, 'chocolatey', 'bin', 'opencode.cmd'),
      path.join(userProfile, '.bun', 'bin', 'opencode.exe'),
      path.join(userProfile, '.bun', 'bin', 'opencode.cmd'),
      localAppData ? path.join(localAppData, 'Programs', 'opencode', 'opencode.exe') : '',
    ].filter(Boolean);
  })();

  const fallbacks = process.platform === 'win32' ? winFallbacks : unixFallbacks;
  for (const candidate of fallbacks) {
    if (isExecutable(candidate)) {
      resolvedOpencodeBinarySource = 'fallback';
      return candidate;
    }
  }

  if (process.platform === 'win32') {
    try {
      const result = spawnSync('where', ['opencode'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      if (result.status === 0) {
        const lines = (result.stdout || '')
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        const found = lines.find((line) => isExecutable(line));
        if (found) {
          resolvedOpencodeBinarySource = 'where';
          return found;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  const shells = [process.env.SHELL, '/bin/zsh', '/bin/bash', '/bin/sh'].filter(Boolean);
  for (const shell of shells) {
    if (!isExecutable(shell)) continue;
    try {
      const result = spawnSync(shell, ['-lic', 'command -v opencode'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      if (result.status === 0) {
        const found = (result.stdout || '').trim().split(/\s+/).pop() || '';
        if (found && isExecutable(found)) {
          resolvedOpencodeBinarySource = 'shell';
          return found;
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}

function resolveNodeCliPath() {
  const explicit = [process.env.NODE_BINARY, process.env.OPENCHAMBER_NODE_BINARY]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);

  for (const candidate of explicit) {
    if (isExecutable(candidate)) {
      return candidate;
    }
  }

  const resolvedFromPath = searchPathFor('node');
  if (resolvedFromPath) {
    return resolvedFromPath;
  }

  const unixFallbacks = ['/opt/homebrew/bin/node', '/usr/local/bin/node', '/usr/bin/node', '/bin/node'];
  for (const candidate of unixFallbacks) {
    if (isExecutable(candidate)) {
      return candidate;
    }
  }

  if (process.platform === 'win32') {
    try {
      const result = spawnSync('where', ['node'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      if (result.status === 0) {
        const lines = (result.stdout || '')
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        const found = lines.find((line) => isExecutable(line));
        if (found) return found;
      }
    } catch {
      // ignore
    }
    return null;
  }

  const shells = [process.env.SHELL, '/bin/zsh', '/bin/bash', '/bin/sh'].filter(Boolean);
  for (const shell of shells) {
    if (!isExecutable(shell)) continue;
    try {
      const result = spawnSync(shell, ['-lic', 'command -v node'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      if (result.status === 0) {
        const found = (result.stdout || '').trim().split(/\s+/).pop() || '';
        if (found && isExecutable(found)) {
          return found;
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}

function resolveBunCliPath() {
  const explicit = [process.env.BUN_BINARY, process.env.OPENCHAMBER_BUN_BINARY]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);

  for (const candidate of explicit) {
    if (isExecutable(candidate)) {
      return candidate;
    }
  }

  const resolvedFromPath = searchPathFor('bun');
  if (resolvedFromPath) {
    return resolvedFromPath;
  }

  const home = os.homedir();
  const unixFallbacks = [path.join(home, '.bun', 'bin', 'bun'), '/opt/homebrew/bin/bun', '/usr/local/bin/bun', '/usr/bin/bun', '/bin/bun'];
  for (const candidate of unixFallbacks) {
    if (isExecutable(candidate)) {
      return candidate;
    }
  }

  if (process.platform === 'win32') {
    const userProfile = process.env.USERPROFILE || home;
    const winFallbacks = [path.join(userProfile, '.bun', 'bin', 'bun.exe'), path.join(userProfile, '.bun', 'bin', 'bun.cmd')];
    for (const candidate of winFallbacks) {
      if (isExecutable(candidate)) return candidate;
    }

    try {
      const result = spawnSync('where', ['bun'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      if (result.status === 0) {
        const lines = (result.stdout || '')
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        const found = lines.find((line) => isExecutable(line));
        if (found) return found;
      }
    } catch {
      // ignore
    }
    return null;
  }

  const shells = [process.env.SHELL, '/bin/zsh', '/bin/bash', '/bin/sh'].filter(Boolean);
  for (const shell of shells) {
    if (!isExecutable(shell)) continue;
    try {
      const result = spawnSync(shell, ['-lic', 'command -v bun'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      if (result.status === 0) {
        const found = (result.stdout || '').trim().split(/\s+/).pop() || '';
        if (found && isExecutable(found)) {
          return found;
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}

function ensureBunCliEnv() {
  if (resolvedBunBinary) {
    return resolvedBunBinary;
  }

  const resolved = resolveBunCliPath();
  if (resolved) {
    prependToPath(path.dirname(resolved));
    resolvedBunBinary = resolved;
    return resolved;
  }

  return null;
}

function ensureNodeCliEnv() {
  if (resolvedNodeBinary) {
    return resolvedNodeBinary;
  }

  const resolved = resolveNodeCliPath();
  if (resolved) {
    prependToPath(path.dirname(resolved));
    resolvedNodeBinary = resolved;
    return resolved;
  }

  return null;
}

function readShebang(opencodePath) {
  if (!opencodePath || typeof opencodePath !== 'string') {
    return null;
  }
  try {
    // Best effort: detect "#!/usr/bin/env <runtime>" without reading whole file.
    const fd = fs.openSync(opencodePath, 'r');
    try {
      const buf = Buffer.alloc(256);
      const bytes = fs.readSync(fd, buf, 0, buf.length, 0);
      const head = buf.subarray(0, bytes).toString('utf8');
      const firstLine = head.split(/\r?\n/, 1)[0] || '';
      if (!firstLine.startsWith('#!')) {
        return null;
      }
      const shebang = firstLine.slice(2).trim();
      if (!shebang) {
        return null;
      }
      return shebang;
    } finally {
      try {
        fs.closeSync(fd);
      } catch {
        // ignore
      }
    }
  } catch {
    return null;
  }
}

function opencodeShimInterpreter(opencodePath) {
  const shebang = readShebang(opencodePath);
  if (!shebang) return null;
  if (/\bnode\b/i.test(shebang)) return 'node';
  if (/\bbun\b/i.test(shebang)) return 'bun';
  return null;
}

function ensureOpencodeShimRuntime(opencodePath) {
  const runtime = opencodeShimInterpreter(opencodePath);
  if (runtime === 'node') {
    ensureNodeCliEnv();
  }
  if (runtime === 'bun') {
    ensureBunCliEnv();
  }
}

function normalizeOpencodeBinarySetting(raw) {
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = normalizeDirectoryPath(raw).trim();
  if (!trimmed) {
    return '';
  }

  try {
    const stat = fs.statSync(trimmed);
    if (stat.isDirectory()) {
      const bin = process.platform === 'win32' ? 'kronoscode.exe' : 'kronoscode';
      return path.join(trimmed, bin);
    }
  } catch {
    // ignore
  }

  return trimmed;
}

function normalizeAiBrowserSetting(raw) {
  if (typeof raw !== 'boolean') {
    return null;
  }
  return raw;
}

async function applyAiBrowserSettingFromSettings() {
  // Always tell the core engine it's running inside KronosChamber desktop
  // so kronoschamber_browser_* tools route to the visible Tauri webview
  process.env.KRONOSCHAMBER_DESKTOP = 'true';
  if (!process.env.KRONOSCHAMBER_BASE_URL) {
    // Will be set to the actual port once the server is listening; default fallback
    process.env.KRONOSCHAMBER_BASE_URL = `http://127.0.0.1:${process.env.OPENCHAMBER_PORT || 57123}`;
  }

  try {
    const settings = await readSettingsFromDiskMigrated();
    if (!settings || typeof settings !== 'object') {
      if (typeof process.env.OPENCODE_ENABLE_AI_BROWSER !== 'string' && typeof process.env.KRONOSCODE_ENABLE_AI_BROWSER !== 'string') {
        process.env.OPENCODE_ENABLE_AI_BROWSER = 'true';
        process.env.KRONOSCODE_ENABLE_AI_BROWSER = 'true';
      }
      return null;
    }
    if (!Object.prototype.hasOwnProperty.call(settings, 'aiBrowserEnabled')) {
      if (typeof process.env.OPENCODE_ENABLE_AI_BROWSER !== 'string' && typeof process.env.KRONOSCODE_ENABLE_AI_BROWSER !== 'string') {
        process.env.OPENCODE_ENABLE_AI_BROWSER = 'true';
        process.env.KRONOSCODE_ENABLE_AI_BROWSER = 'true';
      }
      return null;
    }

    const normalized = normalizeAiBrowserSetting(settings.aiBrowserEnabled);
    if (normalized === null) {
      return null;
    }

    process.env.OPENCODE_ENABLE_AI_BROWSER = normalized ? 'true' : 'false';
    process.env.KRONOSCODE_ENABLE_AI_BROWSER = normalized ? 'true' : 'false';
    return normalized;
  } catch {
    // ignore
  }

  return null;
}

async function applyOpencodeBinaryFromSettings() {
  try {
    const settings = await readSettingsFromDiskMigrated();
    if (!settings || typeof settings !== 'object') {
      return null;
    }
    if (!Object.prototype.hasOwnProperty.call(settings, 'opencodeBinary')) {
      return null;
    }

    const normalized = normalizeOpencodeBinarySetting(settings.opencodeBinary);

    if (normalized === '') {
      delete process.env.OPENCODE_BINARY;
      resolvedOpencodeBinary = null;
      resolvedOpencodeBinarySource = null;
      return null;
    }

    if (normalized && isExecutable(normalized)) {
      process.env.OPENCODE_BINARY = normalized;
      prependToPath(path.dirname(normalized));
      resolvedOpencodeBinary = normalized;
      resolvedOpencodeBinarySource = 'settings';
      ensureOpencodeShimRuntime(normalized);
      return normalized;
    }

    const raw = typeof settings.opencodeBinary === 'string' ? settings.opencodeBinary.trim() : '';
    if (raw) {
      console.warn(`Configured settings.opencodeBinary is not executable: ${raw}`);
    }

    // Invalid configured override: clear previously applied settings-based override
    // so PATH/env detection can take over.
    if (resolvedOpencodeBinarySource === 'settings') {
      delete process.env.OPENCODE_BINARY;
      resolvedOpencodeBinary = null;
      resolvedOpencodeBinarySource = null;
    }
  } catch {
    // ignore
  }

  return null;
}

function ensureOpencodeCliEnv() {
  if (resolvedOpencodeBinary) {
    ensureOpencodeShimRuntime(resolvedOpencodeBinary);
    return resolvedOpencodeBinary;
  }

  const existing = typeof process.env.OPENCODE_BINARY === 'string' ? process.env.OPENCODE_BINARY.trim() : '';
  if (existing && isExecutable(existing)) {
    resolvedOpencodeBinary = existing;
    resolvedOpencodeBinarySource = resolvedOpencodeBinarySource || 'env';
    prependToPath(path.dirname(existing));
    ensureOpencodeShimRuntime(existing);
    return resolvedOpencodeBinary;
  }

  const resolved = resolveOpencodeCliPath();
  if (resolved) {
    process.env.OPENCODE_BINARY = resolved;
    prependToPath(path.dirname(resolved));
    ensureOpencodeShimRuntime(resolved);
    resolvedOpencodeBinary = resolved;
    resolvedOpencodeBinarySource = resolvedOpencodeBinarySource || 'unknown';
    console.log(`Resolved kronoscode CLI: ${resolved}`);
    return resolved;
  }

  return null;
}

async function registerChamberMcpWithCoreEngine() {
  const chamberUrl = process.env.KRONOSCHAMBER_BASE_URL;
  if (!chamberUrl || !openCodePort) return;
  try {
    const authHeaders = getOpenCodeAuthHeaders();
    const res = await fetch(buildOpenCodeUrl('/mcp', ''), {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        name: 'kronoschamber',
        config: { type: 'remote', url: `${chamberUrl}/mcp` },
      }),
    });
    if (res.ok) {
      console.log('[Chamber MCP] Registered with core engine');
    } else {
      console.warn('[Chamber MCP] Registration failed:', await res.text());
    }
  } catch (err) {
    console.warn('[Chamber MCP] Registration error:', err.message);
  }
}

function resolveKrondesignCliPath() {
  const configured = typeof process.env.KRONDESIGN_CLI_PATH === 'string' ? process.env.KRONDESIGN_CLI_PATH.trim() : '';
  const candidates = [
    configured,
    path.resolve(__dirname, '../../../../../krondesign/apps/daemon/dist/cli.js'),
    path.resolve(__dirname, '../../../krondesign/apps/daemon/dist/cli.js'),
    path.join(os.homedir(), 'kronterm', 'krondesign', 'apps', 'daemon', 'dist', 'cli.js'),
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

async function registerKrondesignMcpWithCoreEngine() {
  if (!openCodePort) return;
  const cliPath = resolveKrondesignCliPath();
  if (!cliPath) {
    console.warn('[Krondesign MCP] CLI bundle not found; Design remains available without agent tools');
    return;
  }

  const daemonUrl =
    (typeof process.env.KRONDESIGN_DAEMON_URL === 'string' && process.env.KRONDESIGN_DAEMON_URL.trim()) || 'http://127.0.0.1:7456';

  try {
    const authHeaders = getOpenCodeAuthHeaders();
    const res = await fetch(buildOpenCodeUrl('/mcp', ''), {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        name: 'krondesign',
        config: {
          type: 'local',
          command: [process.execPath, cliPath, 'mcp'],
          environment: {
            OD_DAEMON_URL: daemonUrl,
          },
          enabled: true,
        },
      }),
    });
    if (!res.ok) {
      console.warn('[Krondesign MCP] Registration failed:', await res.text());
      return;
    }

    const status = await res.json().catch(() => null);
    if (status?.krondesign?.status === 'connected') {
      console.log('[Krondesign MCP] Connected to the managed KronosCode instance');
    } else {
      console.warn('[Krondesign MCP] Registration did not connect:', status?.krondesign?.error || 'unknown status');
    }
  } catch (err) {
    console.warn('[Krondesign MCP] Registration error:', err.message);
  }
}

const startGlobalEventWatcher = async () => {
  if (globalEventWatcherAbortController) {
    return;
  }

  await waitForOpenCodePort();

  globalEventWatcherAbortController = new AbortController();
  const signal = globalEventWatcherAbortController.signal;

  let attempt = 0;

  const run = async () => {
    while (!signal.aborted) {
      attempt += 1;
      let upstream;
      let reader;
      try {
        const url = buildOpenCodeUrl('/global/event', '');
        upstream = await fetch(url, {
          headers: {
            Accept: 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            ...getOpenCodeAuthHeaders(),
          },
          signal,
        });

        if (!upstream.ok || !upstream.body) {
          throw new Error(`bad status ${upstream.status}`);
        }

        console.log('[PushWatcher] connected');

        const decoder = new TextDecoder();
        reader = upstream.body.getReader();
        let buffer = '';

        while (!signal.aborted) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

          let separatorIndex = buffer.indexOf('\n\n');
          while (separatorIndex !== -1) {
            const block = buffer.slice(0, separatorIndex);
            buffer = buffer.slice(separatorIndex + 2);
            separatorIndex = buffer.indexOf('\n\n');
            const payload = parseSseDataPayload(block);
            // Cache session titles from session.updated/session.created events
            maybeCacheSessionInfoFromEvent(payload);
            void maybeSendPushForTrigger(payload);
            // Track session activity independently of UI (mirrors Tauri desktop behavior)
            const transitions = deriveSessionActivityTransitions(payload);
            if (transitions && transitions.length > 0) {
              for (const activity of transitions) {
                setSessionActivityPhase(activity.sessionId, activity.phase);
              }
            }

            // Update authoritative session state from OpenCode events
            if (payload && payload.type === 'session.status') {
              const update = extractSessionStatusUpdate(payload);
              if (update) {
                updateSessionState(update.sessionId, update.type, update.eventId || `sse-${Date.now()}`, {
                  attempt: update.attempt,
                  message: update.message,
                  next: update.next,
                });
              }
            }
          }
        }
      } catch (error) {
        if (signal.aborted) {
          return;
        }
        console.warn('[PushWatcher] disconnected', error?.message ?? error);
      } finally {
        try {
          if (reader) {
            await reader.cancel();
            reader.releaseLock();
          } else if (upstream?.body && !upstream.body.locked) {
            await upstream.body.cancel();
          }
        } catch {
          // ignore
        }
      }

      const backoffMs = Math.min(1000 * Math.pow(2, Math.min(attempt, 5)), 30000);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  };

  void run();
};

const stopGlobalEventWatcher = () => {
  if (!globalEventWatcherAbortController) {
    return;
  }
  try {
    globalEventWatcherAbortController.abort();
  } catch {
    // ignore
  }
  globalEventWatcherAbortController = null;
};

function setOpenCodePort(port) {
  if (!Number.isFinite(port) || port <= 0) {
    return;
  }

  const numericPort = Math.trunc(port);
  const portChanged = openCodePort !== numericPort;

  if (portChanged || openCodePort === null) {
    openCodePort = numericPort;
    syncToHmrState();
    console.log(`Detected KronosCode port: ${openCodePort}`);

    if (portChanged) {
      isOpenCodeReady = false;
    }
    openCodeNotReadySince = Date.now();
  }

  lastOpenCodeError = null;
}

async function waitForOpenCodePort(timeoutMs = 15000) {
  if (openCodePort !== null) {
    return openCodePort;
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    if (openCodePort !== null) {
      return openCodePort;
    }
  }

  throw new Error('Timed out waiting for OpenCode port');
}

function getLoginShellPath() {
  const snapshot = getLoginShellEnvSnapshot();
  if (!snapshot || typeof snapshot.PATH !== 'string' || snapshot.PATH.length === 0) {
    return null;
  }
  return snapshot.PATH;
}

function buildAugmentedPath() {
  const augmented = new Set();

  const loginShellPath = getLoginShellPath();
  if (loginShellPath) {
    for (const segment of loginShellPath.split(path.delimiter)) {
      if (segment) {
        augmented.add(segment);
      }
    }
  }

  const current = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const segment of current) {
    augmented.add(segment);
  }

  return Array.from(augmented).join(path.delimiter);
}

const API_PREFIX_CANDIDATES = [''];

async function waitForReady(url, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${url.replace(/\/+$/, '')}/global/health`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...getOpenCodeAuthHeaders(),
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const body = await res.json().catch(() => null);
        if (body?.healthy === true) {
          return true;
        }
      }
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

function normalizeApiPrefix(prefix) {
  if (!prefix) {
    return '';
  }

  if (prefix.includes('://')) {
    try {
      const parsed = new URL(prefix);
      return normalizeApiPrefix(parsed.pathname);
    } catch (error) {
      return '';
    }
  }

  const trimmed = prefix.trim();
  if (!trimmed || trimmed === '/') {
    return '';
  }
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeading.endsWith('/') ? withLeading.slice(0, -1) : withLeading;
}

function setDetectedOpenCodeApiPrefix() {
  openCodeApiPrefix = '';
  openCodeApiPrefixDetected = true;
  if (openCodeApiDetectionTimer) {
    clearTimeout(openCodeApiDetectionTimer);
    openCodeApiDetectionTimer = null;
  }
}

function getCandidateApiPrefixes() {
  return API_PREFIX_CANDIDATES;
}

function buildOpenCodeUrl(path, prefixOverride) {
  if (!openCodePort && !ENV_CONFIGURED_OPENCODE_URL) {
    throw new Error('OpenCode port is not available');
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const prefix = normalizeApiPrefix(prefixOverride !== undefined ? prefixOverride : '');
  const fullPath = `${prefix}${normalizedPath}`;
  return `${ENV_CONFIGURED_OPENCODE_URL || `http://localhost:${openCodePort}`}${fullPath}`;
}

function parseSseDataPayload(block) {
  if (!block || typeof block !== 'string') {
    return null;
  }
  const dataLines = block
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).replace(/^\s/, ''));

  if (dataLines.length === 0) {
    return null;
  }

  const payloadText = dataLines.join('\n').trim();
  if (!payloadText) {
    return null;
  }

  try {
    const parsed = JSON.parse(payloadText);
    if (parsed && typeof parsed === 'object' && typeof parsed.payload === 'object' && parsed.payload !== null) {
      return parsed.payload;
    }
    return parsed;
  } catch {
    return null;
  }
}

function extractSessionStatusUpdate(payload) {
  if (!payload || typeof payload !== 'object' || payload.type !== 'session.status') {
    return null;
  }

  const props = payload.properties ?? {};
  const status = props.status ?? props.session?.status ?? props.sessionInfo?.status;
  const metadata = props.metadata ?? (typeof status === 'object' && status !== null ? status.metadata : null);

  const sessionId = props.sessionID ?? props.sessionId;
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    return null;
  }

  const statusType =
    typeof status === 'string'
      ? status
      : typeof status?.type === 'string'
        ? status.type
        : typeof status?.status === 'string'
          ? status.status
          : typeof props.type === 'string'
            ? props.type
            : typeof props.phase === 'string'
              ? props.phase
              : typeof props.state === 'string'
                ? props.state
                : null;

  const normalizedType = statusType === 'idle' || statusType === 'busy' || statusType === 'retry' ? statusType : null;

  if (!normalizedType) {
    return null;
  }

  const attempt =
    typeof status?.attempt === 'number'
      ? status.attempt
      : typeof props.attempt === 'number'
        ? props.attempt
        : typeof metadata?.attempt === 'number'
          ? metadata.attempt
          : undefined;
  const message =
    typeof status?.message === 'string'
      ? status.message
      : typeof props.message === 'string'
        ? props.message
        : typeof metadata?.message === 'string'
          ? metadata.message
          : undefined;
  const next =
    typeof status?.next === 'number'
      ? status.next
      : typeof props.next === 'number'
        ? props.next
        : typeof metadata?.next === 'number'
          ? metadata.next
          : undefined;

  return {
    sessionId,
    type: normalizedType,
    attempt,
    message,
    next,
    eventId: typeof props.eventId === 'string' ? props.eventId : null,
  };
}

function emitDesktopNotification(payload) {
  if (!ENV_DESKTOP_NOTIFY) {
    return;
  }

  if (!payload || typeof payload !== 'object') {
    return;
  }

  try {
    // One-line protocol consumed by the Tauri shell.
    process.stdout.write(`${DESKTOP_NOTIFY_PREFIX}${JSON.stringify(payload)}\n`);
  } catch {
    // ignore
  }
}

function broadcastUiNotification(payload) {
  if (!payload || typeof payload !== 'object') {
    return;
  }

  if (uiNotificationClients.size === 0) {
    return;
  }

  for (const res of uiNotificationClients) {
    try {
      writeSseEvent(res, {
        type: 'openchamber:notification',
        properties: {
          ...payload,
          // Tell the UI whether the sidecar stdout notification channel is active.
          // When true, the desktop UI should skip this SSE notification to avoid duplicates.
          // When false (e.g. tauri dev), the UI must handle this SSE notification itself.
          desktopStdoutActive: ENV_DESKTOP_NOTIFY,
        },
      });
    } catch {
      // ignore
    }
  }
}

function isStreamingAssistantPart(properties) {
  if (!properties || typeof properties !== 'object') {
    return false;
  }

  const info = properties?.info;
  const role = info?.role;
  if (role !== 'assistant') {
    return false;
  }

  const part = properties?.part;
  const partType = part?.type;
  return (
    partType === 'step-start' ||
    partType === 'text' ||
    partType === 'tool' ||
    partType === 'reasoning' ||
    partType === 'file' ||
    partType === 'patch'
  );
}

function deriveSessionActivityTransitions(payload) {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  if (payload.type === 'session.status') {
    const update = extractSessionStatusUpdate(payload);
    if (update) {
      const phase = update.type === 'busy' || update.type === 'retry' ? 'busy' : 'idle';
      return [{ sessionId: update.sessionId, phase }];
    }
  }

  if (payload.type === 'message.updated') {
    const info = payload.properties?.info;
    const sessionId = info?.sessionID ?? info?.sessionId ?? payload.properties?.sessionID ?? payload.properties?.sessionId;
    const role = info?.role;
    const finish = info?.finish;
    if (typeof sessionId === 'string' && sessionId.length > 0 && role === 'assistant' && finish === 'stop') {
      return [{ sessionId, phase: 'cooldown' }];
    }
  }

  if (payload.type === 'message.part.updated' || payload.type === 'message.part.delta') {
    const info = payload.properties?.info;
    const sessionId = info?.sessionID ?? info?.sessionId ?? payload.properties?.sessionID ?? payload.properties?.sessionId;
    const role = info?.role;
    const finish = info?.finish;

    if (typeof sessionId === 'string' && sessionId.length > 0 && role === 'assistant') {
      const transitions = [];

      // Desktop parity: mark busy when we see assistant parts streaming.
      if (isStreamingAssistantPart(payload.properties)) {
        transitions.push({ sessionId, phase: 'busy' });
      }

      // Desktop parity: enter cooldown when finish==stop.
      if (finish === 'stop') {
        transitions.push({ sessionId, phase: 'cooldown' });
      }

      return transitions;
    }
  }

  if (payload.type === 'session.idle') {
    const sessionId = payload.properties?.sessionID ?? payload.properties?.sessionId;
    if (typeof sessionId === 'string' && sessionId.length > 0) {
      return [{ sessionId, phase: 'idle' }];
    }
  }

  return [];
}

const PUSH_READY_COOLDOWN_MS = 5000;
const PUSH_QUESTION_DEBOUNCE_MS = 500;
const PUSH_PERMISSION_DEBOUNCE_MS = 500;
const pushQuestionDebounceTimers = new Map();
const pushPermissionDebounceTimers = new Map();
const notifiedPermissionRequests = new Set();
const lastReadyNotificationAt = new Map();

// Cache: sessionId -> parentID (string) or null (no parent). Undefined = unknown.
const sessionParentIdCache = new Map();
const SESSION_PARENT_CACHE_TTL_MS = 60 * 1000;

const getCachedSessionParentId = (sessionId) => {
  const entry = sessionParentIdCache.get(sessionId);
  if (!entry) return undefined;
  if (Date.now() - entry.at > SESSION_PARENT_CACHE_TTL_MS) {
    sessionParentIdCache.delete(sessionId);
    return undefined;
  }
  return entry.parentID;
};

const setCachedSessionParentId = (sessionId, parentID) => {
  sessionParentIdCache.set(sessionId, { parentID: parentID ?? null, at: Date.now() });
};

const fetchSessionParentId = async (sessionId) => {
  if (!sessionId) return undefined;

  const cached = getCachedSessionParentId(sessionId);
  if (cached !== undefined) return cached;

  try {
    const response = await fetch(buildOpenCodeUrl('/session', ''), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...getOpenCodeAuthHeaders(),
      },
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) {
      return undefined;
    }
    const data = await response.json().catch(() => null);
    if (!Array.isArray(data)) {
      return undefined;
    }

    const match = data.find((s) => s && typeof s === 'object' && s.id === sessionId);
    const parentID = match && typeof match.parentID === 'string' && match.parentID.length > 0 ? match.parentID : null;
    setCachedSessionParentId(sessionId, parentID);
    return parentID;
  } catch {
    return undefined;
  }
};

const extractSessionIdFromPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  const props = payload.properties;
  const info = props?.info;
  const sessionId = info?.sessionID ?? info?.sessionId ?? props?.sessionID ?? props?.sessionId ?? props?.session ?? null;
  return typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : null;
};

const maybeSendPushForTrigger = async (payload) => {
  if (!payload || typeof payload !== 'object') {
    return;
  }

  const sessionId = extractSessionIdFromPayload(payload);

  const formatMode = (raw) => {
    const value = typeof raw === 'string' ? raw.trim() : '';
    const normalized = value.length > 0 ? value : 'agent';
    return normalized
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
      .join(' ');
  };

  const formatModelId = (raw) => {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value) {
      return 'Assistant';
    }

    const tokens = value.split(/[-_]+/).filter(Boolean);
    const result = [];
    for (let i = 0; i < tokens.length; i += 1) {
      const current = tokens[i];
      const next = tokens[i + 1];
      if (/^\d+$/.test(current) && next && /^\d+$/.test(next)) {
        result.push(`${current}.${next}`);
        i += 1;
        continue;
      }
      result.push(current);
    }

    return result.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  };

  if (payload.type === 'message.updated') {
    const info = payload.properties?.info;
    if (info?.role === 'assistant' && info?.finish === 'stop' && sessionId) {
      // Check if this is a subtask and if we should notify for subtasks
      const settings = await readSettingsFromDisk();

      if (settings.notifyOnSubtasks === false) {
        // Prefer parentID on payload (if present), else fetch from sessions list.
        const sessionInfo = payload.properties?.session;
        const parentIDFromPayload = sessionInfo?.parentID ?? payload.properties?.parentID;
        const parentID = parentIDFromPayload ? parentIDFromPayload : await fetchSessionParentId(sessionId);

        // Fail open: if parentID cannot be resolved, send notification.
        if (parentID) {
          return;
        }
      }

      // Check if completion notifications are enabled
      if (settings.notifyOnCompletion === false) {
        return;
      }

      const now = Date.now();
      const lastAt = lastReadyNotificationAt.get(sessionId) ?? 0;
      if (now - lastAt < PUSH_READY_COOLDOWN_MS) {
        return;
      }
      lastReadyNotificationAt.set(sessionId, now);

      // Resolve templates with fallback to legacy hardcoded values
      let title = `${formatMode(info?.mode)} agent is ready`;
      let body = `${formatModelId(info?.modelID)} completed the task`;

      try {
        const templates = settings.notificationTemplates || {};
        const isSubtask = await fetchSessionParentId(sessionId);
        const completionTemplate =
          isSubtask && settings.notifyOnSubtasks !== false
            ? templates.subtask || templates.completion || { title: '{agent_name} is ready', message: '{model_name} completed the task' }
            : templates.completion || { title: '{agent_name} is ready', message: '{model_name} completed the task' };

        const variables = await buildTemplateVariables(payload, sessionId);

        // Try fast-path (inline parts) first, then fetch from API
        const messageId = info?.id;
        let lastMessage = extractLastMessageText(payload);
        if (!lastMessage) {
          lastMessage = await fetchLastAssistantMessageText(sessionId, messageId);
        }

        const notifZenModel = await resolveZenModel(settings?.zenModel);
        variables.last_message = await prepareNotificationLastMessage({
          message: lastMessage,
          settings,
          summarize: (text, len) => summarizeText(text, len, notifZenModel),
        });

        const resolvedTitle = resolveNotificationTemplate(completionTemplate.title, variables);
        const resolvedBody = resolveNotificationTemplate(completionTemplate.message, variables);
        if (resolvedTitle) title = resolvedTitle;
        if (shouldApplyResolvedTemplateMessage(completionTemplate.message, resolvedBody, variables)) body = resolvedBody;
      } catch (err) {
        console.warn('[Notification] Template resolution failed, using defaults:', err?.message || err);
      }

      if (settings.nativeNotificationsEnabled) {
        const notificationPayload = {
          title,
          body,
          tag: `ready-${sessionId}`,
          kind: 'ready',
          sessionId,
          requireHidden: settings.notificationMode !== 'always',
        };
        emitDesktopNotification(notificationPayload);
        broadcastUiNotification(notificationPayload);
      }

      await sendPushToAllUiSessions(
        {
          title,
          body,
          tag: `ready-${sessionId}`,
          data: {
            url: buildSessionDeepLinkUrl(sessionId),
            sessionId,
            type: 'ready',
          },
        },
        { requireNoSse: true },
      );
    }

    // Check for error finish
    if (info?.role === 'assistant' && info?.finish === 'error' && sessionId) {
      await trackRetentionToolError(sessionId, typeof info?.id === 'string' ? info.id : null);
      const settings = await readSettingsFromDisk();
      if (settings.notifyOnError === false) return;

      let title = 'Tool error';
      let body = 'An error occurred';

      try {
        const variables = await buildTemplateVariables(payload, sessionId);

        // Try fast-path (inline parts) first, then fetch from API
        const errorMessageId = info?.id;
        let lastMessage = extractLastMessageText(payload);
        if (!lastMessage) {
          lastMessage = await fetchLastAssistantMessageText(sessionId, errorMessageId);
        }

        const errZenModel = await resolveZenModel(settings?.zenModel);
        variables.last_message = await prepareNotificationLastMessage({
          message: lastMessage,
          settings,
          summarize: (text, len) => summarizeText(text, len, errZenModel),
        });

        const errorTemplate = (settings.notificationTemplates || {}).error || {
          title: 'Tool error',
          message: '{last_message}',
        };
        const resolvedTitle = resolveNotificationTemplate(errorTemplate.title, variables);
        const resolvedBody = resolveNotificationTemplate(errorTemplate.message, variables);
        if (resolvedTitle) title = resolvedTitle;
        if (shouldApplyResolvedTemplateMessage(errorTemplate.message, resolvedBody, variables)) body = resolvedBody;
      } catch (err) {
        console.warn('[Notification] Error template resolution failed, using defaults:', err?.message || err);
      }

      if (settings.nativeNotificationsEnabled) {
        const notificationPayload = {
          title,
          body,
          tag: `error-${sessionId}`,
          kind: 'error',
          sessionId,
          requireHidden: settings.notificationMode !== 'always',
        };
        emitDesktopNotification(notificationPayload);
        broadcastUiNotification(notificationPayload);
      }

      await sendPushToAllUiSessions(
        {
          title,
          body,
          tag: `error-${sessionId}`,
          data: {
            url: buildSessionDeepLinkUrl(sessionId),
            sessionId,
            type: 'error',
          },
        },
        { requireNoSse: true },
      );
    }

    return;
  }

  if (payload.type === 'question.asked' && sessionId) {
    const existingTimer = pushQuestionDebounceTimers.get(sessionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      pushQuestionDebounceTimers.delete(sessionId);

      const settings = await readSettingsFromDisk();

      // Check if question notifications are enabled
      if (settings.notifyOnQuestion === false) {
        return;
      }

      if (!settings.nativeNotificationsEnabled) {
        // Still send push even if native notifications are disabled
      }

      const firstQuestion = payload.properties?.questions?.[0];
      const header = typeof firstQuestion?.header === 'string' ? firstQuestion.header.trim() : '';
      const questionText = typeof firstQuestion?.question === 'string' ? firstQuestion.question.trim() : '';

      // Legacy fallback title
      let title = /plan\s*mode/i.test(header)
        ? 'Switch to plan mode'
        : /build\s*agent/i.test(header)
          ? 'Switch to build mode'
          : header || 'Input needed';
      let body = questionText || 'Agent is waiting for your response';

      try {
        // Build template variables
        const variables = await buildTemplateVariables(payload, sessionId);
        variables.last_message = questionText || header || '';

        // Get question template
        const templates = settings.notificationTemplates || {};
        const questionTemplate = templates.question || { title: 'Input needed', message: '{last_message}' };

        // Resolve templates with fallback to legacy behavior
        const resolvedTitle = resolveNotificationTemplate(questionTemplate.title, variables);
        const resolvedBody = resolveNotificationTemplate(questionTemplate.message, variables);
        if (resolvedTitle) title = resolvedTitle;
        if (shouldApplyResolvedTemplateMessage(questionTemplate.message, resolvedBody, variables)) body = resolvedBody;
      } catch (err) {
        console.warn('[Notification] Question template resolution failed, using defaults:', err?.message || err);
      }

      if (settings.nativeNotificationsEnabled) {
        emitDesktopNotification({
          kind: 'question',
          title,
          body,
          tag: `question-${sessionId}`,
          sessionId,
          requireHidden: settings.notificationMode !== 'always',
        });

        broadcastUiNotification({
          kind: 'question',
          title,
          body,
          tag: `question-${sessionId}`,
          sessionId,
          requireHidden: settings.notificationMode !== 'always',
        });
      }

      void sendPushToAllUiSessions(
        {
          title,
          body,
          tag: `question-${sessionId}`,
          data: {
            url: buildSessionDeepLinkUrl(sessionId),
            sessionId,
            type: 'question',
          },
        },
        { requireNoSse: true },
      );
    }, PUSH_QUESTION_DEBOUNCE_MS);

    pushQuestionDebounceTimers.set(sessionId, timer);
    return;
  }

  if (payload.type === 'permission.asked' && sessionId) {
    const requestId = payload.properties?.id;
    const permission = payload.properties?.permission;
    const requestKey = typeof requestId === 'string' ? `${sessionId}:${requestId}` : null;
    if (requestKey && notifiedPermissionRequests.has(requestKey)) {
      return;
    }

    const existingTimer = pushPermissionDebounceTimers.get(sessionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      pushPermissionDebounceTimers.delete(sessionId);
      const settings = await readSettingsFromDisk();

      // Permission requests use the question event toggle (since permission requests are a type of "agent needs input")
      if (settings.notifyOnQuestion === false) {
        return;
      }

      if (!settings.nativeNotificationsEnabled) {
        // Still send push even if native notifications are disabled
      }

      const sessionTitle = payload.properties?.sessionTitle;
      const permissionText = typeof permission === 'string' && permission.length > 0 ? permission : '';
      const fallbackMessage =
        typeof sessionTitle === 'string' && sessionTitle.trim().length > 0
          ? sessionTitle.trim()
          : permissionText || 'Agent is waiting for your approval';

      let title = 'Permission required';
      let body = fallbackMessage;

      try {
        // Build template variables
        const variables = await buildTemplateVariables(payload, sessionId);
        variables.last_message = fallbackMessage;

        // Get question template (permission uses question template since it's an input request)
        const templates = settings.notificationTemplates || {};
        const questionTemplate = templates.question || { title: 'Permission required', message: '{last_message}' };

        // Resolve templates with fallback to legacy behavior
        const resolvedTitle = resolveNotificationTemplate(questionTemplate.title, variables);
        const resolvedBody = resolveNotificationTemplate(questionTemplate.message, variables);
        if (resolvedTitle) title = resolvedTitle;
        if (shouldApplyResolvedTemplateMessage(questionTemplate.message, resolvedBody, variables)) body = resolvedBody;
      } catch (err) {
        console.warn('[Notification] Permission template resolution failed, using defaults:', err?.message || err);
      }

      if (settings.nativeNotificationsEnabled) {
        emitDesktopNotification({
          kind: 'permission',
          title,
          body,
          tag: requestKey ? `permission-${requestKey}` : `permission-${sessionId}`,
          sessionId,
          requireHidden: settings.notificationMode !== 'always',
        });

        broadcastUiNotification({
          kind: 'permission',
          title,
          body,
          tag: requestKey ? `permission-${requestKey}` : `permission-${sessionId}`,
          sessionId,
          requireHidden: settings.notificationMode !== 'always',
        });
      }

      if (requestKey) {
        notifiedPermissionRequests.add(requestKey);
      }

      void sendPushToAllUiSessions(
        {
          title,
          body,
          tag: `permission-${sessionId}`,
          data: {
            url: buildSessionDeepLinkUrl(sessionId),
            sessionId,
            type: 'permission',
          },
        },
        { requireNoSse: true },
      );
    }, PUSH_PERMISSION_DEBOUNCE_MS);

    pushPermissionDebounceTimers.set(sessionId, timer);
  }
};

function writeSseEvent(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function extractApiPrefixFromUrl() {
  return '';
}

function detectOpenCodeApiPrefix() {
  openCodeApiPrefixDetected = true;
  openCodeApiPrefix = '';
  return true;
}

function ensureOpenCodeApiPrefix() {
  return detectOpenCodeApiPrefix();
}

function scheduleOpenCodeApiDetection() {
  return;
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = Array.isArray(argv) ? [...argv] : [];
  const envPassword = process.env.OPENCHAMBER_UI_PASSWORD || process.env.OPENCODE_UI_PASSWORD || null;
  const envCfTunnel = process.env.OPENCHAMBER_TRY_CF_TUNNEL === 'true';
  const options = { port: DEFAULT_PORT, uiPassword: envPassword, tryCfTunnel: envCfTunnel };

  const consumeValue = (currentIndex, inlineValue) => {
    if (typeof inlineValue === 'string') {
      return { value: inlineValue, nextIndex: currentIndex };
    }
    const nextArg = args[currentIndex + 1];
    if (typeof nextArg === 'string' && !nextArg.startsWith('--')) {
      return { value: nextArg, nextIndex: currentIndex + 1 };
    }
    return { value: undefined, nextIndex: currentIndex };
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--')) {
      continue;
    }

    const eqIndex = arg.indexOf('=');
    const optionName = eqIndex >= 0 ? arg.slice(2, eqIndex) : arg.slice(2);
    const inlineValue = eqIndex >= 0 ? arg.slice(eqIndex + 1) : undefined;

    if (optionName === 'port' || optionName === 'p') {
      const { value, nextIndex } = consumeValue(i, inlineValue);
      i = nextIndex;
      const parsedPort = parseInt(value ?? '', 10);
      options.port = Number.isFinite(parsedPort) ? parsedPort : DEFAULT_PORT;
      continue;
    }

    if (optionName === 'ui-password') {
      const { value, nextIndex } = consumeValue(i, inlineValue);
      i = nextIndex;
      options.uiPassword = typeof value === 'string' ? value : '';
      continue;
    }

    if (optionName === 'try-cf-tunnel') {
      options.tryCfTunnel = true;
      continue;
    }
  }

  return options;
}

function killProcessOnPort(port) {
  if (!port) return;
  try {
    // Kill any process listening on our port to clean up orphaned children.
    const result = spawnSync('lsof', ['-ti', `:${port}`], { encoding: 'utf8', timeout: 5000 });
    const output = result.stdout || '';
    const myPid = process.pid;
    for (const pidStr of output.split(/\s+/)) {
      const pid = parseInt(pidStr.trim(), 10);
      if (pid && pid !== myPid) {
        try {
          spawnSync('kill', ['-9', String(pid)], { stdio: 'ignore', timeout: 2000 });
        } catch {
          // Ignore
        }
      }
    }
  } catch {
    // Ignore - process may already be dead
  }
}

async function createManagedOpenCodeServerProcess({ hostname, port, timeout, cwd, env }) {
  // Default to kronoscode binary, can be overridden via OPENCODE_BINARY or KRONOSCODE_BINARY env
  const binary = (process.env.KRONOSCODE_BINARY || process.env.OPENCODE_BINARY || 'kronoscode').trim() || 'kronoscode';
  const args = ['serve', '--hostname', hostname, '--port', String(port)];
  const child = spawn(binary, args, {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const url = await new Promise((resolve, reject) => {
    let output = '';
    let done = false;
    const finish = (handler, value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      child.stdout?.off('data', onStdout);
      child.stderr?.off('data', onStderr);
      child.off('exit', onExit);
      child.off('error', onError);
      handler(value);
    };

    const onStdout = (chunk) => {
      output += chunk.toString();
      const lines = output.split('\n');
      for (const line of lines) {
        const normalized = line.trim().toLowerCase();
        if (!normalized.startsWith('kronoscode server listening')) continue;
        const match = line.match(/on\s+(https?:\/\/[^\s]+)/);
        if (!match) {
          finish(reject, new Error(`Failed to parse server url from output: ${line}`));
          return;
        }
        finish(resolve, match[1]);
        return;
      }
    };

    const onStderr = (chunk) => {
      output += chunk.toString();
    };

    const onExit = (code) => {
      finish(reject, new Error(`KronosCode exited with code ${code}. Output: ${output}`));
    };

    const onError = (error) => {
      finish(reject, error);
    };

    const timer = setTimeout(() => {
      finish(reject, new Error(`Timeout waiting for KronosCode to start after ${timeout}ms`));
    }, timeout);

    child.stdout?.on('data', onStdout);
    child.stderr?.on('data', onStderr);
    child.on('exit', onExit);
    child.on('error', onError);
  });

  return {
    url,
    close() {
      try {
        child.kill('SIGTERM');
      } catch {
        // ignore
      }
    },
  };
}

async function resolveManagedOpenCodePort(requestedPort) {
  if (typeof requestedPort === 'number' && Number.isFinite(requestedPort) && requestedPort > 0) {
    return requestedPort;
  }

  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    const cleanup = () => {
      server.removeAllListeners('error');
      server.removeAllListeners('listening');
    };

    server.once('error', (error) => {
      cleanup();
      reject(error);
    });

    server.once('listening', () => {
      const address = server.address();
      const port = address && typeof address === 'object' ? address.port : 0;
      server.close(() => {
        cleanup();
        if (port > 0) {
          resolve(port);
          return;
        }
        reject(new Error('Failed to allocate OpenCode port'));
      });
    });

    server.listen(0, '127.0.0.1');
  });
}

async function startOpenCode() {
  const desiredPort = ENV_CONFIGURED_OPENCODE_PORT ?? 0;
  const spawnPort = await resolveManagedOpenCodePort(desiredPort);
  console.log(
    desiredPort > 0 ? `Starting KronosCode on requested port ${desiredPort}...` : `Starting KronosCode on allocated port ${spawnPort}...`,
  );

  await applyOpencodeBinaryFromSettings();
  await applyAiBrowserSettingFromSettings();
  ensureOpencodeCliEnv();
  const openCodePassword = await ensureLocalOpenCodeServerPassword({
    rotateManaged: true,
  });

  try {
    const serverInstance = await createManagedOpenCodeServerProcess({
      hostname: '127.0.0.1',
      port: spawnPort,
      timeout: 30000,
      cwd: openCodeWorkingDirectory,
      env: {
        ...process.env,
        KRONOSCODE_SERVER_PASSWORD: openCodePassword,
        OPENCODE_SERVER_PASSWORD: openCodePassword,
        // Tell the core engine it's running inside KronosChamber so
        // kronoschamber_browser_* tools route to the visible Tauri webview
        KRONOSCHAMBER_DESKTOP: 'true',
        KRONOSCHAMBER_BASE_URL: process.env.KRONOSCHAMBER_BASE_URL || `http://127.0.0.1:${port}`,
        // Auto-connect the core engine to the Chamber MCP server so all
        // Tauri capabilities are available as first-class MCP tools
        KRONOSCODE_MCP_KRONOSCHAMBER_TYPE: 'remote',
        KRONOSCODE_MCP_KRONOSCHAMBER_URL: `${process.env.KRONOSCHAMBER_BASE_URL || `http://127.0.0.1:${port}`}/mcp`,
      },
    });

    if (!serverInstance || !serverInstance.url) {
      throw new Error('KronosCode server started but URL is missing');
    }

    const url = new URL(serverInstance.url);
    const port = parseInt(url.port, 10);
    const prefix = normalizeApiPrefix(url.pathname);

    if (await waitForReady(serverInstance.url, 10000)) {
      setOpenCodePort(port);
      setDetectedOpenCodeApiPrefix(prefix); // SDK URL typically includes the prefix if any

      isOpenCodeReady = true;
      lastOpenCodeError = null;
      openCodeNotReadySince = 0;

      return serverInstance;
    } else {
      try {
        serverInstance.close();
      } catch {
        // ignore
      }
      throw new Error('Server started but health check failed (timeout)');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    lastOpenCodeError = message;
    openCodePort = null;
    syncToHmrState();
    console.error(`Failed to start OpenCode: ${message}`);
    throw error;
  }
}

async function restartOpenCode() {
  if (isShuttingDown) return;
  if (currentRestartPromise) {
    await currentRestartPromise;
    return;
  }

  currentRestartPromise = (async () => {
    isRestartingOpenCode = true;
    isOpenCodeReady = false;
    openCodeNotReadySince = Date.now();
    console.log('Restarting OpenCode process...');

    // For external OpenCode servers, re-probe instead of kill + respawn
    if (isExternalOpenCode) {
      console.log('Re-probing external KronosCode server...');
      const probePort = openCodePort || ENV_CONFIGURED_OPENCODE_PORT || 4096;
      const healthy = await probeExternalOpenCode(probePort);
      if (healthy) {
        console.log(`External KronosCode server on port ${probePort} is healthy`);
        setOpenCodePort(probePort);
        isOpenCodeReady = true;
        lastOpenCodeError = null;
        openCodeNotReadySince = 0;
        syncToHmrState();
      } else {
        lastOpenCodeError = `External KronosCode server on port ${probePort} is not responding`;
        console.error(lastOpenCodeError);
        throw new Error(lastOpenCodeError);
      }

      if (expressApp) {
        setupProxy(expressApp);
        ensureOpenCodeApiPrefix();
      }
      return;
    }

    const portToKill = openCodePort;

    if (openCodeProcess) {
      console.log('Stopping existing OpenCode process...');
      try {
        openCodeProcess.close();
      } catch (error) {
        console.warn('Error closing OpenCode process:', error);
      }
      openCodeProcess = null;
      syncToHmrState();
    }

    killProcessOnPort(portToKill);

    // Brief delay to allow port release
    await new Promise((resolve) => setTimeout(resolve, 250));

    if (ENV_CONFIGURED_OPENCODE_PORT) {
      console.log(`Using OpenCode port from environment: ${ENV_CONFIGURED_OPENCODE_PORT}`);
      setOpenCodePort(ENV_CONFIGURED_OPENCODE_PORT);
    } else {
      openCodePort = null;
      syncToHmrState();
    }

    openCodeApiPrefixDetected = true;
    openCodeApiPrefix = '';
    if (openCodeApiDetectionTimer) {
      clearTimeout(openCodeApiDetectionTimer);
      openCodeApiDetectionTimer = null;
    }

    lastOpenCodeError = null;
    openCodeProcess = await startOpenCode();
    syncToHmrState();

    if (expressApp) {
      setupProxy(expressApp);
      // Ensure prefix is set correctly (SDK usually handles this, but just in case)
      ensureOpenCodeApiPrefix();
    }
  })();

  try {
    await currentRestartPromise;
  } catch (error) {
    console.error(`Failed to restart OpenCode: ${error.message}`);
    lastOpenCodeError = error.message;
    if (!ENV_CONFIGURED_OPENCODE_PORT) {
      openCodePort = null;
      syncToHmrState();
    }
    openCodeApiPrefixDetected = true;
    openCodeApiPrefix = '';
    throw error;
  } finally {
    currentRestartPromise = null;
    isRestartingOpenCode = false;
  }
}

async function waitForOpenCodeReady(timeoutMs = 20000, intervalMs = 400) {
  if (!openCodePort) {
    throw new Error('OpenCode port is not available');
  }

  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const [configResult, agentResult] = await Promise.all([
        fetch(buildOpenCodeUrl('/config', ''), {
          method: 'GET',
          headers: { Accept: 'application/json', ...getOpenCodeAuthHeaders() },
        }).catch((error) => error),
        fetch(buildOpenCodeUrl('/agent', ''), {
          method: 'GET',
          headers: { Accept: 'application/json', ...getOpenCodeAuthHeaders() },
        }).catch((error) => error),
      ]);

      if (configResult instanceof Error) {
        lastError = configResult;
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        continue;
      }

      if (!configResult.ok) {
        lastError = new Error(`OpenCode config endpoint responded with status ${configResult.status}`);
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        continue;
      }

      await configResult.json().catch(() => null);

      if (agentResult instanceof Error) {
        lastError = agentResult;
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        continue;
      }

      if (!agentResult.ok) {
        lastError = new Error(`Agent endpoint responded with status ${agentResult.status}`);
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        continue;
      }

      await agentResult.json().catch(() => []);

      isOpenCodeReady = true;
      lastOpenCodeError = null;
      return;
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  if (lastError) {
    lastOpenCodeError = lastError.message || String(lastError);
    throw lastError;
  }

  const timeoutError = new Error('Timed out waiting for OpenCode to become ready');
  lastOpenCodeError = timeoutError.message;
  throw timeoutError;
}

async function waitForAgentPresence(agentName, timeoutMs = 15000, intervalMs = 300) {
  if (!openCodePort) {
    throw new Error('OpenCode port is not available');
  }

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(buildOpenCodeUrl('/agent'), {
        method: 'GET',
        headers: { Accept: 'application/json', ...getOpenCodeAuthHeaders() },
      });

      if (response.ok) {
        const agents = await response.json();
        if (Array.isArray(agents) && agents.some((agent) => agent?.name === agentName)) {
          return;
        }
      }
    } catch (error) {}

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Agent "${agentName}" not available after OpenCode restart`);
}

async function fetchAgentsSnapshot() {
  if (!openCodePort) {
    throw new Error('OpenCode port is not available');
  }

  const response = await fetch(buildOpenCodeUrl('/agent'), {
    method: 'GET',
    headers: { Accept: 'application/json', ...getOpenCodeAuthHeaders() },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch agents snapshot (status ${response.status})`);
  }

  const agents = await response.json().catch(() => null);
  if (!Array.isArray(agents)) {
    throw new Error('Invalid agents payload from OpenCode');
  }
  return agents;
}

async function fetchProvidersSnapshot() {
  if (!openCodePort) {
    throw new Error('OpenCode port is not available');
  }

  const response = await fetch(buildOpenCodeUrl('/provider'), {
    method: 'GET',
    headers: { Accept: 'application/json', ...getOpenCodeAuthHeaders() },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch providers snapshot (status ${response.status})`);
  }

  const providers = await response.json().catch(() => null);
  if (!Array.isArray(providers)) {
    throw new Error('Invalid providers payload from OpenCode');
  }
  return providers;
}

async function fetchModelsSnapshot() {
  if (!openCodePort) {
    throw new Error('OpenCode port is not available');
  }

  const response = await fetch(buildOpenCodeUrl('/model'), {
    method: 'GET',
    headers: { Accept: 'application/json', ...getOpenCodeAuthHeaders() },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch models snapshot (status ${response.status})`);
  }

  const models = await response.json().catch(() => null);
  if (!Array.isArray(models)) {
    throw new Error('Invalid models payload from OpenCode');
  }
  return models;
}

async function refreshOpenCodeAfterConfigChange(reason, options = {}) {
  const { agentName } = options;

  console.log(`Refreshing OpenCode after ${reason}`);

  // Settings might include a new opencodeBinary; drop cache before restart.
  resolvedOpencodeBinary = null;
  await applyOpencodeBinaryFromSettings();
  await applyAiBrowserSettingFromSettings();

  await restartOpenCode();

  try {
    await waitForOpenCodeReady();
    isOpenCodeReady = true;
    openCodeNotReadySince = 0;

    if (agentName) {
      await waitForAgentPresence(agentName);
    }

    isOpenCodeReady = true;
    openCodeNotReadySince = 0;
  } catch (error) {
    isOpenCodeReady = false;
    openCodeNotReadySince = Date.now();
    console.error(`Failed to refresh OpenCode after ${reason}:`, error.message);
    throw error;
  }
}

function setupProxy(app) {
  if (app.get('opencodeProxyConfigured')) {
    return;
  }

  if (openCodePort) {
    console.log(`Setting up proxy to KronosCode on port ${openCodePort}`);
  } else {
    console.log('Setting up OpenCode API gate (OpenCode not started yet)');
  }
  app.set('opencodeProxyConfigured', true);

  app.use('/api', (req, res, next) => {
    if (
      req.path.startsWith('/themes/custom') ||
      req.path.startsWith('/push') ||
      req.path.startsWith('/agent-mode') ||
      req.path.startsWith('/config/agents') ||
      req.path.startsWith('/config/opencode-resolution') ||
      req.path.startsWith('/config/settings') ||
      req.path.startsWith('/config/skills') ||
      req.path.startsWith('/canvas') ||
      req.path.startsWith('/ops') ||
      req.path.startsWith('/creative') ||
      req.path.startsWith('/workflow') ||
      req.path.startsWith('/workflow-library') ||
      req.path === '/config/reload' ||
      req.path === '/health'
    ) {
      return next();
    }

    const waitElapsed = openCodeNotReadySince === 0 ? 0 : Date.now() - openCodeNotReadySince;
    const stillWaiting =
      (!isOpenCodeReady && (openCodeNotReadySince === 0 || waitElapsed < OPEN_CODE_READY_GRACE_MS)) ||
      isRestartingOpenCode ||
      !openCodePort;

    if (stillWaiting) {
      return res.status(503).json({
        error: 'OpenCode is restarting',
        restarting: true,
      });
    }

    next();
  });

  const isSseApiPath = (path) => path === '/event' || path === '/global/event';

  const forwardSseRequest = async (req, res) => {
    const startedAt = Date.now();
    const upstreamPath = req.originalUrl.replace(/^\/api/, '');
    const targetUrl = buildOpenCodeUrl(upstreamPath, '');
    const authHeaders = getOpenCodeAuthHeaders();

    const requestHeaders = {
      ...(typeof req.headers.accept === 'string' ? { accept: req.headers.accept } : { accept: 'text/event-stream' }),
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      ...(authHeaders.Authorization ? { Authorization: authHeaders.Authorization } : {}),
    };

    const controller = new AbortController();
    let connectTimer = null;
    let idleTimer = null;
    let heartbeatTimer = null;
    let endedBy = 'upstream-end';

    const cleanup = () => {
      if (connectTimer) {
        clearTimeout(connectTimer);
        connectTimer = null;
      }
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      req.off('close', onClientClose);
    };

    const resetIdleTimeout = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
      }
      idleTimer = setTimeout(
        () => {
          endedBy = 'idle-timeout';
          controller.abort();
        },
        5 * 60 * 1000,
      );
    };

    const onClientClose = () => {
      endedBy = 'client-disconnect';
      controller.abort();
    };

    req.on('close', onClientClose);

    try {
      connectTimer = setTimeout(() => {
        endedBy = 'connect-timeout';
        controller.abort();
      }, 10 * 1000);

      const upstreamResponse = await fetch(targetUrl, {
        method: 'GET',
        headers: requestHeaders,
        signal: controller.signal,
      });

      if (connectTimer) {
        clearTimeout(connectTimer);
        connectTimer = null;
      }

      if (!upstreamResponse.ok || !upstreamResponse.body) {
        const body = await upstreamResponse.text().catch(() => '');
        cleanup();
        if (!res.headersSent) {
          if (upstreamResponse.headers.has('content-type')) {
            res.setHeader('content-type', upstreamResponse.headers.get('content-type'));
          }
          res.status(upstreamResponse.status).send(body);
        }
        return;
      }

      const upstreamContentType = upstreamResponse.headers.get('content-type') || 'text/event-stream';
      res.status(upstreamResponse.status);
      res.setHeader('content-type', upstreamContentType);
      res.setHeader('cache-control', 'no-cache');
      res.setHeader('connection', 'keep-alive');
      res.setHeader('x-accel-buffering', 'no');
      res.setHeader('x-content-type-options', 'nosniff');
      if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
      }

      resetIdleTimeout();
      heartbeatTimer = setInterval(() => {
        if (res.writableEnded || controller.signal.aborted) {
          return;
        }
        try {
          res.write(': ping\n\n');
          resetIdleTimeout();
        } catch {}
      }, 30 * 1000);

      const reader = upstreamResponse.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            endedBy = endedBy === 'upstream-end' ? 'upstream-finished' : endedBy;
            break;
          }
          if (controller.signal.aborted) {
            break;
          }
          if (value && value.length > 0) {
            res.write(Buffer.from(value));
            resetIdleTimeout();
          }
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {}
      }

      cleanup();
      if (!res.writableEnded) {
        res.end();
      }
      console.log(`SSE forward ${upstreamPath} closed (${endedBy}) in ${Date.now() - startedAt}ms`);
    } catch (error) {
      cleanup();
      const isTimeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
      if (!res.headersSent) {
        res.status(isTimeout ? 504 : 503).json({
          error: isTimeout ? 'OpenCode SSE forward timed out' : 'OpenCode SSE forward failed',
        });
      } else if (!res.writableEnded) {
        res.end();
      }
      console.warn(`SSE forward ${upstreamPath} failed (${endedBy}):`, error?.message || error);
    }
  };

  // Canonical SSE routes are registered in main() so they can keep
  // OpenChamber-specific event fan-out behavior in one place.

  app.use('/api', (_req, _res, next) => {
    ensureOpenCodeApiPrefix();
    next();
  });

  app.use('/api', (req, res, next) => {
    if (
      req.path.startsWith('/themes/custom') ||
      req.path.startsWith('/agent-mode') ||
      req.path.startsWith('/config/agents') ||
      req.path.startsWith('/config/opencode-resolution') ||
      req.path.startsWith('/config/settings') ||
      req.path.startsWith('/config/skills') ||
      req.path.startsWith('/canvas') ||
      req.path.startsWith('/ops') ||
      req.path.startsWith('/creative') ||
      req.path.startsWith('/workflow') ||
      req.path.startsWith('/workflow-library') ||
      req.path === '/health'
    ) {
      return next();
    }
    if (VERBOSE_REQUEST_LOGS) {
      console.log(`API → OpenCode: ${req.method} ${req.path}`);
    }
    next();
  });

  const hopByHopRequestHeaders = new Set([
    'host',
    'connection',
    'content-length',
    'transfer-encoding',
    'keep-alive',
    'te',
    'trailer',
    'upgrade',
  ]);

  const hopByHopResponseHeaders = new Set([
    'connection',
    'content-length',
    'transfer-encoding',
    'keep-alive',
    'te',
    'trailer',
    'upgrade',
    'www-authenticate',
  ]);

  const collectForwardHeaders = (req) => {
    const authHeaders = getOpenCodeAuthHeaders();
    const headers = {};

    for (const [key, value] of Object.entries(req.headers || {})) {
      if (!value) continue;
      const lowerKey = key.toLowerCase();
      if (hopByHopRequestHeaders.has(lowerKey)) continue;
      headers[lowerKey] = Array.isArray(value) ? value.join(', ') : String(value);
    }

    if (authHeaders.Authorization) {
      headers.Authorization = authHeaders.Authorization;
    }

    return headers;
  };

  const collectRequestBodyBuffer = async (req) => {
    if (Buffer.isBuffer(req.body)) {
      return req.body;
    }

    if (typeof req.body === 'string') {
      return Buffer.from(req.body);
    }

    if (req.body && typeof req.body === 'object') {
      return Buffer.from(JSON.stringify(req.body));
    }

    if (req.readableEnded) {
      return Buffer.alloc(0);
    }

    return await new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  };

  const forwardGenericApiRequest = async (req, res) => {
    try {
      const upstreamPath = req.originalUrl.replace(/^\/api/, '');
      const targetUrl = buildOpenCodeUrl(upstreamPath, '');
      const headers = collectForwardHeaders(req);
      const method = String(req.method || 'GET').toUpperCase();
      const hasBody = method !== 'GET' && method !== 'HEAD';
      const bodyBuffer = hasBody ? await collectRequestBodyBuffer(req) : null;

      const upstreamResponse = await fetch(targetUrl, {
        method,
        headers,
        body: hasBody ? bodyBuffer : undefined,
        signal: AbortSignal.timeout(LONG_REQUEST_TIMEOUT_MS),
      });

      if (method === 'POST' && req.path === '/session/resume_last_objective') {
        void trackRetentionResumeInvocation(req, upstreamResponse.ok);
      }

      if (method === 'POST' && upstreamResponse.ok) {
        const match = req.path.match(/^\/session\/([^/]+)\/message$/);
        if (match && typeof match[1] === 'string' && match[1].length > 0) {
          let sessionID = match[1];
          try {
            sessionID = decodeURIComponent(sessionID);
          } catch {
            // ignore decode issues and use raw value
          }
          void trackRetentionUserMessageSent(req, sessionID);
        }
      }

      for (const [key, value] of upstreamResponse.headers.entries()) {
        const lowerKey = key.toLowerCase();
        if (hopByHopResponseHeaders.has(lowerKey)) {
          continue;
        }
        res.setHeader(key, value);
      }

      const upstreamBody = Buffer.from(await upstreamResponse.arrayBuffer());
      res.status(upstreamResponse.status).send(upstreamBody);
    } catch (error) {
      if (!res.headersSent) {
        const isTimeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
        res.status(isTimeout ? 504 : 503).json({
          error: isTimeout ? 'OpenCode request timed out' : 'OpenCode service unavailable',
        });
      }
    }
  };

  // Desktop browser bridge — lets the core engine control the visible Tauri webview
  // via kronoschamber_browser_* tools. Uses a request/response correlation pattern:
  // 1. POST /api/desktop-browser/action — core engine sends action
  // 2. Server broadcasts via SSE to the frontend
  // 3. Frontend executes Tauri IPC, POSTs result to /api/desktop-browser/result/:id
  // 4. Server resolves the pending promise and returns result to core engine

  // Dedicated Chamber event stream — always reachable by the frontend regardless
  // of whether the interconnect relay is active. Used for desktop-browser-action
  // notifications that must reach the UI to execute Tauri IPC.
  const chamberEventClients = new Set();
  app.get('/api/chamber-events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
    chamberEventClients.add(res);
    req.on('close', () => chamberEventClients.delete(res));
  });

  function broadcastChamberEvent(payload) {
    const data = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of chamberEventClients) {
      try {
        res.write(data);
      } catch {
        chamberEventClients.delete(res);
      }
    }
  }

  const pendingBrowserActions = new Map(); // id → { resolve, reject, timer }

  function normalizeDesktopBrowserActionEnvelope(body) {
    if (body?.error) {
      const message = typeof body.error === 'string' ? body.error : 'Desktop browser action failed';
      return { ok: false, code: 'execution_error', message };
    }

    const result = body?.result ?? null;
    if (result && typeof result === 'object') {
      const success =
        result.ok === true || result.success === true || (typeof result.ok !== 'boolean' && typeof result.success !== 'boolean');
      if (!success) {
        return {
          ok: false,
          code: typeof result.code === 'string' ? result.code : 'execution_error',
          message:
            typeof result.message === 'string'
              ? result.message
              : typeof result.error === 'string'
                ? result.error
                : 'Desktop browser action failed',
          details: result,
        };
      }
      return { ok: true, value: result.result ?? result.value ?? result };
    }

    return { ok: true, value: result };
  }

  app.post('/api/desktop-browser/action', express.json(), async (req, res) => {
    const { action, payload = {} } = req.body ?? {};
    if (typeof action !== 'string' || !action) {
      return res.status(400).json({ ok: false, code: 'invalid_request', message: 'action is required' });
    }

    const id = `dba-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const TIMEOUT_MS = (typeof payload.timeout === 'number' ? payload.timeout : 0) || 15_000;

    const resultPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingBrowserActions.delete(id);
        reject(new Error(`Desktop browser action "${action}" timed out after ${TIMEOUT_MS}ms`));
      }, TIMEOUT_MS + 2000);
      pendingBrowserActions.set(id, { resolve, reject, timer });
    });

    // Broadcast to the frontend so it can call Tauri IPC
    broadcastChamberEvent({ type: 'desktop-browser-action', id, action, payload });

    try {
      const result = await resultPromise;
      return res.status(result?.ok === false ? 502 : 200).json(result);
    } catch (err) {
      return res.status(504).json({
        ok: false,
        code: 'timeout',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Frontend posts the Tauri IPC result back here
  app.post('/api/desktop-browser/result/:id', express.json(), (req, res) => {
    const { id } = req.params;
    const pending = pendingBrowserActions.get(id);
    if (!pending) {
      return res.status(404).json({
        ok: false,
        code: 'not_found',
        message: 'No pending action with that id',
      });
    }
    pendingBrowserActions.delete(id);
    clearTimeout(pending.timer);
    pending.resolve(normalizeDesktopBrowserActionEnvelope(req.body));
    return res.json({ ok: true });
  });

  // KronosChamber MCP server — exposes all Tauri capabilities as MCP tools
  registerMcpRoutes(app);

  app.post('/api/kronoscode/gateway-ticket', express.json(), async (req, res) => {
    try {
      const targetUrl = buildOpenCodeUrl('/global/gateway/ticket', '');
      const upstreamResponse = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...getOpenCodeAuthHeaders(),
        },
        body: JSON.stringify({
          directory: typeof req.body?.directory === 'string' ? req.body.directory : undefined,
          surface_id: typeof req.body?.surfaceId === 'string' ? req.body.surfaceId : undefined,
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!upstreamResponse.ok) {
        return res.status(upstreamResponse.status).json({ error: 'KronosCode gateway ticket request failed' });
      }
      const ticket = await upstreamResponse.json();
      return res.json({
        wsUrl: buildKronosGatewayBrowserUrl(ticket.ticket),
        expiresAt: ticket.expiresAt,
      });
    } catch (error) {
      return res.status(503).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Dedicated forwarder for large session message payloads.
  // This avoids edge-cases in generic proxy streaming for multi-file attachments.
  app.post('/api/session/:sessionId/message', express.raw({ type: '*/*', limit: '50mb' }), async (req, res) => {
    try {
      const upstreamPath = req.originalUrl.replace(/^\/api/, '');
      const targetUrl = buildOpenCodeUrl(upstreamPath, '');
      const authHeaders = getOpenCodeAuthHeaders();

      const headers = {
        ...(typeof req.headers['content-type'] === 'string'
          ? { 'content-type': req.headers['content-type'] }
          : { 'content-type': 'application/json' }),
        ...(typeof req.headers.accept === 'string' ? { accept: req.headers.accept } : {}),
        ...(authHeaders.Authorization ? { Authorization: authHeaders.Authorization } : {}),
      };

      const bodyBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === 'string' ? req.body : '');

      const upstreamResponse = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: bodyBuffer,
        signal: AbortSignal.timeout(LONG_REQUEST_TIMEOUT_MS),
      });

      if (upstreamResponse.ok) {
        const sessionID = typeof req.params?.sessionId === 'string' ? req.params.sessionId : '';
        if (sessionID.length > 0) {
          void trackRetentionUserMessageSent(req, sessionID);
        }
      }

      const upstreamBody = Buffer.from(await upstreamResponse.arrayBuffer());

      if (upstreamResponse.headers.has('content-type')) {
        res.setHeader('content-type', upstreamResponse.headers.get('content-type'));
      }

      res.status(upstreamResponse.status).send(upstreamBody);
    } catch (error) {
      if (!res.headersSent) {
        const isTimeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
        res.status(isTimeout ? 504 : 503).json({
          error: isTimeout ? 'OpenCode message forward timed out' : 'OpenCode message forward failed',
        });
      }
    }
  });

  app.use('/api', (req, res, next) => {
    if (isSseApiPath(req.path)) {
      return next();
    }

    if (req.method === 'POST' && /\/session\/[^/]+\/message$/.test(req.path || '')) {
      return next();
    }

    return forwardGenericApiRequest(req, res);
  });
}

function startHealthMonitoring() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }

  healthCheckInterval = setInterval(async () => {
    if (isShuttingDown || isRestartingOpenCode) return;

    try {
      if (ENV_SKIP_OPENCODE_START || isExternalOpenCode) {
        await validateConfiguredOpenCode();
        isOpenCodeReady = true;
        lastOpenCodeError = null;
        return;
      }
      const healthy = await isOpenCodeProcessHealthy();
      if (!healthy) {
        console.log('OpenCode process not running, restarting...');
        await restartOpenCode();
      }
    } catch (error) {
      console.error(`Health check error: ${error.message}`);
    }
  }, HEALTH_CHECK_INTERVAL);
}

async function gracefulShutdown(options = {}) {
  if (isShuttingDown) return;

  isShuttingDown = true;
  syncToHmrState();
  console.log('Starting graceful shutdown...');
  const exitProcess = typeof options.exitProcess === 'boolean' ? options.exitProcess : exitOnShutdown;

  stopGlobalEventWatcher();

  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }

  if (terminalInputWsServer) {
    try {
      for (const client of terminalInputWsServer.clients) {
        try {
          client.terminate();
        } catch {}
      }

      await new Promise((resolve) => {
        terminalInputWsServer.close(() => resolve());
      });
    } catch {
    } finally {
      terminalInputWsServer = null;
    }
  }

  if (kronosGatewayWsServer) {
    try {
      for (const client of kronosGatewayWsServer.clients) {
        try {
          client.terminate();
        } catch {}
      }

      await new Promise((resolve) => {
        kronosGatewayWsServer.close(() => resolve());
      });
    } catch {
    } finally {
      kronosGatewayWsServer = null;
    }
  }

  // Only stop OpenCode if we started it ourselves (not when using external server)
  if (!ENV_SKIP_OPENCODE_START && !isExternalOpenCode) {
    const portToKill = openCodePort;

    if (openCodeProcess) {
      console.log('Stopping OpenCode process...');
      try {
        openCodeProcess.close();
      } catch (error) {
        console.warn('Error closing OpenCode process:', error);
      }
      openCodeProcess = null;
    }

    killProcessOnPort(portToKill);
  } else {
    console.log('Skipping OpenCode shutdown (external server)');
  }

  if (server) {
    await Promise.race([
      new Promise((resolve) => {
        server.close(() => {
          console.log('HTTP server closed');
          resolve();
        });
      }),
      new Promise((resolve) => {
        setTimeout(() => {
          console.warn('Server close timeout reached, forcing shutdown');
          resolve();
        }, SHUTDOWN_TIMEOUT);
      }),
    ]);
  }

  if (uiAuthController) {
    uiAuthController.dispose();
    uiAuthController = null;
  }
  businessProxyMiddleware = null;
  socialProxyMiddleware = null;
  videoProxyMiddleware = null;
  jaazProxyMiddleware = null;

  if (cloudflareTunnelController) {
    console.log('Stopping Cloudflare tunnel...');
    cloudflareTunnelController.stop();
    cloudflareTunnelController = null;
  }

  console.log('Graceful shutdown complete');
  if (exitProcess) {
    process.exit(0);
  }
}

async function main(options = {}) {
  const port = Number.isFinite(options.port) && options.port >= 0 ? Math.trunc(options.port) : DEFAULT_PORT;
  const tryCfTunnel = options.tryCfTunnel === true;
  const attachSignals = options.attachSignals !== false;
  const onTunnelReady = typeof options.onTunnelReady === 'function' ? options.onTunnelReady : null;
  if (typeof options.exitOnShutdown === 'boolean') {
    exitOnShutdown = options.exitOnShutdown;
  }

  console.log(`Starting KronosChamber on port ${port === 0 ? 'auto' : port}`);
  await bootstrapLocalDesktopSandbox();

  // Check macOS Say TTS availability once at startup
  let sayTTSCapability = { available: false, voices: [], reason: 'Not checked' };
  if (process.platform === 'darwin') {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      const { stdout } = await execAsync('say -v "?"');
      const voices = stdout
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          const match = line.match(/^(.+?)\s+([a-zA-Z]{2}_[a-zA-Z]{2,3})\s+#/);
          if (match) {
            return { name: match[1].trim(), locale: match[2] };
          }
          return null;
        })
        .filter(Boolean);
      sayTTSCapability = { available: true, voices };
      console.log(`macOS Say TTS available with ${voices.length} voices`);
    } catch (error) {
      sayTTSCapability = { available: false, voices: [], reason: 'say command not available' };
      console.log('macOS Say TTS not available:', error.message);
    }
  } else {
    sayTTSCapability = { available: false, voices: [], reason: 'Not macOS' };
  }

  // Validate stored zen model at startup – best-effort, never blocks startup
  try {
    const freeModels = await fetchFreeZenModels();
    const freeModelIds = freeModels.map((m) => m.id);

    if (freeModelIds.length > 0) {
      // Set the validated fallback to the first available free model
      validatedZenFallback = freeModelIds[0];

      const settings = await readSettingsFromDisk();
      const storedModel = typeof settings?.zenModel === 'string' ? settings.zenModel.trim() : '';

      if (!storedModel || !freeModelIds.includes(storedModel)) {
        const fallback = freeModelIds[0];
        console.log(
          storedModel
            ? `[zen] Stored model "${storedModel}" not found in free models, falling back to "${fallback}"`
            : `[zen] No model configured, setting default to "${fallback}"`,
        );
        await persistSettings({ zenModel: fallback });
      } else {
        console.log(`[zen] Stored model "${storedModel}" verified as available`);
      }
    } else {
      console.warn('[zen] No free models returned from API, skipping validation');
    }
  } catch (error) {
    console.warn('[zen] Startup model validation failed (non-blocking):', error?.message || error);
  }

  const app = express();
  app.set('trust proxy', true);
  expressApp = app;
  server = http.createServer(app);
  const socialState = createSocialState();
  const videoState = createVideoState();

  const autoStartResult = await autoStartServices().catch((error) => ({
    error: error instanceof Error ? error.message : String(error),
  }));
  if (autoStartResult && Object.keys(autoStartResult).length > 0) {
    console.log('[AutoStart] Third-party service results:', JSON.stringify(autoStartResult));
  }

  app.get('/health', (req, res) => {
    const zenApiKey = resolveZenApiKey();
    const postizOrigin = resolvePostizOrigin();
    const supoClipOrigin = resolveSupoClipOrigin();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      openCodePort: openCodePort,
      openCodeRunning: Boolean(openCodePort && isOpenCodeReady && !isRestartingOpenCode),
      openCodeSecureConnection: isOpenCodeConnectionSecure(),
      openCodeAuthSource: openCodeAuthSource || null,
      openCodeApiPrefix: '',
      openCodeApiPrefixDetected: true,
      isOpenCodeReady,
      openCodeAiBrowserEnabled: process.env.KRONOSCODE_ENABLE_AI_BROWSER === 'true' || process.env.OPENCODE_ENABLE_AI_BROWSER === 'true',
      lastOpenCodeError,
      opencodeBinaryResolved: resolvedOpencodeBinary || null,
      opencodeBinarySource: resolvedOpencodeBinarySource || null,
      opencodeShimInterpreter: resolvedOpencodeBinary ? opencodeShimInterpreter(resolvedOpencodeBinary) : null,
      nodeBinaryResolved: resolvedNodeBinary || null,
      bunBinaryResolved: resolvedBunBinary || null,
      zen: {
        baseUrl: ZEN_BASE_URL,
        authConfigured: Boolean(zenApiKey.value),
        authSource: zenApiKey.source,
        modelDefault: ZEN_DEFAULT_MODEL,
        validatedFallback: validatedZenFallback,
      },
      workspaces: {
        business: {
          originConfigured: Boolean(resolveNocobaseOrigin()),
          available: Boolean(resolveNocobaseOrigin()),
          upstreamProxyConfigured: Boolean(resolveNocobaseOrigin()),
          health: resolveNocobaseOrigin() ? 'available' : 'unavailable',
          reason: resolveNocobaseOrigin() ? '' : 'OPENCHAMBER_NOCOBASE_ORIGIN is not configured; native Business workspace is active.',
        },
        canvas: {
          originConfigured: false,
          available: true,
          upstreamProxyConfigured: Boolean(resolveJaazWorkspaceOrigin()),
          health: 'available',
          reason: 'Native Canvas workspace is active.',
        },
        social: getSocialWorkspaceStatus(postizOrigin),
        video: getVideoWorkspaceStatus(supoClipOrigin),
      },
    });
  });

  app.post('/api/system/shutdown', (req, res) => {
    res.json({ ok: true });
    gracefulShutdown({ exitProcess: false }).catch((error) => {
      console.error('Shutdown request failed:', error?.message || error);
    });
  });

  app.get('/api/runtime/services', async (_req, res) => {
    try {
      res.json({
        services: await getServiceStatus(),
        origins: {
          postiz: resolvePostizOrigin(),
          supoclip: resolveSupoClipOrigin(),
        },
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load service status' });
    }
  });

  app.post('/api/runtime/services/:service/start', async (req, res) => {
    try {
      const service = String(req.params.service || '').toLowerCase();
      if (service === 'postiz' || service === 'social') {
        res.json(await startPostiz());
        return;
      }
      if (service === 'supoclip' || service === 'video') {
        res.json(await startSupoClip());
        return;
      }
      res.status(404).json({ error: `Unknown managed service: ${service}` });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to start service' });
    }
  });

  app.get('/api/runtime/services/:service/logs', (req, res) => {
    const service = String(req.params.service || '').toLowerCase();
    const type = typeof req.query.type === 'string' ? req.query.type : 'app';
    res.type('text/plain').send(getServiceLogs(service, type));
  });

  app.use((req, res, next) => {
    if (req.path.startsWith(NOCOBASE_PROXY_BASE_PATH)) {
      return next();
    }
    if (req.path.startsWith(SOCIAL_PROXY_BASE_PATH)) {
      return next();
    }
    if (req.path.startsWith(VIDEO_PROXY_BASE_PATH)) {
      return next();
    }
    if (req.path.startsWith(JAAZ_PROXY_BASE_PATH)) {
      return next();
    }

    if (
      req.path.startsWith('/api/config/agents') ||
      req.path.startsWith('/api/config/commands') ||
      req.path.startsWith('/api/config/mcp') ||
      req.path.startsWith('/api/config/settings') ||
      req.path.startsWith('/api/config/skills') ||
      req.path.startsWith('/api/fs') ||
      req.path.startsWith('/api/git') ||
      req.path.startsWith('/api/agent-mode') ||
      req.path.startsWith('/api/runtime') ||
      req.path.startsWith('/api/canvas') ||
      req.path.startsWith('/api/ops') ||
      req.path.startsWith('/api/business') ||
      req.path.startsWith('/api/social') ||
      req.path.startsWith('/api/video') ||
      req.path.startsWith('/api/creative') ||
      req.path.startsWith('/api/workflow') ||
      req.path.startsWith('/api/prompts') ||
      req.path.startsWith('/api/terminal') ||
      req.path.startsWith('/api/opencode') ||
      req.path.startsWith('/api/desktop-sandbox') ||
      req.path.startsWith('/api/push') ||
      req.path.startsWith('/api/voice') ||
      req.path.startsWith('/api/tts')
    ) {
      express.json({ limit: '50mb' })(req, res, next);
    } else if (req.path.startsWith('/api')) {
      next();
    } else {
      express.json({ limit: '50mb' })(req, res, next);
    }
  });
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  app.use((req, res, next) => {
    if (VERBOSE_REQUEST_LOGS) {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    }
    next();
  });

  const nocobaseOrigin = resolveNocobaseOrigin();
  const nocobaseTimeoutMs = resolveNocobaseTimeoutMs();
  const postizOrigin = resolvePostizOrigin();
  const supoClipOrigin = resolveSupoClipOrigin();
  const jaazWorkspaceOrigin = resolveJaazWorkspaceOrigin();
  if (nocobaseOrigin) {
    uiAuthController = createNocobaseUiAuth({
      origin: nocobaseOrigin,
      authenticator: resolveNocobaseAuthenticator(),
      appName: resolveNocobaseApp(),
      timeoutMs: nocobaseTimeoutMs,
    });
  } else {
    uiAuthController = createUiAuth({
      password: options.uiPassword,
    });
  }

  if (nocobaseOrigin) {
    businessProxyMiddleware = buildBusinessProxyMiddleware(nocobaseOrigin);
    app.use(NOCOBASE_PROXY_BASE_PATH, businessProxyMiddleware);
    console.log(
      `NocoBase UI auth enabled via ${nocobaseOrigin} (authenticator=${resolveNocobaseAuthenticator()}, app=${resolveNocobaseApp()}, timeoutMs=${nocobaseTimeoutMs})`,
    );
  } else {
    businessProxyMiddleware = null;
    app.use(NOCOBASE_PROXY_BASE_PATH, (_req, res) => {
      res.status(503).type('text/plain').send('Business workspace is not configured. Set OPENCHAMBER_NOCOBASE_ORIGIN.');
    });
  }

  if (postizOrigin) {
    socialProxyMiddleware = buildSocialProxyMiddleware(postizOrigin);
    app.use(SOCIAL_PROXY_BASE_PATH, socialProxyMiddleware);
    console.log(`Postiz social proxy enabled via ${postizOrigin}`);
  } else {
    socialProxyMiddleware = null;
    app.use(SOCIAL_PROXY_BASE_PATH, (_req, res) => {
      res.status(503).type('text/plain').send('Social workspace proxy is not configured. Set OPENCHAMBER_POSTIZ_ORIGIN.');
    });
  }

  if (supoClipOrigin) {
    videoProxyMiddleware = buildVideoProxyMiddleware(supoClipOrigin);
    app.use(VIDEO_PROXY_BASE_PATH, videoProxyMiddleware);
    console.log(`SupoClip video proxy enabled via ${supoClipOrigin}`);
  } else {
    videoProxyMiddleware = null;
    app.use(VIDEO_PROXY_BASE_PATH, (_req, res) => {
      res.status(503).type('text/plain').send('Video workspace proxy is not configured. Set OPENCHAMBER_SUPOCLIP_ORIGIN.');
    });
  }

  if (jaazWorkspaceOrigin) {
    jaazProxyMiddleware = buildJaazProxyMiddleware(jaazWorkspaceOrigin);
    app.use(JAAZ_PROXY_BASE_PATH, jaazProxyMiddleware);
    console.log(`Jaaz import adapter proxy enabled via ${jaazWorkspaceOrigin}`);
  } else {
    jaazProxyMiddleware = null;
    app.use(JAAZ_PROXY_BASE_PATH, (_req, res) => {
      res.status(503).type('text/plain').send('Jaaz import adapter is not configured. Set OPENCHAMBER_JAAZ_APP_ORIGIN.');
    });
  }

  app.get('/auth/session', (req, res) => uiAuthController.handleSessionStatus(req, res));
  app.post('/auth/session', (req, res) => uiAuthController.handleSessionCreate(req, res));
  app.delete('/auth/session', (req, res) => {
    if (typeof uiAuthController.handleSessionDestroy === 'function') {
      return uiAuthController.handleSessionDestroy(req, res);
    }
    return res.status(200).json({ authenticated: false, cleared: false });
  });

  app.use('/api', (req, res, next) => uiAuthController.requireAuth(req, res, next));
  const businessApiRouter = createBusinessRouter({
    getNocobaseOrigin: () => resolveNocobaseOrigin(),
  });
  app.use('/api/business', businessApiRouter);
  const socialApiRouter = createSocialRouter({
    state: socialState,
    getPostizOrigin: () => resolvePostizOrigin(),
  });
  app.use('/api/social', socialApiRouter);
  const videoApiRouter = createVideoRouter({
    state: videoState,
    getSupoClipOrigin: () => resolveSupoClipOrigin(),
    onCreateSocialDraft: (payload) => socialState.createDraft(payload),
  });
  app.use('/api/video', videoApiRouter);
  setWorkspaceToolHandlers({
    social_list_calendar: async ({ from, to, status } = {}) => ({
      items: socialState.listCalendar({ from, to, status }),
    }),
    social_create_draft: async (args = {}) => ({
      draft: socialState.createDraft({ ...args, provenance: 'agent' }),
    }),
    social_schedule_draft: async ({ draftId, scheduledAt } = {}) => ({
      draft: socialState.scheduleDraft(draftId, scheduledAt),
    }),
    social_review_draft: async ({ draftId, approved, comment } = {}) => ({
      draft: socialState.reviewDraft(draftId, approved !== false, comment),
    }),
    brand_check_content: async (args = {}) => socialState.brandCheck(args),
    video_create_clip_job: async (args = {}) => ({
      job: videoState.createJob(args),
    }),
    video_get_clip_job: async ({ jobId } = {}) => {
      const job = videoState.getJob(jobId);
      if (!job) {
        throw new Error('Job not found');
      }
      return { job };
    },
    video_send_clip_to_social: async ({ clipId, platforms, caption } = {}) =>
      videoState.sendClipToSocial({
        clipId,
        platforms,
        caption,
        onCreateSocialDraft: (payload) => socialState.createDraft(payload),
      }),
  });
  const { default: desktopSandboxRouter } = await import('./lib/desktop-sandbox/index.js');
  app.use('/api/desktop-sandbox', desktopSandboxRouter);

  app.get('/api/workflow/playbook', (_req, res) => {
    return res.json(CHAMBER_PLAYBOOKS);
  });

  app.get('/api/workflow/run', (req, res) => {
    const sessionID = typeof req.query.sessionID === 'string' ? req.query.sessionID : '';
    const limit = Math.min(Math.max(Number(req.query.limit) || 40, 1), 100);
    const runs = Array.from(chamberWorkflowRuns.values())
      .filter((run) => !sessionID || run.session_id === sessionID)
      .sort((a, b) => b.time.created - a.time.created)
      .slice(0, limit)
      .map(createChamberRunFromRows);
    return res.json(runs);
  });

  app.get('/api/workflow/run/active', (req, res) => {
    const sessionID = typeof req.query.sessionID === 'string' ? req.query.sessionID : '';
    const runs = Array.from(chamberWorkflowRuns.values())
      .filter((run) => !sessionID || run.session_id === sessionID)
      .filter((run) => run.status === 'queued' || run.status === 'running')
      .sort((a, b) => b.time.created - a.time.created)
      .map((run) => ({
        workflow_run_id: run.workflow_run_id,
        session_id: run.session_id,
        playbook_id: run.playbook_id,
        workflow_stage: run.workflow_stage,
        status: run.status,
        workflow_outcome: run.workflow_outcome,
      }));
    return res.json(runs);
  });

  app.get('/api/workflow/run/:runID', (req, res) => {
    const run = chamberWorkflowRuns.get(req.params.runID);
    if (!run) {
      return res.status(404).json({
        ok: false,
        code: 'workflow_run_not_found',
        message: `Workflow run '${req.params.runID}' was not found.`,
      });
    }
    return res.json(createChamberRunFromRows(run));
  });

  app.post('/api/workflow/run', (req, res) => {
    const sessionID = typeof req.body?.sessionID === 'string' ? req.body.sessionID : '';
    const playbookID = typeof req.body?.playbookID === 'string' ? req.body.playbookID : 'execution_library_graph';
    const idempotencyKey = typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey : undefined;
    const input = req.body?.input && typeof req.body.input === 'object' ? req.body.input : {};

    if (!sessionID) {
      return res.status(400).json({
        ok: false,
        code: 'session_required',
        message: 'sessionID is required to start a workflow run.',
      });
    }

    if (idempotencyKey) {
      const existing = Array.from(chamberWorkflowRuns.values()).find(
        (run) => run.session_id === sessionID && run.idempotency_key === idempotencyKey,
      );
      if (existing) {
        return res.json(createChamberRunFromRows(existing));
      }
    }

    const normalized = normalizeChamberGraph(input);
    if (normalized.nodes.length === 0) {
      return res.status(400).json({
        ok: false,
        code: 'workflow_graph_required',
        message: 'A workflow graph with at least one node is required.',
      });
    }

    const now = Date.now();
    const runID = createChamberWorkflowRunID();
    const run = {
      workflow_run_id: runID,
      session_id: sessionID,
      workflow_id: 'chamber:execution-library',
      playbook_id: playbookID,
      workflow_stage: normalized.nodes[0]?.workflow_stage || 'queued',
      status: 'queued',
      workflow_outcome: undefined,
      session_resume_token: Buffer.from(JSON.stringify({ sessionID, workflow_run_id: runID, issued_at: now })).toString('base64url'),
      idempotency_key: idempotencyKey,
      input,
      output: undefined,
      error: undefined,
      time: {
        created: now,
        updated: now,
        started: undefined,
        completed: undefined,
      },
      nodes: normalized.nodes.map((node) => ({ ...node, workflow_run_id: runID })),
      edges: normalized.edges,
    };

    chamberWorkflowRuns.set(runID, run);
    void runChamberWorkflow(runID).catch((error) => {
      updateChamberRun(runID, {
        status: 'failed',
        workflow_stage: 'failed',
        workflow_outcome: 'failed',
        error: error instanceof Error ? error.message : String(error),
        time: { completed: Date.now() },
      });
    });

    return res.status(201).json(createChamberRunFromRows(run));
  });

  app.post('/api/workflow/run/:runID/cancel', (req, res) => {
    const run = chamberWorkflowRuns.get(req.params.runID);
    if (!run) {
      return res.status(404).json({
        ok: false,
        code: 'workflow_run_not_found',
        message: `Workflow run '${req.params.runID}' was not found.`,
      });
    }

    const now = Date.now();
    const next = updateChamberRun(req.params.runID, {
      status: 'cancelled',
      workflow_stage: 'cancelled',
      workflow_outcome: 'cancelled',
      time: { completed: now },
    });
    next.nodes = next.nodes.map((node) =>
      node.status === 'pending' || node.status === 'running'
        ? { ...node, status: 'cancelled', error: 'Cancelled by user', time_completed: now }
        : node,
    );
    chamberWorkflowRuns.set(req.params.runID, next);
    return res.json(createChamberRunFromRows(next));
  });

  app.get('/api/workflow-library/executions', (req, res) => {
    try {
      const library = buildN8nExecutionLibrary();
      const query = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
      const category = typeof req.query.category === 'string' ? req.query.category.trim().toLowerCase() : '';
      const family = typeof req.query.family === 'string' ? req.query.family.trim().toLowerCase() : '';
      const limit = Math.min(Math.max(Number(req.query.limit) || 500, 1), 2000);

      const executions = library.executions.filter((execution) => {
        if (category && category !== 'all' && !execution.categories.some((item) => item.toLowerCase() === category)) {
          return false;
        }
        if (family && family !== 'all' && execution.family !== family) {
          return false;
        }
        if (!query) return true;
        const haystack = [execution.label, execution.nodeType, execution.family, ...execution.categories, ...execution.aliases]
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      });

      return res.json({
        ok: true,
        source: library.source,
        imported: library.imported,
        vendorPath: library.vendorPath,
        manifest: library.manifest,
        categories: library.categories,
        total: library.count,
        count: executions.length,
        executions: executions.slice(0, limit),
      });
    } catch (error) {
      console.error('[WorkflowLibrary] Failed to build execution library:', error);
      return res.status(500).json({
        ok: false,
        code: 'workflow_library_unavailable',
        message: error instanceof Error ? error.message : 'Failed to build workflow execution library',
      });
    }
  });

  app.get('/api/workflow-library/executions/:id', (req, res) => {
    try {
      const library = buildN8nExecutionLibrary();
      const id = decodeURIComponent(req.params.id || '');
      const execution =
        library.executions.find((item) => item.id === id || item.nodeType === id) ??
        library.executions.find((item) => item.id === `n8n:${id}`);

      if (!execution) {
        return res.status(404).json({
          ok: false,
          code: 'execution_not_found',
          message: `Workflow execution '${id}' was not found.`,
        });
      }

      return res.json({ ok: true, execution });
    } catch (error) {
      console.error('[WorkflowLibrary] Failed to read execution:', error);
      return res.status(500).json({
        ok: false,
        code: 'workflow_library_unavailable',
        message: error instanceof Error ? error.message : 'Failed to read workflow execution',
      });
    }
  });

  app.get('/api/creative/import/jaaz/auth/status', async (_req, res) => {
    try {
      const auth = await resolveCreativeJaazAuthToken();
      const config = resolveCreativeJaazConfig();
      const baseUrl = resolveCreativeJaazHttpBaseUrl(config.apiUrl);
      return res.json({
        authenticated: Boolean(auth.token),
        source: auth.source,
        user: auth.user || null,
        updatedAt: auth.updatedAt || null,
        baseUrl,
      });
    } catch (error) {
      console.error('[Creative] Failed to read Jaaz import auth status:', error);
      return res.status(500).json({ error: 'Failed to resolve Jaaz import auth status' });
    }
  });

  app.post('/api/creative/import/jaaz/auth/start', async (_req, res) => {
    try {
      const config = resolveCreativeJaazConfig();
      const baseUrl = resolveCreativeJaazHttpBaseUrl(config.apiUrl);
      const response = await requestJaazHttpApi({
        baseUrl,
        route: '/api/device/auth',
        method: 'POST',
        requireAuth: false,
      });

      const payload = response.json && typeof response.json === 'object' ? response.json : {};
      const code = typeof payload.code === 'string' ? payload.code.trim() : '';
      const authUrl = code ? `${baseUrl}/auth/device?code=${encodeURIComponent(code)}` : null;

      return res.json({
        ...payload,
        authUrl,
      });
    } catch (error) {
      console.error('[Creative] Failed to start Jaaz import auth:', error);
      return res.status(502).json({
        error: error instanceof Error ? error.message : 'Failed to start Jaaz import auth',
      });
    }
  });

  app.get('/api/creative/import/jaaz/auth/poll', async (req, res) => {
    const code = normalizeOptionalString(req.query?.code);
    if (!code) {
      return res.status(400).json({ error: 'code is required' });
    }

    try {
      const config = resolveCreativeJaazConfig();
      const baseUrl = resolveCreativeJaazHttpBaseUrl(config.apiUrl);
      const response = await requestJaazHttpApi({
        baseUrl,
        route: `/api/device/poll?code=${encodeURIComponent(code)}`,
        method: 'GET',
        requireAuth: false,
      });
      const payload = response.json && typeof response.json === 'object' ? response.json : {};
      const status = typeof payload.status === 'string' ? payload.status : '';
      const token = typeof payload.token === 'string' ? payload.token.trim() : '';

      if (status === 'authorized' && token.length > 0) {
        await writeJaazAuthToDisk({
          token,
          user: payload.user_info && typeof payload.user_info === 'object' ? payload.user_info : null,
        });
      }

      const sanitized = { ...payload };
      delete sanitized.token;

      return res.json({
        ...sanitized,
        authenticated: status === 'authorized' && token.length > 0,
      });
    } catch (error) {
      console.error('[Creative] Failed polling Jaaz import auth:', error);
      return res.status(502).json({
        error: error instanceof Error ? error.message : 'Failed to poll Jaaz import auth',
      });
    }
  });

  app.post('/api/creative/import/jaaz/auth/logout', async (_req, res) => {
    await clearJaazAuthFromDisk();
    return res.json({ ok: true });
  });

  app.post('/api/creative/import/jaaz/copilot/chat', async (req, res) => {
    const prompt = normalizeOptionalString(req.body?.prompt);
    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const auth = await resolveCreativeJaazAuthToken();
    if (!auth.token) {
      return res.status(401).json({
        error: 'Jaaz import auth required. Authenticate the Jaaz import adapter first.',
      });
    }

    const config = resolveCreativeJaazConfig();
    const baseUrl = resolveCreativeJaazHttpBaseUrl(config.apiUrl);
    const sessionId = normalizeOptionalString(req.body?.sessionId) || `oc-jaaz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const canvasId = normalizeOptionalString(req.body?.canvasId) || sessionId;
    const model = normalizeOptionalString(req.body?.model) || 'gpt-4o';
    const systemPrompt = normalizeOptionalString(req.body?.systemPrompt) || null;
    const priorMessages = normalizeJaazCopilotMessages(req.body?.messages);
    const messages = [...priorMessages, { role: 'user', content: prompt }].slice(-20);

    const payload = {
      messages,
      session_id: sessionId,
      canvas_id: canvasId,
      text_model: {
        provider: 'jaaz',
        model,
        url: `${baseUrl}/api/v1`,
        type: 'text',
      },
      tool_list: [],
      system_prompt: systemPrompt,
    };

    try {
      await requestJaazHttpApi({
        baseUrl,
        route: '/api/chat',
        method: 'POST',
        payload,
        token: auth.token,
        requireAuth: true,
      });

      const polled = await pollJaazCopilotSession({
        baseUrl,
        token: auth.token,
        sessionId,
      });

      return res.json({
        ok: true,
        source: 'jaaz-copilot',
        sessionId,
        canvasId,
        model,
        status: polled.status,
        assistantText: polled.assistantText || '',
        assistantMessage: polled.assistant || null,
        mediaOutputs: polled.mediaOutputs || [],
        messageCount: Array.isArray(polled.messages) ? polled.messages.length : 0,
      });
    } catch (error) {
      console.error('[Creative] Jaaz import copilot chat failed:', error);
      return res.status(502).json({
        error: error instanceof Error ? error.message : 'Failed to run Jaaz import copilot chat',
        source: 'jaaz-copilot',
      });
    }
  });

  app.post('/api/creative/import/jaaz/generate', async (req, res) => {
    const prompt = normalizeOptionalString(req.body?.prompt);
    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const mode = normalizeCreativeMode(req.body?.mode);
    const config = resolveCreativeJaazConfig();
    const auth = await resolveCreativeJaazAuthToken();
    if (!config.apiUrl || !auth.token) {
      return res.status(503).json({
        error:
          'Jaaz import backend is not configured or authenticated. Authenticate the Jaaz import adapter or set OPENCHAMBER_JAAZ_API_KEY.',
        configured: {
          apiUrl: Boolean(config.apiUrl),
          token: Boolean(auth.token),
        },
      });
    }

    const aspectRatio = normalizeCreativeAspectRatio(req.body?.aspectRatio, mode);
    const quantity = normalizeCreativeQuantity(req.body?.quantity);
    const inputImages = normalizeCreativeInputImages(req.body);

    try {
      if (mode === 'image') {
        const model = normalizeOptionalString(req.body?.model) || 'black-forest-labs/flux-kontext-pro';
        const payload = {
          prompt,
          model,
          aspect_ratio: aspectRatio,
          n: quantity,
        };

        if (inputImages.length > 0) {
          payload.input_images = inputImages;
        }

        const initial = await requestJaazApi({
          apiUrl: config.apiUrl,
          apiKey: auth.token,
          route: '/image/generations',
          method: 'POST',
          payload,
        });

        let taskId = extractJaazTaskId(initial.json);
        let finalStatus = extractJaazTaskStatus(initial.json) || 'submitted';
        let urls = extractJaazMediaUrls(initial.json);

        if (urls.length === 0 && taskId) {
          const taskResult = await waitForJaazTaskCompletion(config, taskId);
          finalStatus = taskResult.status || finalStatus;
          urls = extractJaazMediaUrls(taskResult.json);
        }

        if (urls.length === 0) {
          throw new Error('JAAZ image generation completed without any media URL');
        }

        const outputs = urls.slice(0, Math.max(1, quantity)).map((url, index) => ({
          id: `jaaz-image-${Date.now()}-${index}`,
          kind: 'image',
          url,
          mimeType: url.startsWith('data:image/') ? 'image/png' : 'image/*',
          taskId: taskId || null,
          model,
        }));

        return res.json({
          ok: true,
          provider: 'jaaz',
          mode: 'image',
          model,
          taskId: taskId || null,
          status: finalStatus,
          outputs,
          meta: {
            prompt,
            aspectRatio,
            quantity,
            connectedVia: 'kronoschamber',
          },
        });
      }

      const model = normalizeOptionalString(req.body?.model) || 'seedance-1.0-pro';
      const resolution = normalizeOptionalString(req.body?.resolution) || '480p';
      const duration = normalizeCreativeDuration(req.body?.duration);
      const engine = normalizeOptionalString(req.body?.engine)?.toLowerCase();
      const useSeedanceEndpoint = engine === 'seedance' || model.toLowerCase().includes('seedance');
      const route = useSeedanceEndpoint ? '/video/seedance/generation' : '/video/sunra/generations';
      const payload = {
        prompt,
        model,
        resolution,
        duration,
        aspect_ratio: aspectRatio,
      };

      if (!useSeedanceEndpoint) {
        payload.camera_fixed = req.body?.cameraFixed !== false;
      }

      if (inputImages.length > 0) {
        payload.input_images = inputImages.slice(0, 1);
      }

      const initial = await requestJaazApi({
        apiUrl: config.apiUrl,
        apiKey: auth.token,
        route,
        method: 'POST',
        payload,
      });

      let taskId = extractJaazTaskId(initial.json);
      let finalStatus = extractJaazTaskStatus(initial.json) || 'submitted';
      let urls = extractJaazMediaUrls(initial.json);

      if (urls.length === 0 && taskId) {
        const taskResult = await waitForJaazTaskCompletion(config, taskId);
        finalStatus = taskResult.status || finalStatus;
        urls = extractJaazMediaUrls(taskResult.json);
      }

      if (urls.length === 0) {
        throw new Error('JAAZ video generation completed without any media URL');
      }

      const outputs = urls.slice(0, 1).map((url, index) => ({
        id: `jaaz-video-${Date.now()}-${index}`,
        kind: 'video',
        url,
        mimeType: url.startsWith('data:video/') ? 'video/mp4' : 'video/mp4',
        taskId: taskId || null,
        model,
      }));

      return res.json({
        ok: true,
        provider: 'jaaz',
        mode: 'video',
        model,
        taskId: taskId || null,
        status: finalStatus,
        outputs,
        meta: {
          prompt,
          aspectRatio,
          resolution,
          duration,
          connectedVia: 'kronoschamber',
        },
      });
    } catch (error) {
      console.error('[Creative] Jaaz import generation failed:', error);
      return res.status(502).json({
        error: error instanceof Error ? error.message : 'Failed to generate creative output',
        provider: 'jaaz',
        mode,
      });
    }
  });

  const parsePushSubscribeBody = (body) => {
    if (!body || typeof body !== 'object') return null;
    const endpoint = body.endpoint;
    const keys = body.keys;
    const p256dh = keys?.p256dh;
    const auth = keys?.auth;

    if (typeof endpoint !== 'string' || endpoint.trim().length === 0) return null;
    if (typeof p256dh !== 'string' || p256dh.trim().length === 0) return null;
    if (typeof auth !== 'string' || auth.trim().length === 0) return null;

    return {
      endpoint: endpoint.trim(),
      keys: { p256dh: p256dh.trim(), auth: auth.trim() },
    };
  };

  const parsePushUnsubscribeBody = (body) => {
    if (!body || typeof body !== 'object') return null;
    const endpoint = body.endpoint;
    if (typeof endpoint !== 'string' || endpoint.trim().length === 0) return null;
    return { endpoint: endpoint.trim() };
  };

  app.get('/api/push/vapid-public-key', async (req, res) => {
    try {
      await ensurePushInitialized();
      const keys = await getOrCreateVapidKeys();
      res.json({ publicKey: keys.publicKey });
    } catch (error) {
      console.warn('[Push] Failed to load VAPID key:', error);
      res.status(500).json({ error: 'Failed to load push key' });
    }
  });

  app.post('/api/push/subscribe', async (req, res) => {
    await ensurePushInitialized();

    const uiToken = uiAuthController?.ensureSessionToken
      ? uiAuthController.ensureSessionToken(req, res)
      : getUiSessionTokenFromRequest(req);
    if (!uiToken) {
      return res.status(401).json({ error: 'UI session missing' });
    }

    const parsed = parsePushSubscribeBody(req.body);
    if (!parsed) {
      return res.status(400).json({ error: 'Invalid body' });
    }

    const { endpoint, keys } = parsed;

    const origin = typeof req.body?.origin === 'string' ? req.body.origin.trim() : '';
    if (origin.startsWith('http://') || origin.startsWith('https://')) {
      try {
        const settings = await readSettingsFromDiskMigrated();
        if (typeof settings?.publicOrigin !== 'string' || settings.publicOrigin.trim().length === 0) {
          await writeSettingsToDisk({
            ...settings,
            publicOrigin: origin,
          });
          // allow next sends to pick it up
          pushInitialized = false;
        }
      } catch {
        // ignore
      }
    }

    await addOrUpdatePushSubscription(
      uiToken,
      {
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      req.headers['user-agent'],
    );

    res.json({ ok: true });
  });

  app.delete('/api/push/subscribe', async (req, res) => {
    await ensurePushInitialized();

    const uiToken = uiAuthController?.ensureSessionToken
      ? uiAuthController.ensureSessionToken(req, res)
      : getUiSessionTokenFromRequest(req);
    if (!uiToken) {
      return res.status(401).json({ error: 'UI session missing' });
    }

    const parsed = parsePushUnsubscribeBody(req.body);
    if (!parsed) {
      return res.status(400).json({ error: 'Invalid body' });
    }

    await removePushSubscription(uiToken, parsed.endpoint);
    res.json({ ok: true });
  });

  app.post('/api/push/visibility', (req, res) => {
    const uiToken = uiAuthController?.ensureSessionToken
      ? uiAuthController.ensureSessionToken(req, res)
      : getUiSessionTokenFromRequest(req);
    if (!uiToken) {
      return res.status(401).json({ error: 'UI session missing' });
    }

    const visible = req.body && typeof req.body === 'object' ? req.body.visible : null;
    const identity = resolveRequestClientIdentity(req);
    updateUiVisibility(uiToken, visible === true, identity);
    res.json({ ok: true });
  });

  app.get('/api/push/visibility', (req, res) => {
    const uiToken = getUiSessionTokenFromRequest(req);
    if (!uiToken) {
      return res.status(401).json({ error: 'UI session missing' });
    }

    res.json({
      ok: true,
      visible: isUiVisible(uiToken),
    });
  });

  // Session activity status endpoint - returns tracked activity phases for all sessions
  // Used by UI on visibility restore to get accurate status without waiting for SSE
  app.get('/api/session-activity', (_req, res) => {
    res.json(getSessionActivitySnapshot());
  });

  app.get('/api/interconnect/state', (_req, res) => {
    const serverTime = Date.now();
    const health = {
      status: 'ok',
      openCodePort: openCodePort,
      openCodeRunning: Boolean(openCodePort && isOpenCodeReady && !isRestartingOpenCode),
      openCodeSecureConnection: isOpenCodeConnectionSecure(),
      openCodeAuthSource: openCodeAuthSource || null,
      isOpenCodeReady,
      lastOpenCodeError,
    };

    res.json({
      status: {
        state: health.isOpenCodeReady ? 'healthy' : 'degraded',
        reason: typeof lastOpenCodeError === 'string' && lastOpenCodeError.length > 0 ? lastOpenCodeError : null,
        host: openCodePort ? ENV_CONFIGURED_OPENCODE_URL || `http://127.0.0.1:${openCodePort}` : null,
        retryCount: 0,
        relayMode: 'direct-sse',
        lastEventAt: serverTime,
      },
      health,
      statusSessions: getSessionStateSnapshot(),
      attentionSessions: getSessionAttentionSnapshot(),
      activitySessions: getSessionActivitySnapshot(),
      serverTime,
    });
  });

  app.get('/api/analytics/kpi', async (_req, res) => {
    try {
      const snapshot = await readRetentionAnalyticsConsistent();
      const metrics = buildRetentionKpi(snapshot, Date.now());
      res.json(metrics);
    } catch (error) {
      console.error('[Analytics] Failed to build KPI snapshot:', error);
      res.status(500).json({ error: 'Failed to build analytics KPI snapshot' });
    }
  });

  // Voice token endpoint - returns OpenAI TTS availability status
  app.post('/api/voice/token', async (req, res) => {
    console.log('[Voice] Token request received:', { body: req.body, headers: req.headers['content-type'] });
    try {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      console.log('[Voice] OpenAI API Key present:', !!openaiApiKey);

      if (!openaiApiKey) {
        return res.status(503).json({
          allowed: false,
          error: 'OpenAI voice service not configured. Set OPENAI_API_KEY environment variable.',
        });
      }

      // Return success - OpenAI TTS is available
      res.json({
        allowed: true,
        provider: 'openai',
        message: 'OpenAI TTS is available',
      });
    } catch (error) {
      console.error('[Voice] Token generation error:', error);
      res.status(500).json({
        allowed: false,
        error: 'Voice service error',
      });
    }
  });

  // Server-side TTS endpoint - streams audio from OpenAI TTS API
  app.post('/api/tts/speak', async (req, res) => {
    try {
      const {
        text,
        voice = 'nova',
        model = 'gpt-4o-mini-tts',
        speed = 0.9,
        instructions,
        summarize = false,
        providerId,
        modelId,
        threshold = 200,
        maxLength = 500,
        apiKey,
      } = req.body || {};

      console.log('[TTS] Request received:', { voice, model, speed, textLength: text?.length, hasApiKey: !!apiKey });

      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'Text is required' });
      }

      // Dynamically import the TTS service (ESM)
      const { ttsService } = await import('./lib/tts-service.js');

      // Check availability - either server-configured or client-provided API key
      const hasServerKey = ttsService.isAvailable();
      const hasClientKey = apiKey && typeof apiKey === 'string' && apiKey.trim().length > 0;

      if (!hasServerKey && !hasClientKey) {
        return res.status(503).json({
          error: 'TTS service not available. Please configure OpenAI in OpenCode or provide an API key in settings.',
        });
      }

      let textToSpeak = text.trim();

      // Optionally summarize long text before speaking using zen API
      if (summarize && textToSpeak.length > threshold) {
        try {
          const { summarizeText } = await import('./lib/summarization-service.js');
          const speakZenModel = await resolveZenModel(typeof req.body?.zenModel === 'string' ? req.body.zenModel : undefined);
          const result = await summarizeText({ text: textToSpeak, threshold, maxLength, zenModel: speakZenModel });

          if (result.summarized && result.summary) {
            textToSpeak = result.summary;
          }
        } catch (summarizeError) {
          console.error('[TTS/speak] Summarization failed:', summarizeError);
          // Continue with original text if summarization fails
        }
      }

      const result = await ttsService.generateSpeechStream({
        text: textToSpeak,
        voice,
        model,
        speed,
        instructions,
        apiKey: hasClientKey ? apiKey.trim() : undefined,
      });

      // Set headers for audio streaming
      // Note: Don't set Transfer-Encoding manually - Express handles it automatically
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Cache-Control', 'no-cache');

      // Collect the full audio buffer and send it
      // This avoids chunked encoding issues with proxies
      const reader = result.stream.getReader();
      const chunks = [];

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(Buffer.from(value));
        }
        const audioBuffer = Buffer.concat(chunks);
        res.setHeader('Content-Length', audioBuffer.length);
        res.send(audioBuffer);
      } catch (streamError) {
        console.error('[TTS] Stream error:', streamError);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Stream error' });
        } else {
          res.end();
        }
      }
    } catch (error) {
      console.error('[TTS] Error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: error instanceof Error ? error.message : 'TTS generation failed',
        });
      }
    }
  });

  // Import summarization service
  const { summarizeText, sanitizeForTTS } = await import('./lib/summarization-service.js');

  app.post('/api/tts/summarize', async (req, res) => {
    try {
      const { text, threshold = 200, maxLength = 500 } = req.body || {};

      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'Text is required' });
      }

      const sumZenModel = await resolveZenModel(typeof req.body?.zenModel === 'string' ? req.body.zenModel : undefined);
      const result = await summarizeText({ text, threshold, maxLength, zenModel: sumZenModel });

      return res.json(result);
    } catch (error) {
      console.error('[Summarize] Error:', error);
      const sanitized = sanitizeForTTS(req.body?.text || '');
      return res.json({ summary: sanitized, summarized: false, reason: error.message });
    }
  });

  // TTS status endpoint
  app.get('/api/tts/status', async (_req, res) => {
    try {
      const { ttsService } = await import('./lib/tts-service.js');
      res.json({
        available: ttsService.isAvailable(),
        voices: ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse', 'marin', 'cedar'],
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to check TTS status' });
    }
  });

  // macOS 'say' command TTS status endpoint - returns cached capability from startup
  app.get('/api/tts/say/status', (_req, res) => {
    res.json(sayTTSCapability);
  });

  // macOS 'say' command TTS speak endpoint
  app.post('/api/tts/say/speak', async (req, res) => {
    try {
      const { text, voice = 'Samantha', rate = 200 } = req.body || {};

      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'Text is required' });
      }

      // Check if we're on macOS
      if (process.platform !== 'darwin') {
        return res.status(503).json({ error: 'macOS say command not available on this platform' });
      }

      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const fs = await import('fs');
      const os = await import('os');
      const path = await import('path');
      const execAsync = promisify(exec);

      // Create temp file for audio output (use m4a for browser compatibility)
      const tempDir = os.tmpdir();
      const tempFile = path.join(tempDir, `say-${Date.now()}.m4a`);

      // Escape text for shell - escape both single quotes and double quotes
      const escapedText = text.trim().replace(/'/g, "'\\''").replace(/"/g, '\\"');

      // Generate audio file using 'say' command
      // -o outputs to file, -r sets rate (words per minute)
      // --data-format=aac outputs as m4a which browsers can decode
      const cmd = `say -v "${voice}" -r ${rate} -o "${tempFile}" --data-format=aac '${escapedText}'`;
      console.log('[TTS-Say] Generating speech:', { textLength: text.length, voice, rate });

      await execAsync(cmd);

      // Read the generated audio file
      const audioBuffer = await fs.promises.readFile(tempFile);

      // Clean up temp file
      fs.promises.unlink(tempFile).catch(() => {});

      // Send audio response
      res.setHeader('Content-Type', 'audio/mp4');
      res.setHeader('Content-Length', audioBuffer.length);
      res.send(audioBuffer);
    } catch (error) {
      console.error('[TTS-Say] Error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Say command failed',
      });
    }
  });

  // New authoritative session status endpoints
  // Server maintains the source of truth, clients only query

  // GET /api/sessions/snapshot - Combined status + attention snapshot
  app.get('/api/sessions/snapshot', (_req, res) => {
    res.json({
      statusSessions: getSessionStateSnapshot(),
      attentionSessions: getSessionAttentionSnapshot(),
      serverTime: Date.now(),
    });
  });

  // GET /api/sessions/status - Get status for all sessions
  app.get('/api/sessions/status', (_req, res) => {
    const snapshot = getSessionStateSnapshot();
    res.json({
      sessions: snapshot,
      serverTime: Date.now(),
    });
  });

  // GET /api/sessions/:id/status - Get status for a specific session
  app.get('/api/sessions/:id/status', (req, res) => {
    const sessionId = req.params.id;
    const state = getSessionState(sessionId);

    if (!state) {
      return res.status(404).json({
        error: 'Session not found or no state available',
        sessionId,
      });
    }

    res.json({
      sessionId,
      ...state,
    });
  });

  // GET /api/marketplace/integrations - Get all marketplace integrations
  app.get('/api/marketplace/integrations', async (req, res) => {
    try {
      const query = req.query.q;
      const integrations = query ? await searchMcpMarketplace(query) : await getMcpMarketplaceIntegrations();
      res.json({ integrations });
    } catch (error) {
      console.error('[Marketplace API] Failed to get integrations:', error);
      res.status(500).json({ error: 'Failed to load marketplace integrations' });
    }
  });

  // GET /api/marketplace/integrations/:id - Get a specific integration
  app.get('/api/marketplace/integrations/:id', async (req, res) => {
    try {
      const integration = await getMcpMarketplaceIntegration(req.params.id);
      if (!integration) {
        return res.status(404).json({ error: 'Integration not found' });
      }
      res.json({ integration });
    } catch (error) {
      console.error('[Marketplace API] Failed to get integration:', error);
      res.status(500).json({ error: 'Failed to load integration' });
    }
  });

  // Session attention tracking endpoints
  // GET /api/sessions/attention - Get attention state for all sessions
  app.get('/api/sessions/attention', (_req, res) => {
    const snapshot = getSessionAttentionSnapshot();
    res.json({
      sessions: snapshot,
      serverTime: Date.now(),
    });
  });

  // GET /api/sessions/:id/attention - Get attention state for a specific session
  app.get('/api/sessions/:id/attention', (req, res) => {
    const sessionId = req.params.id;
    const state = getSessionAttentionState(sessionId);

    if (!state) {
      return res.status(404).json({
        error: 'Session not found or no attention state available',
        sessionId,
      });
    }

    res.json({
      sessionId,
      ...state,
    });
  });

  // POST /api/sessions/:id/view - Client reports viewing this session
  app.post('/api/sessions/:id/view', (req, res) => {
    const sessionId = req.params.id;
    const identity = resolveRequestClientIdentity(req);

    markSessionViewed(sessionId, identity.key);

    res.json({
      success: true,
      sessionId,
      viewed: true,
      clientId: identity.clientId,
      windowId: identity.windowId,
    });
  });

  // POST /api/sessions/:id/unview - Client reports leaving this session
  app.post('/api/sessions/:id/unview', (req, res) => {
    const sessionId = req.params.id;
    const identity = resolveRequestClientIdentity(req);

    markSessionUnviewed(sessionId, identity.key);

    res.json({
      success: true,
      sessionId,
      viewed: false,
      clientId: identity.clientId,
      windowId: identity.windowId,
    });
  });

  // POST /api/sessions/:id/message-sent - User sent a message in this session
  app.post('/api/sessions/:id/message-sent', (req, res) => {
    const sessionId = req.params.id;
    const identity = resolveRequestClientIdentity(req);

    markUserMessageSent(sessionId, identity.key);
    void trackRetentionUserMessageSent(req, sessionId);

    res.json({
      success: true,
      sessionId,
      messageSent: true,
      clientId: identity.clientId,
      windowId: identity.windowId,
    });
  });

  app.get('/api/openchamber/update-check', async (_req, res) => {
    try {
      const { checkForUpdates } = await import('./lib/package-manager.js');
      const updateInfo = await checkForUpdates();
      res.json(updateInfo);
    } catch (error) {
      console.error('Failed to check for updates:', error);
      res.status(500).json({
        available: false,
        error: error instanceof Error ? error.message : 'Failed to check for updates',
      });
    }
  });

  app.post('/api/openchamber/update-install', async (_req, res) => {
    try {
      const { spawn: spawnChild } = await import('child_process');
      const { checkForUpdates, getUpdateCommand, detectPackageManager } = await import('./lib/package-manager.js');

      // Verify update is available
      const updateInfo = await checkForUpdates();
      if (!updateInfo.available) {
        return res.status(400).json({ error: 'No update available' });
      }

      const pm = detectPackageManager();
      const updateCmd = getUpdateCommand(pm);

      // Get current server port for restart
      const currentPort = server.address()?.port || 3000;

      // Try to read stored instance options for restart
      const tmpDir = os.tmpdir();
      const instanceFilePath = path.join(tmpDir, `openchamber-${currentPort}.json`);
      let storedOptions = { port: currentPort, daemon: true };
      try {
        const content = await fs.promises.readFile(instanceFilePath, 'utf8');
        storedOptions = JSON.parse(content);
      } catch {
        // Use defaults
      }

      const isWindows = process.platform === 'win32';

      // Build restart command with stored options
      let restartCmd = `openchamber serve --port ${storedOptions.port} --daemon`;
      if (storedOptions.uiPassword) {
        if (isWindows) {
          // Escape for cmd.exe quoted argument
          const escapedPw = storedOptions.uiPassword.replace(/"/g, '""');
          restartCmd += ` --ui-password "${escapedPw}"`;
        } else {
          // Escape for POSIX single-quoted argument
          const escapedPw = storedOptions.uiPassword.replace(/'/g, "'\\''");
          restartCmd += ` --ui-password '${escapedPw}'`;
        }
      }

      // Respond immediately - update will happen after response
      res.json({
        success: true,
        message: 'Update starting, server will restart shortly',
        version: updateInfo.version,
        packageManager: pm,
      });

      // Give time for response to be sent
      setTimeout(() => {
        console.log(`\nInstalling update using ${pm}...`);
        console.log(`Running: ${updateCmd}`);

        // Create a script that will:
        // 1. Wait for current process to exit
        // 2. Run the update
        // 3. Restart the server with original options
        const shell = isWindows ? process.env.ComSpec || 'cmd.exe' : 'sh';
        const shellFlag = isWindows ? '/c' : '-c';
        const script = isWindows
          ? `
            timeout /t 2 /nobreak >nul
            ${updateCmd}
            if %ERRORLEVEL% EQU 0 (
              echo Update successful, restarting KronosChamber...
              ${restartCmd}
            ) else (
              echo Update failed
              exit /b 1
            )
          `
          : `
            sleep 2
            ${updateCmd}
            if [ $? -eq 0 ]; then
              echo "Update successful, restarting KronosChamber..."
              ${restartCmd}
            else
              echo "Update failed"
              exit 1
            fi
          `;

        // Spawn detached shell to run update after we exit
        const child = spawnChild(shell, [shellFlag, script], {
          detached: true,
          stdio: 'ignore',
          env: process.env,
        });
        child.unref();

        console.log('Update process spawned, shutting down server...');

        // Give child process time to start, then exit
        setTimeout(() => {
          process.exit(0);
        }, 500);
      }, 500);
    } catch (error) {
      console.error('Failed to install update:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to install update',
      });
    }
  });

  const sendModelsMetadataResponse = (res, options) => {
    const { metadata, source, freshness, stale, maxAge = 60, ageMs = 0 } = options;
    const resolvedAgeMs = Number.isFinite(ageMs) && ageMs > 0 ? Number(ageMs) : 0;

    res.setHeader('Cache-Control', `public, max-age=${Math.max(0, Math.round(maxAge))}`);
    res.setHeader(MODELS_METADATA_SOURCE_HEADER, source);
    res.setHeader(MODELS_METADATA_FRESHNESS_HEADER, freshness);
    res.setHeader(MODELS_METADATA_STALE_HEADER, stale ? '1' : '0');
    res.setHeader(MODELS_METADATA_AGE_HEADER, String(Math.max(0, Math.round(resolvedAgeMs / 1000))));
    return res.json(metadata);
  };

  app.get('/api/openchamber/models-metadata', async (_req, res) => {
    const now = Date.now();
    const cachedAgeMs = cachedModelsMetadataTimestamp > 0 ? now - cachedModelsMetadataTimestamp : 0;

    if (cachedModelsMetadata && cachedAgeMs < MODELS_METADATA_CACHE_TTL) {
      return sendModelsMetadataResponse(res, {
        metadata: cachedModelsMetadata,
        source: 'cache',
        freshness: 'fresh',
        stale: false,
        maxAge: 60,
        ageMs: cachedAgeMs,
      });
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), 8000) : null;

    try {
      const response = await fetch(MODELS_DEV_API_URL, {
        signal: controller?.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`models.dev responded with status ${response.status}`);
      }

      const metadata = await response.json();
      cachedModelsMetadata = metadata;
      cachedModelsMetadataTimestamp = Date.now();

      return sendModelsMetadataResponse(res, {
        metadata,
        source: 'upstream',
        freshness: 'fresh',
        stale: false,
        maxAge: 300,
        ageMs: 0,
      });
    } catch (error) {
      const now = Date.now();
      if (now - lastModelsMetadataFailureLogAt >= MODELS_METADATA_FAILURE_LOG_DEDUPE_MS) {
        lastModelsMetadataFailureLogAt = now;
        console.warn('Failed to fetch models.dev metadata via server:', error);
      }

      if (cachedModelsMetadata) {
        return sendModelsMetadataResponse(res, {
          metadata: cachedModelsMetadata,
          source: 'cache',
          freshness: 'stale',
          stale: true,
          maxAge: 60,
          ageMs: Date.now() - cachedModelsMetadataTimestamp,
        });
      }

      return sendModelsMetadataResponse(res, {
        metadata: MODELS_METADATA_FALLBACK,
        source: 'fallback',
        freshness: 'seed',
        stale: true,
        maxAge: 30,
        ageMs: 0,
      });
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  });

  // Zen models endpoint - returns available free models from the zen API
  app.get('/api/zen/models', async (_req, res) => {
    try {
      const models = await fetchFreeZenModels();
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.json({ models });
    } catch (error) {
      console.warn('Failed to fetch zen models:', error);
      // Serve stale cache if available
      if (cachedZenModels) {
        res.setHeader('Cache-Control', 'public, max-age=60');
        res.json(cachedZenModels);
      } else {
        const statusCode = error?.name === 'AbortError' ? 504 : 502;
        res.status(statusCode).json({ error: 'Failed to retrieve zen models' });
      }
    }
  });

  const proxyOpenCodeSse = async (req, res, options) => {
    const startedAt = Date.now();
    const scope = options?.scope === 'global' ? 'global' : 'session';
    let endedBy = 'upstream-finished';
    const sourceLabel = scope === 'global' ? '/global/event' : '/event';
    let connectTimer = null;
    let idleTimer = null;
    let heartbeatTimer = null;
    let upstreamReader = null;
    let addedUiClient = false;
    let lastEventAt = Date.now();
    let bytesReceived = 0;

    let targetUrl;
    try {
      targetUrl = new URL(buildOpenCodeUrl(sourceLabel, ''));
    } catch {
      return res.status(503).json({ error: 'OpenCode service unavailable' });
    }

    if (scope === 'session') {
      const headerDirectory = typeof req.get === 'function' ? req.get('x-opencode-directory') : null;
      const directoryParam = Array.isArray(req.query.directory) ? req.query.directory[0] : req.query.directory;
      const resolvedDirectory = headerDirectory || directoryParam || null;
      if (typeof resolvedDirectory === 'string' && resolvedDirectory.trim().length > 0) {
        targetUrl.searchParams.set('directory', resolvedDirectory.trim());
      }
    }

    const headers = {
      Accept: 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      ...getOpenCodeAuthHeaders(),
    };

    const lastEventId = req.header('Last-Event-ID');
    if (typeof lastEventId === 'string' && lastEventId.length > 0) {
      headers['Last-Event-ID'] = lastEventId;
    }

    const controller = new AbortController();
    const cleanupClient = () => {
      if (addedUiClient) {
        uiNotificationClients.delete(res);
        addedUiClient = false;
      }
    };
    const cleanup = () => {
      if (connectTimer) {
        clearTimeout(connectTimer);
        connectTimer = null;
      }
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      cleanupClient();
      req.off('close', onClientClose);
      req.off('error', onClientError);
    };
    const resetIdleTimeout = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
      }
      idleTimer = setTimeout(
        () => {
          endedBy = 'idle-timeout';
          controller.abort();
        },
        5 * 60 * 1000,
      );
    };
    const onClientClose = () => {
      endedBy = 'client-disconnect';
      controller.abort();
    };
    const onClientError = () => {
      endedBy = 'client-disconnect';
      controller.abort();
    };

    req.on('close', onClientClose);
    req.on('error', onClientError);

    const connectReason = req.headers['last-event-id'] ? 'reconnect-resume' : 'new-stream';
    console.log(`[sse] connect scope=${scope} reason=${connectReason} path=${sourceLabel}`);

    try {
      connectTimer = setTimeout(() => {
        endedBy = 'connect-timeout';
        controller.abort();
      }, 10 * 1000);

      const upstream = await fetch(targetUrl.toString(), {
        headers,
        signal: controller.signal,
      });

      if (connectTimer) {
        clearTimeout(connectTimer);
        connectTimer = null;
      }

      if (!upstream.ok || !upstream.body) {
        cleanup();
        return res.status(502).json({ error: `OpenCode event stream unavailable (${upstream.status})` });
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
      }

      if (scope === 'global' || scope === 'session') {
        uiNotificationClients.add(res);
        addedUiClient = true;
      }

      // Emit stream lifecycle event for client-side failover detection
      const lifecycleConnectEvent = {
        type: 'openchamber:stream-lifecycle',
        properties: {
          action: 'connect',
          reason: connectReason,
          scope: scope,
          timestamp: Date.now(),
        },
      };
      writeSseEvent(res, lifecycleConnectEvent);
      console.log(`[sse] lifecycle action=connect reason=${connectReason} scope=${scope}`);

      resetIdleTimeout();
      heartbeatTimer = setInterval(() => {
        if (res.writableEnded || controller.signal.aborted) {
          return;
        }
        const timeSinceLastEvent = Date.now() - lastEventAt;
        writeSseEvent(res, {
          type: 'openchamber:heartbeat',
          timestamp: Date.now(),
          properties: {
            scope: scope,
            timeSinceLastEventMs: timeSinceLastEvent,
            streamHealth: timeSinceLastEvent > 30_000 ? 'degraded' : 'healthy',
          },
        });
        resetIdleTimeout();
      }, 15_000);

      const decoder = new TextDecoder();
      upstreamReader = upstream.body.getReader();
      let buffer = '';

      const forwardBlock = (block) => {
        if (!block || res.writableEnded || controller.signal.aborted) return;
        res.write(`${block}\n\n`);
        lastEventAt = Date.now();
        bytesReceived += block.length;
        resetIdleTimeout();

        const payload = parseSseDataPayload(block);
        maybeCacheSessionInfoFromEvent(payload);

        if (payload && payload.type === 'session.status') {
          const update = extractSessionStatusUpdate(payload);
          if (update) {
            updateSessionState(update.sessionId, update.type, update.eventId || `proxy-${Date.now()}`, {
              attempt: update.attempt,
              message: update.message,
              next: update.next,
            });
          }
        }

        const transitions = deriveSessionActivityTransitions(payload);
        if (transitions && transitions.length > 0) {
          for (const activity of transitions) {
            if (setSessionActivityPhase(activity.sessionId, activity.phase)) {
              writeSseEvent(res, {
                type: 'openchamber:session-activity',
                properties: {
                  sessionId: activity.sessionId,
                  phase: activity.phase,
                },
              });
            }
          }
        }
      };

      while (true) {
        const { value, done } = await upstreamReader.read();
        if (done) {
          endedBy = endedBy === 'upstream-finished' ? 'upstream-finished' : endedBy;
          break;
        }
        if (controller.signal.aborted) {
          break;
        }
        if (!value || value.length === 0) {
          continue;
        }

        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
        let separatorIndex = buffer.indexOf('\n\n');
        while (separatorIndex !== -1) {
          const block = buffer.slice(0, separatorIndex);
          buffer = buffer.slice(separatorIndex + 2);
          forwardBlock(block);
          separatorIndex = buffer.indexOf('\n\n');
        }
      }

      if (buffer.trim().length > 0) {
        forwardBlock(buffer.trim());
      }

      cleanup();
      if (!res.writableEnded) {
        res.end();
      }
      const durationMs = Date.now() - startedAt;

      // Emit stream lifecycle close event
      try {
        const lifecycleCloseEvent = {
          type: 'openchamber:stream-lifecycle',
          properties: {
            action: 'close',
            reason: endedBy,
            scope: scope,
            duration: durationMs,
            bytesReceived: bytesReceived,
            timestamp: Date.now(),
          },
        };
        // Note: res may be ended, so we don't try to write this event
      } catch {
        // ignore
      }

      console.log(`[sse] close scope=${scope} reason=${endedBy} durationMs=${durationMs} bytesReceived=${bytesReceived}`);
    } catch (error) {
      const isAbort = error?.name === 'AbortError';
      if (endedBy === 'upstream-finished' && !isAbort) {
        endedBy = 'upstream-error';
      }
      cleanup();
      if (!res.headersSent) {
        res.status(502).json({ error: 'Failed to connect to OpenCode event stream' });
      } else if (!res.writableEnded) {
        try {
          res.end();
        } catch {
          // ignore
        }
      }
      const durationMs = Date.now() - startedAt;
      if (!isAbort) {
        console.warn(`[sse] error scope=${scope} reason=${endedBy} durationMs=${durationMs}:`, error);
      } else {
        console.log(`[sse] close scope=${scope} reason=${endedBy} durationMs=${durationMs}`);
      }
    } finally {
      try {
        upstreamReader?.releaseLock?.();
      } catch {
        // ignore
      }
    }
  };

  app.get(['/api/global/event', '/api/event'], async (req, res) => {
    const scope = req.path === '/api/global/event' ? 'global' : 'session';
    await proxyOpenCodeSse(req, res, { scope });
  });

  app.get('/api/config/settings', async (_req, res) => {
    try {
      const settings = await readSettingsFromDiskMigrated();
      res.json(formatSettingsResponse(settings));
    } catch (error) {
      console.error('Failed to load settings:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load settings' });
    }
  });

  app.get('/api/config/opencode-resolution', async (_req, res) => {
    try {
      const settings = await readSettingsFromDiskMigrated();
      const configured = typeof settings?.opencodeBinary === 'string' ? settings.opencodeBinary : null;
      const configuredAiBrowser = typeof settings?.aiBrowserEnabled === 'boolean' ? settings.aiBrowserEnabled : null;

      const previousSource = resolvedOpencodeBinarySource;
      const detectedNow = resolveOpencodeCliPath();
      const rawDetectedSourceNow = resolvedOpencodeBinarySource;
      resolvedOpencodeBinarySource = previousSource;

      // Best-effort: apply configured override (if any) and resolve.
      await applyOpencodeBinaryFromSettings();
      await applyAiBrowserSettingFromSettings();
      ensureOpencodeCliEnv();

      const resolved = resolvedOpencodeBinary || null;
      const source = resolvedOpencodeBinarySource || null;
      const detectedSourceNow =
        detectedNow && resolved && detectedNow === resolved && rawDetectedSourceNow === 'env' && source && source !== 'env'
          ? source
          : rawDetectedSourceNow;
      const shim = resolved ? opencodeShimInterpreter(resolved) : null;

      res.json({
        configured,
        configuredAiBrowser,
        aiBrowserEnabledEnv: process.env.KRONOSCODE_ENABLE_AI_BROWSER === 'true' || process.env.OPENCODE_ENABLE_AI_BROWSER === 'true',
        resolved,
        resolvedDir: resolved ? path.dirname(resolved) : null,
        source,
        detectedNow,
        detectedSourceNow,
        shim,
        node: resolvedNodeBinary || null,
        bun: resolvedBunBinary || null,
      });
    } catch (error) {
      console.error('Failed to build opencode resolution snapshot:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to build snapshot' });
    }
  });

  app.get('/api/config/themes', async (_req, res) => {
    try {
      const customThemes = await readCustomThemesFromDisk();
      res.json({ themes: customThemes });
    } catch (error) {
      console.error('Failed to load custom themes:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load custom themes' });
    }
  });

  app.put('/api/config/settings', async (req, res) => {
    if (VERBOSE_SETTINGS_LOGS) {
      console.log(`[API:PUT /api/config/settings] Received request`);
      console.log(`[API:PUT /api/config/settings] Request body:`, JSON.stringify(req.body, null, 2));
    }
    try {
      const payload = req.body ?? {};
      const cacheKey = JSON.stringify(sanitizeSettingsUpdate(payload));
      const now = Date.now();
      if (
        recentSettingsPayloadCache.response &&
        recentSettingsPayloadCache.key === cacheKey &&
        recentSettingsPayloadCache.expiresAt > now
      ) {
        if (VERBOSE_SETTINGS_LOGS) {
          console.log(`[API:PUT /api/config/settings] Returning cached response for repeated payload`);
        }
        return res.json(recentSettingsPayloadCache.response);
      }

      const updated = await persistSettings(payload);
      await applyOpencodeBinaryFromSettings();
      await applyAiBrowserSettingFromSettings();
      recentSettingsPayloadCache = {
        key: cacheKey,
        expiresAt: Date.now() + SETTINGS_PAYLOAD_CACHE_TTL_MS,
        response: updated,
      };
      if (VERBOSE_SETTINGS_LOGS) {
        console.log(`[API:PUT /api/config/settings] Success, returning ${updated.projects?.length || 0} projects`);
      }
      res.json(updated);
    } catch (error) {
      console.error(`[API:PUT /api/config/settings] Failed to save settings:`, error);
      if (VERBOSE_SETTINGS_LOGS && error instanceof Error && error.stack) {
        console.error(`[API:PUT /api/config/settings] Error stack:`, error.stack);
      }
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to save settings' });
    }
  });

  const summarizeProviderForAgentMode = (provider) => {
    if (!provider || typeof provider !== 'object') {
      return null;
    }
    const id = typeof provider.id === 'string' ? provider.id.trim() : '';
    if (!id) {
      return null;
    }
    const name = typeof provider.name === 'string' ? provider.name.trim() : '';
    const type = typeof provider.type === 'string' ? provider.type.trim() : '';
    return {
      id,
      name: name || id,
      type: type || null,
    };
  };

  const executeAgentModeTask = async (task) => {
    if (task.mode === 'native') {
      throw new Error('Native mode does not use background task runners. Use the native desktop control panel.');
    }

    const connector = resolveAgentModeConnectorConfig(task.mode);
    const payload = buildAgentModeTaskPayload(task);

    if (connector.apiUrl) {
      const result = await runAgentModeApiTask(connector.apiUrl, payload);
      return {
        connector: {
          mode: task.mode,
          kind: 'api',
          endpoint: connector.apiUrl,
        },
        result,
      };
    }

    if (!connector.command || connector.command.trim().length === 0) {
      throw new Error(`No ${task.mode} connector configured. Set API URL or runner command env var.`);
    }

    const result = await runAgentModeCommandTask(connector.command, payload);
    return {
      connector: {
        mode: task.mode,
        kind: 'command',
        command: connector.command,
      },
      result,
    };
  };

  const startAgentModeTask = async (task) => {
    task.status = 'running';
    task.startedAt = Date.now();
    task.updatedAt = task.startedAt;
    broadcastAgentModeTaskEvent(task, 'running');

    try {
      const execution = await executeAgentModeTask(task);
      const metadata = collectAgentModeRuntimeMetadata(execution.result);
      task.status = 'done';
      task.success = true;
      task.result = execution.result;
      task.connector = execution.connector;
      task.error = null;
      task.runtimeSessionID = metadata.runtimeSessionID;
      task.liveUrl = metadata.liveUrl;
      task.artifacts = metadata.artifacts;
      task.logs = metadata.logs;
    } catch (error) {
      task.status = 'done';
      task.success = false;
      task.error = error instanceof Error ? error.message : String(error || 'Task failed');
      task.result = null;
      task.liveUrl = null;
      task.runtimeSessionID = null;
      task.artifacts = [];
      task.logs = [
        ...(Array.isArray(task.logs) ? task.logs : []),
        ...(error instanceof Error && error.message ? [error.message] : []),
      ].slice(0, 120);
    } finally {
      task.finishedAt = Date.now();
      task.updatedAt = task.finishedAt;
      broadcastAgentModeTaskEvent(task, 'done');
      broadcastRuntimeArtifactEvent(task, 'done');
    }
  };

  app.get('/api/agent-mode/status', async (_req, res) => {
    try {
      pruneAgentModeTasks();
      const settings = await readSettingsFromDiskMigrated();
      const persistedMode = normalizeAgentModeSetting(settings?.agentMode);

      let providers = [];
      try {
        const snapshot = await fetchProvidersSnapshot();
        providers = snapshot.map(summarizeProviderForAgentMode).filter(Boolean);
      } catch {
        providers = [];
      }

      const tasks = Array.from(agentModeTasks.values());
      const runningTasks = tasks.filter((entry) => entry?.status === 'running').length;

      res.json({
        mode: persistedMode,
        availableModes: Array.from(AGENT_MODE_ALLOWED_VALUES),
        openCodeRunning: Boolean(openCodePort && isOpenCodeReady && !isRestartingOpenCode),
        openCodeSecureConnection: isOpenCodeConnectionSecure(),
        connectors: {
          sandbox: buildAgentModeConnectorStatus('sandbox'),
          native: buildAgentModeConnectorStatus('native'),
        },
        providers,
        tasks: {
          total: tasks.length,
          running: runningTasks,
        },
      });
    } catch (error) {
      console.error('Failed to load agent mode status:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load agent mode status' });
    }
  });

  app.put('/api/agent-mode', async (req, res) => {
    try {
      const rawMode = typeof req.body?.mode === 'string' ? req.body.mode.trim().toLowerCase() : '';
      if (!AGENT_MODE_ALLOWED_VALUES.has(rawMode)) {
        return res.status(400).json({ error: 'Invalid mode. Use off, sandbox, or native.' });
      }
      const mode = normalizeAgentModeSetting(rawMode);

      await persistSettings({ agentMode: mode });

      res.json({
        mode,
        connectors: {
          sandbox: buildAgentModeConnectorStatus('sandbox'),
          native: buildAgentModeConnectorStatus('native'),
        },
      });
    } catch (error) {
      console.error('Failed to update agent mode:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update agent mode' });
    }
  });

  app.post('/api/agent-mode/task', async (req, res) => {
    try {
      pruneAgentModeTasks();

      const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const settings = await readSettingsFromDiskMigrated();
      const persistedMode = normalizeAgentModeSetting(settings?.agentMode);
      const hasOverride = typeof req.body?.mode === 'string' && req.body.mode.trim().length > 0;
      if (hasOverride) {
        const rawOverride = req.body.mode.trim().toLowerCase();
        if (!AGENT_MODE_ALLOWED_VALUES.has(rawOverride)) {
          return res.status(400).json({
            error: 'Invalid mode override. Use sandbox or native.',
          });
        }
      }
      const requestedMode = hasOverride ? normalizeAgentModeSetting(req.body.mode) : persistedMode;

      if (!isSupportedAgentMode(requestedMode) || requestedMode === 'off') {
        return res.status(400).json({
          error: 'Desktop agent mode is off. Set mode to sandbox or native first.',
          mode: persistedMode,
        });
      }
      if (requestedMode === 'native') {
        return res.status(400).json({
          error: 'Native mode does not support background tasks. Use the native desktop control panel.',
          mode: persistedMode,
        });
      }

      const taskID = crypto.randomUUID();
      const task = {
        taskID,
        mode: requestedMode,
        prompt,
        status: 'queued',
        success: null,
        error: null,
        result: null,
        connector: null,
        runtimeSessionID: null,
        liveUrl: null,
        artifacts: [],
        logs: [],
        sessionID: normalizeOptionalString(req.body?.sessionID) || null,
        providerID: normalizeOptionalString(req.body?.providerID) || null,
        modelID: normalizeOptionalString(req.body?.modelID) || null,
        agentName: resolveDesktopAgentName(requestedMode, req.body?.agentName),
        createdAt: Date.now(),
        startedAt: null,
        finishedAt: null,
        updatedAt: Date.now(),
      };

      agentModeTasks.set(taskID, task);
      broadcastAgentModeTaskEvent(task, 'queued');

      const runInBackground = req.body?.background !== false;
      if (runInBackground) {
        void startAgentModeTask(task);
        return res.status(202).json({
          ...serializeAgentModeTask(task),
          status: 'running',
        });
      }

      await startAgentModeTask(task);
      return res.json(serializeAgentModeTask(task));
    } catch (error) {
      console.error('Failed to run desktop agent task:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to run desktop agent task' });
    }
  });

  const getAgentModeTasksList = (sessionID, modeFilter, limit = 40) => {
    pruneAgentModeTasks();
    return Array.from(agentModeTasks.values())
      .filter((task) => {
        if (!task || typeof task !== 'object') {
          return false;
        }
        if (sessionID && task.sessionID !== sessionID) {
          return false;
        }
        if (modeFilter && task.mode !== modeFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const updatedA = typeof a.updatedAt === 'number' ? a.updatedAt : 0;
        const updatedB = typeof b.updatedAt === 'number' ? b.updatedAt : 0;
        return updatedB - updatedA;
      })
      .slice(0, limit);
  };

  app.get('/api/agent-mode/tasks', (req, res) => {
    const sessionID = normalizeOptionalString(req.query?.sessionID);
    const modeFilter = normalizeOptionalString(req.query?.mode);
    const rawLimit = Number(req.query?.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(200, Math.max(1, Math.round(rawLimit))) : 40;

    const tasks = getAgentModeTasksList(sessionID, modeFilter, limit);
    res.json({ tasks: tasks.map(serializeAgentModeTask) });
  });

  app.get('/api/agent-mode/task/:taskID', (req, res) => {
    pruneAgentModeTasks();
    const taskID = typeof req.params?.taskID === 'string' ? req.params.taskID.trim() : '';
    if (!taskID) {
      return res.status(400).json({ error: 'Task id is required' });
    }

    const task = agentModeTasks.get(taskID);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(serializeAgentModeTask(task));
  });

  const normalizeRuntimeMode = (value) => {
    if (value === 'native') return 'native';
    if (value === 'sandbox' || value === 'off') return value;
    if (value === 'openbrowser') return 'sandbox';
    return 'off';
  };

  const isRuntimeTaskMode = (value) => value === 'sandbox';

  app.get('/api/runtime/status', async (_req, res) => {
    try {
      pruneAgentModeTasks();
      const settings = await readSettingsFromDiskMigrated();
      const persistedMode = normalizeAgentModeSetting(settings?.agentMode);

      let providers = [];
      try {
        const snapshot = await fetchProvidersSnapshot();
        providers = snapshot.map(summarizeProviderForAgentMode).filter(Boolean);
      } catch {
        providers = [];
      }

      const tasks = Array.from(agentModeTasks.values());
      const runningTasks = tasks.filter((entry) => entry?.status === 'running').length;
      const businessWorkspaceStatus = getBusinessWorkspaceStatus(nocobaseOrigin);
      const socialWorkspaceStatus = getSocialWorkspaceStatus(postizOrigin);
      const videoWorkspaceStatus = getVideoWorkspaceStatus(supoClipOrigin);
      const excalidrawMcpStatus = getUpstreamRepoStatus('excalidraw-mcp');
      const atsuraeStatus = getUpstreamRepoStatus('atsurae');
      const personalizationStatus = getUpstreamRepoStatus('personalizationmcp');
      const jaazUpstreamStatus = getUpstreamRepoStatus('jaaz');
      const postizUpstreamStatus = getUpstreamRepoStatus('postiz-app');
      const supoClipUpstreamStatus = getUpstreamRepoStatus('supoclip');

      res.json({
        mode: persistedMode,
        availableModes: Array.from(AGENT_MODE_ALLOWED_VALUES),
        timestamp: Date.now(),
        openCodeRunning: Boolean(openCodePort && isOpenCodeReady && !isRestartingOpenCode),
        openCodeSecureConnection: isOpenCodeConnectionSecure(),
        connectors: {
          sandbox: buildAgentModeConnectorStatus('sandbox'),
          native: buildAgentModeConnectorStatus('native'),
        },
        workspaces: {
          chat: { available: true },
          plan: { available: true },
          ops: businessWorkspaceStatus,
          social: socialWorkspaceStatus,
          video: videoWorkspaceStatus,
          runtime: { available: true, requiresDesktopRuntime: true, reason: 'Desktop runtime required' },
          browser: { available: true, requiresDesktopRuntime: true, reason: 'Desktop runtime required' },
          business: businessWorkspaceStatus,
          workflow: { available: true },
          canvas: {
            available: true,
            health: 'available',
            upstreamProxyConfigured: Boolean(jaazWorkspaceOrigin),
            reason: 'Native Chamber canvas workspace',
          },
          git: { available: true },
          diff: { available: true },
          terminal: { available: true },
          files: { available: true },
          marketplace: { available: true },
          'desktop-control': { available: true, requiresDesktopRuntime: true, reason: 'Desktop runtime required' },
        },
        streamHealth: {
          ready: isOpenCodeReady,
          restarting: isRestartingOpenCode,
          lastError: lastOpenCodeError,
        },
        providers,
        integrations: {
          business: businessWorkspaceStatus,
          social: {
            postiz: {
              ...socialWorkspaceStatus,
              upstream: postizUpstreamStatus,
            },
          },
          video: {
            supoclip: {
              ...videoWorkspaceStatus,
              upstream: supoClipUpstreamStatus,
            },
          },
          jaazImport: {
            available: Boolean(jaazWorkspaceOrigin),
            health: jaazWorkspaceOrigin ? 'available' : 'degraded',
            reason: jaazWorkspaceOrigin ? 'Jaaz import adapter proxy configured' : 'Optional Jaaz import adapter is not configured',
            upstream: jaazUpstreamStatus,
          },
          mcp: {
            excalidraw: excalidrawMcpStatus,
            atsurae: atsuraeStatus,
            personalization: personalizationStatus,
          },
        },
        tasks: {
          total: tasks.length,
          running: runningTasks,
        },
      });
    } catch (error) {
      console.error('Failed to load runtime status:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load runtime status' });
    }
  });

  const buildCapabilitiesSnapshot = async () => {
    pruneAgentModeTasks();
    const settings = await readSettingsFromDiskMigrated();
    const persistedMode = normalizeAgentModeSetting(settings?.agentMode);
    const sandboxConnector = buildAgentModeConnectorStatus('sandbox');
    const nativeConnector = buildAgentModeConnectorStatus('native');
    const businessWorkspaceStatus = getBusinessWorkspaceStatus(nocobaseOrigin);
    const socialWorkspaceStatus = getSocialWorkspaceStatus(postizOrigin);
    const videoWorkspaceStatus = getVideoWorkspaceStatus(supoClipOrigin);
    const jaazUpstreamStatus = getUpstreamRepoStatus('jaaz');
    const postizUpstreamStatus = getUpstreamRepoStatus('postiz-app');
    const supoClipUpstreamStatus = getUpstreamRepoStatus('supoclip');
    const excalidrawMcpStatus = getUpstreamRepoStatus('excalidraw-mcp');
    const atsuraeStatus = getUpstreamRepoStatus('atsurae');
    const personalizationStatus = getUpstreamRepoStatus('personalizationmcp');
    const diskEvidence = getDiskEvidence(REPO_ROOT_PATH);
    const diskStatus =
      diskEvidence.available === false
        ? 'degraded'
        : typeof diskEvidence.freeBytes === 'number' && diskEvidence.freeBytes < 5 * 1024 * 1024 * 1024
          ? 'degraded'
          : 'available';

    const openCodeAvailable = Boolean(openCodePort && isOpenCodeReady && !isRestartingOpenCode);
    const aiBrowserEnabled = process.env.KRONOSCODE_ENABLE_AI_BROWSER === 'true' || process.env.OPENCODE_ENABLE_AI_BROWSER === 'true';
    const tasks = Array.from(agentModeTasks.values());

    const capabilities = [
      buildCapabilityRecord({
        id: 'runtime.server',
        title: 'KronosChamber web runtime',
        surface: 'runtime',
        provider: 'kronoschamber-web',
        status: 'available',
        message: 'Local Chamber web runtime is serving API and UI routes.',
        routes: ['/health', '/api/runtime/status', '/api/capabilities'],
        actions: ['health', 'status', 'capabilities'],
        evidence: {
          port: activePort,
          healthUrl: `http://127.0.0.1:${activePort}/health`,
          mode: persistedMode,
        },
      }),
      buildCapabilityRecord({
        id: 'runtime.opencode',
        title: 'KronosCode engine relay',
        surface: 'runtime',
        provider: 'kronoscode',
        status: openCodeAvailable ? 'available' : 'degraded',
        message: openCodeAvailable ? 'KronosCode engine is connected and ready.' : lastOpenCodeError || 'KronosCode engine is not ready.',
        actions: ['chat', 'tool execution', 'event stream', 'session status'],
        routes: ['/api/event', '/api/sessions/status'],
        evidence: {
          openCodePort,
          isOpenCodeReady,
          isRestartingOpenCode,
          secureConnection: isOpenCodeConnectionSecure(),
          lastOpenCodeError,
        },
      }),
      buildCapabilityRecord({
        id: 'browser.desktop-native',
        title: 'Desktop browser bridge',
        surface: 'browser',
        provider: 'tauri-desktop',
        status: capabilityFromAvailability(nativeConnector.available, nativeConnector.health),
        message:
          nativeConnector.error ||
          nativeConnector.reason ||
          'Native desktop browser actions are available through Tauri when the desktop shell is running.',
        actions: ['navigate', 'new_page', 'select_page', 'back', 'forward', 'reload', 'snapshot', 'selection', 'evaluate'],
        routes: ['/api/desktop-browser/action', '/api/desktop-browser/result/:id'],
        evidence: {
          connector: nativeConnector,
          supportsSelection: nativeConnector.supportsSelection === true,
          supportsHighFidelityScreenshot: nativeConnector.supportsHighFidelityScreenshot === true,
        },
        setupAction: nativeConnector.available ? null : 'Run the Tauri desktop shell or use the runtime browser fallback.',
      }),
      buildCapabilityRecord({
        id: 'browser.desktop-screenshot',
        title: 'Desktop browser screenshot',
        surface: 'browser',
        provider: 'tauri-desktop',
        status: nativeConnector.supportsHighFidelityScreenshot ? 'available' : 'not_implemented',
        message: nativeConnector.supportsHighFidelityScreenshot
          ? 'High-fidelity desktop browser screenshots are supported by the active desktop backend.'
          : 'Embedded Tauri webview screenshots currently return a typed not_implemented result instead of fake image data.',
        actions: ['screenshot'],
        routes: ['/api/desktop-browser/action'],
        evidence: {
          supportsHighFidelityScreenshot: nativeConnector.supportsHighFidelityScreenshot === true,
          backend: nativeConnector.backend || null,
        },
        setupAction: nativeConnector.supportsHighFidelityScreenshot
          ? null
          : 'Use sandbox screenshots or implement a platform-specific Tauri capture provider.',
      }),
      buildCapabilityRecord({
        id: 'browser.kronoscode-relay',
        title: 'KronosCode Playwright browser',
        surface: 'browser',
        provider: 'kronoscode-relay',
        status: openCodeAvailable && aiBrowserEnabled ? 'available' : openCodeAvailable ? 'degraded' : 'unavailable',
        message: aiBrowserEnabled
          ? 'AI browser tools can drive Playwright through KronosCode.'
          : 'Set KRONOSCODE_ENABLE_AI_BROWSER=true or OPENCODE_ENABLE_AI_BROWSER=true to enable AI browser tools.',
        actions: [
          'browser_list_pages',
          'browser_new_page',
          'browser_navigate',
          'browser_click',
          'browser_fill',
          'browser_snapshot',
          'browser_screenshot',
        ],
        routes: ['/api/runtime/browser/state', '/api/runtime/browser/read', '/api/runtime/browser/frame'],
        evidence: { openCodeAvailable, aiBrowserEnabled },
      }),
      buildCapabilityRecord({
        id: 'sandbox.desktop',
        title: 'Local sandbox desktop',
        surface: 'sandbox',
        provider: sandboxConnector.provider || 'sandbox-mcp',
        status: capabilityFromAvailability(sandboxConnector.available, sandboxConnector.health),
        message:
          sandboxConnector.error ||
          sandboxConnector.reason ||
          'Sandbox desktop sessions can run browser, GUI, and shell tasks in isolation.',
        actions: ['create_session', 'destroy_session', 'screenshot', 'computer_action', 'bash', 'background_task'],
        routes: ['/api/desktop-sandbox/sessions', '/api/agent-mode/run', '/api/runtime/tasks'],
        evidence: { connector: sandboxConnector },
        setupAction: sandboxConnector.available ? null : 'Install/start sandbox-mcp and its local container image.',
      }),
      buildCapabilityRecord({
        id: 'terminal.project-shell',
        title: 'Project terminal',
        surface: 'terminal',
        provider: 'openchamber-terminal',
        status: 'available',
        message: 'Project terminal sessions support HTTP and WebSocket input.',
        actions: ['create_terminal', 'stream_output', 'send_input', 'resize', 'kill'],
        routes: ['/api/terminal', '/api/terminal/:sessionId/stream', TERMINAL_INPUT_WS_PATH],
        evidence: { capabilities: terminalInputCapabilities },
      }),
      buildCapabilityRecord({
        id: 'files.workspace',
        title: 'Workspace filesystem',
        surface: 'file',
        provider: 'openchamber-fs',
        status: 'available',
        message: 'Workspace file read, raw, list, search, and exec jobs are available through server APIs.',
        actions: ['read', 'raw', 'list', 'search', 'exec'],
        routes: ['/api/fs/read', '/api/fs/raw', '/api/fs/list', '/api/fs/search', '/api/fs/exec/:jobId'],
        evidence: { workspaceRoot: REPO_ROOT_PATH },
      }),
      buildCapabilityRecord({
        id: 'git.workspace',
        title: 'Git workspace operations',
        surface: 'git',
        provider: 'openchamber-git',
        status: 'available',
        message: 'Git status, diffs, branches, logs, remotes, identities, and worktrees are available.',
        actions: ['status', 'diff', 'branches', 'log', 'remotes', 'worktrees', 'identity'],
        routes: ['/api/git/status', '/api/git/diff', '/api/git/branches', '/api/git/log', '/api/git/worktrees'],
        evidence: { workspaceRoot: REPO_ROOT_PATH },
      }),
      buildCapabilityRecord({
        id: 'github.connector',
        title: 'GitHub connector',
        surface: 'adapter',
        provider: 'github',
        status: 'available',
        message: 'GitHub auth, PR, issue, and repository context routes are available; auth status determines account access.',
        actions: ['auth_status', 'me', 'issues', 'pulls', 'pr_context'],
        routes: ['/api/github/auth/status', '/api/github/issues/list', '/api/github/pulls/list', '/api/github/pulls/context'],
        evidence: { authRoute: '/api/github/auth/status' },
      }),
      buildCapabilityRecord({
        id: 'canvas.native',
        title: 'Native canvas workspace',
        surface: 'canvas',
        provider: 'kronoschamber-canvas',
        status: 'available',
        message: 'Canvas workspaces support durable nodes, edges, history, file/diff resources, and runtime surface bindings.',
        actions: ['list_workspaces', 'save_workspace', 'history', 'file_resource', 'diff_resource', 'runtime_surface_binding'],
        routes: ['/api/canvas/workspaces', '/api/canvas/history', '/api/canvas/resources/file', '/api/canvas/resources/diff'],
        evidence: { runtimeSurfaceBinding: true },
      }),
      buildCapabilityRecord({
        id: 'creative.jaaz-import',
        title: 'Jaaz creative import adapter',
        surface: 'adapter',
        provider: 'jaaz',
        status: jaazWorkspaceOrigin ? 'available' : 'degraded',
        message: jaazWorkspaceOrigin
          ? 'Jaaz import proxy is configured.'
          : 'Jaaz import routes are present, but an upstream app origin is not configured.',
        actions: ['auth_status', 'auth_poll', 'import_projects', 'import_documents', 'import_assets', 'import_jobs'],
        routes: ['/api/creative/import/jaaz/auth/status', '/api/creative/projects', '/api/creative/documents', '/api/creative/assets'],
        evidence: { originConfigured: Boolean(jaazWorkspaceOrigin), upstream: jaazUpstreamStatus },
        setupAction: jaazWorkspaceOrigin ? null : 'Set OPENCHAMBER_JAAZ_APP_ORIGIN or KRONOSCHAMBER_JAAZ_APP_ORIGIN.',
        provenance: { mode: 'adapter', upstream: 'jaaz', status: jaazUpstreamStatus },
      }),
      buildCapabilityRecord({
        id: 'social.postiz',
        title: 'Postiz social workspace',
        surface: 'adapter',
        provider: 'postiz',
        status: capabilityFromAvailability(socialWorkspaceStatus.available, socialWorkspaceStatus.health),
        message: socialWorkspaceStatus.reason,
        actions: ['campaigns', 'drafts', 'approvals', 'scheduling', 'agent_publish_handoff'],
        routes: [SOCIAL_PROXY_BASE_PATH, '/api/runtime/status'],
        evidence: { workspace: socialWorkspaceStatus, upstream: postizUpstreamStatus },
        provenance: { mode: postizOrigin ? 'proxy+adapter' : 'native-adapter', upstream: 'postiz-app', status: postizUpstreamStatus },
      }),
      buildCapabilityRecord({
        id: 'video.supoclip',
        title: 'SupoClip video workspace',
        surface: 'adapter',
        provider: 'supoclip',
        status: capabilityFromAvailability(videoWorkspaceStatus.available, videoWorkspaceStatus.health),
        message: videoWorkspaceStatus.reason,
        actions: ['clip_jobs', 'review_queue', 'asset_handoff', 'video_to_social'],
        routes: [VIDEO_PROXY_BASE_PATH, '/api/runtime/status'],
        evidence: { workspace: videoWorkspaceStatus, upstream: supoClipUpstreamStatus },
        provenance: { mode: supoClipOrigin ? 'proxy+adapter' : 'native-adapter', upstream: 'supoclip', status: supoClipUpstreamStatus },
      }),
      buildCapabilityRecord({
        id: 'ops.business',
        title: 'Business / Ops workspace',
        surface: 'adapter',
        provider: 'nocobase',
        status: capabilityFromAvailability(businessWorkspaceStatus.available, businessWorkspaceStatus.health),
        message: businessWorkspaceStatus.reason,
        actions: ['collections', 'records', 'forms', 'actions', 'workflows', 'agents'],
        routes: ['/api/ops/bootstrap', '/api/ops/collections', '/api/ops/records', '/api/ops/workflows'],
        evidence: { workspace: businessWorkspaceStatus },
        setupAction: businessWorkspaceStatus.setup || null,
      }),
      buildCapabilityRecord({
        id: 'mcp.upstream-repos',
        title: 'Upstream MCP checkouts',
        surface: 'adapter',
        provider: 'third_party/upstream',
        status: excalidrawMcpStatus.available || atsuraeStatus.available || personalizationStatus.available ? 'available' : 'degraded',
        message: 'Tracks local upstream checkouts that can be used through adapters or clean-room imports.',
        actions: ['license_review', 'adapter_manifest', 'sync_upstream', 'provenance_check'],
        routes: ['/api/runtime/status'],
        evidence: {
          excalidraw: excalidrawMcpStatus,
          atsurae: atsuraeStatus,
          personalization: personalizationStatus,
        },
      }),
      buildCapabilityRecord({
        id: 'voice.tts',
        title: 'Text-to-speech',
        surface: 'runtime',
        provider: 'macos-say/openai-browser',
        status: 'available',
        message: 'Voice status routes expose browser, OpenAI, and macOS say availability to the UI.',
        actions: ['tts_status', 'say_status', 'browser_voice'],
        routes: ['/api/tts/status', '/api/tts/say/status'],
        evidence: { sayRoute: '/api/tts/say/status' },
      }),
      buildCapabilityRecord({
        id: 'system.disk',
        title: 'Disk pressure monitor',
        surface: 'runtime',
        provider: 'host-filesystem',
        status: diskStatus,
        message:
          diskStatus === 'available'
            ? 'Workspace disk has enough free space for normal web/runtime checks.'
            : 'Workspace disk is low; native builds and packaged resources may fail.',
        actions: ['disk_check', 'build_preflight'],
        routes: ['/api/capabilities'],
        evidence: diskEvidence,
        setupAction: diskStatus === 'available' ? null : 'Free local disk space before running Tauri packaging or full builds.',
      }),
    ];

    return {
      version: 1,
      timestamp: Date.now(),
      generatedAt: new Date().toISOString(),
      mode: persistedMode,
      summary: summarizeCapabilities(capabilities),
      capabilities,
      tasks: {
        total: tasks.length,
        running: tasks.filter((entry) => entry?.status === 'running').length,
      },
    };
  };

  const handleCapabilitiesRequest = async (req, res) => {
    try {
      const snapshot = await buildCapabilitiesSnapshot();
      const surface = normalizeOptionalString(req.query?.surface);
      const status = normalizeOptionalString(req.query?.status);
      const filtered = snapshot.capabilities.filter((capability) => {
        if (surface && capability.surface !== surface) return false;
        if (status && capability.status !== status) return false;
        return true;
      });
      return res.json({
        ...snapshot,
        summary: summarizeCapabilities(filtered),
        capabilities: filtered,
      });
    } catch (error) {
      console.error('Failed to build capabilities snapshot:', error);
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to build capabilities snapshot' });
    }
  };

  app.get('/api/capabilities', handleCapabilitiesRequest);
  app.get('/api/runtime/capabilities', handleCapabilitiesRequest);

  app.get('/api/runtime/openclaw/discovery', async (req, res) => {
    const action = normalizeOptionalString(req.query?.action) || 'list';
    const target = normalizeOptionalString(req.query?.target);

    const allowedActions = new Set(['list', 'status', 'capabilities', 'resolve']);
    if (!allowedActions.has(action)) {
      return res.status(400).json({
        error: 'Invalid discovery action. Use list, status, capabilities, or resolve.',
      });
    }

    if (action !== 'list' && !target) {
      return res.status(400).json({
        error: `target is required for action "${action}"`,
      });
    }

    const plans =
      action === 'list'
        ? [
            ['channels', 'list', '--json'],
            ['channels', '--json'],
            ['channels', 'list'],
          ]
        : action === 'status'
          ? [
              ['channels', 'status', target, '--json'],
              ['channels', 'status', target],
            ]
          : action === 'capabilities'
            ? [
                ['channels', 'capabilities', target, '--json'],
                ['channels', 'capabilities', target],
              ]
            : [
                ['channels', 'resolve', target, '--json'],
                ['channels', 'resolve', target],
              ];

    const attempts = [];
    for (const plan of plans) {
      const result = await runOpenClawCommand(plan);
      attempts.push(result);
      if (!result.ok) continue;

      const parsed = safeJsonParse(result.stdout);
      return res.json({
        success: true,
        action,
        target: target || null,
        command: result.command,
        result: parsed ?? result.stdout,
        available: true,
      });
    }

    const latest = attempts[attempts.length - 1];
    return res.status(502).json({
      success: false,
      action,
      target: target || null,
      available: false,
      error: latest?.stderr || 'OpenClaw discovery command failed',
      attempts: attempts.map((item) => ({
        command: item.command,
        code: item.code,
        stderr: item.stderr,
      })),
    });
  });

  app.post('/api/runtime/task', async (req, res) => {
    try {
      pruneAgentModeTasks();

      const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const settings = await readSettingsFromDiskMigrated();
      const persistedMode = normalizeAgentModeSetting(settings?.agentMode);
      const requestedMode = normalizeRuntimeMode(normalizeOptionalString(req.body?.mode) || persistedMode);

      if (requestedMode === 'native') {
        return res.status(400).json({
          error: 'Native runtime does not support background task execution. Use the native desktop control panel.',
        });
      }

      if (!isRuntimeTaskMode(requestedMode)) {
        return res.status(400).json({
          error: 'Runtime mode is off. Set mode to sandbox first.',
          mode: persistedMode,
        });
      }

      const taskID = crypto.randomUUID();
      const task = {
        taskID,
        mode: requestedMode,
        prompt,
        status: 'queued',
        success: null,
        error: null,
        result: null,
        connector: null,
        runtimeSessionID: null,
        liveUrl: null,
        artifacts: [],
        logs: [],
        sessionID: normalizeOptionalString(req.body?.sessionID) || null,
        providerID: normalizeOptionalString(req.body?.providerID) || null,
        modelID: normalizeOptionalString(req.body?.modelID) || null,
        agentName: resolveDesktopAgentName(requestedMode, req.body?.agentName),
        createdAt: Date.now(),
        startedAt: null,
        finishedAt: null,
        updatedAt: Date.now(),
      };

      agentModeTasks.set(taskID, task);
      broadcastAgentModeTaskEvent(task, 'queued');

      const runInBackground = req.body?.background !== false;
      if (runInBackground) {
        void startAgentModeTask(task);
        return res.status(202).json({
          ...serializeAgentModeTask(task),
          status: 'running',
        });
      }

      await startAgentModeTask(task);
      return res.json(serializeAgentModeTask(task));
    } catch (error) {
      console.error('Failed to run runtime task:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to run runtime task' });
    }
  });

  app.get('/api/runtime/tasks', (req, res) => {
    pruneAgentModeTasks();
    const sessionID = normalizeOptionalString(req.query?.sessionID);
    const modeFilter = normalizeRuntimeMode(normalizeOptionalString(req.query?.mode));
    const rawLimit = Number(req.query?.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(200, Math.max(1, Math.round(rawLimit))) : 40;

    const tasks = Array.from(agentModeTasks.values())
      .filter((task) => {
        if (!task || typeof task !== 'object') {
          return false;
        }
        if (sessionID && task.sessionID !== sessionID) {
          return false;
        }
        if (modeFilter !== 'off' && task.mode !== modeFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const updatedA = typeof a.updatedAt === 'number' ? a.updatedAt : 0;
        const updatedB = typeof b.updatedAt === 'number' ? b.updatedAt : 0;
        return updatedB - updatedA;
      })
      .slice(0, limit)
      .map((task) => serializeAgentModeTask(task));

    res.json({ tasks });
  });

  app.get('/api/runtime/task/:taskID', (req, res) => {
    pruneAgentModeTasks();
    const taskID = typeof req.params?.taskID === 'string' ? req.params.taskID.trim() : '';
    if (!taskID) {
      return res.status(400).json({ error: 'Task id is required' });
    }

    const task = agentModeTasks.get(taskID);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(serializeAgentModeTask(task));
  });

  app.get('/api/runtime/artifacts', (req, res) => {
    pruneAgentModeTasks();
    const sessionID = normalizeOptionalString(req.query?.sessionID);
    if (!sessionID) {
      return res.status(400).json({ error: 'sessionID is required' });
    }

    const artifacts = Array.from(agentModeTasks.values())
      .filter((task) => task && typeof task === 'object' && task.sessionID === sessionID)
      .sort((a, b) => {
        const updatedA = typeof a.updatedAt === 'number' ? a.updatedAt : 0;
        const updatedB = typeof b.updatedAt === 'number' ? b.updatedAt : 0;
        return updatedB - updatedA;
      })
      .flatMap((task) => serializeRuntimeArtifactsForTask(task));

    res.json({ sessionID, artifacts });
  });

  app.get('/api/runtime/artifact/content', async (req, res) => {
    pruneAgentModeTasks();

    const taskID = normalizeOptionalString(req.query?.taskID);
    const artifactID = normalizeOptionalString(req.query?.artifactID);
    const shouldDownload = normalizeOptionalString(req.query?.download) === '1';

    if (!taskID || !artifactID) {
      return res.status(400).json({ error: 'taskID and artifactID are required' });
    }

    const task = agentModeTasks.get(taskID);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const artifacts = serializeRuntimeArtifactsForTask(task);
    const artifact = artifacts.find((entry) => entry && entry.id === artifactID);
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    const remoteUrl = normalizeOptionalString(artifact.url);
    if (remoteUrl && !normalizeOptionalString(artifact.path)) {
      return res.redirect(remoteUrl);
    }

    const filePath = normalizeOptionalString(artifact.path);
    if (!filePath) {
      return res.status(404).json({ error: 'Artifact has no local file path' });
    }

    try {
      const resolvedPath = path.resolve(normalizeDirectoryPath(filePath));
      if (resolvedPath.includes('..')) {
        return res.status(400).json({ error: 'Invalid path: path traversal not allowed' });
      }

      const stats = await fsPromises.stat(resolvedPath);
      if (!stats.isFile()) {
        return res.status(400).json({ error: 'Artifact path is not a file' });
      }

      const mimeType = normalizeOptionalString(artifact.mimeType) || inferMimeTypeFromPath(resolvedPath);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Length', String(stats.size));
      res.type(mimeType);

      if (shouldDownload) {
        const rawName = normalizeOptionalString(artifact.name) || path.basename(resolvedPath);
        const safeName = rawName.replace(/[^\w.\-() ]+/g, '_');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
      }

      const readStream = fs.createReadStream(resolvedPath);
      readStream.on('error', (error) => {
        console.error('Failed to stream runtime artifact:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to stream artifact' });
        } else {
          res.end();
        }
      });
      readStream.pipe(res);
    } catch (error) {
      const err = error;
      if (err && typeof err === 'object' && err.code === 'ENOENT') {
        return res.status(404).json({ error: 'Artifact file not found' });
      }
      if (err && typeof err === 'object' && err.code === 'EACCES') {
        return res.status(403).json({ error: 'Access to artifact denied' });
      }
      console.error('Failed to load runtime artifact content:', error);
      return res.status(500).json({ error: 'Failed to read artifact content' });
    }
  });

  const PRIMARY_BROWSER_SESSION_TITLE = 'KronosChamber Browser';
  let primaryBrowserSessionCache = null;
  let cachedDesktopApps = [];
  let cachedDesktopAppsTimestamp = 0;

  const parseMacAppInfoPlist = async (appBundlePath) => {
    const infoPath = path.join(appBundlePath, 'Contents', 'Info.plist');
    try {
      const raw = await fs.promises.readFile(infoPath, 'utf8');
      const readValue = (key) => {
        const pattern = new RegExp(`<key>${key}<\\/key>\\s*<string>([^<]+)<\\/string>`, 'i');
        const match = pattern.exec(raw);
        return match && typeof match[1] === 'string' ? match[1].trim() : null;
      };
      return {
        bundleId: readValue('CFBundleIdentifier'),
        displayName: readValue('CFBundleDisplayName') || readValue('CFBundleName'),
      };
    } catch {
      return {
        bundleId: null,
        displayName: null,
      };
    }
  };

  const listMacAppsFromDirectory = async (rootDirectory, sourceLabel) => {
    const discovered = [];

    const scanDirectory = async (directoryPath, depth = 0) => {
      let entries = [];
      try {
        entries = await fs.promises.readdir(directoryPath, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (!entry || !entry.isDirectory()) {
          continue;
        }

        const absolutePath = path.join(directoryPath, entry.name);
        if (entry.name.endsWith('.app')) {
          discovered.push(absolutePath);
          continue;
        }

        if (depth < 2) {
          await scanDirectory(absolutePath, depth + 1);
        }
      }
    };

    await scanDirectory(rootDirectory);

    const apps = [];
    for (const appPath of discovered) {
      const fallbackName = path.basename(appPath, '.app');
      const info = await parseMacAppInfoPlist(appPath);
      const resolvedName = normalizeOptionalString(info.displayName) || normalizeOptionalString(fallbackName) || 'Unknown App';

      apps.push({
        id: `${sourceLabel}:${appPath}`.toLowerCase(),
        name: resolvedName,
        bundleId: normalizeOptionalString(info.bundleId) || null,
        path: appPath,
        source: sourceLabel,
      });
    }

    return apps;
  };

  const listWindowsAppsFromDirectory = async (rootDirectory) => {
    const discovered = [];

    const scanDirectory = async (directoryPath, depth = 0) => {
      let entries = [];
      try {
        entries = await fs.promises.readdir(directoryPath, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (!entry) continue;
        const absolutePath = path.join(directoryPath, entry.name);

        if (entry.isDirectory()) {
          if (depth < 2) {
            await scanDirectory(absolutePath, depth + 1);
          }
        } else if (entry.name.endsWith('.exe') || entry.name.endsWith('.lnk')) {
          discovered.push(absolutePath);
        }
      }
    };

    await scanDirectory(rootDirectory);

    const apps = [];
    for (const appPath of discovered) {
      const name = path.basename(appPath, path.extname(appPath));
      apps.push({
        id: `windows:${appPath}`.toLowerCase(),
        name,
        bundleId: null,
        path: appPath,
        source: 'windows',
      });
    }

    return apps;
  };

  const parseDesktopEntry = async (desktopFilePath) => {
    try {
      const content = await fs.promises.readFile(desktopFilePath, 'utf8');
      const lines = content.split('\n');
      const entry = { name: null, exec: null, icon: null };
      let inDesktopEntry = false;

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === '[Desktop Entry]') {
          inDesktopEntry = true;
          continue;
        }
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          inDesktopEntry = false;
          continue;
        }
        if (!inDesktopEntry) continue;

        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const [, key, value] = match;
          if (key === 'Name') entry.name = value;
          if (key === 'Exec') entry.exec = value;
          if (key === 'Icon') entry.icon = value;
        }
      }

      return entry;
    } catch {
      return { name: null, exec: null, icon: null };
    }
  };

  const listLinuxAppsFromDirectory = async (rootDirectory) => {
    const discovered = [];

    try {
      const entries = await fs.promises.readdir(rootDirectory, { withFileTypes: true });
      for (const entry of entries) {
        if (entry && entry.isFile() && entry.name.endsWith('.desktop')) {
          discovered.push(path.join(rootDirectory, entry.name));
        }
      }
    } catch {
      return [];
    }

    const apps = [];
    for (const desktopPath of discovered) {
      const info = await parseDesktopEntry(desktopPath);
      if (info.name) {
        apps.push({
          id: `linux:${desktopPath}`.toLowerCase(),
          name: info.name,
          bundleId: null,
          path: desktopPath,
          exec: info.exec,
          icon: info.icon,
          source: 'linux',
        });
      }
    }

    return apps;
  };

  const discoverDesktopApps = async (options = {}) => {
    const now = Date.now();
    const forceRefresh = options?.force === true;

    if (!forceRefresh && cachedDesktopAppsTimestamp > 0 && now - cachedDesktopAppsTimestamp < DESKTOP_APP_DISCOVERY_CACHE_TTL_MS) {
      return {
        platform: process.platform,
        supported: true,
        source: 'cache',
        scannedAt: cachedDesktopAppsTimestamp,
        directories: getAppDirectoriesForPlatform(),
        apps: cachedDesktopApps,
      };
    }

    const discovered = [];
    const directories = getAppDirectoriesForPlatform();

    if (process.platform === 'darwin') {
      for (const directoryPath of directories) {
        const exists = await fs.promises
          .access(directoryPath, fs.constants.R_OK)
          .then(() => true)
          .catch(() => false);
        if (!exists) {
          continue;
        }
        const apps = await listMacAppsFromDirectory(directoryPath, directoryPath);
        discovered.push(...apps);
      }
    } else if (process.platform === 'win32') {
      for (const directoryPath of directories) {
        const exists = await fs.promises
          .access(directoryPath, fs.constants.R_OK)
          .then(() => true)
          .catch(() => false);
        if (!exists) {
          continue;
        }
        const apps = await listWindowsAppsFromDirectory(directoryPath);
        discovered.push(...apps);
      }
    } else if (process.platform === 'linux') {
      for (const directoryPath of directories) {
        const apps = await listLinuxAppsFromDirectory(directoryPath);
        discovered.push(...apps);
      }
    }

    const deduped = [];
    const seen = new Set();
    for (const app of discovered) {
      const dedupeKey = `${(app.bundleId || '').toLowerCase()}::${app.path.toLowerCase()}`;
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);
      deduped.push(app);
    }

    deduped.sort((a, b) => a.name.localeCompare(b.name));
    cachedDesktopApps = deduped.slice(0, 500);
    cachedDesktopAppsTimestamp = Date.now();

    return {
      platform: process.platform,
      supported: true,
      source: 'filesystem',
      scannedAt: cachedDesktopAppsTimestamp,
      directories,
      apps: cachedDesktopApps,
    };
  };

  const getAppDirectoriesForPlatform = () => {
    if (process.platform === 'darwin') {
      return [...MACOS_APP_DIRECTORIES];
    } else if (process.platform === 'win32') {
      return [...WINDOWS_APP_DIRECTORIES];
    } else if (process.platform === 'linux') {
      return [...LINUX_APP_DIRECTORIES];
    }
    return [];
  };

  const normalizeOpenCodeSessionRecord = (record, options = {}) => {
    if (!record || typeof record !== 'object') {
      return null;
    }

    const sessionID =
      normalizeOptionalString(record.id) || normalizeOptionalString(record.sessionID) || normalizeOptionalString(record.sessionId);
    if (!sessionID) {
      return null;
    }

    const createdAt = Number.isFinite(record?.time?.created) ? Number(record.time.created) : Date.now();
    const updatedAt = Number.isFinite(record?.time?.updated) ? Number(record.time.updated) : createdAt;

    const title = normalizeOptionalString(options.titleOverride) || normalizeOptionalString(record.title) || PRIMARY_BROWSER_SESSION_TITLE;
    const target =
      options.target === 'primary-browser' || options.target === 'background-runtime'
        ? options.target
        : title === PRIMARY_BROWSER_SESSION_TITLE
          ? 'primary-browser'
          : 'background-runtime';

    return {
      sessionID,
      title,
      provider: 'desktop-browser',
      target,
      status: 'ready',
      createdAt,
      updatedAt,
    };
  };

  const listOpenCodeSessions = async (options = {}) => {
    const now = Date.now();
    const forceRefresh = options?.force === true;
    if (
      !forceRefresh &&
      Array.isArray(cachedOpenCodeSessions) &&
      cachedOpenCodeSessionsTimestamp > 0 &&
      now - cachedOpenCodeSessionsTimestamp < BROWSER_SESSION_CACHE_TTL_MS
    ) {
      return cachedOpenCodeSessions;
    }

    const upstream = await fetch(buildOpenCodeUrl('/session', ''), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...getOpenCodeAuthHeaders(),
      },
      signal: AbortSignal.timeout(LONG_REQUEST_TIMEOUT_MS),
    });

    const payload = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      throw new Error(
        payload && typeof payload?.error === 'string' ? payload.error : `Failed to list OpenCode sessions (${upstream.status})`,
      );
    }

    let sessions = [];
    if (Array.isArray(payload)) {
      sessions = payload.map(normalizeOpenCodeSessionRecord).filter(Boolean);
    } else if (payload && typeof payload === 'object' && Array.isArray(payload.data)) {
      sessions = payload.data.map(normalizeOpenCodeSessionRecord).filter(Boolean);
    }

    cachedOpenCodeSessions = sessions;
    cachedOpenCodeSessionsTimestamp = Date.now();
    return sessions;
  };

  const createOpenCodeSession = async (input = {}) => {
    const requestedTitle = normalizeOptionalString(input?.title) || PRIMARY_BROWSER_SESSION_TITLE;
    const requestedTarget =
      input?.target === 'background-runtime' || input?.target === 'primary-browser'
        ? input.target
        : requestedTitle === PRIMARY_BROWSER_SESSION_TITLE
          ? 'primary-browser'
          : 'background-runtime';

    const upstream = await fetch(buildOpenCodeUrl('/session', ''), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...getOpenCodeAuthHeaders(),
      },
      body: JSON.stringify({
        title: requestedTitle,
      }),
      signal: AbortSignal.timeout(LONG_REQUEST_TIMEOUT_MS),
    });

    const payload = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      throw new Error(
        payload && typeof payload?.error === 'string' ? payload.error : `Failed to create OpenCode session (${upstream.status})`,
      );
    }

    const normalized = normalizeOpenCodeSessionRecord(payload?.data ?? payload, {
      target: requestedTarget,
      titleOverride: requestedTitle,
    });
    if (!normalized) {
      throw new Error('OpenCode returned an invalid session record');
    }
    cachedOpenCodeSessions = [
      normalized,
      ...(Array.isArray(cachedOpenCodeSessions) ? cachedOpenCodeSessions : []).filter((entry) => entry?.sessionID !== normalized.sessionID),
    ];
    cachedOpenCodeSessionsTimestamp = Date.now();
    return normalized;
  };

  const ensurePrimaryBrowserSessionRecord = async () => {
    const sessions = await listOpenCodeSessions();

    if (primaryBrowserSessionCache?.sessionID) {
      const cached = sessions.find((session) => session.sessionID === primaryBrowserSessionCache.sessionID);
      if (cached) {
        primaryBrowserSessionCache = cached;
        return cached;
      }
    }

    const existing = sessions.find((session) => session.title === PRIMARY_BROWSER_SESSION_TITLE);
    if (existing) {
      primaryBrowserSessionCache = existing;
      return existing;
    }

    const created = await createOpenCodeSession();
    primaryBrowserSessionCache = created;
    return created;
  };

  const resolveBrowserSessionID = async (candidateSessionID, options = {}) => {
    if (options.target === 'primary-browser') {
      const primary = await ensurePrimaryBrowserSessionRecord();
      return primary.sessionID;
    }

    const sessionID = normalizeOptionalString(candidateSessionID);
    if (sessionID) {
      if (options.validateSession === true) {
        let sessions = await listOpenCodeSessions();
        let exists = sessions.some((entry) => entry.sessionID === sessionID);
        if (!exists) {
          sessions = await listOpenCodeSessions({ force: true });
          exists = sessions.some((entry) => entry.sessionID === sessionID);
        }
        if (!exists && options.fallbackToPrimary !== false) {
          const primary = await ensurePrimaryBrowserSessionRecord();
          return primary.sessionID;
        }
      }
      return sessionID;
    }

    const primary = await ensurePrimaryBrowserSessionRecord();
    return primary.sessionID;
  };

  const clearBrowserStateFailure = (sessionID) => {
    const normalized = normalizeOptionalString(sessionID);
    if (!normalized) {
      return;
    }
    browserStateFailureTracker.delete(normalized);
  };

  const registerBrowserStateFailure = (sessionID, statusCode) => {
    const normalized = normalizeOptionalString(sessionID);
    if (!normalized) {
      return { count: 0, statusCode: statusCode || null, lastFailureAt: Date.now(), lastRecoveryAttemptAt: 0 };
    }
    const now = Date.now();
    const existing = browserStateFailureTracker.get(normalized);
    const withinWindow = existing && now - existing.lastFailureAt < BROWSER_STATE_FAILURE_WINDOW_MS;
    const count = withinWindow ? existing.count + 1 : 1;
    const next = {
      count,
      statusCode: Number.isFinite(statusCode) ? Number(statusCode) : null,
      lastFailureAt: now,
      lastRecoveryAttemptAt: existing?.lastRecoveryAttemptAt || 0,
    };
    browserStateFailureTracker.set(normalized, next);
    return next;
  };

  const shouldAttemptBrowserStateRecovery = (sessionID, failureRecord) => {
    const normalized = normalizeOptionalString(sessionID);
    if (!normalized || !failureRecord) {
      return false;
    }
    if (failureRecord.count < BROWSER_STATE_FAILURE_THRESHOLD) {
      return false;
    }
    const now = Date.now();
    if (failureRecord.lastRecoveryAttemptAt && now - failureRecord.lastRecoveryAttemptAt < BROWSER_STATE_RECOVERY_COOLDOWN_MS) {
      return false;
    }
    return true;
  };

  const markBrowserStateRecoveryAttempt = (sessionID) => {
    const normalized = normalizeOptionalString(sessionID);
    if (!normalized) {
      return;
    }
    const existing = browserStateFailureTracker.get(normalized);
    if (!existing) {
      return;
    }
    browserStateFailureTracker.set(normalized, {
      ...existing,
      lastRecoveryAttemptAt: Date.now(),
    });
  };

  const fetchBrowserStateUpstream = async (sessionID) => {
    const url = new URL(buildOpenCodeUrl('/experimental/browser/state', ''));
    url.searchParams.set('sessionID', sessionID);
    const upstream = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...getOpenCodeAuthHeaders(),
      },
      signal: AbortSignal.timeout(LONG_REQUEST_TIMEOUT_MS),
    });
    const body = await upstream.text();
    let payload = null;
    try {
      payload = JSON.parse(body);
    } catch {
      payload = null;
    }
    return { upstream, body, payload };
  };

  const buildBrowserRecoveryMetadata = (input = {}) => ({
    attempted: input.attempted === true,
    rebound: input.rebound === true,
    fromSessionID: normalizeOptionalString(input.fromSessionID) || null,
    toSessionID: normalizeOptionalString(input.toSessionID) || null,
    failureCount: Number.isFinite(input.failureCount) ? Number(input.failureCount) : 0,
    reason: normalizeOptionalString(input.reason) || null,
  });

  const normalizeBrowserStateResponsePayload = (record, sessionID, recovery) => {
    const backend = typeof record.backend === 'string' && record.backend.trim().length > 0 ? record.backend : 'playwright';
    const capabilities = record.capabilities && typeof record.capabilities === 'object' ? record.capabilities : {};

    return {
      ...record,
      sessionID,
      provider: 'kronoscode-relay',
      backend,
      capabilities: {
        tabs: capabilities.tabs !== false,
        history: capabilities.history !== false,
        selection: capabilities.selection === true,
        highFidelityScreenshot: capabilities.highFidelityScreenshot === true,
        downloads: capabilities.downloads === true,
      },
      lastError: typeof record.lastError === 'string' ? record.lastError : typeof record.error === 'string' ? record.error : null,
      recovery: buildBrowserRecoveryMetadata(recovery),
    };
  };

  app.get('/api/runtime/browser/primary', async (_req, res) => {
    try {
      const session = await ensurePrimaryBrowserSessionRecord();
      return res.json(session);
    } catch (error) {
      return res.status(503).json({
        error: error instanceof Error ? error.message : 'Failed to resolve primary browser session',
      });
    }
  });

  app.post('/api/runtime/browser/ensure-primary', async (_req, res) => {
    try {
      const session = await ensurePrimaryBrowserSessionRecord();
      return res.json(session);
    } catch (error) {
      const timestamp = Date.now();
      return res.status(200).json({
        sessionID: 'primary-browser-unavailable',
        title: PRIMARY_BROWSER_SESSION_TITLE,
        provider: 'off',
        target: 'primary-browser',
        status: 'unavailable',
        createdAt: timestamp,
        updatedAt: timestamp,
        error: error instanceof Error ? error.message : 'Failed to ensure primary browser session',
      });
    }
  });

  app.get('/api/runtime/browser/ensure-primary', async (_req, res) => {
    try {
      const session = await ensurePrimaryBrowserSessionRecord();
      return res.json(session);
    } catch (error) {
      const timestamp = Date.now();
      return res.status(200).json({
        sessionID: 'primary-browser-unavailable',
        title: PRIMARY_BROWSER_SESSION_TITLE,
        provider: 'off',
        target: 'primary-browser',
        status: 'unavailable',
        createdAt: timestamp,
        updatedAt: timestamp,
        error: error instanceof Error ? error.message : 'Failed to ensure primary browser session',
      });
    }
  });

  app.get('/api/runtime/browser/sessions', async (_req, res) => {
    try {
      const sessions = await listOpenCodeSessions({ force: true });
      return res.json({ sessions });
    } catch (error) {
      return res.status(503).json({
        error: error instanceof Error ? error.message : 'Failed to list browser sessions',
      });
    }
  });

  app.post('/api/runtime/browser/sessions', async (req, res) => {
    try {
      const title = normalizeOptionalString(req.body?.title) || null;
      const target = normalizeOptionalString(req.body?.target);
      const created = await createOpenCodeSession({
        title: title || undefined,
        target: target === 'primary-browser' ? 'primary-browser' : 'background-runtime',
      });
      return res.status(201).json(created);
    } catch (error) {
      return res.status(503).json({
        error: error instanceof Error ? error.message : 'Failed to create browser session',
      });
    }
  });

  app.get('/api/runtime/apps/discovery', async (req, res) => {
    try {
      const forceRefresh = normalizeOptionalString(req.query?.refresh) === '1';
      const payload = await discoverDesktopApps({ force: forceRefresh });
      return res.json(payload);
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to discover desktop applications',
      });
    }
  });

  app.get('/api/runtime/browser/state', async (req, res) => {
    try {
      const requestedSessionID = normalizeOptionalString(req.query?.sessionID);
      const resolvedSessionID = await resolveBrowserSessionID(requestedSessionID, {
        validateSession: true,
        fallbackToPrimary: true,
      });
      const initialFetch = await fetchBrowserStateUpstream(resolvedSessionID);

      if (initialFetch.upstream.ok && initialFetch.payload && typeof initialFetch.payload === 'object') {
        clearBrowserStateFailure(resolvedSessionID);
        clearBrowserStateFailure(requestedSessionID);
        const recovery = buildBrowserRecoveryMetadata({
          attempted: requestedSessionID && requestedSessionID !== resolvedSessionID,
          rebound: requestedSessionID && requestedSessionID !== resolvedSessionID,
          fromSessionID: requestedSessionID,
          toSessionID: resolvedSessionID,
          failureCount: 0,
          reason: requestedSessionID && requestedSessionID !== resolvedSessionID ? 'invalid-session-fallback' : null,
        });
        return res.json(normalizeBrowserStateResponsePayload(initialFetch.payload, resolvedSessionID, recovery));
      }

      const failureRecord = registerBrowserStateFailure(resolvedSessionID, initialFetch.upstream.status);
      const canAutoRecover = initialFetch.upstream.status >= 500 && shouldAttemptBrowserStateRecovery(resolvedSessionID, failureRecord);

      if (canAutoRecover) {
        markBrowserStateRecoveryAttempt(resolvedSessionID);
        const primary = await ensurePrimaryBrowserSessionRecord();
        const primarySessionID = normalizeOptionalString(primary?.sessionID);
        if (primarySessionID && primarySessionID !== resolvedSessionID) {
          const recoveryFetch = await fetchBrowserStateUpstream(primarySessionID);
          if (recoveryFetch.upstream.ok && recoveryFetch.payload && typeof recoveryFetch.payload === 'object') {
            clearBrowserStateFailure(primarySessionID);
            clearBrowserStateFailure(resolvedSessionID);
            const recovery = buildBrowserRecoveryMetadata({
              attempted: true,
              rebound: true,
              fromSessionID: resolvedSessionID,
              toSessionID: primarySessionID,
              failureCount: failureRecord.count,
              reason: 'upstream-failure-auto-rebind',
            });
            return res.json(normalizeBrowserStateResponsePayload(recoveryFetch.payload, primarySessionID, recovery));
          }
        }
      }

      const recovery = buildBrowserRecoveryMetadata({
        attempted: canAutoRecover,
        rebound: false,
        fromSessionID: requestedSessionID || resolvedSessionID,
        toSessionID: resolvedSessionID,
        failureCount: failureRecord.count,
        reason: canAutoRecover ? 'recovery-attempt-failed' : 'upstream-error',
      });

      if (initialFetch.payload && typeof initialFetch.payload === 'object') {
        return res.status(initialFetch.upstream.status).json({
          ...initialFetch.payload,
          sessionID: resolvedSessionID,
          recovery,
        });
      }

      res.status(initialFetch.upstream.status);
      res.setHeader('Content-Type', initialFetch.upstream.headers.get('content-type') || 'application/json');
      res.setHeader('x-openchamber-browser-recovery', JSON.stringify(recovery));
      res.send(initialFetch.body);
    } catch (error) {
      res.status(503).json({
        error: error instanceof Error ? error.message : 'Failed to proxy browser state',
      });
    }
  });

  app.post('/api/runtime/browser/action', async (req, res) => {
    const requestedSessionID = normalizeOptionalString(req.body?.sessionID) || normalizeOptionalString(req.query?.sessionID);
    const action = normalizeOptionalString(req.body?.action);
    const payload = req.body?.payload && typeof req.body.payload === 'object' && !Array.isArray(req.body.payload) ? req.body.payload : {};

    if (!action) {
      return res.status(400).json({ error: 'action is required' });
    }

    try {
      const sessionID = await resolveBrowserSessionID(requestedSessionID, {
        target: normalizeOptionalString(req.body?.target) || null,
        validateSession: true,
        fallbackToPrimary: true,
      });
      const upstream = await fetch(buildOpenCodeUrl('/experimental/browser/action', ''), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...getOpenCodeAuthHeaders(),
        },
        body: JSON.stringify({
          sessionID,
          action,
          payload,
        }),
        signal: AbortSignal.timeout(LONG_REQUEST_TIMEOUT_MS),
      });
      const body = await upstream.text();
      let payloadBody = null;
      try {
        payloadBody = JSON.parse(body);
      } catch {
        payloadBody = null;
      }

      if (upstream.ok && payloadBody && typeof payloadBody === 'object' && Array.isArray(payloadBody.pages)) {
        return res.status(upstream.status).json({
          ...payloadBody,
          sessionID,
          provider: 'kronoscode-relay',
          backend: typeof payloadBody.backend === 'string' && payloadBody.backend.trim().length > 0 ? payloadBody.backend : 'playwright',
          capabilities:
            payloadBody.capabilities && typeof payloadBody.capabilities === 'object'
              ? {
                  tabs: payloadBody.capabilities.tabs !== false,
                  history: payloadBody.capabilities.history !== false,
                  selection: payloadBody.capabilities.selection === true,
                  highFidelityScreenshot: payloadBody.capabilities.highFidelityScreenshot === true,
                  downloads: payloadBody.capabilities.downloads === true,
                }
              : {
                  tabs: true,
                  history: true,
                  selection: false,
                  highFidelityScreenshot: true,
                  downloads: false,
                },
          lastError:
            typeof payloadBody.lastError === 'string'
              ? payloadBody.lastError
              : typeof payloadBody.error === 'string'
                ? payloadBody.error
                : null,
        });
      }

      res.status(upstream.status);
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
      res.send(body);
    } catch (error) {
      res.status(503).json({
        error: error instanceof Error ? error.message : 'Failed to proxy browser action',
      });
    }
  });

  // Backward-compatible alias for older callers that still use plural endpoint naming.
  app.post('/api/runtime/browser/actions', async (req, res) => {
    const firstAction = Array.isArray(req.body?.actions) && req.body.actions.length > 0 ? req.body.actions[0] : null;
    const requestedSessionID =
      normalizeOptionalString(req.body?.sessionID) ||
      normalizeOptionalString(req.query?.sessionID) ||
      normalizeOptionalString(firstAction?.sessionID);
    const action =
      normalizeOptionalString(req.body?.action) ||
      normalizeOptionalString(req.body?.type) ||
      normalizeOptionalString(firstAction?.action) ||
      normalizeOptionalString(firstAction?.type);
    const payloadSource =
      req.body?.payload && typeof req.body.payload === 'object' && !Array.isArray(req.body.payload)
        ? req.body.payload
        : firstAction?.payload && typeof firstAction.payload === 'object' && !Array.isArray(firstAction.payload)
          ? firstAction.payload
          : firstAction && typeof firstAction === 'object' && !Array.isArray(firstAction)
            ? firstAction
            : {};
    const payload = payloadSource && typeof payloadSource === 'object' && !Array.isArray(payloadSource) ? payloadSource : {};

    if (!action) {
      return res.status(400).json({ error: 'action is required' });
    }

    try {
      const sessionID = await resolveBrowserSessionID(requestedSessionID, {
        target: normalizeOptionalString(req.body?.target) || normalizeOptionalString(firstAction?.target) || null,
        validateSession: true,
        fallbackToPrimary: true,
      });
      const upstream = await fetch(buildOpenCodeUrl('/experimental/browser/action', ''), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...getOpenCodeAuthHeaders(),
        },
        body: JSON.stringify({
          sessionID,
          action,
          payload,
        }),
        signal: AbortSignal.timeout(LONG_REQUEST_TIMEOUT_MS),
      });
      const body = await upstream.text();
      res.status(upstream.status);
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
      res.send(body);
    } catch (error) {
      res.status(503).json({
        error: error instanceof Error ? error.message : 'Failed to proxy browser actions',
      });
    }
  });

  // Backward-compatible alias used by earlier browser-runtime clients.
  app.get('/api/runtime/browser/history', async (req, res) => {
    try {
      const sessionID = await resolveBrowserSessionID(req.query?.sessionID, {
        validateSession: true,
        fallbackToPrimary: true,
      });
      const url = new URL(buildOpenCodeUrl('/experimental/browser/state', ''));
      url.searchParams.set('sessionID', sessionID);
      const upstream = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...getOpenCodeAuthHeaders(),
        },
        signal: AbortSignal.timeout(LONG_REQUEST_TIMEOUT_MS),
      });
      const body = await upstream.text();
      let payload = null;
      try {
        payload = JSON.parse(body);
      } catch {
        payload = null;
      }

      if (upstream.ok && payload && typeof payload === 'object') {
        const pages = Array.isArray(payload.pages) ? payload.pages : [];
        const activePage = pages.find((page) => page && page.active) || pages[0] || null;
        const history = Array.isArray(activePage?.history) ? activePage.history : [];
        return res.json({
          sessionID,
          history,
          activePageId: typeof activePage?.id === 'string' ? activePage.id : null,
        });
      }

      res.status(upstream.status);
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
      res.send(body);
    } catch (error) {
      res.status(503).json({
        error: error instanceof Error ? error.message : 'Failed to proxy browser history',
      });
    }
  });

  app.get('/api/runtime/browser/events', async (req, res) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    req.on('close', abort);
    req.on('aborted', abort);

    try {
      const sessionID = await resolveBrowserSessionID(req.query?.sessionID, {
        validateSession: true,
        fallbackToPrimary: true,
      });
      const url = new URL(buildOpenCodeUrl('/experimental/browser/events', ''));
      url.searchParams.set('sessionID', sessionID);

      const headers = {
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
        ...getOpenCodeAuthHeaders(),
      };

      const upstream = await fetch(url.toString(), {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (!upstream.ok || !upstream.body) {
        const body = await upstream.text().catch(() => '');
        req.off('close', abort);
        req.off('aborted', abort);
        return res.status(upstream.status).send(body || 'Failed to proxy browser events');
      }

      res.status(upstream.status);
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();

      const stream = Readable.fromWeb(upstream.body);
      stream.on('error', (error) => {
        if (!controller.signal.aborted) {
          console.warn('[runtime] browser events proxy stream error:', error);
          res.end();
        }
      });
      stream.on('end', () => {
        req.off('close', abort);
        req.off('aborted', abort);
        res.end();
      });
      stream.pipe(res);
    } catch (error) {
      req.off('close', abort);
      req.off('aborted', abort);
      if (controller.signal.aborted) {
        return;
      }
      res.status(503).json({
        error: error instanceof Error ? error.message : 'Failed to proxy browser events',
      });
    }
  });

  app.get('/api/runtime/browser/frame', async (req, res) => {
    try {
      const sessionID = await resolveBrowserSessionID(req.query?.sessionID, {
        validateSession: true,
        fallbackToPrimary: true,
      });
      const frameId = normalizeOptionalString(req.query?.frameId);
      const url = new URL(buildOpenCodeUrl('/experimental/browser/frame', ''));
      url.searchParams.set('sessionID', sessionID);
      if (frameId) {
        url.searchParams.set('frameId', frameId);
      }
      const upstream = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...getOpenCodeAuthHeaders(),
        },
        signal: AbortSignal.timeout(LONG_REQUEST_TIMEOUT_MS),
      });
      const body = await upstream.text();
      res.status(upstream.status);
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
      res.send(body);
    } catch (error) {
      res.status(503).json({
        error: error instanceof Error ? error.message : 'Failed to proxy browser frame',
      });
    }
  });

  // Backward-compatible alias for browser frame reads from older clients.
  app.get('/api/runtime/browser/read', async (req, res) => {
    try {
      const sessionID = await resolveBrowserSessionID(req.query?.sessionID, {
        validateSession: true,
        fallbackToPrimary: true,
      });
      const frameId = normalizeOptionalString(req.query?.frameId) || normalizeOptionalString(req.query?.frameID);
      const url = new URL(buildOpenCodeUrl('/experimental/browser/frame', ''));
      url.searchParams.set('sessionID', sessionID);
      if (frameId) {
        url.searchParams.set('frameId', frameId);
      }
      const upstream = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...getOpenCodeAuthHeaders(),
        },
        signal: AbortSignal.timeout(LONG_REQUEST_TIMEOUT_MS),
      });
      const body = await upstream.text();
      res.status(upstream.status);
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
      res.send(body);
    } catch (error) {
      res.status(503).json({
        error: error instanceof Error ? error.message : 'Failed to proxy browser read',
      });
    }
  });

  const createId = (prefix) => `${prefix}_${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;
  const nowTimestamp = () => Date.now();

  const opsState = createOpsState({ nowTimestamp });

  const creativeState = {
    projects: [
      {
        id: 'creative_project_seed',
        name: 'Canvas Lab',
        description: 'Native Chamber canvas workspace',
        createdAt: nowTimestamp(),
        updatedAt: nowTimestamp(),
      },
    ],
    documents: [
      {
        id: 'creative_document_seed',
        projectId: 'creative_project_seed',
        name: 'Moodboard',
        content: 'Prompt concepts, references, and visual direction live here.',
        createdAt: nowTimestamp(),
        updatedAt: nowTimestamp(),
      },
    ],
    jobs: [
      {
        id: 'creative_job_seed',
        projectId: 'creative_project_seed',
        prompt: 'Design a native Chamber canvas workspace.',
        status: 'completed',
        createdAt: nowTimestamp(),
        updatedAt: nowTimestamp(),
      },
    ],
    assets: [
      {
        id: 'creative_asset_seed',
        projectId: 'creative_project_seed',
        name: 'Reference board',
        kind: 'document',
        url: null,
        createdAt: nowTimestamp(),
        updatedAt: nowTimestamp(),
      },
    ],
  };

  const canvasState = createCanvasState({ nowTimestamp });
  const runtimeState = createRuntimeState({ nowTimestamp });

  registerOpsRoutes({
    app,
    state: opsState,
    helpers: {
      createId,
      nowTimestamp,
    },
  });

  registerRuntimeRoutes({
    app,
    state: runtimeState,
    helpers: {
      createId,
      normalizeOptionalString,
      nowTimestamp,
      repoRootPath: REPO_ROOT_PATH,
    },
  });

  app.get('/api/creative/bootstrap', async (_req, res) => {
    res.json(creativeState);
  });

  app.post('/api/creative/import/jaaz', async (req, res) => {
    try {
      const { jaazAdapter } = await import('./lib/adapters/jaaz-adapter.js');
      const importedProjects = Array.isArray(req.body?.projects)
        ? req.body.projects.map((entry) => jaazAdapter.normalizeProject(entry)).filter(Boolean)
        : [];
      const importedDocuments = Array.isArray(req.body?.documents)
        ? req.body.documents.map((entry) => jaazAdapter.normalizeDocument(entry)).filter(Boolean)
        : [];
      const importedJobs = Array.isArray(req.body?.jobs)
        ? req.body.jobs.map((entry) => jaazAdapter.normalizeJob(entry)).filter(Boolean)
        : [];
      const importedAssets = Array.isArray(req.body?.assets)
        ? req.body.assets.map((entry) => jaazAdapter.normalizeAsset(entry)).filter(Boolean)
        : [];

      const importedAt = nowTimestamp();
      for (const project of importedProjects) {
        creativeState.projects.unshift({ ...project, createdAt: importedAt, updatedAt: importedAt });
      }
      for (const document of importedDocuments) {
        creativeState.documents.unshift({ ...document, createdAt: importedAt, updatedAt: importedAt });
      }
      for (const job of importedJobs) {
        creativeState.jobs.unshift({ ...job, createdAt: importedAt, updatedAt: importedAt });
      }
      for (const asset of importedAssets) {
        creativeState.assets.unshift({ ...asset, createdAt: importedAt, updatedAt: importedAt });
      }

      return res.status(201).json({
        source: 'jaaz',
        imported: {
          projects: importedProjects.length,
          documents: importedDocuments.length,
          jobs: importedJobs.length,
          assets: importedAssets.length,
        },
      });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to import Jaaz payload',
      });
    }
  });

  app.get('/api/creative/projects', async (_req, res) => {
    res.json({ projects: creativeState.projects });
  });

  app.post('/api/creative/projects', async (req, res) => {
    const name = normalizeOptionalString(req.body?.name);
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }
    const project = {
      id: createId('creative_project'),
      name,
      description: normalizeOptionalString(req.body?.description) || null,
      createdAt: nowTimestamp(),
      updatedAt: nowTimestamp(),
    };
    creativeState.projects.unshift(project);
    return res.status(201).json(project);
  });

  app.get('/api/creative/documents', async (req, res) => {
    const projectId = normalizeOptionalString(req.query?.projectId);
    const documents = projectId ? creativeState.documents.filter((document) => document.projectId === projectId) : creativeState.documents;
    res.json({ documents });
  });

  app.post('/api/creative/documents', async (req, res) => {
    const projectId = normalizeOptionalString(req.body?.projectId);
    const name = normalizeOptionalString(req.body?.name);
    if (!projectId || !name) {
      return res.status(400).json({ error: 'projectId and name are required' });
    }
    const document = {
      id: createId('creative_document'),
      projectId,
      name,
      content: typeof req.body?.content === 'string' ? req.body.content : '',
      createdAt: nowTimestamp(),
      updatedAt: nowTimestamp(),
    };
    creativeState.documents.unshift(document);
    return res.status(201).json(document);
  });

  app.get('/api/creative/jobs', async (req, res) => {
    const projectId = normalizeOptionalString(req.query?.projectId);
    const jobs = projectId ? creativeState.jobs.filter((job) => job.projectId === projectId) : creativeState.jobs;
    res.json({ jobs });
  });

  app.get('/api/creative/assets', async (req, res) => {
    const projectId = normalizeOptionalString(req.query?.projectId);
    const assets = projectId ? creativeState.assets.filter((asset) => asset.projectId === projectId) : creativeState.assets;
    res.json({ assets });
  });

  registerCanvasRoutes({
    app,
    state: canvasState,
    helpers: {
      createId,
      normalizeOptionalString,
      nowTimestamp,
      repoRootPath: REPO_ROOT_PATH,
    },
  });

  const {
    getAgentSources,
    getAgentScope,
    getAgentConfig,
    createAgent,
    updateAgent,
    deleteAgent,
    getCommandSources,
    getCommandScope,
    createCommand,
    updateCommand,
    deleteCommand,
    getProviderSources,
    removeProviderConfig,
    AGENT_SCOPE,
    COMMAND_SCOPE,
    listMcpConfigs,
    getMcpConfig,
    createMcpConfig,
    updateMcpConfig,
    deleteMcpConfig,
    getMcpMarketplaceIntegrations,
    getMcpMarketplaceIntegration,
    searchMcpMarketplace,
  } = await import('./lib/opencode/index.js');

  app.get('/api/config/agents/:name', async (req, res) => {
    try {
      const agentName = req.params.name;
      const { directory, error } = await resolveProjectDirectory(req);
      if (!directory) {
        return res.status(400).json({ error });
      }
      const sources = getAgentSources(agentName, directory);

      const scope = sources.md.exists ? sources.md.scope : sources.json.exists ? sources.json.scope : null;

      res.json({
        name: agentName,
        sources: sources,
        scope,
        isBuiltIn: !sources.md.exists && !sources.json.exists,
      });
    } catch (error) {
      console.error('Failed to get agent sources:', error);
      res.status(500).json({ error: 'Failed to get agent configuration metadata' });
    }
  });

  app.get('/api/config/agents/:name/config', async (req, res) => {
    try {
      const agentName = req.params.name;
      const { directory, error } = await resolveProjectDirectory(req);
      if (!directory) {
        return res.status(400).json({ error });
      }

      const configInfo = getAgentConfig(agentName, directory);
      res.json(configInfo);
    } catch (error) {
      console.error('Failed to get agent config:', error);
      res.status(500).json({ error: 'Failed to get agent configuration' });
    }
  });

  app.post('/api/config/agents/:name', async (req, res) => {
    try {
      const agentName = req.params.name;
      const { scope, ...config } = req.body;
      const { directory, error } = await resolveProjectDirectory(req);
      if (!directory) {
        return res.status(400).json({ error });
      }

      console.log('[Server] Creating agent:', agentName);
      console.log('[Server] Config received:', JSON.stringify(config, null, 2));
      console.log('[Server] Scope:', scope, 'Working directory:', directory);

      createAgent(agentName, config, directory, scope);
      await refreshOpenCodeAfterConfigChange('agent creation', {
        agentName,
      });

      res.json({
        success: true,
        requiresReload: true,
        message: `Agent ${agentName} created successfully. Reloading interface…`,
        reloadDelayMs: CLIENT_RELOAD_DELAY_MS,
      });
    } catch (error) {
      console.error('Failed to create agent:', error);
      res.status(500).json({ error: error.message || 'Failed to create agent' });
    }
  });

  app.patch('/api/config/agents/:name', async (req, res) => {
    try {
      const agentName = req.params.name;
      const updates = req.body;
      const { directory, error } = await resolveProjectDirectory(req);
      if (!directory) {
        return res.status(400).json({ error });
      }

      console.log(`[Server] Updating agent: ${agentName}`);
      console.log('[Server] Updates:', JSON.stringify(updates, null, 2));
      console.log('[Server] Working directory:', directory);

      updateAgent(agentName, updates, directory);
      await refreshOpenCodeAfterConfigChange('agent update');

      console.log(`[Server] Agent ${agentName} updated successfully`);

      res.json({
        success: true,
        requiresReload: true,
        message: `Agent ${agentName} updated successfully. Reloading interface…`,
        reloadDelayMs: CLIENT_RELOAD_DELAY_MS,
      });
    } catch (error) {
      console.error('[Server] Failed to update agent:', error);
      console.error('[Server] Error stack:', error.stack);
      res.status(500).json({ error: error.message || 'Failed to update agent' });
    }
  });

  app.delete('/api/config/agents/:name', async (req, res) => {
    try {
      const agentName = req.params.name;
      const { directory, error } = await resolveProjectDirectory(req);
      if (!directory) {
        return res.status(400).json({ error });
      }

      deleteAgent(agentName, directory);
      await refreshOpenCodeAfterConfigChange('agent deletion');

      res.json({
        success: true,
        requiresReload: true,
        message: `Agent ${agentName} deleted successfully. Reloading interface…`,
        reloadDelayMs: CLIENT_RELOAD_DELAY_MS,
      });
    } catch (error) {
      console.error('Failed to delete agent:', error);
      res.status(500).json({ error: error.message || 'Failed to delete agent' });
    }
  });

  // ============================================================
  // MCP Config Routes
  // ============================================================

  app.get('/api/config/mcp/marketplace', async (req, res) => {
    try {
      const query = typeof req.query.q === 'string' ? req.query.q : '';
      const integrations = await searchMcpMarketplace(query);
      res.json({ success: true, integrations });
    } catch (error) {
      console.error('[API:GET /api/config/mcp/marketplace] Failed:', error);
      res.status(500).json({ error: error.message || 'Failed to list marketplace integrations' });
    }
  });

  app.get('/api/config/mcp/marketplace/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const integration = await getMcpMarketplaceIntegration(id);
      if (!integration) {
        return res.status(404).json({ error: `Marketplace integration "${id}" not found` });
      }
      res.json({ success: true, integration });
    } catch (error) {
      console.error('[API:GET /api/config/mcp/marketplace/:id] Failed:', error);
      res.status(500).json({ error: error.message || 'Failed to get marketplace integration' });
    }
  });

  app.get('/api/config/mcp', async (req, res) => {
    try {
      const { directory, error } = await resolveOptionalProjectDirectory(req);
      if (error) {
        return res.status(400).json({ error });
      }
      const configs = listMcpConfigs(directory);
      res.json(configs);
    } catch (error) {
      console.error('[API:GET /api/config/mcp] Failed:', error);
      res.status(500).json({ error: error.message || 'Failed to list MCP configs' });
    }
  });

  app.get('/api/config/mcp/:name', async (req, res) => {
    try {
      const name = req.params.name;
      const { directory, error } = await resolveOptionalProjectDirectory(req);
      if (error) {
        return res.status(400).json({ error });
      }
      const config = getMcpConfig(name, directory);
      if (!config) {
        return res.status(404).json({ error: `MCP server "${name}" not found` });
      }
      res.json(config);
    } catch (error) {
      console.error('[API:GET /api/config/mcp/:name] Failed:', error);
      res.status(500).json({ error: error.message || 'Failed to get MCP config' });
    }
  });

  app.post('/api/config/mcp/:name', async (req, res) => {
    try {
      const name = req.params.name;
      const { scope, ...config } = req.body || {};
      const { directory, error } = await resolveOptionalProjectDirectory(req);
      if (error) {
        return res.status(400).json({ error });
      }
      console.log(`[API:POST /api/config/mcp] Creating MCP server: ${name}`);

      createMcpConfig(name, config, directory, scope);
      await refreshOpenCodeAfterConfigChange('mcp creation', { mcpName: name });

      res.json({
        success: true,
        requiresReload: true,
        message: `MCP server "${name}" created. Reloading interface…`,
        reloadDelayMs: CLIENT_RELOAD_DELAY_MS,
      });
    } catch (error) {
      console.error('[API:POST /api/config/mcp/:name] Failed:', error);
      res.status(500).json({ error: error.message || 'Failed to create MCP server' });
    }
  });

  app.patch('/api/config/mcp/:name', async (req, res) => {
    try {
      const name = req.params.name;
      const updates = req.body;
      const { directory, error } = await resolveOptionalProjectDirectory(req);
      if (error) {
        return res.status(400).json({ error });
      }
      console.log(`[API:PATCH /api/config/mcp] Updating MCP server: ${name}`);

      updateMcpConfig(name, updates, directory);
      await refreshOpenCodeAfterConfigChange('mcp update');

      res.json({
        success: true,
        requiresReload: true,
        message: `MCP server "${name}" updated. Reloading interface…`,
        reloadDelayMs: CLIENT_RELOAD_DELAY_MS,
      });
    } catch (error) {
      console.error('[API:PATCH /api/config/mcp/:name] Failed:', error);
      res.status(500).json({ error: error.message || 'Failed to update MCP server' });
    }
  });

  app.delete('/api/config/mcp/:name', async (req, res) => {
    try {
      const name = req.params.name;
      const { directory, error } = await resolveOptionalProjectDirectory(req);
      if (error) {
        return res.status(400).json({ error });
      }
      console.log(`[API:DELETE /api/config/mcp] Deleting MCP server: ${name}`);

      deleteMcpConfig(name, directory);
      await refreshOpenCodeAfterConfigChange('mcp deletion');

      res.json({
        success: true,
        requiresReload: true,
        message: `MCP server "${name}" deleted. Reloading interface…`,
        reloadDelayMs: CLIENT_RELOAD_DELAY_MS,
      });
    } catch (error) {
      console.error('[API:DELETE /api/config/mcp/:name] Failed:', error);
      res.status(500).json({ error: error.message || 'Failed to delete MCP server' });
    }
  });

  app.get('/api/config/commands/:name', async (req, res) => {
    try {
      const commandName = req.params.name;
      const { directory, error } = await resolveProjectDirectory(req);
      if (!directory) {
        return res.status(400).json({ error });
      }
      const sources = getCommandSources(commandName, directory);

      const scope = sources.md.exists ? sources.md.scope : sources.json.exists ? sources.json.scope : null;

      res.json({
        name: commandName,
        sources: sources,
        scope,
        isBuiltIn: !sources.md.exists && !sources.json.exists,
      });
    } catch (error) {
      console.error('Failed to get command sources:', error);
      res.status(500).json({ error: 'Failed to get command configuration metadata' });
    }
  });

  app.post('/api/config/commands/:name', async (req, res) => {
    try {
      const commandName = req.params.name;
      const { scope, ...config } = req.body;
      const { directory, error } = await resolveProjectDirectory(req);
      if (!directory) {
        return res.status(400).json({ error });
      }

      console.log('[Server] Creating command:', commandName);
      console.log('[Server] Config received:', JSON.stringify(config, null, 2));
      console.log('[Server] Scope:', scope, 'Working directory:', directory);

      createCommand(commandName, config, directory, scope);
      await refreshOpenCodeAfterConfigChange('command creation', {
        commandName,
      });

      res.json({
        success: true,
        requiresReload: true,
        message: `Command ${commandName} created successfully. Reloading interface…`,
        reloadDelayMs: CLIENT_RELOAD_DELAY_MS,
      });
    } catch (error) {
      console.error('Failed to create command:', error);
      res.status(500).json({ error: error.message || 'Failed to create command' });
    }
  });

  app.patch('/api/config/commands/:name', async (req, res) => {
    try {
      const commandName = req.params.name;
      const updates = req.body;
      const { directory, error } = await resolveProjectDirectory(req);
      if (!directory) {
        return res.status(400).json({ error });
      }

      console.log(`[Server] Updating command: ${commandName}`);
      console.log('[Server] Updates:', JSON.stringify(updates, null, 2));
      console.log('[Server] Working directory:', directory);

      updateCommand(commandName, updates, directory);
      await refreshOpenCodeAfterConfigChange('command update');

      console.log(`[Server] Command ${commandName} updated successfully`);

      res.json({
        success: true,
        requiresReload: true,
        message: `Command ${commandName} updated successfully. Reloading interface…`,
        reloadDelayMs: CLIENT_RELOAD_DELAY_MS,
      });
    } catch (error) {
      console.error('[Server] Failed to update command:', error);
      console.error('[Server] Error stack:', error.stack);
      res.status(500).json({ error: error.message || 'Failed to update command' });
    }
  });

  app.delete('/api/config/commands/:name', async (req, res) => {
    try {
      const commandName = req.params.name;
      const { directory, error } = await resolveProjectDirectory(req);
      if (!directory) {
        return res.status(400).json({ error });
      }

      deleteCommand(commandName, directory);
      await refreshOpenCodeAfterConfigChange('command deletion');

      res.json({
        success: true,
        requiresReload: true,
        message: `Command ${commandName} deleted successfully. Reloading interface…`,
        reloadDelayMs: CLIENT_RELOAD_DELAY_MS,
      });
    } catch (error) {
      console.error('Failed to delete command:', error);
      res.status(500).json({ error: error.message || 'Failed to delete command' });
    }
  });

  // ============== SKILL ENDPOINTS ==============

  const {
    getSkillSources,
    discoverSkills,
    createSkill,
    updateSkill,
    deleteSkill,
    readSkillSupportingFile,
    writeSkillSupportingFile,
    deleteSkillSupportingFile,
    SKILL_SCOPE,
    SKILL_DIR,
  } = await import('./lib/opencode/index.js');

  const findWorktreeRootForSkills = (workingDirectory) => {
    if (!workingDirectory) return null;
    let current = path.resolve(workingDirectory);
    while (true) {
      if (fs.existsSync(path.join(current, '.git'))) {
        return current;
      }
      const parent = path.dirname(current);
      if (parent === current) {
        return null;
      }
      current = parent;
    }
  };

  const getSkillProjectAncestors = (workingDirectory) => {
    if (!workingDirectory) return [];
    const result = [];
    let current = path.resolve(workingDirectory);
    const stop = findWorktreeRootForSkills(workingDirectory) || current;
    while (true) {
      result.push(current);
      if (current === stop) break;
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
    return result;
  };

  const isPathInside = (candidatePath, parentPath) => {
    if (!candidatePath || !parentPath) return false;
    const normalizedCandidate = path.resolve(candidatePath);
    const normalizedParent = path.resolve(parentPath);
    return normalizedCandidate === normalizedParent || normalizedCandidate.startsWith(`${normalizedParent}${path.sep}`);
  };

  const inferSkillScopeAndSourceFromPath = (skillPath, workingDirectory) => {
    const resolvedPath = typeof skillPath === 'string' ? path.resolve(skillPath) : '';
    const home = os.homedir();
    const source = resolvedPath.includes(`${path.sep}.agents${path.sep}skills${path.sep}`)
      ? 'agents'
      : resolvedPath.includes(`${path.sep}.claude${path.sep}skills${path.sep}`)
        ? 'claude'
        : 'opencode';

    const projectAncestors = getSkillProjectAncestors(workingDirectory);
    const isProjectScoped = projectAncestors.some((ancestor) => {
      const candidates = [
        path.join(ancestor, '.opencode'),
        path.join(ancestor, '.claude', 'skills'),
        path.join(ancestor, '.agents', 'skills'),
      ];
      return candidates.some((candidate) => isPathInside(resolvedPath, candidate));
    });

    if (isProjectScoped) {
      return { scope: SKILL_SCOPE.PROJECT, source };
    }

    const userRoots = [
      path.join(home, '.config', 'kronoscode'),
      path.join(home, '.kronoscode'),
      path.join(home, '.config', 'opencode'),
      path.join(home, '.opencode'),
      path.join(home, '.claude', 'skills'),
      path.join(home, '.agents', 'skills'),
      process.env.KRONOSCODE_CONFIG_DIR ? path.resolve(process.env.KRONOSCODE_CONFIG_DIR) : null,
      process.env.OPENCODE_CONFIG_DIR ? path.resolve(process.env.OPENCODE_CONFIG_DIR) : null,
    ].filter(Boolean);

    if (userRoots.some((root) => isPathInside(resolvedPath, root))) {
      return { scope: SKILL_SCOPE.USER, source };
    }

    return { scope: SKILL_SCOPE.USER, source };
  };

  const fetchOpenCodeDiscoveredSkills = async (workingDirectory) => {
    if (!openCodePort) {
      return null;
    }

    try {
      const url = new URL(buildOpenCodeUrl('/skill', ''));
      if (workingDirectory) {
        url.searchParams.set('directory', workingDirectory);
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...getOpenCodeAuthHeaders(),
        },
        signal: AbortSignal.timeout(8_000),
      });

      if (!response.ok) {
        return null;
      }

      const payload = await response.json();
      if (!Array.isArray(payload)) {
        return null;
      }

      return payload
        .map((item) => {
          const name = typeof item?.name === 'string' ? item.name.trim() : '';
          const location = typeof item?.location === 'string' ? item.location : '';
          const description = typeof item?.description === 'string' ? item.description : '';
          if (!name || !location) {
            return null;
          }
          const inferred = inferSkillScopeAndSourceFromPath(location, workingDirectory);
          return {
            name,
            path: location,
            scope: inferred.scope,
            source: inferred.source,
            description,
          };
        })
        .filter(Boolean);
    } catch {
      return null;
    }
  };

  // List all discovered skills
  app.get('/api/config/skills', async (req, res) => {
    try {
      const { directory, error } = await resolveProjectDirectory(req);
      if (!directory) {
        return res.status(400).json({ error });
      }
      const skills = (await fetchOpenCodeDiscoveredSkills(directory)) || discoverSkills(directory);

      // Enrich with full sources info
      const enrichedSkills = skills.map((skill) => {
        const sources = getSkillSources(skill.name, directory, skill);
        return {
          ...skill,
          sources,
        };
      });

      res.json({ skills: enrichedSkills });
    } catch (error) {
      console.error('Failed to list skills:', error);
      res.status(500).json({ error: 'Failed to list skills' });
    }
  });

  // ============== SKILLS CATALOG + INSTALL ENDPOINTS ==============

  const { getCuratedSkillsSources } = await import('./lib/skills-catalog/curated-sources.js');
  const { getCacheKey, getCachedScan, setCachedScan } = await import('./lib/skills-catalog/cache.js');
  const { parseSkillRepoSource } = await import('./lib/skills-catalog/source.js');
  const { scanSkillsRepository } = await import('./lib/skills-catalog/scan.js');
  const { installSkillsFromRepository } = await import('./lib/skills-catalog/install.js');
  const { scanClawdHubPage, installSkillsFromClawdHub, isClawdHubSource } = await import('./lib/skills-catalog/clawdhub/index.js');
  const { getProfiles, getProfile } = await import('./lib/git/index.js');

  const listGitIdentitiesForResponse = () => {
    try {
      const profiles = getProfiles();
      return profiles.map((p) => ({ id: p.id, name: p.name }));
    } catch {
      return [];
    }
  };

  const resolveGitIdentity = (profileId) => {
    if (!profileId) {
      return null;
    }
    try {
      const profile = getProfile(profileId);
      const sshKey = profile?.sshKey;
      if (typeof sshKey === 'string' && sshKey.trim()) {
        return { sshKey: sshKey.trim() };
      }
    } catch {
      // ignore
    }
    return null;
  };

  app.get('/api/config/skills/catalog', async (req, res) => {
    try {
      const { error } = await resolveOptionalProjectDirectory(req);
      if (error) {
        return res.status(400).json({ error });
      }

      const curatedSources = getCuratedSkillsSources();
      const settings = await readSettingsFromDisk();
      const customSourcesRaw = sanitizeSkillCatalogs(settings.skillCatalogs) || [];

      const customSources = customSourcesRaw.map((entry) => ({
        id: entry.id,
        label: entry.label,
        description: entry.source,
        source: entry.source,
        defaultSubpath: entry.subpath,
        gitIdentityId: entry.gitIdentityId,
      }));

      const sources = [...curatedSources, ...customSources];
      const sourcesForUi = sources.map(({ gitIdentityId, ...rest }) => rest);

      res.json({ ok: true, sources: sourcesForUi, itemsBySource: {}, pageInfoBySource: {} });
    } catch (error) {
      console.error('Failed to load skills catalog:', error);
      res.status(500).json({ ok: false, error: { kind: 'unknown', message: error.message || 'Failed to load catalog' } });
    }
  });

  app.get('/api/config/skills/catalog/source', async (req, res) => {
    try {
      const { directory, error } = await resolveOptionalProjectDirectory(req);
      if (error) {
        return res.status(400).json({ ok: false, error: { kind: 'invalidSource', message: error } });
      }

      const sourceId = typeof req.query.sourceId === 'string' ? req.query.sourceId : null;
      if (!sourceId) {
        return res.status(400).json({ ok: false, error: { kind: 'invalidSource', message: 'Missing sourceId' } });
      }

      const refresh = String(req.query.refresh || '').toLowerCase() === 'true';
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : null;

      const curatedSources = getCuratedSkillsSources();
      const settings = await readSettingsFromDisk();
      const customSourcesRaw = sanitizeSkillCatalogs(settings.skillCatalogs) || [];

      const customSources = customSourcesRaw.map((entry) => ({
        id: entry.id,
        label: entry.label,
        description: entry.source,
        source: entry.source,
        defaultSubpath: entry.subpath,
        gitIdentityId: entry.gitIdentityId,
      }));

      const sources = [...curatedSources, ...customSources];
      const src = sources.find((entry) => entry.id === sourceId);

      if (!src) {
        return res.status(404).json({ ok: false, error: { kind: 'invalidSource', message: 'Unknown source' } });
      }

      const discovered = directory ? (await fetchOpenCodeDiscoveredSkills(directory)) || discoverSkills(directory) : [];
      const installedByName = new Map(discovered.map((s) => [s.name, s]));

      if (src.sourceType === 'clawdhub' || isClawdHubSource(src.source)) {
        const scanned = await scanClawdHubPage({ cursor: cursor || null });
        if (!scanned.ok) {
          return res.status(500).json({ ok: false, error: scanned.error });
        }

        const items = (scanned.items || []).map((item) => {
          const installed = installedByName.get(item.skillName);
          return {
            ...item,
            sourceId: src.id,
            installed: installed ? { isInstalled: true, scope: installed.scope, source: installed.source } : { isInstalled: false },
          };
        });

        return res.json({ ok: true, items, nextCursor: scanned.nextCursor || null });
      }

      const parsed = parseSkillRepoSource(src.source);
      if (!parsed.ok) {
        return res.status(400).json({ ok: false, error: parsed.error });
      }

      const effectiveSubpath = src.defaultSubpath || parsed.effectiveSubpath || null;
      const cacheKey = getCacheKey({
        normalizedRepo: parsed.normalizedRepo,
        subpath: effectiveSubpath || '',
        identityId: src.gitIdentityId || '',
      });

      let scanResult = !refresh ? getCachedScan(cacheKey) : null;
      if (!scanResult) {
        const scanned = await scanSkillsRepository({
          source: src.source,
          subpath: src.defaultSubpath,
          defaultSubpath: src.defaultSubpath,
          identity: resolveGitIdentity(src.gitIdentityId),
        });

        if (!scanned.ok) {
          return res.status(500).json({ ok: false, error: scanned.error });
        }

        scanResult = scanned;
        setCachedScan(cacheKey, scanResult);
      }

      const items = (scanResult.items || []).map((item) => {
        const installed = installedByName.get(item.skillName);
        return {
          sourceId: src.id,
          ...item,
          gitIdentityId: src.gitIdentityId,
          installed: installed ? { isInstalled: true, scope: installed.scope, source: installed.source } : { isInstalled: false },
        };
      });

      return res.json({ ok: true, items });
    } catch (error) {
      console.error('Failed to load catalog source:', error);
      return res.status(500).json({
        ok: false,
        error: { kind: 'unknown', message: error.message || 'Failed to load catalog source' },
      });
    }
  });

  app.post('/api/config/skills/scan', async (req, res) => {
    try {
      const { source, subpath, gitIdentityId } = req.body || {};
      const identity = resolveGitIdentity(gitIdentityId);

      const result = await scanSkillsRepository({
        source,
        subpath,
        identity,
      });

      if (!result.ok) {
        if (result.error?.kind === 'authRequired') {
          return res.status(401).json({
            ok: false,
            error: {
              ...result.error,
              identities: listGitIdentitiesForResponse(),
            },
          });
        }

        return res.status(400).json({ ok: false, error: result.error });
      }

      res.json({ ok: true, items: result.items });
    } catch (error) {
      console.error('Failed to scan skills repository:', error);
      res.status(500).json({ ok: false, error: { kind: 'unknown', message: error.message || 'Failed to scan repository' } });
    }
  });

  app.post('/api/config/skills/install', async (req, res) => {
    try {
      const { source, subpath, gitIdentityId, scope, targetSource, selections, conflictPolicy, conflictDecisions } = req.body || {};

      let workingDirectory = null;
      if (scope === 'project') {
        const resolved = await resolveProjectDirectory(req);
        if (!resolved.directory) {
          return res.status(400).json({
            ok: false,
            error: {
              kind: 'invalidSource',
              message: resolved.error || 'Project installs require a directory parameter',
            },
          });
        }
        workingDirectory = resolved.directory;
      }

      // Handle ClawdHub sources (ZIP download based)
      if (isClawdHubSource(source)) {
        const result = await installSkillsFromClawdHub({
          scope,
          targetSource,
          workingDirectory,
          userSkillDir: SKILL_DIR,
          selections,
          conflictPolicy,
          conflictDecisions,
        });

        if (!result.ok) {
          if (result.error?.kind === 'conflicts') {
            return res.status(409).json({ ok: false, error: result.error });
          }
          return res.status(400).json({ ok: false, error: result.error });
        }

        const installed = result.installed || [];
        const skipped = result.skipped || [];
        const requiresReload = installed.length > 0;

        if (requiresReload) {
          await refreshOpenCodeAfterConfigChange('skills install');
        }

        return res.json({
          ok: true,
          installed,
          skipped,
          requiresReload,
          message: requiresReload ? 'Skills installed successfully. Reloading interface…' : 'No skills were installed',
          reloadDelayMs: requiresReload ? CLIENT_RELOAD_DELAY_MS : undefined,
        });
      }

      // Handle GitHub sources (git clone based)
      const identity = resolveGitIdentity(gitIdentityId);

      const result = await installSkillsFromRepository({
        source,
        subpath,
        identity,
        scope,
        targetSource,
        workingDirectory,
        userSkillDir: SKILL_DIR,
        selections,
        conflictPolicy,
        conflictDecisions,
      });

      if (!result.ok) {
        if (result.error?.kind === 'conflicts') {
          return res.status(409).json({ ok: false, error: result.error });
        }

        if (result.error?.kind === 'authRequired') {
          return res.status(401).json({
            ok: false,
            error: {
              ...result.error,
              identities: listGitIdentitiesForResponse(),
            },
          });
        }

        return res.status(400).json({ ok: false, error: result.error });
      }

      const installed = result.installed || [];
      const skipped = result.skipped || [];
      const requiresReload = installed.length > 0;

      if (requiresReload) {
        await refreshOpenCodeAfterConfigChange('skills install');
      }

      res.json({
        ok: true,
        installed,
        skipped,
        requiresReload,
        message: requiresReload ? 'Skills installed successfully. Reloading interface…' : 'No skills were installed',
        reloadDelayMs: requiresReload ? CLIENT_RELOAD_DELAY_MS : undefined,
      });
    } catch (error) {
      console.error('Failed to install skills:', error);
      res.status(500).json({ ok: false, error: { kind: 'unknown', message: error.message || 'Failed to install skills' } });
    }
  });

  // Get single skill sources
  app.get('/api/config/skills/:name', async (req, res) => {
    try {
      const skillName = req.params.name;
      const { directory, error } = await resolveProjectDirectory(req);
      if (!directory) {
        return res.status(400).json({ error });
      }
      const discoveredSkill = ((await fetchOpenCodeDiscoveredSkills(directory)) || []).find((skill) => skill.name === skillName) || null;
      const sources = getSkillSources(skillName, directory, discoveredSkill);

      res.json({
        name: skillName,
        sources: sources,
        scope: sources.md.scope,
        source: sources.md.source,
        exists: sources.md.exists,
      });
    } catch (error) {
      console.error('Failed to get skill sources:', error);
      res.status(500).json({ error: 'Failed to get skill configuration metadata' });
    }
  });

  // Get skill supporting file content
  app.get('/api/config/skills/:name/files/*filePath', async (req, res) => {
    try {
      const skillName = req.params.name;
      const filePath = decodeURIComponent(req.params.filePath); // Decode URL-encoded path
      const { directory, error } = await resolveProjectDirectory(req);
      if (!directory) {
        return res.status(400).json({ error });
      }

      const discoveredSkill = ((await fetchOpenCodeDiscoveredSkills(directory)) || []).find((skill) => skill.name === skillName) || null;
      const sources = getSkillSources(skillName, directory, discoveredSkill);
      if (!sources.md.exists || !sources.md.dir) {
        return res.status(404).json({ error: 'Skill not found' });
      }

      const content = readSkillSupportingFile(sources.md.dir, filePath);
      if (content === null) {
        return res.status(404).json({ error: 'File not found' });
      }

      res.json({ path: filePath, content });
    } catch (error) {
      console.error('Failed to read skill file:', error);
      res.status(500).json({ error: 'Failed to read skill file' });
    }
  });

  // Create new skill
  app.post('/api/config/skills/:name', async (req, res) => {
    try {
      const skillName = req.params.name;
      const { scope, source: skillSource, ...config } = req.body;
      const { directory, error } = await resolveProjectDirectory(req);
      if (!directory) {
        return res.status(400).json({ error });
      }

      console.log('[Server] Creating skill:', skillName);
      console.log('[Server] Scope:', scope, 'Working directory:', directory);

      createSkill(skillName, { ...config, source: skillSource }, directory, scope);
      await refreshOpenCodeAfterConfigChange('skill creation');

      res.json({
        success: true,
        requiresReload: true,
        message: `Skill ${skillName} created successfully. Reloading interface…`,
        reloadDelayMs: CLIENT_RELOAD_DELAY_MS,
      });
    } catch (error) {
      console.error('Failed to create skill:', error);
      res.status(500).json({ error: error.message || 'Failed to create skill' });
    }
  });

  // Update existing skill
  app.patch('/api/config/skills/:name', async (req, res) => {
    try {
      const skillName = req.params.name;
      const updates = req.body;
      const { directory, error } = await resolveProjectDirectory(req);
      if (!directory) {
        return res.status(400).json({ error });
      }

      console.log(`[Server] Updating skill: ${skillName}`);
      console.log('[Server] Working directory:', directory);

      updateSkill(skillName, updates, directory);
      await refreshOpenCodeAfterConfigChange('skill update');

      res.json({
        success: true,
        requiresReload: true,
        message: `Skill ${skillName} updated successfully. Reloading interface…`,
        reloadDelayMs: CLIENT_RELOAD_DELAY_MS,
      });
    } catch (error) {
      console.error('[Server] Failed to update skill:', error);
      res.status(500).json({ error: error.message || 'Failed to update skill' });
    }
  });

  // Update/create supporting file
  app.put('/api/config/skills/:name/files/*filePath', async (req, res) => {
    try {
      const skillName = req.params.name;
      const filePath = decodeURIComponent(req.params.filePath); // Decode URL-encoded path
      const { content } = req.body;
      const { directory, error } = await resolveProjectDirectory(req);
      if (!directory) {
        return res.status(400).json({ error });
      }

      const discoveredSkill = ((await fetchOpenCodeDiscoveredSkills(directory)) || []).find((skill) => skill.name === skillName) || null;
      const sources = getSkillSources(skillName, directory, discoveredSkill);
      if (!sources.md.exists || !sources.md.dir) {
        return res.status(404).json({ error: 'Skill not found' });
      }

      writeSkillSupportingFile(sources.md.dir, filePath, content || '');

      res.json({
        success: true,
        message: `File ${filePath} saved successfully`,
      });
    } catch (error) {
      console.error('Failed to write skill file:', error);
      res.status(500).json({ error: error.message || 'Failed to write skill file' });
    }
  });

  // Delete supporting file
  app.delete('/api/config/skills/:name/files/*filePath', async (req, res) => {
    try {
      const skillName = req.params.name;
      const filePath = decodeURIComponent(req.params.filePath); // Decode URL-encoded path
      const { directory, error } = await resolveProjectDirectory(req);
      if (!directory) {
        return res.status(400).json({ error });
      }

      const discoveredSkill = ((await fetchOpenCodeDiscoveredSkills(directory)) || []).find((skill) => skill.name === skillName) || null;
      const sources = getSkillSources(skillName, directory, discoveredSkill);
      if (!sources.md.exists || !sources.md.dir) {
        return res.status(404).json({ error: 'Skill not found' });
      }

      deleteSkillSupportingFile(sources.md.dir, filePath);

      res.json({
        success: true,
        message: `File ${filePath} deleted successfully`,
      });
    } catch (error) {
      console.error('Failed to delete skill file:', error);
      res.status(500).json({ error: error.message || 'Failed to delete skill file' });
    }
  });

  // Delete skill
  app.delete('/api/config/skills/:name', async (req, res) => {
    try {
      const skillName = req.params.name;
      const { directory, error } = await resolveProjectDirectory(req);
      if (!directory) {
        return res.status(400).json({ error });
      }

      deleteSkill(skillName, directory);
      await refreshOpenCodeAfterConfigChange('skill deletion');

      res.json({
        success: true,
        requiresReload: true,
        message: `Skill ${skillName} deleted successfully. Reloading interface…`,
        reloadDelayMs: CLIENT_RELOAD_DELAY_MS,
      });
    } catch (error) {
      console.error('Failed to delete skill:', error);
      res.status(500).json({ error: error.message || 'Failed to delete skill' });
    }
  });

  app.post('/api/config/reload', async (req, res) => {
    try {
      console.log('[Server] Manual configuration reload requested');

      await refreshOpenCodeAfterConfigChange('manual configuration reload');

      res.json({
        success: true,
        requiresReload: true,
        message: 'Configuration reloaded successfully. Refreshing interface…',
        reloadDelayMs: CLIENT_RELOAD_DELAY_MS,
      });
    } catch (error) {
      console.error('[Server] Failed to reload configuration:', error);
      res.status(500).json({
        error: error.message || 'Failed to reload configuration',
        success: false,
      });
    }
  });

  let authLibrary = null;
  const getAuthLibrary = async () => {
    if (!authLibrary) {
      authLibrary = await import('./lib/opencode/auth.js');
    }
    return authLibrary;
  };

  let quotaProviders = null;
  const getQuotaProviders = async () => {
    if (!quotaProviders) {
      quotaProviders = await import('./lib/quota/index.js');
    }
    return quotaProviders;
  };

  // ================= GitHub OAuth (Device Flow) =================

  // Note: scopes may be overridden via OPENCHAMBER_GITHUB_SCOPES or settings.json (see lib/github/auth.js).

  let githubLibraries = null;
  const getGitHubLibraries = async () => {
    if (!githubLibraries) {
      githubLibraries = await import('./lib/github/index.js');
    }
    return githubLibraries;
  };

  const getGitHubUserSummary = async (octokit) => {
    const me = await octokit.rest.users.getAuthenticated();

    let email = typeof me.data.email === 'string' ? me.data.email : null;
    if (!email) {
      try {
        const emails = await octokit.rest.users.listEmailsForAuthenticatedUser({ per_page: 100 });
        const list = Array.isArray(emails?.data) ? emails.data : [];
        const primaryVerified = list.find((e) => e && e.primary && e.verified && typeof e.email === 'string');
        const anyVerified = list.find((e) => e && e.verified && typeof e.email === 'string');
        email = primaryVerified?.email || anyVerified?.email || null;
      } catch {
        // ignore (scope might be missing)
      }
    }

    return {
      login: me.data.login,
      id: me.data.id,
      avatarUrl: me.data.avatar_url,
      name: typeof me.data.name === 'string' ? me.data.name : null,
      email,
    };
  };

  app.get('/api/github/auth/status', async (_req, res) => {
    try {
      const { getGitHubAuth, getOctokitOrNull, clearGitHubAuth, getGitHubAuthAccounts } = await getGitHubLibraries();
      const auth = getGitHubAuth();
      const accounts = getGitHubAuthAccounts();
      if (!auth?.accessToken) {
        return res.json({ connected: false, accounts });
      }

      const octokit = getOctokitOrNull();
      if (!octokit) {
        return res.json({ connected: false, accounts });
      }

      let user = null;
      try {
        user = await getGitHubUserSummary(octokit);
      } catch (error) {
        if (error?.status === 401) {
          clearGitHubAuth();
          return res.json({ connected: false, accounts: getGitHubAuthAccounts() });
        }
      }

      const fallback = auth.user;
      const mergedUser = user || fallback;

      return res.json({
        connected: true,
        user: mergedUser,
        scope: auth.scope,
        accounts,
      });
    } catch (error) {
      console.error('Failed to get GitHub auth status:', error);
      return res.status(500).json({ error: error.message || 'Failed to get GitHub auth status' });
    }
  });

  app.post('/api/github/auth/start', async (_req, res) => {
    try {
      const { getGitHubClientId, getGitHubScopes, startDeviceFlow } = await getGitHubLibraries();
      const clientId = getGitHubClientId();
      if (!clientId) {
        return res.status(400).json({
          error: 'GitHub OAuth client not configured. Set OPENCHAMBER_GITHUB_CLIENT_ID.',
        });
      }

      const scope = getGitHubScopes();

      const payload = await startDeviceFlow({
        clientId,
        scope,
      });

      return res.json({
        deviceCode: payload.device_code,
        userCode: payload.user_code,
        verificationUri: payload.verification_uri,
        verificationUriComplete: payload.verification_uri_complete,
        expiresIn: payload.expires_in,
        interval: payload.interval,
        scope,
      });
    } catch (error) {
      console.error('Failed to start GitHub device flow:', error);
      return res.status(500).json({ error: error.message || 'Failed to start GitHub device flow' });
    }
  });

  app.post('/api/github/auth/complete', async (req, res) => {
    try {
      const { getGitHubClientId, exchangeDeviceCode, setGitHubAuth, getGitHubAuthAccounts } = await getGitHubLibraries();
      const clientId = getGitHubClientId();
      if (!clientId) {
        return res.status(400).json({
          error: 'GitHub OAuth client not configured. Set OPENCHAMBER_GITHUB_CLIENT_ID.',
        });
      }

      const deviceCode =
        typeof req.body?.deviceCode === 'string'
          ? req.body.deviceCode
          : typeof req.body?.device_code === 'string'
            ? req.body.device_code
            : '';

      if (!deviceCode) {
        return res.status(400).json({ error: 'deviceCode is required' });
      }

      const payload = await exchangeDeviceCode({ clientId, deviceCode });

      if (payload?.error) {
        return res.json({
          connected: false,
          status: payload.error,
          error: payload.error_description || payload.error,
        });
      }

      const accessToken = payload?.access_token;
      if (!accessToken) {
        return res.status(500).json({ error: 'Missing access_token from GitHub' });
      }

      const { Octokit } = await import('@octokit/rest');
      const octokit = new Octokit({ auth: accessToken });
      const user = await getGitHubUserSummary(octokit);

      setGitHubAuth({
        accessToken,
        scope: typeof payload.scope === 'string' ? payload.scope : '',
        tokenType: typeof payload.token_type === 'string' ? payload.token_type : 'bearer',
        user,
      });

      return res.json({
        connected: true,
        user,
        scope: typeof payload.scope === 'string' ? payload.scope : '',
        accounts: getGitHubAuthAccounts(),
      });
    } catch (error) {
      console.error('Failed to complete GitHub device flow:', error);
      return res.status(500).json({ error: error.message || 'Failed to complete GitHub device flow' });
    }
  });

  app.post('/api/github/auth/activate', async (req, res) => {
    try {
      const { activateGitHubAuth, getGitHubAuth, getOctokitOrNull, clearGitHubAuth, getGitHubAuthAccounts } = await getGitHubLibraries();
      const accountId = typeof req.body?.accountId === 'string' ? req.body.accountId : '';
      if (!accountId) {
        return res.status(400).json({ error: 'accountId is required' });
      }
      const activated = activateGitHubAuth(accountId);
      if (!activated) {
        return res.status(404).json({ error: 'GitHub account not found' });
      }

      const auth = getGitHubAuth();
      const accounts = getGitHubAuthAccounts();
      if (!auth?.accessToken) {
        return res.json({ connected: false, accounts });
      }

      const octokit = getOctokitOrNull();
      if (!octokit) {
        return res.json({ connected: false, accounts });
      }

      let user = auth.user || null;
      try {
        user = await getGitHubUserSummary(octokit);
      } catch (error) {
        if (error?.status === 401) {
          clearGitHubAuth();
          return res.json({ connected: false, accounts: getGitHubAuthAccounts() });
        }
      }

      return res.json({
        connected: true,
        user,
        scope: auth.scope,
        accounts,
      });
    } catch (error) {
      console.error('Failed to activate GitHub account:', error);
      return res.status(500).json({ error: error.message || 'Failed to activate GitHub account' });
    }
  });

  app.delete('/api/github/auth', async (_req, res) => {
    try {
      const { clearGitHubAuth } = await getGitHubLibraries();
      const removed = clearGitHubAuth();
      return res.json({ success: true, removed });
    } catch (error) {
      console.error('Failed to disconnect GitHub:', error);
      return res.status(500).json({ error: error.message || 'Failed to disconnect GitHub' });
    }
  });

  app.get('/api/github/me', async (_req, res) => {
    try {
      const { getOctokitOrNull, clearGitHubAuth } = await getGitHubLibraries();
      const octokit = getOctokitOrNull();
      if (!octokit) {
        return res.status(401).json({ error: 'GitHub not connected' });
      }
      let user;
      try {
        user = await getGitHubUserSummary(octokit);
      } catch (error) {
        if (error?.status === 401) {
          clearGitHubAuth();
          return res.status(401).json({ error: 'GitHub token expired or revoked' });
        }
        throw error;
      }
      return res.json(user);
    } catch (error) {
      console.error('Failed to fetch GitHub user:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch GitHub user' });
    }
  });

  // ================= GitHub PR APIs =================

  app.get('/api/github/pr/status', async (req, res) => {
    try {
      const directory = typeof req.query?.directory === 'string' ? req.query.directory.trim() : '';
      const branch = typeof req.query?.branch === 'string' ? req.query.branch.trim() : '';
      const remote = typeof req.query?.remote === 'string' ? req.query.remote.trim() : 'origin';
      if (!directory || !branch) {
        return res.status(400).json({ error: 'directory and branch are required' });
      }

      const { getOctokitOrNull, getGitHubAuth } = await getGitHubLibraries();
      const octokit = getOctokitOrNull();
      if (!octokit) {
        return res.json({ connected: false });
      }

      const { resolveGitHubRepoFromDirectory } = await import('./lib/github/index.js');
      const { repo } = await resolveGitHubRepoFromDirectory(directory, remote);
      if (!repo) {
        return res.json({ connected: true, repo: null, branch, pr: null, checks: null, canMerge: false });
      }

      // Determine the head owner for PR search
      // Priority: 1) tracking branch remote, 2) origin (if different from target), 3) target repo owner
      let headOwnerForSearch = null;

      // First, check the branch's tracking info to see which remote it's on
      const { getStatus } = await import('./lib/git/index.js');
      const status = await getStatus(directory).catch(() => null);
      if (status?.tracking) {
        const trackingRemote = status.tracking.split('/')[0];
        if (trackingRemote && trackingRemote !== remote) {
          // Branch is tracked on a different remote - get that remote's owner
          const { repo: trackingRepo } = await resolveGitHubRepoFromDirectory(directory, trackingRemote);
          if (trackingRepo && trackingRepo.owner !== repo.owner) {
            headOwnerForSearch = trackingRepo.owner;
          }
        }
      }

      // Fallback: if targeting non-origin, check if origin has a different owner (fork scenario)
      if (!headOwnerForSearch && remote !== 'origin') {
        const { repo: originRepo } = await resolveGitHubRepoFromDirectory(directory, 'origin');
        if (originRepo && originRepo.owner !== repo.owner) {
          headOwnerForSearch = originRepo.owner;
        }
      }

      const listByHead = async (state, headOwner = repo.owner) => {
        const resp = await octokit.rest.pulls.list({
          owner: repo.owner,
          repo: repo.repo,
          state,
          head: `${headOwner}:${branch}`,
          per_page: 10,
        });
        return Array.isArray(resp?.data) ? resp.data[0] : null;
      };

      const listByHeadRef = async (state) => {
        const resp = await octokit.rest.pulls.list({
          owner: repo.owner,
          repo: repo.repo,
          state,
          per_page: 100,
        });
        const matches = Array.isArray(resp?.data) ? resp.data.filter((pr) => pr?.head?.ref === branch) : [];
        return matches[0] ?? null;
      };

      // PR status by branch:
      // - Prefer open PRs.
      // - If none, also surface closed/merged PRs.
      // - For cross-repo PRs: first try with head owner, then fall back to target owner, then ref match.
      let first = null;

      // For cross-repo workflows, try head owner first
      if (headOwnerForSearch) {
        first = await listByHead('open', headOwnerForSearch);
        if (!first) first = await listByHead('closed', headOwnerForSearch);
      }

      // Try with target repo owner (same-repo PRs)
      if (!first) first = await listByHead('open');
      if (!first) first = await listByHead('closed');

      // Fall back to matching head.ref directly (handles edge cases)
      if (!first) first = await listByHeadRef('open');
      if (!first) first = await listByHeadRef('closed');
      if (!first) {
        return res.json({ connected: true, repo, branch, pr: null, checks: null, canMerge: false });
      }

      // Enrich with mergeability fields
      const prFull = await octokit.rest.pulls.get({ owner: repo.owner, repo: repo.repo, pull_number: first.number });
      const prData = prFull?.data;
      if (!prData) {
        return res.json({ connected: true, repo, branch, pr: null, checks: null, canMerge: false });
      }

      // Checks summary: prefer check-runs (Actions), fallback to classic statuses.
      let checks = null;
      const sha = prData.head?.sha;
      if (sha) {
        try {
          const runs = await octokit.rest.checks.listForRef({
            owner: repo.owner,
            repo: repo.repo,
            ref: sha,
            per_page: 100,
          });
          const checkRuns = Array.isArray(runs?.data?.check_runs) ? runs.data.check_runs : [];
          if (checkRuns.length > 0) {
            const counts = { success: 0, failure: 0, pending: 0 };
            for (const run of checkRuns) {
              const status = run?.status;
              const conclusion = run?.conclusion;
              if (status === 'queued' || status === 'in_progress') {
                counts.pending += 1;
                continue;
              }
              if (!conclusion) {
                counts.pending += 1;
                continue;
              }
              if (conclusion === 'success' || conclusion === 'neutral' || conclusion === 'skipped') {
                counts.success += 1;
              } else {
                counts.failure += 1;
              }
            }
            const total = counts.success + counts.failure + counts.pending;
            const state = counts.failure > 0 ? 'failure' : counts.pending > 0 ? 'pending' : total > 0 ? 'success' : 'unknown';
            checks = { state, total, ...counts };
          }
        } catch {
          // ignore and fall back
        }

        if (!checks) {
          try {
            const combined = await octokit.rest.repos.getCombinedStatusForRef({
              owner: repo.owner,
              repo: repo.repo,
              ref: sha,
            });
            const statuses = Array.isArray(combined?.data?.statuses) ? combined.data.statuses : [];
            const counts = { success: 0, failure: 0, pending: 0 };
            statuses.forEach((s) => {
              if (s.state === 'success') counts.success += 1;
              else if (s.state === 'failure' || s.state === 'error') counts.failure += 1;
              else if (s.state === 'pending') counts.pending += 1;
            });
            const total = counts.success + counts.failure + counts.pending;
            const state = counts.failure > 0 ? 'failure' : counts.pending > 0 ? 'pending' : total > 0 ? 'success' : 'unknown';
            checks = { state, total, ...counts };
          } catch {
            checks = null;
          }
        }
      }

      // Permission check (best-effort)
      let canMerge = false;
      try {
        const auth = getGitHubAuth();
        const username = auth?.user?.login;
        if (username) {
          const perm = await octokit.rest.repos.getCollaboratorPermissionLevel({
            owner: repo.owner,
            repo: repo.repo,
            username,
          });
          const level = perm?.data?.permission;
          canMerge = level === 'admin' || level === 'maintain' || level === 'write';
        }
      } catch {
        canMerge = false;
      }

      const isMerged = Boolean(prData.merged || prData.merged_at);
      const mergedState = isMerged ? 'merged' : prData.state === 'closed' ? 'closed' : 'open';

      return res.json({
        connected: true,
        repo,
        branch,
        pr: {
          number: prData.number,
          title: prData.title,
          body: prData.body || '',
          url: prData.html_url,
          state: mergedState,
          draft: Boolean(prData.draft),
          base: prData.base?.ref,
          head: prData.head?.ref,
          headSha: prData.head?.sha,
          mergeable: prData.mergeable,
          mergeableState: prData.mergeable_state,
        },
        checks,
        canMerge,
      });
    } catch (error) {
      if (error?.status === 401) {
        const { clearGitHubAuth } = await getGitHubLibraries();
        clearGitHubAuth();
        return res.json({ connected: false });
      }
      console.error('Failed to load GitHub PR status:', error);
      return res.status(500).json({ error: error.message || 'Failed to load GitHub PR status' });
    }
  });

  app.post('/api/github/pr/create', async (req, res) => {
    try {
      const directory = typeof req.body?.directory === 'string' ? req.body.directory.trim() : '';
      const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
      const head = typeof req.body?.head === 'string' ? req.body.head.trim() : '';
      const requestedBase = typeof req.body?.base === 'string' ? req.body.base.trim() : '';
      const body = typeof req.body?.body === 'string' ? req.body.body : undefined;
      const draft = typeof req.body?.draft === 'boolean' ? req.body.draft : undefined;
      // remote = target repo (where PR is created, e.g., 'upstream' for forks)
      const remote = typeof req.body?.remote === 'string' ? req.body.remote.trim() : 'origin';
      // headRemote = source repo (where head branch lives, e.g., 'origin' for forks)
      const headRemote = typeof req.body?.headRemote === 'string' ? req.body.headRemote.trim() : '';
      if (!directory || !title || !head || !requestedBase) {
        return res.status(400).json({ error: 'directory, title, head, base are required' });
      }

      const { getOctokitOrNull } = await getGitHubLibraries();
      const octokit = getOctokitOrNull();
      if (!octokit) {
        return res.status(401).json({ error: 'GitHub not connected' });
      }

      const { resolveGitHubRepoFromDirectory } = await import('./lib/github/index.js');
      const { repo } = await resolveGitHubRepoFromDirectory(directory, remote);
      if (!repo) {
        return res.status(400).json({ error: 'Unable to resolve GitHub repo from git remote' });
      }

      const normalizeBranchRef = (value, remoteNames = new Set()) => {
        if (!value) {
          return value;
        }
        let normalized = value.trim();
        if (normalized.startsWith('refs/heads/')) {
          normalized = normalized.substring('refs/heads/'.length);
        }
        if (normalized.startsWith('heads/')) {
          normalized = normalized.substring('heads/'.length);
        }
        if (normalized.startsWith('remotes/')) {
          normalized = normalized.substring('remotes/'.length);
        }

        const slashIndex = normalized.indexOf('/');
        if (slashIndex > 0) {
          const maybeRemote = normalized.slice(0, slashIndex);
          if (remoteNames.has(maybeRemote)) {
            const withoutRemotePrefix = normalized.slice(slashIndex + 1).trim();
            if (withoutRemotePrefix) {
              normalized = withoutRemotePrefix;
            }
          }
        }

        return normalized;
      };

      // Determine the source remote for the head branch
      // Priority: 1) explicit headRemote, 2) tracking branch remote, 3) 'origin' if targeting non-origin
      let sourceRemote = headRemote;
      const { getStatus, getRemotes } = await import('./lib/git/index.js');

      // If no explicit headRemote, check the branch's tracking info
      if (!sourceRemote) {
        const status = await getStatus(directory).catch(() => null);
        if (status?.tracking) {
          // tracking is like "gsxdsm/fix/multi-remote-branch-creation" or "origin/main"
          const trackingRemote = status.tracking.split('/')[0];
          if (trackingRemote) {
            sourceRemote = trackingRemote;
          }
        }
      }

      // Fallback: if targeting non-origin and no tracking info, try 'origin'
      if (!sourceRemote && remote !== 'origin') {
        sourceRemote = 'origin';
      }

      const remoteNames = new Set([remote]);
      const remotes = await getRemotes(directory).catch(() => []);
      for (const item of remotes) {
        if (item?.name) {
          remoteNames.add(item.name);
        }
      }
      if (sourceRemote) {
        remoteNames.add(sourceRemote);
      }

      const base = normalizeBranchRef(requestedBase, remoteNames);
      if (!base) {
        return res.status(400).json({ error: 'Invalid base branch name' });
      }

      // For fork workflows: we need to determine the correct head reference
      let headRef = head;

      if (sourceRemote && sourceRemote !== remote) {
        // The branch is on a different remote than the target - this is a cross-repo PR
        const { repo: headRepo } = await resolveGitHubRepoFromDirectory(directory, sourceRemote);
        if (headRepo) {
          // Always use owner:branch format for cross-repo PRs
          // GitHub API requires this when head is from a different repo/fork
          if (headRepo.owner !== repo.owner || headRepo.repo !== repo.repo) {
            headRef = `${headRepo.owner}:${head}`;
          }
        }
      }

      // For cross-repo PRs, verify the branch exists on the head repo first
      if (headRef.includes(':')) {
        const [headOwner] = headRef.split(':');
        const headRepoName = sourceRemote ? (await resolveGitHubRepoFromDirectory(directory, sourceRemote)).repo?.repo : repo.repo;

        if (headRepoName) {
          try {
            await octokit.rest.repos.getBranch({
              owner: headOwner,
              repo: headRepoName,
              branch: head,
            });
          } catch (branchError) {
            if (branchError?.status === 404) {
              return res.status(400).json({
                error: `Branch "${head}" not found on ${headOwner}/${headRepoName}. Please push your branch first: git push ${sourceRemote || 'origin'} ${head}`,
              });
            }
            // For other errors, continue - let the PR create attempt handle it
          }
        }
      }

      const created = await octokit.rest.pulls.create({
        owner: repo.owner,
        repo: repo.repo,
        title,
        head: headRef,
        base,
        ...(typeof body === 'string' ? { body } : {}),
        ...(typeof draft === 'boolean' ? { draft } : {}),
      });

      const pr = created?.data;
      if (!pr) {
        return res.status(500).json({ error: 'Failed to create PR' });
      }

      return res.json({
        number: pr.number,
        title: pr.title,
        body: pr.body || '',
        url: pr.html_url,
        state: pr.state === 'closed' ? 'closed' : 'open',
        draft: Boolean(pr.draft),
        base: pr.base?.ref,
        head: pr.head?.ref,
        headSha: pr.head?.sha,
        mergeable: pr.mergeable,
        mergeableState: pr.mergeable_state,
      });
    } catch (error) {
      console.error('Failed to create GitHub PR:', error);

      // Check for head validation error (common with fork PRs)
      const errorMessage = error.message || '';
      const isHeadValidationError =
        errorMessage.includes('Validation Failed') && errorMessage.includes('"field":"head"') && errorMessage.includes('"code":"invalid"');

      if (isHeadValidationError) {
        return res.status(400).json({
          error:
            'Unable to create PR: You must have write access to the source repository. Make sure you have pushed your branch to a repository you own (your fork), and that the branch exists on the remote.',
        });
      }

      return res.status(500).json({ error: error.message || 'Failed to create GitHub PR' });
    }
  });

  app.post('/api/github/pr/update', async (req, res) => {
    try {
      const directory = typeof req.body?.directory === 'string' ? req.body.directory.trim() : '';
      const number = typeof req.body?.number === 'number' ? req.body.number : null;
      const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
      const body = typeof req.body?.body === 'string' ? req.body.body : undefined;
      if (!directory || !number || !title) {
        return res.status(400).json({ error: 'directory, number, title are required' });
      }

      const { getOctokitOrNull } = await getGitHubLibraries();
      const octokit = getOctokitOrNull();
      if (!octokit) {
        return res.status(401).json({ error: 'GitHub not connected' });
      }

      const { resolveGitHubRepoFromDirectory } = await import('./lib/github/index.js');
      const { repo } = await resolveGitHubRepoFromDirectory(directory);
      if (!repo) {
        return res.status(400).json({ error: 'Unable to resolve GitHub repo from git remote' });
      }

      let updated;
      try {
        updated = await octokit.rest.pulls.update({
          owner: repo.owner,
          repo: repo.repo,
          pull_number: number,
          title,
          ...(typeof body === 'string' ? { body } : {}),
        });
      } catch (error) {
        if (error?.status === 401) {
          return res.status(401).json({ error: 'GitHub not connected' });
        }
        if (error?.status === 403) {
          return res.status(403).json({ error: 'Not authorized to edit this PR' });
        }
        if (error?.status === 404) {
          return res.status(404).json({ error: 'PR not found in this repository' });
        }
        if (error?.status === 422) {
          const apiMessage = error?.response?.data?.message;
          const firstError =
            Array.isArray(error?.response?.data?.errors) && error.response.data.errors.length > 0
              ? error.response.data.errors[0]?.message || error.response.data.errors[0]?.code
              : null;
          const message = [apiMessage, firstError].filter(Boolean).join(' · ') || 'Invalid PR update payload';
          return res.status(422).json({ error: message });
        }
        throw error;
      }

      const pr = updated?.data;
      if (!pr) {
        return res.status(500).json({ error: 'Failed to update PR' });
      }

      return res.json({
        number: pr.number,
        title: pr.title,
        body: pr.body || '',
        url: pr.html_url,
        state: pr.merged_at ? 'merged' : pr.state === 'closed' ? 'closed' : 'open',
        draft: Boolean(pr.draft),
        base: pr.base?.ref,
        head: pr.head?.ref,
        headSha: pr.head?.sha,
        mergeable: pr.mergeable,
        mergeableState: pr.mergeable_state,
      });
    } catch (error) {
      console.error('Failed to update GitHub PR:', error);
      return res.status(500).json({ error: error.message || 'Failed to update GitHub PR' });
    }
  });

  app.post('/api/github/pr/merge', async (req, res) => {
    try {
      const directory = typeof req.body?.directory === 'string' ? req.body.directory.trim() : '';
      const number = typeof req.body?.number === 'number' ? req.body.number : null;
      const method = typeof req.body?.method === 'string' ? req.body.method : 'merge';
      if (!directory || !number) {
        return res.status(400).json({ error: 'directory and number are required' });
      }

      const { getOctokitOrNull } = await getGitHubLibraries();
      const octokit = getOctokitOrNull();
      if (!octokit) {
        return res.status(401).json({ error: 'GitHub not connected' });
      }

      const { resolveGitHubRepoFromDirectory } = await import('./lib/github/index.js');
      const { repo } = await resolveGitHubRepoFromDirectory(directory);
      if (!repo) {
        return res.status(400).json({ error: 'Unable to resolve GitHub repo from git remote' });
      }

      try {
        const result = await octokit.rest.pulls.merge({
          owner: repo.owner,
          repo: repo.repo,
          pull_number: number,
          merge_method: method,
        });
        return res.json({ merged: Boolean(result?.data?.merged), message: result?.data?.message });
      } catch (error) {
        if (error?.status === 403) {
          return res.status(403).json({ error: 'Not authorized to merge this PR' });
        }
        if (error?.status === 405 || error?.status === 409) {
          return res.json({ merged: false, message: error?.message || 'PR not mergeable' });
        }
        throw error;
      }
    } catch (error) {
      console.error('Failed to merge GitHub PR:', error);
      return res.status(500).json({ error: error.message || 'Failed to merge GitHub PR' });
    }
  });

  app.post('/api/github/pr/ready', async (req, res) => {
    try {
      const directory = typeof req.body?.directory === 'string' ? req.body.directory.trim() : '';
      const number = typeof req.body?.number === 'number' ? req.body.number : null;
      if (!directory || !number) {
        return res.status(400).json({ error: 'directory and number are required' });
      }

      const { getOctokitOrNull } = await getGitHubLibraries();
      const octokit = getOctokitOrNull();
      if (!octokit) {
        return res.status(401).json({ error: 'GitHub not connected' });
      }

      const { resolveGitHubRepoFromDirectory } = await import('./lib/github/index.js');
      const { repo } = await resolveGitHubRepoFromDirectory(directory);
      if (!repo) {
        return res.status(400).json({ error: 'Unable to resolve GitHub repo from git remote' });
      }

      const pr = await octokit.rest.pulls.get({ owner: repo.owner, repo: repo.repo, pull_number: number });
      const nodeId = pr?.data?.node_id;
      if (!nodeId) {
        return res.status(500).json({ error: 'Failed to resolve PR node id' });
      }

      if (pr?.data?.draft === false) {
        return res.json({ ready: true });
      }

      try {
        await octokit.graphql(
          `mutation($pullRequestId: ID!) {\n  markPullRequestReadyForReview(input: { pullRequestId: $pullRequestId }) {\n    pullRequest {\n      id\n      isDraft\n    }\n  }\n}`,
          { pullRequestId: nodeId },
        );
      } catch (error) {
        if (error?.status === 403) {
          return res.status(403).json({ error: 'Not authorized to mark PR ready' });
        }
        throw error;
      }

      return res.json({ ready: true });
    } catch (error) {
      console.error('Failed to mark PR ready:', error);
      return res.status(500).json({ error: error.message || 'Failed to mark PR ready' });
    }
  });

  // ================= GitHub Issue APIs =================

  app.get('/api/github/issues/list', async (req, res) => {
    try {
      const directory = typeof req.query?.directory === 'string' ? req.query.directory.trim() : '';
      const page = typeof req.query?.page === 'string' ? Number(req.query.page) : 1;
      if (!directory) {
        return res.status(400).json({ error: 'directory is required' });
      }

      const { getOctokitOrNull } = await getGitHubLibraries();
      const octokit = getOctokitOrNull();
      if (!octokit) {
        return res.json({ connected: false });
      }

      const { resolveGitHubRepoFromDirectory } = await import('./lib/github/index.js');
      const { repo } = await resolveGitHubRepoFromDirectory(directory);
      if (!repo) {
        return res.json({ connected: true, repo: null, issues: [] });
      }

      const list = await octokit.rest.issues.listForRepo({
        owner: repo.owner,
        repo: repo.repo,
        state: 'open',
        per_page: 50,
        page: Number.isFinite(page) && page > 0 ? page : 1,
      });
      const link = typeof list?.headers?.link === 'string' ? list.headers.link : '';
      const hasMore = /rel="next"/.test(link);
      const issues = (Array.isArray(list?.data) ? list.data : [])
        .filter((item) => !item?.pull_request)
        .map((item) => ({
          number: item.number,
          title: item.title,
          url: item.html_url,
          state: item.state === 'closed' ? 'closed' : 'open',
          author: item.user ? { login: item.user.login, id: item.user.id, avatarUrl: item.user.avatar_url } : null,
          labels: Array.isArray(item.labels)
            ? item.labels
                .map((label) => {
                  if (typeof label === 'string') return null;
                  const name = typeof label?.name === 'string' ? label.name : '';
                  if (!name) return null;
                  return { name, color: typeof label?.color === 'string' ? label.color : undefined };
                })
                .filter(Boolean)
            : [],
        }));

      return res.json({ connected: true, repo, issues, page: Number.isFinite(page) && page > 0 ? page : 1, hasMore });
    } catch (error) {
      console.error('Failed to list GitHub issues:', error);
      return res.status(500).json({ error: error.message || 'Failed to list GitHub issues' });
    }
  });

  app.get('/api/github/issues/get', async (req, res) => {
    try {
      const directory = typeof req.query?.directory === 'string' ? req.query.directory.trim() : '';
      const number = typeof req.query?.number === 'string' ? Number(req.query.number) : null;
      if (!directory || !number) {
        return res.status(400).json({ error: 'directory and number are required' });
      }

      const { getOctokitOrNull } = await getGitHubLibraries();
      const octokit = getOctokitOrNull();
      if (!octokit) {
        return res.json({ connected: false });
      }

      const { resolveGitHubRepoFromDirectory } = await import('./lib/github/index.js');
      const { repo } = await resolveGitHubRepoFromDirectory(directory);
      if (!repo) {
        return res.json({ connected: true, repo: null, issue: null });
      }

      const result = await octokit.rest.issues.get({ owner: repo.owner, repo: repo.repo, issue_number: number });
      const issue = result?.data;
      if (!issue || issue.pull_request) {
        return res.status(400).json({ error: 'Not a GitHub issue' });
      }

      return res.json({
        connected: true,
        repo,
        issue: {
          number: issue.number,
          title: issue.title,
          url: issue.html_url,
          state: issue.state === 'closed' ? 'closed' : 'open',
          body: issue.body || '',
          createdAt: issue.created_at,
          updatedAt: issue.updated_at,
          author: issue.user ? { login: issue.user.login, id: issue.user.id, avatarUrl: issue.user.avatar_url } : null,
          assignees: Array.isArray(issue.assignees)
            ? issue.assignees.map((u) => (u ? { login: u.login, id: u.id, avatarUrl: u.avatar_url } : null)).filter(Boolean)
            : [],
          labels: Array.isArray(issue.labels)
            ? issue.labels
                .map((label) => {
                  if (typeof label === 'string') return null;
                  const name = typeof label?.name === 'string' ? label.name : '';
                  if (!name) return null;
                  return { name, color: typeof label?.color === 'string' ? label.color : undefined };
                })
                .filter(Boolean)
            : [],
        },
      });
    } catch (error) {
      console.error('Failed to fetch GitHub issue:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch GitHub issue' });
    }
  });

  app.get('/api/github/issues/comments', async (req, res) => {
    try {
      const directory = typeof req.query?.directory === 'string' ? req.query.directory.trim() : '';
      const number = typeof req.query?.number === 'string' ? Number(req.query.number) : null;
      if (!directory || !number) {
        return res.status(400).json({ error: 'directory and number are required' });
      }

      const { getOctokitOrNull } = await getGitHubLibraries();
      const octokit = getOctokitOrNull();
      if (!octokit) {
        return res.json({ connected: false });
      }

      const { resolveGitHubRepoFromDirectory } = await import('./lib/github/index.js');
      const { repo } = await resolveGitHubRepoFromDirectory(directory);
      if (!repo) {
        return res.json({ connected: true, repo: null, comments: [] });
      }

      const result = await octokit.rest.issues.listComments({
        owner: repo.owner,
        repo: repo.repo,
        issue_number: number,
        per_page: 100,
      });
      const comments = (Array.isArray(result?.data) ? result.data : []).map((comment) => ({
        id: comment.id,
        url: comment.html_url,
        body: comment.body || '',
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
        author: comment.user ? { login: comment.user.login, id: comment.user.id, avatarUrl: comment.user.avatar_url } : null,
      }));

      return res.json({ connected: true, repo, comments });
    } catch (error) {
      console.error('Failed to fetch GitHub issue comments:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch GitHub issue comments' });
    }
  });

  // ================= GitHub Pull Request Context APIs =================

  app.get('/api/github/pulls/list', async (req, res) => {
    try {
      const directory = typeof req.query?.directory === 'string' ? req.query.directory.trim() : '';
      const page = typeof req.query?.page === 'string' ? Number(req.query.page) : 1;
      if (!directory) {
        return res.status(400).json({ error: 'directory is required' });
      }

      const { getOctokitOrNull } = await getGitHubLibraries();
      const octokit = getOctokitOrNull();
      if (!octokit) {
        return res.json({ connected: false });
      }

      const { resolveGitHubRepoFromDirectory } = await import('./lib/github/index.js');
      const { repo } = await resolveGitHubRepoFromDirectory(directory);
      if (!repo) {
        return res.json({ connected: true, repo: null, prs: [] });
      }

      const list = await octokit.rest.pulls.list({
        owner: repo.owner,
        repo: repo.repo,
        state: 'open',
        per_page: 50,
        page: Number.isFinite(page) && page > 0 ? page : 1,
      });

      const link = typeof list?.headers?.link === 'string' ? list.headers.link : '';
      const hasMore = /rel="next"/.test(link);

      const prs = (Array.isArray(list?.data) ? list.data : []).map((pr) => {
        const mergedState = pr.merged_at ? 'merged' : pr.state === 'closed' ? 'closed' : 'open';
        const headRepo = pr.head?.repo
          ? {
              owner: pr.head.repo.owner?.login,
              repo: pr.head.repo.name,
              url: pr.head.repo.html_url,
              cloneUrl: pr.head.repo.clone_url,
              sshUrl: pr.head.repo.ssh_url,
            }
          : null;
        return {
          number: pr.number,
          title: pr.title,
          url: pr.html_url,
          state: mergedState,
          draft: Boolean(pr.draft),
          base: pr.base?.ref,
          head: pr.head?.ref,
          headSha: pr.head?.sha,
          mergeable: pr.mergeable,
          mergeableState: pr.mergeable_state,
          author: pr.user ? { login: pr.user.login, id: pr.user.id, avatarUrl: pr.user.avatar_url } : null,
          headLabel: pr.head?.label,
          headRepo: headRepo && headRepo.owner && headRepo.repo && headRepo.url ? headRepo : null,
        };
      });

      return res.json({ connected: true, repo, prs, page: Number.isFinite(page) && page > 0 ? page : 1, hasMore });
    } catch (error) {
      if (error?.status === 401) {
        const { clearGitHubAuth } = await getGitHubLibraries();
        clearGitHubAuth();
        return res.json({ connected: false });
      }
      console.error('Failed to list GitHub PRs:', error);
      return res.status(500).json({ error: error.message || 'Failed to list GitHub PRs' });
    }
  });

  app.get('/api/github/pulls/context', async (req, res) => {
    try {
      const directory = typeof req.query?.directory === 'string' ? req.query.directory.trim() : '';
      const number = typeof req.query?.number === 'string' ? Number(req.query.number) : null;
      const includeDiff = req.query?.diff === '1' || req.query?.diff === 'true';
      const includeCheckDetails = req.query?.checkDetails === '1' || req.query?.checkDetails === 'true';
      if (!directory || !number) {
        return res.status(400).json({ error: 'directory and number are required' });
      }

      const { getOctokitOrNull } = await getGitHubLibraries();
      const octokit = getOctokitOrNull();
      if (!octokit) {
        return res.json({ connected: false });
      }

      const { resolveGitHubRepoFromDirectory } = await import('./lib/github/index.js');
      const { repo } = await resolveGitHubRepoFromDirectory(directory);
      if (!repo) {
        return res.json({ connected: true, repo: null, pr: null });
      }

      const prResp = await octokit.rest.pulls.get({ owner: repo.owner, repo: repo.repo, pull_number: number });
      const prData = prResp?.data;
      if (!prData) {
        return res.status(404).json({ error: 'PR not found' });
      }

      const headRepo = prData.head?.repo
        ? {
            owner: prData.head.repo.owner?.login,
            repo: prData.head.repo.name,
            url: prData.head.repo.html_url,
            cloneUrl: prData.head.repo.clone_url,
            sshUrl: prData.head.repo.ssh_url,
          }
        : null;

      const mergedState = prData.merged ? 'merged' : prData.state === 'closed' ? 'closed' : 'open';
      const pr = {
        number: prData.number,
        title: prData.title,
        url: prData.html_url,
        state: mergedState,
        draft: Boolean(prData.draft),
        base: prData.base?.ref,
        head: prData.head?.ref,
        headSha: prData.head?.sha,
        mergeable: prData.mergeable,
        mergeableState: prData.mergeable_state,
        author: prData.user ? { login: prData.user.login, id: prData.user.id, avatarUrl: prData.user.avatar_url } : null,
        headLabel: prData.head?.label,
        headRepo: headRepo && headRepo.owner && headRepo.repo && headRepo.url ? headRepo : null,
        body: prData.body || '',
        createdAt: prData.created_at,
        updatedAt: prData.updated_at,
      };

      const issueCommentsResp = await octokit.rest.issues.listComments({
        owner: repo.owner,
        repo: repo.repo,
        issue_number: number,
        per_page: 100,
      });
      const issueComments = (Array.isArray(issueCommentsResp?.data) ? issueCommentsResp.data : []).map((comment) => ({
        id: comment.id,
        url: comment.html_url,
        body: comment.body || '',
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
        author: comment.user ? { login: comment.user.login, id: comment.user.id, avatarUrl: comment.user.avatar_url } : null,
      }));

      const reviewCommentsResp = await octokit.rest.pulls.listReviewComments({
        owner: repo.owner,
        repo: repo.repo,
        pull_number: number,
        per_page: 100,
      });
      const reviewComments = (Array.isArray(reviewCommentsResp?.data) ? reviewCommentsResp.data : []).map((comment) => ({
        id: comment.id,
        url: comment.html_url,
        body: comment.body || '',
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
        path: comment.path,
        line: typeof comment.line === 'number' ? comment.line : null,
        position: typeof comment.position === 'number' ? comment.position : null,
        author: comment.user ? { login: comment.user.login, id: comment.user.id, avatarUrl: comment.user.avatar_url } : null,
      }));

      const filesResp = await octokit.rest.pulls.listFiles({
        owner: repo.owner,
        repo: repo.repo,
        pull_number: number,
        per_page: 100,
      });
      const files = (Array.isArray(filesResp?.data) ? filesResp.data : []).map((f) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        changes: f.changes,
        patch: f.patch,
      }));

      // checks summary (same logic as status endpoint)
      let checks = null;
      let checkRunsOut = undefined;
      const sha = prData.head?.sha;
      if (sha) {
        try {
          const runs = await octokit.rest.checks.listForRef({
            owner: repo.owner,
            repo: repo.repo,
            ref: sha,
            per_page: 100,
          });
          const checkRuns = Array.isArray(runs?.data?.check_runs) ? runs.data.check_runs : [];
          if (checkRuns.length > 0) {
            const parsedJobs = new Map();
            const parsedAnnotations = new Map();
            if (includeCheckDetails) {
              // Prefetch actions jobs per runId.
              const runIds = new Set();
              const jobIds = new Map();
              for (const run of checkRuns) {
                const details = typeof run.details_url === 'string' ? run.details_url : '';
                const match = details.match(/\/actions\/runs\/(\d+)(?:\/job\/(\d+))?/);
                if (match) {
                  const runId = Number(match[1]);
                  const jobId = match[2] ? Number(match[2]) : null;
                  if (Number.isFinite(runId) && runId > 0) {
                    runIds.add(runId);
                    if (jobId && Number.isFinite(jobId) && jobId > 0) {
                      jobIds.set(details, { runId, jobId });
                    } else {
                      jobIds.set(details, { runId, jobId: null });
                    }
                  }
                }
              }

              for (const runId of runIds) {
                try {
                  const jobsResp = await octokit.rest.actions.listJobsForWorkflowRun({
                    owner: repo.owner,
                    repo: repo.repo,
                    run_id: runId,
                    per_page: 100,
                  });
                  const jobs = Array.isArray(jobsResp?.data?.jobs) ? jobsResp.data.jobs : [];
                  parsedJobs.set(runId, jobs);
                } catch {
                  parsedJobs.set(runId, []);
                }
              }

              for (const run of checkRuns) {
                const runConclusion = typeof run?.conclusion === 'string' ? run.conclusion.toLowerCase() : '';
                const shouldLoadAnnotations = Boolean(
                  run?.id && runConclusion && !['success', 'neutral', 'skipped'].includes(runConclusion),
                );
                if (!shouldLoadAnnotations) {
                  continue;
                }

                const checkRunId = Number(run.id);
                if (!Number.isFinite(checkRunId) || checkRunId <= 0) {
                  continue;
                }

                const annotations = [];
                for (let page = 1; page <= 3; page += 1) {
                  try {
                    const annotationsResp = await octokit.rest.checks.listAnnotations({
                      owner: repo.owner,
                      repo: repo.repo,
                      check_run_id: checkRunId,
                      per_page: 50,
                      page,
                    });
                    const chunk = Array.isArray(annotationsResp?.data) ? annotationsResp.data : [];
                    annotations.push(...chunk);
                    if (chunk.length < 50) {
                      break;
                    }
                  } catch {
                    break;
                  }
                }

                if (annotations.length > 0) {
                  parsedAnnotations.set(checkRunId, annotations);
                }
              }
            }

            checkRunsOut = checkRuns.map((run) => {
              const detailsUrl = typeof run.details_url === 'string' ? run.details_url : undefined;
              let job = undefined;
              if (includeCheckDetails && detailsUrl) {
                const match = detailsUrl.match(/\/actions\/runs\/(\d+)(?:\/job\/(\d+))?/);
                const runId = match ? Number(match[1]) : null;
                const jobId = match && match[2] ? Number(match[2]) : null;
                if (runId && Number.isFinite(runId)) {
                  const jobs = parsedJobs.get(runId) || [];
                  const matched = jobId ? jobs.find((j) => j.id === jobId) : null;
                  const picked = matched || jobs.find((j) => j.name === run.name) || null;
                  if (picked) {
                    job = {
                      runId,
                      jobId: picked.id,
                      url: picked.html_url,
                      name: picked.name,
                      conclusion: picked.conclusion,
                      steps: Array.isArray(picked.steps)
                        ? picked.steps.map((s) => ({
                            name: s.name,
                            status: s.status,
                            conclusion: s.conclusion,
                            number: s.number,
                            startedAt: s.started_at || undefined,
                            completedAt: s.completed_at || undefined,
                          }))
                        : undefined,
                    };
                  } else {
                    job = { runId, ...(jobId ? { jobId } : {}), url: detailsUrl };
                  }
                }
              }

              return {
                id: run.id,
                name: run.name,
                app: run.app
                  ? {
                      name: run.app.name || undefined,
                      slug: run.app.slug || undefined,
                    }
                  : undefined,
                status: run.status,
                conclusion: run.conclusion,
                detailsUrl,
                output: run.output
                  ? {
                      title: run.output.title || undefined,
                      summary: run.output.summary || undefined,
                      text: run.output.text || undefined,
                    }
                  : undefined,
                ...(job ? { job } : {}),
                ...(run.id && parsedAnnotations.has(run.id)
                  ? {
                      annotations: parsedAnnotations
                        .get(run.id)
                        .map((a) => ({
                          path: a.path || undefined,
                          startLine: typeof a.start_line === 'number' ? a.start_line : undefined,
                          endLine: typeof a.end_line === 'number' ? a.end_line : undefined,
                          level: a.annotation_level || undefined,
                          message: a.message || '',
                          title: a.title || undefined,
                          rawDetails: a.raw_details || undefined,
                        }))
                        .filter((a) => a.message),
                    }
                  : {}),
              };
            });
            const counts = { success: 0, failure: 0, pending: 0 };
            for (const run of checkRuns) {
              const status = run?.status;
              const conclusion = run?.conclusion;
              if (status === 'queued' || status === 'in_progress') {
                counts.pending += 1;
                continue;
              }
              if (!conclusion) {
                counts.pending += 1;
                continue;
              }
              if (conclusion === 'success' || conclusion === 'neutral' || conclusion === 'skipped') {
                counts.success += 1;
              } else {
                counts.failure += 1;
              }
            }
            const total = counts.success + counts.failure + counts.pending;
            const state = counts.failure > 0 ? 'failure' : counts.pending > 0 ? 'pending' : total > 0 ? 'success' : 'unknown';
            checks = { state, total, ...counts };
          }
        } catch {
          // ignore and fall back
        }
        if (!checks) {
          try {
            const combined = await octokit.rest.repos.getCombinedStatusForRef({
              owner: repo.owner,
              repo: repo.repo,
              ref: sha,
            });
            const statuses = Array.isArray(combined?.data?.statuses) ? combined.data.statuses : [];
            const counts = { success: 0, failure: 0, pending: 0 };
            statuses.forEach((s) => {
              if (s.state === 'success') counts.success += 1;
              else if (s.state === 'failure' || s.state === 'error') counts.failure += 1;
              else if (s.state === 'pending') counts.pending += 1;
            });
            const total = counts.success + counts.failure + counts.pending;
            const state = counts.failure > 0 ? 'failure' : counts.pending > 0 ? 'pending' : total > 0 ? 'success' : 'unknown';
            checks = { state, total, ...counts };
          } catch {
            checks = null;
          }
        }
      }

      let diff = undefined;
      if (includeDiff) {
        const diffResp = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
          owner: repo.owner,
          repo: repo.repo,
          pull_number: number,
          headers: { accept: 'application/vnd.github.v3.diff' },
        });
        diff = typeof diffResp?.data === 'string' ? diffResp.data : undefined;
      }

      return res.json({
        connected: true,
        repo,
        pr,
        issueComments,
        reviewComments,
        files,
        ...(diff ? { diff } : {}),
        checks,
        ...(Array.isArray(checkRunsOut) ? { checkRuns: checkRunsOut } : {}),
      });
    } catch (error) {
      if (error?.status === 401) {
        const { clearGitHubAuth } = await getGitHubLibraries();
        clearGitHubAuth();
        return res.json({ connected: false });
      }
      console.error('Failed to load GitHub PR context:', error);
      return res.status(500).json({ error: error.message || 'Failed to load GitHub PR context' });
    }
  });

  app.get('/api/provider/:providerId/source', async (req, res) => {
    try {
      const { providerId } = req.params;
      if (!providerId) {
        return res.status(400).json({ error: 'Provider ID is required' });
      }

      const headerDirectory = typeof req.get === 'function' ? req.get('x-opencode-directory') : null;
      const queryDirectory = Array.isArray(req.query?.directory) ? req.query.directory[0] : req.query?.directory;
      const requestedDirectory = headerDirectory || queryDirectory || null;

      let directory = null;
      const resolved = await resolveProjectDirectory(req);
      if (resolved.directory) {
        directory = resolved.directory;
      } else if (requestedDirectory) {
        return res.status(400).json({ error: resolved.error });
      }

      const sources = getProviderSources(providerId, directory);
      const { getProviderAuth } = await getAuthLibrary();
      const auth = getProviderAuth(providerId);
      sources.sources.auth.exists = Boolean(auth);

      res.json({
        providerId,
        sources: sources.sources,
      });
    } catch (error) {
      console.error('Failed to get provider sources:', error);
      res.status(500).json({ error: error.message || 'Failed to get provider sources' });
    }
  });

  app.get('/api/quota/providers', async (_req, res) => {
    try {
      const { listConfiguredQuotaProviders } = await getQuotaProviders();
      const providers = listConfiguredQuotaProviders();
      res.json({ providers });
    } catch (error) {
      console.error('Failed to list quota providers:', error);
      res.status(500).json({ error: error.message || 'Failed to list quota providers' });
    }
  });

  app.get('/api/quota/:providerId', async (req, res) => {
    try {
      const { providerId } = req.params;
      if (!providerId) {
        return res.status(400).json({ error: 'Provider ID is required' });
      }
      const { fetchQuotaForProvider } = await getQuotaProviders();
      const result = await fetchQuotaForProvider(providerId);
      res.json(result);
    } catch (error) {
      console.error('Failed to fetch quota:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch quota' });
    }
  });

  app.delete('/api/provider/:providerId/auth', async (req, res) => {
    try {
      const { providerId } = req.params;
      if (!providerId) {
        return res.status(400).json({ error: 'Provider ID is required' });
      }

      const scope = typeof req.query?.scope === 'string' ? req.query.scope : 'auth';
      const headerDirectory = typeof req.get === 'function' ? req.get('x-opencode-directory') : null;
      const queryDirectory = Array.isArray(req.query?.directory) ? req.query.directory[0] : req.query?.directory;
      const requestedDirectory = headerDirectory || queryDirectory || null;
      let directory = null;

      if (scope === 'project' || requestedDirectory) {
        const resolved = await resolveProjectDirectory(req);
        if (!resolved.directory) {
          return res.status(400).json({ error: resolved.error });
        }
        directory = resolved.directory;
      } else {
        const resolved = await resolveProjectDirectory(req);
        if (resolved.directory) {
          directory = resolved.directory;
        }
      }

      let removed = false;
      if (scope === 'auth') {
        const { removeProviderAuth } = await getAuthLibrary();
        removed = removeProviderAuth(providerId);
      } else if (scope === 'user' || scope === 'project' || scope === 'custom') {
        removed = removeProviderConfig(providerId, directory, scope);
      } else if (scope === 'all') {
        const { removeProviderAuth } = await getAuthLibrary();
        const authRemoved = removeProviderAuth(providerId);
        const userRemoved = removeProviderConfig(providerId, directory, 'user');
        const projectRemoved = directory ? removeProviderConfig(providerId, directory, 'project') : false;
        const customRemoved = removeProviderConfig(providerId, directory, 'custom');
        removed = authRemoved || userRemoved || projectRemoved || customRemoved;
      } else {
        return res.status(400).json({ error: 'Invalid scope' });
      }

      if (removed) {
        await refreshOpenCodeAfterConfigChange(`provider ${providerId} disconnected (${scope})`);
      }

      res.json({
        success: true,
        removed,
        requiresReload: removed,
        message: removed ? 'Provider disconnected successfully' : 'Provider was not connected',
        reloadDelayMs: removed ? CLIENT_RELOAD_DELAY_MS : undefined,
      });
    } catch (error) {
      console.error('Failed to disconnect provider:', error);
      res.status(500).json({ error: error.message || 'Failed to disconnect provider' });
    }
  });

  let gitLibraries = null;
  const getGitLibraries = async () => {
    if (!gitLibraries) {
      gitLibraries = await import('./lib/git/index.js');
    }
    return gitLibraries;
  };

  app.get('/api/git/identities', async (req, res) => {
    const { getProfiles } = await getGitLibraries();
    try {
      const profiles = getProfiles();
      res.json(profiles);
    } catch (error) {
      console.error('Failed to list git identity profiles:', error);
      res.status(500).json({ error: 'Failed to list git identity profiles' });
    }
  });

  app.post('/api/git/identities', async (req, res) => {
    const { createProfile } = await getGitLibraries();
    try {
      const profile = createProfile(req.body);
      console.log(`Created git identity profile: ${profile.name} (${profile.id})`);
      res.json(profile);
    } catch (error) {
      console.error('Failed to create git identity profile:', error);
      res.status(400).json({ error: error.message || 'Failed to create git identity profile' });
    }
  });

  app.put('/api/git/identities/:id', async (req, res) => {
    const { updateProfile } = await getGitLibraries();
    try {
      const profile = updateProfile(req.params.id, req.body);
      console.log(`Updated git identity profile: ${profile.name} (${profile.id})`);
      res.json(profile);
    } catch (error) {
      console.error('Failed to update git identity profile:', error);
      res.status(400).json({ error: error.message || 'Failed to update git identity profile' });
    }
  });

  app.delete('/api/git/identities/:id', async (req, res) => {
    const { deleteProfile } = await getGitLibraries();
    try {
      deleteProfile(req.params.id);
      console.log(`Deleted git identity profile: ${req.params.id}`);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete git identity profile:', error);
      res.status(400).json({ error: error.message || 'Failed to delete git identity profile' });
    }
  });

  app.get('/api/git/global-identity', async (req, res) => {
    const { getGlobalIdentity } = await getGitLibraries();
    try {
      const identity = await getGlobalIdentity();
      res.json(identity);
    } catch (error) {
      console.error('Failed to get global git identity:', error);
      res.status(500).json({ error: 'Failed to get global git identity' });
    }
  });

  app.get('/api/git/discover-credentials', async (req, res) => {
    try {
      const { discoverGitCredentials } = await import('./lib/git/index.js');
      const credentials = discoverGitCredentials();
      res.json(credentials);
    } catch (error) {
      console.error('Failed to discover git credentials:', error);
      res.status(500).json({ error: 'Failed to discover git credentials' });
    }
  });

  app.get('/api/git/check', async (req, res) => {
    const { isGitRepository } = await getGitLibraries();
    try {
      const directory = req.query.directory;
      if (!directory) {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const isRepo = await isGitRepository(directory);
      res.json({ isGitRepository: isRepo });
    } catch (error) {
      console.error('Failed to check git repository:', error);
      res.status(500).json({ error: 'Failed to check git repository' });
    }
  });

  app.get('/api/git/remote-url', async (req, res) => {
    const { getRemoteUrl } = await getGitLibraries();
    try {
      const directory = req.query.directory;
      if (!directory) {
        return res.status(400).json({ error: 'directory parameter is required' });
      }
      const remote = req.query.remote || 'origin';

      const url = await getRemoteUrl(directory, remote);
      res.json({ url });
    } catch (error) {
      console.error('Failed to get remote url:', error);
      res.status(500).json({ error: 'Failed to get remote url' });
    }
  });

  app.get('/api/git/current-identity', async (req, res) => {
    const { getCurrentIdentity } = await getGitLibraries();
    try {
      const directory = req.query.directory;
      if (!directory) {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const identity = await getCurrentIdentity(directory);
      res.json(identity);
    } catch (error) {
      console.error('Failed to get current git identity:', error);
      res.status(500).json({ error: 'Failed to get current git identity' });
    }
  });

  app.get('/api/git/has-local-identity', async (req, res) => {
    const { hasLocalIdentity } = await getGitLibraries();
    try {
      const directory = req.query.directory;
      if (!directory) {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const hasLocal = await hasLocalIdentity(directory);
      res.json({ hasLocalIdentity: hasLocal });
    } catch (error) {
      console.error('Failed to check local git identity:', error);
      res.status(500).json({ error: 'Failed to check local git identity' });
    }
  });

  app.post('/api/git/set-identity', async (req, res) => {
    const { getProfile, setLocalIdentity, getGlobalIdentity } = await getGitLibraries();
    try {
      const directory = req.query.directory;
      if (!directory) {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const { profileId } = req.body;
      if (!profileId) {
        return res.status(400).json({ error: 'profileId is required' });
      }

      let profile = null;

      if (profileId === 'global') {
        const globalIdentity = await getGlobalIdentity();
        if (!globalIdentity?.userName || !globalIdentity?.userEmail) {
          return res.status(404).json({ error: 'Global identity is not configured' });
        }
        profile = {
          id: 'global',
          name: 'Global Identity',
          userName: globalIdentity.userName,
          userEmail: globalIdentity.userEmail,
          sshKey: globalIdentity.sshCommand ? globalIdentity.sshCommand.replace('ssh -i ', '') : null,
        };
      } else {
        profile = getProfile(profileId);
        if (!profile) {
          return res.status(404).json({ error: 'Profile not found' });
        }
      }

      await setLocalIdentity(directory, profile);
      res.json({ success: true, profile });
    } catch (error) {
      console.error('Failed to set git identity:', error);
      res.status(500).json({ error: error.message || 'Failed to set git identity' });
    }
  });

  app.get('/api/git/status', async (req, res) => {
    const { getStatus } = await getGitLibraries();
    try {
      const directory = EMBEDDED_KRONTERM_WORKSPACE || req.query.directory;
      if (!directory) {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const status = await getStatus(directory);
      res.json(status);
    } catch (error) {
      console.error('Failed to get git status:', error);
      res.status(500).json({ error: error.message || 'Failed to get git status' });
    }
  });

  app.get('/api/git/diff', async (req, res) => {
    const { getDiff } = await getGitLibraries();
    try {
      const directory = req.query.directory;
      if (!directory) {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const path = req.query.path;
      if (!path || typeof path !== 'string') {
        return res.status(400).json({ error: 'path parameter is required' });
      }

      const staged = req.query.staged === 'true';
      const context = req.query.context ? parseInt(String(req.query.context), 10) : undefined;

      const diff = await getDiff(directory, {
        path,
        staged,
        contextLines: Number.isFinite(context) ? context : 3,
      });

      res.json({ diff });
    } catch (error) {
      console.error('Failed to get git diff:', error);
      res.status(500).json({ error: error.message || 'Failed to get git diff' });
    }
  });

  app.get('/api/git/file-diff', async (req, res) => {
    const { getFileDiff } = await getGitLibraries();
    try {
      const directory = req.query.directory;
      if (!directory || typeof directory !== 'string') {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const pathParam = req.query.path;
      if (!pathParam || typeof pathParam !== 'string') {
        return res.status(400).json({ error: 'path parameter is required' });
      }

      const staged = req.query.staged === 'true';

      const result = await getFileDiff(directory, {
        path: pathParam,
        staged,
      });

      res.json({
        original: result.original,
        modified: result.modified,
        path: result.path,
        isBinary: Boolean(result.isBinary),
      });
    } catch (error) {
      console.error('Failed to get git file diff:', error);
      res.status(500).json({ error: error.message || 'Failed to get git file diff' });
    }
  });

  app.post('/api/git/revert', async (req, res) => {
    const { revertFile } = await getGitLibraries();
    try {
      const directory = req.query.directory;
      if (!directory) {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const { path } = req.body || {};
      if (!path || typeof path !== 'string') {
        return res.status(400).json({ error: 'path parameter is required' });
      }

      await revertFile(directory, path);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to revert git file:', error);
      res.status(500).json({ error: error.message || 'Failed to revert git file' });
    }
  });

  app.post('/api/git/commit-message', async (req, res) => {
    const { collectDiffs } = await getGitLibraries();
    try {
      const directory = req.query.directory;
      if (!directory || typeof directory !== 'string') {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const files = Array.isArray(req.body?.files) ? req.body.files : [];
      if (files.length === 0) {
        return res.status(400).json({ error: 'At least one file is required' });
      }

      const diffs = await collectDiffs(directory, files);
      if (diffs.length === 0) {
        return res.status(400).json({ error: 'No diffs available for selected files' });
      }

      const MAX_DIFF_LENGTH = 4000;
      const diffSummaries = diffs
        .map(({ path, diff }) => {
          const trimmed = diff.length > MAX_DIFF_LENGTH ? `${diff.slice(0, MAX_DIFF_LENGTH)}\n...` : diff;
          return `FILE: ${path}\n${trimmed}`;
        })
        .join('\n\n');

      const prompt = `You are generating a Conventional Commits subject line from the provided diff.

Return EXACTLY one JSON object (no code fences, no extra keys, no extra text):
{"subject": string, "highlights": string[]}

Non-negotiable:
- Output must be valid JSON (double quotes).
- Only claim what is supported by the diff. If unsure, be more general; do not guess.

subject:
- Format: <type>: <summary> (NO scope; never write type(scope))
- Allowed types: feat, fix, refactor, perf, docs, test, build, ci, chore, style, revert
- Choose type (prefer fix when ambiguous):
  - fix: any bug/regression/wrong behavior (state, selection, navigation, persistence, crash)
  - feat: new user-facing capability or new workflow (not just guardrails/defaults)
  - refactor/perf/docs/test/build/ci/style/chore/revert: only when clearly the primary change
- Summary style:
  - imperative, present tense, outcome-first
  - <= 72 characters, no trailing period
  - avoid filenames, internal function names, and implementation details

highlights:
- 0-3 items; it is OK to return [].
- Each item: one plain sentence, <= 90 chars, starts with an Uppercase verb.
- Must add information not already in the subject.
- Prefer user-observable behaviors (UI flow, navigation, selection, default view, persistence).
- No markdown bullets, no file paths, no helper names.

Diff summary (may be truncated):
${diffSummaries}`;

      const model = await resolveZenModel(typeof req.body?.zenModel === 'string' ? req.body.zenModel : undefined);

      const completionTimeout = createTimeoutSignal(LONG_REQUEST_TIMEOUT_MS);
      let response;
      try {
        response = await fetchZenWithRetry('/responses', {
          method: 'POST',
          body: {
            model,
            input: [{ role: 'user', content: prompt }],
            max_output_tokens: 1000,
            stream: false,
            reasoning: {
              effort: 'low',
            },
          },
          signal: completionTimeout.signal,
          retries: 1,
        });
      } finally {
        completionTimeout.cleanup();
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        console.error('Commit message generation failed:', errorBody);
        return res.status(502).json({ error: 'Failed to generate commit message' });
      }

      const data = await response.json();
      const raw = data?.output
        ?.find((item) => item?.type === 'message')
        ?.content?.find((item) => item?.type === 'output_text')
        ?.text?.trim();

      if (!raw) {
        return res.status(502).json({ error: 'No commit message returned by generator' });
      }

      const cleanedJson = stripJsonMarkdownWrapper(raw);
      const extractedJson = extractJsonObject(cleanedJson) || extractJsonObject(raw);
      const candidates = [cleanedJson, extractedJson, raw].filter((candidate, index, array) => {
        return candidate && array.indexOf(candidate) === index;
      });

      for (const candidate of candidates) {
        if (!(candidate.startsWith('{') || candidate.startsWith('['))) {
          continue;
        }
        try {
          const parsed = JSON.parse(candidate);
          return res.json({ message: parsed });
        } catch (parseError) {
          console.warn('Commit message generation returned non-JSON body:', parseError);
        }
      }

      res.json({ message: { subject: raw, highlights: [] } });
    } catch (error) {
      console.error('Failed to generate commit message:', error);
      res.status(500).json({ error: error.message || 'Failed to generate commit message' });
    }
  });

  app.post('/api/git/pr-description', async (req, res) => {
    const { getRangeDiff, getRangeFiles } = await getGitLibraries();
    try {
      const directory = req.query.directory;
      if (!directory || typeof directory !== 'string') {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const base = typeof req.body?.base === 'string' ? req.body.base.trim() : '';
      const head = typeof req.body?.head === 'string' ? req.body.head.trim() : '';
      if (!base || !head) {
        return res.status(400).json({ error: 'base and head are required' });
      }

      const filesToDiff = await getRangeFiles(directory, { base, head });

      const diffs = [];
      for (const filePath of filesToDiff) {
        const diff = await getRangeDiff(directory, { base, head, path: filePath, contextLines: 3 }).catch(() => '');
        if (diff && diff.trim().length > 0) {
          diffs.push({ path: filePath, diff });
        }
      }
      if (diffs.length === 0) {
        return res.status(400).json({ error: 'No diffs available for base...head' });
      }

      const diffSummaries = diffs.map(({ path, diff }) => `FILE: ${path}\n${diff}`).join('\n\n');
      const context = typeof req.body?.context === 'string' ? req.body.context.trim() : '';

      let prompt = `You are drafting a GitHub Pull Request title + description for a squash-merge workflow.
Respond in JSON of the shape {"title": string, "body": string} (ONLY JSON in response, no markdown fences) with these rules:
- Title format: conventional, outcome-first, <= 90 chars, no trailing punctuation.
- Use: <type>(<scope>): <summary>. Types: feat, fix, refactor, perf, docs, test, chore.
- Pick the most important user-facing outcome first; include a second major outcome only when needed.
- Body: GitHub-flavored markdown with sections in this exact order: ## Summary, ## Why, ## Testing.
- Summary: 3-6 bullets, concrete product/workflow impact, no vague filler, no internal helper names.
- Why: 1-3 bullets explaining motivation/tradeoff (what problem this solves for users/devs).
- Testing: checkbox list using "- [ ]"; include realistic manual/automated checks inferred from the diff.
- If tests were not run, include "- [ ] Not run locally" as first testing item.
- Keep language crisp and specific; avoid generic boilerplate.

Context:
- base branch: ${base}
- head branch: ${head}`;

      if (context) {
        prompt += `\n\nAdditional context provided by user:\n${context}`;
      }

      prompt += `\n\nDiff summary:\n${diffSummaries}`;

      const model = await resolveZenModel(typeof req.body?.zenModel === 'string' ? req.body.zenModel : undefined);

      const completionTimeout = createTimeoutSignal(LONG_REQUEST_TIMEOUT_MS);
      let response;
      try {
        response = await fetchZenWithRetry('/responses', {
          method: 'POST',
          body: {
            model,
            input: [{ role: 'user', content: prompt }],
            max_output_tokens: 1200,
            stream: false,
            reasoning: { effort: 'low' },
          },
          signal: completionTimeout.signal,
          retries: 1,
        });
      } finally {
        completionTimeout.cleanup();
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        console.error('PR description generation failed:', errorBody);
        return res.status(502).json({ error: 'Failed to generate PR description' });
      }

      const data = await response.json();
      const raw = data?.output
        ?.find((item) => item?.type === 'message')
        ?.content?.find((item) => item?.type === 'output_text')
        ?.text?.trim();
      if (!raw) {
        return res.status(502).json({ error: 'No PR description returned by generator' });
      }

      const cleanedJson = stripJsonMarkdownWrapper(raw);
      const extractedJson = extractJsonObject(cleanedJson) || extractJsonObject(raw);
      const candidates = [cleanedJson, extractedJson, raw].filter((candidate, index, array) => {
        return candidate && array.indexOf(candidate) === index;
      });

      for (const candidate of candidates) {
        if (!(candidate.startsWith('{') || candidate.startsWith('['))) {
          continue;
        }
        try {
          const parsed = JSON.parse(candidate);
          const title = typeof parsed?.title === 'string' ? parsed.title : '';
          const body = typeof parsed?.body === 'string' ? parsed.body : '';
          return res.json({ title, body });
        } catch (parseError) {
          console.warn('PR description generation returned non-JSON body:', parseError);
        }
      }

      return res.json({ title: '', body: raw });
    } catch (error) {
      console.error('Failed to generate PR description:', error);
      return res.status(500).json({ error: error.message || 'Failed to generate PR description' });
    }
  });

  app.post('/api/git/pull', async (req, res) => {
    const { pull } = await getGitLibraries();
    try {
      const directory = req.query.directory;
      if (!directory) {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const result = await pull(directory, req.body);
      res.json(result);
    } catch (error) {
      console.error('Failed to pull:', error);
      res.status(500).json({ error: error.message || 'Failed to pull from remote' });
    }
  });

  app.post('/api/git/push', async (req, res) => {
    const { push } = await getGitLibraries();
    try {
      const directory = req.query.directory;
      if (!directory) {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const result = await push(directory, req.body);
      res.json(result);
    } catch (error) {
      console.error('Failed to push:', error);
      res.status(500).json({ error: error.message || 'Failed to push to remote' });
    }
  });

  app.post('/api/git/fetch', async (req, res) => {
    const { fetch: gitFetch } = await getGitLibraries();
    try {
      const directory = req.query.directory;
      if (!directory) {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const result = await gitFetch(directory, req.body);
      res.json(result);
    } catch (error) {
      console.error('Failed to fetch:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch from remote' });
    }
  });

  app.get('/api/git/remotes', async (req, res) => {
    const { getRemotes } = await getGitLibraries();
    try {
      const directory = req.query.directory;
      if (!directory) {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const remotes = await getRemotes(directory);
      res.json(remotes);
    } catch (error) {
      console.error('Failed to get remotes:', error);
      res.status(500).json({ error: error.message || 'Failed to get remotes' });
    }
  });

  app.post('/api/git/rebase', async (req, res) => {
    const { rebase } = await getGitLibraries();
    try {
      const directory = req.query.directory;
      if (!directory) {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const result = await rebase(directory, req.body);
      res.json(result);
    } catch (error) {
      console.error('Failed to rebase:', error);
      res.status(500).json({ error: error.message || 'Failed to rebase' });
    }
  });

  app.post('/api/git/rebase/abort', async (req, res) => {
    const { abortRebase } = await getGitLibraries();
    try {
      const directory = req.query.directory;
      if (!directory) {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const result = await abortRebase(directory);
      res.json(result);
    } catch (error) {
      console.error('Failed to abort rebase:', error);
      res.status(500).json({ error: error.message || 'Failed to abort rebase' });
    }
  });

  app.post('/api/git/merge', async (req, res) => {
    const { merge } = await getGitLibraries();
    try {
      const directory = req.query.directory;
      if (!directory) {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const result = await merge(directory, req.body);
      res.json(result);
    } catch (error) {
      console.error('Failed to merge:', error);
      res.status(500).json({ error: error.message || 'Failed to merge' });
    }
  });

  app.post('/api/git/merge/abort', async (req, res) => {
    const { abortMerge } = await getGitLibraries();
    try {
      const directory = req.query.directory;
      if (!directory) {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const result = await abortMerge(directory);
      res.json(result);
    } catch (error) {
      console.error('Failed to abort merge:', error);
      res.status(500).json({ error: error.message || 'Failed to abort merge' });
    }
  });

  app.post('/api/git/rebase/continue', async (req, res) => {
    const { continueRebase } = await getGitLibraries();
    try {
      const directory = req.query.directory;
      if (!directory) {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const result = await continueRebase(directory);
      res.json(result);
    } catch (error) {
      console.error('Failed to continue rebase:', error);
      res.status(500).json({ error: error.message || 'Failed to continue rebase' });
    }
  });

  app.post('/api/git/merge/continue', async (req, res) => {
    const { continueMerge } = await getGitLibraries();
    try {
      const directory = req.query.directory;
      if (!directory) {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const result = await continueMerge(directory);
      res.json(result);
    } catch (error) {
      console.error('Failed to continue merge:', error);
      res.status(500).json({ error: error.message || 'Failed to continue merge' });
    }
  });

  app.get('/api/git/conflict-details', async (req, res) => {
    const { getConflictDetails } = await getGitLibraries();
    try {
      const directory = req.query.directory;
      if (!directory) {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const result = await getConflictDetails(directory);
      res.json(result);
    } catch (error) {
      console.error('Failed to get conflict details:', error);
      res.status(500).json({ error: error.message || 'Failed to get conflict details' });
    }
  });

  app.post('/api/git/stash', async (req, res) => {
    const { stash } = await getGitLibraries();
    try {
      const directory = req.query.directory;
      if (!directory) {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const result = await stash(directory, req.body);
      res.json(result);
    } catch (error) {
      console.error('Failed to stash:', error);
      res.status(500).json({ error: error.message || 'Failed to stash' });
    }
  });

  app.post('/api/git/stash/pop', async (req, res) => {
    const { stashPop } = await getGitLibraries();
    try {
      const directory = req.query.directory;
      if (!directory) {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const result = await stashPop(directory);
      res.json(result);
    } catch (error) {
      console.error('Failed to pop stash:', error);
      res.status(500).json({ error: error.message || 'Failed to pop stash' });
    }
  });

  app.post('/api/git/commit', async (req, res) => {
    const { commit } = await getGitLibraries();
    try {
      const directory = req.query.directory;
      if (!directory) {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const { message, addAll, files } = req.body;
      if (!message) {
        return res.status(400).json({ error: 'message is required' });
      }

      const result = await commit(directory, message, {
        addAll,
        files,
      });
      res.json(result);
    } catch (error) {
      console.error('Failed to commit:', error);
      res.status(500).json({ error: error.message || 'Failed to create commit' });
    }
  });

  app.get('/api/git/branches', async (req, res) => {
    const { getBranches } = await getGitLibraries();
    try {
      const directory = req.query.directory;
      if (!directory) {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const branches = await getBranches(directory);
      res.json(branches);
    } catch (error) {
      console.error('Failed to get branches:', error);
      res.status(500).json({ error: error.message || 'Failed to get branches' });
    }
  });

  app.post('/api/git/branches', async (req, res) => {
    const { createBranch } = await getGitLibraries();
    try {
      const directory = req.query.directory;
      if (!directory) {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const { name, startPoint } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'name is required' });
      }

      const result = await createBranch(directory, name, { startPoint });
      res.json(result);
    } catch (error) {
      console.error('Failed to create branch:', error);
      res.status(500).json({ error: error.message || 'Failed to create branch' });
    }
  });

  app.delete('/api/git/branches', async (req, res) => {
    const { deleteBranch } = await getGitLibraries();
    try {
      const directory = req.query.directory;
      if (!directory) {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const { branch, force } = req.body;
      if (!branch) {
        return res.status(400).json({ error: 'branch is required' });
      }

      const result = await deleteBranch(directory, branch, { force });
      res.json(result);
    } catch (error) {
      console.error('Failed to delete branch:', error);
      res.status(500).json({ error: error.message || 'Failed to delete branch' });
    }
  });

  app.put('/api/git/branches/rename', async (req, res) => {
    const { renameBranch } = await getGitLibraries();
    try {
      const directory = req.query.directory;
      if (!directory) {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const { oldName, newName } = req.body;
      if (!oldName) {
        return res.status(400).json({ error: 'oldName is required' });
      }
      if (!newName) {
        return res.status(400).json({ error: 'newName is required' });
      }

      const result = await renameBranch(directory, oldName, newName);
      res.json(result);
    } catch (error) {
      console.error('Failed to rename branch:', error);
      res.status(500).json({ error: error.message || 'Failed to rename branch' });
    }
  });
  app.delete('/api/git/remote-branches', async (req, res) => {
    const { deleteRemoteBranch } = await getGitLibraries();
    try {
      const directory = req.query.directory;
      if (!directory) {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const { branch, remote } = req.body;
      if (!branch) {
        return res.status(400).json({ error: 'branch is required' });
      }

      const result = await deleteRemoteBranch(directory, { branch, remote });
      res.json(result);
    } catch (error) {
      console.error('Failed to delete remote branch:', error);
      res.status(500).json({ error: error.message || 'Failed to delete remote branch' });
    }
  });

  app.post('/api/git/checkout', async (req, res) => {
    const { checkoutBranch } = await getGitLibraries();
    try {
      const directory = req.query.directory;
      if (!directory) {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const { branch } = req.body;
      if (!branch) {
        return res.status(400).json({ error: 'branch is required' });
      }

      const result = await checkoutBranch(directory, branch);
      res.json(result);
    } catch (error) {
      console.error('Failed to checkout branch:', error);
      res.status(500).json({ error: error.message || 'Failed to checkout branch' });
    }
  });

  app.get('/api/git/worktrees', async (req, res) => {
    const { getWorktrees } = await getGitLibraries();
    try {
      const directory = req.query.directory;
      if (!directory) {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const worktrees = await getWorktrees(directory);
      res.json(worktrees);
    } catch (error) {
      // Worktrees are an optional feature. Avoid repeated 500s (and repeated client retries)
      // when the directory isn't a git repo or uses shell shorthand like "~/".
      console.warn('Failed to get worktrees, returning empty list:', error?.message || error);
      res.setHeader('X-OpenChamber-Warning', 'git worktrees unavailable');
      res.json([]);
    }
  });

  app.post('/api/git/worktrees/validate', async (req, res) => {
    const { validateWorktreeCreate } = await getGitLibraries();
    if (typeof validateWorktreeCreate !== 'function') {
      return res.status(501).json({ error: 'Worktree validation is not available' });
    }

    try {
      const directory = req.query.directory;
      if (!directory || typeof directory !== 'string') {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const result = await validateWorktreeCreate(directory, req.body || {});
      res.json(result);
    } catch (error) {
      console.error('Failed to validate worktree creation:', error);
      res.status(500).json({ error: error.message || 'Failed to validate worktree creation' });
    }
  });

  app.post('/api/git/worktrees', async (req, res) => {
    const { createWorktree } = await getGitLibraries();
    if (typeof createWorktree !== 'function') {
      return res.status(501).json({ error: 'Worktree creation is not available' });
    }

    try {
      const directory = req.query.directory;
      if (!directory || typeof directory !== 'string') {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const created = await createWorktree(directory, req.body || {});
      res.json(created);
    } catch (error) {
      console.error('Failed to create worktree:', error);
      res.status(500).json({ error: error.message || 'Failed to create worktree' });
    }
  });

  app.delete('/api/git/worktrees', async (req, res) => {
    const { removeWorktree } = await getGitLibraries();
    if (typeof removeWorktree !== 'function') {
      return res.status(501).json({ error: 'Worktree removal is not available' });
    }

    try {
      const directory = req.query.directory;
      if (!directory || typeof directory !== 'string') {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const worktreeDirectory = typeof req.body?.directory === 'string' ? req.body.directory : '';
      if (!worktreeDirectory) {
        return res.status(400).json({ error: 'worktree directory is required' });
      }

      const result = await removeWorktree(directory, {
        directory: worktreeDirectory,
        deleteLocalBranch: req.body?.deleteLocalBranch === true,
      });
      res.json({ success: Boolean(result) });
    } catch (error) {
      console.error('Failed to remove worktree:', error);
      res.status(500).json({ error: error.message || 'Failed to remove worktree' });
    }
  });

  app.get('/api/git/worktree-type', async (req, res) => {
    const { isLinkedWorktree } = await getGitLibraries();
    try {
      const { directory } = req.query;
      if (!directory || typeof directory !== 'string') {
        return res.status(400).json({ error: 'directory parameter is required' });
      }
      const linked = await isLinkedWorktree(directory);
      res.json({ linked });
    } catch (error) {
      console.error('Failed to determine worktree type:', error);
      res.status(500).json({ error: error.message || 'Failed to determine worktree type' });
    }
  });

  app.get('/api/git/log', async (req, res) => {
    const { getLog } = await getGitLibraries();
    try {
      const directory = req.query.directory;
      if (!directory) {
        return res.status(400).json({ error: 'directory parameter is required' });
      }

      const { maxCount, from, to, file } = req.query;
      const log = await getLog(directory, {
        maxCount: maxCount ? parseInt(maxCount) : undefined,
        from,
        to,
        file,
      });
      res.json(log);
    } catch (error) {
      console.error('Failed to get log:', error);
      res.status(500).json({ error: error.message || 'Failed to get commit log' });
    }
  });

  app.get('/api/git/commit-files', async (req, res) => {
    const { getCommitFiles } = await getGitLibraries();
    try {
      const { directory, hash } = req.query;
      if (!directory) {
        return res.status(400).json({ error: 'directory parameter is required' });
      }
      if (!hash) {
        return res.status(400).json({ error: 'hash parameter is required' });
      }

      const result = await getCommitFiles(directory, hash);
      res.json(result);
    } catch (error) {
      console.error('Failed to get commit files:', error);
      res.status(500).json({ error: error.message || 'Failed to get commit files' });
    }
  });

  app.get('/api/fs/home', (req, res) => {
    try {
      const home = os.homedir();
      if (!home || typeof home !== 'string' || home.length === 0) {
        return res.status(500).json({ error: 'Failed to resolve home directory' });
      }
      res.json({ home });
    } catch (error) {
      console.error('Failed to resolve home directory:', error);
      res.status(500).json({ error: (error && error.message) || 'Failed to resolve home directory' });
    }
  });

  app.post('/api/fs/mkdir', async (req, res) => {
    try {
      const { path: dirPath, allowOutsideWorkspace } = req.body ?? {};

      if (typeof dirPath !== 'string' || !dirPath.trim()) {
        return res.status(400).json({ error: 'Path is required' });
      }

      let resolvedPath = '';

      if (allowOutsideWorkspace) {
        resolvedPath = path.resolve(normalizeDirectoryPath(dirPath));
      } else {
        const resolved = await resolveWorkspacePathFromContext(req, dirPath);
        if (!resolved.ok) {
          return res.status(400).json({ error: resolved.error });
        }
        resolvedPath = resolved.resolved;
      }

      await fsPromises.mkdir(resolvedPath, { recursive: true });

      res.json({ success: true, path: resolvedPath });
    } catch (error) {
      console.error('Failed to create directory:', error);
      res.status(500).json({ error: error.message || 'Failed to create directory' });
    }
  });

  // Read file contents
  app.get('/api/fs/read', async (req, res) => {
    const filePath = typeof req.query.path === 'string' ? req.query.path.trim() : '';
    if (!filePath) {
      return res.status(400).json({ error: 'Path is required' });
    }

    try {
      const resolvedPath = path.resolve(normalizeDirectoryPath(filePath));
      if (resolvedPath.includes('..')) {
        return res.status(400).json({ error: 'Invalid path: path traversal not allowed' });
      }

      const stats = await fsPromises.stat(resolvedPath);
      if (!stats.isFile()) {
        return res.status(400).json({ error: 'Specified path is not a file' });
      }

      const content = await fsPromises.readFile(resolvedPath, 'utf8');
      res.type('text/plain').send(content);
    } catch (error) {
      const err = error;
      if (err && typeof err === 'object' && err.code === 'ENOENT') {
        return res.status(404).json({ error: 'File not found' });
      }
      if (err && typeof err === 'object' && err.code === 'EACCES') {
        return res.status(403).json({ error: 'Access to file denied' });
      }
      console.error('Failed to read file:', error);
      res.status(500).json({ error: (error && error.message) || 'Failed to read file' });
    }
  });

  // Read file as raw bytes (images, etc.)
  app.get('/api/fs/raw', async (req, res) => {
    const filePath = typeof req.query.path === 'string' ? req.query.path.trim() : '';
    if (!filePath) {
      return res.status(400).json({ error: 'Path is required' });
    }

    try {
      const resolvedPath = path.resolve(normalizeDirectoryPath(filePath));
      if (resolvedPath.includes('..')) {
        return res.status(400).json({ error: 'Invalid path: path traversal not allowed' });
      }

      const stats = await fsPromises.stat(resolvedPath);
      if (!stats.isFile()) {
        return res.status(400).json({ error: 'Specified path is not a file' });
      }

      const mimeType = inferMimeTypeFromPath(resolvedPath);

      const content = await fsPromises.readFile(resolvedPath);
      res.setHeader('Cache-Control', 'no-store');
      res.type(mimeType).send(content);
    } catch (error) {
      const err = error;
      if (err && typeof err === 'object' && err.code === 'ENOENT') {
        return res.status(404).json({ error: 'File not found' });
      }
      if (err && typeof err === 'object' && err.code === 'EACCES') {
        return res.status(403).json({ error: 'Access to file denied' });
      }
      console.error('Failed to read raw file:', error);
      res.status(500).json({ error: (error && error.message) || 'Failed to read file' });
    }
  });

  // Write file contents
  app.post('/api/fs/write', async (req, res) => {
    const { path: filePath, content } = req.body || {};
    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({ error: 'Path is required' });
    }
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'Content is required' });
    }

    try {
      const resolved = await resolveWorkspacePathFromContext(req, filePath);
      if (!resolved.ok) {
        return res.status(400).json({ error: resolved.error });
      }

      // Ensure parent directory exists
      await fsPromises.mkdir(path.dirname(resolved.resolved), { recursive: true });
      await fsPromises.writeFile(resolved.resolved, content, 'utf8');
      res.json({ success: true, path: resolved.resolved });
    } catch (error) {
      const err = error;
      if (err && typeof err === 'object' && err.code === 'EACCES') {
        return res.status(403).json({ error: 'Access denied' });
      }
      console.error('Failed to write file:', error);
      res.status(500).json({ error: (error && error.message) || 'Failed to write file' });
    }
  });

  // Delete file or directory
  app.post('/api/fs/delete', async (req, res) => {
    const { path: targetPath } = req.body || {};
    if (!targetPath || typeof targetPath !== 'string') {
      return res.status(400).json({ error: 'Path is required' });
    }

    try {
      const resolved = await resolveWorkspacePathFromContext(req, targetPath);
      if (!resolved.ok) {
        return res.status(400).json({ error: resolved.error });
      }

      await fsPromises.rm(resolved.resolved, { recursive: true, force: true });

      res.json({ success: true, path: resolved.resolved });
    } catch (error) {
      const err = error;
      if (err && typeof err === 'object' && err.code === 'ENOENT') {
        return res.status(404).json({ error: 'File or directory not found' });
      }
      if (err && typeof err === 'object' && err.code === 'EACCES') {
        return res.status(403).json({ error: 'Access denied' });
      }
      console.error('Failed to delete path:', error);
      res.status(500).json({ error: (error && error.message) || 'Failed to delete path' });
    }
  });

  // Rename/Move file or directory
  app.post('/api/fs/rename', async (req, res) => {
    const { oldPath, newPath } = req.body || {};
    if (!oldPath || typeof oldPath !== 'string') {
      return res.status(400).json({ error: 'oldPath is required' });
    }
    if (!newPath || typeof newPath !== 'string') {
      return res.status(400).json({ error: 'newPath is required' });
    }

    try {
      const resolvedOld = await resolveWorkspacePathFromContext(req, oldPath);
      if (!resolvedOld.ok) {
        return res.status(400).json({ error: resolvedOld.error });
      }
      const resolvedNew = await resolveWorkspacePathFromContext(req, newPath);
      if (!resolvedNew.ok) {
        return res.status(400).json({ error: resolvedNew.error });
      }

      if (resolvedOld.base !== resolvedNew.base) {
        return res.status(400).json({ error: 'Source and destination must share the same workspace root' });
      }

      await fsPromises.rename(resolvedOld.resolved, resolvedNew.resolved);

      res.json({ success: true, path: resolvedNew.resolved });
    } catch (error) {
      const err = error;
      if (err && typeof err === 'object' && err.code === 'ENOENT') {
        return res.status(404).json({ error: 'Source path not found' });
      }
      if (err && typeof err === 'object' && err.code === 'EACCES') {
        return res.status(403).json({ error: 'Access denied' });
      }
      console.error('Failed to rename path:', error);
      res.status(500).json({ error: (error && error.message) || 'Failed to rename path' });
    }
  });

  // Reveal a file or folder in the system file manager (Finder on macOS, Explorer on Windows, etc.)
  app.post('/api/fs/reveal', async (req, res) => {
    const { path: targetPath } = req.body || {};
    if (!targetPath || typeof targetPath !== 'string') {
      return res.status(400).json({ error: 'Path is required' });
    }

    try {
      const resolved = path.resolve(targetPath.trim());

      // Verify path exists
      await fsPromises.access(resolved);

      const platform = process.platform;
      if (platform === 'darwin') {
        // macOS: open -R selects the file in Finder; open opens a folder
        const stat = await fsPromises.stat(resolved);
        if (stat.isDirectory()) {
          spawn('open', [resolved], { stdio: 'ignore', detached: true }).unref();
        } else {
          spawn('open', ['-R', resolved], { stdio: 'ignore', detached: true }).unref();
        }
      } else if (platform === 'win32') {
        // Windows: explorer /select, highlights the file
        spawn('explorer', ['/select,', resolved], { stdio: 'ignore', detached: true }).unref();
      } else {
        // Linux: xdg-open opens the parent directory
        const stat = await fsPromises.stat(resolved);
        const dir = stat.isDirectory() ? resolved : path.dirname(resolved);
        spawn('xdg-open', [dir], { stdio: 'ignore', detached: true }).unref();
      }

      res.json({ success: true, path: resolved });
    } catch (error) {
      const err = error;
      if (err && typeof err === 'object' && err.code === 'ENOENT') {
        return res.status(404).json({ error: 'Path not found' });
      }
      console.error('Failed to reveal path:', error);
      res.status(500).json({ error: (error && error.message) || 'Failed to reveal path' });
    }
  });

  // Execute shell commands in a directory (for worktree setup)
  // NOTE: This route supports background execution to avoid tying up browser connections.
  const execJobs = new Map();
  const EXEC_JOB_TTL_MS = 30 * 60 * 1000;
  const COMMAND_TIMEOUT_MS = (() => {
    const raw = Number(process.env.OPENCHAMBER_FS_EXEC_TIMEOUT_MS);
    if (Number.isFinite(raw) && raw > 0) return raw;
    // `bun install` (common worktree setup cmd) often takes >60s.
    return 5 * 60 * 1000;
  })();

  const pruneExecJobs = () => {
    const now = Date.now();
    for (const [jobId, job] of execJobs.entries()) {
      if (!job || typeof job !== 'object') {
        execJobs.delete(jobId);
        continue;
      }
      const updatedAt = typeof job.updatedAt === 'number' ? job.updatedAt : 0;
      if (updatedAt && now - updatedAt > EXEC_JOB_TTL_MS) {
        execJobs.delete(jobId);
      }
    }
  };

  const runCommandInDirectory = (shell, shellFlag, command, resolvedCwd) => {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const envPath = buildAugmentedPath();
      const execEnv = { ...process.env, PATH: envPath };

      const child = spawn(shell, [shellFlag, command], {
        cwd: resolvedCwd,
        env: execEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const timeout = setTimeout(() => {
        timedOut = true;
        try {
          child.kill('SIGKILL');
        } catch {
          // ignore
        }
      }, COMMAND_TIMEOUT_MS);

      child.stdout?.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        resolve({
          command,
          success: false,
          exitCode: undefined,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          error: (error && error.message) || 'Command execution failed',
        });
      });

      child.on('close', (code, signal) => {
        clearTimeout(timeout);
        const exitCode = typeof code === 'number' ? code : undefined;
        const base = {
          command,
          success: exitCode === 0 && !timedOut,
          exitCode,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        };

        if (timedOut) {
          resolve({
            ...base,
            success: false,
            error: `Command timed out after ${COMMAND_TIMEOUT_MS}ms` + (signal ? ` (${signal})` : ''),
          });
          return;
        }

        resolve(base);
      });
    });
  };

  const runExecJob = async (job) => {
    job.status = 'running';
    job.updatedAt = Date.now();

    const results = [];

    for (const command of job.commands) {
      if (typeof command !== 'string' || !command.trim()) {
        results.push({ command, success: false, error: 'Invalid command' });
        continue;
      }

      try {
        const result = await runCommandInDirectory(job.shell, job.shellFlag, command, job.resolvedCwd);
        results.push(result);
      } catch (error) {
        results.push({
          command,
          success: false,
          error: (error && error.message) || 'Command execution failed',
        });
      }

      job.results = results;
      job.updatedAt = Date.now();
    }

    job.results = results;
    job.success = results.every((r) => r.success);
    job.status = 'done';
    job.finishedAt = Date.now();
    job.updatedAt = Date.now();
  };

  app.post('/api/fs/exec', async (req, res) => {
    const { commands, cwd, background } = req.body || {};
    if (!Array.isArray(commands) || commands.length === 0) {
      return res.status(400).json({ error: 'Commands array is required' });
    }
    if (!cwd || typeof cwd !== 'string') {
      return res.status(400).json({ error: 'Working directory (cwd) is required' });
    }

    pruneExecJobs();

    try {
      const resolvedCwd = path.resolve(normalizeDirectoryPath(cwd));
      const stats = await fsPromises.stat(resolvedCwd);
      if (!stats.isDirectory()) {
        return res.status(400).json({ error: 'Specified cwd is not a directory' });
      }

      const shell = process.env.SHELL || (process.platform === 'win32' ? 'cmd.exe' : '/bin/sh');
      const shellFlag = process.platform === 'win32' ? '/c' : '-c';

      const jobId = crypto.randomUUID();
      const job = {
        jobId,
        status: 'queued',
        success: null,
        commands,
        resolvedCwd,
        shell,
        shellFlag,
        results: [],
        startedAt: Date.now(),
        finishedAt: null,
        updatedAt: Date.now(),
      };

      execJobs.set(jobId, job);

      const isBackground = background === true;
      if (isBackground) {
        void runExecJob(job).catch((error) => {
          job.status = 'done';
          job.success = false;
          job.results = Array.isArray(job.results) ? job.results : [];
          job.results.push({
            command: '',
            success: false,
            error: (error && error.message) || 'Command execution failed',
          });
          job.finishedAt = Date.now();
          job.updatedAt = Date.now();
        });

        return res.status(202).json({
          jobId,
          status: 'running',
        });
      }

      await runExecJob(job);
      res.json({
        jobId,
        status: job.status,
        success: job.success === true,
        results: job.results,
      });
    } catch (error) {
      console.error('Failed to execute commands:', error);
      res.status(500).json({ error: (error && error.message) || 'Failed to execute commands' });
    }
  });

  app.get('/api/fs/exec/:jobId', (req, res) => {
    const jobId = typeof req.params?.jobId === 'string' ? req.params.jobId : '';
    if (!jobId) {
      return res.status(400).json({ error: 'Job id is required' });
    }

    pruneExecJobs();

    const job = execJobs.get(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    job.updatedAt = Date.now();

    return res.json({
      jobId: job.jobId,
      status: job.status,
      success: job.success === true,
      results: Array.isArray(job.results) ? job.results : [],
    });
  });

  app.post('/api/opencode/directory', async (req, res) => {
    try {
      const requestedPath = typeof req.body?.path === 'string' ? req.body.path.trim() : '';
      if (!requestedPath) {
        return res.status(400).json({ error: 'Path is required' });
      }

      const validated = await validateDirectoryPath(requestedPath);
      if (!validated.ok) {
        return res.status(400).json({ error: validated.error });
      }

      const resolvedPath = validated.directory;
      const currentSettings = await readSettingsFromDisk();
      const existingProjects = sanitizeProjects(currentSettings.projects) || [];
      const existing = existingProjects.find((project) => project.path === resolvedPath) || null;

      const nextProjects = existing
        ? existingProjects
        : [
            ...existingProjects,
            {
              id: crypto.randomUUID(),
              path: resolvedPath,
              addedAt: Date.now(),
              lastOpenedAt: Date.now(),
            },
          ];

      const activeProjectId = existing ? existing.id : nextProjects[nextProjects.length - 1].id;

      const updated = await persistSettings({
        projects: nextProjects,
        activeProjectId,
        lastDirectory: resolvedPath,
      });

      res.json({
        success: true,
        restarted: false,
        path: resolvedPath,
        settings: updated,
      });
    } catch (error) {
      console.error('Failed to update OpenCode working directory:', error);
      res.status(500).json({ error: error.message || 'Failed to update working directory' });
    }
  });

  app.get('/api/fs/list', async (req, res) => {
    const rawPath = typeof req.query.path === 'string' && req.query.path.trim().length > 0 ? req.query.path.trim() : os.homedir();
    const respectGitignore = req.query.respectGitignore === 'true';
    let resolvedPath = '';

    const isPlansDirectory = (value) => {
      if (!value || typeof value !== 'string') return false;
      const normalized = value.replace(/\\/g, '/').replace(/\/+$/, '');
      return (
        normalized.endsWith('/.opencode/plans') ||
        normalized.endsWith('.opencode/plans') ||
        normalized.endsWith('/.kronoscode/plans') ||
        normalized.endsWith('.kronoscode/plans')
      );
    };

    try {
      resolvedPath = path.resolve(normalizeDirectoryPath(rawPath));

      const stats = await fsPromises.stat(resolvedPath);
      if (!stats.isDirectory()) {
        return res.status(400).json({ error: 'Specified path is not a directory' });
      }

      const dirents = await fsPromises.readdir(resolvedPath, { withFileTypes: true });

      // Get gitignored paths if requested
      let ignoredPaths = new Set();
      if (respectGitignore) {
        try {
          // Get all entry paths to check (relative to resolvedPath for git check-ignore)
          const pathsToCheck = dirents.map((d) => d.name);

          if (pathsToCheck.length > 0) {
            try {
              // Use git check-ignore with paths as arguments
              // Pass paths directly as arguments (works for reasonable directory sizes)
              const result = await new Promise((resolve) => {
                const child = spawn('git', ['check-ignore', '--', ...pathsToCheck], {
                  cwd: resolvedPath,
                  stdio: ['ignore', 'pipe', 'pipe'],
                });

                let stdout = '';
                child.stdout.on('data', (data) => {
                  stdout += data.toString();
                });
                child.on('close', () => resolve(stdout));
                child.on('error', () => resolve(''));
              });

              result
                .split('\n')
                .filter(Boolean)
                .forEach((name) => {
                  const fullPath = path.join(resolvedPath, name.trim());
                  ignoredPaths.add(fullPath);
                });
            } catch {
              // git check-ignore fails if not a git repo, continue without filtering
            }
          }
        } catch {
          // If git is not available, continue without gitignore filtering
        }
      }

      const entries = await Promise.all(
        dirents.map(async (dirent) => {
          const entryPath = path.join(resolvedPath, dirent.name);

          // Skip gitignored entries
          if (respectGitignore && ignoredPaths.has(entryPath)) {
            return null;
          }

          let isDirectory = dirent.isDirectory();
          const isSymbolicLink = dirent.isSymbolicLink();

          if (!isDirectory && isSymbolicLink) {
            try {
              const linkStats = await fsPromises.stat(entryPath);
              isDirectory = linkStats.isDirectory();
            } catch {
              isDirectory = false;
            }
          }

          return {
            name: dirent.name,
            path: entryPath,
            isDirectory,
            isFile: dirent.isFile(),
            isSymbolicLink,
          };
        }),
      );

      res.json({
        path: resolvedPath,
        entries: entries.filter(Boolean),
      });
    } catch (error) {
      const err = error;
      const code = err && typeof err === 'object' && 'code' in err ? err.code : undefined;
      const isPlansPath = code === 'ENOENT' && (isPlansDirectory(resolvedPath) || isPlansDirectory(rawPath));
      if (!isPlansPath) {
        console.error('Failed to list directory:', error);
      }
      if (code === 'ENOENT') {
        // Return empty result for plans directory (expected to not exist until first use)
        if (isPlansPath) {
          return res.json({ path: resolvedPath || rawPath, entries: [] });
        }
        return res.status(404).json({ error: 'Directory not found' });
      }
      if (code === 'EACCES') {
        return res.status(403).json({ error: 'Access to directory denied' });
      }
      res.status(500).json({ error: (error && error.message) || 'Failed to list directory' });
    }
  });

  app.get('/api/fs/search', async (req, res) => {
    const rawRoot =
      typeof req.query.root === 'string' && req.query.root.trim().length > 0
        ? req.query.root.trim()
        : typeof req.query.directory === 'string' && req.query.directory.trim().length > 0
          ? req.query.directory.trim()
          : os.homedir();
    const rawQuery = typeof req.query.q === 'string' ? req.query.q : '';
    const includeHidden = req.query.includeHidden === 'true';
    const respectGitignore = req.query.respectGitignore !== 'false';
    const limitParam = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : undefined;
    const parsedLimit = Number.isFinite(limitParam) ? Number(limitParam) : DEFAULT_FILE_SEARCH_LIMIT;
    const limit = Math.max(1, Math.min(parsedLimit, MAX_FILE_SEARCH_LIMIT));

    try {
      const resolvedRoot = path.resolve(normalizeDirectoryPath(rawRoot));
      const stats = await fsPromises.stat(resolvedRoot);
      if (!stats.isDirectory()) {
        return res.status(400).json({ error: 'Specified root is not a directory' });
      }

      const files = await searchFilesystemFiles(resolvedRoot, {
        limit,
        query: rawQuery || '',
        includeHidden,
        respectGitignore,
      });
      res.json({
        root: resolvedRoot,
        count: files.length,
        files,
      });
    } catch (error) {
      console.error('Failed to search filesystem:', error);
      const err = error;
      if (err && typeof err === 'object' && 'code' in err) {
        const code = err.code;
        if (code === 'ENOENT') {
          return res.status(404).json({ error: 'Directory not found' });
        }
        if (code === 'EACCES') {
          return res.status(403).json({ error: 'Access to directory denied' });
        }
      }
      res.status(500).json({ error: (error && error.message) || 'Failed to search files' });
    }
  });

  const OMNIBOX_DEFAULT_LIMIT = 30;
  const OMNIBOX_MAX_LIMIT = 120;
  const SCREENPIPE_DEFAULT_DB = path.join(os.homedir(), '.screenpipe', 'db.sqlite');
  const REPO_ROOT = path.resolve(__dirname, '../../..');

  const clampOmniboxLimit = (value, fallback = OMNIBOX_DEFAULT_LIMIT) => {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.max(1, Math.min(OMNIBOX_MAX_LIMIT, parsed));
  };

  const normalizeSnippet = (value, max = 180) => {
    if (typeof value !== 'string') return '';
    const compact = value.replace(/\s+/g, ' ').trim();
    return compact.length <= max ? compact : `${compact.slice(0, max - 1)}…`;
  };

  const languageFromPath = (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const map = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.go': 'go',
      '.rs': 'rust',
      '.java': 'java',
      '.json': 'json',
      '.md': 'markdown',
      '.sql': 'sql',
      '.css': 'css',
      '.html': 'html',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.c': 'c',
      '.cpp': 'cpp',
      '.h': 'c',
    };
    return map[ext] || null;
  };

  const safeRelativePath = (root, targetPath) => {
    try {
      const rel = path.relative(root, targetPath).replace(/\\/g, '/');
      return rel && !rel.startsWith('..') ? rel : targetPath;
    } catch {
      return targetPath;
    }
  };

  const faviconForUrl = (url) => {
    try {
      const hostname = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
    } catch {
      return null;
    }
  };

  const hostnameFromUrl = (url) => {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  };

  const parseUrlLike = (value) => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) return `https://${trimmed}`;
    return null;
  };

  const exaSearch = async (query, limit) => {
    const key = process.env.EXA_API_KEY || process.env.KRONOSCHAMBER_EXA_API_KEY || '';
    if (!key.trim()) {
      return null;
    }

    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key.trim(),
      },
      body: JSON.stringify({
        query,
        numResults: Math.max(1, Math.min(limit, 25)),
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Exa request failed (${response.status})${detail ? `: ${detail}` : ''}`);
    }

    const payload = await response.json().catch(() => ({}));
    const results = Array.isArray(payload?.results) ? payload.results : [];

    return results
      .map((item, index) => {
        const url = typeof item?.url === 'string' ? item.url : '';
        const title = typeof item?.title === 'string' ? item.title : url;
        const summary = normalizeSnippet(
          typeof item?.text === 'string' ? item.text : typeof item?.summary === 'string' ? item.summary : '',
        );

        return {
          id: `exa-${index}-${url}`,
          title: title || url,
          url,
          hostname: (() => {
            try {
              return new URL(url).hostname;
            } catch {
              return '';
            }
          })(),
          favicon: faviconForUrl(url),
          snippet: summary,
          summary,
        };
      })
      .filter((item) => item.url);
  };

  const browserOsSearch = async (query, limit) => {
    const mcpUrl =
      process.env.BROWSEROS_MCP_URL || process.env.KRONOSCHAMBER_BROWSEROS_MCP_URL || process.env.OPENCHAMBER_OPENBROWSER_API_URL || '';
    if (!mcpUrl.trim()) {
      return [];
    }

    const target = mcpUrl.replace(/\/+$/, '');
    const response = await fetch(`${target}/tools/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'tools/call',
        params: {
          name: 'search',
          arguments: {
            query,
            limit: Math.max(1, Math.min(limit, 20)),
          },
        },
      }),
    });

    if (!response.ok) {
      return [];
    }

    const payload = await response.json().catch(() => ({}));
    const rawResults = payload?.result?.content || payload?.result || payload?.results || [];
    const candidates = Array.isArray(rawResults) ? rawResults : [];

    const mapped = candidates
      .map((item, index) => {
        const url = typeof item?.url === 'string' ? item.url : typeof item?.link === 'string' ? item.link : '';
        const title = typeof item?.title === 'string' ? item.title : url;
        const summary = normalizeSnippet(
          typeof item?.snippet === 'string' ? item.snippet : typeof item?.text === 'string' ? item.text : '',
        );
        return {
          id: `browseros-${index}-${url}`,
          title: title || url,
          url,
          hostname: (() => {
            try {
              return new URL(url).hostname;
            } catch {
              return '';
            }
          })(),
          favicon: faviconForUrl(url),
          snippet: summary,
          summary,
        };
      })
      .filter((item) => item.url);

    return mapped;
  };

  const extractJsonArray = (text) => {
    if (typeof text !== 'string') return [];
    const start = text.indexOf('[');
    if (start === -1) return [];
    const candidate = text.slice(start).trim();
    try {
      const parsed = JSON.parse(candidate);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const toFilePathFromUri = (uriOrPath) => {
    if (typeof uriOrPath !== 'string' || uriOrPath.trim().length === 0) return null;
    if (uriOrPath.startsWith('file://')) {
      try {
        return decodeURIComponent(new URL(uriOrPath).pathname);
      } catch {
        return null;
      }
    }
    return uriOrPath;
  };

  const readLineSnippet = async (filePath, lineNumber, query) => {
    try {
      const content = await fsPromises.readFile(filePath, 'utf8');
      const lines = content.split(/\r?\n/);
      const index = Number.isFinite(lineNumber) && lineNumber > 0 ? lineNumber - 1 : -1;
      if (index >= 0 && index < lines.length) {
        return normalizeSnippet(lines[index], 220);
      }

      const q = String(query || '')
        .trim()
        .toLowerCase();
      if (!q) {
        return normalizeSnippet(lines[0] || '', 220);
      }

      const match = lines.find((line) => line.toLowerCase().includes(q));
      return normalizeSnippet(match || lines[0] || '', 220);
    } catch {
      return '';
    }
  };

  const runLspWorkspaceSymbols = async (query) => {
    if (!String(query || '').trim()) {
      return [];
    }

    const result = spawnSync('./packages/kronoscode/bin/kronoscode', ['debug', 'lsp', 'symbols', String(query)], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      timeout: 15000,
      maxBuffer: 1024 * 1024 * 6,
    });

    if (result.error || result.status !== 0) {
      return [];
    }

    const parsed = extractJsonArray(String(result.stdout || ''));
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  };

  const screenpipeDbPath = () => {
    const envPath = process.env.KRONOSCHAMBER_SCREENPIPE_DB || process.env.SCREENPIPE_DB_PATH || '';
    return envPath.trim() ? envPath.trim() : SCREENPIPE_DEFAULT_DB;
  };

  const sqliteQueryJson = (databasePath, sql) => {
    const run = spawnSync('sqlite3', ['-json', databasePath, sql], {
      encoding: 'utf8',
      timeout: 12000,
      maxBuffer: 1024 * 1024 * 8,
    });
    if (run.error || run.status !== 0) {
      return [];
    }
    try {
      const parsed = JSON.parse(String(run.stdout || '[]'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const escapeSqlLike = (input) => String(input || '').replace(/'/g, "''");

  const toRelativeTimeLabel = (isoOrSqliteTimestamp) => {
    const parsed = new Date(isoOrSqliteTimestamp);
    if (Number.isNaN(parsed.getTime())) return 'unknown time';

    const diffMs = Date.now() - parsed.getTime();
    const seconds = Math.max(0, Math.floor(diffMs / 1000));
    if (seconds < 60) return `${seconds} seconds ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  };

  const extractCandidatesFromText = (text) => {
    const content = typeof text === 'string' ? text : '';
    const urlMatches = content.match(/https?:\/\/[^\s)"']+/g) || [];
    const unixPathMatches = content.match(/(?:\/[\w.\-]+)+\/?[\w.\-]*\.[A-Za-z0-9]{1,8}/g) || [];
    const windowsPathMatches = content.match(/[A-Za-z]:\\(?:[\w.\- ]+\\)+[\w.\- ]+\.[A-Za-z0-9]{1,8}/g) || [];

    const fileCandidates = Array.from(
      new Set([...unixPathMatches, ...windowsPathMatches].map((entry) => entry.replace(/\\/g, '/')).slice(0, 8)),
    );

    const urlCandidates = Array.from(new Set(urlMatches.slice(0, 8)));

    return { fileCandidates, urlCandidates };
  };

  const buildTemporalPlan = (rows, splitView = 'split') => {
    const fileSet = new Set();
    const urlSet = new Set();

    for (const row of rows) {
      const { fileCandidates, urlCandidates } = extractCandidatesFromText(row?.text || '');
      for (const filePath of fileCandidates) fileSet.add(filePath);
      for (const url of urlCandidates) urlSet.add(url);
    }

    const files = Array.from(fileSet).slice(0, 12);
    const urls = Array.from(urlSet).slice(0, 8);
    const confidenceBase = 0.25 + (files.length > 0 ? 0.25 : 0) + (urls.length > 0 ? 0.25 : 0);
    const confidence = Math.min(0.95, confidenceBase + Math.min(rows.length, 5) * 0.05);
    const unresolved = [];

    if (files.length === 0) {
      unresolved.push('No explicit file paths were discovered in OCR history.');
    }
    if (urls.length === 0) {
      unresolved.push('No explicit URLs were discovered in OCR history.');
    }

    return {
      files,
      urls,
      splitView: splitView === 'browser-only' || splitView === 'chat-only' ? splitView : 'split',
      confidence,
      unresolved,
    };
  };

  app.get('/api/omnibox/web', async (req, res) => {
    const query = String(req.query.q || '').trim();
    const limit = clampOmniboxLimit(req.query.limit, 24);

    try {
      const suggestionUrl = parseUrlLike(query);

      let provider = 'none';
      let items = [];

      try {
        const exaResults = await exaSearch(query, limit);
        if (Array.isArray(exaResults) && exaResults.length > 0) {
          provider = 'exa';
          items = exaResults;
        }
      } catch {}

      if (items.length === 0) {
        const browserOsResults = await browserOsSearch(query, limit).catch(() => []);
        if (browserOsResults.length > 0) {
          provider = 'browseros';
          items = browserOsResults;
        }
      }

      if (suggestionUrl) {
        items.unshift({
          id: `url-suggestion-${suggestionUrl}`,
          title: suggestionUrl,
          url: suggestionUrl,
          hostname: hostnameFromUrl(suggestionUrl),
          favicon: faviconForUrl(suggestionUrl),
          snippet: 'Open URL suggestion',
          summary: 'Open URL suggestion',
        });
      }

      res.json({
        items: items.slice(0, limit),
        provider,
      });
    } catch (error) {
      res.status(500).json({ error: error?.message || 'Failed to fetch omnibox web results' });
    }
  });

  app.get('/api/omnibox/codebase', async (req, res) => {
    const query = String(req.query.q || '').trim();
    const rawDirectory =
      typeof req.query.directory === 'string' && req.query.directory.trim().length > 0 ? req.query.directory.trim() : process.cwd();
    const directory = path.resolve(normalizeDirectoryPath(rawDirectory));
    const limit = clampOmniboxLimit(req.query.limit, 60);

    try {
      const files = await searchFilesystemFiles(directory, {
        limit: Math.max(limit, 40),
        query,
        includeHidden: false,
        respectGitignore: true,
      });

      const fileItems = await Promise.all(
        files.slice(0, Math.min(limit, 60)).map(async (file, index) => {
          const snippet = await readLineSnippet(file.path, null, query);
          return {
            id: `file-${index}-${file.path}`,
            kind: 'file',
            name: file.name,
            path: file.path,
            relativePath: file.relativePath,
            language: languageFromPath(file.path),
            snippet,
            line: null,
            column: null,
            symbolKind: null,
          };
        }),
      );

      const rawSymbols = await runLspWorkspaceSymbols(query);
      const symbolItems = await Promise.all(
        rawSymbols.slice(0, Math.min(limit, 40)).map(async (symbol, index) => {
          const symbolName = typeof symbol?.name === 'string' ? symbol.name : `symbol-${index}`;
          const symbolKind = typeof symbol?.kind === 'number' || typeof symbol?.kind === 'string' ? String(symbol.kind) : null;

          const uriCandidate = symbol?.location?.uri || symbol?.uri || symbol?.targetUri || '';
          const filePath = toFilePathFromUri(uriCandidate);
          if (!filePath || !path.isAbsolute(filePath) || !filePath.startsWith(directory)) {
            return null;
          }

          const line = Number.isFinite(symbol?.location?.range?.start?.line)
            ? Number(symbol.location.range.start.line) + 1
            : Number.isFinite(symbol?.range?.start?.line)
              ? Number(symbol.range.start.line) + 1
              : null;
          const column = Number.isFinite(symbol?.location?.range?.start?.character)
            ? Number(symbol.location.range.start.character) + 1
            : Number.isFinite(symbol?.range?.start?.character)
              ? Number(symbol.range.start.character) + 1
              : null;

          return {
            id: `symbol-${index}-${filePath}-${symbolName}`,
            kind: 'symbol',
            name: symbolName,
            path: filePath,
            relativePath: safeRelativePath(directory, filePath),
            language: languageFromPath(filePath),
            snippet: await readLineSnippet(filePath, line, query || symbolName),
            line,
            column,
            symbolKind,
          };
        }),
      );

      const merged = [...symbolItems.filter(Boolean), ...fileItems].slice(0, limit);

      res.json({
        items: merged,
        lspUsed: symbolItems.filter(Boolean).length > 0,
      });
    } catch (error) {
      res.status(500).json({ error: error?.message || 'Failed to fetch omnibox codebase results' });
    }
  });

  app.get('/api/omnibox/temporal', async (req, res) => {
    const query = String(req.query.q || '').trim();
    const limit = clampOmniboxLimit(req.query.limit, 60);
    const before = String(req.query.before || '').trim();
    const databasePath = screenpipeDbPath();

    try {
      if (!fs.existsSync(databasePath)) {
        return res.json({ items: [], available: false });
      }

      const whereParts = [];
      if (query) {
        whereParts.push(`LOWER(COALESCE(o.text,'')) LIKE '%${escapeSqlLike(query.toLowerCase())}%'`);
      }
      if (before) {
        whereParts.push(`f.timestamp <= '${escapeSqlLike(before)}'`);
      }
      const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

      const sql = `
        SELECT
          CAST(f.id AS TEXT) AS frame_id,
          f.timestamp AS timestamp,
          COALESCE(o.app_name, '') AS app_name,
          COALESCE(o.window_name, '') AS window_name,
          COALESCE(o.text, '') AS text
        FROM ocr_text o
        JOIN frames f ON o.frame_id = f.id
        ${whereClause}
        ORDER BY f.timestamp DESC
        LIMIT ${limit};
      `;

      const rows = sqliteQueryJson(databasePath, sql);
      const items = rows.map((row, index) => {
        const text = String(row?.text || '');
        const summary = normalizeSnippet(text, 180) || 'No OCR text available for this frame.';
        const { fileCandidates, urlCandidates } = extractCandidatesFromText(text);

        return {
          id: row?.frame_id ? String(row.frame_id) : `frame-${index}`,
          timestamp: String(row?.timestamp || ''),
          relativeTime: toRelativeTimeLabel(row?.timestamp),
          appName: String(row?.app_name || 'Unknown app'),
          windowName: String(row?.window_name || 'Unknown window'),
          activitySummary: summary,
          fileCandidates,
          urlCandidates,
          confidence: Math.min(0.9, 0.35 + (fileCandidates.length > 0 ? 0.2 : 0) + (urlCandidates.length > 0 ? 0.2 : 0)),
        };
      });

      return res.json({ items, available: true });
    } catch (error) {
      return res.status(500).json({ error: error?.message || 'Failed to fetch temporal memory results' });
    }
  });

  app.post('/api/omnibox/temporal/restore/preview', async (req, res) => {
    const entryId = String(req.body?.entryId || '').trim();
    const timestamp = String(req.body?.timestamp || '').trim();
    const splitView = String(req.body?.splitView || 'split');
    const databasePath = screenpipeDbPath();

    if (!entryId && !timestamp) {
      return res.status(400).json({ error: 'entryId or timestamp is required' });
    }

    try {
      if (!fs.existsSync(databasePath)) {
        return res.json({
          ok: true,
          entryId: entryId || timestamp,
          timestamp,
          plan: {
            files: [],
            urls: [],
            splitView: splitView === 'browser-only' || splitView === 'chat-only' ? splitView : 'split',
            confidence: 0.05,
            unresolved: ['Screenpipe database was not found.'],
          },
        });
      }

      const where = entryId ? `CAST(f.id AS TEXT) = '${escapeSqlLike(entryId)}'` : `f.timestamp = '${escapeSqlLike(timestamp)}'`;

      const sql = `
        SELECT
          CAST(f.id AS TEXT) AS frame_id,
          f.timestamp AS timestamp,
          COALESCE(o.text, '') AS text
        FROM ocr_text o
        JOIN frames f ON o.frame_id = f.id
        WHERE ${where}
        ORDER BY f.timestamp DESC
        LIMIT 10;
      `;

      const rows = sqliteQueryJson(databasePath, sql);
      const plan = buildTemporalPlan(rows, splitView);

      return res.json({
        ok: true,
        entryId: entryId || (rows[0]?.frame_id ? String(rows[0].frame_id) : timestamp),
        timestamp: timestamp || String(rows[0]?.timestamp || ''),
        plan,
      });
    } catch (error) {
      return res.status(500).json({ error: error?.message || 'Failed to build restore preview' });
    }
  });

  app.post('/api/omnibox/temporal/restore/apply', async (req, res) => {
    const entryId = String(req.body?.entryId || '').trim();
    const timestamp = String(req.body?.timestamp || '').trim();
    const splitView = String(req.body?.splitView || 'split');
    const databasePath = screenpipeDbPath();

    if (!entryId && !timestamp) {
      return res.status(400).json({ error: 'entryId or timestamp is required' });
    }

    try {
      if (!fs.existsSync(databasePath)) {
        return res.json({
          ok: true,
          applied: [],
          skipped: ['Screenpipe database was not found.'],
          plan: {
            files: [],
            urls: [],
            splitView: splitView === 'browser-only' || splitView === 'chat-only' ? splitView : 'split',
            confidence: 0.05,
            unresolved: ['Screenpipe database was not found.'],
          },
        });
      }

      const where = entryId ? `CAST(f.id AS TEXT) = '${escapeSqlLike(entryId)}'` : `f.timestamp = '${escapeSqlLike(timestamp)}'`;
      const sql = `
        SELECT
          CAST(f.id AS TEXT) AS frame_id,
          f.timestamp AS timestamp,
          COALESCE(o.text, '') AS text
        FROM ocr_text o
        JOIN frames f ON o.frame_id = f.id
        WHERE ${where}
        ORDER BY f.timestamp DESC
        LIMIT 16;
      `;

      const rows = sqliteQueryJson(databasePath, sql);
      const plan = buildTemporalPlan(rows, splitView);

      const applied = [];
      if (plan.files.length > 0) applied.push(`files:${plan.files.length}`);
      if (plan.urls.length > 0) applied.push(`urls:${plan.urls.length}`);
      const skipped = plan.unresolved.length > 0 ? [...plan.unresolved] : [];

      return res.json({
        ok: true,
        applied,
        skipped,
        plan,
      });
    } catch (error) {
      return res.status(500).json({ error: error?.message || 'Failed to apply temporal restore' });
    }
  });

  let ptyProviderPromise = null;
  const getPtyProvider = async () => {
    if (ptyProviderPromise) {
      return ptyProviderPromise;
    }

    ptyProviderPromise = (async () => {
      const isBunRuntime = typeof globalThis.Bun !== 'undefined';

      if (isBunRuntime) {
        try {
          const bunPty = await import('bun-pty');
          console.log('Using bun-pty for terminal sessions');
          return { spawn: bunPty.spawn, backend: 'bun-pty' };
        } catch (error) {
          console.warn('bun-pty unavailable, falling back to node-pty');
        }
      }

      try {
        const nodePty = await import('node-pty');
        console.log('Using node-pty for terminal sessions');
        return { spawn: nodePty.spawn, backend: 'node-pty' };
      } catch (error) {
        console.error('Failed to load node-pty:', error && error.message ? error.message : error);
        if (isBunRuntime) {
          throw new Error('No PTY backend available. Install bun-pty or node-pty.');
        }
        throw new Error('node-pty is not available. Run: npm rebuild node-pty (or install Bun for bun-pty)');
      }
    })();

    return ptyProviderPromise;
  };

  const terminalSessions = new Map();
  const MAX_TERMINAL_SESSIONS = 20;
  const TERMINAL_IDLE_TIMEOUT = 30 * 60 * 1000;
  const terminalInputCapabilities = {
    input: {
      preferred: 'ws',
      transports: ['http', 'ws'],
      ws: {
        path: TERMINAL_INPUT_WS_PATH,
        v: 1,
        enc: 'text+json-bin-control',
      },
    },
  };

  const sendTerminalInputWsControl = (socket, payload) => {
    if (!socket || socket.readyState !== 1) {
      return;
    }

    try {
      socket.send(createTerminalInputWsControlFrame(payload), { binary: true });
    } catch {}
  };

  terminalInputWsServer = new WebSocketServer({
    noServer: true,
    maxPayload: TERMINAL_INPUT_WS_MAX_PAYLOAD_BYTES,
  });

  kronosGatewayWsServer = new WebSocketServer({
    noServer: true,
    maxPayload: 8 * 1024 * 1024,
  });

  kronosGatewayWsServer.on('connection', (socket, request) => {
    try {
      proxyKronosGatewayConnection({
        client: socket,
        requestUrl: request.url,
        gatewayUrl: buildOpenCodeUrl('/global/gateway', ''),
      });
    } catch {
      socket.close(1011, 'KronosCode gateway unavailable');
    }
  });

  terminalInputWsServer.on('connection', (socket) => {
    const connectionState = {
      boundSessionId: null,
      invalidFrames: 0,
      rebindTimestamps: [],
      lastActivityAt: Date.now(),
    };

    sendTerminalInputWsControl(socket, { t: 'ok', v: 1 });

    const heartbeatInterval = setInterval(() => {
      if (socket.readyState !== 1) {
        return;
      }

      try {
        socket.ping();
      } catch {}
    }, TERMINAL_INPUT_WS_HEARTBEAT_INTERVAL_MS);

    socket.on('pong', () => {
      connectionState.lastActivityAt = Date.now();
    });

    socket.on('message', (message, isBinary) => {
      connectionState.lastActivityAt = Date.now();

      if (isBinary) {
        const controlMessage = readTerminalInputWsControlFrame(message);
        if (!controlMessage || typeof controlMessage.t !== 'string') {
          connectionState.invalidFrames += 1;
          sendTerminalInputWsControl(socket, {
            t: 'e',
            c: 'BAD_FRAME',
            f: connectionState.invalidFrames >= 10,
          });
          if (connectionState.invalidFrames >= 10) {
            socket.close(1008, 'protocol violation');
          }
          return;
        }

        if (controlMessage.t === 'p') {
          sendTerminalInputWsControl(socket, { t: 'po', v: 1 });
          return;
        }

        if (controlMessage.t !== 'b' || typeof controlMessage.s !== 'string') {
          connectionState.invalidFrames += 1;
          sendTerminalInputWsControl(socket, {
            t: 'e',
            c: 'BAD_FRAME',
            f: connectionState.invalidFrames >= 10,
          });
          if (connectionState.invalidFrames >= 10) {
            socket.close(1008, 'protocol violation');
          }
          return;
        }

        const now = Date.now();
        connectionState.rebindTimestamps = pruneRebindTimestamps(connectionState.rebindTimestamps, now, TERMINAL_INPUT_WS_REBIND_WINDOW_MS);

        if (isRebindRateLimited(connectionState.rebindTimestamps, TERMINAL_INPUT_WS_MAX_REBINDS_PER_WINDOW)) {
          sendTerminalInputWsControl(socket, { t: 'e', c: 'RATE_LIMIT', f: false });
          return;
        }

        const nextSessionId = controlMessage.s.trim();
        const targetSession = terminalSessions.get(nextSessionId);
        if (!targetSession) {
          connectionState.boundSessionId = null;
          sendTerminalInputWsControl(socket, { t: 'e', c: 'SESSION_NOT_FOUND', f: false });
          return;
        }

        connectionState.rebindTimestamps.push(now);
        connectionState.boundSessionId = nextSessionId;
        sendTerminalInputWsControl(socket, { t: 'bok', v: 1 });
        return;
      }

      const payload = normalizeTerminalInputWsMessageToText(message);
      if (payload.length === 0) {
        return;
      }

      if (!connectionState.boundSessionId) {
        sendTerminalInputWsControl(socket, { t: 'e', c: 'NOT_BOUND', f: false });
        return;
      }

      const session = terminalSessions.get(connectionState.boundSessionId);
      if (!session) {
        connectionState.boundSessionId = null;
        sendTerminalInputWsControl(socket, { t: 'e', c: 'SESSION_NOT_FOUND', f: false });
        return;
      }

      try {
        session.ptyProcess.write(payload);
        session.lastActivity = Date.now();
      } catch {
        sendTerminalInputWsControl(socket, { t: 'e', c: 'WRITE_FAIL', f: false });
      }
    });

    socket.on('close', () => {
      clearInterval(heartbeatInterval);
    });

    socket.on('error', (error) => {
      void error;
    });
  });

  server.on('upgrade', (req, socket, head) => {
    const pathname = parseRequestPathname(req.url);

    if (businessProxyMiddleware && pathname.startsWith(NOCOBASE_PROXY_BASE_PATH)) {
      try {
        businessProxyMiddleware.upgrade(req, socket, head);
      } catch {
        rejectWebSocketUpgrade(socket, 502, 'Business workspace websocket proxy failed');
      }
      return;
    }

    if (socialProxyMiddleware && pathname.startsWith(SOCIAL_PROXY_BASE_PATH)) {
      try {
        socialProxyMiddleware.upgrade(req, socket, head);
      } catch {
        rejectWebSocketUpgrade(socket, 502, 'Social workspace websocket proxy failed');
      }
      return;
    }

    if (videoProxyMiddleware && pathname.startsWith(VIDEO_PROXY_BASE_PATH)) {
      try {
        videoProxyMiddleware.upgrade(req, socket, head);
      } catch {
        rejectWebSocketUpgrade(socket, 502, 'Video workspace websocket proxy failed');
      }
      return;
    }

    if (jaazProxyMiddleware && pathname.startsWith(JAAZ_PROXY_BASE_PATH)) {
      try {
        jaazProxyMiddleware.upgrade(req, socket, head);
      } catch {
        rejectWebSocketUpgrade(socket, 502, 'Jaaz import adapter websocket proxy failed');
      }
      return;
    }

    if (pathname !== TERMINAL_INPUT_WS_PATH && pathname !== KRONOS_GATEWAY_WS_PATH) {
      return;
    }

    const handleUpgrade = async () => {
      try {
        if (uiAuthController?.enabled) {
          const sessionToken = uiAuthController?.ensureSessionToken?.(req, null);
          if (!sessionToken) {
            rejectWebSocketUpgrade(socket, 401, 'UI authentication required');
            return;
          }

          const originAllowed = await isRequestOriginAllowed(req);
          if (!originAllowed) {
            rejectWebSocketUpgrade(socket, 403, 'Invalid origin');
            return;
          }
        }

        const targetWsServer = pathname === KRONOS_GATEWAY_WS_PATH ? kronosGatewayWsServer : terminalInputWsServer;
        if (!targetWsServer) {
          rejectWebSocketUpgrade(socket, 500, 'WebSocket unavailable');
          return;
        }

        targetWsServer.handleUpgrade(req, socket, head, (ws) => {
          targetWsServer.emit('connection', ws, req);
        });
      } catch {
        rejectWebSocketUpgrade(socket, 500, 'Upgrade failed');
      }
    };

    void handleUpgrade();
  });

  setInterval(
    () => {
      const now = Date.now();
      for (const [sessionId, session] of terminalSessions.entries()) {
        if (now - session.lastActivity > TERMINAL_IDLE_TIMEOUT) {
          console.log(`Cleaning up idle terminal session: ${sessionId}`);
          try {
            session.ptyProcess.kill();
          } catch (error) {}
          terminalSessions.delete(sessionId);
        }
      }
    },
    5 * 60 * 1000,
  );

  app.post('/api/terminal/create', async (req, res) => {
    try {
      if (terminalSessions.size >= MAX_TERMINAL_SESSIONS) {
        return res.status(429).json({ error: 'Maximum terminal sessions reached' });
      }

      const { cwd, cols, rows } = req.body;
      if (!cwd) {
        return res.status(400).json({ error: 'cwd is required' });
      }

      try {
        await fs.promises.access(cwd);
      } catch {
        return res.status(400).json({ error: 'Invalid working directory' });
      }

      const shell = process.env.SHELL || (process.platform === 'win32' ? 'powershell.exe' : '/bin/zsh');

      const sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

      const envPath = buildAugmentedPath();
      const resolvedEnv = { ...process.env, PATH: envPath };

      const pty = await getPtyProvider();
      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: cols || 80,
        rows: rows || 24,
        cwd: cwd,
        env: {
          ...resolvedEnv,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
        },
      });

      const session = {
        ptyProcess,
        ptyBackend: pty.backend,
        cwd,
        lastActivity: Date.now(),
        clients: new Set(),
      };

      terminalSessions.set(sessionId, session);

      ptyProcess.onExit(({ exitCode, signal }) => {
        console.log(`Terminal session ${sessionId} exited with code ${exitCode}, signal ${signal}`);
        terminalSessions.delete(sessionId);
      });

      console.log(`Created terminal session: ${sessionId} in ${cwd}`);
      res.json({ sessionId, cols: cols || 80, rows: rows || 24, capabilities: terminalInputCapabilities });
    } catch (error) {
      console.error('Failed to create terminal session:', error);
      res.status(500).json({ error: error.message || 'Failed to create terminal session' });
    }
  });

  app.get('/api/terminal/:sessionId/stream', (req, res) => {
    const { sessionId } = req.params;
    const session = terminalSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Terminal session not found' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const clientId = Math.random().toString(36).substring(7);
    session.clients.add(clientId);
    session.lastActivity = Date.now();

    const runtime = typeof globalThis.Bun === 'undefined' ? 'node' : 'bun';
    const ptyBackend = session.ptyBackend || 'unknown';
    res.write(`data: ${JSON.stringify({ type: 'connected', runtime, ptyBackend })}\n\n`);

    const heartbeatInterval = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch (error) {
        console.error(`Heartbeat failed for client ${clientId}:`, error);
        clearInterval(heartbeatInterval);
      }
    }, 15000);

    const dataHandler = (data) => {
      try {
        session.lastActivity = Date.now();
        const ok = res.write(`data: ${JSON.stringify({ type: 'data', data })}\n\n`);
        if (!ok && session.ptyProcess && typeof session.ptyProcess.pause === 'function') {
          session.ptyProcess.pause();
          res.once('drain', () => {
            if (session.ptyProcess && typeof session.ptyProcess.resume === 'function') {
              session.ptyProcess.resume();
            }
          });
        }
      } catch (error) {
        console.error(`Error sending data to client ${clientId}:`, error);
        cleanup();
      }
    };

    const exitHandler = ({ exitCode, signal }) => {
      try {
        res.write(`data: ${JSON.stringify({ type: 'exit', exitCode, signal })}\n\n`);
        res.end();
      } catch (error) {}
      cleanup();
    };

    const dataDisposable = session.ptyProcess.onData(dataHandler);
    const exitDisposable = session.ptyProcess.onExit(exitHandler);

    const cleanup = () => {
      clearInterval(heartbeatInterval);
      session.clients.delete(clientId);

      if (dataDisposable && typeof dataDisposable.dispose === 'function') {
        dataDisposable.dispose();
      }
      if (exitDisposable && typeof exitDisposable.dispose === 'function') {
        exitDisposable.dispose();
      }

      try {
        res.end();
      } catch (error) {}

      console.log(`Client ${clientId} disconnected from terminal session ${sessionId}`);
    };

    req.on('close', cleanup);
    req.on('error', cleanup);

    console.log(`Terminal connected: session=${sessionId} client=${clientId} runtime=${runtime} pty=${ptyBackend}`);
  });

  app.post('/api/terminal/:sessionId/input', express.text({ type: '*/*' }), (req, res) => {
    const { sessionId } = req.params;
    const session = terminalSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Terminal session not found' });
    }

    const data = typeof req.body === 'string' ? req.body : '';

    try {
      session.ptyProcess.write(data);
      session.lastActivity = Date.now();
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to write to terminal:', error);
      res.status(500).json({ error: error.message || 'Failed to write to terminal' });
    }
  });

  app.post('/api/terminal/:sessionId/resize', (req, res) => {
    const { sessionId } = req.params;
    const session = terminalSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Terminal session not found' });
    }

    const { cols, rows } = req.body;
    if (!cols || !rows) {
      return res.status(400).json({ error: 'cols and rows are required' });
    }

    try {
      session.ptyProcess.resize(cols, rows);
      session.lastActivity = Date.now();
      res.json({ success: true, cols, rows });
    } catch (error) {
      console.error('Failed to resize terminal:', error);
      res.status(500).json({ error: error.message || 'Failed to resize terminal' });
    }
  });

  app.delete('/api/terminal/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = terminalSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Terminal session not found' });
    }

    try {
      session.ptyProcess.kill();
      terminalSessions.delete(sessionId);
      console.log(`Closed terminal session: ${sessionId}`);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to close terminal:', error);
      res.status(500).json({ error: error.message || 'Failed to close terminal' });
    }
  });

  app.post('/api/terminal/:sessionId/restart', async (req, res) => {
    const { sessionId } = req.params;
    const { cwd, cols, rows } = req.body;

    if (!cwd) {
      return res.status(400).json({ error: 'cwd is required' });
    }

    const existingSession = terminalSessions.get(sessionId);
    if (existingSession) {
      try {
        existingSession.ptyProcess.kill();
      } catch (error) {}
      terminalSessions.delete(sessionId);
    }

    try {
      try {
        const stats = await fs.promises.stat(cwd);
        if (!stats.isDirectory()) {
          return res.status(400).json({ error: 'Invalid working directory: not a directory' });
        }
      } catch (error) {
        return res.status(400).json({ error: 'Invalid working directory: not accessible' });
      }

      const shell = process.env.SHELL || (process.platform === 'win32' ? 'powershell.exe' : '/bin/zsh');

      const newSessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

      const envPath = buildAugmentedPath();
      const resolvedEnv = { ...process.env, PATH: envPath };

      const pty = await getPtyProvider();
      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: cols || 80,
        rows: rows || 24,
        cwd: cwd,
        env: {
          ...resolvedEnv,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
        },
      });

      const session = {
        ptyProcess,
        ptyBackend: pty.backend,
        cwd,
        lastActivity: Date.now(),
        clients: new Set(),
      };

      terminalSessions.set(newSessionId, session);

      ptyProcess.onExit(({ exitCode, signal }) => {
        console.log(`Terminal session ${newSessionId} exited with code ${exitCode}, signal ${signal}`);
        terminalSessions.delete(newSessionId);
      });

      console.log(`Restarted terminal session: ${sessionId} -> ${newSessionId} in ${cwd}`);
      res.json({ sessionId: newSessionId, cols: cols || 80, rows: rows || 24, capabilities: terminalInputCapabilities });
    } catch (error) {
      console.error('Failed to restart terminal session:', error);
      res.status(500).json({ error: error.message || 'Failed to restart terminal session' });
    }
  });

  app.post('/api/terminal/force-kill', (req, res) => {
    const { sessionId, cwd } = req.body;
    let killedCount = 0;

    if (sessionId) {
      const session = terminalSessions.get(sessionId);
      if (session) {
        try {
          session.ptyProcess.kill();
        } catch (error) {}
        terminalSessions.delete(sessionId);
        killedCount++;
      }
    } else if (cwd) {
      for (const [id, session] of terminalSessions) {
        if (session.cwd === cwd) {
          try {
            session.ptyProcess.kill();
          } catch (error) {}
          terminalSessions.delete(id);
          killedCount++;
        }
      }
    } else {
      for (const [id, session] of terminalSessions) {
        try {
          session.ptyProcess.kill();
        } catch (error) {}
        terminalSessions.delete(id);
        killedCount++;
      }
    }

    console.log(`Force killed ${killedCount} terminal session(s)`);
    res.json({ success: true, killedCount });
  });

  try {
    // Stamp the Chamber server's own port into the env so the core engine
    // knows where to POST desktop browser actions
    process.env.KRONOSCHAMBER_DESKTOP = 'true';
    process.env.KRONOSCHAMBER_BASE_URL = `http://127.0.0.1:${port}`;

    syncFromHmrState();
    if (await isOpenCodeProcessHealthy()) {
      console.log(`[HMR] Reusing existing OpenCode process on port ${openCodePort}`);
    } else if (ENV_SKIP_OPENCODE_START && (ENV_CONFIGURED_OPENCODE_URL || ENV_CONFIGURED_OPENCODE_PORT)) {
      const configured = await validateConfiguredOpenCode();
      const parsed = new URL(configured.baseUrl);
      const configuredPort = Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80));
      console.log(`Using validated external KronosCode server at ${configured.baseUrl} (skip-start mode)`);
      setOpenCodePort(configuredPort);
      isOpenCodeReady = true;
      isExternalOpenCode = true;
      lastOpenCodeError = null;
      openCodeNotReadySince = 0;
      syncToHmrState();
    } else if (
      !ENV_DISABLE_OPENCODE_AUTODETECT &&
      ENV_CONFIGURED_OPENCODE_PORT &&
      (await probeExternalOpenCode(ENV_CONFIGURED_OPENCODE_PORT))
    ) {
      console.log(`Auto-detected existing KronosCode server on port ${ENV_CONFIGURED_OPENCODE_PORT}`);
      setOpenCodePort(ENV_CONFIGURED_OPENCODE_PORT);
      isOpenCodeReady = true;
      isExternalOpenCode = true;
      lastOpenCodeError = null;
      openCodeNotReadySince = 0;
      syncToHmrState();
    } else if (!ENV_DISABLE_OPENCODE_AUTODETECT && !ENV_CONFIGURED_OPENCODE_PORT && (await probeExternalOpenCode(4096))) {
      console.log('Auto-detected existing KronosCode server on default port 4096');
      setOpenCodePort(4096);
      isOpenCodeReady = true;
      isExternalOpenCode = true;
      lastOpenCodeError = null;
      openCodeNotReadySince = 0;
      syncToHmrState();
    } else {
      if (ENV_CONFIGURED_OPENCODE_PORT) {
        console.log(`Using OpenCode port from environment: ${ENV_CONFIGURED_OPENCODE_PORT}`);
        setOpenCodePort(ENV_CONFIGURED_OPENCODE_PORT);
      } else {
        openCodePort = null;
        syncToHmrState();
      }

      lastOpenCodeError = null;
      openCodeProcess = await startOpenCode();
      syncToHmrState();
    }
    await waitForOpenCodePort();
    try {
      await waitForOpenCodeReady();
    } catch (error) {
      console.error(`OpenCode readiness check failed: ${error.message}`);
      scheduleOpenCodeApiDetection();
    }
    setupProxy(app);
    scheduleOpenCodeApiDetection();
    startHealthMonitoring();
    void startGlobalEventWatcher();

    // Register the Chamber MCP server with the core engine so all Tauri
    // capabilities are available as first-class MCP tools
    void registerChamberMcpWithCoreEngine();
    void registerKrondesignMcpWithCoreEngine();
  } catch (error) {
    console.error(`Failed to start OpenCode: ${error.message}`);
    console.log('Continuing without OpenCode integration...');
    lastOpenCodeError = error.message;
    setupProxy(app);
    scheduleOpenCodeApiDetection();
  }

  const distPath = (() => {
    const env = typeof process.env.OPENCHAMBER_DIST_DIR === 'string' ? process.env.OPENCHAMBER_DIST_DIR.trim() : '';
    if (env) {
      return path.resolve(env);
    }
    return path.join(__dirname, '..', 'dist');
  })();

  if (fs.existsSync(distPath)) {
    console.log(`Serving static files from ${distPath}`);
    app.use(
      express.static(distPath, {
        setHeaders(res, filePath) {
          // Service workers should never be long-cached; iOS is especially sensitive.
          if (typeof filePath === 'string' && filePath.endsWith(`${path.sep}sw.js`)) {
            res.setHeader('Cache-Control', 'no-store');
          }
        },
      }),
    );

    // Alias for PWA manifest (.webmanifest redirect → /site.webmanifest)
    app.get('/manifest.webmanifest', (req, res) => {
      res.redirect(301, '/site.webmanifest');
    });

    app.get(
      /^(?!\/api|\/business|\/social|\/video|\/imports\/jaaz|.*\.(js|css|svg|png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot|map)).*$/,
      (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      },
    );
  } else {
    console.warn(`Warning: ${distPath} not found, static files will not be served`);
    app.get(
      /^(?!\/api|\/business|\/social|\/video|\/imports\/jaaz|.*\.(js|css|svg|png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot|map)).*$/,
      (req, res) => {
        res.status(404).send('Static files not found. Please build the application first.');
      },
    );
  }

  let activePort = port;

  const bindHost =
    typeof process.env.OPENCHAMBER_HOST === 'string' && process.env.OPENCHAMBER_HOST.trim().length > 0
      ? process.env.OPENCHAMBER_HOST.trim()
      : null;

  await new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('error', onError);
      reject(error);
    };
    server.once('error', onError);
    const onListening = async () => {
      server.off('error', onError);
      const addressInfo = server.address();
      activePort = typeof addressInfo === 'object' && addressInfo ? addressInfo.port : port;

      // Now we know the real port — stamp it everywhere
      const chamberUrl = `http://127.0.0.1:${activePort}`;
      process.env.KRONOSCHAMBER_DESKTOP = 'true';
      process.env.KRONOSCHAMBER_BASE_URL = chamberUrl;
      setChamberBaseUrl(chamberUrl);

      try {
        process.send?.({ type: 'openchamber:ready', port: activePort });
      } catch {
        // ignore
      }

      console.log(`KronosChamber server running on port ${activePort}`);
      console.log(`Health check: http://localhost:${activePort}/health`);
      console.log(`Web interface: http://localhost:${activePort}`);

      if (tryCfTunnel) {
        console.log('\nInitializing Cloudflare Quick Tunnel...');
        const cfCheck = await checkCloudflaredAvailable();
        if (cfCheck.available) {
          try {
            const originUrl = `http://localhost:${activePort}`;
            cloudflareTunnelController = await startCloudflareTunnel({ originUrl, port: activePort });
            printTunnelWarning();
            if (onTunnelReady) {
              const tunnelUrl = cloudflareTunnelController.getPublicUrl();
              if (tunnelUrl) {
                onTunnelReady(tunnelUrl);
              }
            }
          } catch (error) {
            console.error(`Failed to start Cloudflare tunnel: ${error.message}`);
            console.log('Continuing without tunnel...');
          }
        }
      }

      resolve();
    };

    if (bindHost) {
      server.listen(port, bindHost, onListening);
    } else {
      server.listen(port, onListening);
    }
  });

  if (attachSignals && !signalsAttached) {
    const handleSignal = async () => {
      await gracefulShutdown();
    };
    process.on('SIGTERM', handleSignal);
    process.on('SIGINT', handleSignal);
    process.on('SIGQUIT', handleSignal);
    signalsAttached = true;
    syncToHmrState();
  }

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown();
  });

  return {
    expressApp: app,
    httpServer: server,
    getPort: () => activePort,
    getOpenCodePort: () => openCodePort,
    getTunnelUrl: () => cloudflareTunnelController?.getPublicUrl() ?? null,
    isReady: () => isOpenCodeReady,
    restartOpenCode: () => restartOpenCode(),
    stop: (shutdownOptions = {}) => gracefulShutdown({ exitProcess: shutdownOptions.exitProcess ?? false }),
  };
}

const isCliExecution = process.argv[1] === __filename;

if (isCliExecution) {
  const cliOptions = parseArgs();
  exitOnShutdown = true;
  main({
    port: cliOptions.port,
    tryCfTunnel: cliOptions.tryCfTunnel,
    attachSignals: true,
    exitOnShutdown: true,
    uiPassword: cliOptions.uiPassword,
  }).catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export { gracefulShutdown, setupProxy, restartOpenCode, main as startWebUiServer, parseArgs };
