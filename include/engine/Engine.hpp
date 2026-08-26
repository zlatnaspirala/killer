#pragma once
#include "Renderer.hpp"
#include "Camera.hpp"
#include "Input.hpp"
#include <memory>

namespace EngineCore {

struct EngineConfig {
    int width = 1280;
    int height = 720;
    const char* canvasId = "#canvas";
    bool enableDerivatives = true;
    bool enableDepthTest = true;
    float clearColor[4] = {0.04f, 0.05f, 0.07f, 1.0f};
};

class Engine {
public:
    Engine();
    ~Engine();

    bool Init(const EngineConfig& config);
    void Update(float deltaTime);
    void Render();
    void Resize(int width, int height);

    // Input handlers with bitmasks (Zero Allocation)
    void OnMouseMove(float dx, float dy);
    void OnMouseButton(int button, bool isDown);
    void OnMouseWheel(float deltaY);
    void OnKey(int keyCode, bool isDown);

    // Camera Mode controls
    void SetCameraMode(int mode); // 0: Orbit Arc, 1: First Person, 2: Free-Fly
    void ResetCamera();

    // Mesh & Shader controls
    void SetActiveMesh(int meshType);
    void SetActiveShader(int shaderType);
    void SetRotationSpeed(float speed);
    void SetAutoRotate(bool autoRotate);
    void SetBaseColor(float r, float g, float b);
    void SetRoughness(float roughness);

    // Memory pointers & Telemetry (Zero allocation)
    const float* GetCameraMatrix() const;
    const float* GetModelMatrix() const;
    const float* GetCameraPosition() const;
    int GetDrawCallCount() const;
    int GetVertexCount() const;
    int GetTriangleCount() const;

private:
    bool m_initialized = false;
    float m_totalTime = 0.0f;
    float m_rotationSpeed = 0.8f;
    bool m_autoRotate = true;
    float m_roughness = 0.35f;
    float m_baseColor[3] = {0.15f, 0.40f, 0.95f};

    EngineConfig m_config;
    std::unique_ptr<Renderer> m_renderer;
    std::unique_ptr<CameraController> m_camera;
    std::unique_ptr<InputManager> m_input;
};

} // namespace EngineCore
