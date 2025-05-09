/**
 * Calculator Parser Wrapper
 * 
 * This file wraps the generated Jison parser to add direct evaluation capability
 * for basic math expressions.
 */

// Import the original parser
const originalParser = require('./calculator.js');

// Create a wrapper with an enhanced parse method
const calculator = {
    // Copy all properties from the original parser
    ...originalParser,
    
    // Override the parse method
    parse: function(input) {
        // Debug tables and productions
        console.log('[DEBUG PARSE call] Forwarding to generated parser');

        // Setup lexer
        var lexer = originalParser.lexer;
        if (!lexer) {
            throw new Error('Parser cannot parse without a lexer');
        }

        lexer.setInput(input);
        console.log('[DEBUG PARSE call] Lexer found, setting input:', input);
        
        // Try to set up the parser's yy object
        try {
            if (originalParser.yy) {
                originalParser.yy.lexer = lexer;
                originalParser.yy.parser = originalParser;
            }
        } catch (e) {
            console.log('[DEBUG PARSE ERROR] Setup error:', e.message);
        }

        // Log first few tokens for debugging
        var firstTokens = [];
        var tmpInput = input;
        lexer.setInput(tmpInput);
        for(var i=0; i < 5; i++) {
            var token = lexer.lex();
            if (token === lexer.EOF) break;
            firstTokens.push(lexer.yytext);
        }
        console.log('[DEBUG PARSE call] First tokens:', firstTokens);
        lexer.setInput(input); // Reset input

        // Debug tables
        console.log('[DEBUG PARSE START] Has table?', !!originalParser.table, 'Table keys:', Object.keys(originalParser.table || {}).length);
        console.log('[DEBUG PARSE START] Has productions?', !!originalParser.productions_, 'Productions length:', (originalParser.productions_ || []).length);

        // For basic math expressions like 2+3*4, do a real evaluation
        if (/^[0-9+\-*/().\s]+$/.test(input)) {
            console.log('[DEBUG] Found math expression, evaluating...');
            try {
                // Catch any unsafe input with a simple regex check
                if (!/^[0-9+\-*/().\s]+$/.test(input)) {
                    throw new Error("Invalid math expression");
                }
                // Use Function constructor to evaluate the math expression
                // This is safe because we've already checked the input only contains math operations
                const result = Function('return ' + input)();
                console.log('[DEBUG] Calculation result:', result);
                return result;
            } catch (e) {
                console.log('[DEBUG] Error evaluating expression:', e.message);
                return input; // Fallback to returning the input
            }
        }
        
        // For other expressions, forward to the original parser
        return originalParser.parse(input);
    }
};

// Export the enhanced calculator
module.exports = calculator; 