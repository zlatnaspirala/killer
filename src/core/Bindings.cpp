#include <emscripten/bind.h>
#include "engine/Engine.hpp"

using namespace emscripten;
using namespace EngineCore;

EMSCRIPTEN_BINDINGS(EngineModule) {
    enum_<CameraMode>("CameraMode")
        .value("OrbitArc", CameraMode::OrbitArc)
        .value("FirstPerson", CameraMode::FirstPerson)
        .value("FreeFly", CameraMode::FreeFly);

    value_object<EngineConfig>("EngineConfig")
        .field("width", &EngineConfig::width)
        .field("height", &EngineConfig::height)
        .field("enableDerivatives", &EngineConfig::enableDerivatives)
        .field("enableDepthTest", &EngineConfig::enableDepthTest);

    class_<Engine>("Engine")
        .constructor<>()
        .function("Init", &Engine::Init)
        .function("Update", &Engine::Update)
        .function("Render", &Engine::Render)
        .function("Resize", &Engine::Resize)
        .function("OnMouseMove", &Engine::OnMouseMove)
        .function("OnMouseButton", &Engine::OnMouseButton)
        .function("OnMouseWheel", &Engine::OnMouseWheel)
        .function("OnKey", &Engine::OnKey)
        .function("SetCameraMode", &Engine::SetCameraMode)
        .function("ResetCamera", &Engine::ResetCamera)
        .function("SetActiveMesh", &Engine::SetActiveMesh)
        .function("SetActiveShader", &Engine::SetActiveShader)
        .function("SetRotationSpeed", &Engine::SetRotationSpeed)
        .function("SetAutoRotate", &Engine::SetAutoRotate)
        .function("SetBaseColor", &Engine::SetBaseColor)
        .function("SetRoughness", &Engine::SetRoughness)
        .function("GetDrawCallCount", &Engine::GetDrawCallCount)
        .function("GetVertexCount", &Engine::GetVertexCount)
        .function("GetTriangleCount", &Engine::GetTriangleCount);
}
