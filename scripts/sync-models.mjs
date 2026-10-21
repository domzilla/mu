#!/usr/bin/env node
// Syncs the model catalog of selected providers from a published @earendil-works/pi-ai package
// into mu's frozen catalog (src/ai/providers/data, schema v3). Node built-ins only.
//
// Usage: node scripts/sync-models.mjs [--version <x.y.z|tag>] [--provider <id>]... [--dry-run]
//
// Upstream entries are converted to the fields mu's types declare (parsed from src/ai/types.ts);
// everything else is dropped and reported. Providers not selected keep their frozen data.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import zlib from "node:zlib";

const PACKAGE = "@earendil-works/pi-ai";
const REGISTRY = process.env.npm_config_registry?.replace(/\/$/, "") || "https://registry.npmjs.org";
// Providers whose requests mu can actually serve (first-party providers of the shipped APIs).
const DEFAULT_PROVIDERS = ["anthropic", "openai", "openai-codex"];

const root = path.resolve(import.meta.dirname, "..");
const dataDir = path.join(root, "src/ai/providers/data");
const typesSource = fs.readFileSync(path.join(root, "src/ai/types.ts"), "utf8");

const { values: args } = parseArgs({
	options: {
		version: { type: "string", default: "latest" },
		provider: { type: "string", multiple: true },
		"dry-run": { type: "boolean", default: false },
	},
});
const providers = args.provider ?? DEFAULT_PROVIDERS;

// --- mu schema (derived from src/ai/types.ts) ---

function interfaceBody(name) {
	const match = typesSource.match(new RegExp(`export interface ${name}(?:<[^>]*>)?(?: extends ([\\w, ]+))? \\{\\n([\\s\\S]*?)\\n\\}`));
	if (!match) throw new Error(`interface ${name} not found in src/ai/types.ts`);
	return { parents: match[1]?.split(",").map((s) => s.trim()) ?? [], body: match[2] };
}

function interfaceFields(name) {
	const { parents, body } = interfaceBody(name);
	const own = Array.from(body.matchAll(/^\t(\w+)\??:/gm), (m) => m[1]);
	return new Set([...parents.flatMap((p) => [...interfaceFields(p)]), ...own]);
}

function stringUnion(typeName) {
	const match = typesSource.match(new RegExp(`export type ${typeName} =([^;]+);`));
	if (!match) throw new Error(`type ${typeName} not found in src/ai/types.ts`);
	return new Set(Array.from(match[1].matchAll(/"([^"]+)"/g), (m) => m[1]));
}

const modelFields = interfaceFields("Model");
const costFields = interfaceFields("ModelCost");
const tierFields = interfaceFields("ModelCostTier");
const knownApis = stringUnion("KnownApi");
const thinkingLevels = new Set(["off", ...stringUnion("ThinkingLevel")]);
// Model.compat is a conditional type: `TApi extends "a" | "b" ? SomeCompat : ...`.
const compatFieldsByApi = new Map();
for (const m of interfaceBody("Model").body.matchAll(/TApi extends ((?:"[^"]+"\s*\|?\s*)+)\s*\?\s*(\w+)/g)) {
	const fields = interfaceFields(m[2]);
	for (const api of m[1].matchAll(/"([^"]+)"/g)) compatFieldsByApi.set(api[1], fields);
}

// APIs whose implementation ships (their lazy loader is not an `unavailableApi()` stub).
const shippedApis = new Set(
	fs
		.readdirSync(path.join(root, "src/ai/api"))
		.filter((f) => f.endsWith(".lazy.ts") && f !== "lazy.ts")
		.filter((f) => !fs.readFileSync(path.join(root, "src/ai/api", f), "utf8").includes("unavailableApi("))
		.map((f) => f.slice(0, -".lazy.ts".length)),
);

// --- download + extract ---

async function fetchOk(url) {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`GET ${url}: ${res.status} ${res.statusText}`);
	return res;
}

function untar(buffer) {
	const files = new Map();
	let offset = 0;
	let longName;
	while (offset + 512 <= buffer.length) {
		const header = buffer.subarray(offset, offset + 512);
		if (header.every((b) => b === 0)) break;
		const str = (start, len) => header.toString("utf8", start, start + len).replace(/\0.*$/s, "");
		const size = Number.parseInt(str(124, 12).trim() || "0", 8);
		const type = str(156, 1);
		const prefix = str(345, 155);
		let name = longName ?? (prefix ? `${prefix}/${str(0, 100)}` : str(0, 100));
		longName = undefined;
		const content = buffer.subarray(offset + 512, offset + 512 + size);
		if (type === "x") {
			const pathRecord = content.toString("utf8").match(/\d+ path=([^\n]*)\n/);
			if (pathRecord) longName = pathRecord[1];
		} else if (type === "L") {
			longName = content.toString("utf8").replace(/\0.*$/s, "");
		} else if (type === "0" || type === "") {
			files.set(name, Buffer.from(content));
		}
		offset += 512 + Math.ceil(size / 512) * 512;
	}
	return files;
}

async function downloadPackage(spec) {
	const meta = await (await fetchOk(`${REGISTRY}/${PACKAGE.replace("/", "%2F")}/${encodeURIComponent(spec)}`)).json();
	const tarball = Buffer.from(await (await fetchOk(meta.dist.tarball)).arrayBuffer());
	const [algo, expected] = meta.dist.integrity.split(/-(.*)/s);
	const actual = createHash(algo).update(tarball).digest("base64");
	if (actual !== expected) throw new Error(`tarball integrity mismatch for ${PACKAGE}@${meta.version}`);
	return { version: meta.version, files: untar(zlib.gunzipSync(tarball)) };
}

// --- conversion ---

const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const sortedRecord = (entries) => Object.fromEntries([...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
const dropped = new Map(); // "field" -> count
const drop = (what) => dropped.set(what, (dropped.get(what) ?? 0) + 1);
const warnings = [];

function pick(obj, allowed, label) {
	const out = {};
	for (const [k, v] of Object.entries(obj)) {
		if (allowed.has(k)) out[k] = v;
		else drop(`${label}${k}`);
	}
	return out;
}

function convertModel(upstream, api) {
	const model = pick(upstream, modelFields, "");
	model.cost = pick(model.cost, costFields, "cost.");
	if (model.cost.tiers) model.cost.tiers = model.cost.tiers.map((t) => pick(t, tierFields, "cost.tiers[]."));
	if (model.thinkingLevelMap) {
		// Same semantics in mu and upstream: missing = provider default (xhigh/max: unsupported), null = unsupported.
		model.thinkingLevelMap = pick(model.thinkingLevelMap, thinkingLevels, "thinkingLevelMap.");
		for (const [level, value] of Object.entries(model.thinkingLevelMap)) {
			if (value !== null && typeof value !== "string") throw new Error(`${model.id}: thinkingLevelMap.${level} is ${JSON.stringify(value)}`);
		}
	}
	if (model.compat) {
		model.compat = pick(model.compat, compatFieldsByApi.get(api) ?? new Set(), "compat.");
		if (Object.keys(model.compat).length === 0) delete model.compat;
	}
	return model;
}

function convertProvider(providerId, upstreamGroups) {
	const groups = {};
	for (const [api, entries] of Object.entries(upstreamGroups)) {
		for (const [key, entry] of Object.entries(entries)) {
			const [kind, id] = key.includes(":") ? key.split(/:(.*)/s) : [entry.type ?? "chat", key];
			if (kind !== "chat" || (entry.type ?? "chat") !== "chat") {
				warnings.push(`${providerId}: skipped ${kind} entry ${id} (api ${api})`);
				continue;
			}
			if (!knownApis.has(api)) {
				warnings.push(`${providerId}: skipped ${id}: unknown api ${api}`);
				continue;
			}
			if (entry.id !== id || entry.api !== api || entry.provider !== providerId) {
				throw new Error(`${providerId}: entry ${key} has inconsistent id/api/provider`);
			}
			if (!shippedApis.has(api)) warnings.push(`${providerId}: ${id} uses api ${api}, which mu does not ship`);
			groups[api] ??= {};
			groups[api][id] = convertModel(entry, api);
		}
	}
	return groups;
}

// --- diff ---

const canonical = (v) =>
	JSON.stringify(v, (_, x) => (x && typeof x === "object" && !Array.isArray(x) ? sortedRecord(Object.entries(x)) : x));
const flatten = (groups) => Object.fromEntries(Object.values(groups).flatMap((g) => Object.entries(g)));

function leafDiffs(a, b, prefix = "") {
	if (canonical(a) === canonical(b)) return [];
	const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
	if (!isObj(a) || !isObj(b)) return [`${prefix || "(value)"}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`];
	const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
	return keys.flatMap((k) => leafDiffs(a[k], b[k], prefix ? `${prefix}.${k}` : k));
}

// --- main ---

const { version, files } = await downloadPackage(args.version);
const upstreamDir = "package/dist/providers/data/";
const upstreamManifest = JSON.parse(files.get(`${upstreamDir}.manifest.json`)?.toString("utf8") ?? "null");
if (!upstreamManifest) throw new Error(`${PACKAGE}@${version} has no ${upstreamDir}.manifest.json`);
console.log(`${PACKAGE}@${version}: catalog schemaVersion ${upstreamManifest.schemaVersion}, generated ${upstreamManifest.generatedAt}`);

const manifestPath = path.join(dataDir, ".manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const outputs = {};
let removedCount = 0;

for (const providerId of providers) {
	const file = `${providerId}.json`;
	const raw = files.get(upstreamDir + file);
	if (!raw) throw new Error(`${PACKAGE}@${version} has no catalog for provider ${providerId}`);
	if (upstreamManifest.files?.[file] && upstreamManifest.files[file] !== sha256(raw.toString("utf8"))) {
		throw new Error(`upstream ${file} does not match its manifest hash`);
	}
	if (!manifest.files[file]) throw new Error(`mu has no catalog for provider ${providerId}`);
	const next = convertProvider(providerId, JSON.parse(raw.toString("utf8")));
	const prev = JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
	outputs[file] = `${JSON.stringify(next)}\n`;

	const [a, b] = [flatten(prev), flatten(next)];
	const added = Object.keys(b).filter((id) => !(id in a));
	const removed = Object.keys(a).filter((id) => !(id in b));
	const changed = Object.keys(b).filter((id) => id in a && canonical(a[id]) !== canonical(b[id]));
	removedCount += removed.length;
	console.log(`\n== ${providerId}: ${Object.keys(a).length} -> ${Object.keys(b).length} models`);
	for (const id of added) console.log(`  + ${id}  (${b[id].name}; ctx ${b[id].contextWindow}, max ${b[id].maxTokens})`);
	for (const id of removed) console.log(`  - REMOVED ${id}  (${a[id].name})`);
	for (const id of changed) {
		console.log(`  ~ ${id}`);
		for (const line of leafDiffs(a[id], b[id])) console.log(`      ${line}`);
	}
}

if (dropped.size > 0) {
	console.log("\nDropped upstream fields mu does not know (field: occurrences):");
	for (const [what, n] of [...dropped].sort()) console.log(`  ${what}: ${n}`);
}
if (warnings.length > 0) {
	console.log("\nWarnings:");
	for (const w of warnings) console.log(`  ${w}`);
}
if (removedCount > 0) console.log(`\n!!! ${removedCount} model(s) REMOVED (see "- REMOVED" above) !!!`);

if (args["dry-run"]) {
	console.log("\nDry run: nothing written.");
} else {
	for (const [file, content] of Object.entries(outputs)) fs.writeFileSync(path.join(dataDir, file), content);
	const structure = {};
	const fileHashes = {};
	for (const file of Object.keys(manifest.files)) {
		const content = fs.readFileSync(path.join(dataDir, file), "utf8");
		fileHashes[file] = sha256(content);
		structure[file.slice(0, -".json".length)] = sortedRecord(
			Object.entries(JSON.parse(content)).flatMap(([api, models]) => Object.keys(models).map((id) => [id, api])),
		);
	}
	const nextManifest = {
		schemaVersion: manifest.schemaVersion,
		generatedAt: upstreamManifest.generatedAt,
		structureHash: sha256(JSON.stringify(sortedRecord(Object.entries(structure)))),
		files: sortedRecord(Object.entries(fileHashes)),
	};
	fs.writeFileSync(manifestPath, `${JSON.stringify(nextManifest)}\n`);
	console.log(`\nWrote ${Object.keys(outputs).join(", ")} and .manifest.json (generatedAt ${nextManifest.generatedAt}).`);
}
