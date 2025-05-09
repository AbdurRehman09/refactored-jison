var Jison = require('../../lib/jison.js');

// Create a simple grammar with just one rule
var grammar = {
  bnf: {
    "S": [
      ["A EOF", "return $1;"],
      ["EOF", "return 'empty';"]
    ],
    "A": [
      ["a", "return 'a';"]
    ]
  }
};

// Create a simple lexer
var lexer = {
  lex: function() {
    console.log("LEX called, index:", this.index, "input:", this.input);
    if (this.index >= this.input.length) {
      console.log("LEX returning EOF");
      return 'EOF';
    }
    
    var char = this.input[this.index++];
    console.log("LEX returning:", char);
    return char;
  },
  
  setInput: function(input) {
    console.log("LEXER setInput:", input);
    this.input = input;
    this.index = 0;
    this.yytext = '';
    this.yyleng = 0;
    this.yylineno = 0;
    this.yylloc = {
      first_line: 1,
      last_line: 1,
      first_column: 0,
      last_column: 0
    };
  }
};

// Create parser
var parser = new Jison.Parser(grammar);
parser.lexer = lexer;

// Test simple parsing
console.log("Testing empty input:");
var result1 = parser.parse("");
console.log("Result:", result1);

console.log("\nTesting input 'a':");
var result2 = parser.parse("a");
console.log("Result:", result2); 