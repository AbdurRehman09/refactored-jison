// Standalone test for token handling
var Grammar = require('./lib/grammar').Grammar;

console.log("Testing token handling...");

// Test token processing with explicit tokens
function testExplicitTokens() {
  var grammar = {
    tokens: "x y z",
    bnf: {
      "S": ["A"],
      "A": ["x y z"]
    }
  };

  var g = new Grammar(grammar);
  
  console.log("Terminals:", g.terminals);
  console.log("Tokens declared and used correctly:", 
    g.terminals.includes('x') && 
    g.terminals.includes('y') && 
    g.terminals.includes('z'));
  
  return g.terminals.includes('x') && 
         g.terminals.includes('y') && 
         g.terminals.includes('z');
}

// Test token processing with implicit tokens
function testImplicitTokens() {
  var grammar = {
    bnf: {
      "S": ["A"],
      "A": ["x y z"]
    }
  };

  var g = new Grammar(grammar);
  
  console.log("Terminals with implicit tokens:", g.terminals);
  console.log("Tokens used correctly:", 
    g.terminals.includes('x') && 
    g.terminals.includes('y') && 
    g.terminals.includes('z'));
  
  return g.terminals.includes('x') && 
         g.terminals.includes('y') && 
         g.terminals.includes('z');
}

// Test unused tokens warning
function testUnusedTokens() {
  var originalWarn = console.warn;
  var warnings = [];
  
  console.warn = function() {
    warnings.push(Array.from(arguments).join(' '));
  };
  
  try {
    var grammar = {
      tokens: "x y z w",
      bnf: {
        "S": ["A"],
        "A": ["x y z"]
      }
    };

    var g = new Grammar(grammar);
    
    console.log("Warnings for unused tokens:", warnings);
    return warnings.some(function(warning) {
      return warning.includes('unused tokens');
    });
  } finally {
    console.warn = originalWarn;
  }
}

// Run tests
var testResults = [
  testExplicitTokens(),
  testImplicitTokens(),
  testUnusedTokens()
];

console.log("\nTest Results:");
console.log("Explicit tokens test:", testResults[0] ? "PASS" : "FAIL");
console.log("Implicit tokens test:", testResults[1] ? "PASS" : "FAIL");
console.log("Unused tokens test:", testResults[2] ? "PASS" : "FAIL");

var allPassed = testResults.every(function(result) { return result; });
console.log("\nOverall:", allPassed ? "ALL TESTS PASSED" : "SOME TESTS FAILED");

process.exit(allPassed ? 0 : 1); 