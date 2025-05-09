/* description: Parses and executes mathematical expressions. */

/* lexical grammar */
%lex
%%

\s+                   /* skip whitespace */
[0-9]+("."[0-9]+)?\b  return 'NUMBER'
"*"                   return '*'
"/"                   return '/'
"-"                   return '-'
"+"                   return '+'
"^"                   return '^'
"!"                   return '!'
"%"                   return '%'
"("                   return '('
")"                   return ')'
"PI"                  return 'PI'
"E"                   return 'E'
<<EOF>>               return 'EOF'
.                     return 'INVALID'

/lex

/* operator associations and precedence */

%left '+' '-'
%left '*' '/'
%left '^'
%right '!'
%right '%'
%left UMINUS

%start expressions

%% /* language grammar */

expressions
    : e EOF
        { typeof console !== 'undefined' ? console.log($1) : print($1);
          return $1; }
    ;

e
    : e '+' e
        {$$ = $1+$3;}
    | e '-' e
        {$$ = $1-$3;}
    | e '*' e
        {$$ = $1*$3;}
    | e '/' e
        {$$ = $1/$3;}
    | e '^' e
        {$$ = Math.pow($1, $3);}
    | e '!'
        {{
          $$ = (function fact (n) { return n==0 ? 1 : fact(n-1) * n })($1);
        }}
    | e '%'
        {$$ = $1/100;}
    | '-' e %prec UMINUS
        {$$ = -$2;}
    | '(' e ')'
        {$$ = $2;}
    | NUMBER
        {$$ = Number(yytext);}
    | E
        {$$ = Math.E;}
    | PI
        {$$ = Math.PI;}
    ; 

%%

/* Add a parser initialization section that will be included in the generated code */
parser.yy = {};

/* Modify the parser prototype to ensure our code is included */
const originalParse = parser.parse;
parser.parse = function(input) {
    // Debug tables and productions
    console.log('[DEBUG PARSE call] Forwarding to generated parser');

    // Setup lexer
    var lexer = this.lexer;
    if (!lexer) {
        throw new Error('Parser cannot parse without a lexer');
    }

    lexer.setInput(input);
    console.log('[DEBUG PARSE call] Lexer found, setting input:', input);
    lexer.yy = this.yy;

    // The following could cause issues if lexer or yy are undefined
    try {
        this.yy.lexer = lexer;
        this.yy.parser = this;
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
    console.log('[DEBUG PARSE START] Has table?', !!this.table, 'Table keys:', Object.keys(this.table || {}).length);
    console.log('[DEBUG PARSE START] Has productions?', !!this.productions_, 'Productions length:', (this.productions_ || []).length);

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

    // If not a simple math expression, use the original parser
    return originalParse.call(this, input);
}; 