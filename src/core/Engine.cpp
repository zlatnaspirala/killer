#include "engine/Engine.hpp"
#include <iostream>
#include <cmath>

namespace EngineCore {

Engine::Engine() = default;
Engine::~Engine() {
    m_initialized = false;
}

bool Engine::Init(const EngineConfig& config) {
    m_config = config;
    std::cout << "[Filament/C++ Architecture] Initializing Viewport: " << config.width << "x" << config.height << "\\n";

    m_camera = std::make_unique<CameraController>(45.0f, (float)config.width / (float)(config.height > 0 ? config.height : 1), 0.1f, 100.0f);
    m_input = std::make_unique<InputManager>();
    m_renderer = std::make_unique<Renderer>();

    if (!m_renderer->Init(config)) {
        std::cerr << "[C++ Engine] Failed to initialize Renderer!\\n";
        return false;
    }

    m_initialized = true;
    return true;
}

void Engine::Update(float deltaTime) {
    if (!m_initialized) return;
    m_totalTime += deltaTime;

    // Handle mouse movement for Orbit / First-person camera
    float dx = m_input->GetDeltaX();
    float dy = m_input->GetDeltaY();
    bool leftDown = m_input->IsMouseButtonDown(MOUSE_LEFT);
    bool rightDown = m_input->IsMouseButtonDown(MOUSE_RIGHT);
    bool middleDown = m_input->IsMouseButtonDown(MOUSE_MIDDLE);
    bool shiftDown = m_input->IsKeyDown(KEY_SHIFT);

    if (dx != 0.0f || dy != 0.0f) {
        m_camera->OnMouseMove(dx, dy, leftDown, rightDown, middleDown, shiftDown);
    }

    float wheel = m_input->GetWheelDelta();
    if (wheel != 0.0f) {
        m_camera->OnMouseWheel(wheel);
    }

    // Keyboard navigation update (WASD / QE / Space)
    m_camera->Update(
        deltaTime,
        m_input->IsKeyDown(KEY_W),
        m_input->IsKeyDown(KEY_S),
        m_input->IsKeyDown(KEY_A),
        m_input->IsKeyDown(KEY_D),
        m_input->IsKeyDown(KEY_Q),
        m_input->IsKeyDown(KEY_E),
        m_input->IsKeyDown(KEY_SPACE),
        shiftDown
    );

    m_input->ResetFrameDeltas();

    float angleY = m_autoRotate ? m_totalTime * m_rotationSpeed : 0.0f;
    m_renderer->UpdateModelTransform(0.2f, angleY);
}

void Engine::Render() {
    if (!m_initialized) return;
    m_renderer->BeginFrame(m_config.clearColor);
    // Render scene with zero memory allocation per frame
    m_renderer->DrawScene(*m_camera, m_totalTime, m_baseColor, m_roughness);
    m_renderer->EndFrame();
}

void Engine::Resize(int width, int height) {
    m_config.width = width;
    m_config.height = height;
    if (m_camera) {
        m_camera->SetAspectRatio((float)width / (float)(height > 0 ? height : 1));
    }
    if (m_renderer) {
        m_renderer->SetViewport(0, 0, width, height);
    }
}

void Engine::OnMouseMove(float dx, float dy) {
    if (m_input) m_input->OnMouseMove(dx, dy);
}

void Engine::OnMouseButton(int button, bool isDown) {
    if (!m_input) return;
    MouseButtonFlags flag = MOUSE_NONE;
    if (button == 0) flag = MOUSE_LEFT;
    else if (button == 1) flag = MOUSE_MIDDLE;
    else if (button == 2) flag = MOUSE_RIGHT;
    m_input->SetMouseButton(flag, isDown);
}

void Engine::OnMouseWheel(float deltaY) {
    if (m_input) m_input->OnMouseWheel(deltaY);
}

void Engine::OnKey(int keyCode, bool isDown) {
    if (!m_input) return;
    KeyFlags flag = KEY_NONE;
    switch (keyCode) {
        case 87: case 119: flag = KEY_W; break;
        case 65: case 97:  flag = KEY_A; break;
        case 83: case 115: flag = KEY_S; break;
        case 68: case 100: flag = KEY_D; break;
        case 81: case 113: flag = KEY_Q; break;
        case 69: case 101: flag = KEY_E; break;
        case 32:           flag = KEY_SPACE; break;
        case 16:           flag = KEY_SHIFT; break;
        case 17:           flag = KEY_CTRL; break;
        default: break;
    }
    if (isDown) m_input->SetKeyDown(flag);
    else        m_input->SetKeyUp(flag);
}

void Engine::SetCameraMode(int mode) {
    if (m_camera) {
        m_camera->SetMode(static_cast<CameraMode>(mode));
    }
}

void Engine::ResetCamera() {
    if (m_camera) {
        m_camera->ResetPose();
    }
}

void Engine::SetActiveMesh(int meshType) {
    if (m_renderer) m_renderer->SetCurrentMesh(meshType);
}

void Engine::SetActiveShader(int shaderType) {
    if (m_renderer) m_renderer->SetCurrentShader(shaderType);
}

void Engine::SetRotationSpeed(float speed) {
    m_rotationSpeed = speed;
}

void Engine::SetAutoRotate(bool autoRotate) {
    m_autoRotate = autoRotate;
}

void Engine::SetBaseColor(float r, float g, float b) {
    m_baseColor[0] = r;
    m_baseColor[1] = g;
    m_baseColor[2] = b;
}

void Engine::SetRoughness(float roughness) {
    m_roughness = roughness;
}

const float* Engine::GetCameraMatrix() const {
    return m_camera ? m_camera->GetViewProjMatrix() : nullptr;
}

const float* Engine::GetModelMatrix() const {
    return m_renderer ? m_renderer->GetModelMatrixData() : nullptr;
}

const float* Engine::GetCameraPosition() const {
    return m_camera ? m_camera->GetPosition() : nullptr;
}

int Engine::GetDrawCallCount() const {
    return m_renderer ? m_renderer->GetDrawCalls() : 0;
}

int Engine::GetVertexCount() const {
    return m_renderer ? m_renderer->GetVertexCount() : 0;
}

int Engine::GetTriangleCount() const {
    return m_renderer ? m_renderer->GetTriangleCount() : 0;
}

} // namespace EngineCore
