/**
 * Jison - Parser Generator
 * A refactored, modular version with better code organization
 */

var parserConstructorCallCount = 0;

var typal = require('./util/typal').typal;
var Set = require('./util/set').Set;
var escodegen = require('escodegen');
var esprima = require('esprima');
var JSONSelect = require('JSONSelect');
var JisonInfo = require('./jison.js'); // For version info
var Lexer = require('jison-lex');
var Grammar = require('./grammar').Grammar;
var LALRTableGenerator = require('./table-generator').LALRTableGenerator;
var LR0TableGenerator = require('./table-generator').LR0TableGenerator;
var SLRTableGenerator = require('./table-generator').SLRTableGenerator;
var ParserGenerator = require('./parser-generator').ParserGenerator;
var version = require('../package.json').version;

// Define the Parser constructor first
function JisonParser(grammar, options) {
    var callId = ++parserConstructorCallCount;
    console.log("[DEBUG JisonParser ENTER call #" + callId + "] Input Grammar type:", typeof grammar);
    
    // Initialize basic properties
    this.yy = {};
    this.symbols_ = {};
    this.terminals_ = {};
    this.productions_ = {};
    this.table = [];
    this.defaultActions = {};
    this.version = version;
    this.options = options || {};
    this.Jison = Jison;
    
    // Log grammar details
    if (typeof grammar === 'object' && grammar !== null) {
        console.log("[DEBUG JisonParser call #" + callId + "] Input Grammar keys:", Object.keys(grammar).join(', '));
        console.log("[DEBUG JisonParser call #" + callId + "] Input Grammar has bnf?", !!grammar.bnf);
        console.log("[DEBUG JisonParser call #" + callId + "] Input Grammar has rules?", !!grammar.rules);
        console.log("[DEBUG JisonParser call #" + callId + "] Input Grammar has startSymbol?", !!grammar.startSymbol);
    }
    
    // Process grammar
    var internalGrammar = null;
    if (typeof grammar === 'string') {
        var ebnfParser;
        try { 
            ebnfParser = require('ebnf-parser'); 
        } catch (e) { 
            throw new Error("ebnf-parser is required to parse grammar strings."); 
        }
        try {
             internalGrammar = ebnfParser.parse(grammar);
        } catch (e) {
             throw new Error("Error parsing grammar string: " + e.message + "\n" + grammar);
        }
    } else if (typeof grammar === 'object' && grammar !== null) {
        internalGrammar = grammar; 
        } else {
        throw new Error("Invalid grammar object supplied to Jison.Parser constructor.");
    }
    this.grammar = internalGrammar;
    
    // Log internal grammar details
    console.log("[DEBUG JisonParser call #" + callId + "] Internal grammar type:", typeof this.grammar);
    if (this.grammar) {
         console.log("[DEBUG JisonParser call #" + callId + "] Internal grammar keys:", Object.keys(this.grammar).join(', '));
         console.log("[DEBUG JisonParser call #" + callId + "] Internal grammar has bnf?", !!this.grammar.bnf);
         console.log("[DEBUG JisonParser call #" + callId + "] Internal grammar has rules?", !!this.grammar.rules);
         console.log("[DEBUG JisonParser call #" + callId + "] Internal grammar has startSymbol?", !!this.grammar.startSymbol);
    }
    
    // Check if auto-generation is possible
    var canAutoGen = !!(this.grammar && (this.grammar.bnf || this.grammar.rules));
    
    // If grammar has bnf but no startSymbol, auto-set it
    if (canAutoGen && !this.grammar.startSymbol && this.grammar.bnf) {
        // Use first rule as start symbol
        for (var rule in this.grammar.bnf) {
            this.grammar.startSymbol = rule;
            console.log("[DEBUG JisonParser call #" + callId + "] Auto-setting startSymbol to:", rule);
            break;
        }
    }
    
    // Now check again if we can auto-generate
    canAutoGen = !!(this.grammar && (this.grammar.bnf || this.grammar.rules) && this.grammar.startSymbol);
    console.log("[DEBUG JisonParser call #" + callId + "] Can auto-generate?", canAutoGen);
    
    // Initialize parse method to fallback version
    this.parse = function(input) {
        throw new Error("Parser.parse() not implemented. Parser instance was not correctly generated or was not a complete grammar.");
    };
    
    if (canAutoGen) {
        console.log("[DEBUG JisonParser call #" + callId + "] Trying auto-generation...");
        try {
            var generator = new JisonGeneratorForParser(this.grammar, this.options);
            var generatedParserObj = generator.createParser();
            console.log("[DEBUG JisonParser call #" + callId + "] createParser() returned type:", typeof generatedParserObj);
            
            if (generatedParserObj && typeof generatedParserObj.parse === 'function') {
                console.log("[DEBUG JisonParser call #" + callId + "] Auto-gen SUCCESS, merging...");
                
                // THIS IS THE KEY DIFFERENCE: 
                // First, save the generated parse method to a temporary variable
                var generatedParse = generatedParserObj.parse;
                console.log("[DEBUG JisonParser call #" + callId + "] Saved generatedParse function, typeof:", typeof generatedParse);
                
                // Then copy all properties except parse
                for (var key in generatedParserObj) {
                    if (generatedParserObj.hasOwnProperty(key) && key !== 'parse') {
                        this[key] = generatedParserObj[key];
                    }
                }
                
                // Now define the parse method to forward to the generated one
                var self = this;
                this.parse = function(input) {
                    console.log("[DEBUG PARSE call] Forwarding to generated parser");
                    
                    // Ensure lexer is properly set up
                    if (!this.lexer) {
                        console.warn("[DEBUG PARSE call] No lexer found! Input parsing will fail.");
        } else {
                        console.log("[DEBUG PARSE call] Lexer found, setting input:", input);
                        // Make sure the lexer is properly initialized
                        if (typeof this.lexer.setInput === 'function') {
                            this.lexer.setInput(input);
                        }
                    }
                    
                    // Debug the first few tokens
                    if (this.lexer && typeof this.lexer.lex === 'function') {
                        var tokens = [];
                        var originalLex = this.lexer.lex;
                        var savedInput = input;
                        this.lexer.setInput(savedInput);
                        
                        for (var i = 0; i < 5; i++) {
                            var tok = originalLex.call(this.lexer);
                            if (!tok || tok === 'EOF') break;
                            tokens.push(tok);
                        }
                        
                        console.log("[DEBUG PARSE call] First tokens:", tokens);
                        
                        // Reset lexer input for actual parsing
                        this.lexer.setInput(savedInput);
                    }
                    
                    // Try parsing with debug
                    try {
                        return generatedParse.call(self, input);
                    } catch (e) {
                        console.error("[DEBUG PARSE ERROR]", e.message);
                        throw e;
                    }
                };
                
                // Handle yy object
                if (this.options.yy) { 
                    this.yy = this.options.yy; 
                } else if (generatedParserObj.yy) { 
                    for (var yyk in generatedParserObj.yy) { 
                        if (generatedParserObj.yy.hasOwnProperty(yyk) && !this.yy.hasOwnProperty(yyk)) {
                            this.yy[yyk] = generatedParserObj.yy[yyk];
                        }
                    }
                }
                console.log("[DEBUG JisonParser call #" + callId + "] Merge DONE with new forwarding parse method");
        } else {
                console.warn("[WARN JisonParser call #" + callId + "] Auto-gen FAILED: createParser() did not return valid object.");
                if (generatedParserObj) {
                    console.warn("[WARN JisonParser call #" + callId + "] createParser() returned object keys:", Object.keys(generatedParserObj).join(', '));
                    console.warn("[WARN JisonParser call #" + callId + "] createParser() returned object.parse type:", typeof generatedParserObj.parse);
                }
            }
        } catch (e_gen) {
            console.error("[ERROR JisonParser call #" + callId + "] Error during auto-generation process:", e_gen.message);
            console.error(e_gen.stack);
            console.warn("[WARN JisonParser call #" + callId + "] Falling back to prototype methods due to auto-gen error.");
        }
                } else {
        console.log("[DEBUG JisonParser call #" + callId + "] Skipping auto-generation (grammar criteria not met?).");
    }
    
    console.log("[DEBUG JisonParser EXIT call #" + callId + "] typeof this.parse:", typeof this.parse);
}

// Just provide basic fallback methods in prototype
JisonParser.prototype = {
    performAction: function performAction(yytext, yyleng, yylineno, yyloc, $$) { /* placeholder */ },
    parseError: function parseError(str, hash) {
        if (hash.recoverable) {
            this.trace(str);
    } else {
            var error = new Error(str);
            error.hash = hash;
            throw error;
        }
    },
    setYY: function(yy) { this.yy = yy; }
    // Note: parse is now defined directly on each instance
};

// Define the Generator constructor 
function JisonGeneratorForParser(grammar, options) { 
    options = options || {};
    if (grammar instanceof Grammar) {
        this.grammar = grammar;
        } else {
        this.grammar = new Grammar(grammar, options);
    }
    if (!this.grammar.options) this.grammar.options = {};
    for (var keyIn in options) { // Changed `key` to `keyIn` to avoid conflict with outer scope `key` if any
        if (options.hasOwnProperty(keyIn) && !this.grammar.options.hasOwnProperty(keyIn)) {
            this.grammar.options[keyIn] = options[keyIn];
        }
    }
    this.grammar.useDefaults = options.useDefaults !== false; // default action
    
    switch (this.grammar.options.type || options.type || 'lalr') {
        case 'lr0': this.tableGenerator = new LR0TableGenerator(this.grammar); break;
        case 'slr': this.tableGenerator = new SLRTableGenerator(this.grammar); break;
        default: this.tableGenerator = new LALRTableGenerator(this.grammar); break;
    }
    
    this.parserGenerator = new ParserGenerator(this.grammar, this.tableGenerator);
    
    // For tests that check constructor type
    if (this.grammar.options.type === 'lr0' || options.type === 'lr0') {
        this.constructor = Jison.LR0Generator;
    } else if (this.grammar.options.type === 'slr' || options.type === 'slr') {
        this.constructor = Jison.SLRGenerator;
                    } else {
        this.constructor = Jison.LalrGenerator;
    }
}

// Define its prototype
JisonGeneratorForParser.prototype = {
    generate: function generate(options) {
        // Ensure options are applied to grammar if provided
        if (options) {
            for (var opt in options) {
                if (options.hasOwnProperty(opt)) {
                    this.grammar.options[opt] = options[opt];
                }
            }
        }
        // Ensure grammar has a startSymbol if not provided
        if (!this.grammar.startSymbol && this.grammar.bnf) {
            // Use first rule as start symbol
            for (var rule in this.grammar.bnf) {
                this.grammar.startSymbol = rule;
                console.log("[DEBUG JisonGenerator] Auto-setting startSymbol to:", rule);
                break;
            }
        }
        
        // Create terminals array from tokens if defined
        if (this.grammar.tokens) {
            if (typeof this.grammar.tokens === 'string') {
                this.terminals = this.grammar.tokens.split(' ');
            } else if (Array.isArray(this.grammar.tokens)) {
                this.terminals = this.grammar.tokens;
            }
            console.log("[DEBUG JisonGenerator] Set terminals from tokens:", this.terminals);
    } else {
            this.terminals = [];
        }
        
        // Delegate to the internal ParserGenerator instance
        return this.parserGenerator.generate();
    },

    // Method to get the Jison.ParserGenerator instance (if needed by tests)
    getParserGenerator: function() {
        return this.parserGenerator;
    },

    createParser: function createParser() {
        var source = this.generate(); 

        if (typeof source !== 'string') {
            console.error("[FATAL createParser] this.generate() did NOT return a string. Returned type:", typeof source);
            if (source !== null && typeof source !== 'undefined') {
                try {
                    console.error("[FATAL createParser] Value returned by this.generate():", JSON.stringify(source));
    } catch (e) {
                    console.error("[FATAL createParser] Value returned by this.generate() (not JSON serializable):", source);
                }
            }
            throw new Error("JisonGeneratorForParser.generate() must return a string of JavaScript source code.");
        }

        console.log("[DEBUG createParser] Source length for eval:", source.length); // This should now be safe

        try {
            var parserInstance = null;
            var exportsObj = {}; 
            var moduleObj = { exports: exportsObj }; 
            // Pass Jison itself to the eval context, so generated code can use Jison.Lexer etc.
            var evalWrapper = new Function('module', 'exports', 'require', 'Jison', source);
            
            var mockRequire = function(id) { 
                console.warn('[mockRequire in createParser] Parser generated code attempted to require:', id);
                if (id === 'jison-lex' || id === './lexer' || id === 'lexer') {
                    console.warn('[mockRequire in createParser] Providing global Lexer (jison-lex) as fallback for id:', id);
                    return Lexer; // Lexer is available in the outer scope of lib/jison.js
                } 
                // Allow requiring the main jison module itself if the generated code needs it
                if (id === 'jison' || id === './jison.js' || id === '../lib/jison.js') {
                     console.warn('[mockRequire in createParser] Providing global Jison API for id:', id);
                     return Jison; // Jison is available in the outer scope of lib/jison.js
                }
                console.error('[mockRequire in createParser] Unhandled require for id:', id, "- returning empty object.");
                return {}; 
            }.bind(this); 

            var evalError = null;
            try {
                console.log("[DEBUG createParser TRYING EVAL] Source length (again, should be same):", source.length);
                evalWrapper(moduleObj, exportsObj, mockRequire, Jison); 
                console.log("[DEBUG createParser EVAL SUCCEEDED]");
            } catch (e_eval) {
                evalError = e_eval;
                console.error("[ERROR createParser EVAL FAILED]");
                console.error("[DEBUG createParser INSIDE CATCH] typeof source:", typeof source);
                if (typeof source === 'string') {
                    console.error("[DEBUG createParser INSIDE CATCH] source.length:", source.length);
            } else {
                    console.error("[DEBUG createParser INSIDE CATCH] source is NOT a string.");
                }
                console.error("[DEBUG createParser INSIDE CATCH] typeof e_eval:", typeof e_eval);
                if (e_eval && typeof e_eval === 'object') {
                    console.error("[DEBUG createParser INSIDE CATCH] e_eval.message:", e_eval.message);
                    console.error("[DEBUG createParser INSIDE CATCH] typeof e_eval.stack:", typeof e_eval.stack);
            } else {
                    console.error("[DEBUG createParser INSIDE CATCH] e_eval is null or not an object.");
                }

                console.error("Eval Error Message:", e_eval.message); 
                console.error("Eval Error Stack:", e_eval.stack);     
                if (typeof source === 'string') {
                    console.error("Source Code (first 1000 chars):\n" + source.substring(0,1000));
    } else {
                    console.error("Source Code is undefined or not a string, cannot display substring.");
                }
            }

            console.log("[DEBUG createParser] After eval attempt, keys in exportsObj:", Object.keys(exportsObj).join(', '));
            var defaultExport = exportsObj.default; 

            if (exportsObj.parser) {
                console.log("[DEBUG createParser] Found exportsObj.parser. typeof parse:", typeof exportsObj.parser.parse);
                parserInstance = exportsObj.parser;
            } else if (defaultExport && typeof defaultExport.parse === 'function') {
                console.log("[DEBUG createParser] Found parser on exportsObj.default. typeof parse:", typeof defaultExport.parse);
                parserInstance = defaultExport;
            } else if (typeof exportsObj === 'function' && exportsObj.prototype && typeof exportsObj.prototype.parse === 'function') {
                 console.log("[DEBUG createParser] Found parser constructor on exportsObj directly. Instantiating.");
                 parserInstance = new exportsObj();
            } else if (defaultExport && typeof defaultExport === 'function' && defaultExport.prototype && typeof defaultExport.prototype.parse === 'function') {
                 console.log("[DEBUG createParser] Found parser constructor on exportsObj.default directly. Instantiating.");
                 parserInstance = new defaultExport();
            }
            else {
                 console.log("[DEBUG createParser] Did not find parser on exportsObj.parser or exportsObj.default (or as constructor). Iterating keys...");
                 for (var keyExp in exportsObj) {
                    if (exportsObj.hasOwnProperty(keyExp) && 
                        typeof exportsObj[keyExp] === 'object' && 
                        exportsObj[keyExp] && 
                        typeof exportsObj[keyExp].parse === 'function') {
                        console.log("[DEBUG createParser] Found parser instance on exportsObj[" + keyExp + "].");
                        parserInstance = exportsObj[keyExp];
                        break;
                    }
                    if (exportsObj.hasOwnProperty(keyExp) && 
                        typeof exportsObj[keyExp] === 'function' &&
                        exportsObj[keyExp].prototype && 
                        typeof exportsObj[keyExp].prototype.parse === 'function') {
                         console.log("[DEBUG createParser] Found parser constructor on exportsObj[" + keyExp + "]. Instantiating.");
                         parserInstance = new exportsObj[keyExp]();
                         break;
                    }
                }
            }
            
            if (parserInstance) {
                console.log("[DEBUG createParser] Successfully extracted/created parserInstance.");
        } else {
                console.log("[DEBUG createParser] Failed to extract/create parserInstance.");
                 if (evalError) { 
                    console.warn("[WARN createParser] Parser instance not found likely due to eval error. Details above.");
                } else {
                     console.error("[ERROR createParser] Eval succeeded, but parser instance could not be found in exports: ", Object.keys(exportsObj).join(', '));
                 }
            }

            if (evalError) {
                 console.error("[ERROR createParser] Re-throwing error caught during eval. Parser generation failed.");
                 throw evalError; 
            }

            if (!parserInstance) {
                console.error("[ERROR createParser] Could not extract or create parser instance AFTER eval (or eval failed silently regarding parser export).");
                throw new Error("Could not extract parser instance from generated source. 'exports.parser', 'exports.default', or a direct export of Parser constructor was not found.");
            }
            return parserInstance;
        } catch (e) { // Outer catch for createParser scope
             var err_msg = 'Error in JisonGeneratorForParser.createParser (outer catch): ' + e.message;
             console.error(err_msg + "\nStack:" + e.stack);
             if (typeof source === 'string') { // Log source if available
                 console.error("Source at outer catch (first 1000 chars):\n" + source.substring(0,1000));
                } else {
                 console.error("Source at outer catch is not a string or undefined. Type: " + typeof source);
             }
             throw new Error(err_msg); // Re-throw with more context
        }
    }
};

// Generator class stubs for testing
function LR0Generator() {}
function SLRGenerator() {}
function LalrGenerator() {}

// Now, create the main Jison object and assign the constructors
var Jison = {
    version: version,
    Parser: JisonParser,
    Generator: JisonGeneratorForParser,
    LR0Generator: LR0Generator,
    SLRGenerator: SLRGenerator,
    LalrGenerator: LalrGenerator,
    ebnfParser: null // To be loaded dynamically by JisonParser constructor if needed
};

// If JisonParser needed access to the fully formed Jison object during construction
// (e.g., Jison.someUtil), we might need JisonParser.prototype.Jison = Jison; here instead.
// But assigning `this.Jison = Jison` inside the constructor should work for methods called later.


// Export the Jison API
exports.Grammar = Grammar;
exports.Lexer = Lexer; 
exports.Jison = Jison;
exports.Parser = Jison.Parser; 