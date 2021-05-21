
const QLGLSL = (() => {
    const tokenmap = {
        word: Tokenize.maps.regex(/^[a-zA-Z_$][a-zA-Z_$0-9]*/),
        whitespace: Tokenize.maps.regex(/^\s+/, {discard: true}),
        lineComment: Tokenize.maps.regex(/^\/\/[^\n]*\n/, {discard: true}),
        inlineComment: Tokenize.maps.regex(/^\/\*.*(?=\*\/)\*\//, {discard: true}),
        integer: Tokenize.maps.regex(/^[0-9]+/),
        float: Tokenize.maps.regex(/^[0-9]*\.[0-9]+/),
        bracket: Tokenize.maps.list('(){}[]'),
        operator: Tokenize.maps.list('+-*/!%'),
        equality: Tokenize.maps.list(['==', '!=', '>=', '<=', '>', '<'], {priority: 3}),
        boolop: Tokenize.maps.list(['||', '&&']),
        marker: Tokenize.maps.list(',;:.?|'),
        assign: Tokenize.maps.list(['=', '*=', '/=', '-=', '+=', '%=']),
        crement: Tokenize.maps.list(['++', '--']),
        string: Tokenize.maps.regex(/^"([^"]|\\")*[^\\]"/)
    };

    const compiler = new Compiler();

    const VARIABLE_QUALIFIERS = ['varying', 'uniform', 'const'];

    compiler.define('precision', (stream) => {
        stream.requireFlag('readRootStatement')
            .read({content: 'precision'})
            .read({type: 'word'}, {precision: 'content'})
            .read({type: 'word'}, {type: 'content'})
            .read({content: ';'})
    });

    compiler.define('variable_definition', (stream) => {
        stream.requireFlag(['readStatement', 'readRootStatement', 'readSimpleStatement'])
            .maybeRead((token) => token.type === 'word' && VARIABLE_QUALIFIERS.includes(token.content), {qualifier: 'content'})
            .read({type: 'word'}, {type: 'content'})
            .read({type: 'word'}, {name: 'content'})
            .thenIf({content: '='}, () => {
                stream.read({type: 'assign'})
                    .readValue('value', {readValue: true});
            })
            .readIf(!stream.flags.readSimpleStatement, {content: ';'})
            .validate(() => !stream.data.qualifier || stream.flags.readRootStatement);
    });

    compiler.define('variable_assign', (stream) => {
        stream.requireFlag(['readStatement', 'readSimpleStatement'])
            .read({type: 'word'}, {name: 'content'})
            .read({type: 'assign'}, {assign: 'content'})
            .readValue('value', {readValue: true})
            .readIf(!stream.flags.readSimpleStatement, {content: ';'});
    });

    compiler.define('property_assign', (stream) => {
        stream.requireFlag(['readStatement', 'readSimpleStatement'])
            .readValue('property', {readValue: true})
            .validate(() => stream.data.property.nodetype === 'property_access')
            .read({type: 'assign'}, {assign: 'content'})
            .readValue('value', {readValue: true})
            .readIf(!stream.flags.readSimpleStatement, {content: ';'});
    });

    compiler.define('value_statement', (stream) => {
        stream.requireFlag('readSimpleStatement')
            .readValue('value', {readValue: true});
    }); 

    compiler.define('empty_statment', (stream) => {
        stream.requireFlag('readSimpleStatement')
            .validate(() => stream.curToken.content === ';' || stream.curToken.content === ')');
    });

    compiler.define('function_definition', (stream) => {
        stream.requireFlag('readRootStatement')
            .read({type: 'word'}, {returnType: 'content'})
            .read({type: 'word'}, {name: 'content'})
            .read({content: '('})
            .initializeData('args.types[]')
            .initializeData('args.names[]')
            .repeatUntil({content: ')'}, (stream, count) => {
                if (count > 0) stream.read({content: ','});
                stream.read({type: 'word'}, {'args.types[]': 'content'})
                    .read({type: 'word'}, {'args.names[]': 'content'});
            })
            .read({content: ')'})
            .read({content: '{'})
            .readAllValues('body', {readStatement: true}, {content: '}'})
            .read({content: '}'});
    });

    compiler.define('if', (stream) => {
        const readIf = (condition, body) => {
            return () => stream.read({content: '('})
                .readValue(condition, {readValue: true})
                .read({content: ')'})
                .read({content: '{'})
                .readAllValues(body, {readStatement: true}, {content: '}'})
                .read({content: '}'});
        };
            
        stream.requireFlag('readStatement')
            .read({content: 'if'})
            .then(readIf('condition', 'body'))
            .initializeData('elseif.conditions[]')
            .initializeData('elseif.bodies[]')
            .repeatWhile({content: 'else'}, () => {
                stream.read({content: 'else'})
                    .thenIf({content: 'if'}, () => {
                        stream.read({content: 'if'})
                            .then(readIf('elseif.conditions[]', 'elseif.bodies[]'));
                    }, () => {
                        stream.read({content: '{'})
                            .readAllValues('else', {readStatement: true}, {content: '}'})
                            .read({content: '}'});
                    });
            });
    });

    compiler.define('for', (stream) => {
        stream.requireFlag('readStatement')
            .read({content: 'for'})
            .read({content: '('})
            .readValue('initialize', {readSimpleStatement: true})
            .read({content: ';'})
            .readValue('check', {readSimpleStatement: true})
            .read({content: ';'})
            .readValue('increment', {readSimpleStatement: true})
            .read({content: ')'})
            .read({content: '{'})
            .readAllValues('body', {readStatement: true}, {content: '}'})
            .read({content: '}'});
    });

    compiler.define('return', (stream) => {
        stream.requireFlag('readStatement')
            .read({content: 'return'})
            .readValue('value', {readValue: true})
            .read({content: ';'});
    });

    compiler.define('break', (stream) => {
        stream.requireFlag('readStatement')
            .read({content: 'break'})
            .read({content: ';'});
    });

    compiler.define('float', (stream) => {
        stream.requireFlag('readSingleValue')
            .read({type: 'float'}, {value: 'content'});
    });

    compiler.define('int', (stream) => {
        stream.requireFlag('readSingleValue')
            .read({type: 'integer'}, {value: 'content'});
    });

    compiler.define('variable', (stream) => {
        stream.requireFlag('readSingleValue')
            .read({type: 'word'}, {value: 'content'});
    });

    compiler.define('bracketed', (stream) => {
        stream.requireFlag('readSingleValue')
            .read({content: '('})
            .readValue('value', {readValue: true})
            .read({content: ')'});
    });

    const UNARY_OPERATORS = ['!', '-', '+'];
    compiler.define('unary', (stream) => {
        stream.requireFlag('readSingleValue')
            .read((token) => UNARY_OPERATORS.includes(token.content), {operator: 'content'})
            .readValue('value', {readValue: true});
    });

    compiler.define('value', (stream) => {
        stream.requireFlag('readValue')
            .then(function() {
                var binopValue = null;
                var value = compiler.read(stream.tokens, stream.index, {readSingleValue: true});
                stream.index = value.index;

                if (!value.result) {
                    stream.data = value.result;
                    return;
                }

                var suffix = compiler.read(stream.tokens, stream.index, {suffix: true, value: value.result});
                stream.index = suffix.index;

                while (suffix.result) {
                    if (suffix.result.nodetype === 'binop') {
                        if (!binopValue) {
                            binopValue = suffix.result;
                        } else {
                            binopValue.ops.push(suffix.result.ops[0]);
                            binopValue.values.push(suffix.result.values[0]);
                        }

                        value = compiler.read(stream.tokens, stream.index, {readSingleValue: true});
                        stream.index = value.index;

                        if (!value.result) {
                            stream.data = value.result;
                            return;
                        }
                    } else {
                        value = suffix;
                    }

                    suffix = compiler.read(stream.tokens, stream.index, {suffix: true, value: value.result});
                    stream.index = suffix.index;
                }

                if (binopValue) {
                    binopValue.values.push(value.result);
                }
                
                stream.data = binopValue || value.result;
            });
    }); 

    compiler.define('function_call', (stream, flags) => {
        stream.requireFlag('suffix')
            .read({content: '('})
            .then(() => { 
                stream.data.args = []; 
                stream.data.value = flags.value;
            })
            .repeatUntil({content: ')'}, function(stream, count) {
                if (count > 0) {
                    stream.read({content: ','});
                }
                stream.readValue('args[]', {readValue: true});
            })
            .read({content: ')'});
    });

    compiler.define('binop', (stream, flags) => {
        stream.requireFlag('suffix')
            .read(function(token) {
                return token.type !== 'assign' && '+-/*% == != > < >= <= || &&'.includes(token.content);
            }, {'ops[]': 'content'})
            .then(function() {
                stream.data.values = [flags.value];
            });
    });

    compiler.define('property_access', (stream, flags) => {
        stream.requireFlag('suffix')
            .read({content: '.'})
            .then(() => {
                stream.data.value = flags.value;
            })
            .read({type: 'word'}, {property: 'content'});
    });

    const CREMENT_TARGETS = ['property_access', 'variable'];
    compiler.define('crement', (stream) => {
        stream.requireFlag(['suffix', 'readValue'])
            .read({type: 'crement'}, {operator: 'content'})
            .thenIf(!!stream.flags.suffix, () => {
                stream.data.value = stream.flags.value;
                stream.data.suffix = true;
            }, () => {
                stream.readValue('value', {readValue: true})
                    .then(() => { stream.data.suffix = false; });
            })
            .validate(() => CREMENT_TARGETS.includes(stream.data.value.nodetype));
    });

    function compile(s) {
        const result = Tokenize.process(s, tokenmap);
        const tokens = result.tokens;

        const results = compiler.compile(tokens);
        return results.results;
    }

    return {
        tokenmap,
        compiler,
        compile,
        test: () => runQLGLSLTests(compile),
        reconstruct: (nodelist) => QLGLSLReconstruct(nodelist),
        walk: QLGLSLNodeWalker
    };
})();
