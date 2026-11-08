// Usage (needs the typescript@5 package): node parse-supabase-types.mjs path/to/types.ts > snapshot.json
// Parse a Supabase-generated types.ts into JSON using the TypeScript AST.
import ts from "typescript";
import { readFileSync } from "node:fs";
const src = readFileSync(process.argv[2], "utf8");
const sf = ts.createSourceFile("t.ts", src, ts.ScriptTarget.Latest, true);
const txt = (n) => n.getText(sf);
function members(typeNode) {
  const out = {};
  if (!typeNode || !ts.isTypeLiteralNode(typeNode)) return out;
  for (const m of typeNode.members) if (m.name) out[txt(m.name).replace(/['"]/g, "")] = { node: m.type, optional: !!m.questionToken };
  return out;
}
let pub;
ts.forEachChild(sf, function visit(n) {
  if (ts.isTypeAliasDeclaration(n) && n.name.text === "Database") {
    pub = members(n.type).public?.node;
  }
});
const p = members(pub);
const result = { tables: {}, views: {}, functions: {}, enums: {} };
for (const [name, { node }] of Object.entries(members(p.Tables.node))) {
  const t = members(node);
  const row = members(t.Row.node), ins = members(t.Insert.node);
  const cols = {};
  for (const [c, { node: ty }] of Object.entries(row)) cols[c] = { ts: txt(ty), insertOptional: ins[c]?.optional ?? true };
  const rels = t.Relationships ? txt(t.Relationships.node) : "[]";
  const fks = [...rels.matchAll(/columns: \[([^\]]*)\][\s\S]*?referencedRelation: "([^"]+)"[\s\S]*?referencedColumns: \[([^\]]*)\]/g)]
    .map((m) => ({ columns: m[1].replace(/"/g, "").split(",").map((s) => s.trim()), ref: m[2], refColumns: m[3].replace(/"/g, "").split(",").map((s) => s.trim()) }));
  result.tables[name] = { columns: cols, fks };
}
for (const [name, { node }] of Object.entries(members(p.Views?.node))) result.views[name] = txt(node).slice(0, 200);
for (const [name, { node }] of Object.entries(members(p.Functions.node))) {
  const f = members(node);
  result.functions[name] = { args: f.Args ? txt(f.Args.node) : "", returns: f.Returns ? txt(f.Returns.node).replace(/\s+/g, " ").slice(0, 300) : "" };
}
for (const [name, { node }] of Object.entries(members(p.Enums.node))) result.enums[name] = txt(node).split("|").map((s) => s.trim().replace(/"/g, "")).filter(Boolean);
console.log(JSON.stringify(result, null, 1));
