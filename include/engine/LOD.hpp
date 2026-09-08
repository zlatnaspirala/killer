// include/engine/LOD.hpp
#pragma once
#include <vector>
#include <cmath>
#include <string>
#include <functional>

namespace EngineCore {

// AAA Engine LOD Policies: Desktop forces maximum fidelity, Mobile enforces aggressive optimization
enum class LODPolicy {
    DesktopForceQuality = 0,    // Force LOD0 for all hero & secondary elements
    MobileMaxOptimisation = 1,  // Aggressively use decimated geometry & material batching
    AdaptiveDistanceBased = 2   // Dynamically scale LOD based on screen-space projected area
};

enum class LODLevel {
    LOD0_High = 0,      // Full vertex resolution (e.g. 24x24 bands, 1152 tris)
    LOD1_Medium = 1,    // Intermediate resolution (e.g. 14x14 bands, 392 tris)
    LOD2_Decimated = 2  // Aggressive decimation (e.g. 6x6 bands, 72 tris - 94% vertex reduction)
};

struct LODMeshDescriptor {
    int lodLevel = 0;
    int vertexCount = 0;
    int triangleCount = 0;
    float maxDistance = 50.0f;
    float screenCoverageThreshold = 0.05f; // Fraction of viewport
    uint32_t vao = 0;
    uint32_t indexCount = 0;
};

// Represents a multi-resolution geometric asset
class LODGroup {
public:
    std::string name;
    std::vector<LODMeshDescriptor> levels;

    LODGroup(const std::string& groupName = "MeshGroup") : name(groupName) {}

    void AddLevel(int lodIndex, int verts, int tris, float maxDist, float screenThreshold, uint32_t vaoId = 0, uint32_t idxCount = 0) {
        LODMeshDescriptor desc;
        desc.lodLevel = lodIndex;
        desc.vertexCount = verts;
        desc.triangleCount = tris;
        desc.maxDistance = maxDist;
        desc.screenCoverageThreshold = screenThreshold;
        desc.vao = vaoId;
        desc.indexCount = idxCount;
        levels.push_back(desc);
    }

    const LODMeshDescriptor& ResolveLOD(LODPolicy policy, float distanceToCamera, float projectedScreenSize = 1.0f) const {
        if (levels.empty()) {
            static LODMeshDescriptor fallback;
            return fallback;
        }

        // 1. Desktop Force Quality override: always return highest fidelity (LOD0)
        if (policy == LODPolicy::DesktopForceQuality) {
            return levels[0];
        }

        // 2. Mobile Max Optimisation override: small/holder geometries force decimated LOD
        if (policy == LODPolicy::MobileMaxOptimisation) {
            // For sub-elements (like 37 roulette pocket spheres), pick the most decimated mesh
            if (levels.size() >= 3) {
                return levels[2]; // Decimated LOD2
            }
            return levels.back();
        }

        // 3. Adaptive Distance / Projected Screen Size Resolution
        for (size_t i = 0; i < levels.size(); ++i) {
            if (distanceToCamera <= levels[i].maxDistance || projectedScreenSize >= levels[i].screenCoverageThreshold) {
                return levels[i];
            }
        }
        return levels.back();
    }
};

// AAA Render Principle: Material-Sorted Batch Queue (Draw per material, not per mesh)
struct MaterialKey {
    uint32_t programId;
    float baseColor[3];
    float roughness;
    float metallic;
    int matType;

    bool Matches(const MaterialKey& other) const {
        return programId == other.programId &&
               matType == other.matType &&
               std::abs(roughness - other.roughness) < 0.001f &&
               std::abs(metallic - other.metallic) < 0.001f &&
               std::abs(baseColor[0] - other.baseColor[0]) < 0.001f &&
               std::abs(baseColor[1] - other.baseColor[1]) < 0.001f &&
               std::abs(baseColor[2] - other.baseColor[2]) < 0.001f;
    }
};

struct InstanceTransform {
    float modelMatrix[16];
    float normalMatrix[9];
};

struct MaterialBatchBucket {
    MaterialKey material;
    uint32_t vao = 0;
    uint32_t indexCount = 0;
    std::vector<InstanceTransform> instances;
};

// Killer Engine Core LOD & Material Batching Manager
class LODSystem {
public:
    LODPolicy activePolicy = LODPolicy::DesktopForceQuality;
    bool isMobileDevice = false;

    void Initialize(bool isMobile) {
        isMobileDevice = isMobile;
        activePolicy = isMobile ? LODPolicy::MobileMaxOptimisation : LODPolicy::DesktopForceQuality;
    }

    void SetPolicy(LODPolicy policy) {
        activePolicy = policy;
    }

    LODPolicy GetPolicy() const {
        return activePolicy;
    }
};

} // namespace EngineCore
