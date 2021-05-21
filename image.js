
const renderImage = `
precision mediump float;

varying vec2 vVertexPosition;

uniform sampler2D uSource;

uniform float uScreenWidth;
uniform float uScreenHeight;

uniform float uImageWidth;
uniform float uImageHeight;

uniform float uSampleRadius;
uniform float uElapsed;
uniform float uRotationSpeed;

const float PI = 3.14159265359;

vec3 getSample(vec2 pos, float radius) {
    float angle = 0.0; //uElapsed * uRotationSpeed;
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

    float radius = uSampleRadius / uScreenWidth;
    // radius += radius * 0.3 * cos((uElapsed + 0.1312452) * uRotationSpeed * 0.9);

    vec3 sample = getSample(pos, radius) + getSample(pos, radius * 0.75) + getSample(pos, radius * 0.5) + getSample(pos, radius * 0.25);
    sample *= 1.0 / 4.0;


    vec3 colour = texture2D(uSource, pos).xyz;

    float mix = 0.0;

    if (pos.x < 0.0 || pos.x > 1.0 || pos.y < 0.0 || pos.y > 1.0) {
            gl_FragColor = vec4(vec3(0.0), 1.0);
        } else {
        gl_FragColor = vec4((colour * mix) + (sample * (1.0 - mix)), 1.0);
    }
}
`;

function main() {
    const canvas = document.getElementById('canvas');

    const shader = new Shader({
        canvas: canvas,
        fragment: renderImage,
        data: {
            screenWidth: canvas.clientWidth,
            screenHeight: canvas.clientHeight,
            sampleRadius: 3,
            rotationSpeed: 0.005
        }
    });

    shader.createImageTexture({ name: 'source', src: 'woman.jpg', callback: (texture) => {
        shader.data.imageWidth = texture.width;
        shader.data.imageHeight = texture.height;
    }});

    let totalElapsed = 0;
    timeLoop((elapsed) => {
        totalElapsed += elapsed;
        shader.data.elapsed = totalElapsed;

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
