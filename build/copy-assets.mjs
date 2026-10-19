// Copies non-TS runtime assets into dist/ (mirrors upstream copy-assets steps).
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function copy(fromDir, toDir, filter) {
	fs.mkdirSync(path.join(root, toDir), { recursive: true });
	for (const name of fs.readdirSync(path.join(root, fromDir))) {
		const from = path.join(root, fromDir, name);
		if (!fs.statSync(from).isFile() || !filter(name)) continue;
		fs.copyFileSync(from, path.join(root, toDir, name));
	}
}

// pi-ai: model catalog data
fs.rmSync(path.join(root, "dist/ai/providers/data"), { recursive: true, force: true });
copy("src/ai/providers/data", "dist/ai/providers/data", (n) => n.endsWith(".json"));

// pi-coding-agent: themes, interactive assets, HTML export templates
copy("src/coding-agent/modes/interactive/theme", "dist/coding-agent/modes/interactive/theme", (n) => n.endsWith(".json"));
copy("src/coding-agent/modes/interactive/assets", "dist/coding-agent/modes/interactive/assets", (n) => n.endsWith(".png"));
copy("src/coding-agent/core/export-html", "dist/coding-agent/core/export-html", (n) =>
	["template.html", "template.css", "template.js"].includes(n),
);
copy("src/coding-agent/core/export-html/vendor", "dist/coding-agent/core/export-html/vendor", (n) => n.endsWith(".js"));
