

const sandUpdateShader = `
precision mediump float;

varying vec2 vVertexPosition;

uniform sampler2D uSand;
uniform float uElapsed;

const ivec2 REPULSE_RING;
const float REPULSE_STRENGTH;

const ivec2 ATTRACT_RING;
const float ATTRACT_STRENGTH;

const int GRID_WIDTH;
const int GRID_HEIGHT;

const vec2 GRID = vec2(float(GRID_WIDTH), float(GRID_HEIGHT));

vec2 getPos(vec2 pos, int xOff, int yOff) {
    return pos + (vec2(float(xOff), float(yOff)) / GRID);
}

vec4 getParticle(vec2 pos, int xOff, int yOff) {
    return texture2D(uSand, getPos(pos, xOff, yOff));
}

bool isOOB(vec2 pos, int xOff, int yOff) {
    vec2 newPos = getPos(pos, xOff, yOff);
    return newPos.x < 0.0 || newPos.x > 1.0 || newPos.y < 0.0 || newPos.y > 1.0;
}

vec3 safenormal(vec3 v) {
    if (length(v) < 0.001) {
        return vec3(0.0);
    } else {
        return normalize(v);
    }
}

vec3 getState(vec2 pos) {
    vec3 repulseAvg = vec3(0);
    float repulseCount = 0.0;
    for (int ox = -REPULSE_RING.x; ox < REPULSE_RING.x + 1; ox++) {
        for (int oy = -REPULSE_RING.x; oy < REPULSE_RING.x + 1; oy++) {
            if (!isOOB(pos, ox, oy)) {
                float dx = float(ox) + 0.5;
                float dy = float(oy) + 0.5;
                float dist = sqrt((dx * dx) + (dy * dy));
                
                if (float(REPULSE_RING.x) <= dist && dist >= float(REPULSE_RING.y)) {
                    vec4 particle = getParticle(pos, ox, oy);
                    repulseAvg = repulseAvg + particle.xyz;
                    repulseCount = repulseCount + 1.0;
                }
            }
        }
    }
    if (repulseCount > 0.0) {
        repulseAvg = repulseAvg / repulseCount;
    }

    vec3 attractAvg = vec3(0);
    float attractCount = 0.0;
    for (int ox = -ATTRACT_RING.x; ox < ATTRACT_RING.x + 1; ox++) {
        for (int oy = -ATTRACT_RING.x; oy < ATTRACT_RING.x + 1; oy++) {
            if (!isOOB(pos, ox, oy)) {
                float dx = float(ox) + 0.5;
                float dy = float(oy) + 0.5;
                float dist = sqrt((dx * dx) + (dy * dy));
                
                if (float(ATTRACT_RING.x) <= dist && dist >= float(ATTRACT_RING.y)) {
                    vec4 particle = getParticle(pos, ox, oy);
                    attractAvg = attractAvg + particle.xyz;
                    attractCount = attractCount + 1.0;
                }
            }
        }
    }
    if (attractCount > 0.0) {
        attractAvg = attractAvg / attractCount;
    }

    vec3 curState = getParticle(pos, 0, 0).xyz;
    
    vec3 repulseDir = safenormal(repulseAvg - curState) * -0.01 * REPULSE_STRENGTH * uElapsed;
    vec3 attractDir = safenormal(attractAvg - curState) * 0.01 * ATTRACT_STRENGTH * uElapsed;

    return curState + attractDir + repulseDir;
}

float clampf(float x) {
    if (x < 0.0) {
        return 0.0;
    } else if (x > 1.0) {
        return 1.0;
    } else {
        return x;
    }
}

vec3 clamp(vec3 v) {
    return vec3(clampf(v.x), clampf(v.y), clampf(v.z));
}

void main() {
    vec2 pos = (vVertexPosition + vec2(1.0)) / 2.0;
    gl_FragColor = vec4(clamp(getState(pos)), 0.0);
}
`;

const sandRenderShader = `
precision mediump float;

varying vec2 vVertexPosition;

uniform sampler2D uSand;

uniform vec2 uScreen;
uniform vec2 uCell;
uniform vec2 uGrid;

const int BLUR_RADIUS = 3;

vec2 getPos(vec2 pos, int xOff, int yOff) {
    return (pos + vec2(float(xOff), float(yOff))) / uGrid;
}

vec4 getParticle(vec2 pos, int xOff, int yOff) {
    return texture2D(uSand, getPos(pos, xOff, yOff));
}

bool isOOB(vec2 pos, int xOff, int yOff) {
    vec2 newPos = getPos(pos, xOff, yOff);
    return newPos.x < 0.0 || newPos.x > 1.0 || newPos.y < 0.0 || newPos.y > 1.0;
}

vec3 getStateAvg(vec2 pos) {
    vec3 stateAvg = vec3(0);
    float count = 0.0;
    for (int ox = -BLUR_RADIUS; ox < BLUR_RADIUS + 1; ox++) {
        for (int oy = -BLUR_RADIUS; oy < BLUR_RADIUS + 1; oy++) {
            if (!isOOB(pos, ox, oy)) {
                float dist = length(vec2(float(ox), float(oy)));
                float coef = exp(-dist * 0.8);
                vec4 particle = getParticle(pos, ox, oy);
                stateAvg = stateAvg + (particle.xyz * coef);
                count = count + coef;
            }
        }
    }
    if (count > 0.0) {
        stateAvg = stateAvg / count;
    }
    return stateAvg;
}

void main() {
    vec2 pos = (vVertexPosition + vec2(1.0)) / 2.0;
    pos = floor(pos * uScreen / uCell);

    if (pos.x >= 0.0 && pos.x < uGrid.x && pos.y >= 0.0 && pos.y < uGrid.y) {
        vec3 state = getStateAvg(pos);

        gl_FragColor = vec4(state.xyz, 1.0);
    } else {
        gl_FragColor = vec4(vec3(0.0), 1.0);
    }
}   
`;

function main() {
    const canvas = document.getElementById('canvas');

    const cellDims = { width: 3, height: 3 };
    const gridDims = { width: Math.floor(canvas.width / cellDims.width), height: Math.floor(canvas.height / cellDims.height) };

    const shader = new Shader({
        canvas: canvas,
        fragment: sandUpdateShader,
        data: {
            GRID_WIDTH: gridDims.width,
            GRID_HEIGHT: gridDims.height,
            REPULSE_RING: [5, 2],
            REPULSE_STRENGTH: 0,
            ATTRACT_RING: [4, 0],
            ATTRACT_STRENGTH: 1
        }
    });
    
    shader.chain(new Shader({
        canvas: canvas,
        fragment: sandRenderShader,
        data: {
            grid: [ gridDims.width, gridDims.height ],
            GRID_WIDTH: gridDims.width,
            GRID_HEIGHT: gridDims.height,
        }
    }));

    let particles = [];

    for (let x = 0; x < gridDims.width; x++) {
        for (let y = 0; y < gridDims.height; y++) {
            particles.push(Math.random());
            particles.push(Math.random());
            particles.push(0);
            particles.push(0);
        }
    }

    console.log(particles.length);

    shader.createDataTexture({ 
        name: 'sand', 
        flipFlop: true, 
        output: true,
        data: particles, 
        width: gridDims.width, 
        height: gridDims.height 
    });

    timeLoop((elapsed) => {
        shader.data.screen = [ canvas.clientWidth, canvas.clientHeight ];
        shader.data.cell = [ cellDims.width, cellDims.height ];
        shader.data.elapsed = elapsed;

        shader.render();
    }, 20);
}

function timeLoop(func, delay) {
    let lastTime = new Date().getTime();
    const loop = () => {
        let time = new Date().getTime();
        func(Math.max(1, time - lastTime));
        lastTime = time;
        setTimeout(loop, delay);
    };
    loop();
}