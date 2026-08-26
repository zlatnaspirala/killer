#version 300 es
// shaders/pbr.frag.glsl
// Cook-Torrance GGX Specular Microfacet BRDF Fragment Shader
// Filament Standard Lighting Model (GLES 3.0 / WebGL 2.0)

precision highp float;

in vec3 vNormal;
in vec3 vWorldPos;
in vec2 vUv;

uniform vec3 uBaseColor;
uniform float uRoughness;
uniform float uMetallic;
uniform vec3 uCamPos;
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform vec3 uFillLightDir;
uniform vec3 uFillLightColor;
uniform float uTime;

out vec4 fragColor;

const float PI = 3.141592653589793;

// GGX / Trowbridge-Reitz Normal Distribution Function
float DistributionGGX(vec3 N, vec3 H, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH = max(dot(N, H), 0.0);
    float NdotH2 = NdotH * NdotH;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    return a2 / max(PI * denom * denom, 0.00001);
}

// Schlick-GGX Geometry Shadowing Function
float GeometrySchlickGGX(float NdotV, float roughness) {
    float r = (roughness + 1.0);
    float k = (r * r) / 8.0;
    return NdotV / (NdotV * (1.0 - k) + k);
}

float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx2 = GeometrySchlickGGX(NdotV, roughness);
    float ggx1 = GeometrySchlickGGX(NdotL, roughness);
    return ggx1 * ggx2;
}

// Fresnel-Schlick Approximation with Metallic Conductor blending
vec3 FresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(uCamPos - vWorldPos);
    
    // Dielectric F0 (0.04) vs Metallic Conductor BaseColor
    vec3 F0 = mix(vec3(0.04), uBaseColor, uMetallic);
    vec3 Lo = vec3(0.0);

    // 1. Direct Key Light Evaluation
    vec3 L1 = normalize(uLightDir);
    vec3 H1 = normalize(V + L1);
    float NdotL1 = max(dot(N, L1), 0.0);

    if (NdotL1 > 0.0) {
        float NDF = DistributionGGX(N, H1, max(uRoughness, 0.04));
        float G = GeometrySmith(N, V, L1, max(uRoughness, 0.04));
        vec3 F = FresnelSchlick(max(dot(H1, V), 0.0), F0);

        vec3 numerator = NDF * G * F;
        float denominator = 4.0 * max(dot(N, V), 0.0) * NdotL1 + 0.0001;
        vec3 specular = numerator / denominator;

        vec3 kS = F;
        vec3 kD = (vec3(1.0) - kS) * (1.0 - uMetallic);

        Lo += (kD * uBaseColor / PI + specular) * uLightColor * NdotL1;
    }

    // 2. Secondary Fill Light Evaluation
    vec3 L2 = normalize(uFillLightDir);
    vec3 H2 = normalize(V + L2);
    float NdotL2 = max(dot(N, L2), 0.0);

    if (NdotL2 > 0.0) {
        float NDF2 = DistributionGGX(N, H2, max(uRoughness, 0.04));
        float G2 = GeometrySmith(N, V, L2, max(uRoughness, 0.04));
        vec3 F2 = FresnelSchlick(max(dot(H2, V), 0.0), F0);

        vec3 specular2 = (NDF2 * G2 * F2) / (4.0 * max(dot(N, V), 0.0) * NdotL2 + 0.0001);
        vec3 kS2 = F2;
        vec3 kD2 = (vec3(1.0) - kS2) * (1.0 - uMetallic);

        Lo += (kD2 * uBaseColor / PI + specular2) * uFillLightColor * NdotL2 * 0.45;
    }

    // 3. Ambient IBL Approximation (Filament Hemisphere)
    vec3 ambient = vec3(0.04) * uBaseColor;
    vec3 color = ambient + Lo;

    // HDR Reinhard Tone Mapping & Gamma Correction
    color = color / (color + vec3(1.0));
    color = pow(color, vec3(1.0 / 2.2));

    fragColor = vec4(color, 1.0);
}
