// Direct test for simpler isolated testing
var Jison = require("../setup").Jison;
var assert = require("assert");

// Simple lexer for testing
function SimpleLexer() {
  this.setInput = function(input) {
    this.input = input;
    this.pos = 0;
    this.yytext = '';
    this.yyleng = 0;
    this.yylineno = 0;
    this.yylloc = {first_line: 1, last_line: 1, first_column: 0, last_column: 0};
  };
  
  this.lex = function() {
    if (this.pos >= this.input.length) return '';
    var ch = this.input[this.pos++];
    this.yytext = ch;
    return ch;
  };
}

// Test the most basic case
function testBasic() {
  console.log("Testing basic parser...");
  
  var grammar = {
    tokens: "x y",
    bnf: {
      "S" : ["A"],
      "A" : ["A x", "A y", ""]
    }
  };
  
  var parser = new Jison.Parser(grammar, {type: "lr0"});
  parser.lexer = new SimpleLexer();
  
  try {
    var result = parser.parse("xyx");
    console.log("Basic test result:", !!result);
    return true;
  } catch (e) {
    console.error("Basic test error:", e);
    return false;
  }
}

// Run tests
var success = testBasic();
console.log("Test " + (success ? "passed" : "failed"));
process.exit(success ? 0 : 1); 