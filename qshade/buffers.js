

const ShaderBuffers = (function() {
    function isFunction(functionToCheck) {
        return functionToCheck && {}.toString.call(functionToCheck) === '[object Function]';
    }

    class FlipFlopTexture {
        constructor(texA, texB) {
            this.textures = [texA, texB]
            this.mode = 0;
        }

        read() {
            return this.textures[this.mode];
        }

        write() {
            return this.textures[(this.mode + 1) % 2];
        }

        flip() {
            this.mode = (this.mode + 1) % 2;
        }
    }

    function isPowerOf2(value) {
        return (value & (value - 1)) == 0;
    }

    const positions = [
        1.0, 1.0,
        -1.0, 1.0,
        1.0, -1.0,
        -1.0, -1.0
    ];

    function initPositionBuffer(gl) {
        const positionBuffer = gl.createBuffer();

        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        return positionBuffer;
    }

    function getFormatSize(format) {
        // cheap hack - should do better.
        return format.length;
    }

    function createArrayWithType(data, type) {
        if (type == 'UNSIGNED_BYTE') {
            return new Uint8Array(data);
        } else if (type == 'UNSIGNED_SHORT_5_6_5' || type == 'UNSIGNED_SHORT_5_5_5_1' 
                || type == 'UNSIGNED_SHORT_4_4_4_4' || type == 'UNSIGNED_SHORT' || type == 'HALF_FLOAT_OES') {
            return new Uint16Array(data);
        } else if (type == 'UNSIGNED_INT ' || type == 'UNSIGNED_INT_24_8_WEBGL') {
            return new Uint32Array(data); 
        } else if (type == 'FLOAT') {
            return new Float32Array(data);
        } else {
            throw new Error(`Unrecognized type: ${type}`);
        }
    }


    function initImageTexture(opts) {
        opts = opts || {};

        if (opts.flipFlop) {
            return initFlipFlopTexture(initImageTexture, opts);
        }

        let gl = opts.gl,
            format = (opts.format || 'RGBA').toUpperCase(),
            type = (opts.type || 'UNSIGNED_BYTE').toUpperCase(),
            width = 1, 
            height = 1, 
            pixel = new Uint8Array([0, 0, 255, 255]);

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl[format], width, height, 0, gl[format], gl[type], pixel);

        let texObj = { texture };

        if (opts.framebuffer) {
            const fb = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

            const attachmentPoint = gl.COLOR_ATTACHMENT0;
            gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, texture, 0);

            texObj.fb = fb;
        }

        const image = new Image();
        image.onload = () => {
            texObj.width = image.width;
            texObj.height = image.height;

            console.log(image);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl[format], gl[format], gl[type], image);

            if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
                gl.generateMipmap(gl.TEXTURE_2D);
            } else {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            }

            if (opts.callback) {
                opts.callback(texObj, image);
            }
        };  

        image.src = opts.src;
        return texObj;
    }

    function initDataTexture(opts) {
        opts = opts || {};

        if (opts.flipFlop) {
            return initFlipFlopTexture(initDataTexture, opts);
        }

        if (opts.output) { 
            opts.framebuffer = true;
            if (!opts.format) {
                opts.format = 'RGBA';
            }
        }

        let gl = opts.gl,
            data = opts.data,
            format = (opts.format || 'RGB').toUpperCase(),
            type = (opts.type || 'FLOAT').toUpperCase(),
            width = opts.width || opts.size,
            height = opts.height || opts.size;

        let formatSize = getFormatSize(format);

        if (isFunction(data)) {
            const pixelGenerator = data;
            if (!width || !height) {
                throw new Error('must give width or height when using pixel generator');
            }

            data = [];
            for (let x = 0; x < width; x++) {
                for (let y = 0; y < height; y++) {
                    let pixel = pixelGenerator(x, y);
                    data = data.concat(pixel);
                }
            }
        }
        
        if (!gl) {
            throw new Error('cannot initialize texture with no gl');
        }

        if (!data) {
            throw new Error('cannot initialize texture with no data')
        }

        if (width && height) {
            if (width * height != data.length / formatSize) {
                throw new Error(`invalid texture dimensions, ${width * height} pixels defined, dataSet requires ${data.length / formatSize} pixels`);
            }
        } else {
            width = height = Math.ceil(Math.sqrt(data.length / formatSize));


            if (data.length < width * width * formatSize) {
                data = data.concat(new Array((width * width * formatSize) - data.length).fill(0));
            }
        }

        data = createArrayWithType(data, type);

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl[format], width, height, 0, gl[format], gl[type], data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        let texObj = { texture, width, height };

        if (opts.framebuffer) {
            const fb = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

            const attachmentPoint = gl.COLOR_ATTACHMENT0;
            gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, texture, 0);

            texObj.fb = fb;
        }

        return texObj;
    }

    function initFlipFlopTexture(initTextureFunc, opts) {
        if (!opts.framebuffer) {
            opts.framebuffer = true;
            opts.flipFlop = false;
            if (!opts.format) {
                opts.format = 'RGBA';
            }
        }
        return new FlipFlopTexture(initTextureFunc(opts), initTextureFunc(opts));
    }

    return {
        initPositionBuffer,
        initDataTexture,
        initImageTexture
    };
})();