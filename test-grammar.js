// Minimal test for Grammar
const Grammar = require('./lib/grammar').Grammar;

// Create a simple grammar
const grammar = {
  tokens: "x y",
  bnf: {
    "S": ["A"],
    "A": ["A x", "A y", ""]
  }
};

// Create the Grammar instance
try {
  console.log("Creating grammar...");
  const g = new Grammar(grammar);
  
  console.log("Grammar created successfully");
  console.log("Terminals:", g.terminals);
  console.log("Symbols:", g.symbols);
  console.log("Productions:", g.productions.length);
  
  const hasXToken = g.terminals.indexOf('x') !== -1;
  const hasYToken = g.terminals.indexOf('y') !== -1;
  
  console.log("Has x token:", hasXToken);
  console.log("Has y token:", hasYToken);
  
  console.log("Test result:", hasXToken && hasYToken ? "PASS" : "FAIL");
  process.exit(0);
} catch (e) {
  console.error("Error creating grammar:", e);
  process.exit(1);
} 