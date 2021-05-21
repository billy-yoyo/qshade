


const ShaderBindings = (function() {
    function bindArray(gl, location, buffer, opts) {
        if (!opts) { opts = {}; }

        const numComponents = opts.numComponents || 2;
        const type = opts.type || gl.FLOAT;
        const normalize = opts.normalize ? true : false;
        const stride = opts.stride ? opts.stride : 0;
        const offset = opts.offset ? opts.offset : 0;

        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.vertexAttribPointer(
            location,
            numComponents,
            type,
            normalize,
            stride,
            offset);
        gl.enableVertexAttribArray(location); 
    }

    function bindVertexAttrib(gl, location, value) {
        if (value.opts && value.buffer) {
            bindArray(gl, location, value.buffer, value.opts);
        } else {
            bindArray(gl, location, value);
        }
    }

    function bindAttrib(gl, location, value, type) {
        if (type === 'vertex') {
            bindVertexAttrib(gl, location, value);
        } else {
            throw new Error(`None-vertex type attributes aren't currently supported.`)
        }
    }

    function bindTexture(gl, location, texture, textureCounter) {
        // check for flipflop texture
        if (texture.textures) {
            texture = texture.read();
        }

        gl.activeTexture(gl['TEXTURE' + textureCounter.count]);
        gl.bindTexture(gl.TEXTURE_2D, texture.texture);
        gl.uniform1i(location, textureCounter.count);

        textureCounter.count++;
    }
    
    function bindUniform(gl, location, value, type, textureCounter) {
        if (type === 'sampler2D') {
            bindTexture(gl, location, value, textureCounter);
        } else {
            const override = ShaderBindings[type.toUpperCase()];
            if (override) {
                type = override;
            }

            gl['uniform' + type](location, ensureUniformValueFormat(value, type));
        }
    }

    function getConstString(value, type) {
        const override = ShaderBindings[type.toUpperCase()];
        if (override) {
            type = override;
        }

        if (type === '1i') {
            return '' + Math.floor(value);
        } else if (type === '1f') {
            if (value === Math.floor(value)) {
                return `${value}.0`;
            } else {
                return '' + value;
            }
        } else if (type.endsWith('fv')) {
            const n = parseInt(type.slice(0, -2));
            return `vec${n}(${value.join(', ')})`;
        } else if (type.endsWith('iv')) {
            const n = parseInt(type.slice(0, -2));
            return `ivec${n}(${value.join(', ')})`;
        } else {
            throw new Error('unsupported const type: ' + type);
        }
    }

    function ensureUniformValueFormat(value, type) {
        if (type.endsWith('fv')) {
            return new Float32Array(value);
        }

        if (type.endsWith('iv')) {
            return new Int32Array(value);
        }

        return value;
    }

    return {
        INT: '1i',
        FLOAT: '1f',
        VEC3: '3fv',
        VEC2: '2fv',
        IVEC3: '3iv',
        IVEC2: '2iv',
        VERTEX: 'vertex',
        SAMPLER2D: 'sampler2D',
        TEXTURE: 'sampler2D',

        _bindAttrib: bindAttrib,
        _bindUniform: bindUniform,
        _getConstString: getConstString
    }
})();

