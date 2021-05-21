
class Compiler {
    constructor() {
        this.definitions = {};
        this.chainedCompiler = null;
    }

    chain(compiler) {
        this.chainedCompiler = compiler;
        return compiler;
    }

    define(name, definition) {
        this.definitions[name] = definition;
        return definition;
    }

    execute(tokens, index, flags, name) {
        var definition = this.definitions[name];
        var stream = new TokenStream(this, tokens, index, flags);
        
        definition(stream, flags);

        if (stream.valid) {
            if (stream.data && !stream.data.nodetype) {
                stream.data.nodetype = name;
            }
            return {tokens: stream.tokens, index: stream.index, result: stream.data};
        } else {
            return {tokens: tokens, index: index, result: null};
        }
    }

    read(tokens, index, flags, keys) {
        flags = flags || {};
        keys = keys || Object.keys(this.definitions);

        for (var i = 0; i < keys.length; i++) {
            var result = this.execute(tokens, index, flags, keys[i]);
            if (result.result) {
                return result;
            }
        }
        
        return {tokens: tokens, index: index, result: null};
    }

    readAll(tokens, index, flags, expectedEndToken) {
        var keys = Object.keys(this.definitions);

        var results = [];

        var obj = this.read(tokens, index, flags, keys);
        while(obj.result) {
            tokens = obj.tokens;
            index = obj.index;
            results.push(obj.result);

            obj = this.read(tokens, index, flags, keys);
        }

        if (index < tokens.length && (!expectedEndToken || !matchesQuery(tokens[index], expectedEndToken))) {
            var s = '';
            for (var i = index; i < tokens.length; i++) {
                s += tokens[i].content;
                if (i < tokens.length - 1) {
                    s += ' ';
                }
            }
            throw new Error(`(flags: ${JSON.stringify(flags)}, expectedEnd: ${JSON.stringify(expectedEndToken)}, final: ${JSON.stringify(tokens[index])}) failed to process tokens: ${s} `);
        }

        return {tokens: tokens, index: index, results: results};
    }

    compile(tokens) {
        let results = this.readAll(tokens, 0, {readRootStatement: true});
        if (this.chainedCompiler) {
            results = this.chainedCompiler.compile(results.results);
        } 
        return results;
    }
}