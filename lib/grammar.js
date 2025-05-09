/**
 * Grammar processing functionality extracted from jison.js
 * Responsible for handling the input grammar and preparing it for parser generation
 */

var typal = require('./util/typal').typal;
var ebnfParser = require('ebnf-parser');

/**
 * Represents a non-terminal in the grammar
 */
var Nonterminal = typal.construct({
    constructor: function Nonterminal(symbol) {
        this.symbol = symbol;
        this.productions = [];
        this.first = [];
        this.follows = [];
        this.nullable = false;
    },
    toString: function Nonterminal_toString() {
        var str = this.symbol + "\n";
        str += (this.nullable ? 'nullable' : 'not nullable');
        str += "\nFirsts: " + this.first.join(', ');
        str += "\nFollows: " + this.follows.join(', ');
        str += "\nProductions:\n  " + this.productions.join('\n  ');

        return str;
    }
});

/**
 * Represents a production rule in the grammar
 */
var Production = typal.construct({
    constructor: function Production(symbol, handle, id) {
        this.symbol = symbol;
        this.handle = handle;
        this.nullable = false;
        this.id = id;
        this.first = [];
        this.precedence = 0;
    },
    toString: function Production_toString() {
        return this.symbol + " -> " + this.handle.join(' ');
    }
});

/**
 * Grammar processor
 */
var Grammar = typal.construct({
    constructor: function Grammar(grammar, options) {
        this.options = options || {};
        this.terms = {};
        this.operators = {};
        this.productions = [];
        this.nonterminals = {};
        this.symbols = [];
        this.terminals = [];
        this.symbols_ = {};

        if (typeof grammar === 'string') {
            grammar = ebnfParser.parse(grammar);
        }

        this.processGrammar(grammar);
        this.computeNullables();
        this.computeFirsts();
    },

    /**
     * Process a grammar specification and build internal data structures
     */
    processGrammar: function processGrammar(grammar) {
        var bnf = grammar.bnf,
            tokens = grammar.tokens,
            self = this;

        if (!grammar.bnf && grammar.ebnf) {
            bnf = grammar.bnf = ebnfParser.transform(grammar.ebnf);
        }

        // Process tokens
        if (tokens) {
            var tokenList;
            if (typeof tokens === 'string') {
                tokenList = tokens.trim().split(/\s+/).filter(function(token) {
                    return token.length > 0;
                });
            } else if (Array.isArray(tokens)) {
                tokenList = tokens.slice(0);
            }
            if (tokenList) {
                tokenList.forEach(function(token) {
                    if (!self.symbols_[token]) {
                        self.symbols.push(token);
                        self.symbols_[token] = self.symbols.length - 1;
                        self.terminals.push(token);
                        self.terms[token] = self.terms[token] || {};
                        self.terms[token].first = [token];
                    }
                });
            }
        }

        // calculate precedence of operators
        this.operators = processOperators(grammar.operators);

        // build productions
        this.buildProductions(bnf);

        // calculate all terminals used in grammar
        var usedTerminals = this.symbols.filter(function(s) {
            return !self.nonterminals[s];
        });

        // Add any missing terminals
        usedTerminals.forEach(function(terminal) {
            if (self.terminals.indexOf(terminal) === -1) {
                self.terminals.push(terminal);
                self.terms[terminal] = self.terms[terminal] || {};
                self.terms[terminal].first = [terminal];
            }
        });

        // Add any missing symbols
        this.terminals.forEach(function(terminal) {
            if (!self.symbols_[terminal]) {
                self.symbols.push(terminal);
                self.symbols_[terminal] = self.symbols.length - 1;
            }
        });

        // augment the grammar
        this.augmentGrammar(grammar);

        // Verify all tokens are used
        if (tokenList) {
            var unusedTokens = tokenList.filter(function(token) {
                return usedTerminals.indexOf(token) === -1;
            });
            if (unusedTokens.length > 0) {
                this.warn('Warning: unused tokens: ' + unusedTokens.join(', '));
            }
        }

        // Verify all used tokens are declared
        var undeclaredTokens = usedTerminals.filter(function(terminal) {
            return !tokenList || tokenList.indexOf(terminal) === -1;
        });
        if (undeclaredTokens.length > 0) {
            this.warn('Warning: undeclared tokens used in productions: ' + undeclaredTokens.join(', '));
        }
    },

    /**
     * Compute nullable symbols in the grammar
     */
    computeNullables: function computeNullables() {
        console.log("[ [34mDEBUG [0m] Entering computeNullables...");
        var self = this;
        var changed;

        do {
            changed = false;
            // console.log("[DEBUG] computeNullables loop iteration"); // Potentially too verbose
            self.productions.forEach(function(production) {
                if (production.nullable) return;

                var nullable = true;
                for (var i = 0; i < production.handle.length; i++) {
                    var symbol = production.handle[i];
                    if (self.terminals.indexOf(symbol) !== -1 || 
                        (self.nonterminals[symbol] && !self.nonterminals[symbol].nullable)) {
                        nullable = false;
                        break;
                    }
                }

                if (nullable) {
                    production.nullable = true;
                    if (self.nonterminals[production.symbol]) { // Guard against undefined nonterminal
                        self.nonterminals[production.symbol].nullable = true;
                    }
                    changed = true;
                }
            });
        } while (changed);
        console.log("[ [34mDEBUG [0m] Exiting computeNullables.");
    },

    /**
     * Compute FIRST sets for all symbols
     */
    computeFirsts: function computeFirsts() {
        console.log("[ [34mDEBUG [0m] Entering computeFirsts...");
        var self = this;
        var changed;

        self.terminals.forEach(function(terminal) {
            self.terms[terminal] = self.terms[terminal] || {};
            self.terms[terminal].first = [terminal];
        });

        for (var sym in self.nonterminals) {
            if (self.nonterminals.hasOwnProperty(sym)) {
                self.nonterminals[sym].first = [];
            }
        }

        do {
            changed = false;
            // console.log("[DEBUG] computeFirsts loop iteration"); // Potentially too verbose
            self.productions.forEach(function(production) {
                var ntSymbol = production.symbol;
                var nt = self.nonterminals[ntSymbol];
                if (!nt) { 
                    // console.warn("[WARN] computeFirsts: Nonterminal '" + ntSymbol + "' not found for production: " + production.toString());
                    return; // Should not happen with correctly processed grammar
                }
                var handle = production.handle;
                var first = [];

                for (var i = 0; i < handle.length; i++) {
                    var symbol = handle[i];
                    var symbolFirst;

                    if (!symbol) continue; // Should have been caught by earlier fixes

                    if (self.terminals.indexOf(symbol) !== -1) {
                        symbolFirst = [symbol];
                    } else if (self.nonterminals[symbol] && self.nonterminals[symbol].first) {
                        symbolFirst = self.nonterminals[symbol].first;
                    } else {
                        // Symbol not found as terminal or nonterminal with a first set (yet)
                        // This might happen if it's an undeclared terminal or nonterminal processed out of order
                        // For now, treat as non-contributing or an empty first set to avoid errors
                        symbolFirst = []; 
                    }

                    symbolFirst.forEach(function(f) {
                        if (first.indexOf(f) === -1) {
                            first.push(f);
                        }
                    });

                    if (!self.nullable([symbol])) break;
                }

                // Only update if `first` actually has new elements for `nt.first`
                var currentNtFirst = nt.first;
                var updated = false;
                first.forEach(function(f) {
                    if (currentNtFirst.indexOf(f) === -1) {
                        currentNtFirst.push(f);
                        updated = true;
                    }
                });
                if (updated) {
                    changed = true;
                }
            });
        } while (changed);
        console.log("[ [34mDEBUG [0m] Exiting computeFirsts.");
    },

    /**
     * Get FIRST set for a sequence of symbols
     */
    first: function first(symbols) {
        var self = this;
        var result = [];

        // Handle empty or undefined sequence
        if (!symbols || symbols.length === 0) {
            return result;
        }

        // For each symbol in the sequence
        for (var i = 0; i < symbols.length; i++) {
            var symbol = symbols[i];
            var symbolFirst;

            // Skip undefined or empty symbols
            if (!symbol) continue;

            if (self.terminals.indexOf(symbol) !== -1) {
                // If symbol is terminal, FIRST(symbol) = {symbol}
                symbolFirst = [symbol];
            } else if (self.nonterminals[symbol]) {
                // If symbol is nonterminal, use stored FIRST set
                symbolFirst = self.nonterminals[symbol].first;
            } else {
                // Unknown symbol, treat as terminal
                symbolFirst = [symbol];
                if (self.terminals.indexOf(symbol) === -1) {
                    self.terminals.push(symbol);
                }
            }

            // Add all symbols from FIRST(symbol) to result
            symbolFirst.forEach(function(f) {
                if (result.indexOf(f) === -1) {
                    result.push(f);
                }
            });

            // If symbol is not nullable, stop here
            if (!self.nullable([symbol])) break;
        }

        return result;
    },

    /**
     * Check if a sequence of symbols is nullable
     */
    nullable: function nullable(symbols) {
        var self = this;
        
        // Empty sequence is nullable
        if (!symbols || symbols.length === 0) return true;

        // A sequence is nullable if all its symbols are nullable
        return symbols.every(function(symbol) {
            // Skip undefined or empty symbols
            if (!symbol) return true;

            if (self.terminals.indexOf(symbol) !== -1) {
                return false;  // Terminals are not nullable
            }
            return self.nonterminals[symbol] && self.nonterminals[symbol].nullable;
        });
    },

    /**
     * Augment the grammar with a start symbol $accept
     */
    augmentGrammar: function augmentGrammar(grammar) {
        if (this.productions.length === 0) {
            throw new Error("Grammar error: must have at least one rule.");
        }
        // use specified start symbol, or default to first user defined production
        this.startSymbol = grammar.start || grammar.startSymbol || this.productions[0].symbol;
        if (!this.nonterminals[this.startSymbol]) {
            throw new Error("Grammar error: startSymbol must be a non-terminal found in your grammar.");
        }
        this.EOF = "$end";

        // augment the grammar
        var acceptProduction = new Production('$accept', [this.startSymbol, '$end'], 0);
        this.productions.unshift(acceptProduction);

        // prepend parser tokens
        this.symbols.unshift("$accept",this.EOF);
        this.symbols_.$accept = 0;
        this.symbols_[this.EOF] = 1;
        this.terminals.unshift(this.EOF);

        this.nonterminals.$accept = new Nonterminal("$accept");
        this.nonterminals.$accept.productions.push(acceptProduction);

        // add follow $ to start symbol
        this.nonterminals[this.startSymbol].follows.push(this.EOF);
    },

    /**
     * Build the productions array from the grammar
     */
    buildProductions: function buildProductions(bnf) {
        var productions = this.productions,
            nonterminals = this.nonterminals,
            symbols = this.symbols,
            operators = this.operators,
            symbols_ = this.symbols_,
            self = this;
        
        var prodCount = 0;
        var symbolCount = 0;
        var productionSymbols = {};
        
        function addSymbol(s) {
            if (!s || s === '') return;  // Skip empty symbols
            if (!symbols_[s]) {
                symbols_[s] = ++symbolCount;
                symbols.push(s);
            }
        }

        // add nonterminals from grammar
        for (var sym in bnf) {
            if (bnf.hasOwnProperty(sym)) {
                addSymbol(sym);
                nonterminals[sym] = new Nonterminal(sym);
            }
        }

        // add productions to nonterminals
        for (var sym in bnf) {
            if (bnf.hasOwnProperty(sym)) {
                addProductionsForSymbol(sym, bnf[sym]);
            }
        }

        // calculate all terminals used in grammar
        self.terminals = self.symbols.filter(function(s) {
            return !self.nonterminals[s];
        });

        function addProductionsForSymbol(sym, rules) {
            // get action from rule
            var action = null;
            var handle = null;
            var expressions = rules;
            
            if (typeof expressions === 'string') {
                expressions = expressions.trim().split(/\s*\|\s*/);
            } else if (!Array.isArray(expressions)) {
                expressions = [expressions];
            }

            // Add each production for this symbol
            for (var i=0; i < expressions.length; i++) {
                var expression = expressions[i];
                
                // parse expression
                var result = parseExpression(expression);
                handle = result.handle;
                action = result.action;
                
                // add production
                addProduction(sym, handle, action);
            }
        }

        function parseExpression(expression) {
            var handle = [];
            var action = null;
            
            // Split by whitespace & handle actions
            if (typeof expression === 'string') {
                // Get handle & action (if any)
                var parts = expression.trim().split(/\s+/);
                handle = parts.filter(function(p) { return p !== ''; });
                
                // Look for an action in the last part
                var last = parts[parts.length-1];
                if (last) {
                    var actionMatch = last.match(/\{([^}]*)}/);
                    if (actionMatch) {
                        handle.pop();
                        action = actionMatch[1];
                    }
                }
            } else if (typeof expression === 'object') {
                // Handle object form with action property
                if (typeof expression[0] === 'string') {
                    handle = expression[0].trim().split(/\s+/).filter(function(p) { return p !== ''; });
                } else {
                    handle = [];
                }
                action = expression[1];
            }
            
            return {
                handle: handle,
                action: action
            };
        }

        function addProduction(sym, handle, action) {
            // Add symbols in the handle to our symbols list
            var cleanHandle = [];
            for (var i=0; i<handle.length; i++) {
                var symbol = handle[i];
                if (symbol === 'ε' || symbol === '') {
                    // Skip empty symbols
                    continue;
                }
                addSymbol(symbol);
                cleanHandle.push(symbol);
            }
            
            // Create the production
            var production = new Production(sym, cleanHandle, ++prodCount);
            
            // Set precedence based on the last terminal in the production
            var precedence = 0;
            for (var i=cleanHandle.length-1; i>=0; i--) {
                if (!(self.nonterminals[cleanHandle[i]]) && operators[cleanHandle[i]]) {
                    precedence = operators[cleanHandle[i]].precedence;
                    break;
                }
            }
            
            production.precedence = precedence;
            
            // Add to the nonterminal's productions
            nonterminals[sym].productions.push(production);
            
            // Add to our productions list
            productions.push(production);
        }
    },

    warn: function warn() {
        console.warn.apply(console, arguments);
    }
});

// set precedence and associativity of operators
function processOperators (ops) {
    if (!ops) return {};
    var operators = {};
    for (var i=0,k,prec;prec=ops[i]; i++) {
        for (k=1;k < prec.length;k++) {
            operators[prec[k]] = {precedence: i+1, assoc: prec[0]};
        }
    }
    return operators;
}

// Export symbols
exports.Grammar = Grammar;
exports.Production = Production;
exports.Nonterminal = Nonterminal; 