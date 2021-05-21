
const droopImage = `
precision mediump float;

varying vec2 vVertexPosition;

uniform sampler2D uSource;

uniform float uImageWidth;
uniform float uImageHeight;

uniform float uSampleRadius;
uniform float uElapsed;
uniform float uFallSpeed;
uniform float uJitterSpeed;
uniform float uThreshold;

uniform vec3 uRandom;

const float PI = 3.14159265359;

vec3 getSample(vec2 pos, float radius) {
    float angle = 0.0;
    float sign = 1.0;
    vec3 sample = vec3(0.0);

    for (int i = 0; i < 4; i++) {
        sample += sign * texture2D(uSource, pos + vec2(radius * cos(angle), radius * sin(angle))).xyz;
        sign *= -1.0;
        angle += PI / 2.0;
    }

    return abs(sample);
}

float avg(vec3 v) {
    return (v.x + v.y + v.z) / 3.0;
}

float jitter(vec2 pos) {
    float rng = ((uRandom.x * pos.x * 29.0) + (uRandom.y  * pos.y * 53.0) + (uRandom.z * pos.x * pos.y * 97.0)); 
    return sin(rng);
}

void main() {
    vec2 pos = (vVertexPosition + vec2(1.0)) / 2.0;

    float radius = uSampleRadius / uImageWidth;
    vec2 samplePos = pos + (vec2(uJitterSpeed * jitter(pos), uFallSpeed) * uElapsed / uImageWidth);
    vec3 sample = getSample(samplePos, radius) + getSample(samplePos, radius * 0.75) 
        + getSample(samplePos, radius * 0.5) + getSample(samplePos, radius * 0.25);
    sample *= 1.0 / 4.0;

    float sampleAvg = avg(sample);

    if (sampleAvg > uThreshold) {
        gl_FragColor = vec4(texture2D(uSource, samplePos).xyz, 1.0);
    } else {
        gl_FragColor = vec4(texture2D(uSource, pos).xyz, 1.0);
    }
}
`;

const renderImage = `
precision mediump float;

varying vec2 vVertexPosition;

uniform sampler2D uSource;

uniform float uScreenWidth;
uniform float uScreenHeight;

uniform float uImageWidth;
uniform float uImageHeight;

void main() {
    vec2 pos = (vVertexPosition + vec2(1.0)) / 2.0;
    pos.y = 1.0 - pos.y;

    pos *= vec2(uScreenWidth / uImageWidth, uScreenHeight / uImageHeight);

    if (abs(uScreenWidth - uImageWidth) < abs(uScreenHeight - uImageHeight)) {
        pos *= uImageHeight / uScreenHeight;
    } else {
        pos *= uImageWidth / uScreenWidth;
    }

    if (pos.x < 0.0 || pos.x > 1.0 || pos.y < 0.0 || pos.y > 1.0) {
        gl_FragColor = vec4(vec3(0.0), 1.0);
    } else {
        gl_FragColor = vec4(texture2D(uSource, pos).xyz, 1.0);
    }
}
`;

const renderEdges = `
precision mediump float;

varying vec2 vVertexPosition;

uniform sampler2D uSource;

uniform float uScreenWidth;
uniform float uScreenHeight;

uniform float uImageWidth;
uniform float uImageHeight;

uniform float uSampleRadius;
uniform float uElapsed;
uniform float uFallSpeed;
uniform float uJitterSpeed;
uniform float uThreshold;

uniform vec3 uRandom;

const float PI = 3.14159265359;

float avg(vec3 v) {
    return (v.x + v.y + v.z) / 3.0;
}

vec3 getSample(vec2 pos, float radius) {
    float angle = 0.0;
    float sign = 1.0;
    vec3 sample = vec3(0.0);

    for (int i = 0; i < 4; i++) {
        sample += sign * texture2D(uSource, pos + vec2(radius * cos(angle), radius * sin(angle))).xyz;
        sign *= -1.0;
        angle += PI / 2.0;
    }

    return abs(sample);
}

void main() {
    vec2 pos = (vVertexPosition + vec2(1.0)) / 2.0;
    pos.y = 1.0 - pos.y;

    pos *= vec2(uScreenWidth / uImageWidth, uScreenHeight / uImageHeight);

    if (abs(uScreenWidth - uImageWidth) < abs(uScreenHeight - uImageHeight)) {
        pos *= uImageHeight / uScreenHeight;
    } else {
        pos *= uImageWidth / uScreenWidth;
    }

    if (pos.x < 0.0 || pos.x > 1.0 || pos.y < 0.0 || pos.y > 1.0) {
        gl_FragColor = vec4(vec3(0.0), 1.0);
    } else {
        float radius = uSampleRadius / uImageWidth;
        vec3 sample = getSample(pos, radius) + getSample(pos, radius * 0.75) 
            + getSample(pos, radius * 0.5) + getSample(pos, radius * 0.25);
        sample *= 1.0 / 4.0;

        float sampleAvg = avg(sample);

        gl_FragColor = vec4(vec3(sampleAvg), 1.0);
    }
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
    const rngs = [new GradientRandom(10), new GradientRandom(10), new GradientRandom(10)];

    const renderImageShader = new Shader({
        gl: gl,
        fragment: renderImage,
        uniforms: {
            source: 'sampler2D',
            imageWidth: 'float',
            imageHeight: 'float',
            screenWidth: 'float',
            screenHeight: 'float'
        },
        data: {
            screenWidth: canvas.clientWidth,
            screenHeight: canvas.clientHeight
        }
    });

    const renderEdgesShader = new Shader({
        gl: gl,
        fragment: renderEdges,
        uniforms: {
            source: 'sampler2D',
            screenWidth: 'float',
            screenHeight: 'float',
            imageWidth: 'float',
            imageHeight: 'float',
            sampleRadius: 'float',
            elapsed: 'float',
            fallSpeed: 'float',
            jitterSpeed: 'float',
            threshold: 'float',
            random: 'vec3'
        },
        data: {
            screenWidth: canvas.clientWidth,
            screenHeight: canvas.clientHeight
        }
    });

    const shader = new Shader({
        gl: gl,
        fragment: droopImage,
        uniforms: {
            source: 'sampler2D',
            imageWidth: 'float',
            imageHeight: 'float',
            sampleRadius: 'float',
            elapsed: 'float',
            fallSpeed: 'float',
            jitterSpeed: 'float',
            threshold: 'float',
            random: 'vec3'
        },
        data: {
            sampleRadius: 3,
            fallSpeed: -0.1,
            jitterSpeed: 0.15,
            threshold: 0.08
        }
    }).chain(renderImageShader);

    shader.createImageTexture({ name: 'source', flipFlop: true, output: true, src: 'woman.jpg', callback: (texture) => {
        shader.data.imageWidth = texture.width;
        shader.data.imageHeight = texture.height;

        shader.data.elapsed = 0;
        shader.data.random = rngs.map((rng) => rng.next());
        shader.render();

        setTimeout(() => {
            timeLoop((elapsed) => {
                shader.data.elapsed = elapsed;
                shader.data.random = rngs.map((rng) => rng.next());
        
                shader.render();
            });
        }, 3000);
    }});
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
