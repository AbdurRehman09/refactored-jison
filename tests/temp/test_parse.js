var Jison = require('../../lib/jison.js');
var grammar = {
  bnf: {
    "expression": [
      ["NUMBER", "return Number(yytext);"],
      ["expression PLUS expression", "return $1 + $3;"]
    ]
  },
  operators: [
    ["left", "PLUS"]
  ]
};

// Create custom lexer rules with debugging
var lexRules = {
  rules: [
    ["\\s+", "/* skip whitespace */"],
    ["[0-9]+", "console.log('LEXER matched NUMBER:', yytext); return 'NUMBER';"],
    ["\\+", "console.log('LEXER matched PLUS:', yytext); return 'PLUS';"]
  ]
};

// Create parser
var parser = new Jison.Parser(grammar);
parser.lexer = new Jison.Lexer(lexRules);

// Test simple parsing
var result = parser.parse("5");
console.log("Result of parsing '5':", result);

// Test more complex parsing
var result2 = parser.parse("5 + 10");
console.log("Result of parsing '5 + 10':", result2); 