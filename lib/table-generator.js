/**
 * LR Table Generator
 * Extracted from jison.js to separate parser table generation concerns
 */

var typal = require('./util/typal').typal;
var Set = require('./util/set').Set;

/**
 * Base LR Table Generator
 */
var generator = typal.beget();

generator.constructor = function LRTableGenerator(grammar) {
    this.grammar = grammar;
    this.states = [];
    this.conflicts = 0;
    this.resolutions = [];
    this.DEBUG = grammar.options && grammar.options.debug;
};

generator.mix({
    /**
     * Build parsing tables
     */
    buildTable: function buildTable() {
        this.canonicalItems();
        this.buildParsingTable();
    },

    /**
     * Generate item set collection and transition tables
     */
    canonicalItems: function canonicalItems() {
        // Initialize the root items set
        var initialItems = new this.ItemSet();
        initialItems.add(new this.Item(this.grammar.productions[0], 0));
        initialItems = this.closure(initialItems);
        this.states.push(initialItems);

        // Process all items sets until no new sets are created
        var itemSets = this.states,
            self = this;

        var i = 0;
        while (i < itemSets.length) {
            var transitions = {};
            var itemSet = itemSets[i];
            var symbols = this.getSymbolsFromItemSet(itemSet);

            symbols.forEach(function(symbol) {
                var newItemSet = self.goto(itemSet, symbol);
                if (newItemSet.size() > 0) {
                    var stateExists = self.findStateIndex(newItemSet);
                    if (stateExists === -1) {
                        itemSets.push(newItemSet);
                        transitions[symbol] = itemSets.length - 1;
                    } else {
                        transitions[symbol] = stateExists;
                    }
                }
            });

            itemSet.transitions = transitions;
            i++;
        }
    },

    /**
     * Get all symbols from an item set
     */
    getSymbolsFromItemSet: function getSymbolsFromItemSet(itemSet) {
        var symbols = new Set();
        itemSet.forEach(function(item) {
            var symbol = item.currentSymbol();
            if (symbol) {
                symbols.push(symbol);
            }
        });
        return symbols;
    },

    /**
     * Find if a state already exists in the states collection
     */
    findStateIndex: function findStateIndex(itemSet) {
        for (var i = 0; i < this.states.length; i++) {
            if (this.states[i].equals(itemSet)) {
                return i;
            }
        }
        return -1;
    },

    /**
     * Build the parsing table from the states
     */
    buildParsingTable: function buildParsingTable() {
        var self = this;
        var table = {
            actions: [],
            gotos: []
        };

        // Initialize tables
        this.states.forEach(function() {
            table.actions.push({});
            table.gotos.push({});
        });

        // Build the tables
        this.states.forEach(function(itemSet, stateIndex) {
            // Handle transitions
            Object.keys(itemSet.transitions).forEach(function(symbol) {
                var nextState = itemSet.transitions[symbol];
                if (self.grammar.terminals.indexOf(symbol) !== -1) {
                    self.addAction(table, stateIndex, symbol, ['shift', nextState]);
                } else {
                    table.gotos[stateIndex][symbol] = nextState;
                }
            });

            // Handle reductions
            itemSet.forEach(function(item) {
                if (item.isReduction()) {
                    var lookaheads = self.getLookaheads(stateIndex, item);
                    lookaheads.forEach(function(lookahead) {
                        self.addAction(table, stateIndex, lookahead, ['reduce', item.production.id]);
                    });
                }
            });
        });

        this.table = table;
    },

    /**
     * Add an action to the parsing table, handling conflicts
     */
    addAction: function addAction(table, state, symbol, action) {
        var currentAction = table.actions[state][symbol];
        
        if (!currentAction) {
            table.actions[state][symbol] = action;
        } else {
            // Handle shift/reduce and reduce/reduce conflicts
            if (this.resolveConflict(currentAction, action, symbol) === action) {
                table.actions[state][symbol] = action;
            }
            this.conflicts++;
        }
    },

    /**
     * Resolve conflicts based on operator precedence and associativity
     */
    resolveConflict: function resolveConflict(oldAction, newAction, symbol) {
        var self = this;
        var oldPrec = 0, newPrec = 0;
        var oldAssoc = 'nonassoc', newAssoc = 'nonassoc'; // Default to nonassoc

        var terminalSymbol = symbol; // The symbol causing the conflict

        // Get precedence/associativity for the SHIFT action (associated with the terminal)
        if (self.grammar.operators[terminalSymbol]) {
            if (oldAction[0] === 'shift') {
                oldPrec = self.grammar.operators[terminalSymbol].precedence;
                oldAssoc = self.grammar.operators[terminalSymbol].assoc;
            }
            if (newAction[0] === 'shift') {
                newPrec = self.grammar.operators[terminalSymbol].precedence;
                newAssoc = self.grammar.operators[terminalSymbol].assoc;
            }
        }

        // Get precedence/associativity for the REDUCE action(s)
        if (oldAction[0] === 'reduce') {
            var oldProd = self.grammar.productions[oldAction[1]];
            oldPrec = oldProd.precedence || 0;
            // Find the terminal that set the precedence for this production
            var oldPrecTerminal = null;
            for (var i = oldProd.handle.length - 1; i >= 0; i--) {
                var sym = oldProd.handle[i];
                if (self.grammar.operators[sym] && self.grammar.operators[sym].precedence === oldPrec) {
                    oldPrecTerminal = sym;
                    break;
                }
            }
            if (oldPrecTerminal && self.grammar.operators[oldPrecTerminal]) {
                 oldAssoc = self.grammar.operators[oldPrecTerminal].assoc;
            } else {
                oldAssoc = 'nonassoc'; // No specific assoc for reduce rule precedence
            }
        }
        if (newAction[0] === 'reduce') {
            var newProd = self.grammar.productions[newAction[1]];
            newPrec = newProd.precedence || 0;
            var newPrecTerminal = null;
            for (var i = newProd.handle.length - 1; i >= 0; i--) {
                var sym = newProd.handle[i];
                if (self.grammar.operators[sym] && self.grammar.operators[sym].precedence === newPrec) {
                    newPrecTerminal = sym;
                    break;
                }
            }
            if (newPrecTerminal && self.grammar.operators[newPrecTerminal]) {
                newAssoc = self.grammar.operators[newPrecTerminal].assoc;
            } else {
                newAssoc = 'nonassoc';
            }
        }

        // Default: resolve based on LALR/SLR/LR0 behavior (shift preferred over reduce)
        var resolution = oldAction;

        // Precedence rules
        if (oldPrec > 0 && newPrec > 0) {
            if (oldPrec < newPrec) {
                resolution = newAction; // Higher precedence wins
            } else if (oldPrec > newPrec) {
                resolution = oldAction; // Higher precedence wins
            } else { // Equal precedence
                 if (oldAssoc === 'left' && newAssoc === 'left') {
                     // Reduce on left-assoc
                     resolution = (oldAction[0] === 'reduce') ? oldAction : newAction;
                 } else if (oldAssoc === 'right' && newAssoc === 'right') {
                     // Shift on right-assoc
                     resolution = (oldAction[0] === 'shift') ? oldAction : newAction;
                 } else {
                     // nonassoc or mismatch, report conflict and prefer shift (or original action)
                     this.resolutions.push({ state: -1, symbol: symbol, old: oldAction, new: newAction, msg: 'Conflict (non-assoc)' });
                     resolution = (oldAction[0] === 'shift') ? oldAction : newAction; // Default shift
                 }
            }
        } else {
            // Default preference (usually shift over reduce)
            if (oldAction[0] === 'shift' && newAction[0] === 'reduce') {
                resolution = oldAction; 
            } else if (oldAction[0] === 'reduce' && newAction[0] === 'shift') {
                resolution = newAction;
            }
            // Could log unresolved S/R or R/R conflicts if needed
        }
        
        if (resolution !== oldAction) {
            // Record the resolution if it changed from default
            this.resolutions.push({ state: -1, symbol: symbol, old: oldAction, new: newAction, resolvedTo: resolution });
        }
        return resolution;
    },

    /**
     * Get lookaheads for an item in a state
     * To be implemented by subclasses
     */
    getLookaheads: function getLookaheads(state, item) {
        return [];
    },

    /**
     * Compute closure of an item set
     * To be implemented by subclasses
     */
    closure: function closure(itemSet) {
        return itemSet;
    },

    /**
     * Compute goto for an item set and symbol
     */
    goto: function goto(itemSet, symbol) {
        var newItemSet = new this.ItemSet();
        
        itemSet.forEach(function(item) {
            if (item.currentSymbol() === symbol) {
                newItemSet.add(item.advance());
            }
        });

        return this.closure(newItemSet);
    },

    /**
     * ItemSet class to hold a set of LR items
     */
    ItemSet: typal.construct({
        constructor: function ItemSet() {
            this.items = [];
            this.itemsByKey = {};
            this.transitions = {};
        },

        add: function add(item) {
            var key = item.toString();
            var existingItem = this.itemsByKey[key];
            
            if (!existingItem) {
                // New item, add it
                this.items.push(item);
                this.itemsByKey[key] = item;
            } else {
                // Item already exists based on production and dot position.
                // Merge lookaheads (relevant for LALR).
                if (item.follows && item.follows.length > 0) {
                    if (!existingItem.follows) {
                        existingItem.follows = [];
                    }
                    item.follows.forEach(function(lookahead) {
                        if (existingItem.follows.indexOf(lookahead) === -1) {
                            existingItem.follows.push(lookahead);
                        }
                    });
                }
            }
            return this;
        },

        forEach: function forEach(callback) {
            this.items.forEach(callback);
        },

        contains: function contains(item) {
            return !!this.itemsByKey[item.toString()];
        },

        size: function size() {
            return this.items.length;
        },

        equals: function equals(other) {
            if (this.size() !== other.size()) {
                return false;
            }
            // Check if all items (by key) exist in the other set
            for (var key in this.itemsByKey) {
                if (!other.itemsByKey[key]) {
                   return false;
                }
                // Optional: For LALR, might need stricter equality check including lookaheads
                // var thisItem = this.itemsByKey[key];
                // var otherItem = other.itemsByKey[key];
                // if (JSON.stringify(thisItem.follows.sort()) !== JSON.stringify(otherItem.follows.sort())) {
                //     return false;
                // }
            }
            return true;
        },

        toString: function toString() {
            return this.items.map(function(item) {
                // Optional: Include follows in toString for debugging/stricter keys
                // var followsStr = item.follows && item.follows.length > 0 ? ', {' + item.follows.join(',') + '}' : '';
                // return item.toString() + followsStr;
                 return item.toString();
            }).join('\n');
        }
    }),

    /**
     * Item class to represent an LR item
     */
    Item: typal.construct({
        constructor: function Item(production, dotPosition) {
            this.production = production;
            this.dotPosition = dotPosition || 0;
            this.follows = [];
            this.id = production.id;
        },

        currentSymbol: function currentSymbol() {
            return this.production.handle[this.dotPosition];
        },

        isReduction: function isReduction() {
            return this.dotPosition >= this.production.handle.length;
        },

        advance: function advance() {
            return new this.constructor(this.production, this.dotPosition + 1);
        },

        toString: function toString() {
            var handle = this.production.handle.slice(0);
            handle.splice(this.dotPosition, 0, '•');
            return this.production.symbol + ' -> ' + handle.join(' ');
        }
    })
});

/**
 * LR(0) Table Generator - no lookaheads
 */
var LR0TableGenerator = generator.beget();

LR0TableGenerator.constructor = function LR0TableGenerator(grammar) {
    generator.constructor.call(this, grammar);
};

/**
 * SLR(1) Table Generator - uses FOLLOW sets for lookaheads
 */
var SLRTableGenerator = generator.beget();

SLRTableGenerator.constructor = function SLRTableGenerator(grammar) {
    generator.constructor.call(this, grammar);
};

SLRTableGenerator.mix({
    getLookaheads: function getLookaheads(state, item) {
        return this.grammar.nonterminals[item.production.symbol].follows;
    }
});

/**
 * LALR(1) Table Generator - computes lookaheads for each item
 */
var LALRTableGenerator = generator.beget();

LALRTableGenerator.constructor = function LALRTableGenerator(grammar) {
    generator.constructor.call(this, grammar);
};

LALRTableGenerator.mix({
    getLookaheads: function getLookaheads(state, item) {
        // Ensure follows is always an array
        return item.follows || [];
    },

    closure: function closure(itemSet) {
        var self = this;
        var closureSet = new this.ItemSet();
        var changed = true;

        // Add initial items to the closure set
        itemSet.forEach(function(item) {
             // Ensure initial items also have a follows array, default to EOF for augmented start
            if (!item.follows) {
                 item.follows = (item.production.symbol === '$accept') ? ['$end'] : [];
             }
            closureSet.add(item);
        });

        while (changed) {
            changed = false;
            var currentItems = closureSet.items.slice(); // Work on a snapshot

            currentItems.forEach(function(item) {
                var currentFollows = item.follows || [];
                var symbolAfterDot = item.currentSymbol();

                if (symbolAfterDot && self.grammar.terminals.indexOf(symbolAfterDot) === -1) {
                    // It's a non-terminal following the dot
                    var handleAfterSymbol = item.production.handle.slice(item.dotPosition + 1);
                    var lookaheads = self.grammar.first(handleAfterSymbol);

                    if (self.grammar.nullable(handleAfterSymbol)) {
                        lookaheads = lookaheads.concat(currentFollows);
                    }
                    // Ensure lookaheads are unique
                    lookaheads = Array.from(new global.Set(lookaheads)); 

                    // Add productions for the non-terminal
                    self.grammar.productions.forEach(function(prod) {
                        if (prod.symbol === symbolAfterDot) {
                            var newItem = new self.Item(prod, 0);
                            var existingItem = closureSet.itemsByKey[newItem.toString()];
                            var oldFollowsLength = existingItem ? (existingItem.follows ? existingItem.follows.length : 0) : -1;
                            
                            // Assign calculated lookaheads to the new item before adding
                            newItem.follows = lookaheads; 

                            // Add the item (our add method handles merging follows)
                            closureSet.add(newItem);

                            // Check if follows changed for an existing item
                            var newExistingItem = closureSet.itemsByKey[newItem.toString()];
                            var newFollowsLength = newExistingItem.follows ? newExistingItem.follows.length : 0;

                            if (!existingItem || newFollowsLength > oldFollowsLength) {
                                changed = true;
                            }
                        }
                    });
                }
            });
        } // End while(changed)
        
        return closureSet;
    }
});

// Export the table generators
exports.LRTableGenerator = generator.construct();
exports.LR0TableGenerator = LR0TableGenerator.construct();
exports.SLRTableGenerator = SLRTableGenerator.construct();
exports.LALRTableGenerator = LALRTableGenerator.construct(); 