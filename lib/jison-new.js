/**
 * Jison - Parser Generator
 * A refactored, modular version with better code organization
 */

var Grammar = require('./grammar').Grammar;
var LALRTableGenerator = require('./table-generator').LALRTableGenerator;
var LR0TableGenerator = require('./table-generator').LR0TableGenerator;
var SLRTableGenerator = require('./table-generator').SLRTableGenerator;
var ParserGenerator = require('./parser-generator').ParserGenerator;
var Lexer = require('jison-lex');
var version = require('../package.json').version;

// Main Jison object
var Jison = {
    version: version,
    
    /**
     * Generate a parser from a grammar
     */
    Parser: function Parser(grammar, options) {
        var settings = options || {};
        
        // Ensure we have a Grammar object
        var grammarObj;
        if (grammar instanceof Grammar) {
            grammarObj = grammar;
        } else {
            grammarObj = new Grammar(grammar, settings);
        }
        
        // Create the appropriate LR table generator based on type
        var tableGenerator;
        switch (settings.type || 'lalr') {
            case 'lr0':
                tableGenerator = new LR0TableGenerator(grammarObj);
                break;
            case 'slr':
                tableGenerator = new SLRTableGenerator(grammarObj);
                break;
            case 'lalr':
            default:
                tableGenerator = new LALRTableGenerator(grammarObj);
                break;
        }
        
        // Create the parser generator
        var parserGenerator = new ParserGenerator(grammarObj, tableGenerator);
        
        // Generate the parser code
        var parserSource = parserGenerator.generate();
        
        // Create the runtime parser
        var parser;
        try {
            // Convert source to a function and evaluate
            var fn = new Function('return ' + parserSource)();
            parser = fn;
        } catch (e) {
            throw new Error('Error creating parser: ' + e.message);
        }
        
        return parser;
    },
    
    /**
     * Generator class for creating parsers
     */
    Generator: function Generator(grammar, options) {
        var settings = options || {};
        
        // Create a grammar object
        this.grammar = new Grammar(grammar, settings);
        
        // Create appropriate table generator
        switch (settings.type || 'lalr') {
            case 'lr0':
                this.tableGenerator = new LR0TableGenerator(this.grammar);
                break;
            case 'slr':
                this.tableGenerator = new SLRTableGenerator(this.grammar);
                break;
            case 'lalr':
            default:
                this.tableGenerator = new LALRTableGenerator(this.grammar);
                break;
        }
        
        // Create parser generator
        this.parserGenerator = new ParserGenerator(this.grammar, this.tableGenerator);
    }
};

// Add methods to Generator prototype
Jison.Generator.prototype = {
    /**
     * Generate parser source code
     */
    generate: function generate(options) {
        if (options) {
            // Update options
            for (var opt in options) {
                if (options.hasOwnProperty(opt)) {
                    this.grammar.options[opt] = options[opt];
                }
            }
        }
        
        return this.parserGenerator.generate();
    },
    
    /**
     * Create parser object from the generated source
     */
    createParser: function createParser() {
        var source = this.generate();
        
        try {
            // Convert source to a function and evaluate
            var fn = new Function('return ' + source)();
            return fn;
        } catch (e) {
            throw new Error('Error creating parser: ' + e.message);
        }
    }
};

// Export the Jison API
exports.Grammar = Grammar;
exports.Lexer = Lexer;
exports.Jison = Jison;
exports.Parser = Jison.Parser; 