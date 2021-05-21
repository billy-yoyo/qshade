
function isString(s) {
    return typeof s === 'string' || s instanceof String;
}

function isFunction(functionToCheck) {
    return functionToCheck && {}.toString.call(functionToCheck) === '[object Function]';
}

function matchesQuery(token, query) {
    if (query === true || query === false) {
        return query;
    }

    if (isFunction(query)) {
        return token && query(token);
    }

    if (!token) {
        return false;
    }

    var keys = Object.keys(query);
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (token[key] !== query[key]) {
            return false;
        }
    }

    return true;
}

const TokenStream = (function() {
    class TokenStream {
        constructor(compiler, tokens, index, flags) {
            this.compiler = compiler;
            this.tokens = tokens;
            this.index = index;
            this.flags = flags;
            this.valid = true;
            this.data = {};
        }

        get curToken() {
            return this.tokens[this.index];
        }

        matches(query) {
            return matchesQuery(this.curToken, query);
        }

        _saveData(key, value) {
            var dest = this.data;
            var key = key.split('.');
            for (var j = 0; j < key.length - 1; j++) {
                if (!dest[key[j]]) {
                    dest[key[j]] = {};
                }
                dest = dest[key[j]];
            }

            key = key[key.length - 1];
            if (key.endsWith('[]')) {
                key = key.slice(0, key.length - 2);
                if (!dest[key]) {
                    dest[key] = [];
                }
                if (value !== undefined) {
                    dest[key].push(value);
                }
            } else {
                dest[key] = value;
            }
        }

        maybeRead(query, save) {
            if (!this.valid) return this;

            this.read(query, save);
            this.valid = true;

            return this;
        }

        readIf(condition, query, save) {
            if (!this.valid) return this;

            if (matchesQuery(this.curToken, condition)) {
                this.read(query, save);
            }

            return this;
        }

        read(query, save) {
            if (!this.valid) return this;

            if (!matchesQuery(this.curToken, query)) {
                this.valid = false;
                return this;
            }
            
            if (save && this.curToken) {
                var keys = Object.keys(save);
                for (var i = 0; i < keys.length; i++) {
                    var key = keys[i];
                    var value;

                    if (isFunction(save[key])) {
                        value = save[key](this.curToken);
                    } else {
                        value = this.curToken[save[key]];
                    }

                    this._saveData(key, value);
                }
            }

            this.index++;
            return this;
        }

        repeatWhile(condition, func) {
            if (!this.valid) return this;

            return this.repeatUntil((token) => !matchesQuery(token, condition), func);
        }

        repeatUntil(condition, func) {
            if (!this.valid) return this;

            if (!isFunction(condition)) {
                var query = condition;
                condition = function(token) {
                    return matchesQuery(token, query);
                };
            }

            var count = 0;
            while (this.valid && this.curToken && !condition(this.curToken)) {
                func(this, count);
                count++;
            }

            return this;
        }

        readValue(dest, flags) {
            if (!this.valid) return this;

            var result = this.compiler.read(this.tokens, this.index, flags);

            if (!result.result) {
                this.valid = false;
                return this;
            }

            this.index = result.index;
            this._saveData(dest, result.result);

            return this;
        }

        readAllValues(dest, flags, expectedEndToken) {
            if (!this.valid) return this;

            var results = this.compiler.readAll(this.tokens, this.index, flags, expectedEndToken);

            this.index = results.index;
            this._saveData(dest, results.results);

            return this;
        }

        then(func) {
            if (this.valid) {
                func(this);
            }
            return this;
        }

        thenIf(condition, func, elsefunc) {
            if (this.valid && matchesQuery(this.curToken, condition)) {
                func(this);
            } else if (this.valid && elsefunc) {
                elsefunc(this);
            }

            return this;
        }

        validate(func) {
            if (this.valid) {
                this.valid = func(this);
            }
            return this;
        }

        initializeData(dest, value) {
            if (this.valid) {
                this._saveData(dest, value);
            }
            return this;
        }

        _compareFlag(name, value) {
            value = value === undefined ? true : value;
            if (value === false || value === true) {
                return !!this.flags[name] === value;
            } else {
                return this.flags[name] == value;
            }
        }

        requireFlag(name, value) {
            if (this.valid) {
                if (!isString(name) && name.length) {
                    var valid = false;
                    for (var i = 0; i < name.length; i++) {
                        valid = this._compareFlag(name[i], value);
                        if (valid) {
                            break;
                        }
                    }

                    this.valid = valid;
                } else {
                    this.valid = this._compareFlag(name, value);
                }
            }
            return this;
        }
    }

    return TokenStream;
})();