var Jison = require("../setup").Jison,
    assert = require("assert");

// Simple test lexer implementation for direct testing
function createSimpleLexer() {
    return {
        lex: function() {
            return this.tokens.length ? this.tokens.shift() : '';
        },
        setInput: function(input) {
            // Convert input like 'xyx' to tokens [120, 121, 120] (ASCII codes)
            this.tokens = input.split('').map(function(c) {
                return c.charCodeAt(0);
            });
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
}

exports["test tokens as string declaration"] = function () {
    var grammar = {
        tokens: "a b c",
        startSymbol: "pgm",
        bnf: {
            "pgm" : ["stmt_list"],
            "stmt_list" : ["stmt_list stmt", "stmt"],
            "stmt" : ["a b c"]
        }
    };

    var parser = new Jison.Parser(grammar, {type: "lr0"});
    
    // In our implementation, terminals_ is an object, not an array
    assert.ok(parser.terminals_ && typeof parser.terminals_ === 'object', "terminals_ should be an object");
    assert.ok('a' in parser.terminals_, "Token 'a' should be declared");
    assert.ok('b' in parser.terminals_, "Token 'b' should be declared");
    assert.ok('c' in parser.terminals_, "Token 'c' should be declared");
};

exports["test undeclared tokens warning"] = function () {
    var warnings = [];
    
    // Save original console.warn
    var originalWarn = console.warn;
    console.warn = function() {
        warnings.push(Array.prototype.slice.call(arguments).join(' '));
    };
    
    try {
        var grammar = {
            startSymbol: "pgm",
            bnf: {
                "pgm" : ["stmt_list"],
                "stmt_list" : ["stmt_list stmt", "stmt"],
                "stmt" : ["a b c"]
            }
        };

        var parser = new Jison.Parser(grammar, {type: "lr0"});
        
        // Should have a warning about undeclared tokens
        assert.ok(warnings.some(function(warning) {
            return warning.indexOf('undeclared tokens') >= 0;
        }), "Should warn about undeclared tokens");
        
    } finally {
        // Restore original console.warn
        console.warn = originalWarn;
    }
};

exports["test unused tokens warning"] = function () {
    var warnings = [];
    
    // Save original console.warn
    var originalWarn = console.warn;
    console.warn = function() {
        warnings.push(Array.prototype.slice.call(arguments).join(' '));
    };
    
    try {
        var grammar = {
            tokens: "a b c d e",
            startSymbol: "pgm",
            bnf: {
                "pgm" : ["stmt_list"],
                "stmt_list" : ["stmt_list stmt", "stmt"],
                "stmt" : ["a b c"]
            }
        };

        var parser = new Jison.Parser(grammar, {type: "lr0"});
        
        // Should have a warning about unused tokens
        assert.ok(warnings.some(function(warning) {
            return warning.indexOf('unused tokens') >= 0;
        }), "Should warn about unused tokens");
        
    } finally {
        // Restore original console.warn
        console.warn = originalWarn;
    }
}; 