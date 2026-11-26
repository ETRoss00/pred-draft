import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

// Preserve the original, complete phased-build engine outside the live draft route.
const original = execFileSync('git', ['show', 'b1f0704:app/page.tsx'], {encoding:'utf8'});
const source = ts.createSourceFile('page.tsx', original, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = new Map();
for (const node of source.statements) {
  if (node.name && ts.isIdentifier(node.name)) declarations.set(node.name.text,node);
  if (ts.isVariableStatement(node)) for (const decl of node.declarationList.declarations) if(ts.isIdentifier(decl.name)) declarations.set(decl.name.text,node);
}
const needed = new Set();
function include(name) {
  const node=declarations.get(name);
  if(!node || needed.has(node)) return;
  needed.add(node);
  function visit(child) {if(ts.isIdentifier(child)) include(child.text);ts.forEachChild(child,visit);}
  ts.forEachChild(node,visit);
}
include('recommendBuild');
const printer=ts.createPrinter();
let code=source.statements.filter(node=>needed.has(node)).map(node=>printer.printNode(ts.EmitHint.Unspecified,node,source)).join('\n\n');
code=code.replace('function recommendBuild(', 'export function recommendBuild(').replace('function hasSourceBackedKit(hero?: Hero)', 'function hasSourceBackedKit(hero?: Hero): hero is Hero');
const imports="import { heroes, type Hero, type Role } from './audit';\nimport { items, type Item, type ItemRole } from './items';\n\n";
fs.writeFileSync(new URL('../data/predecessor/deferred-build.ts',import.meta.url), '// Original phased-build logic retained for later work; not called by the draft screen.\n'+imports+code+'\n');
