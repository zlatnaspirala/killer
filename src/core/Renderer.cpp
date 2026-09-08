#include "engine/Renderer.hpp"
#include "engine/Camera.hpp"
#include "engine/Engine.hpp"
#include <cmath>

namespace EngineCore {

Renderer::Renderer() = default;
Renderer::~Renderer() = default;

bool Renderer::Init(const EngineConfig& config) {
    (void)config;
    // Set identity model transform
    for (int i = 0; i < 16; ++i) m_modelMatrix[i] = (i % 5 == 0) ? 1.0f : 0.0f;
    return true;
}

void Renderer::BeginFrame(const float clearColor[4]) {
    m_drawCalls = 0;
    (void)clearColor;
}

void Renderer::DrawScene(const CameraController& camera, float time, const float baseColor[3], float roughness) {
    (void)camera;
    (void)time;
    (void)baseColor;
    (void)roughness;
    m_drawCalls = 1;
}

void Renderer::EndFrame() {}

void Renderer::SetViewport(int x, int y, int width, int height) {
    (void)x; (void)y; (void)width; (void)height;
}

void Renderer::UpdateModelTransform(float angleX, float angleY) {
    float cx = std::cos(angleX); float sx = std::sin(angleX);
    float cy = std::cos(angleY); float sy = std::sin(angleY);

    // Fast zero-allocation 4x4 rotation matrix
    m_modelMatrix[0] = cy;
    m_modelMatrix[1] = sx * sy;
    m_modelMatrix[2] = -cx * sy;
    m_modelMatrix[3] = 0.0f;

    m_modelMatrix[4] = 0.0f;
    m_modelMatrix[5] = cx;
    m_modelMatrix[6] = sx;
    m_modelMatrix[7] = 0.0f;

    m_modelMatrix[8] = sy;
    m_modelMatrix[9] = -sx * cy;
    m_modelMatrix[10] = cx * cy;
    m_modelMatrix[11] = 0.0f;

    m_modelMatrix[12] = 0.0f;
    m_modelMatrix[13] = 0.0f;
    m_modelMatrix[14] = 0.0f;
    m_modelMatrix[15] = 1.0f;
}

void Renderer::SetCurrentMesh(int meshType) {
    m_activeMeshIndex = meshType;
}

void Renderer::SetCurrentShader(int shaderType) {
    m_activeShaderIndex = shaderType;
}

void Renderer::SetLODPolicy(LODPolicy policy) {
    m_lodSystem.SetPolicy(policy);
}

void Renderer::SubmitMaterialBatch(const MaterialBatchBucket& batch) {
    m_batchQueue.push_back(batch);
}

void Renderer::FlushMaterialBatches() {
    // Process all material buckets in single pass per material
    for (const auto& bucket : m_batchQueue) {
        if (!bucket.instances.empty()) {
            m_drawCalls++;
            m_triangleCount += (bucket.indexCount / 3) * bucket.instances.size();
        }
    }
    m_batchQueue.clear();
}

} // namespace EngineCore
