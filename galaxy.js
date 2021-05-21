
const renderStars = `
precision mediump float;

varying vec2 vVertexPosition;

uniform sampler2D uStarPositions;
uniform vec2 uScreenSize;
uniform vec3 uRng;

const float PI = 3.14159265359;
const int starPositionsWidth;
const int starPositionsHeight;

float rng(int ix, int iy, vec3 coefs) {
    float x = float(ix);
    float y= float(iy);
    return (sin(uRng.x * x * coefs.x + uRng.y * y * coefs.y + uRng.z * x * y * coefs.z) + 1.0) / 2.0;
}

vec2 rotate(vec2 v, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec2(v.x * c - v.y * s, v.y * c + v.x * s);
}

void main() {
    vec2 pos = (vVertexPosition + vec2(1.0)) / 2.0;
    pos *= uScreenSize;

    vec3 colour = vec3(0.0);

    for (int x = 0; x < starPositionsWidth; x++) {
        for (int y = 0; y < starPositionsHeight; y++) {
            vec4 star = texture2D(uStarPositions, vec2(float(x) / float(starPositionsWidth), float(y) / float(starPositionsHeight)));
            vec2 starPos = star.xy * uScreenSize;
            float radius = star.z;
            float brightness = star.w;

            vec2 diff = pos - starPos;
            float dist = length(diff);

            vec3 starColour = vec3(rng(x, y, vec3(27.0, 97.0, 53.0)), rng(x, y, vec3(113.0, 0.0, 13.0)), rng(x, y, vec3(0.0, 47.0, 67.0)));
            starColour *= vec3(0.9, 0.4, 0.8);

            if (dist < radius) {
                float diff = (radius - dist) / radius; 
                colour += vec3(diff * diff * diff) * starColour;
            }

            if (dist < radius * 2.0) {
                vec2 rdiff = rotate(diff, rng(x, y, vec3(13.0, 19.0, 23.0)) * PI * 2.0);
                float mult = abs(rdiff.y * rdiff.x);
                if (mult < radius) {
                    float diff = (radius - mult) / radius;
                    colour += vec3(diff * diff * diff) * starColour * brightness;
                }
            }
        }
    }

    gl_FragColor = vec4(colour, 1.0);
}
`;

const renderImage = `
precision mediump float;

varying vec2 vVertexPosition;

uniform vec2 uScreenSize;
uniform float uElapsed;
uniform sampler2D uStars;

const float PI = 3.14159265359;
const float bound = 1.0;
const int numberOfStars = 500;

float fmod(float x, float m) {
    return x - (floor(x / m) * m);
}

float getArms(float angle, float radius) {
    return fmod(radius * 0.25 - 5.0 * angle, PI * 2.0) + 8.0 - sqrt(radius);
}

vec3 getStars(vec2 pos) {
    pos /= uScreenSize;

    return texture2D(uStars, pos).xyz;
}

void main() {
    vec2 pos = (vVertexPosition + vec2(1.0)) / 2.0;
    pos *= uScreenSize;

    vec2 off = (uScreenSize * 0.5) - pos; 

    float angle = atan(off.y, off.x) + uElapsed * 1.0;
    float radius = length(off);

    vec3 colour = vec3(0.0);

    colour += getStars(pos);
    float arms = getArms(angle, radius);
    if (-2.0 < arms) {
        colour = (colour * 0.8) + vec3(0.4, 0.7, 0.9) * abs(arms / 6.0);
    } else {
        colour *= 0.5;
    }

    gl_FragColor = vec4(colour, 1.0);
}
`;

function main() {
    const canvas = document.getElementById('canvas');
    const gl = createWebGLContext(canvas);
    const starsWidth = 50,
        starsHeight = 50;

    const starShader = new Shader({
        canvas: canvas,
        fragment: renderStars,
        data: {
            screenSize: [canvas.clientWidth, canvas.clientHeight],
            starPositionsWidth: starsWidth,
            starPositionsHeight: starsHeight,
            rng: [Math.random(), Math.random(), Math.random()]
        }
    });

    starShader.createDataTexture({
        name: 'starPositions',
        format: 'rgba',
        data: (x, y) => [Math.random(), Math.random(), 1.0 + (Math.random() ** 10) * 7, Math.random() ** 3],
        width: starsWidth,
        height: starsHeight
    });


    starShader.createDataTexture({
        name: 'stars',
        output: true,
        width: canvas.clientWidth,
        height: canvas.clientHeight,
        data: new Array(canvas.clientWidth * canvas.clientHeight * 4).fill(0)
    });

    starShader.render();

    const shader = new Shader({
        gl: gl,
        fragment: renderImage,
        data: {
            screenSize: [canvas.clientWidth, canvas.clientHeight * 2.0],
            stars: starShader.data.stars,
            elapsed: 0
        }
    });

    shader.render();

    let totalElapsed = 0;
    timeLoop((elapsed) => {
        totalElapsed += elapsed / 1000;
        shader.data.elapsed = 0;

        shader.render();
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
