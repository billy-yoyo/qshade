

const sandUpdateShader = `
precision mediump float;

varying vec2 vVertexPosition;

uniform sampler2D uSand;

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

bool isEmpty(vec4 particle) {
    return particle.x < 0.1;
}

bool canFall(vec2 pos, int xOff) {
    vec2 newPos;
    for (int i = 0; i < GRID_HEIGHT; i++) {
        newPos = getPos(pos, xOff, i);

        if (newPos.y > 1.0) {
            break;
        }

        if (isEmpty(texture2D(uSand, newPos))) {
            return true;
        }
    }

    return false;
}

void main() {
    vec2 pos = (vVertexPosition + vec2(1.0)) / 2.0;
    vec4 particle = texture2D(uSand, pos);
    vec4 particleAbove = getParticle(pos, 0, -1);

    // is particle empty?
    if (isEmpty(particle)) {
        if (pos.y < 0.1 && 0.3 < pos.x && pos.x < 0.31) {
            gl_FragColor = vec4(1.0);
        } else if (!isEmpty(particleAbove)) {
            gl_FragColor = particleAbove;
        } else if (isEmpty(getParticle(pos, 0, 1))) {
            vec4 particleLeft = getParticle(pos, -1, 0);
            if (!isEmpty(particleLeft) && !canFall(pos, -1)) {
                gl_FragColor = particleLeft;
            } else {
                vec4 particleRight = getParticle(pos, 1, 0);
                if (!isEmpty(particleRight) && !canFall(pos, 1) && (!isEmpty(getParticle(pos, 2, 0)) || !isEmpty(getParticle(pos, 2, 1)))) {
                    gl_FragColor = particleRight;
                } else {
                    gl_FragColor = particle;
                }
            }
        } else {
            gl_FragColor = particle;
        }
    // is particle the top of a stack?
    } else if(isEmpty(particleAbove) || isOOB(pos, 0, -1)) {
        // particle should fall down
        if (canFall(pos, 0)) {
            gl_FragColor = vec4(0.0);
        // check for topple
        } else if (isEmpty(getParticle(pos, 1, 0)) && isEmpty(getParticle(pos, 1, 1))) {
            gl_FragColor = vec4(0.0);
        // can topple to the left
        } else if (isEmpty(getParticle(pos, -1, 0)) && isEmpty(getParticle(pos, -1, 1))) {
            gl_FragColor = vec4(0.0);
        } else {
            gl_FragColor = particle;
        }
    } else {
        gl_FragColor = particle;
    }
}
`;

const sandRenderShader = `
precision mediump float;

varying vec2 vVertexPosition;

uniform sampler2D uSand;

uniform vec2 uScreen;
uniform vec2 uCell;
uniform vec2 uGrid;

void main() {
    vec2 pos = (vVertexPosition + vec2(1.0)) / 2.0;
    pos = floor(pos * uScreen / uCell);

    if (pos.x >= 0.0 && pos.x < uGrid.x && pos.y >= 0.0 && pos.y < uGrid.y) {
        vec4 particle = texture2D(uSand, (pos / uGrid) * vec2(1.0, -1.0) + vec2(0.0, 1.0));

        if (particle.x > 0.1) {
            gl_FragColor = vec4(1.0);
        } else {
            gl_FragColor = vec4(vec3(0.0), 1.0);
        }
    } else {
        gl_FragColor = vec4(vec3(0.0), 1.0);
    }
}   
`;

function main() {
    const canvas = document.getElementById('canvas');

    const gridDims = { width: 100, height: 60 };
    const cellDims = { width: 3, height: 3 };

    const shader = new Shader({
        canvas: canvas,
        fragment: sandUpdateShader,
        data: {
            GRID_WIDTH: gridDims.width,
            GRID_HEIGHT: gridDims.height
        }
    });
    
    shader.chain(new Shader({
        canvas: canvas,
        fragment: sandRenderShader,
        data: {
            grid: [ gridDims.width, gridDims.height ]
        }
    }));

    let particles = [];

    for (let x = 0; x < gridDims.width; x++) {
        for (let y = 0; y < gridDims.height; y++) {
            particles.push(Math.random() > 0.5 ? 1 : 0);
            particles.push(0);
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

    timeLoop(() => {
        shader.data.screen = [ canvas.clientWidth, canvas.clientHeight ];
        shader.data.cell = [ cellDims.width, cellDims.height ];

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