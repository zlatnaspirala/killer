#version 300 es
// shaders/pbr.frag.glsl
// Cook-Torrance GGX Specular Microfacet BRDF with Procedural PBR Texture Synthesizer
// Filament Lighting Model & Material Profiling (GLES 3.0 / WebGL 2.0)

precision highp float;

#define PI 3.14159265358979323846

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

// Filament Advanced Material Controls
uniform int uMatType;        // 0..15 material type (Wood, Rock, Metal, Marble, etc.)
uniform float uNoiseScale;   // texture frequency
uniform float uClearCoat;    // clearcoat reflection layer
uniform float uAnisotropy;   // anisotropic specular highlight
uniform float uBumpStrength; // procedural bump normal intensity
uniform int uUseTexMaps;     // 1 to sample 2D texture samplers

uniform sampler2D uAlbedoMap;
uniform sampler2D uNormalMap;
uniform sampler2D uPbrMap;      // R: Roughness, G: Metallic, B: Ambient Occlusion
uniform sampler2D uEmissiveMap;

out vec4 fragColor;

// -------------------------------------------------------------
// NOISE & PROCEDURAL TEXTURE SYNTHESIS PRIMITIVES
// -------------------------------------------------------------
float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
}

vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
}

float noise2d(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash12(i);
    float b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0));
    float d = hash12(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float noise3d(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash13(i);
    float b = hash13(i + vec3(1.0, 0.0, 0.0));
    float c = hash13(i + vec3(0.0, 1.0, 0.0));
    float d = hash13(i + vec3(1.0, 1.0, 0.0));
    float e = hash13(i + vec3(0.0, 0.0, 1.0));
    float f1 = hash13(i + vec3(1.0, 0.0, 1.0));
    float g = hash13(i + vec3(0.0, 1.0, 1.0));
    float h = hash13(i + vec3(1.0, 1.0, 1.0));
    return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y),
               mix(mix(e, f1, f.x), mix(g, h, f.x), f.y), f.z);
}

float fbm3d(vec3 p, int octaves) {
    float v = 0.0;
    float a = 0.5;
    vec3 shift = vec3(100.0);
    for (int i = 0; i < 4; ++i) {
        if (i >= octaves) break;
        v += a * noise3d(p);
        p = p * 2.02 + shift;
        a *= 0.5;
    }
    return v;
}

vec2 voronoi2d(vec2 x) {
    vec2 n = floor(x);
    vec2 f = fract(x);
    vec2 mg, mr;
    float md = 8.0;
    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 o = hash22(n + g);
            vec2 r = g + o - f;
            float d = dot(r, r);
            if (d < md) {
                md = d;
                mr = r;
                mg = g;
            }
        }
    }
    return vec2(sqrt(md), hash12(n + mg));
}

// Tangent space normal perturbation from analytical height gradient
vec3 perturbNormal(vec3 N, vec3 pos, float height, float bumpScale) {
    vec3 dPdx = dFdx(pos);
    vec3 dPdy = dFdy(pos);
    float dhdx = dFdx(height);
    float dhdy = dFdy(height);
    vec3 r1 = cross(dPdy, N);
    vec3 r2 = cross(N, dPdx);
    float det = dot(dPdx, r1);
    if (abs(det) < 1e-7) return N;
    vec3 grad = (r1 * dhdx + r2 * dhdy) / det;
    return normalize(N - grad * bumpScale);
}

// -------------------------------------------------------------
// BRDF LIGHTING MATHEMATICS
// -------------------------------------------------------------
float DistributionGGX(float NoH, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float d = (NoH * a2 - NoH) * NoH + 1.0;
    return a2 / (PI * d * d + 1e-7);
}

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

vec3 FresnelSchlick(float VoH, vec3 f0) {
    return f0 + (vec3(1.0) - f0) * pow(clamp(1.0 - VoH, 0.0, 1.0), 5.0);
}

void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(uCamPos - vWorldPos);
    float NoV_base = abs(dot(N, V)) + 1e-5;

    // Use triplanar / UV coordinates for uniform scale across all 3D geometries
    vec3 p = vWorldPos;
    float scale = (uNoiseScale > 0.1) ? uNoiseScale : 18.0;
    vec2 uv = vUv * scale;
    if (length(vUv) < 0.001) {
        uv = (abs(N.y) > 0.6) ? p.xz * scale : ((abs(N.x) > 0.6) ? p.yz * scale : p.xy * scale);
    }

    vec3 albedo = uBaseColor;
    float roughness = clamp(uRoughness, 0.04, 1.0);
    float metallic = clamp(uMetallic, 0.0, 1.0);
    float clearCoat = uClearCoat;
    float clearCoatRoughness = 0.08;
    vec3 emissive = vec3(0.0);
    float ao = 1.0;
    float bumpScale = (uBumpStrength > 0.0 ? uBumpStrength : 1.2) * 0.035;

    // -------------------------------------------------------------
    // PROCEDURAL MATERIAL SYNTHESIZERS (uMatType)
    // -------------------------------------------------------------
    if (uMatType == 1) {
        // 1. SLEEK POLISHED MAHOGANY WOOD (NOISE-FREE)
        vec3 woodP = p * (scale * 0.15);
        float ringDist = length(woodP.xz) * 1.5 + sin(woodP.y * 3.0) * 0.5;
        float ring = sin(ringDist * 6.28) * 0.5 + 0.5;
        float grain = sin(woodP.x * 40.0) * sin(woodP.y * 10.0) * 0.5 + 0.5;

        vec3 darkWalnut = vec3(0.18, 0.08, 0.04);
        vec3 lightAmber = vec3(0.48, 0.24, 0.12);
        vec3 woodColor = mix(darkWalnut, lightAmber, ring * 0.7 + grain * 0.3);
        albedo = woodColor * (uBaseColor / vec3(0.35, 0.18, 0.09));

        N = perturbNormal(N, vWorldPos, ring * 0.1, bumpScale * 0.5);
        roughness = mix(0.12, 0.28, ring);
        metallic = 0.0;
        clearCoat = 0.95;
    }
    else if (uMatType == 2) {
        // 2. SCI-FI OBSIDIAN WITH GLOWING ENERGY CRACKS
        vec3 rockP = p * (scale * 0.2);
        float crackPattern = sin(rockP.x * 2.5 + sin(rockP.y * 2.0 + uTime)) * 
                             cos(rockP.z * 2.5 + cos(rockP.x * 2.0 - uTime));
        float crack = smoothstep(0.72, 0.98, abs(crackPattern));

        vec3 basaltColor = vec3(0.08, 0.09, 0.11);
        vec3 energyGlow = vec3(1.0, 0.35, 0.05);

        albedo = mix(basaltColor, energyGlow * 0.3, crack);
        emissive = energyGlow * crack * (3.0 + sin(uTime * 3.0) * 1.5);

        N = perturbNormal(N, vWorldPos, crackPattern * 0.2, bumpScale * 1.2);
        roughness = mix(0.85, 0.15, crack);
        metallic = 0.1;
    }
    else if (uMatType == 3) {
        // 3. SLEEK AEROSPACE POLISHED TITANIUM
        float brushLines = sin(vWorldPos.y * 150.0) * 0.5 + 0.5;
        vec3 titaniumBase = vec3(0.85, 0.88, 0.92);
        
        albedo = mix(titaniumBase * 0.9, titaniumBase * 1.1, brushLines * 0.1);
        albedo *= uBaseColor;
        N = perturbNormal(N, vWorldPos, brushLines * 0.05, bumpScale * 0.2);
        roughness = clamp(uRoughness - 0.1, 0.05, 0.8);
        metallic = 0.98;
    }
    else if (uMatType == 4) {
        // 4. SCI-FI JADE MARBLE WITH GLOWING CYBER-VEINS
        vec3 marbleP = p * (scale * 0.2);
        float veins = sin(marbleP.x * 3.0 + cos(marbleP.y * 3.0 + uTime * 0.5)) * 
                      cos(marbleP.z * 3.0 + sin(marbleP.x * 2.0 - uTime * 0.5));
        float veinMask = smoothstep(0.85, 0.99, abs(veins));

        vec3 marbleWhite = vec3(0.92, 0.95, 0.98);
        vec3 cyanGlow = vec3(0.0, 0.8, 1.0);

        albedo = mix(marbleWhite, cyanGlow * 0.2, veinMask);
        emissive = cyanGlow * veinMask * (2.5 + cos(uTime * 2.0) * 1.0);

        N = perturbNormal(N, vWorldPos, veins * 0.05, bumpScale * 0.3);
        roughness = mix(0.08, 0.3, veinMask);
        metallic = 0.05;
        clearCoat = 0.98;
    }
    else if (uMatType == 5) {
        // 5. PERFECT MATHEMATICAL TWILL CARBON FIBER
        vec2 cUv = uv * 4.0;
        vec2 cell = fract(cUv);
        vec2 id = floor(cUv);
        float pattern = mod(id.x + id.y, 2.0);
        float strand = (pattern > 0.5) ? sin(cell.x * PI) : sin(cell.y * PI);
        strand = strand * 0.5 + 0.5;

        vec3 carbonWeave = mix(vec3(0.05, 0.06, 0.08), vec3(0.18, 0.20, 0.24), strand);
        albedo = carbonWeave * uBaseColor;

        N = perturbNormal(N, vWorldPos, strand * 0.1, bumpScale * 0.8);
        roughness = 0.15;
        metallic = 0.7;
        clearCoat = 0.98;
    }
    else if (uMatType == 6) {
        // 6. DAMASCUS TEMPERED STEEL WITH CHROMA GLOW
        vec3 damascusP = p * (scale * 0.25);
        float wave = sin(damascusP.x * 8.0 + sin(damascusP.y * 6.0 + uTime)) * 
                     cos(damascusP.z * 8.0 + cos(damascusP.x * 5.0 - uTime));
        float pattern = sin(wave * 5.0) * 0.5 + 0.5;

        vec3 deepBlue = vec3(0.05, 0.12, 0.35);
        vec3 steelSilver = vec3(0.85, 0.88, 0.92);
        vec3 goldAccent = vec3(0.85, 0.65, 0.25);

        vec3 metalColor = mix(deepBlue, steelSilver, pattern);
        if (pattern > 0.8) metalColor = mix(metalColor, goldAccent, 0.5);

        albedo = metalColor * uBaseColor;
        emissive = deepBlue * (1.0 - pattern) * 0.5;

        N = perturbNormal(N, vWorldPos, wave * 0.1, bumpScale * 0.6);
        roughness = mix(0.1, 0.35, pattern);
        metallic = 0.95;
    }
    else if (uMatType == 7) {
        // 7. SUPERFLUID LAVA FLOW & FLAME PLASMA (NOISE-FREE / HIGH-PERFORMANCE)
        vec2 lavaUV = uv * 0.15;
        float t = uTime * 0.6;
        float w1 = sin(lavaUV.x * 4.0 + t) + cos(lavaUV.y * 3.0 - t);
        float w2 = sin(lavaUV.y * 5.0 - t * 1.3) + cos(lavaUV.x * 4.0 + t * 0.8);
        vec2 warpedUV = lavaUV + vec2(sin(w1 + t), cos(w2 - t)) * 0.4;
        
        float fluidPattern = sin(warpedUV.x * 6.0 + t) * cos(warpedUV.y * 6.0 - t) * 0.5 + 0.5;
        float crustMask = smoothstep(0.4, 0.72, fluidPattern);

        vec3 basaltCrust = vec3(0.04, 0.03, 0.04);
        vec3 lavaYellow  = vec3(1.2, 0.92, 0.1);
        vec3 lavaOrange  = vec3(1.1, 0.32, 0.02);
        vec3 lavaRed     = vec3(0.7, 0.04, 0.0);

        vec3 fluidColor = mix(lavaYellow, lavaOrange, fluidPattern);
        fluidColor = mix(fluidColor, lavaRed, sin(uTime * 2.0 + w1) * 0.3 + 0.3);

        albedo = mix(fluidColor, basaltCrust, crustMask);
        emissive = fluidColor * (1.0 - crustMask) * (3.5 + sin(uTime * 2.0) * 1.5);

        N = perturbNormal(N, vWorldPos, fluidPattern * 0.3, bumpScale * 1.5);
        roughness = mix(0.1, 0.95, crustMask);
        metallic = 0.0;
    }
    else if (uMatType == 8) {
        // 8. FLAWLESS METALLIC CANDY CAR PAINT
        float fresnelRim = pow(1.0 - NoV_base, 3.0);
        vec3 candyColor = uBaseColor;
        vec3 rimColor = vec3(1.0, 0.9, 0.95);

        albedo = mix(candyColor, rimColor, fresnelRim * 0.4);
        roughness = 0.08;
        metallic = 0.9;
        clearCoat = 1.0;
        clearCoatRoughness = 0.02;
    }
    else if (uMatType == 9) {
        // 9. HIGH-TECH HOLOGRAPHIC CHROMATIC GLASS
        float fresnelGlass = pow(1.0 - NoV_base, 3.5);
        vec3 redChannel = vec3(0.95, 0.05, 0.1) * pow(NoV_base, 1.5);
        vec3 blueChannel = vec3(0.05, 0.3, 0.95) * pow(1.0 - NoV_base, 2.0);
        vec3 glassBody = mix(vec3(0.9, 0.98, 1.0), redChannel + blueChannel, 0.4);

        albedo = mix(glassBody * 0.2, glassBody, fresnelGlass);
        emissive = (redChannel * 0.3 + blueChannel * 0.6) * (1.5 + sin(uTime) * 0.5);
        roughness = 0.02;
        metallic = 0.0;
        clearCoat = 1.0;
    }
    else if (uMatType == 10) {
        // 10. LUXURY VELVET SHEEN CLOTH
        float sheenRim = pow(1.0 - NoV_base, 2.5);
        vec3 sheenCol = vec3(0.95, 0.35, 0.65);
        albedo = uBaseColor + sheenCol * sheenRim * 0.8;
        roughness = 0.85;
        metallic = 0.0;
    }
    else if (uMatType == 11) {
        // 11. QUANTUM DIGITAL HOLOGRAPHIC GRID
        float scanline = sin(vWorldPos.y * 30.0 - uTime * 6.0) * 0.5 + 0.5;
        scanline = pow(scanline, 5.0);
        float gridX = step(0.95, fract(vWorldPos.x * 5.0));
        float gridZ = step(0.95, fract(vWorldPos.z * 5.0));
        float grid = max(gridX, gridZ);

        float holoFresnel = pow(1.0 - NoV_base, 2.2);
        vec3 holoColor = vec3(0.0, 0.95, 0.72);

        emissive = holoColor * (holoFresnel * 2.0 + scanline * 1.5 + grid * 1.2 + 0.3);
        albedo = holoColor * 0.1;
        roughness = 0.05;
        metallic = 0.0;
    }
    else if (uMatType == 12) {
        // 12. SUPERCHARGED COHERENT LASER NEON
        float pulse = sin(uTime * 5.0) * 0.12 + 0.88;
        float edgeGlow = pow(1.0 - NoV_base, 2.5);
        
        vec3 neonColor = uBaseColor;
        vec3 coreColor = vec3(1.0, 1.0, 1.0);
        
        emissive = mix(neonColor * 4.0, coreColor * 5.0, edgeGlow * 0.5) * pulse;
        albedo = neonColor;
        roughness = 0.03;
        metallic = 0.0;
    }
    else if (uMatType == 13) {
        // 13. SCI-FI RIPPLE FLUID / ENERGY WATER
        vec2 wUv = uv * 0.15;
        float t = uTime * 1.5;
        float wave1 = sin(wUv.x * 5.0 + wUv.y * 3.0 + t);
        float wave2 = cos(wUv.x * 4.0 - wUv.y * 6.0 - t * 0.8);
        float totalWaves = (wave1 + wave2) * 0.5;

        vec3 deepWater = vec3(0.02, 0.22, 0.42);
        vec3 energyTeal = vec3(0.0, 0.9, 0.85);

        albedo = mix(deepWater, energyTeal * 0.4, totalWaves * 0.5 + 0.5);
        emissive = energyTeal * (totalWaves * 0.5 + 0.5) * 0.8;

        N = perturbNormal(N, vWorldPos, totalWaves * 0.2, bumpScale * 2.0);
        roughness = 0.04;
        metallic = 0.05;
        clearCoat = 0.95;
    }
    else if (uMatType == 14) {
        // 14. SCI-FI HEX-GRID METALLIC ARMOR PLATING
        vec2 hexUv = uv * 2.5;
        float hexLine = abs(sin(hexUv.x * 1.732 + hexUv.y) * sin(hexUv.y * 2.0));
        float hexMask = smoothstep(0.08, 0.0, hexLine);

        vec3 metalPlate = vec3(0.22, 0.24, 0.26);
        vec3 orangeGlow = vec3(1.0, 0.4, 0.0);

        albedo = mix(metalPlate * uBaseColor, orangeGlow * 0.3, hexMask);
        emissive = orangeGlow * hexMask * (3.0 + sin(uTime * 4.0) * 1.0);

        N = perturbNormal(N, vWorldPos, (1.0 - hexMask) * 0.15, bumpScale * 0.8);
        roughness = mix(0.18, 0.08, hexMask);
        metallic = 0.9;
    }
    else if (uMatType == 15) {
        // 15. HIGH-ENERGY GLOWING CORE / HYPER BALL
        float corePulse = sin(uTime * 3.0) * 0.15 + 0.85;
        albedo = uBaseColor;
        roughness = 0.9;
        metallic = 0.0;
        emissive = uBaseColor * (1.2 + corePulse * 1.5);
    }

    // Blend optional 2D Texture Maps if active
    if (uUseTexMaps > 0) {
        vec4 texAlb = texture(uAlbedoMap, vUv * scale);
        vec4 texPbr = texture(uPbrMap, vUv * scale);
        albedo *= texAlb.rgb;
        roughness *= texPbr.r;
        metallic = mix(metallic, texPbr.g, 0.8);
    }

    // -------------------------------------------------------------
    // PBR LIGHTING EVALUATION
    // -------------------------------------------------------------
    float NoV = abs(dot(N, V)) + 1e-5;
    vec3 F0 = mix(vec3(0.04), albedo, metallic);
    vec3 Lo = vec3(0.0);

    // 1. Direct Key Light
    vec3 L1 = normalize(uLightDir);
    vec3 H1 = normalize(V + L1);
    float NdotL1 = max(dot(N, L1), 0.0);

    if (NdotL1 > 0.0) {
        float NDF = DistributionGGX(max(dot(N, H1), 0.0), max(roughness, 0.04));
        float G = GeometrySmith(N, V, L1, max(roughness, 0.04));
        vec3 F = FresnelSchlick(max(dot(H1, V), 0.0), F0);

        vec3 specular = (NDF * G * F) / (4.0 * NoV * NdotL1 + 0.0001);
        if (clearCoat > 0.0) {
            float NDFc = DistributionGGX(max(dot(N, H1), 0.0), clearCoatRoughness);
            float Gc = GeometrySmith(N, V, L1, clearCoatRoughness);
            vec3 Fc = FresnelSchlick(max(dot(H1, V), 0.0), vec3(0.04)) * clearCoat;
            specular += (NDFc * Gc * Fc) / (4.0 * NoV * NdotL1 + 0.0001);
        }

        vec3 kS = F;
        vec3 kD = (vec3(1.0) - kS) * (1.0 - metallic);
        Lo += (kD * albedo / PI + specular) * uLightColor * NdotL1;
    }

    // 2. Secondary Fill Light
    vec3 L2 = normalize(uFillLightDir);
    vec3 H2 = normalize(V + L2);
    float NdotL2 = max(dot(N, L2), 0.0);

    if (NdotL2 > 0.0) {
        float NDF2 = DistributionGGX(max(dot(N, H2), 0.0), max(roughness, 0.04));
        float G2 = GeometrySmith(N, V, L2, max(roughness, 0.04));
        vec3 F2 = FresnelSchlick(max(dot(H2, V), 0.0), F0);

        vec3 specular2 = (NDF2 * G2 * F2) / (4.0 * NoV * NdotL2 + 0.0001);
        vec3 kS2 = F2;
        vec3 kD2 = (vec3(1.0) - kS2) * (1.0 - metallic);
        Lo += (kD2 * albedo / PI + specular2) * uFillLightColor * NdotL2 * 0.45;
    }

    // 3. Filament IBL Hemisphere Ambient
    vec3 R = reflect(-V, N);
    vec3 skyColor = mix(vec3(0.06, 0.08, 0.14), vec3(0.35, 0.50, 0.75), clamp(N.y * 0.5 + 0.5, 0.0, 1.0));
    vec3 groundColor = vec3(0.07, 0.05, 0.04);
    vec3 iblDiffuse = mix(groundColor, skyColor, N.y * 0.5 + 0.5) * albedo * (1.0 - metallic) * ao;

    vec3 iblSpecularColor = mix(vec3(0.12, 0.16, 0.28), vec3(0.85, 0.92, 1.0), clamp(R.y * 0.5 + 0.5, 0.0, 1.0));
    vec3 iblFresnel = FresnelSchlick(NoV, F0);
    vec3 iblSpecular = iblSpecularColor * iblFresnel * (1.0 - roughness * 0.75);

    if (clearCoat > 0.0) {
        vec3 clearCoatFresnel = FresnelSchlick(NoV, vec3(0.04)) * clearCoat;
        iblSpecular += iblSpecularColor * clearCoatFresnel * 0.8;
    }

    if (uMatType == 15) {
        Lo *= 0.22; // Greatly reduce direct light influence to avoid blink/contrast extremes!
    }

    vec3 color = Lo + (iblDiffuse + iblSpecular) * 0.55 + emissive;

    // HDR Reinhard Tone Mapping & Gamma Correction
    color = color / (color + vec3(1.0));
    color = pow(color, vec3(1.0 / 2.2));

    fragColor = vec4(color, 1.0);
}

