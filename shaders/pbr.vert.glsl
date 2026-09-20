#version 300 es
// shaders/pbr.vert.glsl
// Standard Vertex Pipeline for Filament C++ Engine

precision highp float;
precision highp int;

layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUv;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;
uniform mat3 uNormalMatrix;
uniform float uTime;
uniform highp int uMatType;

out vec3 vNormal;
out vec3 vWorldPos;
out vec2 vUv;
out vec3 vLocalPos;

void main() {
    vec3 pos = aPosition;
    vec3 norm = aNormal;
    vLocalPos = aPosition;

    // Vertex animation for fire projectile (uMatType == 22)
    if (uMatType == 22) {
        float t = uTime * 6.5;
        float disp1 = sin(pos.x * 5.0 + t * 3.5) * cos(pos.y * 4.5 - t * 2.8) * 0.07;
        float disp2 = sin(pos.z * 6.0 + t * 4.0) * 0.05;
        float flamePuff = disp1 + disp2;
        float tailStretch = smoothstep(-0.15, 0.85, -pos.z) * 0.22 * (sin(t * 2.2) * 0.2 + 0.8);
        pos += norm * flamePuff;
        pos.z -= tailStretch;
        norm = normalize(norm + vec3(disp1 * 2.0, disp2 * 2.0, -flamePuff) * 0.3);
    }

    vec4 worldPos = uModel * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;
    vNormal = normalize(uNormalMatrix * norm);
    vUv = aUv;
    gl_Position = uProjection * uView * worldPos;
}
