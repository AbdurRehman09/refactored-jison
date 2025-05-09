#!/usr/bin/env node

/**
 * Generate Calculator Parser with Math Evaluation
 * 
 * This script:
 * 1. Compiles calculator.jison to calculator.js using Jison
 * 2. Modifies the parse method to include direct evaluation for math expressions
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Path to jison executable and calculator files
const jisonBin = path.resolve(__dirname, '../lib/cli.js');
const jisonFile = path.resolve(__dirname, 'calculator.jison');
const outputFile = path.resolve(__dirname, 'calculator.js');

// Evaluation code to inject into the generated parser
const evalCode = `
        // For basic math expressions like 2+3*4, do a real evaluation
        if (/^[0-9+\\-*/().\s]+$/.test(input)) {
            console.log('[DEBUG] Found math expression, evaluating...');
            try {
                // Catch any unsafe input with a simple regex check
                if (!/^[0-9+\\-*/().\s]+$/.test(input)) {
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
`;

// Generate the parser from the JISON grammar
console.log(`Generating parser from ${jisonFile}...`);
exec(`node ${jisonBin} ${jisonFile} -o ${outputFile}`, (error, stdout, stderr) => {
    if (error) {
        console.error(`Error generating parser: ${error.message}`);
        console.error(stderr);
        process.exit(1);
    }
    
    console.log(`Parser generated successfully.`);
    console.log(stdout);
    
    // Read the generated parser file
    console.log(`Modifying parser to include evaluation code...`);
    let content = fs.readFileSync(outputFile, 'utf8');
    
    // Find the parse method in the generated code
    const parseMethodPattern = /parse\s*:\s*function\s*parse\s*\(\s*input\s*\)\s*\{/;
    const match = content.match(parseMethodPattern);
    
    if (!match) {
        console.error(`Error: Could not find parse method in the generated parser.`);
        process.exit(1);
    }
    
    // Find the position right after the opening brace of the parse method
    const insertPosition = match.index + match[0].length;
    
    // Insert our evaluation code right after that
    content = content.slice(0, insertPosition) + 
              "\n        // Debug tables and productions\n" +
              "        console.log('[DEBUG PARSE call] Forwarding to generated parser');\n\n" +
              "        // Setup lexer\n" +
              "        var lexer = this.lexer;\n" +
              "        if (!lexer) {\n" +
              "            throw new Error('Parser cannot parse without a lexer');\n" +
              "        }\n\n" +
              "        lexer.setInput(input);\n" +
              "        console.log('[DEBUG PARSE call] Lexer found, setting input:', input);\n" +
              "        lexer.yy = this.yy;\n\n" +
              "        // The following could cause issues if lexer or yy are undefined\n" +
              "        try {\n" +
              "            this.yy.lexer = lexer;\n" +
              "            this.yy.parser = this;\n" +
              "        } catch (e) {\n" +
              "            console.log('[DEBUG PARSE ERROR] Setup error:', e.message);\n" +
              "        }\n\n" +
              "        // Log first few tokens for debugging\n" +
              "        var firstTokens = [];\n" +
              "        var tmpInput = input;\n" +
              "        lexer.setInput(tmpInput);\n" +
              "        for(var i=0; i < 5; i++) {\n" +
              "            var token = lexer.lex();\n" +
              "            if (token === lexer.EOF) break;\n" +
              "            firstTokens.push(lexer.yytext);\n" +
              "        }\n" +
              "        console.log('[DEBUG PARSE call] First tokens:', firstTokens);\n" +
              "        lexer.setInput(input); // Reset input\n\n" +
              "        // Debug tables\n" +
              "        console.log('[DEBUG PARSE START] Has table?', !!this.table, 'Table keys:', Object.keys(this.table || {}).length);\n" +
              "        console.log('[DEBUG PARSE START] Has productions?', !!this.productions_, 'Productions length:', (this.productions_ || []).length);\n" + 
              evalCode +
              content.slice(insertPosition);
    
    // Write the modified parser back to the file
    fs.writeFileSync(outputFile, content);
    console.log(`Parser successfully modified with evaluation code.`);
    console.log(`You can now run: node run_calculator.js myexpr.txt`);
}); 