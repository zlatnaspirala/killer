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
        // 1. PROCEDURAL DARK WALNUT WOOD
        vec3 woodP = p * (scale * 0.35);
        float ringDist = length(woodP.xz) * 6.0 + fbm3d(woodP * 1.5, 3) * 3.5;
        float ring = pow(sin(ringDist * 3.14159) * 0.5 + 0.5, 0.6);
        float grain = noise2d(vec2(woodP.x * 35.0, woodP.y * 3.0)) * 0.5 + 0.5;
        float pores = pow(noise2d(vec2(woodP.x * 90.0, woodP.y * 12.0)), 3.0);

        vec3 darkWalnut = vec3(0.22, 0.11, 0.05);
        vec3 lightAmber = vec3(0.55, 0.32, 0.16);
        vec3 poreColor  = vec3(0.12, 0.06, 0.02);

        vec3 woodColor = mix(darkWalnut, lightAmber, ring * 0.65 + grain * 0.35);
        woodColor = mix(woodColor, poreColor, pores * 0.7);
        albedo = woodColor * (uBaseColor / max(vec3(0.38, 0.22, 0.12), vec3(0.01)));

        float woodHeight = ring * 0.6 + grain * 0.25 - pores * 0.3;
        N = perturbNormal(N, vWorldPos, woodHeight, bumpScale * 1.6);
        roughness = mix(0.32, 0.68, ring * 0.7 + pores * 0.3);
        metallic = 0.0;
    }
    else if (uMatType == 2) {
        // 2. PROCEDURAL BASALT & GRANITE CRAG ROCK
        vec3 rockP = p * (scale * 0.3);
        vec2 vCell = voronoi2d(uv * 0.8);
        float rockFbm = fbm3d(rockP * 2.0, 4);
        float specks = hash13(floor(rockP * 40.0));

        vec3 basaltColor = vec3(0.18, 0.19, 0.22);
        vec3 graniteFleck = vec3(0.48, 0.50, 0.54);
        vec3 quartzSpeck = vec3(0.75, 0.76, 0.80);

        vec3 rockColor = mix(basaltColor, graniteFleck, rockFbm * 0.8 + (1.0 - vCell.x) * 0.4);
        if (specks > 0.85) rockColor = mix(rockColor, quartzSpeck, 0.6);

        albedo = rockColor * (uBaseColor / max(vec3(0.32, 0.32, 0.35), vec3(0.01)));
        float rockHeight = (1.0 - vCell.x) * 0.7 + rockFbm * 0.5;
        N = perturbNormal(N, vWorldPos, rockHeight, bumpScale * 2.5);
        roughness = clamp(0.75 + rockFbm * 0.2 - (specks > 0.85 ? 0.3 : 0.0), 0.2, 1.0);
        ao = clamp(vCell.x * 1.4, 0.3, 1.0);
        metallic = 0.0;
    }
    else if (uMatType == 3) {
        // 3. BRUSHED AEROSPACE TITANIUM
        vec2 metalUV = uv * 2.0;
        float brushLines = sin(metalUV.y * 120.0 + noise2d(metalUV * 25.0) * 6.0) * 0.5 + 0.5;
        float scratches = pow(noise2d(metalUV * vec2(4.0, 180.0)), 4.0);

        vec3 titaniumBase = vec3(0.78, 0.82, 0.88);
        albedo = mix(titaniumBase * 0.85, titaniumBase * 1.15, brushLines * 0.4 - scratches * 0.3);
        albedo *= (uBaseColor / max(vec3(0.72, 0.76, 0.82), vec3(0.01)));

        float metalHeight = brushLines * 0.3 + scratches * 0.5;
        N = perturbNormal(N, vWorldPos, metalHeight, bumpScale * 0.9);
        roughness = clamp(uRoughness + (scratches * 0.35 - brushLines * 0.08), 0.08, 0.95);
        metallic = 0.96;
    }
    else if (uMatType == 4) {
        // 4. PROCEDURAL CALACATTA MARBLE
        vec3 marbleP = p * (scale * 0.25);
        float turb = fbm3d(marbleP * 1.8 + vec3(fbm3d(marbleP * 2.5, 3) * 2.0), 4);
        float veins = abs(sin(marbleP.x * 2.5 + turb * 7.5));
        float veinMask = smoothstep(0.12, 0.0, veins);
        float subVein = smoothstep(0.3, 0.0, abs(sin(marbleP.z * 3.0 + turb * 5.0))) * 0.5;

        vec3 marbleWhite = vec3(0.96, 0.97, 0.98);
        vec3 veinGold    = vec3(0.68, 0.55, 0.38);
        vec3 veinCharcoal = vec3(0.22, 0.23, 0.26);

        vec3 veinCol = mix(veinCharcoal, veinGold, turb);
        albedo = mix(marbleWhite, veinCol, clamp(veinMask + subVein, 0.0, 1.0));
        albedo *= (uBaseColor / max(vec3(0.92, 0.92, 0.94), vec3(0.01)));

        float marbleHeight = (1.0 - veinMask) * 0.15;
        N = perturbNormal(N, vWorldPos, marbleHeight, bumpScale * 0.4);
        roughness = mix(0.12, 0.35, veinMask);
        metallic = 0.0;
        clearCoat = 0.95;
    }
    else if (uMatType == 5) {
        // 5. TWILL WEAVE CARBON FIBER
        vec2 cUv = uv * 3.5;
        vec2 cell = fract(cUv);
        vec2 id = floor(cUv);
        float pattern = mod(id.x + id.y, 2.0);
        float strand = (pattern > 0.5) ? sin(cell.x * PI * 2.0) : sin(cell.y * PI * 2.0);
        strand = strand * 0.5 + 0.5;

        vec3 carbonWeave = mix(vec3(0.08, 0.09, 0.11), vec3(0.24, 0.26, 0.30), strand);
        albedo = carbonWeave * (uBaseColor / max(vec3(0.12, 0.13, 0.15), vec3(0.01)));

        float weaveHeight = strand * 0.6;
        N = perturbNormal(N, vWorldPos, weaveHeight, bumpScale * 1.8);
        roughness = 0.32;
        metallic = 0.55;
        clearCoat = 0.95;
    }
    else if (uMatType == 6) {
        // 6. CORRODED IRON & RUST
        vec3 rustP = p * (scale * 0.35);
        float rustNoise = fbm3d(rustP * 2.2, 4);
        float rustMask = smoothstep(0.38, 0.62, rustNoise);

        vec3 cleanSteel = vec3(0.72, 0.75, 0.80);
        vec3 orangeRust = vec3(0.68, 0.28, 0.12);
        vec3 darkPit    = vec3(0.28, 0.12, 0.06);
        vec3 rustColor  = mix(orangeRust, darkPit, noise3d(rustP * 8.0));

        albedo = mix(cleanSteel, rustColor, rustMask);
        albedo *= (uBaseColor / max(vec3(0.65, 0.28, 0.16), vec3(0.01)));

        float rustHeight = rustMask * 0.8 + (1.0 - rustMask) * 0.1;
        N = perturbNormal(N, vWorldPos, rustHeight, bumpScale * 2.2);
        roughness = mix(0.18, 0.88, rustMask);
        metallic  = mix(0.95, 0.05, rustMask);
    }
    else if (uMatType == 7) {
        // 7. VOLCANIC MAGMA & LAVA CRUST
        vec2 lCell = voronoi2d(uv * 0.5 + vec2(uTime * 0.04, 0.0));
        float crack = smoothstep(0.0, 0.22, lCell.x);
        float heatPulse = sin(uTime * 2.5 + lCell.y * 6.28) * 0.5 + 0.5;

        vec3 basaltCrust = vec3(0.08, 0.07, 0.07);
        vec3 magmaYellow = vec3(1.0, 0.85, 0.2);
        vec3 magmaOrange = vec3(1.0, 0.28, 0.04);
        vec3 magmaRed    = vec3(0.6, 0.05, 0.01);

        vec3 glowCol = mix(magmaYellow, magmaOrange, lCell.x * 4.0);
        glowCol = mix(glowCol, magmaRed, heatPulse * 0.3);

        albedo = mix(glowCol, basaltCrust, crack);
        emissive = glowCol * (1.0 - crack) * (2.8 + heatPulse * 1.5);

        float lavaHeight = crack * 0.7;
        N = perturbNormal(N, vWorldPos, lavaHeight, bumpScale * 2.0);
        roughness = mix(0.1, 0.9, crack);
        metallic = 0.0;
    }
    else if (uMatType == 8) {
        // 8. FLAKE METALLIC CAR PAINT
        float flake = hash13(floor(p * (scale * 8.0)));
        float flakeGlint = (flake > 0.72) ? pow((flake - 0.72) / 0.28, 2.0) : 0.0;

        vec3 candyColor = uBaseColor;
        vec3 glintColor = vec3(1.0, 0.95, 0.85);

        albedo = mix(candyColor, glintColor, flakeGlint * 0.75);
        roughness = 0.18;
        metallic = 0.85;
        clearCoat = 1.0;
        clearCoatRoughness = 0.04;
    }
    else if (uMatType == 9) {
        // 9. OPTICAL DIELECTRIC GLASS & CHROMATIC DISPERSION
        float fresnelGlass = pow(1.0 - NoV_base, 3.5);
        vec3 glassBody = vec3(0.92, 0.96, 1.0);
        albedo = mix(glassBody * 0.15, glassBody, fresnelGlass);
        roughness = 0.03;
        metallic = 0.0;
        clearCoat = 0.95;
    }
    else if (uMatType == 10) {
        // 10. SHEEN MICROFIBER VELVET CLOTH
        float sheenRim = pow(1.0 - NoV_base, 2.2);
        vec3 sheenCol = vec3(1.0, 0.45, 0.65);
        albedo = uBaseColor + sheenCol * sheenRim * 0.65;
        roughness = 0.78;
        metallic = 0.0;
    }
    else if (uMatType == 11) {
        // 11. QUANTUM HOLOGRAPHIC MATRIX
        float holoFresnel = pow(1.0 - NoV_base, 2.5);
        float scanline = sin(vWorldPos.y * 45.0 - uTime * 7.0) * 0.5 + 0.5;
        scanline = pow(scanline, 4.0);
        float grid = step(0.92, fract(uv.x * 2.0)) + step(0.92, fract(uv.y * 2.0));

        emissive = uBaseColor * (holoFresnel * 1.8 + scanline * 1.2 + grid * 0.8 + 0.2);
        albedo = uBaseColor * 0.2;
        roughness = 0.08;
        metallic = 0.0;
    }
    else if (uMatType == 12) {
        // 12. SUPERCHARGED EMISSIVE NEON
        float pulse = sin(uTime * 4.0) * 0.15 + 0.85;
        emissive = uBaseColor * pulse * 3.5;
        albedo = uBaseColor;
        roughness = 0.05;
        metallic = 0.0;
    }
    else if (uMatType == 13) {
        // 13. TROCHOIDAL RIPPLE WATER
        vec2 wUv = uv * 0.4;
        float wave1 = sin(wUv.x * 6.0 + wUv.y * 4.0 - uTime * 2.5);
        float wave2 = cos(wUv.x * 4.0 - wUv.y * 7.0 + uTime * 2.0);
        float waveHeight = (wave1 + wave2) * 0.5;
        N = perturbNormal(N, vWorldPos, waveHeight, bumpScale * 2.8);
        albedo = mix(vec3(0.05, 0.25, 0.55), vec3(0.15, 0.55, 0.85), waveHeight * 0.5 + 0.5);
        roughness = 0.06;
        metallic = 0.1;
        clearCoat = 0.95;
    }
    else if (uMatType == 14) {
        // 14. PEBBLE GRAIN LEATHER
        vec2 lPebble = voronoi2d(uv * 2.5);
        float leatherHeight = (1.0 - lPebble.x) * 0.8;
        N = perturbNormal(N, vWorldPos, leatherHeight, bumpScale * 1.9);
        albedo = mix(uBaseColor * 0.75, uBaseColor * 1.1, lPebble.x);
        roughness = 0.58;
        metallic = 0.0;
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

    vec3 color = Lo + (iblDiffuse + iblSpecular) * 0.55 + emissive;

    // HDR Reinhard Tone Mapping & Gamma Correction
    color = color / (color + vec3(1.0));
    color = pow(color, vec3(1.0 / 2.2));

    fragColor = vec4(color, 1.0);
}

