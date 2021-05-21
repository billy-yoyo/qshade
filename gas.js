
const gasSimulationShader = `
precision mediump float;

varying vec2 vVertexPosition;

uniform sampler2D uGrid;
uniform float uSampleRadius;
uniform float uRestDensity;
uniform float uElapsed;
uniform float uGasCoef;
uniform vec2 uScreen;
uniform vec2 uGravity;
uniform float uBounceRatio;
uniform float uViscosity;

const int gridWidth;
const int gridHeight;

float calculateSmoothing(float size) {
    if (size <= uSampleRadius) {
        float diff = uSampleRadius - size;
        return diff * diff * diff;
    } else {
        return 0.0;
    }
}

vec4 getParticle(int x, int y) {
    return texture2D(uGrid, vec2(float(x) / float(gridWidth), float(y) / float(gridHeight)));
}

void main() {
    vec2 pos = (vVertexPosition + vec2(1.0)) / 2.0;
    vec4 particle = texture2D(uGrid, pos);

    vec2 gradient = vec2(0.0);
    vec2 visc = vec2(0.0);
    float totalDensity = 0.0;
    
    for (int x = 0; x < gridWidth; x++) {
        for (int y = 0; y < gridHeight; y++) {
            vec4 neighbour = getParticle(x, y);
            vec2 dir = neighbour.xy - particle.xy;
            
            float size = length(dir);
            if (size > 0.0) {
                float density = calculateSmoothing(size);
                
                gradient += -1.0 * dir * density / size;
                totalDensity += density;

                vec2 vdiff = neighbour.zw - particle.zw;
                visc += vdiff * density;
            }
        }
    }
    
    if (totalDensity > uRestDensity) {
        gradient *= uRestDensity / totalDensity;
        visc *= uRestDensity / totalDensity;
    }

    vec2 velocity = particle.zw + (uGasCoef * gradient * uElapsed) + (uGravity * uElapsed) + (uViscosity * visc);
    vec2 particlePos = particle.xy + (velocity * uElapsed);

    if (particlePos.x < 0.0) {
        particlePos.x = 0.0;
        velocity.x *= -uBounceRatio;
    } else if (particlePos.x > uScreen.x) {
        particlePos.x = uScreen.x;
        velocity.x *= -uBounceRatio;
    }

    if (particlePos.y < 0.0) {
        particlePos.y = 0.0;
        velocity.y *= -uBounceRatio;
    } else if (particlePos.y > uScreen.y) {
        particlePos.y = uScreen.y;
        velocity.y *= -uBounceRatio;
    }

    gl_FragColor = vec4(particlePos, velocity); 
}

`;

const gasRenderShader = `
precision mediump float;

varying vec2 vVertexPosition;

uniform sampler2D uGrid;
uniform float uRenderRadius;
uniform float uRenderThreshold;
uniform float uRenderScaling;
uniform vec2 uScreen;

const int gridWidth;
const int gridHeight;

float calculateSmoothing(float size) {
    if (size <= uRenderRadius) {
        float diff = uRenderRadius - size;
        return diff * diff;
    } else {
        return 0.0;
    }
}

vec4 getParticle(int x, int y) {
    return texture2D(uGrid, vec2(float(x) / float(gridWidth), float(y) / float(gridHeight)));
}

void main() {
    vec2 pos = (vVertexPosition + vec2(1.0)) / 2.0;
    pos *= uScreen;
    float totalDensity = 0.0;
    
    for (int x = 0; x < gridWidth; x++) {
        for (int y = 0; y < gridHeight; y++) {
            vec4 neighbour = getParticle(x, y);
            vec2 dir = neighbour.xy - pos;
            
            float size = length(dir);
            float density = calculateSmoothing(size);
            totalDensity += density;
        }
    }

    if (totalDensity > uRenderThreshold) {
        float gs = (totalDensity - uRenderThreshold) / uRenderScaling;
        if (gs > 1.0) {
            gs = 1.0;
        }
        gl_FragColor = vec4(gs, 0.0, 0.0, 1.0);
    } else {
        gl_FragColor = vec4(vec3(0.0), 1.0);
    }
}
`;

function main() {
    const canvas = document.getElementById('canvas');
    const gl = createWebGLContext(canvas);
    const gridWidth = 30,
        gridHeight = 30;

    const shader = new Shader({
        gl: gl,
        fragment: gasSimulationShader,
        data: {
            screen: [ canvas.clientWidth, canvas.clientHeight ],
            sampleRadius: 40,
            renderRadius: 80,
            renderThreshold: 5000,
            renderScaling: 100,
            gridWidth: gridWidth,
            gridHeight: gridHeight,
            restDensity: 10,
            bounceRatio: 0.8,
            gasCoef: 100,
            viscosity: 0.0001,
            gravity: [ 0, -300 ]
        }
    });

    shader.chain(new Shader({
        canvas: canvas,
        fragment: gasRenderShader,
        data: {
            gridWidth: gridWidth,
            gridHeight: gridHeight
        }
    }));

    let particles = [];
    for (let x = 0; x < gridWidth; x++) {
        for (let y = 0; y < gridHeight; y++) {
            particles.push(x * 6);
            particles.push(canvas.clientHeight - y * 6);
            particles.push(0);
            particles.push(0);
        }
    }

    shader.createDataTexture({
        name: 'grid', 
        flipFlop: true, 
        output: true,
        data: particles, 
        width: gridWidth, 
        height: gridHeight 
    });

    timeLoop((elapsed) => {
        shader.data.elapsed = elapsed / 1000.0;

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
