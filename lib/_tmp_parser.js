var parser = (function(){

var parser = (function(){
function Parser () {
    this.yy = {};
    this.terminals_ = {"$end":"$end","x":"x","y":"y"};
}

Parser.prototype = {
    parse: function parse(input) {
        var self = this;
        var stack = [0];
        var vstack = [null];
        var lstack = [];
        var table = tables;
        var yytext = '';
        var yylineno = 0;
        var yyleng = 0;
        var recovering = 0;
        var TERROR = 'error';
        var EOF = '$end';

        // Set up lexer
        this.lexer.setInput(input);

        // Main parsing loop
        var symbol = null, preErrorSymbol = null, state = null, action = null, r = null, yyval = {};
        var p, len, newState, expected;
        while (true) {
            state = stack[stack.length - 1];

            // Use default actions if available
            if (defaultActions[state]) {
                action = defaultActions[state];
            } else {
                if (symbol === null || typeof symbol == 'undefined') {
                    var token = this.lexer.lex();
                    symbol = (token === undefined || token === null) ? EOF : token;
                    if (this.lexer.yytext) {
                        yytext = this.lexer.yytext;
                    } else if (typeof symbol === 'string') {
                        yytext = symbol;
                    }
                }
                // Read action for current state and first input
                action = table[state] && table[state][symbol];
            }

            // Handle parse error
            if (typeof action === 'undefined' || !action.length || !action[0]) {
                var errStr = '';
                expected = [];
                for (p in table[state]) {
                    if (this.terminals_[p]) { expected.push("'"+this.terminals_[p]+"'"); }
                }
                if (this.lexer.showPosition) {
                    errStr = 'Parse error on line '+(yylineno+1)+':\n'+this.lexer.showPosition()+'\nExpecting '+expected.join(', ') + ', got \''+(this.terminals_[symbol] || symbol)+'\' instead';
                } else {
                    errStr = 'Parse error on line '+(yylineno+1)+': Unexpected ' + (symbol == EOF ? 'end of input' : ('\''+(this.terminals_[symbol] || symbol)+'\''));
                }
                this.parseError(errStr, {
                    text: this.lexer.match || '',
                    token: this.terminals_[symbol] || symbol,
                    line: this.lexer.yylineno,
                    loc: this.lexer.yylloc,
                    expected: expected
                });
            }

            // Process the action
            switch (action[0]) {
                case 1: // shift
                    stack.push(symbol);
                    vstack.push(yytext);
                    lstack.push(this.lexer.yylloc);
                    stack.push(action[1]); // push state
                    symbol = null;
                    break;

                case 2: // reduce
                    len = productions[action[1]][1]; // get length of production
                    yyval.$ = vstack[vstack.length-len]; // default $$ = $1
                    r = this.performAction.call(yyval, action[1], vstack, lstack);
                    if (typeof r !== 'undefined') {
                        return r;
                    }
                    // Pop off stack
                    stack.length -= len;
                    vstack.length -= len;
                    lstack.length -= len;

                    // Push new state
                    stack.push(productions[action[1]][0]); // push nonterminal (reduce)
                    newState = goto[stack[stack.length-2]][stack[stack.length-1]];
                    stack.push(newState);
                    break;

                case 3: // accept
                    return true;
            }
        }
        return true;
    },

    parseError: function parseError(str, hash) {
        if (this.yy.parser) {
            this.yy.parser.parseError(str, hash);
        } else {
            throw new Error(str);
        }
    }
};

var parser = new Parser();

/* Parser configuration */
var productions = [["$accept",2],["A",2],["A",1],["A",0]];

/* Action Table */
var tables = {"0":{"x":["shift",2],"y":["shift",3],"$end":["reduce",3]},"1":{"$end":["shift",4]},"2":{"x":["shift",2],"y":["shift",3]},"3":{},"4":{},"5":{}};

/* Default actions */
var defaultActions = {};

/* Goto table */
var goto = [{"A":1},{},{"A":5},{},{},{}];

/* Symbol table */
var symbols = ["$accept","$end","x","y","A","x"];

Parser.prototype.performAction = function performAction(prodId, vstack, lstack) {
    var self = this;
    var yyval = { $: null };
    var production = productions[prodId];
    var symbol = production[0];
    var len = production[1];
    yyval.$ = vstack[vstack.length - len] || null;
    var yytext = this.lexer ? this.lexer.yytext : '';
    var yyleng = this.lexer ? this.lexer.yyleng : 0;
    var yylineno = this.lexer ? this.lexer.yylineno : 0;
    var yyloc = this.lexer ? this.lexer.yylloc : {first_line: 1, first_column: 0, last_line: 1, last_column: 0};

    // Set up semantic values
    for (var i = 0; i < len; i++) {
        yyval['$' + (i + 1)] = vstack[vstack.length - len + i];
    }

    // Set up location info
    if (lstack && lstack.length > 0) {
        yyval._$ = {
            first_line: lstack[lstack.length - len] ? lstack[lstack.length - len].first_line : 1,
            last_line: lstack[lstack.length - 1] ? lstack[lstack.length - 1].last_line : 1,
            first_column: lstack[lstack.length - len] ? lstack[lstack.length - len].first_column : 0,
            last_column: lstack[lstack.length - 1] ? lstack[lstack.length - 1].last_column : 0
        };
    }

    // Execute production actions
    try {
        switch(prodId) {
            case 0: /* $accept -> A $end */
                this.$ = $1;
                break;
            case 1: /* A -> x A */
                this.$ = $1;
                break;
            case 2: /* A -> y */
                this.$ = $1;
                break;
            case 3: /* A ->  */
                this.$ = null;
                break;
        }
    } catch (e) {
        if (e instanceof SyntaxError) {
            throw e;
        }
        console.error('Internal error in production action for:', production);
        console.error(e);
    }
    return yyval.$;
};

/* Generate lexer */
parser.lexer = {
    lex: function () {
        var token = this.tokens[0];
        this.tokens = this.tokens.slice(1);
        if(typeof token === 'undefined') return '$end'; return token;
    },
    setInput: function (tokens) {
        if (typeof tokens === 'string') {
            this.tokens = tokens.split(''); 
        } else {
            this.tokens = tokens;
        }
        this.position = 0;
        this.yytext = '';
        this.yyleng = 0;
        this.yylineno = 0;
        this.yylloc = {
            first_line: 1,
            first_column: 0,
            last_line: 1,
            last_column: 0
        };
    },
    input: function () {
        return this.tokens;
    },
    unput: function (token) {
        this.tokens.unshift(token);
    },
    showPosition: function() {
        return this.tokens.join('');
    }
};

return parser;
})();
return parser;
})();;
exports.parser = parser;
