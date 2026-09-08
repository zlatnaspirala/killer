#pragma once
#include <vector>
#include "LOD.hpp"

namespace EngineCore {

class CameraController;
struct EngineConfig;

struct Vertex {
    float position[3];
    float normal[3];
    float uv[2];
    float barycentric[3];
};

class Renderer {
public:
    Renderer();
    ~Renderer();

    bool Init(const EngineConfig& config);
    void BeginFrame(const float clearColor[4]);
    void DrawScene(const CameraController& camera, float time, const float baseColor[3], float roughness);
    void EndFrame();
    void SetViewport(int x, int y, int width, int height);

    void UpdateModelTransform(float angleX, float angleY);
    void SetCurrentMesh(int meshType);
    void SetCurrentShader(int shaderType);

    // AAA Render Principles: Draw per material (batching) & LOD
    void SetLODPolicy(LODPolicy policy);
    LODPolicy GetLODPolicy() const { return m_lodSystem.GetPolicy(); }
    void SubmitMaterialBatch(const MaterialBatchBucket& batch);
    void FlushMaterialBatches();

    float* GetModelMatrixData() { return m_modelMatrix; }
    int GetDrawCalls() const { return m_drawCalls; }
    int GetVertexCount() const { return m_vertexCount; }
    int GetTriangleCount() const { return m_triangleCount; }

private:
    int m_activeMeshIndex = 0;
    int m_activeShaderIndex = 0;
    int m_vertexCount = 0;
    int m_triangleCount = 0;
    int m_drawCalls = 0;
    float m_modelMatrix[16];
    LODSystem m_lodSystem;
    std::vector<MaterialBatchBucket> m_batchQueue;
};

} // namespace EngineCore
