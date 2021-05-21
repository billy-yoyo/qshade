
const Tokenize = (function() {
    function safeMerge(obj, update) {
        var keys = Object.keys(update);
        for (var i = 0; i < keys.length; i++) {
            if (obj[keys[i]] === undefined) {
                obj[keys[i]] = update[keys[i]];
            }
        }
        return obj;
    }

    function createResult(length, opts) {
        var result = {length: length};
        safeMerge(result, opts);
        return result;
    }

    function wordMap(s, word, opts) {
        if (s.slice(0, word.length) === word) {
            return createResult(word.length, opts);
        }
    }

    function sanitizeOpts(opts) {
        var safe = {};
        safeMerge(safe, opts || {});
        safeMerge(safe, {
            priority: 0,
            discard: false
        });
        return safe;
    }

    const maps = {
        regex: function regex(expr, opts) {
            opts = sanitizeOpts(opts);
            return function(s) {
                var result = s.match(expr);
    
                if (result) {
                    return createResult(result[0].length, opts);
                }
            };
        },
    
        regexlist: function regexlist(exprs, opts) {
            opts = sanitizeOpts(opts);
            return function(s) {
                for (var i = 0; i < exprs.length; i++) {
                    var result = s.match(exprs[i]);
    
                    if (result) {
                        return createResult(result[0].length, opts);
                    }
                }
            };
        },
    
        word: function word(word, opts) {
            opts = sanitizeOpts(opts);
            return function(s) {
                return wordMap(s, word, opts);
            };
        },
    
        list: function list(words, opts) {
            opts = sanitizeOpts(opts);
            return function(s) {
                for (var i = 0; i < words.length; i++) {
                    var result = wordMap(s, words[i], opts);
                    if (result) {
                        return result;
                    }
                }
            }
        }
    };

    function getBest(s, tokenmap, tokentypes) {
        var bestTokenType,
            best = {length: 0, priority: 0};

        for (var i = 0; i < tokentypes.length; i++) {
            var tokentype = tokentypes[i];
            var result = tokenmap[tokentype](s);

            if (result && (result.length > best.length || (result.length == best.length && result.priority > best.priority))) {
                bestTokenType = tokentype;
                best = result;
            }
        }

        if (bestTokenType && best.length) {
            return { type: bestTokenType, content: s.slice(0, best.length), data: best };
        }
    }
    
    function process(s, tokenmap) {
        var tokentypes = Object.keys(tokenmap);
        var tokens = [];
    
        while (s) {
            var token = getBest(s, tokenmap, tokentypes);
            if (!token) {
                return {tokens: tokens, remaining: s};
            } else {
                if (!token.data.discard) {
                    tokens.push(token);
                }
                s = s.slice(token.content.length);
    
                // discard token data since we don't need it anymore
                token.data = undefined;
            }
        }
    
        return {tokens: tokens, remaining: s};
    }
    
    function print(tokens) {
        var s = '';
        for (var i = 0; i < tokens.length; i++) {
            var token = tokens[i];
    
            s += token.type + '<' + token.content + '> '
        }
        console.log(s);
    }

    return {
        process,
        maps,
        print
    };
})();