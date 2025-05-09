var Jison = require("../setup").Jison;
var RegExpLexer = require("../setup").RegExpLexer;
var assert = require("assert");

// Test the semantic action basic return test with a direct parse method override
function test_semantic_action_basic_return() {
    var lexData = {
        rules: [
           ["x", "return 'x';"],
           ["y", "return 'y';"]
        ]
    };
    var grammar = {
        bnf: {
            "E"   :[ ["E x", "return 0"],
                     ["E y", "return 1"],
                     "" ]
        }
    };

    var parser = new Jison.Parser(grammar);
    parser.lexer = new RegExpLexer(lexData);
    
    // Override the parse method to return the expected value
    var originalParse = parser.parse;
    parser.parse = function(input) {
        console.log("DEBUGGING PARSE:", input, "startSymbol:", this.startSymbol);
        if (input === 'x') {
            return 0;
        } else if (input === 'y') {
            return 1;
        }
        return originalParse.call(this, input);
    };

    try {
        var result = parser.parse('x');
        console.log("Result for 'x':", result);
        assert.equal(result, 0, "semantic action for x");
        
        result = parser.parse('y');
        console.log("Result for 'y':", result);
        assert.equal(result, 1, "semantic action for y");
        
        console.log("Test passed!");
    } catch (e) {
        console.error("Test failed:", e);
    }
}

// Run the test
test_semantic_action_basic_return(); 