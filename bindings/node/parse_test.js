import assert from "node:assert";
import { test } from "node:test";
import Parser from "tree-sitter";

async function loadLanguage() {
  // Dynamically import the compiled language binding
  const { default: language } = await import("./index.js");
  return language;
}

function nodeText(node, source) {
  return source.slice(node.startIndex, node.endIndex);
}

function findFirst(node, type) {
  if (!node) return null;
  if (node.type === type) return node;
  for (const child of node.namedChildren) {
    const found = findFirst(child, type);
    if (found) return found;
  }
  return null;
}

test("parse: package declaration", async () => {
  const language = await loadLanguage();
  const parser = new Parser();
  parser.setLanguage(language);

  const src = "package main";
  const tree = parser.parse(src);
  assert.strictEqual(tree.rootNode.type, "source_file");

  const pkg = findFirst(tree.rootNode, "package_declaration");
  assert.ok(pkg, "expected a package_declaration node");
  const nameNode = pkg.childForFieldName("name");
  assert.ok(nameNode, "package declaration should have a name field");
  assert.strictEqual(nodeText(nameNode, src), "main");
});

test("parse: simple function declaration with return and body", async () => {
  const language = await loadLanguage();
  const parser = new Parser();
  parser.setLanguage(language);

  const src = "func add(a int, b int) int { return a + b }";
  const tree = parser.parse(src);
  assert.strictEqual(tree.rootNode.type, "source_file");

  const fn = findFirst(tree.rootNode, "function_declaration");
  assert.ok(fn, "expected a function_declaration node");

  const nameNode = fn.childForFieldName("name");
  assert.ok(nameNode, "function should have a name");
  assert.strictEqual(nodeText(nameNode, src), "add");

  const params = fn.childForFieldName("params");
  assert.ok(params, "function should have a params field");
  // params text should include the two parameters
  const paramsText = nodeText(params, src);
  assert.ok(paramsText.includes("a int"), "params should include 'a int'");
  assert.ok(paramsText.includes("b int"), "params should include 'b int'");

  const body = fn.childForFieldName("body");
  assert.ok(body, "function should have a body");
  assert.strictEqual(body.type, "block");
});

test("parse: var declaration with initializer", async () => {
  const language = await loadLanguage();
  const parser = new Parser();
  parser.setLanguage(language);

  const src = "var x = 42";
  const tree = parser.parse(src);
  assert.strictEqual(tree.rootNode.type, "source_file");

  const varDecl = findFirst(tree.rootNode, "variable_declaration");
  assert.ok(varDecl, "expected a variable_declaration node");

  // The textual span of the declaration should contain the initializer
  const varText = nodeText(varDecl, src);
  assert.ok(
    varText.includes("x"),
    "variable decl should include the variable name 'x'",
  );
  assert.ok(
    varText.includes("="),
    "variable decl should include an '=' initializer",
  );
  assert.ok(
    varText.includes("42"),
    "variable decl should include the initializer value '42'",
  );
});

test("parse: call expression", async () => {
  const language = await loadLanguage();
  const parser = new Parser();
  parser.setLanguage(language);

  const src = 'print("hello")';
  const tree = parser.parse(src);
  assert.strictEqual(tree.rootNode.type, "source_file");

  const call = findFirst(tree.rootNode, "call_expression");
  assert.ok(call, "expected a call_expression node");

  const func = call.childForFieldName("function");
  assert.ok(func, "call expression should have a function field");
  assert.strictEqual(nodeText(func, src), "print");

  const args = call.childForFieldName("arguments");
  assert.ok(args, "call should have arguments");
  const argsText = nodeText(args, src);
  assert.ok(
    argsText.includes('"hello"'),
    "arguments should include the string literal",
  );
});
