
const twinkle = `
precision mediump float;

varying vec2 vVertexPosition;

uniform sampler2D uDataSet;

uniform float uRandom;
uniform float uElapsed;
uniform float uScale;

const float someNumber = $someNumber$;

float sqr(float x) {
    return x * x;
}

float getDirection(float x, float origin) {
    if (x > origin) {
        return -1.0;
    } else {
        return 1.0;
    }
}

void main() {
    vec2 pos = (vVertexPosition + vec2(1.0)) / 2.0;
    vec3 colour = texture2D(uDataSet, pos).xyz;

    vec3 direction = vec3(getDirection(colour.x, 0.5), getDirection(colour.y, 0.5), getDirection(colour.z, 0.5));

    float random = (uRandom * 2.0) - 1.0;
    random *= (sqr(sin(pos.x)) + sqr(cos(pos.y))) * uScale * uElapsed;

    colour += direction * random;

    gl_FragColor = vec4(colour, 1.0);
}
`;

const render = `
precision mediump float;

varying vec2 vVertexPosition;

uniform sampler2D uDataSet;

void main() {
    vec2 pos = (vVertexPosition + vec2(1.0)) / 2.0;
    vec3 colour = texture2D(uDataSet, pos).xyz;

    gl_FragColor = vec4(colour, 1.0);
}
`;

class GradientRandom {
    constructor(length) {
        this.numbers = new Array(length).fill(0).map(() => Math.random());
    }

    value() {
        return this.numbers.reduce((s, x) => s + x) / this.numbers.length;
    }

    next() {
        this.numbers.shift();
        this.numbers.push(Math.random());

        return this.value();
    }
}

function main() {
    const canvas = document.getElementById('canvas');
    const gl = createWebGLContext(canvas);

    const twinkleShader = new Shader({
        gl: gl,
        fragment: twinkle,
        uniforms: {
            dataSet: 'sampler2D',
            random: 'float',
            elapsed: 'float',
            scale: 'float'
        },
        consts: {
            someNumber: 'float'
        },
        data: {
            scale: 0.005,
            someNumber: 1.23
        }
    }).chain(new Shader({
        gl: gl,
        fragment: render,
        uniforms: {
            dataSet: 'sampler2D'
        }
    }));

    const dataSet = [];

    for (let i = 0; i < 100; i++) {
        dataSet.push([Math.random(), Math.random(), Math.random()]);
    }

    twinkleShader.createDataTexture({ name: 'dataSet', flipFlop: true, output: true, data: dataSet.flat() });
    
    let rng = new GradientRandom(20);
    
    timeLoop((elapsed) => {
        twinkleShader.data.elapsed = elapsed;
        twinkleShader.data.random = rng.next();

        twinkleShader.render();
        gl.finish();
    });
}

function timeLoop(func) {
    let lastTime = new Date().getTime();
    const loop = () => {
        let time = new Date().getTime();
        func(Math.max(1, time - lastTime));
        lastTime = time;
        setTimeout(loop, 0);
    };
    loop();
}
