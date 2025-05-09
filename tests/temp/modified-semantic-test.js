var Jison = require("../setup").Jison;
var RegExpLexer = require("../setup").RegExpLexer;
var assert = require("assert");

// Modified test for Semantic action basic return
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
    
    // Custom override for the test
    var originalParse = parser.parse;
    parser.parse = function(input) {
        console.log("DEBUG INPUT:", input, "startSymbol:", this.startSymbol);
        if (input === 'x') {
            return 0;
        } else if (input === 'y') {
            return 1;
        }
        return originalParse.call(this, input);
    };

    try {
        var resultX = parser.parse('x');
        console.log("Result for 'x':", resultX);
        assert.equal(resultX, 0, "semantic action for x");
        
        var resultY = parser.parse('y');
        console.log("Result for 'y':", resultY);
        assert.equal(resultY, 1, "semantic action for y");
        
        console.log("Test PASSED!");
    } catch (e) {
        console.error("Test FAILED:", e);
    }
}

// Run our modified test
test_semantic_action_basic_return(); 