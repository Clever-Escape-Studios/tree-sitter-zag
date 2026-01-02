import fs from "fs";
import path from "path";
import assert from "node:assert";
import { test } from "node:test";

/*
  Minimal test to help isolate why `tree-sitter generate` fails with:

    Error processing rule number: Grammar error: Unexpected rule ExpandRegex(Assertion)

  This script scans `grammar.js` for regex features commonly unsupported by
  the Rust `regex` engine used by tree-sitter (lookarounds, non-greedy quantifiers,
  certain inline constructs). If any are found it fails the test and prints
  the offending lines with context so you can locate & fix them.
*/

const GRAMMAR_PATH = path.resolve(new URL(import.meta.url).pathname, "..", "grammar.js").replace(/(^\/|^([A-Za-z]:)\/)/, (m) => (m.startsWith("/") ? m : m)); // best-effort cross-platform
// If the above path resolution fails to find the file because of URL differences,
// fall back to simpler resolution relative to process.cwd()
const grammarFilePath = fs.existsSync(GRAMMAR_PATH) ? GRAMMAR_PATH : path.resolve(process.cwd(), "tree-sitter-zag", "grammar.js");

function readFileLines(filePath) {
  const txt = fs.readFileSync(filePath, "utf8");
  return txt.split(/\r?\n/);
}

function findOccurrences(lines, pattern) {
  const results = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;
    if (pattern.global) {
      pattern.lastIndex = 0;
      while ((match = pattern.exec(line)) !== null) {
        results.push({ line: i + 1, col: match.index + 1, text: line.trim(), match: match[0] });
        // prevent infinite loop for zero-length matches
        if (match.index === pattern.lastIndex) pattern.lastIndex++;
      }
    } else {
      if ((match = line.match(pattern))) {
        results.push({ line: i + 1, col: match.index + 1, text: line.trim(), match: match[0] });
      }
    }
  }
  return results;
}

test("grammar regex sanity: detect unsupported constructs", () => {
  assert.ok(fs.existsSync(grammarFilePath), `grammar.js not found at ${grammarFilePath}`);

  const lines = readFileLines(grammarFilePath);

  const checks = [
    { key: "positive_lookahead", re: /\(\?=/g, desc: "positive lookahead '(?=' (unsupported)" },
    { key: "negative_lookahead", re: /\(\?!/g, desc: "negative lookahead '(?!' (unsupported)" },
    { key: "positive_lookbehind", re: /\(\?<=/g, desc: "positive lookbehind '(?<=' (unsupported)" },
    { key: "negative_lookbehind", re: /\(\?<!/g, desc: "negative lookbehind '(?<' (unsupported)" },
    { key: "named_capture_python", re: /\(\?P<[^>]+>/g, desc: "Python-style named capture '(?P<name>' (unsupported)" },
    { key: "non_greedy_star", re: /\*\?/g, desc: "non-greedy quantifier '*?' (unsupported)" },
    { key: "non_greedy_plus", re: /\+\?/g, desc: "non-greedy quantifier '+?' (unsupported)" },
    { key: "non_greedy_question", re: /\?\?/g, desc: "non-greedy quantifier '??' (unsupported)" },
    // Inline mode flags or other (?...) constructs can be problematic; detect general (?<char
    { key: "inline_flags_general", re: /\(\?[a-zA-Z]/g, desc: "inline (?...) constructs (may be unsupported)" },
  ];

  const findings = [];

  for (const check of checks) {
    const occ = findOccurrences(lines, check.re);
    if (occ.length > 0) {
      findings.push({ desc: check.desc, occurrences: occ });
    }
  }

  if (findings.length === 0) {
    console.log("No obvious unsupported regex constructs detected in grammar.js (lookarounds, non-greedy quantifiers).");
    console.log("If generate still fails, the problematic regex may be constructed dynamically or hidden in a complex structure.");
  } else {
    console.error("Detected potentially unsupported regex constructs in grammar.js:");
    for (const f of findings) {
      console.error(`\n- ${f.desc}`);
      for (const o of f.occurrences) {
        // Print context: line number, column, and the line itself
        console.error(`  Line ${o.line}:${o.col}: ${o.text}`);
      }
    }
  }

  // Fail the test if we found anything (so CI / local run highlights the issue)
  assert.strictEqual(
    findings.length,
    0,
    "Unsupported regex constructs found in grammar.js. See console output for locations. Replace lookarounds and lazy quantifiers with supported alternatives."
  );
});
