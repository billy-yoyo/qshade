

const DEFAULT_VERTEX_SHADER = `
attribute vec2 aVertexPosition;

varying vec2 vVertexPosition;

void main(void) {
    gl_Position = vec4(aVertexPosition, 1.0, 1.0);
    vVertexPosition = aVertexPosition;
}
`;

function createWebGLContext(canvas) {
    const gl = canvas.getContext('webgl');

    if (gl === null) {
        alert('webgl is unavailable');
        return;
    }

    var floatTextures = gl.getExtension('OES_texture_float');
    if (!floatTextures) {
        alert('No floating point texture support');
        return;
    }

    var floatTexturesLinear = gl.getExtension('OES_texture_float_linear');
    if (!floatTexturesLinear) {
        alert('No floating point linear texture support');
        return;
    }

    return gl;
}

class Shader {
    constructor(opts) {
        this.fragmentSource = opts.fragment;
        this.vertexSource = opts.vertex || DEFAULT_VERTEX_SHADER;

        this.uniforms = opts.uniforms || {};
        this.attribs = opts.attribs || {};
        this.consts = opts.consts || {};
        this.data = opts.data || {};
        this.gl = opts.gl || null;
        this.canvas = opts.canvas;
        this.output = opts.output || null;
        this.chainedShader = opts.chainedShader || null;
        this.enableProcessing = opts.enableProcessing === undefined ? true : opts.enableProcessing;

        if (!this.gl && this.canvas) {
            this.gl = createWebGLContext(this.canvas);
        }

        this.uniformLocations = [];
        this.attribLocations = [];

        if (!opts.vertex) {
            // add vertex position data
            this.attribs['vertexPosition'] = ShaderBindings.VERTEX;
            this.data.vertexPosition = ShaderBuffers.initPositionBuffer(this.gl);
        }

        this.initialize();
    }

    chain(shader) {
        let tail = this;
        while (tail.chainedShader) {
            tail = tail.chainedShader;
        }
        tail.chainedShader = shader;
        return this;
    }

    processGlsl(source) {
        if (!this.enableProcessing) {
            return source;
        }

        try {
            const nodes = QLGLSL.compile(source);

            QLGLSL.walk(nodes, {
                variable_definition: (node) => {
                    if (node.qualifier === 'uniform') {
                        let dataName = node.name;
                        if (dataName.startsWith('u') && dataName[1].toUpperCase() === dataName[1]) {
                            dataName = dataName[1].toLowerCase() + dataName.slice(2);
                        }

                        this.uniforms[dataName] = { variable: node.name, type: node.type };
                    } else if (node.qualifier === 'const' && node.value === undefined) {
                        if (this.data[node.name] !== undefined) {
                            node.value = { nodetype: 'chunk', chunk: ShaderBindings._getConstString(this.data[node.name], node.type) };
                        }
                    }
                }
            });

            return QLGLSL.reconstruct(nodes);
        } catch (e) {
            console.error('failed to compile GLSL.');
            console.error(e);
        }
    }

    initialize() {
        let fragmentSource = this.fragmentSource;

        Object.keys(this.consts).forEach((dataName) => {
            const value = this.data[dataName];

            if (value !== undefined) {
                fragmentSource = fragmentSource.replace(`$${dataName}$`, ShaderBindings._getConstString(value, this.consts[dataName]));
            }
        });

        fragmentSource = this.processGlsl(fragmentSource);

        this.program = ShaderProgram.initShaderProgram(this.gl, this.vertexSource, fragmentSource);
        this._findAttribs();
        this._findUniforms();
    }

    _forEachLocation(locationMap, defaultIdentifier, iterator) {
        Object.keys(locationMap).forEach((dataName) => {
            let data = locationMap[dataName],
                variableName, type;

            if (typeof data === 'string' || data instanceof String) {
                type = data;
                variableName = defaultIdentifier + dataName[0].toUpperCase() + dataName.slice(1);
            } else {
                type = data.type;
                variableName = data.variable;
            }

            iterator(dataName, variableName, type);
        });
    }

    _forEachUniform(iterator) {
        this._forEachLocation(this.uniforms, 'u', iterator);
    }

    _forEachAttrib(iterator) {
        this._forEachLocation(this.attribs, 'a', iterator);
    }

    _findUniforms() {
        this.uniformLocations = [];
        this._forEachUniform((dataName, variableName) => {
            this.uniformLocations[dataName] = this.gl.getUniformLocation(this.program, variableName);
        });
    }

    _findAttribs() {
        this.attribLocations = [];
        this._forEachAttrib((dataName, variableName) => {
            this.attribLocations[dataName] = this.gl.getAttribLocation(this.program, variableName);
        });
    }

    _bindTexture(texture, textureOpts) {
        if (textureOpts.output) {
            this.output = texture;
        }

        if (textureOpts.name) {
            this.data[textureOpts.name] = texture;
        }

        return texture;
    }

    createDataTexture(textureOpts) {
        let texture = ShaderBuffers.initDataTexture({
            ...textureOpts,
            gl: this.gl
        });

        return this._bindTexture(texture, textureOpts);
    }

    createImageTexture(textureOpts) {
        let texture = ShaderBuffers.initImageTexture({
            ...textureOpts,
            gl: this.gl
        });

        return this._bindTexture(texture, textureOpts);
    }

    render() {
        const gl = this.gl;

        if (this.output) {
            let outputTexture = this.output;
            // check for flipflop texture
            if (this.output.textures) {
                outputTexture = outputTexture.write();
            }
            gl.bindFramebuffer(gl.FRAMEBUFFER, outputTexture.fb);
            gl.viewport(0, 0, outputTexture.width, outputTexture.height);
        } else {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        }

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clearDepth(1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.useProgram(this.program);

        // bind attributes
        this._forEachAttrib((dataName, variableName, type) => {
            let location = this.attribLocations[dataName],
                value = this.data[dataName];

            if (value !== undefined) {
                ShaderBindings._bindAttrib(gl, location, value, type);
            }
        });

        // bind uniforms
        let textureCounter = { count: 0 };
        this._forEachUniform((dataName, variableName, type) => {
            let location = this.uniformLocations[dataName],
                value = this.data[dataName];
            
            if (value !== undefined) {
                ShaderBindings._bindUniform(gl, location, value, type, textureCounter);
            }
        });

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // we flip the output if it's a flipflop texture.
        if (this.output && this.output.textures) {
            this.output.flip();
        }

        if (this.chainedShader) {
            Object.assign(this.chainedShader.data, this.data);
            this.chainedShader.render();
        }
    }
}