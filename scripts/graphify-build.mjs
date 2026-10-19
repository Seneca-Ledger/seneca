import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const GRAPHIFY_OUT = path.join(REPO_ROOT, 'graphify-out');

const BUILD_CODE = String.raw`
import json
import os
import re
import sys
from pathlib import Path

from graphify.build import build_from_json
from graphify.cluster import cluster
from graphify.detect import detect, save_manifest
from graphify.export import to_json
from graphify.extract import extract

ROOT = Path(sys.argv[1]).resolve()
OUT = ROOT / "graphify-out"
OUT.mkdir(parents=True, exist_ok=True)
(OUT / ".graphify_python").write_text(sys.executable, encoding="utf-8")

CORPUS_PATHS = [
    ROOT / "backend" / "src",
    ROOT / "frontend" / "app",
    ROOT / "frontend" / "lib",
    ROOT / "README.md",
    ROOT / "docs" / "plans",
]

def rel(path):
    return Path(path).resolve().relative_to(ROOT)

def rel_text(path):
    return rel(path).as_posix()

def merge_detection(targets):
    files = {"code": [], "document": [], "paper": [], "image": [], "video": []}
    total_words = 0
    skipped_sensitive = []
    for target in targets:
        if not target.exists():
            continue
        result = detect(target)
        total_words += int(result.get("total_words") or 0)
        skipped_sensitive.extend(result.get("skipped_sensitive") or [])
        for kind, paths in (result.get("files") or {}).items():
            files.setdefault(kind, []).extend(paths)
    for kind in files:
        files[kind] = sorted(set(files[kind]))
    return {
        "files": files,
        "total_files": sum(len(paths) for paths in files.values()),
        "total_words": total_words,
        "needs_graph": True,
        "warning": None,
        "skipped_sensitive": skipped_sensitive,
        "scan_root": str(ROOT),
    }

def node_id(prefix, source_file):
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", source_file).strip("_").lower()
    return f"{prefix}_{slug}"[:180]

def read_excerpt(path, max_chars=4000):
    text = Path(path).read_text(encoding="utf-8", errors="ignore")
    return re.sub(r"\s+", " ", text).strip()[:max_chars]

detection = merge_detection(CORPUS_PATHS)
files = detection["files"]
code_files = [rel(path) for path in files.get("code", [])]
document_files = [Path(path) for path in files.get("document", [])]

os.chdir(ROOT)
if code_files:
    extraction = extract(code_files, cache_root=ROOT)
else:
    extraction = {"nodes": [], "edges": [], "hyperedges": [], "input_tokens": 0, "output_tokens": 0}

for doc_path in document_files:
    source_file = rel_text(doc_path)
    extraction["nodes"].append({
        "id": node_id("doc", source_file),
        "label": doc_path.name,
        "file_type": "document",
        "source_file": source_file,
        "source_location": "L1",
        "summary": read_excerpt(doc_path),
    })

G = build_from_json(extraction)
communities = cluster(G)
to_json(G, communities, str(OUT / "graph.json"))
save_manifest(detection["files"])
(OUT / "build-summary.json").write_text(json.dumps({
    "code_files": len(code_files),
    "document_files": len(document_files),
    "nodes": G.number_of_nodes(),
    "edges": G.number_of_edges(),
}, indent=2), encoding="utf-8")
print(f"Graphify graph written to {OUT / 'graph.json'}")
print(f"Indexed {len(code_files)} code files and {len(document_files)} document files")
print(f"Graph has {G.number_of_nodes()} nodes and {G.number_of_edges()} edges")
`;

mkdirSync(GRAPHIFY_OUT, { recursive: true });

const python = resolveGraphifyPython();
const result = spawnSync(python, ['-c', BUILD_CODE, REPO_ROOT], {
  cwd: REPO_ROOT,
  stdio: 'inherit',
  env: process.env,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

function resolveGraphifyPython() {
  const candidates = [];
  if (process.env.GRAPHIFY_PYTHON) {
    candidates.push(process.env.GRAPHIFY_PYTHON);
  }

  const graphifyBin = findOnPath('graphify');
  if (graphifyBin) {
    const shebang = readShebangInterpreter(graphifyBin);
    if (shebang) {
      candidates.push(shebang);
    }
  }

  const uvPython = resolveUvToolPython();
  if (uvPython) {
    candidates.push(uvPython);
  }

  candidates.push('python3', 'python');

  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['-c', 'import graphify'], { stdio: 'ignore' });
    if (probe.status === 0) {
      return candidate;
    }
  }

  throw new Error('Unable to find a Python interpreter with graphify installed.');
}

function resolveUvToolPython() {
  if (!findOnPath('uv')) {
    return null;
  }

  const result = spawnSync('uv', ['tool', 'run', 'graphifyy', 'python', '-c', 'import sys; print(sys.executable)'], {
    encoding: 'utf8',
  });

  return result.status === 0 ? result.stdout.trim() || null : null;
}

function readShebangInterpreter(filePath) {
  try {
    const firstLine = readFileSync(filePath, 'utf8').split(/\r?\n/, 1)[0];
    return firstLine.startsWith('#!') ? firstLine.slice(2).trim().split(/\s+/)[0] : null;
  } catch {
    return null;
  }
}

function findOnPath(binary) {
  const command = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(command, [binary], { encoding: 'utf8' });
  if (result.status !== 0) {
    return null;
  }

  const first = result.stdout.split(/\r?\n/).find(Boolean);
  return first && existsSync(first) ? first : null;
}
