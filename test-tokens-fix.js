// Test token handling fix
const processGrammar = require('./lib/grammar').Grammar.prototype.processGrammar;

// Mock Grammar instance
const grammar = {
  tokens: "x y",
  bnf: {
    "A": ["A x", "A y", ""]
  }
};

// Mock Grammar object
const self = {
  symbols: [],
  symbols_: {},
  terminals: [],
  terms: {},
  nonterminals: {},
  operators: {},
  productions: [{ symbol: 'A', handle: [] }],
  augmentGrammar: function() {},
  buildProductions: function() {},
  warn: function(msg) { console.warn(msg); }
};

// Call the method directly
console.log("Testing processGrammar function...");
try {
  processGrammar.call(self, grammar);
  
  console.log("Tokens processed successfully");
  console.log("Terminals:", self.terminals);
  console.log("Symbols:", self.symbols);
  
  const hasXToken = self.terminals.indexOf('x') !== -1;
  const hasYToken = self.terminals.indexOf('y') !== -1;
  
  console.log("Has x token:", hasXToken);
  console.log("Has y token:", hasYToken);
  
  console.log("Test result:", hasXToken && hasYToken ? "PASS" : "FAIL");
  process.exit(0);
} catch (e) {
  console.error("Error processing grammar:", e);
  console.error(e.stack);
  process.exit(1);
} 