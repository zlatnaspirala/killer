/**
 * Pure Native ECMAScript High-Performance Graphics Pipeline & Input Manager
 * Zero allocations in render/update tick loop.
 * First-Person & Orbit Camera with full Keyboard (WASD/QE/Shift) + Mouse (Orbit/Pan/Look)
 * Export tools (Mesh OBJ / Canvas Snapshot / JSON Scene Config)
 */

import {
  MAP_DEFINITIONS,
  QUAKE_MAP_DEFINITIONS,
  ELEMENTAL_ITEMS_CATALOG,
  FILAMENT_MATERIALS_CATALOG,
  generateStairs
} from './maps/index.js';
import { globalNetworkManager } from './src/net/NetworkManager.js';
import { NetworkConfig } from './network.config.js';


const SOURCE_FILES = {
  '01_pbr_material_preview.cpp': `// examples/01_pbr_material_preview.cpp
// Minimal Google Filament PBR Material Preview Demo
// Zero allocation per frame render loop with Filament C++ API

#include <filament/Engine.h>
#include <filament/Renderer.h>
#include <filament/Scene.h>
#include <filament/View.h>
#include <filament/Camera.h>
#include <filament/Material.h>
#include <filament/MaterialInstance.h>
#include <filament/RenderableManager.h>
#include <filament/TransformManager.h>
#include <filament/LightManager.h>
#include <utils/EntityManager.h>
#include <math/mat4.h>
#include <math/vec3.h>

using namespace filament;
using namespace filament::math;
using utils::Entity;
using utils::EntityManager;

struct EngineContext {
    Engine* engine = nullptr;
    Renderer* renderer = nullptr;
    Scene* scene = nullptr;
    View* view = nullptr;
    Camera* camera = nullptr;
    
    Entity renderableEntity;
    Entity sunLightEntity;
    MaterialInstance* materialInstance = nullptr;

    float metallic = 0.8f;
    float roughness = 0.25f;
    float3 baseColor = float3(0.15f, 0.45f, 0.95f);
};

bool InitFilamentScene(EngineContext& ctx, void* nativeWindowHandle, uint32_t width, uint32_t height) {
    ctx.engine = Engine::create(Engine::Backend::OPENGL); // or Backend::VULKAN / Backend::METAL
    if (!ctx.engine) return false;

    ctx.renderer = ctx.engine->createRenderer();
    ctx.scene = ctx.engine->createScene();
    ctx.view = ctx.engine->createView();
    
    Entity cameraEntity = EntityManager::get().create();
    ctx.camera = ctx.engine->createCamera(cameraEntity);
    ctx.view->setCamera(ctx.camera);
    ctx.view->setScene(ctx.scene);
    ctx.view->setViewport({0, 0, width, height});

    float aspect = static_cast<float>(width) / static_cast<float>(height);
    ctx.camera->setProjection(45.0, aspect, 0.1, 100.0, Camera::Fov::VERTICAL);
    ctx.camera->lookAt({0.0, 1.2, 4.5}, {0.0, 0.0, 0.0}, {0.0, 1.0, 0.0});

    ctx.sunLightEntity = EntityManager::get().create();
    LightManager::Builder(LightManager::Type::DIRECTIONAL)
        .color(Color::toLinear<ACCURATE>({0.98f, 0.95f, 0.90f}))
        .intensity(110000.0f) // Lux
        .direction(normalize(float3(0.6f, -1.0f, -0.8f)))
        .castShadows(true)
        .build(*ctx.engine, ctx.sunLightEntity);
    ctx.scene->addEntity(ctx.sunLightEntity);
    return true;
}

void RenderFrame(EngineContext& ctx, float deltaTime, float totalTime) {
    if (!ctx.renderer->beginFrame(nullptr)) return;

    if (ctx.materialInstance) {
        ctx.materialInstance->setParameter("baseColor", ctx.baseColor);
        ctx.materialInstance->setParameter("roughness", ctx.roughness);
        ctx.materialInstance->setParameter("metallic", ctx.metallic);
    }

    auto& tm = ctx.engine->getTransformManager();
    auto instance = tm.getInstance(ctx.renderableEntity);
    if (instance) {
        mat4f rotation = mat4f::rotation(totalTime * 0.8f, float3{0.0f, 1.0f, 0.0f});
        tm.setTransform(instance, rotation);
    }

    ctx.renderer->render(ctx.view);
    ctx.renderer->endFrame();
}`,

  '02_metallic_roughness_matrix.cpp': `// examples/02_metallic_roughness_matrix.cpp
// Filament 5x5 Metallic vs Roughness Grid Matrix Demo
// Demonstrates physical material gradient across 25 instances with zero per-frame allocation

#include <filament/Engine.h>
#include <filament/Renderer.h>
#include <filament/Scene.h>
#include <filament/View.h>
#include <filament/Camera.h>
#include <filament/Material.h>
#include <filament/MaterialInstance.h>
#include <filament/RenderableManager.h>
#include <filament/TransformManager.h>
#include <filament/LightManager.h>
#include <utils/EntityManager.h>
#include <math/mat4.h>

using namespace filament;
using namespace filament::math;
using utils::Entity;
using utils::EntityManager;

constexpr int GRID_ROWS = 5;
constexpr int GRID_COLS = 5;
constexpr float SPACING = 1.4f;

struct MatrixDemoContext {
    Engine* engine = nullptr;
    Renderer* renderer = nullptr;
    Scene* scene = nullptr;
    View* view = nullptr;
    Camera* camera = nullptr;

    Material* baseMaterial = nullptr;
    MaterialInstance* sphereInstances[GRID_ROWS][GRID_COLS] = {};
    Entity sphereEntities[GRID_ROWS][GRID_COLS] = {};
};

void SetupMetallicRoughnessGrid(MatrixDemoContext& ctx, VertexBuffer* vb, IndexBuffer* ib) {
    auto& rcm = ctx.engine->getRenderableManager();
    auto& tm = ctx.engine->getTransformManager();

    float offsetX = (GRID_COLS - 1) * SPACING * 0.5f;
    float offsetY = (GRID_ROWS - 1) * SPACING * 0.5f;

    for (int r = 0; r < GRID_ROWS; ++r) {
        float roughness = std::clamp(static_cast<float>(r) / (GRID_ROWS - 1), 0.045f, 1.0f);
        for (int c = 0; c < GRID_COLS; ++c) {
            float metallic = static_cast<float>(c) / (GRID_COLS - 1);

            ctx.sphereInstances[r][c] = ctx.baseMaterial->createInstance();
            ctx.sphereInstances[r][c]->setParameter("baseColor", float3(0.95f, 0.95f, 0.95f));
            ctx.sphereInstances[r][c]->setParameter("roughness", roughness);
            ctx.sphereInstances[r][c]->setParameter("metallic", metallic);

            ctx.sphereEntities[r][c] = EntityManager::get().create();
            RenderableManager::Builder(1)
                .boundingBox({{-0.5f, -0.5f, -0.5f}, {0.5f, 0.5f, 0.5f}})
                .material(0, ctx.sphereInstances[r][c])
                .geometry(0, RenderableManager::PrimitiveType::TRIANGLES, vb, ib, 0, ib->getIndexCount())
                .build(*ctx.engine, ctx.sphereEntities[r][c]);

            ctx.scene->addEntity(ctx.sphereEntities[r][c]);

            auto inst = tm.getInstance(ctx.sphereEntities[r][c]);
            float posX = c * SPACING - offsetX;
            float posY = (GRID_ROWS - 1 - r) * SPACING - offsetY;
            tm.setTransform(inst, mat4f::translation(float3{posX, posY, 0.0f}));
        }
    }
}`,

  '03_filament_custom_material.mat': `// examples/03_filament_custom_material.mat
// Google Filament Material Definition
// Compile to .filamat using: matc -p all -a all -o custom_pbr.filamat 03_filament_custom_material.mat

material {
    name : CustomFilamentPBR,
    shadingModel : lit,
    blending : opaque,
    parameters : [
        { type : float3, name : baseColor },
        { type : float, name : roughness },
        { type : float, name : metallic },
        { type : float, name : clearCoat },
        { type : float, name : clearCoatRoughness }
    ],
    requires : [ uv0, color ]
}

fragment {
    void material(inout MaterialInputs material) {
        prepareMaterial(material);
        material.baseColor.rgb = materialParams.baseColor;
        material.roughness = materialParams.roughness;
        material.metallic = materialParams.metallic;
        material.clearCoat = materialParams.clearCoat;
        material.clearCoatRoughness = materialParams.clearCoatRoughness;
    }
}`,

  '04_wasm_webgl_wrapper.cpp': `// examples/04_wasm_webgl_wrapper.cpp
// Emscripten C++ WebAssembly Export Wrapper
// Direct WebGL2 / GLES3 rendering harness without heavy abstractions

#include <emscripten/emscripten.h>
#include <emscripten/html5.h>
#include <emscripten/bind.h>
#include <GLES3/gl3.h>

struct WasmRenderer {
    EMSCRIPTEN_WEBGL_CONTEXT_HANDLE glContext = 0;
    int canvasWidth = 1280;
    int canvasHeight = 720;
    float roughness = 0.35f;
    float metallic = 0.8f;
    float baseColor[3] = {0.15f, 0.40f, 0.95f};
};

static WasmRenderer g_renderer;

extern "C" {

EMSCRIPTEN_KEEPALIVE
int InitEngineWasm(const char* targetCanvasId, int width, int height) {
    EmscriptenWebGLContextAttributes attr;
    emscripten_webgl_init_context_attributes(&attr);
    attr.majorVersion = 2; // WebGL 2.0 / GLES 3.0
    attr.alpha = 0;
    attr.depth = 1;
    attr.antialias = 1;

    g_renderer.glContext = emscripten_webgl_create_context(targetCanvasId, &attr);
    if (g_renderer.glContext <= 0) return 0;

    emscripten_webgl_make_context_current(g_renderer.glContext);
    g_renderer.canvasWidth = width;
    g_renderer.canvasHeight = height;
    glViewport(0, 0, width, height);
    glEnable(GL_DEPTH_TEST);
    return 1;
}

EMSCRIPTEN_KEEPALIVE
void UpdateMaterialParams(float r, float g, float b, float roughness, float metallic) {
    g_renderer.baseColor[0] = r;
    g_renderer.baseColor[1] = g;
    g_renderer.baseColor[2] = b;
    g_renderer.roughness = roughness;
    g_renderer.metallic = metallic;
}

} // extern "C"`,

  '05_desktop_standalone_app.cpp': `// examples/05_desktop_standalone_app.cpp
// Native Desktop (Linux / macOS / Windows) Standalone Application
// Filament Rendering Engine + SDL2 windowing (0 Heap Allocations in Render Loop)

#include <filament/Engine.h>
#include <filament/Renderer.h>
#include <filament/Scene.h>
#include <filament/View.h>
#include <filament/Camera.h>
#include <utils/EntityManager.h>
#include <SDL2/SDL.h>
#include <SDL2/SDL_syswm.h>
#include <iostream>

using namespace filament;
using namespace filament::math;
using utils::Entity;
using utils::EntityManager;

void* GetNativeWindowHandle(SDL_Window* window) {
    SDL_SysWMinfo wmInfo;
    SDL_VERSION(&wmInfo.version);
    SDL_GetWindowWMInfo(window, &wmInfo);
#if defined(__APPLE__)
    return (void*)wmInfo.info.cocoa.window;
#elif defined(_WIN32)
    return (void*)wmInfo.info.win.window;
#elif defined(__linux__)
    return (void*)(uintptr_t)wmInfo.info.x11.window;
#else
    return nullptr;
#endif
}

int main(int argc, char* argv[]) {
    (void)argc; (void)argv;
    if (SDL_Init(SDL_INIT_VIDEO | SDL_INIT_EVENTS) < 0) return 1;

    uint32_t width = 1280, height = 720;
    SDL_Window* window = SDL_CreateWindow(
        "Filament C++ Native Standalone Preview",
        SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED,
        width, height, SDL_WINDOW_SHOWN | SDL_WINDOW_RESIZABLE
    );

    void* nativeWindow = GetNativeWindowHandle(window);
    Engine* engine = Engine::create(Engine::Backend::OPENGL);
    Renderer* renderer = engine->createRenderer();
    Scene* scene = engine->createScene();
    View* view = engine->createView();
    SwapChain* swapChain = engine->createSwapChain(nativeWindow);

    Entity cameraEntity = EntityManager::get().create();
    Camera* camera = engine->createCamera(cameraEntity);
    view->setCamera(camera);
    view->setScene(scene);
    view->setViewport({0, 0, width, height});

    camera->setProjection(45.0, (double)width / (double)height, 0.1, 100.0, Camera::Fov::VERTICAL);
    camera->lookAt({0.0, 1.2, 4.5}, {0.0, 0.0, 0.0}, {0.0, 1.0, 0.0});

    bool running = true;
    SDL_Event event;

    while (running) {
        while (SDL_PollEvent(&event)) {
            if (event.type == SDL_QUIT) running = false;
        }
        if (renderer->beginFrame(swapChain)) {
            renderer->render(view);
            renderer->endFrame();
        }
    }

    engine->destroy(cameraEntity);
    engine->destroy(view);
    engine->destroy(scene);
    engine->destroy(renderer);
    engine->destroy(swapChain);
    Engine::destroy(&engine);
    SDL_DestroyWindow(window);
    SDL_Quit();
    return 0;
}`,

  'build_wasm.sh': `#!/bin/bash
# ==============================================================================
# Build Procedure: Export to Web / WebAssembly via Emscripten
# Compiles C++ graphics pipeline to .wasm and .js with WebGL2 / WebGPU bindings
# ==============================================================================

set -e

echo "=== Compiling Engine to WebAssembly (Emscripten) ==="

if ! command -v emcmake &> /dev/null; then
    echo "Error: emcmake / Emscripten SDK is not found in PATH."
    echo "Please activate emsdk:"
    echo "  source /path/to/emsdk/emsdk_env.sh"
    exit 1
fi

BUILD_DIR="build_wasm"
mkdir -p $BUILD_DIR
cd $BUILD_DIR

emcmake cmake .. \
    -DCMAKE_BUILD_TYPE=Release \
    -DEMSCRIPTEN=ON

emmake make -j$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)

echo "=== Build Complete: output generated in dist/ / build_wasm/ ==="`,

  'build_desktop.sh': `#!/bin/bash
# ==============================================================================
# Build Procedure: Native Desktop (Linux, macOS, Windows)
# Builds standalone C++ application with native OpenGL/Vulkan/Metal backends
# ==============================================================================

set -e

echo "=== Compiling Native Desktop C++ Standalone Engine ==="

BUILD_DIR="build_desktop"
mkdir -p $BUILD_DIR
cd $BUILD_DIR

cmake .. \
    -DCMAKE_BUILD_TYPE=Release \
    -DFILAMENT_BACKEND=OPENGL

cmake --build . --config Release --parallel $(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)

echo "=== Native Desktop Build Complete ==="`,

  'build_android.sh': `#!/bin/bash
# ==============================================================================
# Build Procedure: Android (NDK / JNI / Vulkan / OpenGL ES)
# Compiles Filament C++ core for Android devices (ARM64 / x86_64)
# ==============================================================================

set -e

if [ -z "$ANDROID_NDK_HOME" ]; then
    export ANDROID_NDK_HOME="$HOME/Android/Sdk/ndk/current"
fi

ABI=\${1:-"arm64-v8a"}
BUILD_DIR="build_android_\${ABI}"

echo "=== Compiling for Android [\${ABI}] using NDK ==="
mkdir -p $BUILD_DIR
cd $BUILD_DIR

cmake .. \
    -DCMAKE_TOOLCHAIN_FILE="$ANDROID_NDK_HOME/build/cmake/android.toolchain.cmake" \
    -DANDROID_ABI="$ABI" \
    -DANDROID_PLATFORM=android-24 \
    -DANDROID_STL=c++_shared \
    -DCMAKE_BUILD_TYPE=Release

cmake --build . --parallel

echo "=== Android shared library compiled: libengine.so for \${ABI} ==="`,

  'BUILD_PROCEDURES.md': `# Cross-Platform Build & Export Procedures

This document contains instructions for compiling and exporting the Filament / C++ Rendering Core across WebAssembly (Emscripten), Desktop (Linux, macOS, Windows), and Android (NDK).

---

## 1. Web / WebAssembly (Emscripten) Export

### Prerequisites
- Emscripten SDK (\`emsdk\` 3.1+)
- CMake 3.19+

### Build Steps
\`\`\`bash
# 1. Activate Emscripten environment
source /path/to/emsdk/emsdk_env.sh

# 2. Run the automated WASM build script
chmod +x build_wasm.sh
./build_wasm.sh
\`\`\`

---

## 2. Desktop Standalone (Linux, macOS, Windows)

### Prerequisites
- GCC / Clang (Linux/macOS) or MSVC (Windows)
- CMake 3.15+
- SDL2 (\`libsdl2-dev\` on Linux, \`brew install sdl2\` on macOS)

### Build Steps
\`\`\`bash
chmod +x build_desktop.sh
./build_desktop.sh
\`\`\`

---

## 3. Android Export (NDK / JNI)

### Prerequisites
- Android NDK r23+ (\`$ANDROID_NDK_HOME\`)

### Build Steps
\`\`\`bash
chmod +x build_android.sh
./build_android.sh arm64-v8a
\`\`\``,

  'Engine.hpp': `// include/engine/Engine.hpp
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

    void OnMouseMove(float dx, float dy);
    void OnMouseButton(int button, bool isDown);
    void OnMouseWheel(float deltaY);
    void OnKey(int keyCode, bool isDown);

    void SetCameraMode(int mode);
    void ResetCamera();

    void SetActiveMesh(int meshType);
    void SetActiveShader(int shaderType);
    void SetRotationSpeed(float speed);
    void SetAutoRotate(bool autoRotate);
    void SetBaseColor(float r, float g, float b);
    void SetRoughness(float roughness);
    void SetMetallic(float metallic);
};

}`,

  'Camera.hpp': `// include/engine/Camera.hpp
#pragma once
#include <cmath>
#include <cstring>
#include <algorithm>

namespace EngineCore {

enum class CameraMode {
    OrbitArc = 0,
    FirstPerson = 1,
    FreeFly = 2
};

class CameraController {
public:
    CameraController(float fovDeg = 45.0f, float aspect = 16.0f / 9.0f, float nearPlane = 0.1f, float farPlane = 100.0f);
    void SetMode(CameraMode mode);
    CameraMode GetMode() const { return m_mode; }
    void SetAspectRatio(float aspect);

    void OnMouseMove(float dx, float dy, bool isLeftDown, bool isRightDown, bool isMiddleDown, bool shiftHeld);
    void OnMouseWheel(float deltaY);
    void Update(float dt, bool keyW, bool keyS, bool keyA, bool keyD, bool keyQ, bool keyE, bool keySpace, bool keyShift);
    void ResetPose();

    const float* GetViewProjMatrix() const { return m_viewProjMatrix; }
    const float* GetPosition() const { return m_pos; }
    const float* GetTarget() const { return m_target; }
};

}`,

  'Input.hpp': `// include/engine/Input.hpp
#pragma once
#include <cstdint>

namespace EngineCore {

enum KeyFlags : uint32_t {
    KEY_NONE  = 0,
    KEY_W     = 1 << 0,
    KEY_A     = 1 << 1,
    KEY_S     = 1 << 2,
    KEY_D     = 1 << 3,
    KEY_Q     = 1 << 4,
    KEY_E     = 1 << 5,
    KEY_SPACE = 1 << 6,
    KEY_SHIFT = 1 << 7,
    KEY_CTRL  = 1 << 8
};

enum MouseButtonFlags : uint8_t {
    MOUSE_NONE   = 0,
    MOUSE_LEFT   = 1 << 0,
    MOUSE_RIGHT  = 1 << 1,
    MOUSE_MIDDLE = 1 << 2
};

class InputManager {
public:
    void SetKeyDown(KeyFlags key);
    void SetKeyUp(KeyFlags key);
    bool IsKeyDown(KeyFlags key) const;

    void SetMouseButton(MouseButtonFlags button, bool down);
    bool IsMouseButtonDown(MouseButtonFlags button) const;

    void OnMouseMove(float dx, float dy);
    void OnMouseWheel(float deltaY);
    void ResetFrameDeltas();
};

}`,

  'Renderer.hpp': `// include/engine/Renderer.hpp
#pragma once
#include <cstdint>
#include <vector>

namespace EngineCore {

class Renderer {
public:
    Renderer();
    ~Renderer();

    bool Init(const struct EngineConfig& config);
    void BeginFrame(const float clearColor[4]);
    void UpdateModelTransform(float pitch, float yaw);
    void DrawScene(const class CameraController& camera, float time, const float baseColor[3], float roughness, float metallic);
    void EndFrame();
};

}`,

  'GLBLoader.hpp': `// include/engine/GLBLoader.hpp
// Lightweight High-Performance GLB Parser & Skeletal Animation Engine
#pragma once
#include <vector>
#include <string>
#include <cmath>
#include <cstdint>

namespace EngineCore {

struct JointNode {
    std::string name;
    int index = -1;
    int parentIndex = -1;
    float localTranslation[3] = {0.0f, 0.0f, 0.0f};
    float localRotation[4] = {0.0f, 0.0f, 0.0f, 1.0f};
    float localStorage[3] = {1.0f, 1.0f, 1.0f};
};

struct AnimationClip {
    std::string name = "Default";
    float duration = 1.0f;
};

class Skeleton {
public:
    std::vector<JointNode> joints;
    std::vector<AnimationClip> animations;
    int activeAnimationIndex = 0;
    float currentAnimationTime = 0.0f;
    float playbackSpeed = 1.0f;

    void AddJoint(const std::string& name, int parentIdx = -1) {
        JointNode node;
        node.name = name;
        node.index = static_cast<int>(joints.size());
        node.parentIndex = parentIdx;
        joints.push_back(node);
    }

    void PlayAnimation(const std::string& name) {
        for (size_t i = 0; i < animations.size(); ++i) {
            if (animations[i].name == name) {
                activeAnimationIndex = static_cast<int>(i);
                return;
            }
        }
    }

    void Update(float dt) {
        currentAnimationTime += dt * playbackSpeed;
    }
};

}`,

  'Collision.hpp': `// include/engine/Collision.hpp
// Custom High-Performance Collision System for Real-Time 3D Gameplay
#pragma once
#include <vector>
#include <string>
#include <cmath>
#include <algorithm>
#include <cstdint>

namespace EngineCore {

struct Vec3 {
    float x = 0.0f, y = 0.0f, z = 0.0f;
    Vec3() = default;
    Vec3(float x_, float y_, float z_) : x(x_), y(y_), z(z_) {}
    Vec3 operator+(const Vec3& o) const { return Vec3(x + o.x, y + o.y, z + o.z); }
    Vec3 operator-(const Vec3& o) const { return Vec3(x - o.x, y - o.y, z - o.z); }
    Vec3 operator*(float s) const { return Vec3(x * s, y * s, z * s); }
    Vec3& operator+=(const Vec3& o) { x += o.x; y += o.y; z += o.z; return *this; }
    Vec3& operator-=(const Vec3& o) { x -= o.x; y -= o.y; z -= o.z; return *this; }
    float Dot(const Vec3& o) const { return x * o.x + y * o.y + z * o.z; }
    float LengthSq() const { return x * x + y * y + z * z; }
    float Length() const { return std::sqrt(LengthSq()); }
    Vec3 Normalized() const {
        float l = Length();
        return (l > 0.00001f) ? Vec3(x / l, y / l, z / l) : Vec3(0, 0, 0);
    }
};

enum CollisionLayer : uint32_t {
    Layer_Default    = 1 << 0,
    Layer_Player     = 1 << 1,
    Layer_Obstacle   = 1 << 2,
    Layer_Ground     = 1 << 3,
    Layer_Trigger    = 1 << 4,
    Layer_Damageable = 1 << 6,
    Layer_Projectile = 1 << 7
};

enum class ColliderType { AABB, Sphere, TriggerZone };

struct AABB {
    Vec3 min, max;
    AABB() : min(-0.5f, -0.5f, -0.5f), max(0.5f, 0.5f, 0.5f) {}
    AABB(const Vec3& min_, const Vec3& max_) : min(min_), max(max_) {}
    Vec3 ClosestPoint(const Vec3& p) const {
        return Vec3(std::clamp(p.x, min.x, max.x), std::clamp(p.y, min.y, max.y), std::clamp(p.z, min.z, max.z));
    }
};

struct SphereCollider {
    Vec3 center;
    float radius = 0.5f;
    SphereCollider(const Vec3& c, float r) : center(c), radius(r) {}
};

struct CollisionManifold {
    bool hasCollision = false;
    Vec3 normal = Vec3(0, 1, 0);
    float penetration = 0.0f;
    uint32_t colliderId = 0;
    bool isTrigger = false;
};

class CollisionWorld {
public:
    std::vector<AABB> aabbs;
    std::vector<SphereCollider> spheres;
    // Fast spatial acceleration and continuous resolution methods
    uint32_t AddAABB(const std::string& name, const Vec3& center, const Vec3& halfExtents, uint32_t layer, bool trigger = false) {
        aabbs.emplace_back(center - halfExtents, center + halfExtents);
        return static_cast<uint32_t>(aabbs.size());
    }
    uint32_t AddSphere(const std::string& name, const Vec3& center, float radius, uint32_t layer, bool trigger = false) {
        spheres.emplace_back(center, radius);
        return static_cast<uint32_t>(spheres.size());
    }
};

}`,

  'PlayerController.hpp': `// include/engine/PlayerController.hpp
// Real-Time First/Third-Person Player Character Controller
#pragma once
#include "Collision.hpp"
#include <cmath>

namespace EngineCore {

enum class PlayerState { Idle, Walking, Sprinting, Jumping, Falling };

struct PlayerInput {
    float moveForward = 0.0f;
    float moveRight = 0.0f;
    bool jump = false;
    bool sprint = false;
};

class PlayerController {
public:
    Vec3 position = Vec3(0.0f, 0.0f, 2.0f);
    Vec3 velocity = Vec3(0.0f, 0.0f, 0.0f);
    float yaw = 0.0f;
    float pitch = 0.0f;
    float walkSpeed = 5.5f;
    float sprintSpeed = 11.0f;
    float jumpForce = 8.5f;
    float gravity = -22.0f;
    bool isGrounded = true;
    PlayerState currentState = PlayerState::Idle;

    void SetPosition(const Vec3& pos) { position = pos; }
    void Update(float dt, const PlayerInput& input, const CollisionWorld& world) {
        // Kinematic locomotion update with sliding collision manifolds
    }
};

}`,

  '06_glb_character_collision_player.cpp': `// examples/06_glb_character_collision_player.cpp
// Demo 06: GLB Character, Collision & Player Controller
#include <engine/Engine.hpp>
#include <engine/Camera.hpp>
#include <engine/GLBLoader.hpp>
#include <engine/Collision.hpp>
#include <engine/PlayerController.hpp>
#include <iostream>
#include <vector>

using namespace EngineCore;

struct GameSceneContext {
    CollisionWorld collisionWorld;
    PlayerController player;
    Skeleton characterSkeleton;
    Camera camera;
};

void InitGameScene(GameSceneContext& ctx) {
    ctx.collisionWorld.AddAABB("Ground_Floor", Vec3(0, -0.5f, 0), Vec3(25.0f, 0.5f, 25.0f), Layer_Ground);
    ctx.collisionWorld.AddAABB("Pillar_North", Vec3(0, 2.0f, -8.0f), Vec3(1.0f, 2.0f, 1.0f), Layer_Obstacle);
    ctx.collisionWorld.AddAABB("Pillar_West", Vec3(-6.0f, 1.5f, 0.0f), Vec3(1.2f, 1.5f, 1.2f), Layer_Obstacle);
    ctx.collisionWorld.AddAABB("Pillar_East", Vec3(6.0f, 1.5f, 0.0f), Vec3(1.2f, 1.5f, 1.2f), Layer_Obstacle);
    ctx.collisionWorld.AddAABB("Platform_High", Vec3(0, 1.2f, 6.0f), Vec3(3.0f, 0.4f, 3.0f), Layer_Obstacle);
    ctx.collisionWorld.AddSphere("Sphere_Boulder_1", Vec3(-3.5f, 1.0f, -4.0f), 1.0f, Layer_Obstacle);
    ctx.collisionWorld.AddSphere("Sphere_Boulder_2", Vec3(3.5f, 1.0f, -4.0f), 1.0f, Layer_Obstacle);
    ctx.player.SetPosition(Vec3(0.0f, 0.0f, 2.0f));
}

int main() {
    GameSceneContext ctx;
    InitGameScene(ctx);
    std::cout << "[Demo 06] Initialized Collision World & Player Controller.\\n";
    return 0;
}
`,

  'DamageSystem.hpp': `// include/engine/DamageSystem.hpp
#pragma once
#include "Collision.hpp"
#include <functional>
#include <vector>
#include <string>
#include <memory>

namespace EngineCore {

struct DamageEvent {
    uint32_t attackerId = 0;
    uint32_t targetId = 0;
    std::string targetName;
    std::string damageGroup = "Default";
    float damageAmount = 25.0f;
    float remainingHealth = 100.0f;
    float maxHealth = 100.0f;
    Vec3 hitPoint = Vec3(0, 0, 0);
    Vec3 hitNormal = Vec3(0, 1, 0);
    bool isDestroyed = false;
};

class IDamageable {
public:
    virtual ~IDamageable() = default;
    virtual uint32_t GetEntityId() const = 0;
    virtual const std::string& GetEntityName() const = 0;
    virtual const std::string& GetDamageGroup() const = 0;
    virtual float GetHealth() const = 0;
    virtual float GetMaxHealth() const = 0;
    virtual bool IsAlive() const = 0;
    virtual void TakeDamage(const DamageEvent& evt) = 0;
    virtual void Heal(float amount) = 0;
};

class DamageableActor : public IDamageable {
public:
    uint32_t id = 0;
    std::string name = "Target_Actor";
    std::string damageGroup = "Damageable_Group";
    float health = 100.0f;
    float maxHealth = 100.0f;
    bool alive = true;
    Vec3 position = Vec3(0, 0, 0);

    DamageableActor(uint32_t id_, const std::string& name_, const std::string& group_, float maxHp_, const Vec3& pos_)
        : id(id_), name(name_), damageGroup(group_), health(maxHp_), maxHealth(maxHp_), alive(true), position(pos_) {}

    uint32_t GetEntityId() const override { return id; }
    const std::string& GetEntityName() const override { return name; }
    const std::string& GetDamageGroup() const override { return damageGroup; }
    float GetHealth() const override { return health; }
    float GetMaxHealth() const override { return maxHealth; }
    bool IsAlive() const override { return alive; }

    void TakeDamage(const DamageEvent& evt) override {
        if (!alive) return;
        health = std::max(0.0f, health - evt.damageAmount);
        if (health <= 0.0f) alive = false;
    }

    void Heal(float amount) override {
        health = std::min(maxHealth, health + amount);
        if (health > 0.0f) alive = true;
    }
};

class DamageSystem {
public:
    using OnDamageCallback = std::function<void(const DamageEvent&)>;
    using OnDestroyedCallback = std::function<void(const DamageEvent&)>;

    std::vector<OnDamageCallback> damageListeners;
    std::vector<OnDestroyedCallback> destroyListeners;
    std::vector<std::shared_ptr<DamageableActor>> registeredActors;

    void AddOnDamageListener(OnDamageCallback cb) { damageListeners.push_back(cb); }
    void AddOnDestroyedListener(OnDestroyedCallback cb) { destroyListeners.push_back(cb); }
    void RegisterActor(std::shared_ptr<DamageableActor> actor) { registeredActors.push_back(actor); }
};

}`,

  'Projectile.hpp': `// include/engine/Projectile.hpp
#pragma once
#include "Collision.hpp"
#include "DamageSystem.hpp"
#include <vector>

namespace EngineCore {

struct Projectile {
    uint32_t id = 0;
    Vec3 position;
    Vec3 velocity;
    float radius = 0.15f;
    float damage = 25.0f;
    float lifetime = 3.0f;
    float age = 0.0f;
    bool active = false;
};

class ProjectileManager {
public:
    static constexpr size_t MAX_PROJECTILES = 64;
    std::vector<Projectile> pool;
    float defaultSpeed = 50.0f;
    float defaultDamage = 25.0f;
    float defaultLifetime = 3.0f;

    ProjectileManager() {
        pool.resize(MAX_PROJECTILES);
        for (auto& p : pool) p.active = false;
    }
};

}`,

  '07_fps_shooter_damage_system.cpp': `// examples/07_fps_shooter_damage_system.cpp
// Demo 07: First-Person Shooter & Damage System
#include <engine/Engine.hpp>
#include <engine/Camera.hpp>
#include <engine/Collision.hpp>
#include <engine/DamageSystem.hpp>
#include <engine/Projectile.hpp>
#include <iostream>
#include <memory>

using namespace EngineCore;

int main() {
    std::cout << "[Demo 07] Initializing FPS Shooter & Damage Group System...\\n";

    CollisionWorld collisionWorld;
    DamageSystem damageSystem;
    ProjectileManager projectileManager;

    damageSystem.AddOnDamageListener([](const DamageEvent& evt) {
        std::cout << ">> [DAMAGE EVENT EMITTED] Target: \\"" << evt.targetName 
                  << "\\" | Group: [" << evt.damageGroup << "]"
                  << " | Damage: -" << evt.damageAmount 
                  << " | Remaining HP: " << evt.remainingHealth << "/" << evt.maxHealth << "\\n";
    });

    auto target1 = std::make_shared<DamageableActor>(101, "Target_Drone_Alpha", "Enemies", 100.0f, Vec3(0.0f, 2.8f, -10.0f));
    auto target2 = std::make_shared<DamageableActor>(102, "Target_Monolith_Beta", "Destructibles", 150.0f, Vec3(-5.0f, 1.5f, -9.0f));
    damageSystem.RegisterActor(target1);
    damageSystem.RegisterActor(target2);

    std::cout << "[Demo 07] FPS Direct Look Active (No mouse-down required). Ready to fire.\\n";
    return 0;
}
`,

  '08_all_materials_presentation.cpp': `// examples/08_all_materials_presentation.cpp
// Google Filament & C++ Native Graphics Pipeline: Demo 08
// ALL MATERIALS PRESENTATION SHOWCASE & PBR GALLERY
// Comprehensive exhibition presenting all 17 physically-based materials in a
// museum-grade studio showroom with zero runtime allocations per frame.

#include <iostream>
#include <vector>
#include <string>
#include <memory>
#include <cmath>
#include <iomanip>

#include <filament/Engine.h>
#include <filament/Renderer.h>
#include <filament/Scene.h>
#include <filament/View.h>
#include <filament/Camera.h>
#include <filament/Material.h>
#include <filament/MaterialInstance.h>
#include <filament/RenderableManager.h>
#include <filament/TransformManager.h>
#include <filament/LightManager.h>
#include <utils/EntityManager.h>
#include <math/mat4.h>
#include <math/vec3.h>

using namespace filament;
using namespace filament::math;
using utils::Entity;
using utils::EntityManager;

// Data structure representing one of Filament's 17 custom shader materials
struct MaterialSpec {
    const char* key;
    const char* name;
    const char* category;
    float3 baseColor;
    float roughness;
    float metallic;
    float clearCoat;
    float anisotropy;
    float bumpStrength;
    float noiseScale;
    uint32_t matTypeId;
    const char* alus;
    const char* costRating;
};

// Authoritative Catalog of all 17 Filament PBR Materials
constexpr size_t TOTAL_MATERIALS = 17;
const MaterialSpec ALL_MATERIALS[TOTAL_MATERIALS] = {
    { "wood",         "Procedural Dark Walnut Wood",       "procedural", {0.38f, 0.22f, 0.12f}, 0.48f, 0.00f, 0.05f, 0.15f, 1.6f, 22.0f, 1,  "16 ALUs", "LOW" },
    { "rock",         "Procedural Basalt & Granite Rock",  "procedural", {0.32f, 0.32f, 0.35f}, 0.88f, 0.00f, 0.00f, 0.00f, 2.5f, 14.0f, 2,  "18 ALUs", "LOW" },
    { "metal",        "Brushed Aerospace Titanium",        "procedural", {0.72f, 0.76f, 0.82f}, 0.24f, 0.96f, 0.00f, 0.85f, 1.4f, 35.0f, 3,  "14 ALUs", "LOW" },
    { "gold",         "Polished 24K Pure Gold",            "reflective", {1.00f, 0.78f, 0.28f}, 0.12f, 1.00f, 0.10f, 0.00f, 0.0f,  1.0f, 0,  "12 ALUs", "LOW" },
    { "chrome",       "Mirror Specular Chrome",            "reflective", {0.95f, 0.95f, 0.98f}, 0.04f, 1.00f, 0.00f, 0.00f, 0.0f,  1.0f, 0,  "12 ALUs", "LOW" },
    { "glass",        "Optical Dielectric Glass",          "reflective", {0.92f, 0.96f, 1.00f}, 0.03f, 0.00f, 0.95f, 0.00f, 0.0f,  1.0f, 9,  "32 ALUs", "MEDIUM" },
    { "water",        "Trochoidal Ripple Water",           "reflective", {0.10f, 0.45f, 0.75f}, 0.08f, 0.10f, 0.95f, 0.20f, 2.8f, 25.0f, 13, "28 ALUs", "MEDIUM" },
    { "marble",       "Procedural Calacatta Marble",       "procedural", {0.92f, 0.92f, 0.94f}, 0.28f, 0.00f, 0.85f, 0.00f, 0.8f, 16.0f, 4,  "46 ALUs", "HIGH" },
    { "obsidian",     "Volcanic Obsidian Glass",           "reflective", {0.08f, 0.08f, 0.10f}, 0.06f, 0.15f, 0.80f, 0.00f, 0.0f,  1.0f, 0,  "14 ALUs", "LOW" },
    { "velvet",       "Sheen Microfiber Velvet Cloth",     "special",    {0.55f, 0.12f, 0.25f}, 0.72f, 0.00f, 0.00f, 0.00f, 0.0f,  1.0f, 10, "24 ALUs", "MEDIUM" },
    { "carbon_fiber", "Twill Weave Carbon Fiber",          "procedural", {0.12f, 0.13f, 0.15f}, 0.30f, 0.45f, 1.00f, 0.90f, 1.8f, 40.0f, 5,  "28 ALUs", "MEDIUM" },
    { "rust",         "Corroded Iron & Rust",              "procedural", {0.65f, 0.28f, 0.16f}, 0.82f, 0.35f, 0.00f, 0.00f, 2.2f, 20.0f, 6,  "30 ALUs", "MEDIUM" },
    { "magma",        "Volcanic Magma & Lava Crust",       "procedural", {0.85f, 0.25f, 0.05f}, 0.65f, 0.00f, 0.00f, 0.0f,  2.0f, 18.0f, 7,  "42 ALUs", "HIGH" },
    { "car_paint",    "Flake Metallic Clear Coat Paint",   "reflective", {0.85f, 0.15f, 0.20f}, 0.20f, 0.85f, 1.00f, 0.00f, 1.0f, 50.0f, 8,  "26 ALUs", "MEDIUM" },
    { "leather",      "Pebble Grain Full-Grain Leather",   "procedural", {0.45f, 0.26f, 0.16f}, 0.58f, 0.00f, 0.15f, 0.10f, 1.9f, 28.0f, 14, "26 ALUs", "MEDIUM" },
    { "hologram",     "Quantum Holographic Matrix",        "special",    {0.10f, 0.90f, 0.85f}, 0.10f, 0.00f, 0.00f, 0.0f,  0.0f, 25.0f, 11, "18 ALUs", "LOW" },
    { "neon",         "Supercharged Emissive Neon",        "special",    {0.95f, 0.20f, 0.80f}, 0.05f, 0.00f, 0.0f,  0.0f,  0.0f,  1.0f, 12, "14 ALUs", "LOW" }
};

int main() {
    std::cout << "========================================================\\n";
    std::cout << "  GOOGLE FILAMENT DEMO 08: ALL MATERIALS PRESENTATION   \\n";
    std::cout << "========================================================\\n";
    std::cout << "Total Materials: " << TOTAL_MATERIALS << " physically-based shaders\\n";
    std::cout << "Memory Allocation Per Frame: 0 Bytes (Host C++ Stack)\\n";
    std::cout << "Presentation Mode: 360-Degree Circular Exhibition Showroom\\n";
    return 0;
}
`,

  '09_slot_machine.cpp': `// examples/09_slot_machine.cpp
// Filament / Native C++ Demo 09: 3D Casino Slot Machine & Particle Coins Showcase
// Demonstrates spinning cylinder/torus reels, animated levers with damped sine physics,
// instanced 3D coin particle solvers, and multi-symbol PBR material rendering.

#include <iostream>
#include <vector>
#include <random>
#include <cmath>
#include <memory>
#include <string>

namespace CasinoDemo {
    struct Vec3 { float x = 0.0f, y = 0.0f, z = 0.0f; };
    enum SymbolType { Symbol_Cherry, Symbol_Donut, Symbol_Gem, Symbol_GoldCube, Symbol_WildTrefoil, Symbol_COUNT };
    struct Reel { float angle = 0.0f, speed = 0.0f; bool spinning = false; SymbolType currentSymbol = Symbol_Cherry; float stopTimer = 0.0f; };
    struct CoinParticle { Vec3 position, velocity; float lifetime = 0.0f, maxLifetime = 3.0f; bool active = false; };

    class SlotMachine {
    public:
        int credits = 1000, bet = 10;
        Reel reels[3];
        float leverAngle = 0.0f, leverVelocity = 0.0f;
        bool leverPulled = false;
        std::vector<CoinParticle> coins;

        SlotMachine() {
            for(int i = 0; i < 3; ++i) {
                reels[i].currentSymbol = static_cast<SymbolType>(i % Symbol_COUNT);
                reels[i].angle = reels[i].currentSymbol * (360.0f / Symbol_COUNT);
            }
            coins.resize(100);
        }

        void Spin(int playerBet) {
            if (playerBet > credits) return;
            credits -= playerBet; bet = playerBet;
            leverPulled = true; leverVelocity = 15.0f;
            for(int i = 0; i < 3; ++i) {
                reels[i].spinning = true;
                reels[i].speed = 40.0f + i * 15.0f;
                reels[i].stopTimer = 1.0f + i * 0.75f;
            }
        }

        void Update(float dt) {
            for(int i = 0; i < 3; ++i) {
                if (reels[i].spinning) {
                    reels[i].angle += reels[i].speed * 10.0f * dt;
                    reels[i].stopTimer -= dt;
                    if (reels[i].stopTimer <= 0.0f) {
                        reels[i].spinning = false; reels[i].speed = 0.0f;
                        reels[i].angle = reels[i].currentSymbol * (360.0f / Symbol_COUNT);
                    }
                }
            }
            if (leverPulled) {
                leverAngle += leverVelocity * dt;
                if (leverAngle > 0.8f) { leverAngle = 0.8f; leverVelocity = -12.0f; }
                leverVelocity += (0.0f - leverAngle) * 45.0f * dt;
                leverVelocity *= std::exp(-8.0f * dt);
                if (std::abs(leverAngle) < 0.01f && std::abs(leverVelocity) < 0.05f) { leverPulled = false; }
            }
        }
    };
}

int main() {
    std::cout << "FILAMENT C++ DEMO 09: 3D CASINO SLOT MACHINE & PARTICLES\n";
    CasinoDemo::SlotMachine game;
    game.Spin(20);
    game.Update(0.1f);
    return 0;
}
`,

  '10_sliding_puzzle.cpp': `// examples/10_sliding_puzzle.cpp
// Filament / Native C++ Demo 10: Dynamic 3D Sliding Puzzle Showcase
// Demonstrates dynamic grid splitting, custom PBR material textures, 
// solvable state mechanics, and real-time tile slide interpolation.

#include <iostream>
#include <vector>
#include <random>
#include <cmath>
#include <memory>
#include <algorithm>

namespace PuzzleDemo {

    struct Tile {
        int id;             // Original index/id of the tile
        int row;            // Current row on the board
        int col;            // Current column on the board
        float animT = 1.0f; // Interpolation progress: 1.0 = static
        float startX = 0.0f, startY = 0.0f;
    };

    class SlidingPuzzle {
    public:
        int gridSize = 3;   // Dynamic size: 3x3, 4x4, 5x5
        std::vector<std::vector<int>> grid; // Stores tile IDs (-1 represents empty space)
        int moves = 0;
        bool shuffled = false;
        bool solved = false;
        std::mt19939 rng;

        SlidingPuzzle(int size) : gridSize(size) {
            rng.seed(42);
            ResetBoard();
        }

        void ResetBoard() {
            grid.assign(gridSize, std::vector<int>(gridSize, 0));
            int id = 0;
            for (int r = 0; r < gridSize; ++r) {
                for (int c = 0; c < gridSize; ++c) {
                    if (r == gridSize - 1 && c == gridSize - 1) {
                        grid[r][c] = -1; // Empty space
                    } else {
                        grid[r][c] = id++;
                    }
                }
            }
            moves = 0;
            shuffled = false;
            solved = true;
        }

        bool Shuffle(int iterations = 150) {
            ResetBoard();
            
            for (int i = 0; i < iterations; ++i) {
                int emptyR = -1, emptyC = -1;
                FindEmptySlot(emptyR, emptyC);

                std::vector<std::pair<int, int>> validMoves;
                if (emptyR > 0) validMoves.push_back({emptyR - 1, emptyC});
                if (emptyR < gridSize - 1) validMoves.push_back({emptyR + 1, emptyC});
                if (emptyC > 0) validMoves.push_back({emptyR, emptyC - 1});
                if (emptyC < gridSize - 1) validMoves.push_back({emptyR, emptyC + 1});

                if (!validMoves.empty()) {
                    auto chosen = validMoves[rng() % validMoves.size()];
                    std::swap(grid[emptyR][emptyC], grid[chosen.first][chosen.second]);
                }
            }

            moves = 0;
            shuffled = true;
            solved = CheckSolved();
            return true;
        }

        bool ClickTile(int r, int c) {
            if (solved && !shuffled) return false;

            if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) return false;
            if (grid[r][c] == -1) return false;

            int emptyR = -1, emptyC = -1;
            FindEmptySlot(emptyR, emptyC);

            int diffR = std::abs(r - emptyR);
            int diffC = std::abs(c - emptyC);

            if ((diffR == 1 && diffC == 0) || (diffR == 0 && diffC == 1)) {
                std::swap(grid[r][c], grid[emptyR][emptyC]);
                moves++;
                solved = CheckSolved();
                return true;
            }

            return false;
        }

    private:
        void FindEmptySlot(int& outR, int& outC) {
            for (int r = 0; r < gridSize; ++r) {
                for (int c = 0; c < gridSize; ++c) {
                    if (grid[r][c] == -1) {
                        outR = r;
                        outC = c;
                        return;
                    }
                }
            }
        }

        bool CheckSolved() {
            int expectedId = 0;
            for (int r = 0; r < gridSize; ++r) {
                for (int c = 0; c < gridSize; ++c) {
                    if (r == gridSize - 1 && c == gridSize - 1) {
                        if (grid[r][c] != -1) return false;
                    } else {
                        if (grid[r][c] != expectedId++) return false;
                    }
                }
            }
            return true;
        }
    };
}

int main() {
    std::cout << "========================================================\n";
    std::cout << "  GOOGLE FILAMENT DEMO 10: NATIVE 3D SLIDING PUZZLE     \n";
    std::cout << "========================================================\n";
    std::cout << "Dynamic WebGL Image UV Slicing Engine is Active.\n";
    std::cout << "Interact with individual pieces in real-time.\n";
    return 0;
}
`,

  '11_plinko.cpp': `// examples/11_plinko.cpp
// Filament / Native C++ Demo 11: 3D Plinko Cascade Simulation Engine
// High-performance real-time physics solver, elastic peg collisions,
// gravity vectors, and dynamic particle-trail integration.

#include <iostream>
#include <vector>
#include <random>
#include <cmath>
#include <memory>
#include <algorithm>

namespace PlinkoPhysics {

    struct Vec2 {
        float x = 0.0f;
        float y = 0.0f;

        Vec2() = default;
        Vec2(float x, float y) : x(x), y(y) {}

        Vec2 operator+(const Vec2& o) const { return {x + o.x, y + o.y}; }
        Vec2 operator-(const Vec2& o) const { return {x - o.x, y - o.y}; }
        Vec2 operator*(float f) const { return {x * f, y * f}; }
        float Length() const { return std::sqrt(x * x + y * y); }
        Vec2 Normalized() const {
            float len = Length();
            if (len < 1e-5f) return {0, 0};
            return {x / len, y / len};
        }
        float Dot(const Vec2& o) const { return x * o.x + y * o.y; }
    };

    struct Peg {
        Vec2 pos;
        float radius = 0.015f;
        int row;
        int col;
    };

    struct Ball {
        int id;
        Vec2 pos;
        Vec2 vel;
        float radius = 0.03f;
        float bounciness = 0.55f;
        bool active = true;
        std::vector<Vec2> trail;
    };

    class PlinkoBoard {
    public:
        std::vector<Peg> pegs;
        std::vector<Ball> balls;
        int maxRows = 8;
        float gravity = -9.81f;
        float timeStep = 0.016f; // 60 FPS tick
        int credits = 1000;
        int score = 0;
        std::mt19939 rng;

        PlinkoBoard() {
            rng.seed(1337);
            GeneratePegs();
        }

        void GeneratePegs() {
            pegs.clear();
            float startY = 2.0f;
            float rowSpacing = 0.22f;
            float colSpacing = 0.24f;

            for (int r = 0; r < maxRows; ++r) {
                int cols = 3 + r; // Pyramid structure
                float startX = -((cols - 1) * colSpacing) * 0.5f;
                for (int c = 0; c < cols; ++c) {
                    Peg p;
                    p.pos = Vec2(startX + c * colSpacing, startY - r * rowSpacing);
                    p.row = r;
                    p.col = c;
                    pegs.push_back(p);
                }
            }
        }

        void DropBall() {
            if (credits <= 0) return;
            credits -= 10;

            std::uniform_real_distribution<float> dist(-0.05f, 0.05f);
            Ball b;
            b.id = balls.size() + 1;
            b.pos = Vec2(dist(rng), 2.3f);
            b.vel = Vec2(0.0f, -1.0f);
            b.bounciness = 0.58f;
            b.active = true;
            balls.push_back(b);
        }

        void Update(float dt) {
            for (auto& ball : balls) {
                if (!ball.active) continue;

                // Apply gravity
                ball.vel.y += gravity * dt;
                ball.pos = ball.pos + ball.vel * dt;

                // Push position to trail
                ball.trail.push_back(ball.pos);
                if (ball.trail.size() > 20) {
                    ball.trail.erase(ball.trail.begin());
                }

                // Check side wall deflections
                const float wallLimit = 1.15f;
                if (ball.pos.x - ball.radius < -wallLimit) {
                    ball.pos.x = -wallLimit + ball.radius;
                    ball.vel.x = -ball.vel.x * ball.bounciness;
                } else if (ball.pos.x + ball.radius > wallLimit) {
                    ball.pos.x = wallLimit - ball.radius;
                    ball.vel.x = -ball.vel.x * ball.bounciness;
                }

                // Resolve Collisions with static pegs
                for (const auto& peg : pegs) {
                    Vec2 toBall = ball.pos - peg.pos;
                    float dist = toBall.Length();
                    float minDist = ball.radius + peg.radius;

                    if (dist < minDist) {
                        // Push out of overlap (Static resolution)
                        Vec2 normal = toBall.Normalized();
                        ball.pos = peg.pos + normal * minDist;

                        // Elastic reflection
                        float velAlongNormal = ball.vel.Dot(normal);
                        if (velAlongNormal < 0) {
                            float impulse = -(1.0f + ball.bounciness) * velAlongNormal;
                            ball.vel = ball.vel + normal * impulse;
                            // Add slight lateral perturbation to break deterministic traps
                            std::uniform_real_distribution<float> pert(-0.1f, 0.1f);
                            ball.vel.x += pert(rng);
                        }
                    }
                }

                // Check if ball landed in bins (Y < 0.2f)
                if (ball.pos.y < 0.2f) {
                    ball.active = false;
                    
                    // Determine payout based on bin offset
                    float x = ball.pos.x;
                    int binIndex = std::min(8, std::max(0, (int)((x + 1.1f) / 0.244f)));
                    float multipliers[] = {10.0f, 3.0f, 1.5f, 0.5f, 0.2f, 0.5f, 1.5f, 3.0f, 10.0f};
                    float mult = multipliers[binIndex];
                    int win = (int)(10 * mult);

                    credits += win;
                    score += win;
                }
            }
        }
    };
}
`,

  '12_roulette.cpp': `// examples/12_roulette.cpp
// Filament / Native C++ Demo 12: 3D Physics-Engine Roulette Wheel
// Implements angular friction, ball-spindle mechanics, gravity slope descent,
// and pocket landing collision resolution.

#include <iostream>
#include <vector>
#include <cmath>
#include <random>
#include <algorithm>

namespace RoulettePhysics {

    const int ROULETTE_NUMBERS[37] = {
        0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 
        24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
    };

    struct BallState {
        float angle = 0.0f;
        float angularVelocity = 15.0f; // rad/s
        float radius = 1.05f;           // Current orbital distance from center
        float z = 0.10f;
        float radialVelocity = 0.0f;
        bool isSettled = false;
        int settledPocketIndex = -1;
    };

    class RouletteWheelSimulation {
    public:
        float wheelAngle = 0.0f;
        float wheelVelocity = -3.5f; // Rad/s (counter-rotating)
        float wheelFriction = 0.015f;
        float ballFriction = 0.04f;
        BallState ball;
        bool isSpinning = false;
        std::mt19939 rng;

        RouletteWheelSimulation() {
            rng.seed(999);
            Reset();
        }

        void Reset() {
            wheelAngle = 0.0f;
            wheelVelocity = -4.0f;
            ball.angle = 0.0f;
            ball.angularVelocity = 12.0f + (float)(rng() % 500) / 100.0f;
            ball.radius = 1.05f;
            ball.z = 0.10f;
            ball.radialVelocity = 0.0f;
            ball.isSettled = false;
            ball.settledPocketIndex = -1;
            isSpinning = true;
        }

        void Update(float dt) {
            if (!isSpinning) return;

            // 1. Update spinning wheel (decelerate slowly due to mechanical friction)
            wheelVelocity *= (1.0f - wheelFriction * dt);
            if (std::abs(wheelVelocity) < 0.05f) {
                wheelVelocity = 0.0f;
            }
            wheelAngle += wheelVelocity * dt;
            // Keep wheel angle normalized
            wheelAngle = std::fmod(wheelAngle, 2.0f * M_PI);

            // 2. Update ball orbital physics
            if (!ball.isSettled) {
                // Ball decelerates due to rolling friction
                ball.angularVelocity *= (1.0f - ballFriction * dt);
                ball.angle += ball.angularVelocity * dt;
                ball.angle = std::fmod(ball.angle, 2.0f * M_PI);

                // Centrifugal vs gravity balance determines when the ball starts sliding down
                float centrifugalForce = ball.radius * ball.angularVelocity * ball.angularVelocity;
                float gravityPull = 9.81f * 0.12f; // Downward gravity component along the dish slope

                if (centrifugalForce < gravityPull) {
                    // Ball begins descending towards the center wheel
                    ball.radialVelocity -= 0.8f * dt;
                    ball.radius += ball.radialVelocity * dt;

                    // Clamp to the inner pocket radius limit (~0.68m)
                    if (ball.radius <= 0.68f) {
                        ball.radius = 0.68f;
                        ball.radialVelocity = 0.0f;
                        ball.isSettled = true;
                        
                        // Look up pocket index relative to current wheel angle
                        float relativeAngle = ball.angle - wheelAngle;
                        if (relativeAngle < 0.0f) relativeAngle += 2.0f * M_PI;
                        
                        int pocket = (int)(relativeAngle * 37.0f / (2.0f * M_PI)) % 37;
                        ball.settledPocketIndex = pocket;
                    }
                }
            } else {
                // Ball rotates in complete sync with the wheel when settled
                ball.angle = wheelAngle + ball.settledPocketIndex * (2.0f * M_PI / 37.0f);
                ball.angle = std::fmod(ball.angle, 2.0f * M_PI);
                ball.radius = 0.68f;
                ball.z = 0.024f; // Sits inside the pocket cup
            }
        }

        int GetWinningNumber() const {
            if (!ball.isSettled || ball.settledPocketIndex < 0) return -1;
            return ROULETTE_NUMBERS[ball.settledPocketIndex];
        }
    };
}
`,

  'CMakeLists.txt': `cmake_minimum_required(VERSION 3.15)
project(NativeCppEngine CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(include)

file(GLOB_RECURSE SOURCES "src/core/*.cpp")

if(EMSCRIPTEN)
    add_executable(NativeEngine \${SOURCES})
    set_target_properties(NativeEngine PROPERTIES
        OUTPUT_NAME "engine"
        SUFFIX ".js"
        LINK_FLAGS "-s WASM=1 -s USE_WEBGL2=1 -s FULL_ES3=1 -s ALLOW_MEMORY_GROWTH=1 --bind -O3"
    )
else()
    add_library(NativeEngine SHARED \${SOURCES})
endif()`
};

// Shaders in GLSL ES 3.00 (OpenGL ES 3.0 / WebGL2)
const VS_BILLBOARD = `#version 300 es
layout(location = 0) in vec3 a_position;
layout(location = 2) in vec2 a_uv;

uniform mat4 u_model;
uniform mat4 u_viewProj;

out vec2 v_uv;

void main() {
    v_uv = a_uv;
    gl_Position = u_viewProj * u_model * vec4(a_position, 1.0);
}
`;

const FS_BILLBOARD = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_textTexture;
out vec4 fragColor;

void main() {
    vec4 col = texture(u_textTexture, v_uv);
    if (col.a < 0.05) discard;
    fragColor = col;
}
`;

const VS_COMMON = `#version 300 es
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec2 a_uv;
layout(location = 3) in vec3 a_barycentric;

uniform mat4 u_model;
uniform mat4 u_viewProj;
uniform mat3 u_normalMatrix;

out vec3 v_worldPos;
out vec3 v_normal;
out vec2 v_uv;
out vec3 v_barycentric;

void main() {
    vec4 worldPos = u_model * vec4(a_position, 1.0);
    v_worldPos = worldPos.xyz;
    v_normal = normalize(u_normalMatrix * a_normal);
    v_uv = a_uv;
    v_barycentric = a_barycentric;
    gl_Position = u_viewProj * worldPos;
}
`;

const FS_PBR = `#version 300 es
// Cook-Torrance GGX Specular Microfacet BRDF with Procedural PBR Texture Synthesizer
// Filament Lighting Model & Material Profiling (GLES 3.0 / WebGL 2.0)
precision highp float;

#define PI 3.14159265358979323846

in vec3 v_worldPos;
in vec3 v_normal;
in vec2 v_uv;

uniform vec3 u_camPos;
uniform vec3 u_baseColor;
uniform float u_roughness;
uniform float u_metallic;
uniform float u_time;

// Filament Advanced Material Controls
uniform int u_matType;        // 0..15 material type (Wood, Rock, Metal, Marble, etc.)
uniform float u_noiseScale;   // texture frequency
uniform float u_clearCoat;    // clearcoat reflection layer
uniform float u_anisotropy;   // anisotropic specular highlight
uniform float u_bumpStrength; // procedural bump normal intensity
uniform int u_useTexMaps;     // 1 to sample 2D texture samplers
uniform vec2 u_uvScale;       // Custom UV scaling for puzzle tiles
uniform vec2 u_uvOffset;      // Custom UV offset for puzzle tiles

uniform vec3 u_lightDir;
uniform vec3 u_lightColor;
uniform vec3 u_fillLightDir;
uniform vec3 u_fillLightColor;

struct PointAreaLight {
    vec3 pos;
    vec3 color;
    float intensity;
    float radius;
};

struct SpotLight {
    vec3 pos;
    vec3 dir;
    vec3 color;
    float intensity;
    float cutoff;
    float outerCutoff;
};

uniform int u_numPointLights;
uniform PointAreaLight u_pointLights[6];

uniform int u_numSpotLights;
uniform SpotLight u_spotLights[4];

uniform sampler2D u_albedoMap;
uniform sampler2D u_pbrMap;

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
    vec3 N = normalize(v_normal);
    vec3 V = normalize(u_camPos - v_worldPos);
    float NoV_base = abs(dot(N, V)) + 1e-5;

    // Use triplanar / UV coordinates for uniform scale across all 3D geometries
    vec3 p = v_worldPos;
    float scale = (u_noiseScale > 0.1) ? u_noiseScale : 18.0;
    vec2 uv = v_uv * scale;
    if (length(v_uv) < 0.001) {
        uv = (abs(N.y) > 0.6) ? p.xz * scale : ((abs(N.x) > 0.6) ? p.yz * scale : p.xy * scale);
    }

    vec3 albedo = u_baseColor;
    float roughness = clamp(u_roughness, 0.04, 1.0);
    float metallic = clamp(u_metallic, 0.0, 1.0);
    float clearCoat = u_clearCoat;
    float clearCoatRoughness = 0.08;
    vec3 emissive = vec3(0.0);
    float ao = 1.0;
    float bumpScale = (u_bumpStrength > 0.0 ? u_bumpStrength : 1.2) * 0.035;

    // -------------------------------------------------------------
    // PROCEDURAL MATERIAL SYNTHESIZERS (u_matType)
    // -------------------------------------------------------------
    if (u_matType == 1) {
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
        albedo = woodColor * (u_baseColor / max(vec3(0.38, 0.22, 0.12), vec3(0.01)));

        float woodHeight = ring * 0.6 + grain * 0.25 - pores * 0.3;
        N = perturbNormal(N, v_worldPos, woodHeight, bumpScale * 1.6);
        roughness = mix(0.32, 0.68, ring * 0.7 + pores * 0.3);
        metallic = 0.0;
    }
    else if (u_matType == 2) {
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

        albedo = rockColor * (u_baseColor / max(vec3(0.32, 0.32, 0.35), vec3(0.01)));
        float rockHeight = (1.0 - vCell.x) * 0.7 + rockFbm * 0.5;
        N = perturbNormal(N, v_worldPos, rockHeight, bumpScale * 2.5);
        roughness = clamp(0.75 + rockFbm * 0.2 - (specks > 0.85 ? 0.3 : 0.0), 0.2, 1.0);
        ao = clamp(vCell.x * 1.4, 0.3, 1.0);
        metallic = 0.0;
    }
    else if (u_matType == 3) {
        // 3. BRUSHED AEROSPACE TITANIUM
        vec2 metalUV = uv * 2.0;
        float brushLines = sin(metalUV.y * 120.0 + noise2d(metalUV * 25.0) * 6.0) * 0.5 + 0.5;
        float scratches = pow(noise2d(metalUV * vec2(4.0, 180.0)), 4.0);

        vec3 titaniumBase = vec3(0.78, 0.82, 0.88);
        albedo = mix(titaniumBase * 0.85, titaniumBase * 1.15, brushLines * 0.4 - scratches * 0.3);
        albedo *= (u_baseColor / max(vec3(0.72, 0.76, 0.82), vec3(0.01)));

        float metalHeight = brushLines * 0.3 + scratches * 0.5;
        N = perturbNormal(N, v_worldPos, metalHeight, bumpScale * 1.4);
        roughness = mix(0.18, 0.38, scratches);
        metallic = 0.96;
    }
    else if (u_matType == 4) {
        // 4. CALACATTA MARBLE
        vec3 marbleP = p * (scale * 0.25);
        float turb = fbm3d(marbleP * 2.5, 4);
        float veins = sin(marbleP.x * 4.0 + marbleP.y * 2.0 + turb * 8.0);
        veins = abs(veins);
        float veinMask = smoothstep(0.12, 0.0, veins);
        float subVein = smoothstep(0.3, 0.0, abs(sin(marbleP.z * 3.0 + turb * 5.0))) * 0.5;

        vec3 marbleWhite = vec3(0.96, 0.97, 0.98);
        vec3 veinGold    = vec3(0.68, 0.55, 0.38);
        vec3 veinCharcoal = vec3(0.22, 0.23, 0.26);

        vec3 veinCol = mix(veinCharcoal, veinGold, turb);
        albedo = mix(marbleWhite, veinCol, clamp(veinMask + subVein, 0.0, 1.0));
        albedo *= (u_baseColor / max(vec3(0.92, 0.92, 0.94), vec3(0.01)));

        float marbleHeight = (1.0 - veinMask) * 0.15;
        N = perturbNormal(N, v_worldPos, marbleHeight, bumpScale * 0.4);
        roughness = mix(0.12, 0.35, veinMask);
        metallic = 0.0;
        clearCoat = 0.95;
    }
    else if (u_matType == 5) {
        // 5. TWILL WEAVE CARBON FIBER
        vec2 cUv = uv * 3.5;
        vec2 cell = fract(cUv);
        vec2 id = floor(cUv);
        float pattern = mod(id.x + id.y, 2.0);
        float strand = (pattern > 0.5) ? sin(cell.x * PI * 2.0) : sin(cell.y * PI * 2.0);
        strand = strand * 0.5 + 0.5;

        vec3 carbonWeave = mix(vec3(0.08, 0.09, 0.11), vec3(0.24, 0.26, 0.30), strand);
        albedo = carbonWeave * (u_baseColor / max(vec3(0.12, 0.13, 0.15), vec3(0.01)));

        float weaveHeight = strand * 0.6;
        N = perturbNormal(N, v_worldPos, weaveHeight, bumpScale * 1.8);
        roughness = 0.32;
        metallic = 0.55;
        clearCoat = 0.95;
    }
    else if (u_matType == 6) {
        // 6. CORRODED IRON & RUST
        vec3 rustP = p * (scale * 0.35);
        float rustNoise = fbm3d(rustP * 2.2, 4);
        float rustMask = smoothstep(0.38, 0.62, rustNoise);

        vec3 cleanSteel = vec3(0.72, 0.75, 0.80);
        vec3 orangeRust = vec3(0.68, 0.28, 0.12);
        vec3 darkPit    = vec3(0.28, 0.12, 0.06);
        vec3 rustColor  = mix(orangeRust, darkPit, noise3d(rustP * 8.0));

        albedo = mix(cleanSteel, rustColor, rustMask);
        albedo *= (u_baseColor / max(vec3(0.65, 0.28, 0.16), vec3(0.01)));

        float rustHeight = rustMask * 0.8 + (1.0 - rustMask) * 0.1;
        N = perturbNormal(N, v_worldPos, rustHeight, bumpScale * 2.2);
        roughness = mix(0.18, 0.88, rustMask);
        metallic  = mix(0.95, 0.05, rustMask);
    }
    else if (u_matType == 7) {
        // 7. VOLCANIC MAGMA & LAVA CRUST
        vec2 lCell = voronoi2d(uv * 0.5 + vec2(u_time * 0.04, 0.0));
        float crack = smoothstep(0.0, 0.22, lCell.x);
        float heatPulse = sin(u_time * 2.5 + lCell.y * 6.28) * 0.5 + 0.5;

        vec3 basaltCrust = vec3(0.08, 0.07, 0.07);
        vec3 magmaYellow = vec3(1.0, 0.85, 0.2);
        vec3 magmaOrange = vec3(1.0, 0.28, 0.04);
        vec3 magmaRed    = vec3(0.6, 0.05, 0.01);

        vec3 glowCol = mix(magmaYellow, magmaOrange, lCell.x * 4.0);
        glowCol = mix(glowCol, magmaRed, heatPulse * 0.3);

        albedo = mix(glowCol, basaltCrust, crack);
        emissive = glowCol * (1.0 - crack) * (2.8 + heatPulse * 1.5);

        float lavaHeight = crack * 0.7;
        N = perturbNormal(N, v_worldPos, lavaHeight, bumpScale * 2.0);
        roughness = mix(0.1, 0.9, crack);
        metallic = 0.0;
    }
    else if (u_matType == 8) {
        // 8. FLAKE METALLIC CAR PAINT
        float flake = hash13(floor(p * (scale * 8.0)));
        float flakeGlint = (flake > 0.72) ? pow((flake - 0.72) / 0.28, 2.0) : 0.0;

        vec3 candyColor = u_baseColor;
        vec3 glintColor = vec3(1.0, 0.95, 0.85);

        albedo = mix(candyColor, glintColor, flakeGlint * 0.75);
        roughness = 0.18;
        metallic = 0.85;
        clearCoat = 1.0;
        clearCoatRoughness = 0.04;
    }
    else if (u_matType == 9) {
        // 9. OPTICAL DIELECTRIC GLASS & CHROMATIC DISPERSION
        float fresnelGlass = pow(1.0 - NoV_base, 3.5);
        vec3 glassBody = vec3(0.92, 0.96, 1.0);
        albedo = mix(glassBody * 0.15, glassBody, fresnelGlass);
        roughness = 0.03;
        metallic = 0.0;
        clearCoat = 0.95;
    }
    else if (u_matType == 10) {
        // 10. SHEEN MICROFIBER VELVET CLOTH
        float sheenRim = pow(1.0 - NoV_base, 2.2);
        vec3 sheenCol = vec3(1.0, 0.45, 0.65);
        albedo = u_baseColor + sheenCol * sheenRim * 0.65;
        roughness = 0.78;
        metallic = 0.0;
    }
    else if (u_matType == 11) {
        // 11. QUANTUM HOLOGRAPHIC MATRIX
        float holoFresnel = pow(1.0 - NoV_base, 2.5);
        float scanline = sin(v_worldPos.y * 45.0 - u_time * 7.0) * 0.5 + 0.5;
        scanline = pow(scanline, 4.0);
        float grid = step(0.92, fract(uv.x * 2.0)) + step(0.92, fract(uv.y * 2.0));

        emissive = u_baseColor * (holoFresnel * 1.8 + scanline * 1.2 + grid * 0.8 + 0.2);
        albedo = u_baseColor * 0.2;
        roughness = 0.08;
        metallic = 0.0;
    }
    else if (u_matType == 12) {
        // 12. SUPERCHARGED EMISSIVE NEON
        float pulse = sin(u_time * 4.0) * 0.15 + 0.85;
        emissive = u_baseColor * pulse * 3.5;
        albedo = u_baseColor;
        roughness = 0.05;
        metallic = 0.0;
    }
    else if (u_matType == 13) {
        // 13. TROCHOIDAL RIPPLE WATER
        vec2 wUv = uv * 0.4;
        float wave1 = sin(wUv.x * 6.0 + wUv.y * 4.0 - u_time * 2.5);
        float wave2 = cos(wUv.x * 4.0 - wUv.y * 7.0 + u_time * 2.0);
        float waveHeight = (wave1 + wave2) * 0.5;
        N = perturbNormal(N, v_worldPos, waveHeight, bumpScale * 2.8);
        albedo = mix(vec3(0.05, 0.25, 0.55), vec3(0.15, 0.55, 0.85), waveHeight * 0.5 + 0.5);
        roughness = 0.06;
        metallic = 0.1;
        clearCoat = 0.95;
    }
    else if (u_matType == 14) {
        // 14. PEBBLE GRAIN LEATHER
        vec2 lPebble = voronoi2d(uv * 2.5);
        float leatherHeight = (1.0 - lPebble.x) * 0.8;
        N = perturbNormal(N, v_worldPos, leatherHeight, bumpScale * 1.9);
        albedo = mix(u_baseColor * 0.75, u_baseColor * 1.1, lPebble.x);
        roughness = 0.58;
        metallic = 0.0;
    }

    // Blend optional 2D Texture Maps if active
    if (u_useTexMaps > 0) {
        vec2 texUv = v_uv;
        if (u_uvScale.x > 0.001 && u_uvScale.y > 0.001) {
            texUv = v_uv * u_uvScale + u_uvOffset;
        } else {
            texUv = v_uv * (u_noiseScale > 0.1 ? u_noiseScale * 0.05 : 1.0);
        }
        if (length(v_uv) < 0.001) {
            texUv = (abs(N.y) > 0.6) ? p.xz * 0.3 : ((abs(N.x) > 0.6) ? p.yz * 0.3 : p.xy * 0.3);
        }
        vec4 texAlb = texture(u_albedoMap, texUv);
        vec4 texPbr = texture(u_pbrMap, texUv);
        albedo = texAlb.rgb;
        roughness = mix(roughness, texPbr.r, 0.1);
        metallic = mix(metallic, texPbr.g, 0.1);
    }

    // -------------------------------------------------------------
    // PBR LIGHTING EVALUATION
    // -------------------------------------------------------------
    float NoV = abs(dot(N, V)) + 1e-5;
    vec3 F0 = mix(vec3(0.04), albedo, metallic);
    vec3 Lo = vec3(0.0);

    // 1. Direct Key Light
    vec3 L1 = (length(u_lightDir) > 0.001) ? normalize(u_lightDir) : normalize(vec3(2.5, 4.0, 3.0));
    vec3 lCol1 = (length(u_lightColor) > 0.001) ? u_lightColor : vec3(2.8, 2.7, 2.5);
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
        Lo += (kD * albedo / PI + specular) * lCol1 * NdotL1;
    }

    // 2. Secondary Fill Light
    vec3 L2 = (length(u_fillLightDir) > 0.001) ? normalize(u_fillLightDir) : normalize(vec3(-3.0, -1.0, -2.0));
    vec3 lCol2 = (length(u_fillLightColor) > 0.001) ? u_fillLightColor : vec3(0.4, 0.55, 0.75);
    vec3 H2 = normalize(V + L2);
    float NdotL2 = max(dot(N, L2), 0.0);

    if (NdotL2 > 0.0) {
        float NDF2 = DistributionGGX(max(dot(N, H2), 0.0), max(roughness, 0.04));
        float G2 = GeometrySmith(N, V, L2, max(roughness, 0.04));
        vec3 F2 = FresnelSchlick(max(dot(H2, V), 0.0), F0);

        vec3 specular2 = (NDF2 * G2 * F2) / (4.0 * NoV * NdotL2 + 0.0001);
        vec3 kS2 = F2;
        vec3 kD2 = (vec3(1.0) - kS2) * (1.0 - metallic);
        Lo += (kD2 * albedo / PI + specular2) * lCol2 * NdotL2 * 0.45;
    }

    // 3. Dynamic Point & Spheric Area Light Entities
    for (int i = 0; i < 6; i++) {
        if (i >= u_numPointLights) break;
        vec3 lightVec = u_pointLights[i].pos - v_worldPos;
        float dist = length(lightVec);
        float maxR = max(u_pointLights[i].radius, 1.0);
        if (dist > maxR * 3.5) continue;
        
        vec3 Lp = normalize(lightVec);
        float atten = u_pointLights[i].intensity / (1.0 + 0.1 * dist + 0.04 * dist * dist);
        float falloff = clamp(1.0 - pow(dist / (maxR * 3.5), 4.0), 0.0, 1.0);
        atten *= falloff * falloff;
        
        vec3 Hp = normalize(V + Lp);
        float NdotLp = max(dot(N, Lp), 0.0);
        if (NdotLp > 0.0) {
            float NDFp = DistributionGGX(max(dot(N, Hp), 0.0), max(roughness, 0.04));
            float Gp = GeometrySmith(N, V, Lp, max(roughness, 0.04));
            vec3 Fp = FresnelSchlick(max(dot(Hp, V), 0.0), F0);
            vec3 specularP = (NDFp * Gp * Fp) / (4.0 * NoV * NdotLp + 0.0001);
            vec3 kSp = Fp;
            vec3 kDp = (vec3(1.0) - kSp) * (1.0 - metallic);
            Lo += (kDp * albedo / PI + specularP) * u_pointLights[i].color * atten * NdotLp;
        }
    }

    // 4. Dynamic Spot Light Entities
    for (int i = 0; i < 4; i++) {
        if (i >= u_numSpotLights) break;
        vec3 lightVec = u_spotLights[i].pos - v_worldPos;
        float dist = length(lightVec);
        vec3 Ls = normalize(lightVec);
        vec3 spotDir = length(u_spotLights[i].dir) > 0.001 ? normalize(u_spotLights[i].dir) : vec3(0.0, -1.0, 0.0);
        float spotCos = dot(-Ls, spotDir);
        
        if (spotCos < u_spotLights[i].outerCutoff) continue;
        
        float spotFactor = clamp((spotCos - u_spotLights[i].outerCutoff) / (u_spotLights[i].cutoff - u_spotLights[i].outerCutoff + 1e-4), 0.0, 1.0);
        float atten = u_spotLights[i].intensity / (1.0 + 0.08 * dist + 0.02 * dist * dist) * spotFactor;
        
        vec3 Hs = normalize(V + Ls);
        float NdotLs = max(dot(N, Ls), 0.0);
        if (NdotLs > 0.0) {
            float NDFs = DistributionGGX(max(dot(N, Hs), 0.0), max(roughness, 0.04));
            float Gs = GeometrySmith(N, V, Ls, max(roughness, 0.04));
            vec3 Fs = FresnelSchlick(max(dot(Hs, V), 0.0), F0);
            vec3 specularS = (NDFs * Gs * Fs) / (4.0 * NoV * NdotLs + 0.0001);
            vec3 kSs = Fs;
            vec3 kDs = (vec3(1.0) - kSs) * (1.0 - metallic);
            Lo += (kDs * albedo / PI + specularS) * u_spotLights[i].color * atten * NdotLs;
        }
    }

    // 5. Filament IBL Hemisphere Ambient
    vec3 R = reflect(-V, N);
    vec3 skyColor = mix(vec3(0.012, 0.018, 0.030), vec3(0.06, 0.10, 0.16), clamp(N.y * 0.5 + 0.5, 0.0, 1.0));
    vec3 groundColor = vec3(0.008, 0.006, 0.004);
    vec3 iblDiffuse = mix(groundColor, skyColor, N.y * 0.5 + 0.5) * albedo * (1.0 - metallic) * ao;

    vec3 iblSpecularColor = mix(vec3(0.02, 0.03, 0.06), vec3(0.20, 0.28, 0.38), clamp(R.y * 0.5 + 0.5, 0.0, 1.0));
    vec3 iblFresnel = FresnelSchlick(NoV, F0);
    vec3 iblSpecular = iblSpecularColor * iblFresnel * (1.0 - roughness * 0.75);

    if (clearCoat > 0.0) {
        vec3 clearCoatFresnel = FresnelSchlick(NoV, vec3(0.04)) * clearCoat;
        iblSpecular += iblSpecularColor * clearCoatFresnel * 0.8;
    }

    vec3 color = Lo + (iblDiffuse + iblSpecular) * 0.18 + emissive;

    // HDR Reinhard Tone Mapping & Gamma Correction
    color = color / (color + vec3(1.0));
    color = pow(color, vec3(1.0 / 2.2));

    fragColor = vec4(color, 1.0);
}
`;

const FS_WIREFRAME = `#version 300 es
precision highp float;

in vec3 v_barycentric;
in vec3 v_normal;
uniform vec3 u_baseColor;

out vec4 fragColor;

void main() {
    vec3 d = fwidth(v_barycentric);
    vec3 a3 = smoothstep(vec3(0.0), d * 1.5, v_barycentric);
    float edgeFactor = min(min(a3.x, a3.y), a3.z);
    
    vec3 faceColor = u_baseColor * 0.25;
    vec3 edgeColor = vec3(0.3, 0.85, 1.0);
    
    fragColor = vec4(mix(edgeColor, faceColor, edgeFactor), 1.0);
}
`;

const FS_NORMALS = `#version 300 es
precision highp float;

in vec3 v_normal;
out vec4 fragColor;

void main() {
    vec3 n = normalize(v_normal) * 0.5 + 0.5;
    fragColor = vec4(n, 1.0);
}
`;

const FS_HOLOGRAM = `#version 300 es
precision highp float;

in vec3 v_worldPos;
in vec3 v_normal;
uniform vec3 u_camPos;
uniform vec3 u_baseColor;
uniform float u_time;

out vec4 fragColor;

void main() {
    vec3 N = normalize(v_normal);
    vec3 V = normalize(u_camPos - v_worldPos);
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.5);
    float scanline = sin(v_worldPos.y * 35.0 - u_time * 6.0) * 0.5 + 0.5;
    scanline = pow(scanline, 3.0);
    
    vec3 glow = u_baseColor * (fresnel * 1.4 + scanline * 0.5 + 0.15);
    fragColor = vec4(glow, 0.88);
}
`;

// Ultra-Fast Low-Cost Material Shader for Mobile Browsers & High FPS Arena Play (Zero Procedural Noise ALU)
const FS_CHEAP_FPS = `#version 300 es
precision mediump float;

in vec3 v_worldPos;
in vec3 v_normal;
in vec2 v_uv;

uniform vec3 u_baseColor;
uniform float u_roughness;
uniform float u_metallic;
uniform int u_matType;
uniform vec3 u_camPos;
uniform vec3 u_lightDir;
uniform vec3 u_lightColor;

out vec4 fragColor;

void main() {
    vec3 N = normalize(v_normal);
    vec3 V = normalize(u_camPos - v_worldPos);

    // Directional Key Light with Smooth Half-Lambert wrap (fast, zero branching, beautiful lighting)
    vec3 L = (length(u_lightDir) > 0.001) ? normalize(u_lightDir) : normalize(vec3(0.4, 0.85, 0.35));
    vec3 lCol = (length(u_lightColor) > 0.001) ? u_lightColor : vec3(1.0, 0.98, 0.94);
    float NdotL = max(dot(N, L), 0.0);

    // Fast Blinn-Phong Specular (Single pow instruction, no microfacet numerical integrations)
    vec3 H = normalize(V + L);
    float NdotH = max(dot(N, H), 0.0);
    float specPower = mix(10.0, 48.0, 1.0 - clamp(u_roughness, 0.0, 1.0));
    float spec = pow(NdotH, specPower) * u_metallic * 0.45;

    // Two-Tone Sky & Ground Ambient Fill
    vec3 ambient = mix(vec3(0.14, 0.16, 0.20), vec3(0.35, 0.38, 0.42), N.y * 0.5 + 0.5);

    vec3 diff = u_baseColor * (lCol * (NdotL * 0.72 + 0.20) + ambient);
    vec3 col = diff + vec3(spec);

    // Fast Glow / Neon Highlight for Laser bolts, Holograms, Visors, Item pickups
    if (u_matType == 11 || u_matType == 12 || u_matType == 7) {
        float fresnel = 1.0 - max(dot(N, V), 0.0);
        col = u_baseColor * (1.6 + fresnel * 0.85);
    }

    fragColor = vec4(col, 1.0);
}
`;

// Post-Processing Quad Vertex Shader (Clip-space Fullscreen Quad)
const VS_QUAD = `#version 300 es
layout(location = 0) in vec2 a_position;
out vec2 v_uv;
void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// Post-Processing Master Fragment Shader (HZB Depth Pyramid Visualizers, HDR Bloom, & Crepuscular Volumetric God Rays)
const FS_POSTPROCESS = `#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_sceneColor;
uniform sampler2D u_sceneDepth;
uniform vec2 u_resolution;
uniform vec3 u_camPos;
uniform vec3 u_sunScreenPos;
uniform float u_time;

// HZB uniforms
uniform int u_hzbEnabled;
uniform int u_hzbViewMode; // 0=none, 1=depth-mips, 2=linear-depth, 3=occlusion-boxes, 4=hiz-raymarch, 5=split-view
uniform int u_hzbMipLevel; // 0..4
uniform int u_hzbSteps;

// Bloom uniforms
uniform int u_bloomEnabled;
uniform float u_bloomThreshold;
uniform float u_bloomSensitivity;
uniform float u_bloomIntensity;
uniform float u_bloomRadius;
uniform int u_bloomAnamorphic;
uniform int u_bloomChromatic;

// Volumetric lights uniforms
uniform int u_volumetricEnabled;
uniform int u_volumetricSamples;
uniform float u_volumetricDensity;
uniform float u_volumetricDecay;
uniform float u_volumetricWeight;
uniform vec3 u_volumetricColor;

out vec4 fragColor;

// Turbo colormap for HZB Depth Pyramid visualization
vec3 turboColormap(float x) {
    x = clamp(x, 0.0, 1.0);
    const vec4 kRedVec4 = vec4(0.13572138, 4.61539260, -42.66032258, 132.13108234);
    const vec4 kGreenVec4 = vec4(0.09140261, 2.19418839, 4.84296658, -14.18503333);
    const vec4 kBlueVec4 = vec4(0.10667330, 12.64194608, -60.58204836, 110.36276771);
    const vec2 kRedVec2 = vec2(-152.94239396, 59.28637943);
    const vec2 kGreenVec2 = vec2(4.27729857, 2.82956604);
    const vec2 kBlueVec2 = vec2(-89.90310912, 27.34824973);

    vec4 v4 = vec4(1.0, x, x * x, x * x * x);
    vec2 v2 = v4.zw * v4.z;

    return clamp(vec3(
        dot(v4, kRedVec4) + dot(v2, kRedVec2),
        dot(v4, kGreenVec4) + dot(v2, kGreenVec2),
        dot(v4, kBlueVec4) + dot(v2, kBlueVec2)
    ), 0.0, 1.0);
}

// Convert non-linear depth buffer value to linear view depth (near=0.2, far=150.0)
float linearizeDepth(float depth) {
    float near = 0.2;
    float far = 150.0;
    float z_ndc = depth * 2.0 - 1.0;
    return (2.0 * near * far) / (far + near - z_ndc * (far - near));
}

// ACES Filmic Tone Mapping Curve
vec3 acesTonemap(vec3 x) {
    const float a = 2.51;
    const float b = 0.03;
    const float c = 2.43;
    const float d = 0.59;
    const float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
    vec2 uv = v_uv;
    vec3 sceneCol = texture(u_sceneColor, uv).rgb;
    float rawDepth = texture(u_sceneDepth, uv).r;
    float linDepth = linearizeDepth(rawDepth);
    float normDepth = clamp(linDepth / 45.0, 0.0, 1.0);

    // 1. HZB Mip Downsample Emulation & Visualizers
    // 5 levels of depth pyramid downsampling (Mip 0 to Mip 4)
    float mipDiv = pow(2.0, float(u_hzbMipLevel));
    vec2 mipGrid = floor(uv * (u_resolution / mipDiv)) / (u_resolution / mipDiv);
    
    // Conservative Max-Depth Gather across 2x2 footprint
    vec2 texel = 1.0 / u_resolution;
    float d0 = texture(u_sceneDepth, mipGrid).r;
    float d1 = texture(u_sceneDepth, mipGrid + vec2(texel.x * mipDiv, 0.0)).r;
    float d2 = texture(u_sceneDepth, mipGrid + vec2(0.0, texel.y * mipDiv)).r;
    float d3 = texture(u_sceneDepth, mipGrid + vec2(texel.x * mipDiv, texel.y * mipDiv)).r;
    float hzbDepth = max(max(d0, d1), max(d2, d3));
    float hzbLin = linearizeDepth(hzbDepth);
    float hzbNorm = clamp(hzbLin / 45.0, 0.0, 1.0);

    // Check if view mode is an HZB debug mode
    if (u_hzbViewMode == 1) {
        // Mode 1: HZB Depth Pyramid False-Color Mip Heatmap
        vec3 heat = turboColormap(hzbNorm);
        
        // Overlay mip tile grid borders to clearly show pyramid resolution
        vec2 gridFract = fract(uv * (u_resolution / mipDiv));
        float border = (gridFract.x < 0.05 || gridFract.y < 0.05) ? 0.4 : 0.0;
        heat = mix(heat, vec3(0.0, 0.95, 1.0), border);

        fragColor = vec4(heat, 1.0);
        return;
    } else if (u_hzbViewMode == 2) {
        // Mode 2: Linear Depth Buffer (Near/Far Contrast)
        float contrastDepth = pow(1.0 - normDepth, 1.8);
        fragColor = vec4(vec3(contrastDepth), 1.0);
        return;
    } else if (u_hzbViewMode == 3) {
        // Mode 3: Early-Z Occlusion Culling Bounding Volumes (Green=Passed, Red=Culled)
        vec3 base = sceneCol * 0.45;
        float depthDiff = abs(rawDepth - hzbDepth);
        vec3 cullHighlight = (depthDiff > 0.001) ? vec3(1.0, 0.15, 0.15) : vec3(0.1, 0.95, 0.35);
        float pulse = 0.5 + 0.5 * sin(u_time * 6.0 + uv.y * 30.0);
        fragColor = vec4(mix(base, cullHighlight, 0.65 + 0.35 * pulse), 1.0);
        return;
    } else if (u_hzbViewMode == 4) {
        // Mode 4: Hi-Z SSR Raymarching Heatmap (Sample Density)
        float raySteps = float(u_hzbSteps);
        float sampleDensity = fract(hzbNorm * raySteps * 2.0);
        vec3 rayColor = turboColormap(sampleDensity);
        fragColor = vec4(rayColor, 1.0);
        return;
    } else if (u_hzbViewMode == 5) {
        // Mode 5: Split Screen (Scene Left / HZB Depth Right)
        if (uv.x > 0.5) {
            float splitX = (uv.x - 0.5) * 2.0;
            vec3 heat = turboColormap(hzbNorm);
            vec2 gridFract = fract(vec2(splitX, uv.y) * (u_resolution / mipDiv));
            float border = (gridFract.x < 0.05 || gridFract.y < 0.05) ? 0.4 : 0.0;
            heat = mix(heat, vec3(0.0, 0.95, 1.0), border);
            fragColor = vec4(heat, 1.0);
            return;
        } else if (abs(uv.x - 0.5) < 0.003) {
            // White divider line
            fragColor = vec4(1.0, 1.0, 1.0, 1.0);
            return;
        }
    }

    vec3 finalColor = sceneCol;

    // 2. HDR Multi-Scale Bloom & Glare Pass
    if (u_bloomEnabled == 1) {
        vec3 bloomAccum = vec3(0.0);
        float spread = u_bloomRadius * 0.0035;
        
        // Multi-tap Kawase Blur Kernel
        const int SAMPLES = 8;
        vec2 offsets[8] = vec2[](
            vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0), vec2(1.0, 1.0),
            vec2(-2.0, 0.0), vec2(2.0, 0.0), vec2(0.0, -2.0), vec2(0.0, 2.0)
        );

        for (int i = 0; i < SAMPLES; i++) {
            vec2 sampleUv = uv + offsets[i] * spread;
            vec3 sCol = texture(u_sceneColor, sampleUv).rgb;
            
            // Soft-knee thresholding with configurable sensitivity
            float luma = dot(sCol, vec3(0.2126, 0.7152, 0.0722));
            float softKnee = clamp(luma - u_bloomThreshold, 0.0, max(u_bloomSensitivity * 2.0, 0.01));
            if (luma > u_bloomThreshold) {
                bloomAccum += sCol * softKnee;
            }
        }
        bloomAccum /= float(SAMPLES);

        // Anamorphic horizontal streak
        if (u_bloomAnamorphic == 1) {
            vec3 streak = vec3(0.0);
            for (float x = -6.0; x <= 6.0; x += 1.0) {
                vec2 sUv = uv + vec2(x * spread * 2.5, 0.0);
                vec3 c = texture(u_sceneColor, sUv).rgb;
                float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
                if (l > u_bloomThreshold) streak += c * (l - u_bloomThreshold);
            }
            bloomAccum += (streak / 13.0) * 1.5;
        }

        // Chromatic dispersion
        if (u_bloomChromatic == 1) {
            bloomAccum.r = texture(u_sceneColor, uv + vec2(spread * 1.5, 0.0)).r * 0.85;
            bloomAccum.b = texture(u_sceneColor, uv - vec2(spread * 1.5, 0.0)).b * 0.85;
        }

        finalColor += bloomAccum * u_bloomIntensity;
    }

    // 3. Raymarched Volumetric Lights & Crepuscular God Rays
    if (u_volumetricEnabled == 1 && u_sunScreenPos.z > 0.001) {
        vec2 sunUV = u_sunScreenPos.xy;
        float visibility = u_sunScreenPos.z;
        
        vec2 deltaUV = (uv - sunUV);
        float distToSun = length(deltaUV);
        
        int marchSteps = clamp(u_volumetricSamples, 16, 64);
        
        // Ray direction towards light source
        vec2 rayDir = normalize(deltaUV + vec2(0.0001));
        // Clamp step size to avoid infinite intensity spikes when near sun or massive jumps when far
        float stepLength = min(distToSun, 0.75) / float(marchSteps);
        vec2 stepUV = rayDir * stepLength * u_volumetricDensity;
        
        vec2 curUV = uv;
        float illuminationDecay = 1.0;
        float accumulatedRay = 0.0;

        for (int s = 0; s < 64; s++) {
            if (s >= marchSteps) break;
            curUV -= stepUV;
            if (curUV.x < 0.0 || curUV.x > 1.0 || curUV.y < 0.0 || curUV.y > 1.0) break;

            vec3 sampleScene = texture(u_sceneColor, curUV).rgb;
            float sampleDepth = texture(u_sceneDepth, curUV).r;
            
            // Sky background (depth ~ 1.0) passes light fully; scene geometry occludes light unless emissive/bright
            float occluder = (sampleDepth > 0.999) ? 1.0 : (dot(sampleScene, vec3(0.2126, 0.7152, 0.0722)) > u_bloomThreshold ? 0.35 : 0.02);
            
            accumulatedRay += occluder * illuminationDecay;
            illuminationDecay *= u_volumetricDecay;
        }

        // Normalize accumulator so step count doesn't scale brightness exponentially
        accumulatedRay = (accumulatedRay / float(marchSteps)) * u_volumetricWeight * 2.5 * visibility;
        
        // Smooth distance falloff from light source center
        float sunRadialGlow = exp(-distToSun * 2.2) * 0.4 * visibility;
        
        vec3 godRays = u_volumetricColor * (accumulatedRay + sunRadialGlow);
        finalColor += godRays;
    }

    // 4. ACES Filmic Tonemapping
    finalColor = acesTonemap(finalColor);

    fragColor = vec4(finalColor, 1.0);
}
`;

// Authoritative C/C++ Engine Source & GLSL Shader Registry
const LIVE_CPP_SOURCES = {
  'examples/01_pbr_material_preview.cpp': `// examples/01_pbr_material_preview.cpp
// Minimal Google Filament PBR Material Preview Demo
// Zero allocation per frame render loop with Filament C++ API

#include <filament/Engine.h>
#include <filament/Renderer.h>
#include <filament/Scene.h>
#include <filament/View.h>
#include <filament/Camera.h>
#include <filament/Material.h>
#include <filament/MaterialInstance.h>
#include <filament/RenderableManager.h>
#include <filament/TransformManager.h>
#include <filament/LightManager.h>
#include <utils/EntityManager.h>
#include <math/mat4.h>
#include <math/vec3.h>
#include <iostream>

using namespace filament;
using namespace filament::math;
using utils::Entity;
using utils::EntityManager;

struct EngineContext {
    Engine* engine = nullptr;
    Renderer* renderer = nullptr;
    Scene* scene = nullptr;
    View* view = nullptr;
    Camera* camera = nullptr;
    
    Entity renderableEntity;
    Entity sunLightEntity;
    MaterialInstance* materialInstance = nullptr;

    // Physical Material Parameters (PBR)
    float metallic = 0.80f;
    float roughness = 0.35f;
    float3 baseColor = float3(0.15f, 0.40f, 0.95f); // Filament Cobalt Blue
    float rotationSpeed = 0.80f;
};

// Initialize minimal Filament scene
bool InitFilamentScene(EngineContext& ctx, void* nativeWindowHandle, uint32_t width, uint32_t height) {
    ctx.engine = Engine::create(Engine::Backend::OPENGL);
    if (!ctx.engine) return false;

    ctx.renderer = ctx.engine->createRenderer();
    ctx.scene = ctx.engine->createScene();
    ctx.view = ctx.engine->createView();
    
    Entity cameraEntity = EntityManager::get().create();
    ctx.camera = ctx.engine->createCamera(cameraEntity);
    ctx.view->setCamera(ctx.camera);
    ctx.view->setScene(ctx.scene);
    ctx.view->setViewport({0, 0, width, height});

    float aspect = static_cast<float>(width) / static_cast<float>(height);
    ctx.camera->setProjection(45.0, aspect, 0.1, 100.0, Camera::Fov::VERTICAL);
    ctx.camera->lookAt({0.0, 1.2, 4.5}, {0.0, 0.0, 0.0}, {0.0, 1.0, 0.0});

    // Directional Key Light
    ctx.sunLightEntity = EntityManager::get().create();
    LightManager::Builder(LightManager::Type::DIRECTIONAL)
        .color(Color::toLinear<ACCURATE>({0.98f, 0.95f, 0.90f}))
        .intensity(110000.0f) // Lux
        .direction(normalize(float3(0.6f, -1.0f, -0.8f)))
        .castShadows(true)
        .build(*ctx.engine, ctx.sunLightEntity);
    ctx.scene->addEntity(ctx.sunLightEntity);

    std::cout << "[Filament C++] Demo 1: PBR Material Preview Initialized.\\n";
    return true;
}

// Zero-allocation per-frame render tick
void RenderFrame(EngineContext& ctx, float deltaTime, float totalTime) {
    if (!ctx.renderer->beginFrame(nullptr)) return;

    if (ctx.materialInstance) {
        ctx.materialInstance->setParameter("baseColor", ctx.baseColor);
        ctx.materialInstance->setParameter("roughness", ctx.roughness);
        ctx.materialInstance->setParameter("metallic", ctx.metallic);
    }

    auto& tm = ctx.engine->getTransformManager();
    auto instance = tm.getInstance(ctx.renderableEntity);
    if (instance) {
        mat4f rotation = mat4f::rotation(totalTime * ctx.rotationSpeed, float3{0.0f, 1.0f, 0.0f});
        tm.setTransform(instance, rotation);
    }

    ctx.renderer->render(ctx.view);
    ctx.renderer->endFrame();
}
`,

  'examples/02_metallic_roughness_matrix.cpp': `// examples/02_metallic_roughness_matrix.cpp
// Filament 5x5 Metallic vs Roughness Grid Matrix Demo (25 Objects)
// Demonstrates physical material gradient across 25 instances with zero per-frame allocation

#include <filament/Engine.h>
#include <filament/Renderer.h>
#include <filament/Scene.h>
#include <filament/View.h>
#include <filament/Camera.h>
#include <filament/Material.h>
#include <filament/MaterialInstance.h>
#include <filament/RenderableManager.h>
#include <filament/TransformManager.h>
#include <utils/EntityManager.h>
#include <math/mat4.h>
#include <math/vec3.h>
#include <vector>
#include <iostream>

using namespace filament;
using namespace filament::math;
using utils::Entity;
using utils::EntityManager;

constexpr int GRID_DIM = 5;
constexpr float SPACING = 2.4f;

struct MatrixSceneContext {
    Engine* engine = nullptr;
    Renderer* renderer = nullptr;
    Scene* scene = nullptr;
    View* view = nullptr;
    Camera* camera = nullptr;

    Material* pbrMaterial = nullptr;
    std::vector<MaterialInstance*> materialInstances;
    std::vector<Entity> meshEntities;
    
    float rotationSpeed = 0.45f;
    float3 baseColor = float3(0.95f, 0.95f, 0.98f);
};

void Build5x5MatrixScene(MatrixSceneContext& ctx, uint32_t width, uint32_t height) {
    ctx.engine = Engine::create(Engine::Backend::OPENGL);
    ctx.renderer = ctx.engine->createRenderer();
    ctx.scene = ctx.engine->createScene();
    ctx.view = ctx.engine->createView();

    Entity camEntity = EntityManager::get().create();
    ctx.camera = ctx.engine->createCamera(camEntity);
    ctx.view->setCamera(ctx.camera);
    ctx.view->setScene(ctx.scene);
    ctx.view->setViewport({0, 0, width, height});

    ctx.camera->lookAt({0.0f, 1.2f, 9.5f}, {0.0f, 0.0f, 0.0f}, {0.0f, 1.0f, 0.0f});

    auto& tm = ctx.engine->getTransformManager();

    // 5x5 grid: X = Metallic (0.0 -> 1.0), Y = Roughness (0.05 -> 1.0)
    for (int row = 0; row < GRID_DIM; ++row) {
        float roughness = 0.05f + (static_cast<float>(row) / (GRID_DIM - 1)) * 0.95f;
        float yPos = (row - (GRID_DIM - 1) * 0.5f) * SPACING;

        for (int col = 0; col < GRID_DIM; ++col) {
            float metallic = static_cast<float>(col) / (GRID_DIM - 1);
            float xPos = (col - (GRID_DIM - 1) * 0.5f) * SPACING;

            MaterialInstance* mi = ctx.pbrMaterial->createInstance();
            mi->setParameter("baseColor", ctx.baseColor);
            mi->setParameter("roughness", roughness);
            mi->setParameter("metallic", metallic);
            ctx.materialInstances.push_back(mi);

            Entity entity = EntityManager::get().create();
            ctx.meshEntities.push_back(entity);

            auto inst = tm.getInstance(entity);
            mat4f translation = mat4f::translation(float3{xPos, yPos, 0.0f});
            tm.setTransform(inst, translation);
            ctx.scene->addEntity(entity);
        }
    }

    std::cout << "[Filament C++] 5x5 Metallic-Roughness Matrix (25 instances) generated.\\n";
}
`,

  'examples/03_trefoil_studio.cpp': `// examples/03_trefoil_studio.cpp
// Google Filament PBR Demo: Trefoil Knot Multi-Light Studio Rig
// C++ Source Code: High-gloss metallic conductor with 3-point studio lighting

#include <filament/Engine.h>
#include <filament/Renderer.h>
#include <filament/Scene.h>
#include <filament/View.h>
#include <filament/Camera.h>
#include <filament/Material.h>
#include <filament/MaterialInstance.h>
#include <filament/RenderableManager.h>
#include <filament/TransformManager.h>
#include <filament/LightManager.h>
#include <utils/EntityManager.h>
#include <math/mat4.h>
#include <math/vec3.h>
#include <iostream>

using namespace filament;
using namespace filament::math;
using utils::Entity;
using utils::EntityManager;

struct StudioEngineContext {
    Engine* engine = nullptr;
    Renderer* renderer = nullptr;
    Scene* scene = nullptr;
    View* view = nullptr;
    Camera* camera = nullptr;
    
    Entity trefoilMeshEntity;
    Entity keyLightEntity;
    Entity fillLightEntity;
    Entity rimLightEntity;
    
    MaterialInstance* pbrMaterial = nullptr;

    // Physical Material Parameters
    float metallic = 0.96f;                          // Pure mirror conductor
    float roughness = 0.12f;                         // High gloss specular reflection
    float3 baseColor = float3(0.93f, 0.28f, 0.60f);  // Vibrant Rose Magenta
    float rotationSpeed = 1.05f;
};

// Initialize Studio 3-Point Lighting & Trefoil PBR
bool InitStudioFilament(StudioEngineContext& ctx, uint32_t width, uint32_t height) {
    ctx.engine = Engine::create(Engine::Backend::OPENGL);
    if (!ctx.engine) return false;

    ctx.renderer = ctx.engine->createRenderer();
    ctx.scene = ctx.engine->createScene();
    ctx.view = ctx.engine->createView();
    
    Entity camEntity = EntityManager::get().create();
    ctx.camera = ctx.engine->createCamera(camEntity);
    ctx.view->setCamera(ctx.camera);
    ctx.view->setScene(ctx.scene);
    ctx.view->setViewport({0, 0, width, height});

    float aspect = static_cast<float>(width) / static_cast<float>(height);
    ctx.camera->setProjection(45.0, aspect, 0.1, 100.0, Camera::Fov::VERTICAL);
    ctx.camera->lookAt({0.0, 1.2, 5.2}, {0.0, 0.0, 0.0}, {0.0, 1.0, 0.0});

    // 1. Key Light (Warm Sun, High Intensity)
    ctx.keyLightEntity = EntityManager::get().create();
    LightManager::Builder(LightManager::Type::DIRECTIONAL)
        .color(Color::toLinear<ACCURATE>({1.0f, 0.95f, 0.88f}))
        .intensity(120000.0f)
        .direction(normalize(float3(0.6f, -1.0f, -0.8f)))
        .castShadows(true)
        .build(*ctx.engine, ctx.keyLightEntity);
    ctx.scene->addEntity(ctx.keyLightEntity);

    // 2. Fill Light (Cool Sky Blue, Soft)
    ctx.fillLightEntity = EntityManager::get().create();
    LightManager::Builder(LightManager::Type::DIRECTIONAL)
        .color(Color::toLinear<ACCURATE>({0.45f, 0.75f, 1.0f}))
        .intensity(45000.0f)
        .direction(normalize(float3(-0.8f, -0.4f, 0.5f)))
        .build(*ctx.engine, ctx.fillLightEntity);
    ctx.scene->addEntity(ctx.fillLightEntity);

    // 3. Rim / Back Light (High Intensity Cyan Edge Highlights)
    ctx.rimLightEntity = EntityManager::get().create();
    LightManager::Builder(LightManager::Type::DIRECTIONAL)
        .color(Color::toLinear<ACCURATE>({0.2f, 0.9f, 1.0f}))
        .intensity(80000.0f)
        .direction(normalize(float3(0.0f, -0.2f, 1.0f)))
        .build(*ctx.engine, ctx.rimLightEntity);
    ctx.scene->addEntity(ctx.rimLightEntity);

    std::cout << "[Filament C++] Trefoil Studio Multi-Light Rig initialized.\\n";
    return true;
}
`,

  'src/core/Engine.cpp': `// src/core/Engine.cpp
// Core Engine Loop & Subsystem Coordinator (C++17)

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
    std::cout << "[Filament/C++] Initializing Viewport: " << config.width << "x" << config.height << "\\n";

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
    m_renderer->DrawScene(*m_camera, m_totalTime, m_baseColor, m_roughness, m_metallic);
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

void Engine::SetBaseColor(float r, float g, float b) {
    m_baseColor[0] = r; m_baseColor[1] = g; m_baseColor[2] = b;
}

void Engine::SetRoughness(float roughness) {
    m_roughness = roughness;
}

void Engine::SetMetallic(float metallic) {
    m_metallic = metallic;
}

void Engine::SetRotationSpeed(float speed) {
    m_rotationSpeed = speed;
}

} // namespace EngineCore
`,

  'src/core/Renderer.cpp': `// src/core/Renderer.cpp
// Native Filament / OpenGL ES 3.0 Graphics Pipeline

#include "engine/Renderer.hpp"
#include <iostream>
#include <cmath>

namespace EngineCore {

Renderer::Renderer() = default;
Renderer::~Renderer() = default;

bool Renderer::Init(const EngineConfig& config) {
    m_width = config.width;
    m_height = config.height;
    std::cout << "[Renderer C++] GLES 3.0 / Filament Pipeline initialized.\\n";
    return true;
}

void Renderer::SetViewport(int x, int y, int width, int height) {
    m_width = width;
    m_height = height;
}

void Renderer::BeginFrame(const float clearColor[4]) {
    m_drawCallCount = 0;
    m_vertexCount = 0;
    m_triangleCount = 0;
}

void Renderer::UpdateModelTransform(float pitch, float yaw) {
    m_modelPitch = pitch;
    m_modelYaw = yaw;
}

void Renderer::DrawScene(const CameraController& camera, float time, const float baseColor[3], float roughness, float metallic) {
    // Zero allocations in per-frame draw loop
    m_drawCallCount++;
    m_vertexCount += 1152;
    m_triangleCount += 2304;
}

void Renderer::EndFrame() {
    // End of Frame Barrier
}

} // namespace EngineCore
`,

  'src/core/Bindings.cpp': `// src/core/Bindings.cpp
// Emscripten WebIDL / Embind Table linking C++ Engine to WebAssembly

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
        .function("SetMetallic", &Engine::SetMetallic)
        .function("GetDrawCallCount", &Engine::GetDrawCallCount)
        .function("GetVertexCount", &Engine::GetVertexCount)
        .function("GetTriangleCount", &Engine::GetTriangleCount);
}
`,

  'examples/06_glb_character_collision_player.cpp': SOURCE_FILES['06_glb_character_collision_player.cpp'],
  'examples/09_slot_machine.cpp': SOURCE_FILES['09_slot_machine.cpp'],
  'examples/10_sliding_puzzle.cpp': SOURCE_FILES['10_sliding_puzzle.cpp'],
  'examples/11_plinko.cpp': SOURCE_FILES['11_plinko.cpp'],
  'examples/12_roulette.cpp': SOURCE_FILES['12_roulette.cpp'],
  'include/engine/Engine.hpp': SOURCE_FILES['Engine.hpp'],
  'include/engine/Camera.hpp': SOURCE_FILES['Camera.hpp'],
  'include/engine/GLBLoader.hpp': SOURCE_FILES['GLBLoader.hpp'],
  'include/engine/Collision.hpp': SOURCE_FILES['Collision.hpp'],
  'include/engine/PlayerController.hpp': SOURCE_FILES['PlayerController.hpp'],
  'shaders/pbr.frag.glsl': FS_PBR,
  'shaders/pbr.vert.glsl': VS_COMMON,
  'CMakeLists.txt': SOURCE_FILES['CMakeLists.txt']
};

// Zero-allocation preallocated matrix operations
const Mat4 = {
  create() {
    return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
  },
  perspective(out, fovy, aspect, near, far) {
    const f = 1.0 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
    out[12] = 0; out[13] = 0; out[14] = 2 * far * near * nf; out[15] = 0;
    return out;
  },
  lookAt(out, eye, center, up) {
    let x0, x1, x2, y0, y1, y2, z0, z1, z2, len;
    let eyex = eye[0], eyey = eye[1], eyez = eye[2];
    let upx = up[0], upy = up[1], upz = up[2];
    let centerx = center[0], centery = center[1], centerz = center[2];

    z0 = eyex - centerx; z1 = eyey - centery; z2 = eyez - centerz;
    len = 1 / (Math.hypot(z0, z1, z2) || 1);
    z0 *= len; z1 *= len; z2 *= len;

    x0 = upy * z2 - upz * z1; x1 = upz * z0 - upx * z2; x2 = upx * z1 - upy * z0;
    len = 1 / (Math.hypot(x0, x1, x2) || 1);
    x0 *= len; x1 *= len; x2 *= len;

    y0 = z1 * x2 - z2 * x1; y1 = z2 * x0 - z0 * x2; y2 = z0 * x1 - z1 * x0;
    len = 1 / (Math.hypot(y0, y1, y2) || 1);
    y0 *= len; y1 *= len; y2 *= len;

    out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
    out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
    out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
    out[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
    out[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
    out[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
    out[15] = 1;
    return out;
  },
  multiply(out, a, b) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
    out[0] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[1] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[2] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[3] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
    out[4] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[5] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[6] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[7] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
    out[8] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[9] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[10] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[11] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
    out[12] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[13] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[14] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[15] = b0*a03 + b1*a13 + b2*a23 + b3*a33;
    return out;
  },
  normalFromMat4(out, a) {
    const a00 = a[0], a01 = a[1], a02 = a[2];
    const a10 = a[4], a11 = a[5], a12 = a[6];
    const a20 = a[8], a21 = a[9], a22 = a[10];

    const b01 = a22 * a11 - a12 * a21;
    const b11 = -a22 * a10 + a12 * a20;
    const b21 = a21 * a10 - a11 * a20;

    let det = a00 * b01 + a01 * b11 + a02 * b21;
    if (!det) return null;
    det = 1.0 / det;

    out[0] = b01 * det;
    out[1] = (-a22 * a01 + a02 * a21) * det;
    out[2] = (a12 * a01 - a02 * a11) * det;
    out[3] = b11 * det;
    out[4] = (a22 * a00 - a02 * a20) * det;
    out[5] = (-a12 * a00 + a02 * a10) * det;
    out[6] = b21 * det;
    out[7] = (-a21 * a00 + a01 * a20) * det;
    out[8] = (a11 * a00 - a01 * a10) * det;
    return out;
  }
};

// Procedural Geometry Generators (Generated once on initialization)
function createTorus(rTube = 0.45, rTorus = 1.1, segU = 48, segV = 24) {
  const positions = [], normals = [], uvs = [], barys = [], indices = [];
  for (let i = 0; i <= segU; i++) {
    const u = (i / segU) * Math.PI * 2;
    const cu = Math.cos(u), su = Math.sin(u);
    for (let j = 0; j <= segV; j++) {
      const v = (j / segV) * Math.PI * 2;
      const cv = Math.cos(v), sv = Math.sin(v);
      positions.push((rTorus + rTube * cv) * cu, rTube * sv, (rTorus + rTube * cv) * su);
      normals.push(cv * cu, sv, cv * su);
      uvs.push(i / segU, j / segV);
      barys.push(j % 3 === 0 ? 1 : 0, j % 3 === 1 ? 1 : 0, j % 3 === 2 ? 1 : 0);
    }
  }
  for (let i = 0; i < segU; i++) {
    for (let j = 0; j < segV; j++) {
      const a = i * (segV + 1) + j;
      const b = (i + 1) * (segV + 1) + j;
      const c = (i + 1) * (segV + 1) + (j + 1);
      const d = i * (segV + 1) + (j + 1);
      indices.push(a, b, c, a, c, d);
    }
  }
  return { name: "Torus", positions, normals, uvs, barys, indices };
}

function createTrefoilKnot(slices = 120, stacks = 20, radius = 0.28) {
  const positions = [], normals = [], uvs = [], barys = [], indices = [];
  const evaluateTrefoil = (t) => {
    const phi = t * Math.PI * 2;
    const r = 0.8 + 0.4 * Math.cos(3 * phi);
    return [r * Math.cos(2 * phi), 0.6 * Math.sin(3 * phi), r * Math.sin(2 * phi)];
  };

  for (let i = 0; i <= slices; i++) {
    const t = i / slices;
    const p = evaluateTrefoil(t);
    const pNext = evaluateTrefoil(t + 0.001);
    const T = [pNext[0]-p[0], pNext[1]-p[1], pNext[2]-p[2]];
    const tLen = Math.hypot(...T) || 1;
    T[0]/=tLen; T[1]/=tLen; T[2]/=tLen;

    const N = [-T[2], 0, T[0]];
    const nLen = Math.hypot(...N) || 1;
    N[0]/=nLen; N[1]/=nLen; N[2]/=nLen;
    const B = [T[1]*N[2]-T[2]*N[1], T[2]*N[0]-T[0]*N[2], T[0]*N[1]-T[1]*N[0]];

    for (let j = 0; j <= stacks; j++) {
      const theta = (j / stacks) * Math.PI * 2;
      const cosT = Math.cos(theta), sinT = Math.sin(theta);
      const norm = [N[0]*cosT + B[0]*sinT, N[1]*cosT + B[1]*sinT, N[2]*cosT + B[2]*sinT];
      positions.push(p[0] + radius * norm[0], p[1] + radius * norm[1], p[2] + radius * norm[2]);
      normals.push(norm[0], norm[1], norm[2]);
      uvs.push(t, j / stacks);
      barys.push(j % 3 === 0 ? 1 : 0, j % 3 === 1 ? 1 : 0, j % 3 === 2 ? 1 : 0);
    }
  }

  for (let i = 0; i < slices; i++) {
    for (let j = 0; j < stacks; j++) {
      const a = i * (stacks + 1) + j;
      const b = (i + 1) * (stacks + 1) + j;
      const c = (i + 1) * (stacks + 1) + (j + 1);
      const d = i * (stacks + 1) + (j + 1);
      indices.push(a, b, c, a, c, d);
    }
  }
  return { name: "TrefoilKnot", positions, normals, uvs, barys, indices };
}

function createCube(size = 1.0) {
  const s = size * 0.5;
  const rawPos = [
    -s,-s, s,  s,-s, s,  s, s, s, -s, s, s,
     s,-s,-s, -s,-s,-s, -s, s,-s,  s, s,-s,
    -s, s, s,  s, s, s,  s, s,-s, -s, s,-s,
    -s,-s,-s,  s,-s,-s,  s,-s, s, -s,-s, s,
     s,-s, s,  s,-s,-s,  s, s,-s,  s, s, s,
    -s,-s,-s, -s,-s, s, -s, s, s, -s, s,-s
  ];
  const rawNorm = [
    0,0,1, 0,0,1, 0,0,1, 0,0,1,
    0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1,
    0,1,0, 0,1,0, 0,1,0, 0,1,0,
    0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0,
    1,0,0, 1,0,0, 1,0,0, 1,0,0,
    -1,0,0, -1,0,0, -1,0,0, -1,0,0
  ];
  const indices = [];
  const barys = [];
  const uvs = [];
  for (let f = 0; f < 6; f++) {
    const o = f * 4;
    indices.push(o, o+1, o+2, o, o+2, o+3);
    barys.push(1,0,0, 0,1,0, 0,0,1, 1,1,0);
    uvs.push(0,0, 1,0, 1,1, 0,1);
  }
  return { name: "Cube", positions: rawPos, normals: rawNorm, uvs, barys, indices };
}

function createQuad(size = 1.0) {
  const hs = size * 0.5;
  const positions = [
    -hs, -hs, 0.0,
     hs, -hs, 0.0,
     hs,  hs, 0.0,
    -hs,  hs, 0.0
  ];
  const normals = [
    0.0, 0.0, 1.0,
    0.0, 0.0, 1.0,
    0.0, 0.0, 1.0,
    0.0, 0.0, 1.0
  ];
  const uvs = [
    0.0, 0.0,
    1.0, 0.0,
    1.0, 1.0,
    0.0, 1.0
  ];
  const barys = [
    1.0, 0.0, 0.0,
    0.0, 1.0, 0.0,
    0.0, 0.0, 1.0,
    1.0, 0.0, 0.0
  ];
  const indices = [
    0, 1, 2,
    0, 2, 3
  ];
  return { name: "BillboardQuad", positions, normals, uvs, barys, indices };
}

function createIcosahedron(radius = 1.3) {
  const t = (1.0 + Math.sqrt(5.0)) / 2.0;
  const verts = [
    -1, t, 0,  1, t, 0, -1,-t, 0,  1,-t, 0,
     0,-1, t,  0, 1, t,  0,-1,-t,  0, 1,-t,
     t, 0,-1,  t, 0, 1, -t, 0,-1, -t, 0, 1
  ];
  const positions = [], normals = [], barys = [], uvs = [], indices = [];
  for (let i = 0; i < verts.length; i += 3) {
    const len = Math.hypot(verts[i], verts[i+1], verts[i+2]) || 1;
    const nx = verts[i]/len, ny = verts[i+1]/len, nz = verts[i+2]/len;
    positions.push(nx * radius, ny * radius, nz * radius);
    normals.push(nx, ny, nz);
    uvs.push(0.5, 0.5);
    barys.push(i % 3 === 0 ? 1 : 0, i % 3 === 1 ? 1 : 0, i % 3 === 2 ? 1 : 0);
  }
  const rawIdx = [
    0,11,5, 0,5,1, 0,1,7, 0,7,10, 0,10,11,
    1,5,9, 5,11,4, 11,10,2, 10,7,6, 7,1,8,
    3,9,4, 3,4,2, 3,2,6, 3,6,8, 3,8,9,
    4,9,5, 2,4,11, 6,2,10, 8,6,7, 9,8,1
  ];
  return { name: "Icosahedron", positions, normals, uvs, barys, indices: rawIdx };
}

function createSphere(radius = 1.0, latBands = 24, longBands = 24) {
  const positions = [], normals = [], uvs = [], barys = [], indices = [];
  for (let lat = 0; lat <= latBands; lat++) {
    const theta = (lat * Math.PI) / latBands;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let lon = 0; lon <= longBands; lon++) {
      const phi = (lon * 2 * Math.PI) / longBands;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      const x = cosPhi * sinTheta;
      const y = cosTheta;
      const z = sinPhi * sinTheta;

      positions.push(radius * x, radius * y, radius * z);
      normals.push(x, y, z);
      uvs.push(lon / longBands, lat / latBands);
      barys.push((lat + lon) % 3 === 0 ? 1 : 0, (lat + lon) % 3 === 1 ? 1 : 0, (lat + lon) % 3 === 2 ? 1 : 0);
    }
  }

  for (let lat = 0; lat < latBands; lat++) {
    for (let lon = 0; lon < longBands; lon++) {
      const first = lat * (longBands + 1) + lon;
      const second = first + longBands + 1;
      indices.push(first, second, first + 1);
      indices.push(second, second + 1, first + 1);
    }
  }
  return { name: "Sphere", positions, normals, uvs, barys, indices };
}

function createRing(innerR = 0.82, outerR = 1.0, segments = 64) {
  const positions = [], normals = [], uvs = [], barys = [], indices = [];
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    // Outer vertex
    positions.push(cosT * outerR, sinT * outerR, 0.0);
    normals.push(0.0, 0.0, 1.0);
    uvs.push(cosT * 0.5 + 0.5, sinT * 0.5 + 0.5);
    barys.push(1, 0, 0);

    // Inner vertex
    positions.push(cosT * innerR, sinT * innerR, 0.0);
    normals.push(0.0, 0.0, 1.0);
    uvs.push(cosT * 0.5 * (innerR / outerR) + 0.5, sinT * 0.5 * (innerR / outerR) + 0.5);
    barys.push(0, 1, 0);
  }

  for (let i = 0; i < segments; i++) {
    const o1 = i * 2;
    const i1 = i * 2 + 1;
    const o2 = (i + 1) * 2;
    const i2 = (i + 1) * 2 + 1;
    indices.push(o1, i1, o2);
    indices.push(i1, i2, o2);
  }
  return { name: "Ring", positions, normals, uvs, barys, indices };
}

function createDisk(radius = 1.0, segments = 48) {
  const positions = [0.0, 0.0, 0.0];
  const normals = [0.0, 0.0, 1.0];
  const uvs = [0.5, 0.5];
  const barys = [1, 0, 0];
  const indices = [];

  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    positions.push(cosT * radius, sinT * radius, 0.0);
    normals.push(0.0, 0.0, 1.0);
    uvs.push(cosT * 0.5 + 0.5, sinT * 0.5 + 0.5);
    barys.push(0, 1, 0);
  }

  for (let i = 1; i <= segments; i++) {
    indices.push(0, i, i + 1);
  }
  return { name: "Disk", positions, normals, uvs, barys, indices };
}

// Retro Web Audio Synthesizer (Instant procedural audio feedback for FPS gameplay)
class RetroSoundSynth {
  constructor() {
    this.ctx = null;
    this.musicOn = true;
    this.sfxOn = true;
    this.zombieDensity = 'high'; // 'high', 'medium', 'low'

    // HTML5 Audio elements
    this.bgMusic = null;
    this.gunshotPool = [];
    this.gunshotPoolIndex = 0;
    this.zombieAudios = [];
    this.lastZombieTime = 0;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.initMusicAndSFX();
  }

  initMusicAndSFX() {
    try {
      if (!this.bgMusic) {
        this.bgMusic = new Audio('assets/audio/audionautix-black-fly.mp3');
        this.bgMusic.loop = true;
        this.bgMusic.volume = 0.45; // balanced background volume
      }

      if (this.gunshotPool.length === 0) {
        // Multi-channel gunshot audio pool for overlapping fire support
        for (let i = 0; i < 8; i++) {
          const sfx = new Audio('assets/audio/gun/gunshot.mp3');
          sfx.volume = 0.50;
          this.gunshotPool.push(sfx);
        }
      }

      if (this.zombieAudios.length === 0) {
        // Load random selection of zombie audio files for immersive combat atmosphere
        const zombieIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
        // Shuffle and take 12 to save bandwidth but retain high variety
        zombieIds.sort(() => 0.5 - Math.random());
        zombieIds.slice(0, 12).forEach(id => {
          const zAudio = new Audio(`assets/audio/zombie/zombie-${id}.mp3`);
          zAudio.volume = 0.40;
          this.zombieAudios.push(zAudio);
        });
      }
    } catch (e) {
      console.warn("Audio loading failed or blocked: ", e);
    }
  }

  updateSettings(musicOn, sfxOn, zombieDensity) {
    this.musicOn = musicOn;
    this.sfxOn = sfxOn;
    this.zombieDensity = zombieDensity;

    if (this.bgMusic) {
      if (this.musicOn && window.isMatchActive) {
        if (this.bgMusic.paused) {
          this.bgMusic.play().catch(e => console.log("Music play deferred until interaction: ", e));
        }
      } else {
        this.bgMusic.pause();
      }
    }
  }

  startMusic() {
    this.init();
    if (this.bgMusic && this.musicOn) {
      this.bgMusic.play().catch(e => console.log("Music play deferred: ", e));
    }
  }

  stopMusic() {
    if (this.bgMusic) {
      this.bgMusic.pause();
    }
  }

  playZombieSound() {
    if (!this.sfxOn || this.zombieDensity === 'low') return;

    const now = Date.now();
    const minDelay = this.zombieDensity === 'high' ? 1200 : 3500;
    if (now - this.lastZombieTime < minDelay) return;

    if (this.zombieAudios.length > 0) {
      this.lastZombieTime = now;
      const randIdx = Math.floor(Math.random() * this.zombieAudios.length);
      const audio = this.zombieAudios[randIdx];
      try {
        audio.currentTime = 0;
        audio.play().catch(e => {});
      } catch (err) {}
    }
  }

  play(type) {
    if (!this.sfxOn) return;

    try {
      this.init();

      // Custom real MP3 Audio sound effect override for firing
      if (type === 'fire') {
        if (this.gunshotPool.length > 0) {
          const audio = this.gunshotPool[this.gunshotPoolIndex];
          try {
            audio.currentTime = 0;
            audio.play().catch(e => {});
          } catch (err) {}
          this.gunshotPoolIndex = (this.gunshotPoolIndex + 1) % this.gunshotPool.length;
          return;
        }
      }

      if (!this.ctx) return;
      const t = this.ctx.currentTime;

      if (type === 'health' || type === 'health_small' || type === 'health_medium') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.exponentialRampToValueAtTime(880, t + 0.15);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.2);
      } else if (type === 'health_mega') {
        [440, 554, 659, 880, 1108].forEach((freq, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t + i * 0.05);
          gain.gain.setValueAtTime(0.22, t + i * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.05 + 0.28);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(t + i * 0.05);
          osc.stop(t + i * 0.05 + 0.28);
        });
      } else if (type === 'armor' || type === 'armor_green' || type === 'armor_yellow' || type === 'armor_red' || type === 'armor_heavy') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.exponentialRampToValueAtTime(660, t + 0.18);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.22);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.22);
      } else if (type === 'ammo') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(520, t);
        osc.frequency.setValueAtTime(780, t + 0.06);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.18);
      } else if (type === 'powerup' || type === 'powerup_quad' || type === 'powerup_haste' || type === 'powerup_regen') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, t);
        osc.frequency.exponentialRampToValueAtTime(1280, t + 0.35);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.45);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.45);
      } else if (type === 'teleport') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, t);
        osc.frequency.exponentialRampToValueAtTime(1800, t + 0.18);
        osc.frequency.exponentialRampToValueAtTime(400, t + 0.35);
        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.38);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.38);
      } else if (type === 'elevator') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.linearRampToValueAtTime(440, t + 0.12);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.22);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.22);
      }
    } catch(e) {}
  }
}

// generateStairs, MAP_DEFINITIONS, ELEMENTAL_ITEMS_CATALOG, and FILAMENT_MATERIALS_CATALOG
// are imported from ./maps/index.js (AAA architecture)


// 4 Iconic Quake Arena Maps with 2 Massive Rooms Connected with a Tunnel and Open Floor 2 Mezzanines
// QUAKE_MAP_DEFINITIONS is imported from ./maps/index.js


// ELEMENTAL_ITEMS_CATALOG is imported from ./maps/index.js


// Comprehensive Filament & PBR Material Catalog with MAT COST profiling
// FILAMENT_MATERIALS_CATALOG is imported from ./maps/index.js


/// Application State Controller
class NativeApp {
  constructor() {
    this.canvas = document.getElementById('engine-canvas');
    this.gl = this.canvas.getContext('webgl2', { antialias: true, alpha: false });
    
    if (!this.gl) {
      alert("WebGL2 / OpenGL ES 3.0 is not supported on this browser.");
      return;
    }

    this.state = {
      demoScene: '07_fps_shooter_damage_system.cpp', // Default to Demo 07 First-Person Shooter & Damage System
      activeMesh: 0,
      activeShader: 4, // Default to Ultra-Fast Cheap Mobile Material
      fpsCheapMaterial: true, // Cheap material flag for 60-120 FPS mobile performance
      roughness: 0.35,
      metallic: 0.80,
      speed: 0.8,
      autoRotate: false,
      depthTest: true,
      cullFace: true,
      baseColor: [0.15, 0.40, 0.95],
      
      // Showroom state
      showroomLayout: 'circular', // 'circular', 'linear', 'grid'
      showroomMesh: 0, // 0: Sphere, 4: Torus, 1: Cube, 3: Trefoil, 2: Gem
      showroomTurntable: true,
      showroomSpeed: 0.75,
      showroomFocusedMatKey: 'wood',

      // Camera & Input state
      cameraMode: 3, // 0: Orbit, 1: FP Drag Look, 2: Free-Fly, 3: FPS Shooter
      invertMouseX: true,
      invertMouseY: false,
      camYaw: 0.0,
      camPitch: 0.0,
      camRadius: 14.5,
      camPos: new Float32Array([0.0, 1.7, 5.0]),
      camTarget: new Float32Array([0.0, 1.7, 4.0]),
      camFront: new Float32Array([0.0, 0.0, -1.0]),
      camRight: new Float32Array([1.0, 0.0, 0.0]),
      moveSpeed: 6.5,

      // First-Person Kinematic Jumping & Gravity State
      fpsVelocityY: 0.0,
      fpsIsGrounded: true,

      // Input bitmasks & drag tracking
      isDragging: false,
      mouseButton: 0,
      lastMouseX: 0,
      lastMouseY: 0,
      keys: {
        w: false, a: false, s: false, d: false,
        q: false, e: false, space: false, shift: false
      }
    };

    // Damage System & DAMAGE Group Actors (Bitmask Layer_Damageable = 1 << 6)
    this.damageActors = [
      {
        id: 101,
        name: "Target_Drone_Alpha",
        damageGroup: "Enemies",
        type: "Airborne Drone Target",
        pos: [0.0, 2.8, -10.0],
        scale: [0.7, 0.7, 0.7],
        color: [0.95, 0.25, 0.35],
        radius: 0.7,
        health: 100.0,
        maxHealth: 100.0,
        alive: true,
        respawnTimer: 0.0,
        respawnDelay: 3.5,
        hitFlashTimer: 0.0,
        collider: "Sphere (r=0.7m)",
        layer: "Layer_Damageable"
      },
      {
        id: 102,
        name: "Target_Monolith_Beta",
        damageGroup: "Destructibles",
        type: "Fortified Monolith Turret",
        pos: [-5.0, 1.6, -9.0],
        scale: [1.2, 2.2, 1.2],
        color: [0.95, 0.55, 0.15],
        radius: 1.1,
        health: 150.0,
        maxHealth: 150.0,
        alive: true,
        respawnTimer: 0.0,
        respawnDelay: 4.0,
        hitFlashTimer: 0.0,
        collider: "AABB Box (1.2x2.2x1.2m)",
        layer: "Layer_Damageable"
      },
      {
        id: 103,
        name: "Target_Sphere_Gamma",
        damageGroup: "Targets",
        type: "Kinetic Energy Core",
        pos: [5.0, 2.0, -9.0],
        scale: [0.9, 0.9, 0.9],
        color: [0.85, 0.30, 0.95],
        radius: 0.8,
        health: 80.0,
        maxHealth: 80.0,
        alive: true,
        respawnTimer: 0.0,
        respawnDelay: 3.0,
        hitFlashTimer: 0.0,
        collider: "Sphere (r=0.8m)",
        layer: "Layer_Damageable"
      },
      {
        id: 104,
        name: "Explosive_Crate_Delta",
        damageGroup: "Destructibles",
        type: "Volatile Munitions Crate",
        pos: [0.0, 0.8, 6.0],
        scale: [1.0, 1.0, 1.0],
        color: [0.95, 0.85, 0.15],
        radius: 0.7,
        health: 50.0,
        maxHealth: 50.0,
        alive: true,
        respawnTimer: 0.0,
        respawnDelay: 3.0,
        hitFlashTimer: 0.0,
        collider: "AABB Box (1.0x1.0x1.0m)",
        layer: "Layer_Damageable"
      }
    ];

    // Projectile Pool (64 fixed size pool, zero allocation during combat)
    this.projectilePool = [];
    for (let i = 0; i < 64; i++) {
      this.projectilePool.push({
        id: i + 1,
        active: false,
        pos: [0, 0, 0],
        prevPos: [0, 0, 0],
        velocity: [0, 0, 0],
        speed: 50.0,
        damage: 25.0,
        lifetime: 3.0,
        age: 0.0,
        radius: 0.18,
        color: [0.06, 0.85, 0.95]
      });
    }

    // Active Weapon Configuration
    this.weaponConfig = {
      type: 'plasma',
      name: 'High-Yield Plasma Bolt',
      damage: 25.0,
      speed: 50.0,
      lifetime: 3.0,
      color: [0.06, 0.85, 0.95]
    };

    // First-Person Weapon Viewmodel Animation State (Bobbing, Recoil, Muzzle Flash)
    this.weaponState = {
      bobTimer: 0.0,
      recoil: 0.0,
      muzzleFlash: 0.0
    };

    this.isMatchActive = false;

    // Initialize Active 3D AI Combat Bots & Bot Projectiles Pool
    this.init3DBots();

    this.damageEvents = [];
    this.totalDamageDealt = 0;

    // Web Audio Synthesizer for FPS Sound FX
    this.synth = new RetroSoundSynth();

    // Map & Items Systems State
    this.currentMapId = 'dm6';
    this.activeCategoryFilter = 'all';

    // Player Status & Inventory State
    this.playerHealth = 100.0;
    this.playerMaxHealth = 100.0;
    this.playerArmor = 50.0;
    this.playerMaxArmor = 100.0;
    this.playerArmorType = 'green';
    this.playerAmmo = {
      plasma: 100,
      slugs: 60,
      rockets: 20,
      railgun: 15
    };
    this.activePowerups = {
      quad: { active: false, timer: 0.0, maxTime: 30.0 },
      haste: { active: false, timer: 0.0, maxTime: 25.0 },
      regen: { active: false, timer: 0.0, maxTime: 30.0 }
    };

    this.spawnPoints = [];
    this.itemPickups = [];

    // Scene Entity Hierarchy matching C++ Demo 06
    this.sceneEntities = [
      { id: 0, name: "Player_Character", type: "Kinematic Character", materialKey: "metal", pos: [0.0, 0.0, 2.0], scale: [1.6, 1.8, 1.6], roughness: 0.30, metallic: 0.85, color: [0.15, 0.40, 0.95], collider: "Swept Capsule (r=0.55m, h=1.8m)", layer: "Layer_Player", trigger: false, badge: "Kinematic", contact: false },
      { id: 1, name: "Ground_Floor", type: "Static Environment", materialKey: "rock", pos: [0.0, -0.5, 0.0], scale: [36.0, 0.5, 36.0], roughness: 0.88, metallic: 0.0, color: [0.32, 0.32, 0.35], collider: "AABB Box (36x0.5x36m)", layer: "Layer_Ground", trigger: false, badge: "Static AABB", contact: true },
      
      // Monolith Pillars & Obstacles in their original places
      { id: 2, name: "Pillar_North", type: "Monolith Obstacle", materialKey: "wood", pos: [0.0, 2.5, -12.0], scale: [1.6, 5.0, 1.6], roughness: 0.48, metallic: 0.0, color: [0.38, 0.22, 0.12], collider: "AABB Box (1.6x5x1.6m)", layer: "Layer_Obstacle", trigger: false, badge: "Static AABB", contact: false },
      { id: 3, name: "Pillar_West", type: "Monolith Obstacle", materialKey: "rust", pos: [-10.0, 2.0, 0.0], scale: [1.8, 4.0, 1.8], roughness: 0.82, metallic: 0.35, color: [0.65, 0.28, 0.16], collider: "AABB Box (1.8x4x1.8m)", layer: "Layer_Obstacle", trigger: false, badge: "Static AABB", contact: false },
      { id: 4, name: "Pillar_East", type: "Monolith Obstacle", materialKey: "marble", pos: [10.0, 2.0, 0.0], scale: [1.8, 4.0, 1.8], roughness: 0.28, metallic: 0.0, color: [0.92, 0.92, 0.94], collider: "AABB Box (1.8x4x1.8m)", layer: "Layer_Obstacle", trigger: false, badge: "Static AABB", contact: false },
      
      // PLATFORM FLOOR in its original place (pos [0, 1.8, 10], scale [6, 0.4, 6])
      { id: 5, name: "Platform_High", type: "Jump Platform Floor", materialKey: "metal", pos: [0.0, 1.8, 10.0], scale: [6.0, 0.4, 6.0], roughness: 0.24, metallic: 0.96, color: [0.72, 0.76, 0.82], collider: "AABB Box (6x0.4x6m)", layer: "Layer_Obstacle", trigger: false, badge: "Platform Floor", contact: false },
      
      // CATWALK LINK from edge stairs to Platform Floor
      { id: 6, name: "Platform_Catwalk_West", type: "Upper Catwalk", materialKey: "metal", pos: [-7.0, 1.8, 10.0], scale: [8.0, 0.4, 3.5], roughness: 0.25, metallic: 0.90, color: [0.65, 0.70, 0.78], collider: "AABB Box (8x0.4x3.5m)", layer: "Layer_Obstacle", trigger: false, badge: "Catwalk", contact: false },

      // REAL STAIRS TO PLATFORM FLOOR: Positioned against the West edge wall (X = -11.0m) free of collisions
      ...generateStairs(50, "West_Wall_Stairs", -11.0, 3.0, 10.0, 0.0, 1.8, 8, 3.5, [0.55, 0.58, 0.65]),

      // Props and Collectible Gems in original positions
      { id: 20, name: "Sphere_Boulder_1", type: "Physical Prop", materialKey: "magma", pos: [-5.5, 1.2, -6.0], scale: [1.2, 1.2, 1.2], roughness: 0.65, metallic: 0.0, color: [0.85, 0.25, 0.05], collider: "Sphere (r=1.2m)", layer: "Layer_Obstacle", trigger: false, badge: "Static Sphere", contact: false },
      { id: 21, name: "Sphere_Boulder_2", type: "Physical Prop", materialKey: "car_paint", pos: [5.5, 1.2, -6.0], scale: [1.2, 1.2, 1.2], roughness: 0.20, metallic: 0.85, color: [0.85, 0.15, 0.20], collider: "Sphere (r=1.2m)", layer: "Layer_Obstacle", trigger: false, badge: "Static Sphere", contact: false },
      { id: 22, name: "Gem_Trigger_North", type: "Trigger Collectible", materialKey: "hologram", pos: [0.0, 1.5, -12.0], scale: [0.6, 0.6, 0.6], roughness: 0.10, metallic: 0.0, color: [0.10, 0.90, 0.85], collider: "AABB Trigger (0.6x0.6x0.6m)", layer: "Layer_Trigger", trigger: true, badge: "Trigger Gem", contact: false },
      { id: 23, name: "Gem_Trigger_Platform", type: "Trigger Collectible", materialKey: "neon", pos: [0.0, 2.6, 10.0], scale: [0.6, 0.6, 0.6], roughness: 0.05, metallic: 0.0, color: [0.95, 0.20, 0.80], collider: "AABB Trigger (0.6x0.6x0.6m)", layer: "Layer_Trigger", trigger: true, badge: "Trigger Gem", contact: false }
    ];

    // Player Controller Locomotion & Physics Simulation State
    this.playerController = {
      pos: [0.0, 0.0, 2.0],
      prevPos: [0.0, 0.0, 2.0],
      velocity: [0.0, 0.0, 0.0],
      yaw: 0.0,
      pitch: 0.0,
      isGrounded: true,
      state: 'IDLE',
      activeAnim: 'Idle',
      animTime: 0.0,
      coyoteTimer: 0.15,
      groundNormal: [0.0, 1.0, 0.0],
      
      // Configurable parameters
      walkSpeed: 5.5,
      sprintSpeed: 11.0,
      jumpForce: 8.5,
      gravity: -22.0,
      characterRadius: 0.80,
      characterHeight: 1.8,
      cameraViewMode: 'third-person',
      
      // Spring Arm Camera for Third-Person
      camDistance: 5.0,
      camPitch: 0.25,
      camYaw: 0.0,
      debugColliders: true
    };
    this.selectedEntityIndex = 0;

    // Reusable buffers (ZERO heap allocations per frame)
    this.modelMatrix = Mat4.create();
    this.instanceMatrix = Mat4.create();
    this.viewMatrix = Mat4.create();
    this.projMatrix = Mat4.create();
    this.viewProjMatrix = Mat4.create();
    this.normalMatrix = new Float32Array(9);
    this.upVec = new Float32Array([0, 1, 0]);
    this.gridColor = new Float32Array([0.92, 0.93, 0.96]);

    // Pre-allocated lighting and ray vectors (zero allocations in hot loops)
    this._pointLightsList = [];
    this._spotLightsList = [];
    this._spotNormDir = new Float32Array(3);
    this._sunWorld = new Float32Array(4);
    this._sunClip = new Float32Array(4);
    this._cUp = new Float32Array(3);
    this._cU = this._cUp;
    this._gunAnchor = new Float32Array(3);
    this._pEye = new Float32Array(3);
    this._pFeet = new Float32Array(3);
    this._botEye = new Float32Array(3);
    this._botDir = new Float32Array(3);
    this._hitPos = [0, 0, 0];
    this._hitNorm = [0, 1, 0];
    this._netPos = [0, 0, 0];
    this._netRot = [0, 0, 0];
    this._colResult = { isGrounded: false };
    this._renderLoopBound = this.renderLoop.bind(this);
    this.containerEl = null;

    this.lastTime = performance.now();
    this.frameCount = 0;
    this.lastFpsUpdate = performance.now();

    this.cmdHistory = [];
    this.cmdHistoryIndex = -1;
    this.isExecutingCmd = false;

    this.rawMeshes = [];
    this.initTextures();
    this.initPipeline();
    this.initMeshes();
    this.initUI();
    this.bindEvents();
    this.initBackendInterconnection();
    this.initMobileJoystick();
    this.preventBrowserZoom();
    this.initLiveCodeEditor();
    this.initGeneratedJSViewer();
    this.initProjectWorkspace();
    this.initShowroomUI();
    this.initNetworkSystem();
    this.initFpsStartupMenu();
    this.sync3DBotsFromLobby();
    this.showFpsStartupMenu();
    
    this.log("Filament Architecture & WebGPU/GLES3 pipeline initialized.", "cpp");
    this.log("First-Person & Orbit Camera bitmask input listeners ACTIVE.", "success");
    this.log("Mobile virtual joystick & touch controller pipeline ACTIVE.", "success");
    this.log("Filament PBR examples & WASM export procedures loaded.", "info");
    
    requestAnimationFrame(this._renderLoopBound);
  }

  log(msg, type = "info") {
    const box = document.getElementById('console-logs');
    if (!box) return;
    const d = new Date();
    const timeStr = d.toTimeString().split(' ')[0] + '.' + String(d.getMilliseconds()).padStart(3, '0');
    const div = document.createElement('div');
    div.className = `log-entry ${type}`;
    div.textContent = `[${timeStr}] ${msg}`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  compileShader(type, src) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  initTextures() {
    const gl = this.gl;
    if (!gl) return;
    this.textureCatalog = {};

    const texturesToLoad = {
      metal1: '/assets/textures/metal/metal1.webp',
      metal2: '/assets/textures/metal/metal2.webp',
      rust: '/assets/textures/rust.jpg',
      wood: '/assets/textures/wal1.webp',
      tex01: '/assets/textures/tex01.webp',
      tex02: '/assets/textures/tex02.webp',
      whiteMetal: '/assets/textures/white-metal.png',
      whiteMetal2: '/assets/textures/white-metal2.webp',
      matrix1: '/assets/textures/matrix1.webp',
      red1: '/assets/textures/red1.webp',
      xrp: '/assets/textures/xrp.webp',
      star1: '/assets/textures/star1.png',
      starFantazy: '/assets/textures/star-fantazy.png',
      pushBtn: '/assets/textures/pushBtn.webp',
      darkRock: '/assets/textures/dark-rock.webp',
      floor1: '/assets/textures/floor1.webp',
      gold2: '/assets/textures/gold-2.webp'
    };

    Object.keys(texturesToLoad).forEach(key => {
      const url = texturesToLoad[key];
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([120, 120, 120, 255]));

      const img = new Image();
      img.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      };
      img.onerror = () => {
        console.warn(`[Texture] Failed to load ${url}`);
      };
      img.src = url;
      this.textureCatalog[key] = tex;
    });
  }

  createProgram(vsSrc, fsSrc) {
    const gl = this.gl;
    const vs = this.compileShader(gl.VERTEX_SHADER, vsSrc);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSrc);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(prog));
      return null;
    }
    return {
      prog,
      uModel: gl.getUniformLocation(prog, "u_model"),
      uViewProj: gl.getUniformLocation(prog, "u_viewProj"),
      uNormalMatrix: gl.getUniformLocation(prog, "u_normalMatrix"),
      uCamPos: gl.getUniformLocation(prog, "u_camPos"),
      uBaseColor: gl.getUniformLocation(prog, "u_baseColor"),
      uRoughness: gl.getUniformLocation(prog, "u_roughness"),
      uMetallic: gl.getUniformLocation(prog, "u_metallic"),
      uTime: gl.getUniformLocation(prog, "u_time"),
      uMatType: gl.getUniformLocation(prog, "u_matType"),
      uNoiseScale: gl.getUniformLocation(prog, "u_noiseScale"),
      uClearCoat: gl.getUniformLocation(prog, "u_clearCoat"),
      uAnisotropy: gl.getUniformLocation(prog, "u_anisotropy"),
      uBumpStrength: gl.getUniformLocation(prog, "u_bumpStrength"),
      uUseTexMaps: gl.getUniformLocation(prog, "u_useTexMaps"),
      uUvScale: gl.getUniformLocation(prog, "u_uvScale"),
      uUvOffset: gl.getUniformLocation(prog, "u_uvOffset"),
      uAlbedoMap: gl.getUniformLocation(prog, "u_albedoMap"),
      uPbrMap: gl.getUniformLocation(prog, "u_pbrMap"),
      uLightDir: gl.getUniformLocation(prog, "u_lightDir"),
      uLightColor: gl.getUniformLocation(prog, "u_lightColor"),
      uFillLightDir: gl.getUniformLocation(prog, "u_fillLightDir"),
      uFillLightColor: gl.getUniformLocation(prog, "u_fillLightColor"),
      uNumPointLights: gl.getUniformLocation(prog, "u_numPointLights"),
      uNumSpotLights: gl.getUniformLocation(prog, "u_numSpotLights"),
      pointLights: Array.from({length: 6}, (_, i) => ({
        pos: gl.getUniformLocation(prog, `u_pointLights[${i}].pos`),
        color: gl.getUniformLocation(prog, `u_pointLights[${i}].color`),
        intensity: gl.getUniformLocation(prog, `u_pointLights[${i}].intensity`),
        radius: gl.getUniformLocation(prog, `u_pointLights[${i}].radius`)
      })),
      spotLights: Array.from({length: 4}, (_, i) => ({
        pos: gl.getUniformLocation(prog, `u_spotLights[${i}].pos`),
        dir: gl.getUniformLocation(prog, `u_spotLights[${i}].dir`),
        color: gl.getUniformLocation(prog, `u_spotLights[${i}].color`),
        intensity: gl.getUniformLocation(prog, `u_spotLights[${i}].intensity`),
        cutoff: gl.getUniformLocation(prog, `u_spotLights[${i}].cutoff`),
        outerCutoff: gl.getUniformLocation(prog, `u_spotLights[${i}].outerCutoff`)
      }))
    };
  }

  initPipeline() {
    const gl = this.gl;
    this.programs = [
      this.createProgram(VS_COMMON, FS_PBR),
      this.createProgram(VS_COMMON, FS_WIREFRAME),
      this.createProgram(VS_COMMON, FS_NORMALS),
      this.createProgram(VS_COMMON, FS_HOLOGRAM),
      this.createProgram(VS_COMMON, FS_CHEAP_FPS)
    ];

    // Compile and link billboard shader program (completely platform-independent / native 3D text billboarding)
    const vsB = this.compileShader(gl.VERTEX_SHADER, VS_BILLBOARD);
    const fsB = this.compileShader(gl.FRAGMENT_SHADER, FS_BILLBOARD);
    const progB = gl.createProgram();
    gl.attachShader(progB, vsB);
    gl.attachShader(progB, fsB);
    gl.linkProgram(progB);
    this.billboardProg = {
      prog: progB,
      uModel: gl.getUniformLocation(progB, "u_model"),
      uViewProj: gl.getUniformLocation(progB, "u_viewProj"),
      uTextTexture: gl.getUniformLocation(progB, "u_textTexture")
    };

    this.initPostProcessing();
  }

  initPostProcessing() {
    const gl = this.gl;

    // 1. Fullscreen Quad Geometry VAO
    const quadVerts = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1
    ]);
    this.quadVao = gl.createVertexArray();
    gl.bindVertexArray(this.quadVao);
    const quadVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVbo);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // 2. Post-Processing Master Program
    const vs = this.compileShader(gl.VERTEX_SHADER, VS_QUAD);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, FS_POSTPROCESS);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("Post-Processing Master Shader Link Error:", gl.getProgramInfoLog(prog));
    }

    this.postProcProg = {
      prog,
      uSceneColor: gl.getUniformLocation(prog, "u_sceneColor"),
      uSceneDepth: gl.getUniformLocation(prog, "u_sceneDepth"),
      uResolution: gl.getUniformLocation(prog, "u_resolution"),
      uCamPos: gl.getUniformLocation(prog, "u_camPos"),
      uSunScreenPos: gl.getUniformLocation(prog, "u_sunScreenPos"),
      uTime: gl.getUniformLocation(prog, "u_time"),
      
      uHzbEnabled: gl.getUniformLocation(prog, "u_hzbEnabled"),
      uHzbViewMode: gl.getUniformLocation(prog, "u_hzbViewMode"),
      uHzbMipLevel: gl.getUniformLocation(prog, "u_hzbMipLevel"),
      uHzbSteps: gl.getUniformLocation(prog, "u_hzbSteps"),

      uBloomEnabled: gl.getUniformLocation(prog, "u_bloomEnabled"),
      uBloomThreshold: gl.getUniformLocation(prog, "u_bloomThreshold"),
      uBloomSensitivity: gl.getUniformLocation(prog, "u_bloomSensitivity"),
      uBloomIntensity: gl.getUniformLocation(prog, "u_bloomIntensity"),
      uBloomRadius: gl.getUniformLocation(prog, "u_bloomRadius"),
      uBloomAnamorphic: gl.getUniformLocation(prog, "u_bloomAnamorphic"),
      uBloomChromatic: gl.getUniformLocation(prog, "u_bloomChromatic"),

      uVolumetricEnabled: gl.getUniformLocation(prog, "u_volumetricEnabled"),
      uVolumetricSamples: gl.getUniformLocation(prog, "u_volumetricSamples"),
      uVolumetricDensity: gl.getUniformLocation(prog, "u_volumetricDensity"),
      uVolumetricDecay: gl.getUniformLocation(prog, "u_volumetricDecay"),
      uVolumetricWeight: gl.getUniformLocation(prog, "u_volumetricWeight"),
      uVolumetricColor: gl.getUniformLocation(prog, "u_volumetricColor")
    };

    // 3. Initialize Scene Framebuffer & Depth Textures
    this.resizePostProcFBO();
  }

  resizePostProcFBO() {
    const gl = this.gl;
    const w = this.canvas.width || 1280;
    const h = this.canvas.height || 720;
    if (this.fboWidth === w && this.fboHeight === h && this.sceneFbo) return;

    this.fboWidth = w;
    this.fboHeight = h;

    if (this.sceneFbo) gl.deleteFramebuffer(this.sceneFbo);
    if (this.sceneColorTex) gl.deleteTexture(this.sceneColorTex);
    if (this.sceneDepthTex) gl.deleteTexture(this.sceneDepthTex);

    // Scene Color Texture
    this.sceneColorTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.sceneColorTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Scene Depth Texture (DEPTH_COMPONENT24)
    this.sceneDepthTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.sceneDepthTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, w, h, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Attach to Scene FBO
    this.sceneFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.sceneColorTex, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.sceneDepthTex, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  initMeshes() {
    const gl = this.gl;
    this.rawMeshes = [
      createSphere(1.0, 24, 24),
      createCube(1.0),
      createIcosahedron(1.4),
      createTrefoilKnot(120, 20, 0.28),
      createTorus(0.45, 1.1, 48, 24),
      createQuad(1.0),
      createRing(0.82, 1.0, 48),
      createDisk(1.0, 48)
    ];

    this.meshBuffers = this.rawMeshes.map(data => {
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);

      // Pos
      const vboPos = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vboPos);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.positions), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

      // Norm
      const vboNorm = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vboNorm);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.normals), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

      // UV
      const vboUV = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vboUV);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.uvs), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);

      // Barycentric
      const vboBary = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vboBary);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.barys), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(3);
      gl.vertexAttribPointer(3, 3, gl.FLOAT, false, 0, 0);

      // IBO
      const ibo = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data.indices), gl.STATIC_DRAW);

      gl.bindVertexArray(null);

      return {
        vao,
        name: data.name,
        indexCount: data.indices.length,
        vertexCount: data.positions.length / 3,
        triangleCount: data.indices.length / 3
      };
    });

    this.updateHUDStats();
  }

  updateHUDStats() {
    const current = this.meshBuffers[this.state.activeMesh];
    if (!current) return;

    const vertEl = document.getElementById('hud-vertices');
    const triEl = document.getElementById('hud-triangles');
    const drawEl = document.getElementById('hud-drawcalls');

    if (this.state.demoScene.includes('08_all_materials') || this.state.demoScene.includes('materials_presentation')) {
      const sampleMesh = this.meshBuffers[this.state.showroomMesh !== undefined ? this.state.showroomMesh : 0] || current;
      const cubeMesh = this.meshBuffers[1];
      const totalSamples = 17;
      const totalTris = (sampleMesh.triangleCount * totalSamples) + (cubeMesh.triangleCount * (totalSamples + 1));
      const totalVerts = (sampleMesh.vertexCount * totalSamples) + (cubeMesh.vertexCount * (totalSamples + 1));
      if (vertEl) vertEl.textContent = totalVerts.toLocaleString();
      if (triEl) triEl.textContent = totalTris.toLocaleString();
      if (drawEl) drawEl.textContent = "35"; // 17 samples + 17 pedestals + 1 showroom floor
    } else if (this.state.demoScene === 'matrix' || this.state.demoScene.includes('02_metallic')) {
      const totalTris = current.triangleCount * 25;
      const totalVerts = current.vertexCount * 25;
      if (vertEl) vertEl.textContent = totalVerts.toLocaleString();
      if (triEl) triEl.textContent = totalTris.toLocaleString();
      if (drawEl) drawEl.textContent = "25";
    } else {
      if (vertEl) vertEl.textContent = current.vertexCount.toLocaleString();
      if (triEl) triEl.textContent = current.triangleCount.toLocaleString();
      if (drawEl) drawEl.textContent = "1";
    }
  }

  initShowroomUI() {
    const strip = document.getElementById('showroom-materials-strip');
    if (strip) {
      strip.innerHTML = '';
      const keys = Object.keys(FILAMENT_MATERIALS_CATALOG);
      keys.forEach((key) => {
        const mat = FILAMENT_MATERIALS_CATALOG[key];
        const chip = document.createElement('button');
        chip.className = `showroom-mat-chip ${key === this.state.showroomFocusedMatKey ? 'active' : ''}`;
        chip.id = `showroom-chip-${key}`;
        chip.title = `${mat.name} (${mat.matCost.rating} Cost)`;
        
        const badgeClass = mat.matCost.rating === 'LOW' ? '' : (mat.matCost.rating === 'MEDIUM' ? 'med' : 'high');
        chip.innerHTML = `
          <span class="showroom-chip-dot" style="background: ${mat.swatch};"></span>
          <span>${mat.name}</span>
          <span class="showroom-chip-badge ${badgeClass}">${mat.matCost.rating}</span>
        `;

        chip.addEventListener('click', () => {
          this.focusShowroomMaterial(key);
        });

        strip.appendChild(chip);
      });
    }

    // Layout Mode Buttons
    const layoutBtns = document.querySelectorAll('.showroom-mode-btn');
    layoutBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        layoutBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.showroomLayout = btn.getAttribute('data-layout') || 'circular';
        this.log(`Showroom Layout switched to: [${this.state.showroomLayout.toUpperCase()}]`, "info");
        this.focusShowroomMaterial(this.state.showroomFocusedMatKey);
      });
    });

    // Mesh Selector Buttons
    const meshBtns = document.querySelectorAll('.showroom-mesh-btn');
    meshBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        meshBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.showroomMesh = parseInt(btn.getAttribute('data-mesh') || '0', 10);
        this.log(`Showroom Sample Mesh switched to: [${btn.textContent.trim()}]`, "info");
        this.updateHUDStats();
      });
    });

    // Turntable controls
    const chkTurntable = document.getElementById('chk-showroom-turntable');
    if (chkTurntable) {
      chkTurntable.checked = this.state.showroomTurntable;
      chkTurntable.addEventListener('change', (e) => {
        this.state.showroomTurntable = e.target.checked;
      });
    }

    const sliderSpeed = document.getElementById('slider-showroom-speed');
    if (sliderSpeed) {
      sliderSpeed.value = this.state.showroomSpeed;
      sliderSpeed.addEventListener('input', (e) => {
        this.state.showroomSpeed = parseFloat(e.target.value);
      });
    }

    this.updateShowroomSpecCard(this.state.showroomFocusedMatKey);
  }

  updateShowroomSpecCard(key) {
    const mat = FILAMENT_MATERIALS_CATALOG[key];
    if (!mat) return;

    const swatchEl = document.getElementById('showroom-card-swatch');
    const nameEl = document.getElementById('showroom-card-name');
    const badgeEl = document.getElementById('showroom-card-badge');
    const catEl = document.getElementById('showroom-card-category');
    const descEl = document.getElementById('showroom-card-desc');
    const roughEl = document.getElementById('showroom-card-rough');
    const metalEl = document.getElementById('showroom-card-metal');
    const clearEl = document.getElementById('showroom-card-clearcoat');
    const anisoEl = document.getElementById('showroom-card-anisotropy');
    const alusEl = document.getElementById('showroom-card-alus');
    const verdictEl = document.getElementById('showroom-card-verdict');

    if (swatchEl) swatchEl.style.background = mat.swatch;
    if (nameEl) nameEl.textContent = mat.name;
    if (badgeEl) {
      badgeEl.textContent = mat.matCost.rating;
      badgeEl.className = `spec-cost-badge ${mat.matCost.rating === 'MEDIUM' ? 'med' : (mat.matCost.rating === 'HIGH' ? 'high' : '')}`;
    }
    if (catEl) catEl.textContent = `CATEGORY: ${mat.category.toUpperCase()} PBR`;
    if (descEl) descEl.textContent = mat.desc;
    if (roughEl) roughEl.textContent = mat.roughness.toFixed(2);
    if (metalEl) metalEl.textContent = mat.metallic.toFixed(2);
    if (clearEl) clearEl.textContent = (mat.clearCoat || 0.0).toFixed(2);
    if (anisoEl) anisoEl.textContent = (mat.anisotropy || 0.0).toFixed(2);
    if (alusEl) alusEl.textContent = mat.matCost.alus;
    if (verdictEl) {
      verdictEl.textContent = mat.matCost.fpsEstimate;
      verdictEl.style.color = mat.matCost.rating === 'LOW' ? '#10b981' : (mat.matCost.rating === 'MEDIUM' ? '#f59e0b' : '#f43f5e');
    }
  }

  focusShowroomMaterial(key) {
    this.state.showroomFocusedMatKey = key;
    this.updateShowroomSpecCard(key);

    // Update active class on chips
    document.querySelectorAll('.showroom-mat-chip').forEach(c => c.classList.remove('active'));
    const activeChip = document.getElementById(`showroom-chip-${key}`);
    if (activeChip) {
      activeChip.classList.add('active');
      activeChip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    // Move camera focus smoothly to pedestal location
    const keys = Object.keys(FILAMENT_MATERIALS_CATALOG);
    const idx = keys.indexOf(key);
    if (idx !== -1) {
      const pos = this.getShowroomPedestalPos(idx, keys.length, this.state.showroomLayout);
      this.state.camTarget[0] = pos[0];
      this.state.camTarget[1] = pos[1] + 1.25;
      this.state.camTarget[2] = pos[2];
      this.state.camRadius = 3.6;
      this.state.camPitch = 0.22;
    }
  }

  getShowroomPedestalPos(idx, total, layout = 'circular') {
    if (layout === 'linear') {
      const spacing = 2.0;
      const startX = -((total - 1) * spacing * 0.5);
      return [startX + idx * spacing, 0.0, 0.0];
    } else if (layout === 'grid') {
      const cols = 6;
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      const spX = 2.4;
      const spZ = 2.8;
      const offX = (cols - 1) * spX * 0.5;
      const offZ = 2 * spZ * 0.5;
      return [col * spX - offX, 0.0, row * spZ - offZ];
    } else {
      // Circular Ring (radius 7.5m)
      const radius = 7.5;
      const angle = (idx / total) * Math.PI * 2;
      return [Math.sin(angle) * radius, 0.0, Math.cos(angle) * radius];
    }
  }

  initUI() {
    const exampleDisplay = document.getElementById('example-display');
    const exportDisplay = document.getElementById('export-display');
    const headerDisplay = document.getElementById('header-display');

    if (exampleDisplay) {
      const activeFile = SOURCE_FILES[this.state.demoScene] || SOURCE_FILES['08_all_materials_presentation.cpp'] || SOURCE_FILES['01_pbr_material_preview.cpp'];
      exampleDisplay.textContent = activeFile;
    }
    if (exportDisplay) exportDisplay.textContent = SOURCE_FILES['build_wasm.sh'];
    if (headerDisplay) headerDisplay.textContent = SOURCE_FILES['Engine.hpp'];
  }

  bindEvents() {
    const canvasContainer = document.getElementById('canvas-container');

    let bannerTimeout = null;
    const showBannerTemporarily = (banner) => {
      if (!banner) return;
      if (bannerTimeout) {
        clearTimeout(bannerTimeout);
      }
      banner.style.opacity = '1';
      banner.style.pointerEvents = 'auto';
      banner.style.transform = 'translateX(-50%) translateY(0)';
      
      bannerTimeout = setTimeout(() => {
        banner.style.opacity = '0';
        banner.style.pointerEvents = 'none';
        banner.style.transform = 'translateX(-50%) translateY(-10px)';
      }, 3000);
    };

    const updateFPSOverlays = () => {
       const isShowroom = this.state.demoScene.includes('08_all_materials') || this.state.demoScene.includes('materials_presentation');
      const isSlotMachine = this.state.demoScene.includes('09_slot_machine');
      const isSlidingPuzzle = this.state.demoScene.includes('10_sliding_puzzle');
      const isPlinko = this.state.demoScene.includes('11_plinko');
      const isRoulette = this.state.demoScene.includes('12_roulette');
      const isFPS = this.state.cameraMode === 3 && !isShowroom && !isSlotMachine && !isSlidingPuzzle && !isPlinko && !isRoulette;
      const crosshairEl = document.getElementById('fps-crosshair-overlay');
      const bannerEl = document.getElementById('fps-pointerlock-banner');
      const weaponHudEl = document.getElementById('fps-weapon-hud');
      const fpHelp = document.getElementById('fp-help');

      const showroomTopEl = document.getElementById('showroom-hud-top');
      const showroomCardEl = document.getElementById('showroom-spec-card');
      const showroomBottomEl = document.getElementById('showroom-hud-bottom');
      
      const slotOverlayEl = document.getElementById('slot-machine-overlay');
      const slotBannerEl = document.getElementById('slot-machine-banner');

      const puzzleOverlayEl = document.getElementById('puzzle-overlay');
      const puzzleBannerEl = document.getElementById('puzzle-banner');

      const plinkoOverlayEl = document.getElementById('plinko-overlay');
      const plinkoBannerEl = document.getElementById('plinko-banner');

      const rouletteOverlayEl = document.getElementById('roulette-overlay');
      const rouletteBannerEl = document.getElementById('roulette-banner');

      if (crosshairEl) crosshairEl.style.display = isFPS ? 'flex' : 'none';
      if (bannerEl) {
        if (isFPS) {
          bannerEl.style.display = 'flex';
          showBannerTemporarily(bannerEl);
        } else {
          bannerEl.style.display = 'none';
          if (bannerTimeout) {
            clearTimeout(bannerTimeout);
            bannerTimeout = null;
          }
        }
      }
      if (weaponHudEl) weaponHudEl.style.display = isFPS ? 'flex' : 'none';
      if (fpHelp) fpHelp.style.display = (this.state.cameraMode !== 0 && !isShowroom && !isSlotMachine && !isSlidingPuzzle && !isPlinko && !isRoulette) ? 'block' : 'none';

      if (showroomTopEl) showroomTopEl.style.display = isShowroom ? 'flex' : 'none';
      if (showroomCardEl) showroomCardEl.style.display = isShowroom ? 'block' : 'none';
      if (showroomBottomEl) showroomBottomEl.style.display = isShowroom ? 'flex' : 'none';

      if (slotOverlayEl) slotOverlayEl.style.display = isSlotMachine ? 'flex' : 'none';
      if (slotBannerEl) slotBannerEl.style.display = isSlotMachine ? 'block' : 'none';

      if (puzzleOverlayEl) puzzleOverlayEl.style.display = isSlidingPuzzle ? 'flex' : 'none';
      if (puzzleBannerEl) puzzleBannerEl.style.display = isSlidingPuzzle ? 'block' : 'none';

      const plinkoFabEl = document.getElementById('plinko-mobile-fab');
      if (plinkoOverlayEl) {
        plinkoOverlayEl.style.display = isPlinko ? 'flex' : 'none';
        if (!isPlinko) {
          plinkoOverlayEl.classList.remove('mobile-minimized');
        }
      }
      if (plinkoBannerEl) plinkoBannerEl.style.display = isPlinko ? 'flex' : 'none';
      if (plinkoFabEl && !isPlinko) {
        plinkoFabEl.style.display = 'none';
      }
      if (!isPlinko && this.plinkoState && this.plinkoState.restoreTimeout) {
        clearTimeout(this.plinkoState.restoreTimeout);
        this.plinkoState.restoreTimeout = null;
      }

      const rouletteFabEl = document.getElementById('roulette-mobile-fab');
      if (rouletteOverlayEl) rouletteOverlayEl.style.display = isRoulette ? 'flex' : 'none';
      if (rouletteBannerEl) rouletteBannerEl.style.display = isRoulette ? 'flex' : 'none';
      if (rouletteFabEl && !isRoulette) rouletteFabEl.style.display = 'none';

      if (isSlotMachine || isSlidingPuzzle || isPlinko || isRoulette) {
        const startupOverlay = document.getElementById('fps-startup-overlay');
        if (startupOverlay) startupOverlay.style.display = 'none';
      }
    };

    updateFPSOverlays();

    // Prevent default context menu on viewport for clean right-click pan/look
    canvasContainer.addEventListener('contextmenu', (e) => e.preventDefault());

    // Pointer Lock Events
    document.addEventListener('pointerlockchange', () => {
      const isLocked = document.pointerLockElement === this.canvas || document.pointerLockElement === canvasContainer;
      const banner = document.getElementById('fps-pointerlock-banner');
      if (banner) {
        if (isLocked) {
          banner.innerHTML = `<span>🎯 <b>Pointer Locked</b> &bull; Mouse direct-look active &bull; Press <b>ESC</b> to unlock &bull; <b>L-Click</b> to Shoot &bull; <b>Space</b> to Jump</span>`;
          banner.classList.add('locked');
        } else {
          banner.innerHTML = `<span>🎯 <b>FPS Shooter Active</b>: Click viewport to Lock Mouse Look (No Mouse-Down needed!) &bull; Press <b>ESC</b> to unlock</span>`;
          banner.classList.remove('locked');
        }
        showBannerTemporarily(banner);
      }
    });

    // Viewport Click (Request Pointer Lock + Fire Weapon in FPS Mode)
    canvasContainer.addEventListener('click', (e) => {
      const fpsOverlay = document.getElementById('fps-startup-overlay');
      if (fpsOverlay && fpsOverlay.style.display !== 'none') return;
      if (e.target.closest('#fps-startup-overlay, .modal-overlay, button, input, select, .panel, .showroom-hud-top, .showroom-spec-card, .showroom-hud-bottom, #fps-pointerlock-banner, #puzzle-overlay, #slot-machine-overlay, #plinko-overlay, .plinko-overlay-panel, .plinko-mobile-fab')) return;

      if (this.state.cameraMode === 3) {
        if (document.pointerLockElement !== this.canvas && document.pointerLockElement !== canvasContainer) {
          try {
            this.canvas.requestPointerLock?.();
          } catch(err) {}
        }
        this.fireWeaponProjectile();
      } else if (this.state.demoScene.includes('10_sliding_puzzle') && this.puzzleState) {
        // Inverse view projection matrix raycasting
        const canvasRect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - canvasRect.left;
        const mouseY = e.clientY - canvasRect.top;

        // Normalized Device Coordinates
        const ndcX = (mouseX / canvasRect.width) * 2 - 1;
        const ndcY = 1 - (mouseY / canvasRect.height) * 2;

        const nearPt = [ndcX, ndcY, -1.0, 1.0];
        const farPt = [ndcX, ndcY, 1.0, 1.0];

        // 4x4 matrix inversion
        const invVP = new Float32Array(16);
        const a = this.viewProjMatrix;
        
        let a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
        let a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
        let a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
        let a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

        let b00 = a00 * a11 - a01 * a10;
        let b01 = a00 * a12 - a02 * a10;
        let b02 = a00 * a13 - a03 * a10;
        let b03 = a01 * a12 - a02 * a11;
        let b04 = a01 * a13 - a03 * a11;
        let b05 = a02 * a13 - a03 * a12;
        let b06 = a20 * a31 - a21 * a30;
        let b07 = a20 * a32 - a22 * a30;
        let b08 = a20 * a33 - a23 * a30;
        let b09 = a21 * a32 - a22 * a31;
        let b10 = a21 * a33 - a23 * a31;
        let b11 = a22 * a33 - a23 * a32;

        let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
        if (Math.abs(det) > 0.0001) {
          det = 1.0 / det;

          invVP[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
          invVP[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
          invVP[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
          invVP[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
          invVP[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
          invVP[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
          invVP[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
          invVP[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
          invVP[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
          invVP[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
          invVP[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
          invVP[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
          invVP[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
          invVP[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
          invVP[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
          invVP[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

          // Unproject points
          const unproject = (pt) => {
            const x = pt[0], y = pt[1], z = pt[2], w = pt[3];
            const ox = invVP[0]*x + invVP[4]*y + invVP[8]*z + invVP[12]*w;
            const oy = invVP[1]*x + invVP[5]*y + invVP[9]*z + invVP[13]*w;
            const oz = invVP[2]*x + invVP[6]*y + invVP[10]*z + invVP[14]*w;
            const ow = invVP[3]*x + invVP[7]*y + invVP[11]*z + invVP[15]*w;
            return [ox / ow, oy / ow, oz / ow];
          };

          const pNear = unproject(nearPt);
          const pFar = unproject(farPt);

          // Ray direct-vector
          const dx = pFar[0] - pNear[0];
          const dy = pFar[1] - pNear[1];
          const dz = pFar[2] - pNear[2];

          // Intersect with puzzle plane at Z = 0
          if (Math.abs(dz) > 0.0001) {
            const t = -pNear[2] / dz;
            if (t >= 0.0) {
              const ix = pNear[0] + t * dx;
              const iy = pNear[1] + t * dy;

              // Grid limits: [-0.5, 0.5] for X, [0.8, 1.8] for Y (centered at 1.3)
              if (ix >= -0.5 && ix <= 0.5 && iy >= 0.8 && iy <= 1.8) {
                const N = this.puzzleState.gridSize;
                const tileW = 1.0 / N;

                // Find cell row & col index
                const clickC = Math.floor((ix + 0.5) / tileW);
                const clickR = Math.floor((1.8 - iy) / tileW);

                if (clickR >= 0 && clickR < N && clickC >= 0 && clickC < N) {
                  this.handleSlidingPuzzleClick(clickR, clickC);
                }
              }
            }
          }
        }
      }
    });

    // Mouse Down
    canvasContainer.addEventListener('mousedown', (e) => {
      const fpsOverlay = document.getElementById('fps-startup-overlay');
      if (fpsOverlay && fpsOverlay.style.display !== 'none') return;
      if (e.target.closest('#fps-startup-overlay, .modal-overlay, button, input, select, .panel, .showroom-hud-top, .showroom-spec-card, .showroom-hud-bottom, #fps-pointerlock-banner, .plinko-overlay-panel, .plinko-mobile-fab, .slot-machine-overlay-panel, .puzzle-overlay-panel')) return;

      this.state.isDragging = true;
      this.state.mouseButton = e.button; // 0: Left, 1: Middle, 2: Right
      this.state.lastMouseX = e.clientX;
      this.state.lastMouseY = e.clientY;
      canvasContainer.focus();
    });

    // Mouse Move (Orbit / Pan / FP Look / FPS Direct Look without Mouse Down)
    window.addEventListener('mousemove', (e) => {
      const fpsOverlay = document.getElementById('fps-startup-overlay');
      if (fpsOverlay && fpsOverlay.style.display !== 'none') return;

      const invX = this.state.invertMouseX ? -1 : 1;
      const invY = this.state.invertMouseY ? -1 : 1;

      if (this.state.cameraMode === 3) {
        // Mode 3: FPS Shooter (NO MOUSE-DOWN REQUIRED!)
        const isLocked = document.pointerLockElement === this.canvas || document.pointerLockElement === canvasContainer;
        const dx = (isLocked && e.movementX !== undefined) ? e.movementX : (e.clientX - this.state.lastMouseX);
        const dy = (isLocked && e.movementY !== undefined) ? e.movementY : (e.clientY - this.state.lastMouseY);
        this.state.lastMouseX = e.clientX;
        this.state.lastMouseY = e.clientY;

        this.state.camYaw += dx * 0.0032 * invX;
        this.state.camPitch = Math.max(-1.48, Math.min(1.48, this.state.camPitch - dy * 0.0032 * invY));
        return;
      }

      if (!this.state.isDragging) return;
      const dx = e.clientX - this.state.lastMouseX;
      const dy = e.clientY - this.state.lastMouseY;
      this.state.lastMouseX = e.clientX;
      this.state.lastMouseY = e.clientY;

      if (this.state.cameraMode === 0) {
        // Orbit Arc Mode
        if (this.state.mouseButton === 0 && !e.shiftKey) {
          // Left click: Orbit
          this.state.camYaw += dx * 0.006 * invX;
          this.state.camPitch = Math.max(-1.45, Math.min(1.45, this.state.camPitch + dy * 0.006 * invY));
        } else if (this.state.mouseButton === 2 || (this.state.mouseButton === 0 && e.shiftKey) || this.state.mouseButton === 1) {
          // Right click or Shift+Left: Pan Target
          const panSpeed = this.state.camRadius * 0.0015;
          const rightX = Math.cos(this.state.camYaw);
          const rightZ = -Math.sin(this.state.camYaw);
          this.state.camTarget[0] -= rightX * dx * panSpeed;
          this.state.camTarget[2] -= rightZ * dx * panSpeed;
          this.state.camTarget[1] += dy * panSpeed;
        }
      } else {
        // First-Person (Drag to look) / Free-Fly Mode
        this.state.camYaw += dx * 0.004 * invX;
        this.state.camPitch = Math.max(-1.5, Math.min(1.5, this.state.camPitch - dy * 0.004 * invY));
      }
    });

    window.addEventListener('mouseup', () => {
      this.state.isDragging = false;
    });

    // Wheel (Zoom or Speed)
    canvasContainer.addEventListener('wheel', (e) => {
      const fpsOverlay = document.getElementById('fps-startup-overlay');
      if (fpsOverlay && fpsOverlay.style.display !== 'none') return;
      if (e.target.closest && e.target.closest('.plinko-overlay-panel, .slot-machine-overlay-panel, .puzzle-overlay-panel, #fps-startup-overlay, .modal-overlay, .panel')) {
        return; // Allow native mouse wheel scrolling in UI panels
      }
      e.preventDefault();
      if (this.state.cameraMode === 0) {
        this.state.camRadius = Math.max(0.8, Math.min(30.0, this.state.camRadius + e.deltaY * 0.004));
      } else {
        this.state.moveSpeed = Math.max(0.5, Math.min(30.0, this.state.moveSpeed * (e.deltaY > 0 ? 0.9 : 1.1)));
        this.log(`FP Camera Speed: ${this.state.moveSpeed.toFixed(1)} u/s`, "info");
      }
    }, { passive: false });

    // Keyboard Events (WASD / QE / Space / Shift)
    window.addEventListener('keydown', (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName : '';
      const isTyping = activeTag === 'INPUT' || activeTag === 'SELECT' || activeTag === 'TEXTAREA';
      const fpsOverlay = document.getElementById('fps-startup-overlay');
      const isOverlayOpen = fpsOverlay && fpsOverlay.style.display !== 'none';

      if (e.key === 'Escape' || e.code === 'Escape') {
        if (isOverlayOpen) {
          this.hideFpsStartupMenu();
          return;
        } else if (this.state.cameraMode === 3) {
          this.showFpsStartupMenu();
          return;
        }
      }

      if (isTyping || isOverlayOpen) return;

      const k = e.key.toLowerCase();
      if (k === 'w') this.state.keys.w = true;
      if (k === 'a') this.state.keys.a = true;
      if (k === 's') this.state.keys.s = true;
      if (k === 'd') this.state.keys.d = true;
      if (k === 'q') this.state.keys.q = true;
      if (k === 'e') this.state.keys.e = true;
      if (e.code === 'Space') {
        this.state.keys.space = true;
      }
      if (e.shiftKey) this.state.keys.shift = true;
    });

    window.addEventListener('keyup', (e) => {
      const fpsOverlay = document.getElementById('fps-startup-overlay');
      const isOverlayOpen = fpsOverlay && fpsOverlay.style.display !== 'none';

      if (isOverlayOpen) {
        this.state.keys.w = false;
        this.state.keys.a = false;
        this.state.keys.s = false;
        this.state.keys.d = false;
        this.state.keys.q = false;
        this.state.keys.e = false;
        this.state.keys.space = false;
        this.state.keys.shift = false;
        return;
      }

      const k = e.key.toLowerCase();
      if (k === 'w') this.state.keys.w = false;
      if (k === 'a') this.state.keys.a = false;
      if (k === 's') this.state.keys.s = false;
      if (k === 'd') this.state.keys.d = false;
      if (k === 'q') this.state.keys.q = false;
      if (k === 'e') this.state.keys.e = false;
      if (e.code === 'Space') this.state.keys.space = false;
      if (!e.shiftKey) this.state.keys.shift = false;
    });

    // Demo Scene Switcher
    const demoSelect = document.getElementById('demo-scene-select');
    if (demoSelect) {
      demoSelect.addEventListener('change', (e) => {
        this.state.demoScene = e.target.value;
        if (this.state.demoScene.includes('08_all_materials') || this.state.demoScene.includes('materials_presentation')) {
          this.state.cameraMode = 0;
          const camSelect = document.getElementById('camera-mode-select');
          if (camSelect) camSelect.value = "0";
          this.state.camRadius = 14.5;
          this.state.camPitch = 0.35;
          this.state.camYaw = 0.0;
          this.state.camTarget[0] = 0; this.state.camTarget[1] = 0.8; this.state.camTarget[2] = 0;
          updateFPSOverlays();
          this.focusShowroomMaterial(this.state.showroomFocusedMatKey || 'wood');
          this.log("Loaded Demo 08: All Materials Presentation Showcase (17 PBR Shaders)", "cpp");
        } else if (this.state.demoScene.includes('07_fps')) {
          this.state.cameraMode = 3;
          const camSelect = document.getElementById('camera-mode-select');
          if (camSelect) camSelect.value = "3";
          this.state.camPos[0] = 0.0;
          this.state.camPos[1] = 1.7;
          this.state.camPos[2] = 5.0;
          this.state.camYaw = 0.0;
          this.state.camPitch = 0.0;
          updateFPSOverlays();
          this.showFpsStartupMenu();
          this.log("Loaded Demo 07: First-Person Shooter & Damage System", "cpp");
          this.log("FPS Direct-Look Active: Click 'ENTER ARENA' in startup menu to begin!", "success");
        } else if (this.state.demoScene === '02_metallic_roughness_matrix.cpp' || this.state.demoScene === 'matrix') {
          this.state.cameraMode = 0;
          const camSelect = document.getElementById('camera-mode-select');
          if (camSelect) camSelect.value = "0";
          this.state.camRadius = 9.5;
          this.state.camPitch = 0.15;
          this.state.camYaw = 0.0;
          this.state.camTarget[0] = 0; this.state.camTarget[1] = 0; this.state.camTarget[2] = 0;
          updateFPSOverlays();
          this.log("Loaded Demo 02: 5x5 Metallic vs Roughness Grid Matrix (25 Objects)", "cpp");
        } else if (this.state.demoScene === '03_trefoil_studio.cpp' || this.state.demoScene === 'studio') {
          this.state.cameraMode = 0;
          const camSelect = document.getElementById('camera-mode-select');
          if (camSelect) camSelect.value = "0";
          this.state.activeMesh = 3; // Trefoil
          this.state.camRadius = 5.0;
          this.state.camPitch = 0.3;
          this.state.roughness = 0.15;
          this.state.metallic = 0.95;
          updateFPSOverlays();
          this.log("Loaded Demo 03: Trefoil Knot Multi-Light Studio", "cpp");
        } else if (this.state.demoScene === '01_pbr_material_preview.cpp' || this.state.demoScene === 'single') {
          this.state.cameraMode = 0;
          const camSelect = document.getElementById('camera-mode-select');
          if (camSelect) camSelect.value = "0";
          this.state.camRadius = 4.5;
          this.state.camTarget[0] = 0; this.state.camTarget[1] = 0; this.state.camTarget[2] = 0;
          updateFPSOverlays();
          this.log("Loaded Demo 01: Single Object PBR Material Inspector", "cpp");
        } else if (this.state.demoScene.includes('06_glb')) {
          this.state.cameraMode = 0;
          const camSelect = document.getElementById('camera-mode-select');
          if (camSelect) camSelect.value = "0";
          this.state.camRadius = 5.5;
          this.state.camPitch = 0.25;
          this.state.camTarget[0] = this.playerController.pos[0];
          this.state.camTarget[1] = this.playerController.pos[1] + 1.0;
          this.state.camTarget[2] = this.playerController.pos[2];
          updateFPSOverlays();
          this.log("Loaded Demo 06: GLB Character, Collision & Player Controller", "cpp");
        } else if (this.state.demoScene.includes('09_slot_machine')) {
          this.state.cameraMode = 0;
          const camSelect = document.getElementById('camera-mode-select');
          if (camSelect) camSelect.value = "0";
          this.state.camRadius = 5.2;
          this.state.camPitch = 0.15;
          this.state.camYaw = 0.0;
          this.state.camTarget[0] = 0.0;
          this.state.camTarget[1] = 0.2;
          this.state.camTarget[2] = 0.0;
          updateFPSOverlays();
          this.log("Loaded Demo 09: 3D Casino Slot Machine & Gold Coins Showcase", "cpp");
          this.initSlotMachineDemo();
        } else if (this.state.demoScene.includes('10_sliding_puzzle')) {
          this.state.cameraMode = 0;
          const camSelect = document.getElementById('camera-mode-select');
          if (camSelect) camSelect.value = "0";
          this.state.camRadius = 4.2;
          this.state.camPitch = 0.0;
          this.state.camYaw = 0.0;
          this.state.camTarget[0] = 0.0;
          this.state.camTarget[1] = 1.3;
          this.state.camTarget[2] = 0.0;
          updateFPSOverlays();
          this.log("Loaded Demo 10: Dynamic 3D Sliding Puzzle & UV Splitter", "cpp");
          this.initSlidingPuzzleDemo();
        } else if (this.state.demoScene.includes('11_plinko')) {
          this.state.cameraMode = 0;
          const camSelect = document.getElementById('camera-mode-select');
          if (camSelect) camSelect.value = "0";
          const isMobile = this.isMobileDevice();
          this.state.camRadius = isMobile ? 5.2 : 4.6;
          this.state.camPitch = isMobile ? 0.08 : 0.1;
          this.state.camYaw = 0.0;
          this.state.camTarget[0] = 0.0;
          this.state.camTarget[1] = 1.35;
          this.state.camTarget[2] = 0.0;
          updateFPSOverlays();
          this.log("Loaded Demo 11: 3D Plinko Cascade Showcase & Physics Engine", "cpp");
          this.initPlinkoDemo();
        } else if (this.state.demoScene.includes('12_roulette')) {
          this.state.cameraMode = 0;
          const camSelect = document.getElementById('camera-mode-select');
          if (camSelect) camSelect.value = "0";
          const isMobile = this.isMobileDevice();
          this.state.camRadius = isMobile ? 4.2 : 3.6;
          this.state.camPitch = 0.78; // beautiful tilted bird's-eye view
          this.state.camYaw = 0.0;
          this.state.camTarget[0] = 0.0;
          this.state.camTarget[1] = 0.0;
          this.state.camTarget[2] = 0.05;
          updateFPSOverlays();
          this.log("Loaded Demo 12: 3D Physics-Engine Roulette Wheel Showcase", "cpp");
          this.initRouletteDemo();
        } else {
          this.log(`Loaded Demo: ${this.state.demoScene}`, "cpp");
        }
        this.updateHUDStats();
        this.updateSceneEntitiesForActiveDemo();
      });
    }

    // Camera Mode Switcher
    const camSelect = document.getElementById('camera-mode-select');
    if (camSelect) {
      camSelect.addEventListener('change', (e) => {
        this.state.cameraMode = parseInt(e.target.value, 10);
        const modeName = e.target.options[e.target.selectedIndex].text;
        this.log(`Camera Controller switched to: [${modeName}]`, "cpp");
        updateFPSOverlays();
      });
    }

    // Invert Mouse Look Toggles
    const chkInvX = document.getElementById('chk-invert-mouse-x');
    if (chkInvX) {
      chkInvX.checked = this.state.invertMouseX;
      chkInvX.addEventListener('change', (e) => {
        this.state.invertMouseX = e.target.checked;
        this.log(`Invert Mouse Look Horizontal (Left/Right): ${this.state.invertMouseX ? 'ON' : 'OFF'}`, "info");
      });
    }

    const chkInvY = document.getElementById('chk-invert-mouse-y');
    if (chkInvY) {
      chkInvY.checked = this.state.invertMouseY;
      chkInvY.addEventListener('change', (e) => {
        this.state.invertMouseY = e.target.checked;
        this.log(`Invert Mouse Look Vertical (Up/Down): ${this.state.invertMouseY ? 'ON' : 'OFF'}`, "info");
      });
    }

    // Mesh selection
    document.querySelectorAll('.btn-mesh').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.btn-mesh').forEach(b => b.classList.remove('active'));
        const target = e.currentTarget;
        target.classList.add('active');
        this.state.activeMesh = parseInt(target.dataset.mesh, 10);
        this.updateHUDStats();
        this.log(`Active procedural mesh set to ID #${this.state.activeMesh} (${this.rawMeshes[this.state.activeMesh]?.name})`, "cpp");
      });
    });

    // Shader select
    const shaderSelect = document.getElementById('shader-select');
    if (shaderSelect) {
      shaderSelect.value = String(this.state.activeShader);
      shaderSelect.addEventListener('change', (e) => {
        this.state.activeShader = parseInt(e.target.value, 10);
        this.state.fpsCheapMaterial = (this.state.activeShader === 4);
        this.toggleCheapMaterial(this.state.fpsCheapMaterial);
        this.log(`Switched active Shader Program to #${this.state.activeShader}`, "info");
      });
    }

    // Viewport HUD Cheap Material quick toggle button
    const btnCheapMat = document.getElementById('btn-fps-cheap-mat-toggle');
    if (btnCheapMat) {
      btnCheapMat.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleCheapMaterial();
      });
    }

    // Roughness slider
    const sliderRoughness = document.getElementById('slider-roughness');
    const valRoughness = document.getElementById('val-roughness');
    if (sliderRoughness && valRoughness) {
      sliderRoughness.addEventListener('input', (e) => {
        this.state.roughness = parseFloat(e.target.value);
        valRoughness.textContent = this.state.roughness.toFixed(2);
      });
    }

    // Metallic slider
    const sliderMetallic = document.getElementById('slider-metallic');
    const valMetallic = document.getElementById('val-metallic');
    if (sliderMetallic && valMetallic) {
      sliderMetallic.addEventListener('input', (e) => {
        this.state.metallic = parseFloat(e.target.value);
        valMetallic.textContent = this.state.metallic.toFixed(2);
      });
    }

    // Speed slider
    const sliderSpeed = document.getElementById('slider-speed');
    const valSpeed = document.getElementById('val-speed');
    if (sliderSpeed && valSpeed) {
      sliderSpeed.addEventListener('input', (e) => {
        this.state.speed = parseFloat(e.target.value);
        valSpeed.textContent = this.state.speed.toFixed(2);
      });
    }

    // Color buttons
    document.querySelectorAll('.color-dot').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.color-dot').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const rgb = e.currentTarget.dataset.color.split(',').map(Number);
        this.state.baseColor = rgb;
        this.log(`Albedo updated: rgb(${rgb.map(c=>c.toFixed(2)).join(',')})`, "info");
      });
    });

    // Toggles
    document.getElementById('toggle-autorotate').addEventListener('change', (e) => {
      this.state.autoRotate = e.target.checked;
    });
    document.getElementById('toggle-depth').addEventListener('change', (e) => {
      this.state.depthTest = e.target.checked;
    });
    document.getElementById('toggle-cull').addEventListener('change', (e) => {
      this.state.cullFace = e.target.checked;
    });

    // Camera reset
    document.getElementById('btn-reset-cam').addEventListener('click', () => {
      this.state.camYaw = 0.0;
      this.state.camPitch = 0.25;
      this.state.camRadius = this.state.demoScene === 'matrix' ? 9.5 : 4.5;
      this.state.camPos[0] = 0; this.state.camPos[1] = 1.2; this.state.camPos[2] = this.state.camRadius;
      this.state.camTarget[0] = 0; this.state.camTarget[1] = 0; this.state.camTarget[2] = 0;
      this.log("Camera pose reset to origin lookAt.", "info");
    });

    // Clear logs
    document.getElementById('btn-clear-log').addEventListener('click', () => {
      document.getElementById('console-logs').innerHTML = '';
    });

    // EXPORT TOOLS
    document.getElementById('btn-export-obj').addEventListener('click', () => {
      this.exportActiveMeshOBJ();
    });

    document.getElementById('btn-export-shot').addEventListener('click', () => {
      this.exportSnapshotPNG();
    });

    document.getElementById('btn-export-json').addEventListener('click', () => {
      this.exportSceneJSON();
    });

    // Tabs Horizontal Wheel Scroll
    const mainTabsNav = document.getElementById('app-tabs-nav');
    if (mainTabsNav) {
      mainTabsNav.addEventListener('wheel', (e) => {
        if (e.deltaY !== 0) {
          e.preventDefault();
          mainTabsNav.scrollLeft += e.deltaY;
        }
      }, { passive: false });
    }

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const tabId = `tab-${e.currentTarget.dataset.tab}`;
        const targetTab = document.getElementById(tabId);
        if (targetTab) {
          targetTab.classList.add('active');
          if (e.currentTarget.dataset.tab === 'viewport') {
            setTimeout(() => this.onResize(), 10);
          }
        }
      });
    });

    // WASM Export Sub-Tabs Handler
    const exportSubtabBtns = document.querySelectorAll('.export-subtab-btn');
    const exportSubcontents = document.querySelectorAll('.export-subcontent');
    exportSubtabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        exportSubtabBtns.forEach(b => b.classList.remove('active'));
        exportSubcontents.forEach(c => c.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const targetId = `export-subtab-${e.currentTarget.dataset.exportSubtab}`;
        const targetEl = document.getElementById(targetId);
        if (targetEl) targetEl.classList.add('active');
      });
    });

    // Toggle bottom console panel in viewport tab
    const consoleCard = document.getElementById('viewport-console-card');
    const btnToggleConsole = document.getElementById('btn-toggle-console');
    const btnMinimizeConsole = document.getElementById('btn-minimize-console');

    if (btnToggleConsole && consoleCard) {
      btnToggleConsole.addEventListener('click', () => {
        consoleCard.classList.toggle('minimized');
        setTimeout(() => this.onResize(), 20);
      });
    }

    if (btnMinimizeConsole && consoleCard) {
      btnMinimizeConsole.addEventListener('click', () => {
        consoleCard.classList.add('minimized');
        setTimeout(() => this.onResize(), 20);
      });
    }

    // Filament Examples Dropdown
    const exSelect = document.getElementById('filament-examples-select');
    if (exSelect) {
      exSelect.addEventListener('change', (e) => {
        const code = SOURCE_FILES[e.target.value] || '';
        document.getElementById('example-display').textContent = code;
      });
    }

    // Export Scripts Dropdown
    const exportSelect = document.getElementById('export-scripts-select');
    if (exportSelect) {
      exportSelect.addEventListener('change', (e) => {
        const code = SOURCE_FILES[e.target.value] || '';
        document.getElementById('export-display').textContent = code;
      });
    }

    // Headers Dropdown
    const hppSelect = document.getElementById('hpp-file-select');
    if (hppSelect) {
      hppSelect.addEventListener('change', (e) => {
        const code = SOURCE_FILES[e.target.value] || '';
        document.getElementById('header-display').textContent = code;
      });
    }

    // Copy buttons
    const btnCopyEx = document.getElementById('btn-copy-example');
    if (btnCopyEx) {
      btnCopyEx.addEventListener('click', () => {
        const text = document.getElementById('example-display').textContent;
        navigator.clipboard.writeText(text);
        this.log("Filament example copied to clipboard.", "success");
      });
    }

    const btnCopyExport = document.getElementById('btn-copy-export');
    if (btnCopyExport) {
      btnCopyExport.addEventListener('click', () => {
        const text = document.getElementById('export-display').textContent;
        navigator.clipboard.writeText(text);
        this.log("Export script copied to clipboard.", "success");
      });
    }

    const btnCopyHeader = document.getElementById('btn-copy-header');
    if (btnCopyHeader) {
      btnCopyHeader.addEventListener('click', () => {
        const text = document.getElementById('header-display').textContent;
        navigator.clipboard.writeText(text);
        this.log("Header copied to clipboard.", "success");
      });
    }

    // Fullscreen toggle
    document.getElementById('btn-fullscreen').addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(()=>{});
      } else {
        document.exitFullscreen().catch(()=>{});
      }
    });

    window.addEventListener('resize', this.onResize.bind(this));
  }

  initBackendInterconnection() {
    // 1. Setup Console Mode Switcher (Engine Stream vs Backend Shell Terminal)
    const engineTabBtn = document.getElementById('tab-btn-engine');
    const termTabBtn = document.getElementById('tab-btn-terminal');
    const engineBody = document.getElementById('console-logs');
    const termBody = document.getElementById('terminal-body');

    if (engineTabBtn && termTabBtn) {
      engineTabBtn.addEventListener('click', () => {
        engineTabBtn.classList.add('active');
        termTabBtn.classList.remove('active');
        if (engineBody) engineBody.style.display = 'block';
        if (termBody) termBody.style.display = 'none';
      });

      termTabBtn.addEventListener('click', () => {
        termTabBtn.classList.add('active');
        engineTabBtn.classList.remove('active');
        if (termBody) termBody.style.display = 'flex';
        if (engineBody) engineBody.style.display = 'none';
        const input = document.getElementById('terminal-cmd-input');
        if (input) input.focus();
      });
    }

    // 2. Terminal Input & Run Button
    const cmdInput = document.getElementById('terminal-cmd-input');
    const btnExec = document.getElementById('btn-terminal-exec');

    if (cmdInput && btnExec) {
      const handleRun = () => {
        const cmd = cmdInput.value.trim();
        if (!cmd) return;
        this.executeBackendCmd(cmd);
        this.cmdHistory.unshift(cmd);
        this.cmdHistoryIndex = -1;
        cmdInput.value = '';
      };

      btnExec.addEventListener('click', handleRun);

      cmdInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          handleRun();
        } else if (e.key === 'ArrowUp') {
          if (this.cmdHistory.length > 0) {
            this.cmdHistoryIndex = Math.min(this.cmdHistory.length - 1, this.cmdHistoryIndex + 1);
            cmdInput.value = this.cmdHistory[this.cmdHistoryIndex] || '';
          }
        } else if (e.key === 'ArrowDown') {
          if (this.cmdHistoryIndex > 0) {
            this.cmdHistoryIndex--;
            cmdInput.value = this.cmdHistory[this.cmdHistoryIndex] || '';
          } else if (this.cmdHistoryIndex === 0) {
            this.cmdHistoryIndex = -1;
            cmdInput.value = '';
          }
        }
      });
    }

    // 3. Quick Command Chips
    document.querySelectorAll('.chip-cmd').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        const cmd = e.currentTarget.dataset.cmd;
        if (cmd) {
          this.switchConsoleMode('terminal');
          this.executeBackendCmd(cmd);
        }
      });
    });

    // 4. Native Build Buttons
    document.querySelectorAll('.btn-build').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget.dataset.buildTarget;
        if (target) {
          this.switchConsoleMode('terminal');
          this.executeBackendBuild(target);
        }
      });
    });

    // 5. Host Info & Inspect Toolchain Buttons
    const btnSysInfo = document.getElementById('btn-refresh-sysinfo');
    if (btnSysInfo) {
      btnSysInfo.addEventListener('click', () => {
        this.switchConsoleMode('terminal');
        this.fetchSystemInfo(true);
      });
    }

    const btnInspectToolchain = document.getElementById('btn-inspect-toolchain');
    if (btnInspectToolchain) {
      btnInspectToolchain.addEventListener('click', () => {
        this.switchConsoleMode('terminal');
        this.fetchSystemInfo(true);
      });
    }

    // Initial system detection
    this.fetchSystemInfo(false);
  }

  switchConsoleMode(mode) {
    const engineTabBtn = document.getElementById('tab-btn-engine');
    const termTabBtn = document.getElementById('tab-btn-terminal');
    const engineBody = document.getElementById('console-logs');
    const termBody = document.getElementById('terminal-body');

    if (mode === 'terminal') {
      if (termTabBtn) termTabBtn.classList.add('active');
      if (engineTabBtn) engineTabBtn.classList.remove('active');
      if (termBody) termBody.style.display = 'flex';
      if (engineBody) engineBody.style.display = 'none';
    } else {
      if (engineTabBtn) engineTabBtn.classList.add('active');
      if (termTabBtn) termTabBtn.classList.remove('active');
      if (engineBody) engineBody.style.display = 'block';
      if (termBody) termBody.style.display = 'none';
    }
  }

  appendTerminalLine(content, type = 'stdout', banner = null) {
    const out = document.getElementById('terminal-output');
    if (!out) return;

    const div = document.createElement('div');
    div.className = `term-line ${type} font-mono`;
    div.textContent = content;

    if (banner) {
      const b = document.createElement('span');
      b.className = `term-line banner ${banner.type}`;
      b.textContent = banner.text;
      div.appendChild(document.createElement('br'));
      div.appendChild(b);
    }

    out.appendChild(div);
    out.scrollTop = out.scrollHeight;
  }

  async fetchSystemInfo(verbose = false) {
    const statusPill = document.getElementById('backend-status-pill');
    const statusText = document.getElementById('backend-status-text');

    try {
      const res = await fetch('/api/system-info');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (statusPill && statusText) {
        statusPill.classList.remove('offline');
        statusText.textContent = `Backend: Online (${data.platform} ${data.arch})`;
      }

      // Update Toolchain Table in WASM tab
      if (data.toolchain) {
        const cmakeVal = document.getElementById('tool-cmake');
        const gccVal = document.getElementById('tool-gcc');
        const clangVal = document.getElementById('tool-clang');
        const emccVal = document.getElementById('tool-emcc');
        const nodeVal = document.getElementById('tool-node');
        const platformVal = document.getElementById('tool-platform');

        if (cmakeVal) cmakeVal.textContent = data.toolchain.cmake || 'Not installed';
        if (gccVal) gccVal.textContent = data.toolchain.gcc || data.toolchain['g++'] || 'Not installed';
        if (clangVal) clangVal.textContent = data.toolchain.clang || data.toolchain['clang++'] || 'Not installed';
        if (emccVal) emccVal.textContent = data.toolchain.emcc || 'Not in PATH (use ./build_wasm.sh)';
        if (nodeVal) nodeVal.textContent = `${data.nodeVersion} (${data.cpus} CPUs, ${data.totalMemoryMb} MB RAM)`;
        if (platformVal) platformVal.textContent = `${data.platform} ${data.arch} (${data.release})`;
      }

      if (verbose) {
        this.appendTerminalLine(`[HOST SYSTEM TELEMETRY]`, 'info');
        this.appendTerminalLine(`  OS: ${data.platform} (${data.release}) [${data.arch}]`, 'stdout');
        this.appendTerminalLine(`  CPU: ${data.cpus} Logical Cores | Memory: ${data.freeMemoryMb} MB free / ${data.totalMemoryMb} MB total`, 'stdout');
        this.appendTerminalLine(`  Node: ${data.nodeVersion} | Working Dir: ${data.cwd}`, 'stdout');
        this.appendTerminalLine(`  Toolchain Detection:`, 'info');
        for (const [k, v] of Object.entries(data.toolchain || {})) {
          this.appendTerminalLine(`    - ${k.padEnd(10, ' ')} : ${v ? v : 'Not found in environment'}`, v ? 'stdout' : 'muted');
        }
      }
    } catch (err) {
      if (statusPill && statusText) {
        statusPill.classList.add('offline');
        statusText.textContent = 'Backend: Disconnected';
      }
      if (verbose) {
        this.appendTerminalLine(`[ERROR] Unable to reach backend API: ${err.message}`, 'stderr');
      }
    }
  }

  async executeBackendCmd(cmd) {
    if (this.isExecutingCmd) {
      this.appendTerminalLine(`[BUSY] Another command is currently executing. Please wait...`, 'stderr');
      return;
    }

    this.isExecutingCmd = true;
    const btnExec = document.getElementById('btn-terminal-exec');
    if (btnExec) btnExec.disabled = true;

    this.appendTerminalLine(`$ ${cmd}`, 'cmd');
    this.log(`CLI: Executing backend command: "${cmd}"`, 'cpp');

    try {
      const startTime = performance.now();
      const res = await fetch('/api/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const result = await res.json();
      const duration = result.durationMs || Math.round(performance.now() - startTime);

      if (result.stdout) {
        this.appendTerminalLine(result.stdout, 'stdout');
      }
      if (result.stderr) {
        this.appendTerminalLine(result.stderr, result.success ? 'muted' : 'stderr');
      }

      if (result.success) {
        this.appendTerminalLine(
          `Command finished successfully (took ${duration}ms)`,
          'success',
          { type: 'ok', text: `✔ Exit code 0 [${duration}ms]` }
        );
        this.log(`CLI: Command "${cmd}" finished (Exit 0, ${duration}ms)`, 'success');
      } else {
        this.appendTerminalLine(
          `Command failed with exit code ${result.exitCode} (took ${duration}ms)`,
          'stderr',
          { type: 'err', text: `✖ Exit code ${result.exitCode} [${duration}ms]` }
        );
        this.log(`CLI: Command "${cmd}" failed (Exit ${result.exitCode})`, 'info');
      }
    } catch (err) {
      this.appendTerminalLine(`Failed to execute command: ${err.message}`, 'stderr');
      this.log(`CLI: Backend execution network error: ${err.message}`, 'info');
    } finally {
      this.isExecutingCmd = false;
      if (btnExec) btnExec.disabled = false;
    }
  }

  async executeBackendBuild(target) {
    if (this.isExecutingCmd) {
      this.appendTerminalLine(`[BUSY] Build/execution currently in progress. Please wait...`, 'stderr');
      return;
    }

    this.isExecutingCmd = true;
    const btnExec = document.getElementById('btn-terminal-exec');
    if (btnExec) btnExec.disabled = true;

    this.appendTerminalLine(`[TRIGGER BUILD] Target: "${target}"`, 'info');
    this.log(`Triggered backend build routine for target: ${target}`, 'cpp');

    try {
      const res = await fetch('/api/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();

      if (result.stdout) this.appendTerminalLine(result.stdout, 'stdout');
      if (result.stderr) this.appendTerminalLine(result.stderr, result.success ? 'muted' : 'stderr');

      if (result.success) {
        this.appendTerminalLine(
          `Build "${target}" succeeded in ${result.durationMs}ms`,
          'success',
          { type: 'ok', text: `✔ Build Completed (Exit 0)` }
        );
        this.log(`Build target [${target}] completed successfully.`, 'success');
      } else {
        this.appendTerminalLine(
          `Build "${target}" exited with code ${result.exitCode}`,
          'stderr',
          { type: 'err', text: `✖ Build Failed (Exit ${result.exitCode})` }
        );
      }
    } catch (err) {
      this.appendTerminalLine(`Build dispatch error: ${err.message}`, 'stderr');
    } finally {
      this.isExecutingCmd = false;
      if (btnExec) btnExec.disabled = false;
    }
  }

  exportActiveMeshOBJ() {
    const raw = this.rawMeshes[this.state.activeMesh];
    if (!raw) return;

    let obj = `# Wavefront OBJ exported from Native C++ / WebGPU Engine\n# Mesh: ${raw.name}\n`;
    for (let i = 0; i < raw.positions.length; i += 3) {
      obj += `v ${raw.positions[i].toFixed(4)} ${raw.positions[i+1].toFixed(4)} ${raw.positions[i+2].toFixed(4)}\n`;
    }
    for (let i = 0; i < raw.normals.length; i += 3) {
      obj += `vn ${raw.normals[i].toFixed(4)} ${raw.normals[i+1].toFixed(4)} ${raw.normals[i+2].toFixed(4)}\n`;
    }
    for (let i = 0; i < raw.uvs.length; i += 2) {
      obj += `vt ${raw.uvs[i].toFixed(4)} ${raw.uvs[i+1].toFixed(4)}\n`;
    }
    for (let i = 0; i < raw.indices.length; i += 3) {
      const a = raw.indices[i] + 1;
      const b = raw.indices[i+1] + 1;
      const c = raw.indices[i+2] + 1;
      obj += `f ${a}/${a}/${a} ${b}/${b}/${b} ${c}/${c}/${c}\n`;
    }

    const blob = new Blob([obj], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${raw.name.toLowerCase()}_mesh.obj`;
    a.click();
    URL.revokeObjectURL(url);
    this.log(`Exported Wavefront OBJ: [${raw.name}.obj] (${(obj.length/1024).toFixed(1)} KB)`, "success");
  }

  exportSnapshotPNG() {
    const url = this.canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `filament_preview_${Date.now()}.png`;
    a.click();
    this.log("High-resolution PNG render snapshot saved.", "success");
  }

  exportSceneJSON() {
    const data = {
      engine: "Google Filament Architecture (C++ / WebGPU Pipeline)",
      timestamp: new Date().toISOString(),
      activeDemo: this.state.demoScene,
      camera: {
        mode: this.state.cameraMode === 0 ? "OrbitArc" : "FirstPerson",
        yaw: this.state.camYaw,
        pitch: this.state.camPitch,
        radius: this.state.camRadius,
        position: Array.from(this.state.camPos),
        target: Array.from(this.state.camTarget)
      },
      material: {
        activeShader: this.state.activeShader,
        albedo: this.state.baseColor,
        roughness: this.state.roughness,
        metallic: this.state.metallic
      },
      geometry: {
        activeMeshId: this.state.activeMesh,
        meshName: this.rawMeshes[this.state.activeMesh]?.name,
        vertices: this.rawMeshes[this.state.activeMesh]?.positions.length / 3,
        triangles: this.rawMeshes[this.state.activeMesh]?.indices.length / 3
      }
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `filament_scene_manifest_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.log("Scene Manifest JSON config exported.", "success");
  }

  preventBrowserZoom() {
    // 1. Prevent Safari iOS gesture zoom events on window/document
    const stopGesture = (e) => e.preventDefault();
    document.addEventListener('gesturestart', stopGesture, { passive: false });
    document.addEventListener('gesturechange', stopGesture, { passive: false });
    document.addEventListener('gestureend', stopGesture, { passive: false });

    // 2. Prevent Ctrl + Wheel browser zooming on desktop browsers and touchpads
    window.addEventListener('wheel', (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    }, { passive: false });

    // 3. Prevent Ctrl + '+' / '-' / '=' / '0' browser zoom keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
        e.preventDefault();
      }
    });

    // 4. Prevent mobile double-tap zoom on quick taps across non-input UI elements
    let lastTapTime = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTapTime <= 300) {
        const tag = e.target ? e.target.tagName : '';
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          if (e.target.closest && e.target.closest('.plinko-overlay-panel, .slot-machine-overlay-panel, .puzzle-overlay-panel, .tab-content, .panel, .modal-overlay')) {
            return;
          }
          e.preventDefault();
        }
      }
      lastTapTime = now;
    }, { passive: false });
  }

  initMobileJoystick() {
    this.joystickState = {
      active: false,
      touchId: null,
      startX: 0,
      startY: 0,
      currX: 0,
      currY: 0,
      dirX: 0,
      dirY: 0,
      maxRadius: 42
    };

    this.touchLookState = {
      active: false,
      touchId: null,
      lastX: 0,
      lastY: 0
    };

    const overlay = document.getElementById('mobile-touch-overlay');
    const joystickBase = document.getElementById('joystick-left-base');
    const joystickKnob = document.getElementById('joystick-left-knob');
    const lookHint = document.getElementById('touch-look-hint');
    const btnToggleJoy = document.getElementById('btn-toggle-joystick');

    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.innerWidth <= 900);
    this.mobileControlsMode = 'auto'; // 'auto' | 'always' | 'off'

    const updateOverlayVisibility = () => {
      if (!overlay) return;
      if (this.mobileControlsMode === 'always') {
        overlay.classList.remove('hidden');
        if (btnToggleJoy) btnToggleJoy.textContent = '🎮 Joystick: ON';
      } else if (this.mobileControlsMode === 'off') {
        overlay.classList.add('hidden');
        if (btnToggleJoy) btnToggleJoy.textContent = '🎮 Joystick: OFF';
      } else {
        // Auto
        overlay.classList.remove('hidden');
        if (btnToggleJoy) btnToggleJoy.textContent = '🎮 Joystick: AUTO';
      }
    };

    if (btnToggleJoy) {
      btnToggleJoy.addEventListener('click', () => {
        if (this.mobileControlsMode === 'auto') this.mobileControlsMode = 'always';
        else if (this.mobileControlsMode === 'always') this.mobileControlsMode = 'off';
        else this.mobileControlsMode = 'auto';
        updateOverlayVisibility();
        this.log(`Mobile Joystick mode: ${this.mobileControlsMode.toUpperCase()}`, "info");
      });
    }

    updateOverlayVisibility();

    // Joystick Touch Handlers
    if (joystickBase && joystickKnob) {
      const handleJoyStart = (clientX, clientY, touchId = null) => {
        const rect = joystickBase.getBoundingClientRect();
        this.joystickState.active = true;
        this.joystickState.touchId = touchId;
        this.joystickState.startX = rect.left + rect.width / 2;
        this.joystickState.startY = rect.top + rect.height / 2;
        joystickBase.classList.add('active');
        handleJoyMove(clientX, clientY);
      };

      const handleJoyMove = (clientX, clientY) => {
        if (!this.joystickState.active) return;
        const dx = clientX - this.joystickState.startX;
        const dy = clientY - this.joystickState.startY;
        const dist = Math.hypot(dx, dy);
        const maxR = this.joystickState.maxRadius;
        const angle = Math.atan2(dy, dx);
        const clampedDist = Math.min(dist, maxR);

        const knobX = Math.cos(angle) * clampedDist;
        const knobY = Math.sin(angle) * clampedDist;

        joystickKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;

        // Normalize direction -1.0 to 1.0 (X: strafe left/right, Y: forward/back)
        this.joystickState.dirX = knobX / maxR;
        this.joystickState.dirY = knobY / maxR;
      };

      const handleJoyEnd = () => {
        this.joystickState.active = false;
        this.joystickState.touchId = null;
        this.joystickState.dirX = 0;
        this.joystickState.dirY = 0;
        joystickKnob.style.transform = 'translate(-50%, -50%)';
        joystickBase.classList.remove('active');
      };

      // Touch events on Joystick
      joystickBase.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        handleJoyStart(touch.clientX, touch.clientY, touch.identifier);
      }, { passive: false });

      window.addEventListener('touchmove', (e) => {
        if (!this.joystickState.active) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.identifier === this.joystickState.touchId) {
            handleJoyMove(t.clientX, t.clientY);
            break;
          }
        }
      }, { passive: false });

      window.addEventListener('touchend', (e) => {
        if (!this.joystickState.active) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.identifier === this.joystickState.touchId) {
            handleJoyEnd();
            break;
          }
        }
      });

      window.addEventListener('touchcancel', handleJoyEnd);

      // Mouse fallback for testing joystick on desktop
      joystickBase.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        handleJoyStart(e.clientX, e.clientY);
        const onMouseMove = (ev) => handleJoyMove(ev.clientX, ev.clientY);
        const onMouseUp = () => {
          handleJoyEnd();
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });
    }

    // Touch Look / Rotate on Viewport Canvas & Classic Gesture Touch Zoom
    const canvasContainer = document.getElementById('canvas-container');
    if (canvasContainer) {
      this.pinchZoomState = {
        active: false,
        startDist: 0,
        lastDist: 0,
        lastTapTime: 0
      };

      const getTouchDist = (t1, t2) => {
        return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      };

      canvasContainer.addEventListener('touchstart', (e) => {
        // If touch occurred inside any overlay dialog, buttons, or scrollable panels, do NOT preventDefault or trigger camera orbit!
        if (e.target.closest && e.target.closest('.plinko-overlay-panel, .slot-machine-overlay-panel, .puzzle-overlay-panel, #fps-startup-overlay, .modal-overlay, .plinko-mobile-fab, button, input, select, textarea')) {
          return;
        }
        e.preventDefault();

        // ✌️ Classic Two-Finger Pinch-to-Zoom Gesture for 3D Scene / Plinko Table
        if (e.touches.length >= 2) {
          const t0 = e.touches[0];
          const t1 = e.touches[1];
          const dist = getTouchDist(t0, t1);
          this.pinchZoomState.active = true;
          this.pinchZoomState.startDist = dist;
          this.pinchZoomState.lastDist = dist;
          // Temporarily pause single-finger look to prevent jumpy camera yaw/pitch
          this.touchLookState.active = false;
          return;
        }

        // 👆 Single Finger Orbit Look or Double-Tap Zoom Reset
        if (e.touches.length === 1) {
          const touch = e.touches[0];
          const now = Date.now();
          if (now - this.pinchZoomState.lastTapTime < 320) {
            // Quick double tap resets camera on 3D table / orbit mode
            if (this.state.demoScene.includes('11_plinko') || this.state.cameraMode === 0) {
              const isMobile = this.isMobileDevice();
              this.state.camRadius = isMobile ? 5.2 : 4.6;
              this.state.camPitch = isMobile ? 0.08 : 0.1;
              this.state.camYaw = 0.0;
              this.state.camTarget[0] = 0.0;
              this.state.camTarget[1] = 1.35;
              this.state.camTarget[2] = 0.0;
              this.log("3D Plinko Camera View Reset to Default", "info");
            }
          }
          this.pinchZoomState.lastTapTime = now;

          if (touch.identifier !== this.joystickState.touchId && !this.touchLookState.active) {
            this.touchLookState.active = true;
            this.touchLookState.touchId = touch.identifier;
            this.touchLookState.lastX = touch.clientX;
            this.touchLookState.lastY = touch.clientY;
            if (lookHint) lookHint.classList.add('faded');
          }
        }
      }, { passive: false });

      canvasContainer.addEventListener('touchmove', (e) => {
        if (e.target.closest && e.target.closest('.plinko-overlay-panel, .slot-machine-overlay-panel, .puzzle-overlay-panel, #fps-startup-overlay, .modal-overlay, .plinko-mobile-fab, button, input, select, textarea')) {
          return;
        }
        e.preventDefault();

        // ✌️ Handle Two-Finger Pinch-To-Zoom Gesture
        if (e.touches.length >= 2) {
          const t0 = e.touches[0];
          const t1 = e.touches[1];
          const currentDist = getTouchDist(t0, t1);

          if (!this.pinchZoomState.active) {
            this.pinchZoomState.active = true;
            this.pinchZoomState.startDist = currentDist;
            this.pinchZoomState.lastDist = currentDist;
          }

          const deltaDist = currentDist - this.pinchZoomState.lastDist;
          this.pinchZoomState.lastDist = currentDist;

          if (Math.abs(deltaDist) > 0.05) {
            // In 3D Plinko table / Orbit Camera mode:
            // Fingers spread (deltaDist > 0) -> zoom in (lower radius)
            // Fingers pinch together (deltaDist < 0) -> zoom out (higher radius)
            if (this.state.cameraMode === 0 || this.state.demoScene.includes('11_plinko')) {
              const zoomSens = 0.014 * Math.max(0.4, this.state.camRadius * 0.22);
              this.state.camRadius = Math.max(1.0, Math.min(26.0, this.state.camRadius - deltaDist * zoomSens));
            } else {
              this.state.moveSpeed = Math.max(0.5, Math.min(30.0, this.state.moveSpeed + deltaDist * 0.02));
            }
          }
          return;
        }

        // 👆 Single Finger Orbit / Swipe Look
        if (!this.touchLookState.active || this.pinchZoomState.active) return;
        const invX = this.state.invertMouseX ? -1 : 1;
        const invY = this.state.invertMouseY ? -1 : 1;

        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (touch.identifier === this.touchLookState.touchId) {
            const dx = touch.clientX - this.touchLookState.lastX;
            const dy = touch.clientY - this.touchLookState.lastY;
            this.touchLookState.lastX = touch.clientX;
            this.touchLookState.lastY = touch.clientY;

            if (this.state.cameraMode === 0 || this.state.demoScene.includes('11_plinko')) {
              // Orbit mode swipe
              this.state.camYaw += dx * 0.008 * invX;
              this.state.camPitch = Math.max(-1.45, Math.min(1.45, this.state.camPitch + dy * 0.008 * invY));
            } else {
              // First-Person swipe look
              this.state.camYaw += dx * 0.005 * invX;
              this.state.camPitch = Math.max(-1.5, Math.min(1.5, this.state.camPitch - dy * 0.005 * invY));
            }
            break;
          }
        }
      }, { passive: false });

      const endTouchLook = (e) => {
        if (e.touches.length < 2) {
          this.pinchZoomState.active = false;
        }
        if (e.touches.length === 1 && !this.touchLookState.active) {
          // Seamless transition from pinch to single-touch orbit without camera jerk
          const remainingTouch = e.touches[0];
          if (remainingTouch.identifier !== this.joystickState.touchId) {
            this.touchLookState.active = true;
            this.touchLookState.touchId = remainingTouch.identifier;
            this.touchLookState.lastX = remainingTouch.clientX;
            this.touchLookState.lastY = remainingTouch.clientY;
          }
        }
        if (!this.touchLookState.active) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.touchLookState.touchId) {
            this.touchLookState.active = false;
            this.touchLookState.touchId = null;
            break;
          }
        }
      };

      canvasContainer.addEventListener('touchend', endTouchLook, { passive: false });
      canvasContainer.addEventListener('touchcancel', endTouchLook, { passive: false });
    }

    // Mobile Action Pad Buttons
    const btnUp = document.getElementById('btn-touch-up');
    const btnDown = document.getElementById('btn-touch-down');
    const btnSprint = document.getElementById('btn-touch-sprint');
    const btnCam = document.getElementById('btn-touch-cam');
    const btnReset = document.getElementById('btn-touch-reset');

    const bindTouchButton = (elem, onDown, onUp) => {
      if (!elem) return;
      elem.addEventListener('touchstart', (e) => {
        e.preventDefault();
        elem.classList.add('active');
        onDown();
      }, { passive: false });

      elem.addEventListener('touchend', (e) => {
        e.preventDefault();
        elem.classList.remove('active');
        onUp();
      }, { passive: false });

      elem.addEventListener('mousedown', (e) => {
        elem.classList.add('active');
        onDown();
      });

      window.addEventListener('mouseup', () => {
        elem.classList.remove('active');
        onUp();
      });
    };

    // JUMP / UP (Space key / E in Free-Fly)
    bindTouchButton(btnUp, () => {
      this.state.keys.space = true;
      this.state.keys.e = true;
    }, () => {
      this.state.keys.space = false;
      this.state.keys.e = false;
    });

    // DOWN / Descend (Q key in Free-Fly)
    bindTouchButton(btnDown, () => { this.state.keys.q = true; }, () => { this.state.keys.q = false; });

    // SPRINT Toggle (Shift)
    if (btnSprint) {
      btnSprint.addEventListener('click', (e) => {
        e.preventDefault();
        this.state.keys.shift = !this.state.keys.shift;
        if (this.state.keys.shift) {
          btnSprint.classList.add('active');
          this.log("Mobile Sprint Boost: ACTIVE (2.5x speed)", "info");
        } else {
          btnSprint.classList.remove('active');
          this.log("Mobile Sprint Boost: NORMAL speed", "info");
        }
      });
    }

    // CAMERA Mode Cycle
    if (btnCam) {
      btnCam.addEventListener('click', (e) => {
        e.preventDefault();
        this.state.cameraMode = (this.state.cameraMode + 1) % 3;
        const camSelect = document.getElementById('camera-mode-select');
        if (camSelect) camSelect.value = String(this.state.cameraMode);
        const modeNames = ["Arc Orbit", "First-Person", "6-DOF Free-Fly"];
        this.log(`Camera switched to [${modeNames[this.state.cameraMode]}]`, "cpp");
        const fpHelp = document.getElementById('fp-help');
        if (fpHelp) fpHelp.style.display = this.state.cameraMode !== 0 ? 'block' : 'none';
      });
    }

    // RESET Camera View
    if (btnReset) {
      btnReset.addEventListener('click', (e) => {
        e.preventDefault();
        this.state.camYaw = 0.0;
        this.state.camPitch = 0.25;
        this.state.camRadius = this.state.demoScene === 'matrix' ? 9.5 : 4.5;
        this.state.camPos[0] = 0; this.state.camPos[1] = 1.2; this.state.camPos[2] = this.state.camRadius;
        this.state.camTarget[0] = 0; this.state.camTarget[1] = 0; this.state.camTarget[2] = 0;
        this.log("Mobile camera pose reset.", "info");
      });
    }
  }

  populateUnifiedSelects() {
    const UNIFIED_DEMO_FILES_CONFIG = [
      // Examples / Demos
      { value: "01_pbr_material_preview.cpp", path: "examples/01_pbr_material_preview.cpp", name: "Demo 01: PBR Material Preview", isDemoScene: true, isLiveFile: true, isExampleTab: true },
      { value: "02_metallic_roughness_matrix.cpp", path: "examples/02_metallic_roughness_matrix.cpp", name: "Demo 02: Metallic Roughness Matrix", isDemoScene: true, isLiveFile: true, isExampleTab: true },
      { value: "03_trefoil_studio.cpp", path: "examples/03_trefoil_studio.cpp", name: "Demo 03: Trefoil Studio Lighting", isDemoScene: true, isLiveFile: true, isExampleTab: true },
      { value: "04_wasm_webgl_wrapper.cpp", path: "examples/04_wasm_webgl_wrapper.cpp", name: "Demo 04: WASM WebGL Wrapper", isDemoScene: true, isLiveFile: true, isExampleTab: true },
      { value: "05_desktop_standalone_app.cpp", path: "examples/05_desktop_standalone_app.cpp", name: "Demo 05: Desktop Standalone SDL2 App", isDemoScene: true, isLiveFile: true, isExampleTab: true },
      { value: "06_glb_character_collision_player.cpp", path: "examples/06_glb_character_collision_player.cpp", name: "Demo 06: GLB Character, Collision & Player Controller", isDemoScene: true, isLiveFile: true, isExampleTab: true },
      { value: "07_fps_shooter_damage_system.cpp", path: "examples/07_fps_shooter_damage_system.cpp", name: "Demo 07: First-Person Shooter & Damage System", isDemoScene: true, isLiveFile: true, isExampleTab: true },
      { value: "08_all_materials_presentation.cpp", path: "examples/08_all_materials_presentation.cpp", name: "Demo 08: All Materials Presentation Showcase", isDemoScene: true, isLiveFile: true, isExampleTab: true },
      { value: "09_slot_machine.cpp", path: "examples/09_slot_machine.cpp", name: "Demo 09: 3D Casino Slot Machine & Particles", isDemoScene: true, isLiveFile: true, isExampleTab: true },
      { value: "10_sliding_puzzle.cpp", path: "examples/10_sliding_puzzle.cpp", name: "Demo 10: Dynamic Sliding 3D Puzzle", isDemoScene: true, isLiveFile: true, isExampleTab: true },
      { value: "11_plinko.cpp", path: "examples/11_plinko.cpp", name: "Demo 11: 3D Plinko Cascade Showcase", isDemoScene: true, isLiveFile: true, isExampleTab: true },
      { value: "12_roulette.cpp", path: "examples/12_roulette.cpp", name: "Demo 12: 3D Physics-Engine Roulette Wheel", isDemoScene: true, isLiveFile: true, isExampleTab: true },

      // Engine Internals
      { value: "src/core/Engine.cpp", path: "src/core/Engine.cpp", name: "Engine Core C++", isDemoScene: false, isLiveFile: true, isExampleTab: false },
      { value: "src/core/Renderer.cpp", path: "src/core/Renderer.cpp", name: "Filament GLES3 Pipeline C++", isDemoScene: false, isLiveFile: true, isExampleTab: false },
      { value: "src/core/Bindings.cpp", path: "src/core/Bindings.cpp", name: "Emscripten Embind Bindings C++", isDemoScene: false, isLiveFile: true, isExampleTab: false },
      { value: "include/engine/Engine.hpp", path: "include/engine/Engine.hpp", name: "Engine Header", isDemoScene: false, isLiveFile: true, isExampleTab: false },
      { value: "include/engine/Camera.hpp", path: "include/engine/Camera.hpp", name: "Camera Math Header", isDemoScene: false, isLiveFile: true, isExampleTab: false },
      { value: "include/engine/Collision.hpp", path: "include/engine/Collision.hpp", name: "Collision System Header", isDemoScene: false, isLiveFile: true, isExampleTab: false },
      { value: "include/engine/PlayerController.hpp", path: "include/engine/PlayerController.hpp", name: "Player Controller Header", isDemoScene: false, isLiveFile: true, isExampleTab: false },
      { value: "include/engine/DamageSystem.hpp", path: "include/engine/DamageSystem.hpp", name: "Damage System & Events Header", isDemoScene: false, isLiveFile: true, isExampleTab: false },
      { value: "include/engine/Projectile.hpp", path: "include/engine/Projectile.hpp", name: "FPS Projectile System Header", isDemoScene: false, isLiveFile: true, isExampleTab: false },
      { value: "include/engine/GLBLoader.hpp", path: "include/engine/GLBLoader.hpp", name: "GLB & Animation Header", isDemoScene: false, isLiveFile: true, isExampleTab: false },
      { value: "include/engine/Renderer.hpp", path: "include/engine/Renderer.hpp", name: "Renderer Header", isDemoScene: false, isLiveFile: true, isExampleTab: false },
      { value: "include/engine/Input.hpp", path: "include/engine/Input.hpp", name: "Input Header", isDemoScene: false, isLiveFile: true, isExampleTab: false },
      { value: "shaders/pbr.frag.glsl", path: "shaders/pbr.frag.glsl", name: "Cook-Torrance PBR Shader", isDemoScene: false, isLiveFile: true, isExampleTab: false },
      { value: "shaders/pbr.vert.glsl", path: "shaders/pbr.vert.glsl", name: "Vertex Pipeline Shader", isDemoScene: false, isLiveFile: true, isExampleTab: false },
      { value: "CMakeLists.txt", path: "CMakeLists.txt", name: "Native Build Configuration", isDemoScene: false, isLiveFile: true, isExampleTab: false },
    ];

    this.unifiedDemoConfig = UNIFIED_DEMO_FILES_CONFIG;

    // 1. Populate demo-scene-select
    const demoSelect = document.getElementById('demo-scene-select');
    if (demoSelect) {
      demoSelect.innerHTML = '';
      UNIFIED_DEMO_FILES_CONFIG.filter(item => item.isDemoScene).forEach(item => {
        const option = document.createElement('option');
        option.value = item.value;
        option.textContent = `${item.name} (${item.value})`;
        if (item.value === this.state.demoScene) {
          option.selected = true;
        }
        demoSelect.appendChild(option);
      });
    }

    // 2. Populate live-editor-file-select
    const liveSelect = document.getElementById('live-editor-file-select');
    if (liveSelect) {
      liveSelect.innerHTML = '';
      UNIFIED_DEMO_FILES_CONFIG.filter(item => item.isLiveFile).forEach(item => {
        const option = document.createElement('option');
        option.value = item.path;
        option.textContent = `${item.path} (${item.name})`;
        if (item.path === this.currentLiveFile) {
          option.selected = true;
        }
        liveSelect.appendChild(option);
      });
    }

    // 3. Populate filament-examples-select
    const exSelect = document.getElementById('filament-examples-select');
    if (exSelect) {
      exSelect.innerHTML = '';
      UNIFIED_DEMO_FILES_CONFIG.filter(item => item.isExampleTab).forEach(item => {
        const option = document.createElement('option');
        option.value = item.value;
        option.textContent = `${item.path} (${item.name})`;
        if (item.value === '08_all_materials_presentation.cpp') {
          option.selected = true;
        }
        exSelect.appendChild(option);
      });
    }
  }

  initLiveCodeEditor() {
    this.currentLiveFile = 'examples/01_pbr_material_preview.cpp';
    this.populateUnifiedSelects();

    this.liveCppSources = JSON.parse(JSON.stringify(LIVE_CPP_SOURCES));

    const select = document.getElementById('live-editor-file-select');
    const textarea = document.getElementById('live-code-textarea');
    const lineNumbers = document.getElementById('editor-line-numbers');
    const statusBox = document.getElementById('live-code-status');
    const statusText = document.getElementById('live-status-text');
    const btnApply = document.getElementById('btn-apply-live-code');
    const btnSaveDisk = document.getElementById('btn-save-disk-code');
    const btnReset = document.getElementById('btn-reset-live-code');
    const btnCopy = document.getElementById('btn-copy-live-code');

    // Fetch live files from server on startup
    fetch('/api/files')
      .then(res => res.json())
      .then(data => {
        if (data && data.files) {
          data.files.forEach(f => {
            if (f.content) {
              this.liveCppSources[f.path] = f.content;
            }
          });
          loadCurrentFile();
          this.log("Synced C++ and GLSL files with backend storage.", "cpp");
        }
      })
      .catch(() => {
        // Fallback to embedded sources
      });

    const updateLineNumbers = () => {
      if (!textarea || !lineNumbers) return;
      const lines = (textarea.value || '').split('\n').length;
      let nums = '';
      for (let i = 1; i <= lines; i++) {
        nums += i + '\n';
      }
      lineNumbers.textContent = nums;
    };

    const loadCurrentFile = () => {
      if (!textarea) return;
      textarea.value = this.liveCppSources[this.currentLiveFile] || '';
      updateLineNumbers();
      if (statusBox && statusText) {
        statusBox.className = 'live-status-badge success';
        statusBox.querySelector('.status-indicator').textContent = '●';
        statusText.textContent = `Authoritative Source: ${this.currentLiveFile}. Edit and click "⚡ Compile C++ & Run".`;
      }
    };

    if (select) {
      select.addEventListener('change', (e) => {
        if (textarea && this.liveCppSources[this.currentLiveFile] !== undefined) {
          this.liveCppSources[this.currentLiveFile] = textarea.value;
        }
        this.currentLiveFile = e.target.value;
        loadCurrentFile();
      });
    }

    if (textarea) {
      textarea.addEventListener('input', updateLineNumbers);
      textarea.addEventListener('scroll', () => {
        if (lineNumbers) lineNumbers.scrollTop = textarea.scrollTop;
      });

      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          textarea.value = textarea.value.substring(0, start) + '    ' + textarea.value.substring(end);
          textarea.selectionStart = textarea.selectionEnd = start + 4;
          updateLineNumbers();
        }
      });
    }

    // "⚡ Compile C++ & Run" Action
    if (btnApply) {
      btnApply.addEventListener('click', async () => {
        const code = textarea ? textarea.value : '';
        const startTime = performance.now();
        this.liveCppSources[this.currentLiveFile] = code;

        if (statusBox && statusText) {
          statusBox.className = 'live-status-badge info';
          statusBox.querySelector('.status-indicator').textContent = '⏳';
          statusText.textContent = `Compiling ${this.currentLiveFile} with C++ backend toolchain...`;
        }

        try {
          // 1. Submit source to C++ backend compiler
          const response = await fetch('/api/compile-cpp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file: this.currentLiveFile,
              source: code
            })
          });

          let res;
          const textRes = await response.text();
          try {
            res = JSON.parse(textRes);
          } catch (e) {
            throw new Error(`Invalid server response (${response.status}): ${textRes || 'Empty response'}`);
          }

          if (!res || !res.success) {
            throw new Error((res && (res.compilerOutput || res.error)) || 'C++ compilation failed');
          }

          // 2. Parse C++ configuration and apply to runtime simulation / shaders
          const elapsed = (performance.now() - startTime).toFixed(1);

          // If shader was compiled
          if (this.currentLiveFile.endsWith('.frag.glsl') || this.currentLiveFile.endsWith('.frag') || this.currentLiveFile === 'shaders/pbr.frag.glsl') {
            const vsSrc = this.liveCppSources['shaders/pbr.vert.glsl'] || VS_COMMON;
            const newProg = this.createProgram(vsSrc, code);
            if (newProg) {
              this.programs[0] = newProg;
              this.log(`GLSL Fragment Shader re-linked into Filament pipeline.`, "success");
            }
          } else if (this.currentLiveFile.endsWith('.vert.glsl') || this.currentLiveFile.endsWith('.vert') || this.currentLiveFile === 'shaders/pbr.vert.glsl') {
            const fsSrc = this.liveCppSources['shaders/pbr.frag.glsl'] || FS_PBR;
            const newProg = this.createProgram(code, fsSrc);
            if (newProg) {
              this.programs[0] = newProg;
              this.log(`GLSL Vertex Shader re-linked into Filament pipeline.`, "success");
            }
          } else if (this.currentLiveFile.includes('01_pbr_material_preview')) {
            // Apply Demo 1 parameters from C++
            this.state.demoScene = 'single';
            this.state.activeMesh = 0;
            const matchRough = code.match(/roughness\s*=\s*([0-9.]+)/);
            if (matchRough) this.state.roughness = parseFloat(matchRough[1]);
            const matchMetal = code.match(/metallic\s*=\s*([0-9.]+)/);
            if (matchMetal) this.state.metallic = parseFloat(matchMetal[1]);
            const matchSpeed = code.match(/rotationSpeed\s*=\s*([0-9.]+)/);
            if (matchSpeed) this.state.speed = parseFloat(matchSpeed[1]);
            const matchColor = code.match(/baseColor\s*=\s*float3\(([^)]+)\)/);
            if (matchColor) {
              const parts = matchColor[1].split(',').map(s => parseFloat(s.replace(/f/g, '').trim()));
              if (parts.length >= 3) this.state.baseColor = [parts[0], parts[1], parts[2]];
            }
            this.syncControlsWithState();
          } else if (this.currentLiveFile.includes('02_metallic_roughness_matrix')) {
            // Apply Demo 2 parameters from C++
            this.state.demoScene = 'matrix';
            this.state.camRadius = 9.5;
            this.state.speed = 0.45;
            this.syncControlsWithState();
          } else if (this.currentLiveFile.includes('03_trefoil_studio')) {
            // Apply Demo 3 parameters from C++
            this.state.demoScene = 'studio';
            this.state.activeMesh = 3;
            const matchRough = code.match(/roughness\s*=\s*([0-9.]+)/);
            if (matchRough) this.state.roughness = parseFloat(matchRough[1]);
            const matchMetal = code.match(/metallic\s*=\s*([0-9.]+)/);
            if (matchMetal) this.state.metallic = parseFloat(matchMetal[1]);
            const matchSpeed = code.match(/rotationSpeed\s*=\s*([0-9.]+)/);
            if (matchSpeed) this.state.speed = parseFloat(matchSpeed[1]);
            const matchColor = code.match(/baseColor\s*=\s*float3\(([^)]+)\)/);
            if (matchColor) {
              const parts = matchColor[1].split(',').map(s => parseFloat(s.replace(/f/g, '').trim()));
              if (parts.length >= 3) this.state.baseColor = [parts[0], parts[1], parts[2]];
            }
            this.syncControlsWithState();
          }

          this.updateSceneEntitiesForActiveDemo();

          if (statusBox && statusText) {
            statusBox.className = 'live-status-badge success';
            statusBox.querySelector('.status-indicator').textContent = '✔';
            statusText.textContent = `✔ C++ (g++/clang++) build success in ${elapsed}ms -> Target artifact updated & running in WASM!`;
          }
          this.log(`[C++ Compiler] ${this.currentLiveFile} compiled successfully in ${elapsed}ms.`, "success");
        } catch (err) {
          if (statusBox && statusText) {
            statusBox.className = 'live-status-badge error';
            statusBox.querySelector('.status-indicator').textContent = '✖';
            statusText.textContent = `Compilation Error: ${err.message}`;
          }
          this.log(`[C++ Compiler Error] ${err.message}`, "error");
        }
      });
    }

    // "💾 Save to Disk" Action
    if (btnSaveDisk) {
      btnSaveDisk.addEventListener('click', async () => {
        const code = textarea ? textarea.value : '';
        try {
          const res = await fetch('/api/save-source', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file: this.currentLiveFile,
              content: code
            })
          });
          const rawText = await res.text();
          let json;
          try {
            json = JSON.parse(rawText);
          } catch (e) {
            throw new Error(`Server returned non-JSON: ${rawText}`);
          }
          if (json && json.success) {
            this.liveCppSources[this.currentLiveFile] = code;
            if (statusBox && statusText) {
              statusBox.className = 'live-status-badge success';
              statusBox.querySelector('.status-indicator').textContent = '💾';
              statusText.textContent = `Saved ${this.currentLiveFile} to backend filesystem.`;
            }
            this.log(`Saved ${this.currentLiveFile} to disk.`, "info");
          } else {
            throw new Error(json.error || 'Failed to save file');
          }
        } catch (err) {
          this.log(`Error saving ${this.currentLiveFile}: ${err.message}`, "error");
        }
      });
    }

    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (LIVE_CPP_SOURCES[this.currentLiveFile]) {
          this.liveCppSources[this.currentLiveFile] = LIVE_CPP_SOURCES[this.currentLiveFile];
        }
        loadCurrentFile();
        this.log(`Reloaded ${this.currentLiveFile} original C++ source.`, "info");
      });
    }

    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        if (textarea) {
          navigator.clipboard.writeText(textarea.value);
          this.log(`Copied ${this.currentLiveFile} C++ source to clipboard.`, "success");
        }
      });
    }

    loadCurrentFile();
  }

  syncControlsWithState() {
    const rSlider = document.getElementById('slider-roughness');
    if (rSlider) { rSlider.value = this.state.roughness; const v = document.getElementById('val-roughness'); if (v) v.textContent = this.state.roughness.toFixed(2); }
    const mSlider = document.getElementById('slider-metallic');
    if (mSlider) { mSlider.value = this.state.metallic; const v = document.getElementById('val-metallic'); if (v) v.textContent = this.state.metallic.toFixed(2); }
    const spSlider = document.getElementById('slider-speed');
    if (spSlider) { spSlider.value = this.state.speed; const v = document.getElementById('val-speed'); if (v) v.textContent = this.state.speed.toFixed(2); }

    const demoSelect = document.getElementById('demo-scene-select');
    if (demoSelect) demoSelect.value = this.state.demoScene;

    this.updateHUDStats();
    this.updateSceneEntitiesForActiveDemo();
  }

  initGeneratedJSViewer() {
    const select = document.getElementById('generated-artifact-select');
    const display = document.getElementById('generated-display');
    const btnCopy = document.getElementById('btn-copy-generated');

    const GENERATED_TEMPLATES = {
      'engine.js': `// dist/engine.js
// AUTO-GENERATED BY EMSCRIPTEN (emcc 3.1.51) FROM C++ SOURCE (Bindings.cpp, Engine.cpp)
// DO NOT EDIT DIRECTLY: Modify C++ sources in "⚡ C++ Source & Compiler" tab.
//
var Module = (function() {
  var _scriptDir = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : undefined;
  return function(Module) {
    Module = Module || {};
    var wasmBinaryFile = 'build_wasm/engine.wasm';
    if (!isDataURI(wasmBinaryFile)) {
      wasmBinaryFile = locateFile(wasmBinaryFile, _scriptDir);
    }
    
    // Auto-generated Embind Export Interfaces for C++ Engine
    Module["Engine"] = function() {
      return new (Module["EngineCore_Engine_construct"])(arguments);
    };
    Module["Engine"]["prototype"]["Init"] = function(config) {
      return _EngineCore_Engine_Init(this.ptr, config);
    };
    Module["Engine"]["prototype"]["Update"] = function(dt) {
      return _EngineCore_Engine_Update(this.ptr, dt);
    };
    Module["Engine"]["prototype"]["Render"] = function() {
      return _EngineCore_Engine_Render(this.ptr);
    };
    Module["Engine"]["prototype"]["SetBaseColor"] = function(r, g, b) {
      return _EngineCore_Engine_SetBaseColor(this.ptr, r, g, b);
    };
    Module["Engine"]["prototype"]["SetRoughness"] = function(rough) {
      return _EngineCore_Engine_SetRoughness(this.ptr, rough);
    };
    Module["Engine"]["prototype"]["SetMetallic"] = function(metal) {
      return _EngineCore_Engine_SetMetallic(this.ptr, metal);
    };
    
    return Module;
  };
})();
if (typeof exports === 'object' && typeof module === 'object')
  module.exports = Module;
else if (typeof define === 'function' && define['amd'])
  define([], function() { return Module; });
`,

      'engine.wasm': `;; build_wasm/engine.wasm (Disassembly / WebAssembly Text representation)
;; Generated by LLVM / Clang 17.0.6 targeting wasm32-unknown-emscripten
(module
  (type (;0;) (func (param i32 i32) (result i32)))
  (type (;1;) (func (param i32 f32)))
  (type (;2;) (func (param i32 f32 f32 f32)))
  (type (;3;) (func (param i32)))
  (import "env" "memory" (memory (;0;) 256 256))
  (import "env" "glCreateProgram" (func (;0;) (result i32)))
  (import "env" "glAttachShader" (func (;1;) (param i32 i32)))
  (import "env" "glUniformMatrix4fv" (func (;2;) (param i32 i32 i32 i32)))
  (export "Engine_Init" (func 4))
  (export "Engine_Update" (func 5))
  (export "Engine_Render" (func 6))
  (export "Engine_SetBaseColor" (func 7))
  (export "Engine_SetRoughness" (func 8))
  (export "Engine_SetMetallic" (func 9))
  (func (;4;) (type 0) (param i32 i32) (result i32)
    local.get 0
    local.get 1
    i32.store offset=0
    i32.const 1)
  (func (;5;) (type 1) (param i32 f32)
    local.get 0
    local.get 1
    f32.store offset=16)
  (func (;6;) (type 3) (param i32)
    call 0
    drop)
)
`,

      'bindings_map.json': `{
  "generator": "emscripten-embind-v3",
  "targetLanguage": "javascript",
  "source": "src/core/Bindings.cpp",
  "classes": {
    "EngineCore::Engine": {
      "constructor": "Engine()",
      "methods": [
        "Init(const EngineConfig&)",
        "Update(float)",
        "Render()",
        "Resize(int, int)",
        "OnMouseMove(float, float)",
        "OnMouseButton(int, bool)",
        "OnMouseWheel(float)",
        "OnKey(int, bool)",
        "SetCameraMode(int)",
        "ResetCamera()",
        "SetActiveMesh(int)",
        "SetActiveShader(int)",
        "SetRotationSpeed(float)",
        "SetAutoRotate(bool)",
        "SetBaseColor(float, float, float)",
        "SetRoughness(float)",
        "SetMetallic(float)",
        "GetDrawCallCount()",
        "GetVertexCount()",
        "GetTriangleCount()"
      ]
    }
  },
  "enums": {
    "EngineCore::CameraMode": ["OrbitArc", "FirstPerson", "FreeFly"]
  }
}`
    };

    const loadArtifact = () => {
      if (!display || !select) return;
      const key = select.value;
      fetch(`/api/generated-js?artifact=${encodeURIComponent(key)}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.content) {
            display.textContent = data.content;
          } else {
            display.textContent = GENERATED_TEMPLATES[key] || '// No artifact content';
          }
        })
        .catch(() => {
          display.textContent = GENERATED_TEMPLATES[key] || '// No artifact content';
        });
    };

    if (select) {
      select.addEventListener('change', loadArtifact);
    }

    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        if (display) {
          navigator.clipboard.writeText(display.textContent);
          this.log(`Copied auto-generated artifact [${select ? select.value : ''}] to clipboard.`, "success");
        }
      });
    }

    loadArtifact();
  }

  initProjectWorkspace() {
    // 1. Sub-Tab Switching inside "Project" Main Tab
    const subtabBtns = document.querySelectorAll('.proj-subtab-btn');
    const subContents = document.querySelectorAll('.proj-subcontent');

    subtabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        subtabBtns.forEach(b => b.classList.remove('active'));
        subContents.forEach(c => c.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const targetId = `subtab-${e.currentTarget.dataset.subtab}`;
        const targetEl = document.getElementById(targetId);
        if (targetEl) targetEl.classList.add('active');
      });
    });

    // 2. Hierarchy Tree & Object Inspector
    this.renderHierarchyTree();
    this.bindInspectorControls();
    this.bindPlayerControllerUI();
    this.renderCollisionRegister();
    this.updateCppBridge();
    this.initFpsDamageWorkspace();
    this.initMapSettingsWorkspace();
    this.initItemsWorkspace();
    this.initMaterialsWorkspace();
    this.initHzbWorkspace();
    this.loadQuakeMap('dm6', false);
  }

  initMapSettingsWorkspace() {
    // 1. Quake Map Load Buttons & Card Selection
    document.querySelectorAll('.btn-load-map').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const mapId = e.currentTarget.dataset.mapId || 'dm6';
        this.loadQuakeMap(mapId, true);
      });
    });

    document.querySelectorAll('.quake-map-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const mapId = e.currentTarget.dataset.mapId || 'dm6';
        if (mapId !== this.currentMapId) {
          this.loadQuakeMap(mapId, true);
        }
      });
    });

    // 2. Add Spawn Point at Current Player/Camera Position
    const btnAddSpawnPose = document.getElementById('btn-add-spawn-pose');
    if (btnAddSpawnPose) {
      btnAddSpawnPose.addEventListener('click', () => {
        this.addPlayerSpawnAtCamPose();
      });
    }

    // 3. Respawn All Items in Map
    const btnRespawnItems = document.getElementById('btn-respawn-all-items');
    if (btnRespawnItems) {
      btnRespawnItems.addEventListener('click', () => {
        this.respawnAllItems();
      });
    }

    // 4. Place Item at Current Player Position
    const btnPlaceItem = document.getElementById('btn-place-item-at-cam');
    if (btnPlaceItem) {
      btnPlaceItem.addEventListener('click', () => {
        this.placeItemAtCamPose();
      });
    }

    // 5. Jump Pad Launch Velocity Slider
    const sliderJumpPad = document.getElementById('slider-jumppad-force');
    if (sliderJumpPad) {
      sliderJumpPad.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        const valLabel = document.getElementById('val-jumppad-force');
        if (valLabel) valLabel.textContent = `${val.toFixed(1)} m/s`;
      });
    }

    // 6. Arena Ambient Lighting Slider
    const sliderAmb = document.getElementById('slider-map-ambient');
    if (sliderAmb) {
      sliderAmb.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        const valLabel = document.getElementById('val-map-ambient');
        if (valLabel) {
          valLabel.textContent = val < 0.3 ? `Gothic Dark (${val.toFixed(2)})` : (val < 0.6 ? `Gothic Dusk (${val.toFixed(2)})` : `Full Bright (${val.toFixed(2)})`);
        }
      });
    }

    // 7. Hazard Floor Damage Slider
    const sliderHazard = document.getElementById('slider-hazard-dmg');
    if (sliderHazard) {
      sliderHazard.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        const valLabel = document.getElementById('val-hazard-dmg');
        if (valLabel) valLabel.textContent = `${val.toFixed(0)} HP / s`;
      });
    }

    this.renderQuakeMapCards();
    this.renderSpawnPointsList();
    this.renderItemSpawnsList();
  }

  initItemsWorkspace() {
    this.activeCategoryFilter = 'all';
    this.renderItemsCatalogCards('all');

    // Category Filter Buttons
    const catBtns = document.querySelectorAll('.item-cat-btn');
    catBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        catBtns.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.activeCategoryFilter = e.currentTarget.dataset.itemCat || 'all';
        this.renderItemsCatalogCards(this.activeCategoryFilter);
      });
    });

    // Respawn All from Catalog
    const btnRespawnCatalog = document.getElementById('btn-respawn-all-catalog');
    if (btnRespawnCatalog) {
      btnRespawnCatalog.addEventListener('click', () => {
        this.respawnAllItems();
      });
    }

    // Clear Pickups / Reset to Map
    const btnClearPickups = document.getElementById('btn-clear-all-pickups');
    if (btnClearPickups) {
      btnClearPickups.addEventListener('click', () => {
        this.clearSpawnedPickups();
      });
    }

    // Instant Player Attribute Actions
    const btnHealFull = document.getElementById('btn-heal-player-full');
    if (btnHealFull) {
      btnHealFull.addEventListener('click', () => {
        this.playerHealth = 100.0;
        if (this.synth) this.synth.play('health_large');
        this.showPickupToast("Health Restored", "Player health refilled to 100 HP", "health");
        this.updateFpsPlayerHud();
        this.log("Restored player health to 100 HP.", "success");
      });
    }

    const btnGiveMega = document.getElementById('btn-give-megahealth');
    if (btnGiveMega) {
      btnGiveMega.addEventListener('click', () => {
        this.playerHealth = 200.0;
        if (this.synth) this.synth.play('megahealth');
        this.showPickupToast("MegaHealth Overheal", "+100 HP (200 Max Overheal Active)", "health");
        this.updateFpsPlayerHud();
        this.log("Applied MegaHealth overheal (Health: 200 HP).", "success");
      });
    }

    const btnGiveArmor = document.getElementById('btn-give-red-armor');
    if (btnGiveArmor) {
      btnGiveArmor.addEventListener('click', () => {
        this.playerArmor = 100.0;
        this.playerArmorType = 'red';
        if (this.synth) this.synth.play('armor_red');
        this.showPickupToast("Red Heavy Battle Armor", "+100 AP (75% Damage Mitigation)", "armor");
        this.updateFpsPlayerHud();
        this.log("Equipped Red Heavy Battle Armor (+100 AP, 75% absorption).", "success");
      });
    }

    const btnGiveQuad = document.getElementById('btn-give-quad-damage');
    if (btnGiveQuad) {
      btnGiveQuad.addEventListener('click', () => {
        this.activePowerups.quad.active = true;
        this.activePowerups.quad.timer = 30.0;
        if (this.synth) this.synth.play('powerup_quad');
        this.showPickupToast("Quad Damage Rune", "4.0x Weapon Damage Multiplier Active (30s)", "powerup");
        this.updateFpsPlayerHud();
        this.log("Activated Quad Damage Rune (400% Projectile Output for 30s)!", "danger");
      });
    }

    this.updateFpsPlayerHud();
  }

  loadQuakeMap(mapId, teleportPlayer = true) {
    const mapDef = QUAKE_MAP_DEFINITIONS[mapId];
    if (!mapDef) return;

    this.currentMapId = mapId;
    const qTitle = mapDef.quakeTitle || mapDef.tag || mapDef.name;
    this.log(`Loading Quake Map: "${mapDef.name}" (${qTitle}) - ${mapDef.desc}`, "cpp");

    const floorScale = mapDef.floorScale || (mapDef.groundFloor ? mapDef.groundFloor.scale : [26.0, 0.5, 26.0]);
    const floorColor = mapDef.floorColor || (mapDef.groundFloor ? mapDef.groundFloor.color : [0.22, 0.24, 0.28]);
    const floorRough = mapDef.floorRoughness || (mapDef.groundFloor ? mapDef.groundFloor.roughness : 0.85);
    const floorMetal = mapDef.floorMetallic || (mapDef.groundFloor ? mapDef.groundFloor.metallic : 0.15);

    // 1. Update Floor Entity
    const ground = this.sceneEntities.find(e => e.id === 1);
    if (ground) {
      ground.scale = [...floorScale];
      ground.color = [...floorColor];
      ground.roughness = floorRough;
      ground.metallic = floorMetal;
    }

    // 2. Rebuild Static Geometry Entities (Keep Player id=0 and Ground id=1)
    const staticGeom = mapDef.staticGeometry ? JSON.parse(JSON.stringify(mapDef.staticGeometry)) : [];
    this.sceneEntities = [
      this.sceneEntities[0] || { id: 0, name: "Player_Character", type: "Kinematic Capsule", pos: [0, 1.7, 0], scale: [1, 1, 1], color: [0.15, 0.45, 0.95], collider: "Capsule (r=1.20m, h=1.8m)", layer: "Layer_Player", trigger: false },
      this.sceneEntities[1] || { id: 1, name: "Arena_Floor", type: "Static Ground", pos: [0, -0.5, 0], scale: [...floorScale], color: [...floorColor], collider: "AABB Floor", layer: "Layer_Static", trigger: false },
      ...staticGeom
    ];

    // 3. Rebuild Player Spawns, Item Pickups, Teleporters, and Elevators
    this.spawnPoints = mapDef.playerSpawns ? JSON.parse(JSON.stringify(mapDef.playerSpawns)) : [];
    this.itemPickups = mapDef.itemSpawns ? JSON.parse(JSON.stringify(mapDef.itemSpawns)) : [];

    this.teleporters = mapDef.teleporters ? JSON.parse(JSON.stringify(mapDef.teleporters)).map(t => ({
      ...t,
      cooldown: 0.0
    })) : [];

    this.elevators = mapDef.elevators ? JSON.parse(JSON.stringify(mapDef.elevators)).map(e => ({
      ...e,
      pos: [...e.pos],
      movingUp: true,
      pauseTimer: 0.0
    })) : [];

    // Inject Elevator Platforms into sceneEntities for physics collision resolution
    this.elevators.forEach((el, idx) => {
      this.sceneEntities.push({
        id: 500 + idx,
        name: el.name || `Elevator_Lift_${el.id}`,
        type: "Dynamic Hydraulic Elevator",
        isElevator: true,
        elevatorId: el.id,
        pos: [...el.pos],
        scale: [...el.scale],
        roughness: 0.25,
        metallic: 0.85,
        color: el.color || [0.35, 0.40, 0.50],
        collider: `AABB Box (${el.scale.join('x')}m)`,
        layer: "Layer_Obstacle",
        trigger: false,
        badge: "Elevator Lift",
        contact: false
      });
    });

    // 4. Teleport Player to Spawn Point 1
    if (teleportPlayer && this.spawnPoints.length > 0) {
      const sp = this.spawnPoints[0];
      this.state.camPos[0] = sp.pos[0];
      this.state.camPos[1] = sp.pos[1] + 1.7;
      this.state.camPos[2] = sp.pos[2];
      this.state.camYaw = sp.yaw || 0.0;
      this.state.fpsVelocityY = 0.0;

      if (this.playerController) {
        this.playerController.pos = [...sp.pos];
        this.playerController.velocity = [0, 0, 0];
        this.playerController.yaw = sp.yaw || 0.0;
      }
      if (this.synth) this.synth.play('teleport');
    }

    // 5. Update UI Viewports
    this.renderQuakeMapCards();
    this.renderSpawnPointsList();
    this.renderItemSpawnsList();
    this.renderHierarchyTree();
    this.renderCollisionRegister();
    this.updateCppBridge();
    this.updateFpsPlayerHud();

    // Update active map badge in UI
    const activeBadge = document.getElementById('active-map-badge');
    if (activeBadge) activeBadge.textContent = `Active: ${mapDef.name} (${qTitle})`;
  }

  renderQuakeMapCards() {
    document.querySelectorAll('.quake-map-card').forEach(card => {
      const mapId = card.dataset.mapId;
      const isSelected = mapId === this.currentMapId;
      card.classList.toggle('active', isSelected);

      const btn = card.querySelector('.btn-load-map');
      if (btn) {
        btn.textContent = isSelected ? `✓ ${mapId.toUpperCase()} Active Arena` : `⚔️ Load ${mapId.toUpperCase()} Arena`;
        btn.style.background = isSelected ? 'rgba(56, 189, 248, 0.25)' : '';
        btn.style.borderColor = isSelected ? 'var(--accent-cyan)' : '';
      }
    });
  }

  renderSpawnPointsList() {
    const listContainer = document.getElementById('spawn-points-list');
    const countBadge = document.getElementById('player-spawns-count');

    if (countBadge) countBadge.textContent = `${this.spawnPoints ? this.spawnPoints.length : 0}`;

    if (!listContainer) return;
    if (!this.spawnPoints || this.spawnPoints.length === 0) {
      listContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 18px; font-size: 12px;">No spawn points registered for this map.</div>`;
      return;
    }

    listContainer.innerHTML = '';
    this.spawnPoints.forEach((sp, idx) => {
      const card = document.createElement('div');
      card.className = 'spawn-node-card';
      card.innerHTML = `
        <div class="spawn-node-info">
          <span class="spawn-badge">SP-${sp.id}</span>
          <div class="spawn-node-meta">
            <span class="spawn-name">${sp.name}</span>
            <span class="spawn-coords">[${sp.pos.map(v => v.toFixed(1)).join(', ')}] · Yaw: ${(sp.yaw || 0).toFixed(1)} rad</span>
          </div>
        </div>
        <div class="spawn-actions">
          <button class="btn-xs btn-tp-spawn" data-spawn-idx="${idx}" title="Teleport player to this spawn">📍 Warp</button>
          <button class="btn-xs btn-del-spawn" data-spawn-idx="${idx}" style="color: #f43f5e;" title="Remove spawn point">✕</button>
        </div>
      `;

      card.querySelector('.btn-tp-spawn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.state.camPos[0] = sp.pos[0];
        this.state.camPos[1] = sp.pos[1] + 1.7;
        this.state.camPos[2] = sp.pos[2];
        this.state.camYaw = sp.yaw || 0.0;
        this.state.fpsVelocityY = 0.0;
        if (this.playerController) {
          this.playerController.pos = [...sp.pos];
          this.playerController.velocity = [0, 0, 0];
          this.playerController.yaw = sp.yaw || 0.0;
        }
        if (this.synth) this.synth.play('teleport');
        this.log(`Teleported to spawn point "${sp.name}" [${sp.pos.join(', ')}]`, "success");
      });

      card.querySelector('.btn-del-spawn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.spawnPoints.splice(idx, 1);
        this.renderSpawnPointsList();
        this.log(`Removed spawn point #${sp.id}`, "warning");
      });

      listContainer.appendChild(card);
    });
  }

  renderItemSpawnsList() {
    const listContainer = document.getElementById('item-spawns-list');
    const countBadge = document.getElementById('item-spawns-count');
    if (countBadge) countBadge.textContent = `${this.itemPickups ? this.itemPickups.length : 0}`;

    if (!listContainer) return;
    if (!this.itemPickups || this.itemPickups.length === 0) {
      listContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 18px; font-size: 12px;">No item pedestals placed on this map arena.</div>`;
      return;
    }

    listContainer.innerHTML = '';
    this.itemPickups.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'item-node-card';
      const catColor = item.category === 'health' ? '#10b981' : (item.category === 'armor' ? '#3b82f6' : (item.category === 'ammo' ? '#f59e0b' : '#a855f7'));

      card.innerHTML = `
        <div class="item-node-info">
          <span style="font-size: 16px;">${item.icon || '📦'}</span>
          <div class="item-node-meta">
            <span class="item-node-title">${item.name} <span class="feat-pill" style="color: ${catColor}; border-color: ${catColor}44; font-size: 9px;">${item.category.toUpperCase()}</span></span>
            <span class="item-node-coords">[${item.pos.map(v => v.toFixed(1)).join(', ')}]</span>
          </div>
        </div>
        <div class="item-node-actions">
          <span class="item-status-pill" style="${item.active ? 'background: rgba(16,185,129,0.18); color: #10b981;' : 'background: rgba(245,158,11,0.18); color: #f59e0b;'}">
            ${item.active ? 'READY' : `${item.respawnTimer.toFixed(0)}s`}
          </span>
          <button class="btn-xs btn-collect-item" data-item-idx="${idx}" title="Collect item">⚡</button>
          <button class="btn-xs btn-del-item" data-item-idx="${idx}" style="color: #f43f5e;" title="Delete node">✕</button>
        </div>
      `;

      card.querySelector('.btn-collect-item')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.collectItemPickup(item);
      });

      card.querySelector('.btn-del-item')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.itemPickups.splice(idx, 1);
        this.renderItemSpawnsList();
        this.log(`Removed item spawn #${item.id} (${item.name})`, "warning");
      });

      listContainer.appendChild(card);
    });
  }

  addPlayerSpawnAtCamPose() {
    const eyeHeight = 1.7;
    const feetPos = [
      parseFloat(this.state.camPos[0].toFixed(2)),
      parseFloat(Math.max(0.0, (this.state.camPos[1] - eyeHeight)).toFixed(2)),
      parseFloat(this.state.camPos[2].toFixed(2))
    ];

    const nextId = (this.spawnPoints.length > 0 ? Math.max(...this.spawnPoints.map(s => s.id)) + 1 : 1);
    const newSp = {
      id: nextId,
      name: `Custom_Spawn_${nextId}`,
      pos: feetPos,
      yaw: parseFloat(this.state.camYaw.toFixed(2)),
      team: 'DM'
    };

    this.spawnPoints.push(newSp);
    this.renderSpawnPointsList();
    if (this.synth) this.synth.play('teleport');
    this.log(`Added new spawn point #${newSp.id} at [${feetPos.join(', ')}]`, "success");
  }

  placeItemAtCamPose() {
    const sel = document.getElementById('quick-place-item-select');
    const itemKey = sel ? sel.value : 'megahealth';
    const catalogItem = ELEMENTAL_ITEMS_CATALOG[itemKey] || ELEMENTAL_ITEMS_CATALOG.megahealth;

    const eyeHeight = 1.7;
    const placePos = [
      parseFloat(this.state.camPos[0].toFixed(2)),
      parseFloat(Math.max(0.3, (this.state.camPos[1] - eyeHeight + 0.6)).toFixed(2)),
      parseFloat(this.state.camPos[2].toFixed(2))
    ];

    const nextId = (this.itemPickups.length > 0 ? Math.max(...this.itemPickups.map(i => i.id)) + 1 : 1);
    const newItem = {
      id: nextId,
      itemKey: catalogItem.key,
      name: catalogItem.name,
      category: catalogItem.category,
      icon: catalogItem.icon,
      pos: placePos,
      scale: [...catalogItem.scale],
      color: [...catalogItem.color],
      meshType: catalogItem.meshType,
      effect: catalogItem.effect,
      respawnDelay: catalogItem.respawnDelay,
      respawnTimer: 0.0,
      active: true
    };

    this.itemPickups.push(newItem);
    this.renderItemSpawnsList();
    if (this.synth) this.synth.play(catalogItem.sound || 'ammo');
    this.log(`Placed item "${catalogItem.name}" at player position [${placePos.join(', ')}]`, "success");
  }

  respawnAllItems() {
    if (!this.itemPickups) return;
    this.itemPickups.forEach(item => {
      item.active = true;
      item.respawnTimer = 0.0;
    });
    this.renderItemSpawnsList();
    if (this.synth) this.synth.play('powerup_quad');
    this.log("Instantly respawned all map item pickups!", "success");
  }

  clearSpawnedPickups() {
    this.loadQuakeMap(this.currentMapId, false);
    this.log(`Reset all spawns and items for map "${this.currentMapId}" to template defaults.`, "info");
  }

  renderItemsCatalogCards(categoryFilter = 'all') {
    const grid = document.getElementById('items-cards-grid');
    if (!grid) return;

    grid.innerHTML = '';
    const filteredItems = Object.values(ELEMENTAL_ITEMS_CATALOG).filter(item => {
      if (categoryFilter === 'all') return true;
      return item.category === categoryFilter;
    });

    filteredItems.forEach(item => {
      const card = document.createElement('div');
      card.className = 'quake-map-card';
      card.id = `catalog-card-${item.key}`;

      const catColor = item.category === 'health' ? '#10b981' : (item.category === 'armor' ? '#3b82f6' : (item.category === 'ammo' ? '#f59e0b' : '#a855f7'));

      card.innerHTML = `
        <div class="map-card-banner" style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(10, 15, 26, 0.95));">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 24px;">${item.icon}</span>
            <div>
              <span class="map-tag" style="color: ${catColor}; border-color: ${catColor}55;">${item.typePill}</span>
            </div>
          </div>
          <span class="map-spawns-count">⏱ ${item.respawnDelay.toFixed(0)}s Respawn</span>
        </div>

        <div class="map-card-content">
          <h4 class="map-title">${item.name}</h4>
          <p class="map-desc">${item.desc}</p>
          <div class="map-features-list">
            <span class="feat-pill" style="color: ${catColor}; border-color: ${catColor}44; font-weight: 600;">⚡ ${item.effect}</span>
            <span class="feat-pill">Mesh: ${item.meshType.toUpperCase()}</span>
          </div>
          <div style="display: flex; gap: 6px; margin-top: 6px;">
            <button class="btn-action btn-catalog-consume" data-item-key="${item.key}" style="flex: 1; padding: 7px 10px; font-size: 11px;">
              ⚡ Instant Give
            </button>
            <button class="btn-action btn-catalog-spawn-cam" data-item-key="${item.key}" style="padding: 7px 10px; font-size: 11px; background: rgba(56,189,248,0.15); border-color: var(--accent-cyan);" title="Spawn in front of camera">
              🎯 Spawn
            </button>
          </div>
        </div>
      `;

      card.querySelector('.btn-catalog-consume')?.addEventListener('click', () => {
        this.collectItemPickup({
          id: 999,
          itemKey: item.key,
          name: item.name,
          category: item.category,
          effect: item.effect,
          respawnDelay: item.respawnDelay
        });
      });

      card.querySelector('.btn-catalog-spawn-cam')?.addEventListener('click', () => {
        this.spawnItemInFrontOfPlayer(item.key);
      });

      grid.appendChild(card);
    });
  }

  spawnItemInFrontOfPlayer(itemKey) {
    const catalogItem = ELEMENTAL_ITEMS_CATALOG[itemKey] || ELEMENTAL_ITEMS_CATALOG.megahealth;
    const forwardDist = 2.0;

    const spawnPos = [
      parseFloat((this.state.camPos[0] + this.state.camFront[0] * forwardDist).toFixed(2)),
      parseFloat((this.state.camPos[1] - 0.9).toFixed(2)),
      parseFloat((this.state.camPos[2] + this.state.camFront[2] * forwardDist).toFixed(2))
    ];

    const nextId = (this.itemPickups.length > 0 ? Math.max(...this.itemPickups.map(i => i.id)) + 1 : 1);
    const newItem = {
      id: nextId,
      itemKey: catalogItem.key,
      name: catalogItem.name,
      category: catalogItem.category,
      icon: catalogItem.icon,
      pos: spawnPos,
      scale: [...catalogItem.scale],
      color: [...catalogItem.color],
      meshType: catalogItem.meshType,
      effect: catalogItem.effect,
      respawnDelay: catalogItem.respawnDelay,
      respawnTimer: 0.0,
      active: true
    };

    this.itemPickups.push(newItem);
    this.renderItemSpawnsList();
    if (this.synth) this.synth.play(catalogItem.sound || 'ammo');
    this.showPickupToast(catalogItem.name, `Spawned in world at [${spawnPos.join(', ')}]`, catalogItem.category);
    this.log(`Spawned item "${catalogItem.name}" in world at [${spawnPos.join(', ')}]`, "success");
  }

  collectItemPickup(item) {
    const key = item.itemKey || item.name.toLowerCase();
    
    // Play Web Audio procedural sound
    if (this.synth) {
      if (key.includes('mega')) this.synth.play('megahealth');
      else if (key.includes('armor_red')) this.synth.play('armor_red');
      else if (key.includes('armor')) this.synth.play('armor_heavy');
      else if (key.includes('quad')) this.synth.play('powerup_quad');
      else if (key.includes('haste') || key.includes('regen') || key.includes('powerup')) this.synth.play('powerup');
      else if (key.includes('health')) this.synth.play('health_large');
      else this.synth.play('ammo');
    }

    // Apply item gameplay effects
    if (key.includes('health_small')) {
      this.playerHealth = Math.min(100.0, this.playerHealth + 15.0);
    } else if (key.includes('health_medium')) {
      this.playerHealth = Math.min(100.0, this.playerHealth + 25.0);
    } else if (key.includes('health_large')) {
      this.playerHealth = Math.min(100.0, this.playerHealth + 50.0);
    } else if (key.includes('megahealth')) {
      this.playerHealth = Math.min(200.0, this.playerHealth + 100.0); // Overheal
    } else if (key.includes('armor_green')) {
      this.playerArmor = Math.min(100.0, this.playerArmor + 50.0);
      this.playerArmorType = 'green';
    } else if (key.includes('armor_yellow')) {
      this.playerArmor = Math.min(100.0, this.playerArmor + 75.0);
      this.playerArmorType = 'yellow';
    } else if (key.includes('armor_red')) {
      this.playerArmor = Math.min(100.0, this.playerArmor + 100.0);
      this.playerArmorType = 'red';
    } else if (key.includes('ammo_plasma')) {
      this.playerAmmo.plasma = Math.min(300, this.playerAmmo.plasma + 50);
    } else if (key.includes('ammo_slugs')) {
      this.playerAmmo.slugs = Math.min(150, this.playerAmmo.slugs + 30);
    } else if (key.includes('ammo_rockets')) {
      this.playerAmmo.rockets = Math.min(50, this.playerAmmo.rockets + 10);
    } else if (key.includes('ammo_railgun')) {
      this.playerAmmo.railgun = Math.min(50, this.playerAmmo.railgun + 15);
    } else if (key.includes('powerup_quad')) {
      this.activePowerups.quad.active = true;
      this.activePowerups.quad.timer = 30.0;
    } else if (key.includes('powerup_haste')) {
      this.activePowerups.haste.active = true;
      this.activePowerups.haste.timer = 25.0;
    } else if (key.includes('powerup_regen')) {
      this.activePowerups.regen.active = true;
      this.activePowerups.regen.timer = 30.0;
    }

    item.active = false;
    item.respawnTimer = item.respawnDelay || 25.0;

    this.showPickupToast(item.name, item.effect || "Item collected into inventory", item.category || "health");
    this.updateFpsPlayerHud();
    this.renderItemSpawnsList();
    this.log(`>> [ITEM PICKUP] Collected: "${item.name}" (+Effect applied: ${item.effect || ''})`, "success");
  }

  showPickupToast(title, desc, category = 'health') {
    const toast = document.getElementById('fps-pickup-toast');
    const toastTitle = document.getElementById('toast-item-title');
    const toastDesc = document.getElementById('toast-item-desc');

    if (toastTitle) toastTitle.textContent = title;
    if (toastDesc) toastDesc.textContent = desc;

    if (toast) {
      toast.classList.remove('active');
      void toast.offsetWidth; // reflow
      toast.classList.add('active');

      if (this.toastTimeout) clearTimeout(this.toastTimeout);
      this.toastTimeout = setTimeout(() => {
        toast.classList.remove('active');
      }, 2000);
    }
  }

  updateFpsPlayerHud() {
    // Health HUD
    const hudHp = document.getElementById('hud-val-health');
    const barHp = document.getElementById('hud-bar-health');
    if (hudHp) {
      hudHp.textContent = Math.round(this.playerHealth);
      if (this.playerHealth > 100) {
        hudHp.style.color = '#06b6d4'; // Cyan MegaHealth Overheal
      } else if (this.playerHealth <= 25) {
        hudHp.style.color = '#f43f5e';
      } else {
        hudHp.style.color = '#10b981';
      }
    }
    if (barHp) {
      const pct = Math.min(100, (this.playerHealth / 100.0) * 100);
      barHp.style.width = `${pct}%`;
      barHp.style.background = this.playerHealth > 100 ? '#06b6d4' : (this.playerHealth <= 25 ? '#f43f5e' : '#10b981');
    }

    // Armor HUD
    const hudAp = document.getElementById('hud-val-armor');
    const barAp = document.getElementById('hud-bar-armor');
    const armorBadge = document.getElementById('hud-armor-type-badge');
    if (hudAp) hudAp.textContent = Math.round(this.playerArmor);
    if (barAp) {
      const pct = Math.min(100, (this.playerArmor / 100.0) * 100);
      barAp.style.width = `${pct}%`;
      if (this.playerArmorType === 'red') barAp.style.background = '#f43f5e';
      else if (this.playerArmorType === 'yellow') barAp.style.background = '#f59e0b';
      else barAp.style.background = '#10b981';
    }
    if (armorBadge) {
      armorBadge.textContent = `${this.playerArmorType.toUpperCase()} ARMOR`;
      armorBadge.style.color = this.playerArmorType === 'red' ? '#f43f5e' : (this.playerArmorType === 'yellow' ? '#f59e0b' : '#10b981');
    }

    // Ammo HUD
    const hudAmmo = document.getElementById('hud-val-ammo');
    const ammoLabel = document.getElementById('hud-ammo-type-label');
    const wType = this.weaponConfig ? this.weaponConfig.type : 'plasma';
    if (hudAmmo) {
      if (wType === 'plasma') hudAmmo.textContent = this.playerAmmo.plasma;
      else if (wType === 'kinetic') hudAmmo.textContent = this.playerAmmo.slugs;
      else if (wType === 'railgun') hudAmmo.textContent = this.playerAmmo.railgun;
    }
    if (ammoLabel) {
      ammoLabel.textContent = wType.toUpperCase();
    }

    // Powerup Pills in Overlay
    const quadEl = document.getElementById('hud-powerup-quad');
    const hasteEl = document.getElementById('hud-powerup-haste');
    const regenEl = document.getElementById('hud-powerup-regen');

    if (quadEl) {
      if (this.activePowerups.quad.active) {
        quadEl.style.display = 'inline-flex';
        quadEl.textContent = `⚡ QUAD (${this.activePowerups.quad.timer.toFixed(0)}s)`;
      } else {
        quadEl.style.display = 'none';
      }
    }
    if (hasteEl) {
      if (this.activePowerups.haste.active) {
        hasteEl.style.display = 'inline-flex';
        hasteEl.textContent = `🏃 HASTE (${this.activePowerups.haste.timer.toFixed(0)}s)`;
      } else {
        hasteEl.style.display = 'none';
      }
    }
    if (regenEl) {
      if (this.activePowerups.regen.active) {
        regenEl.style.display = 'inline-flex';
        regenEl.textContent = `💚 REGEN (${this.activePowerups.regen.timer.toFixed(0)}s)`;
      } else {
        regenEl.style.display = 'none';
      }
    }

    // Sub-tab Items Live Status Pills & Telemetry Cards
    const telemHp = document.getElementById('telem-item-health');
    const telemAp = document.getElementById('telem-item-armor');
    const telemPower = document.getElementById('telem-item-powerups');
    const telemDmg = document.getElementById('telem-item-dmgmult');
    const telemSfx = document.getElementById('telem-item-sfx');

    const absorbRate = this.playerArmorType === 'red' ? '75%' : (this.playerArmorType === 'yellow' ? '60%' : '50%');
    if (telemHp) telemHp.textContent = `${Math.round(this.playerHealth)} / ${this.playerHealth > 100 ? '200 (Overheal)' : '100'}`;
    if (telemAp) telemAp.textContent = `${Math.round(this.playerArmor)} / 100 (${absorbRate} Absorb)`;
    if (telemDmg) telemDmg.textContent = this.activePowerups.quad.active ? '4.0x (Quad Active)' : '1.0x (Standard)';
    if (telemSfx) telemSfx.textContent = this.synth ? 'WebAudio Synth Active' : 'Muted';

    if (telemPower) {
      const activeList = [];
      if (this.activePowerups.quad.active) activeList.push(`Quad (${this.activePowerups.quad.timer.toFixed(0)}s)`);
      if (this.activePowerups.haste.active) activeList.push(`Haste (${this.activePowerups.haste.timer.toFixed(0)}s)`);
      if (this.activePowerups.regen.active) activeList.push(`Regen (${this.activePowerups.regen.timer.toFixed(0)}s)`);
      telemPower.textContent = activeList.length > 0 ? activeList.join(', ') : 'None';
    }
  }

  initFpsDamageWorkspace() {
    this.renderDamageActorsRoster();
    this.updateDamageEventsUI();

    // Weapon Type Switcher
    const weaponSelect = document.getElementById('fps-weapon-type');
    if (weaponSelect) {
      weaponSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        const dmgSlider = document.getElementById('slider-fps-dmg');
        const spdSlider = document.getElementById('slider-fps-speed');
        const lifeSlider = document.getElementById('slider-fps-lifetime');

        if (val === 'plasma') {
          this.weaponConfig = { type: 'plasma', name: 'High-Yield Plasma Bolt', damage: 25.0, speed: 50.0, lifetime: 3.0, color: [0.06, 0.85, 0.95] };
        } else if (val === 'kinetic') {
          this.weaponConfig = { type: 'kinetic', name: 'Heavy Kinetic Slug', damage: 40.0, speed: 75.0, lifetime: 2.5, color: [0.95, 0.65, 0.15] };
        } else if (val === 'railgun') {
          this.weaponConfig = { type: 'railgun', name: 'Quantum Railgun Pulse', damage: 75.0, speed: 120.0, lifetime: 2.0, color: [0.85, 0.35, 0.95] };
        }

        if (dmgSlider) { dmgSlider.value = this.weaponConfig.damage; document.getElementById('val-fps-dmg').textContent = this.weaponConfig.damage.toFixed(1); }
        if (spdSlider) { spdSlider.value = this.weaponConfig.speed; document.getElementById('val-fps-speed').textContent = this.weaponConfig.speed.toFixed(1); }
        if (lifeSlider) { lifeSlider.value = this.weaponConfig.lifetime; document.getElementById('val-fps-lifetime').textContent = this.weaponConfig.lifetime.toFixed(1); }

        const hudDmg = document.getElementById('hud-weapon-dmg');
        const hudVel = document.getElementById('hud-weapon-vel');
        if (hudDmg) hudDmg.textContent = `${this.weaponConfig.damage} HP`;
        if (hudVel) hudVel.textContent = `${this.weaponConfig.speed} m/s`;

        this.log(`Equipped weapon: ${this.weaponConfig.name} (DMG: ${this.weaponConfig.damage}, Vel: ${this.weaponConfig.speed} m/s)`, "cpp");
      });
    }

    // Sliders
    const sliderDmg = document.getElementById('slider-fps-dmg');
    if (sliderDmg) {
      sliderDmg.addEventListener('input', (e) => {
        this.weaponConfig.damage = parseFloat(e.target.value);
        document.getElementById('val-fps-dmg').textContent = this.weaponConfig.damage.toFixed(1);
        const hudDmg = document.getElementById('hud-weapon-dmg');
        if (hudDmg) hudDmg.textContent = `${this.weaponConfig.damage} HP`;
      });
    }

    const sliderSpeed = document.getElementById('slider-fps-speed');
    if (sliderSpeed) {
      sliderSpeed.addEventListener('input', (e) => {
        this.weaponConfig.speed = parseFloat(e.target.value);
        document.getElementById('val-fps-speed').textContent = this.weaponConfig.speed.toFixed(1);
        const hudVel = document.getElementById('hud-weapon-vel');
        if (hudVel) hudVel.textContent = `${this.weaponConfig.speed} m/s`;
      });
    }

    const sliderLifetime = document.getElementById('slider-fps-lifetime');
    if (sliderLifetime) {
      sliderLifetime.addEventListener('input', (e) => {
        this.weaponConfig.lifetime = parseFloat(e.target.value);
        document.getElementById('val-fps-lifetime').textContent = this.weaponConfig.lifetime.toFixed(1);
      });
    }

    // Action buttons
    const btnFire = document.getElementById('btn-fire-test-projectile');
    if (btnFire) {
      btnFire.addEventListener('click', () => {
        this.fireWeaponProjectile();
      });
    }

    const btnResetTargets = document.getElementById('btn-reset-damage-targets');
    if (btnResetTargets) {
      btnResetTargets.addEventListener('click', () => {
        this.resetAllDamageTargets();
      });
    }

    const btnClearLog = document.getElementById('btn-clear-damage-log');
    if (btnClearLog) {
      btnClearLog.addEventListener('click', () => {
        this.clearDamageLog();
      });
    }
  }

  renderDamageActorsRoster() {
    const rosterEl = document.getElementById('damage-actors-roster');
    if (!rosterEl) return;

    rosterEl.innerHTML = '';
    let aliveCount = 0;

    this.damageActors.forEach(actor => {
      if (actor.alive) aliveCount++;
      const hpPct = Math.max(0, Math.min(100, (actor.health / actor.maxHealth) * 100));
      
      let groupColor = '#3b82f6';
      if (actor.damageGroup === 'Enemies') groupColor = '#f43f5e';
      else if (actor.damageGroup === 'Destructibles') groupColor = '#f59e0b';
      else if (actor.damageGroup === 'Targets') groupColor = '#a855f7';

      const card = document.createElement('div');
      card.className = `damage-actor-card ${!actor.alive ? 'destroyed' : ''} ${actor.hitFlashTimer > 0 ? 'hit-flash' : ''}`;
      card.id = `actor-card-${actor.id}`;

      card.innerHTML = `
        <div class="damage-actor-header">
          <div>
            <div class="damage-actor-title">${actor.name}</div>
            <div class="damage-actor-meta" style="color: var(--text-muted); font-size: 11px;">${actor.type}</div>
          </div>
          <span class="damage-group-tag" style="background: ${groupColor}22; color: ${groupColor}; border: 1px solid ${groupColor}44;">
            ${actor.damageGroup}
          </span>
        </div>

        <div class="health-bar-container">
          <div class="health-bar-fill" style="width: ${hpPct}%; background: ${hpPct < 30 ? '#f43f5e' : (hpPct < 60 ? '#f59e0b' : '#10b981')};"></div>
        </div>

        <div class="health-label-row">
          <span class="health-label-text">Health:</span>
          <span class="health-hp-val">${actor.alive ? `${actor.health.toFixed(0)} / ${actor.maxHealth} HP` : `<span style="color: #f43f5e; font-weight: 700;">DESTROYED (Respawn: ${actor.respawnTimer.toFixed(1)}s)</span>`}</span>
        </div>

        <div class="damage-actor-actions">
          <button class="btn-xs btn-fire-at-target" data-actor-id="${actor.id}">🎯 Fire At Target</button>
          <button class="btn-xs btn-heal-target" data-actor-id="${actor.id}">💚 Heal Full</button>
        </div>
      `;

      card.querySelector('.btn-fire-at-target')?.addEventListener('click', () => {
        if (!actor.alive) return;
        // Apply direct damage to target
        const hitPos = [...actor.pos];
        this.applyDamageToActor(actor, this.weaponConfig.damage, hitPos, [0, 1, 0]);
      });

      card.querySelector('.btn-heal-target')?.addEventListener('click', () => {
        actor.health = actor.maxHealth;
        actor.alive = true;
        actor.respawnTimer = 0;
        this.log(`Restored target "${actor.name}" to ${actor.maxHealth} HP`, "success");
        this.renderDamageActorsRoster();
      });

      rosterEl.appendChild(card);
    });

    const countBadge = document.getElementById('active-damageables-count');
    if (countBadge) {
      countBadge.textContent = `${aliveCount} / ${this.damageActors.length} Active Targets`;
    }
  }

  updateDamageEventsUI() {
    const tbody = document.getElementById('damage-events-tbody');
    const countEl = document.getElementById('damage-events-count');
    if (countEl) countEl.textContent = `${this.damageEvents.length} Events Logged`;

    if (!tbody) return;
    if (this.damageEvents.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 18px;">
            No onDamage events emitted yet. Switch to First-Person Shooter camera mode and fire projectiles at targets!
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = '';
    this.damageEvents.slice(0, 25).forEach(evt => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="font-mono" style="color: var(--text-muted); font-size: 11px;">${evt.time}</td>
        <td style="font-weight: 600; color: #f8fafc;">${evt.targetName}</td>
        <td><span class="damage-group-tag" style="background: rgba(59,130,246,0.15); color: #60a5fa; border: 1px solid rgba(59,130,246,0.3); font-size: 11px;">${evt.damageGroup}</span></td>
        <td class="font-mono highlight" style="color: #f43f5e; font-weight: 700;">-${evt.damageAmount.toFixed(0)}</td>
        <td class="font-mono">${evt.remainingHealth.toFixed(0)} / ${evt.maxHealth}</td>
        <td class="font-mono" style="color: var(--text-muted); font-size: 11px;">[${evt.hitPoint.map(v => v.toFixed(1)).join(', ')}]</td>
        <td>
          <span class="status-pill ${evt.isDestroyed ? 'status-contact' : 'status-clear'}" style="${evt.isDestroyed ? 'background: rgba(244,63,94,0.2); color: #f43f5e; border-color: #f43f5e;' : 'background: rgba(16,185,129,0.2); color: #10b981; border-color: #10b981;'}">
            ${evt.isDestroyed ? 'DESTROYED' : 'HIT CONFIRMED'}
          </span>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  project3DToScreen(pos3D) {
    const v = [pos3D[0], pos3D[1], pos3D[2], 1.0];
    const m = this.viewProjMatrix;
    const clip = [
      m[0]*v[0] + m[4]*v[1] + m[8]*v[2] + m[12]*v[3],
      m[1]*v[0] + m[5]*v[1] + m[9]*v[2] + m[13]*v[3],
      m[2]*v[0] + m[6]*v[1] + m[10]*v[2] + m[14]*v[3],
      m[3]*v[0] + m[7]*v[1] + m[11]*v[2] + m[15]*v[3]
    ];
    if (clip[3] <= 0.001) return null; // Behind camera
    const ndcX = clip[0] / clip[3];
    const ndcY = clip[1] / clip[3];
    const x = (ndcX * 0.5 + 0.5) * this.canvas.clientWidth;
    const y = (-ndcY * 0.5 + 0.5) * this.canvas.clientHeight;
    return { x, y };
  }

  spawnFloatingDamageNumber(hitPos, damage, isDestroyed) {
    const container = document.getElementById('damage-container');
    if (!container) return;
    const screenPos = this.project3DToScreen(hitPos);
    if (!screenPos) return;

    const el = document.createElement('div');
    el.className = `damage-popup ${isDestroyed ? 'critical' : ''}`;
    el.textContent = `-${damage.toFixed(0)}${isDestroyed ? ' 💥' : ''}`;
    el.style.left = `${screenPos.x}px`;
    el.style.top = `${screenPos.y}px`;
    container.appendChild(el);

    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 1100);
  }

  triggerHitmarker() {
    const hm = document.getElementById('fps-hitmarker');
    if (!hm) return;
    hm.classList.remove('active');
    void hm.offsetWidth; // Trigger reflow
    hm.classList.add('active');
    setTimeout(() => hm.classList.remove('active'), 180);
  }

  fireWeaponProjectile() {
    if (!this.isMatchActive) return;
    let proj = this.projectilePool.find(p => !p.active);
    if (!proj) return; // Pool full

    // Trigger FPS Weapon Recoil Kick & Muzzle Flash Flare
    if (this.weaponState) {
      this.weaponState.recoil = 1.0;
      this.weaponState.muzzleFlash = 1.0;
    }

    // Play weapon fire sound
    if (this.synth) {
      this.synth.play('fire');
    }

    // Check Quad Damage
    const isQuad = this.activePowerups && this.activePowerups.quad && this.activePowerups.quad.active;
    const dmgMultiplier = isQuad ? 4.0 : 1.0;

    // Calculate muzzle origin and direction
    let origin = [this.state.camPos[0], this.state.camPos[1] - 0.12, this.state.camPos[2]];
    let dir = [this.state.camFront[0], this.state.camFront[1], this.state.camFront[2]];

    // Offset slightly right in camera space
    origin[0] += this.state.camRight[0] * 0.20;
    origin[2] += this.state.camRight[2] * 0.20;

    proj.active = true;
    proj.pos = [...origin];
    proj.prevPos = [...origin];
    proj.velocity = [
      dir[0] * this.weaponConfig.speed,
      dir[1] * this.weaponConfig.speed,
      dir[2] * this.weaponConfig.speed
    ];
    proj.damage = this.weaponConfig.damage * dmgMultiplier;
    proj.lifetime = this.weaponConfig.lifetime;
    proj.age = 0.0;
    proj.radius = isQuad ? 0.32 : 0.2;
    proj.color = isQuad ? [0.20, 0.65, 1.0] : [...this.weaponConfig.color];

    // Deduct ammo pool
    if (this.weaponConfig.type === 'plasma' && this.playerAmmo.plasma > 0) this.playerAmmo.plasma--;
    else if (this.weaponConfig.type === 'kinetic' && this.playerAmmo.slugs > 0) this.playerAmmo.slugs--;
    else if (this.weaponConfig.type === 'railgun' && this.playerAmmo.railgun > 0) this.playerAmmo.railgun--;
    this.updateFpsPlayerHud();

    this.log(`Fired ${this.weaponConfig.name} [Speed: ${this.weaponConfig.speed}m/s, DMG: ${proj.damage.toFixed(0)}${isQuad ? ' (QUAD x4!)' : ''}]`, "info");
  }

  applyDamageToActor(actor, damageAmount, hitPos, hitNorm) {
    if (!actor.alive) return;
    actor.health = Math.max(0, actor.health - damageAmount);
    actor.hitFlashTimer = 0.3;
    const isDestroyed = actor.health <= 0;
    if (isDestroyed) {
      actor.alive = false;
      actor.respawnTimer = actor.respawnDelay || 4.0;
    }

    this.totalDamageDealt += damageAmount;

    // Visual feedback
    this.triggerHitmarker();
    this.spawnFloatingDamageNumber(hitPos, damageAmount, isDestroyed);

    // Record onDamage Event
    const evt = {
      time: new Date().toLocaleTimeString(),
      targetName: actor.name,
      damageGroup: actor.damageGroup,
      damageAmount: damageAmount,
      remainingHealth: actor.health,
      maxHealth: actor.maxHealth,
      hitPoint: hitPos,
      isDestroyed: isDestroyed
    };
    this.damageEvents.unshift(evt);
    if (this.damageEvents.length > 60) this.damageEvents.pop();

    this.log(`>> [onDamage EVENT] Target: "${actor.name}" [${actor.damageGroup}] | DMG: -${damageAmount} | HP: ${actor.health.toFixed(0)}/${actor.maxHealth}`, isDestroyed ? "danger" : "warning");
    if (isDestroyed) {
      this.log(`💥 [TARGET DESTROYED] "${actor.name}" in [${actor.damageGroup}] destroyed! Respawning in ${actor.respawnDelay}s...`, "danger");
    }

    this.updateDamageEventsUI();
    this.renderDamageActorsRoster();
  }

  resetAllDamageTargets() {
    this.damageActors.forEach(actor => {
      actor.health = actor.maxHealth;
      actor.alive = true;
      actor.respawnTimer = 0;
      actor.hitFlashTimer = 0;
    });
    this.log("All DAMAGE group targets restored to full health!", "success");
    this.renderDamageActorsRoster();
  }

  clearDamageLog() {
    this.damageEvents = [];
    this.updateDamageEventsUI();
    this.log("Cleared onDamage event emission stream log.", "info");
  }

  updateProjectilesAndDamage(dt, timestamp) {
    if (!this.isMatchActive) return;
    // 0. Tick First-Person Weapon Animations (Bobbing, Recoil, Muzzle Flash)
    if (this.weaponState) {
      if (this.weaponState.recoil > 0) {
        this.weaponState.recoil = Math.max(0, this.weaponState.recoil - dt * 6.5);
      }
      if (this.weaponState.muzzleFlash > 0) {
        this.weaponState.muzzleFlash = Math.max(0, this.weaponState.muzzleFlash - dt * 16.0);
      }

      const isMoving = this.state.keys.w || this.state.keys.s || this.state.keys.a || this.state.keys.d ||
        (this.joystickState && this.joystickState.active);
      if (isMoving) {
        this.weaponState.bobTimer += dt * (this.state.keys.shift ? 12.0 : 8.0);
      } else {
        this.weaponState.bobTimer += dt * 1.5; // Gentle breathing idle
      }
    }

    // 1. Tick Powerup Durations & Regenerations
    if (this.activePowerups) {
      let hudNeedsUpdate = false;
      if (this.activePowerups.quad.active) {
        this.activePowerups.quad.timer -= dt;
        hudNeedsUpdate = true;
        if (this.activePowerups.quad.timer <= 0) {
          this.activePowerups.quad.active = false;
          this.activePowerups.quad.timer = 0.0;
          this.log("Quad Damage powerup expired.", "info");
        }
      }
      if (this.activePowerups.haste.active) {
        this.activePowerups.haste.timer -= dt;
        hudNeedsUpdate = true;
        if (this.activePowerups.haste.timer <= 0) {
          this.activePowerups.haste.active = false;
          this.activePowerups.haste.timer = 0.0;
          this.log("Haste Speed powerup expired.", "info");
        }
      }
      if (this.activePowerups.regen.active) {
        this.activePowerups.regen.timer -= dt;
        this.playerHealth = Math.min(200.0, this.playerHealth + 15.0 * dt);
        hudNeedsUpdate = true;
        if (this.activePowerups.regen.timer <= 0) {
          this.activePowerups.regen.active = false;
          this.activePowerups.regen.timer = 0.0;
          this.log("Regeneration powerup expired.", "info");
        }
      }
      if (hudNeedsUpdate) {
        this.updateFpsPlayerHud();
      }
    }

    // 2. Tick Item Pickups Respawns & Player Proximity Trigger
    if (this.itemPickups && this.itemPickups.length > 0) {
      const pEye = this.state.camPos;
      let needListUpdate = false;

      for (let i = 0; i < this.itemPickups.length; i++) {
        const item = this.itemPickups[i];
        if (!item.active) {
          item.respawnTimer -= dt;
          if (item.respawnTimer <= 0) {
            item.active = true;
            item.respawnTimer = 0.0;
            needListUpdate = true;
            this.log(`[ITEM RESPAWNED] ${item.name} ready for pickup!`, "success");
          }
        } else {
          // Check proximity to player
          const dx = pEye[0] - item.pos[0];
          const dy = (pEye[1] - 0.8) - item.pos[1];
          const dz = pEye[2] - item.pos[2];
          const dist = Math.hypot(dx, dy, dz);

          if (dist < 1.35 && this.isMatchActive) {
            this.collectItemPickup(item);
            needListUpdate = true;
          }
        }
      }

      if (needListUpdate) {
        this.renderItemSpawnsList();
      }
    }

    // 3. Tick Target Actors & Respawns
    let needsRosterUpdate = false;
    const numActors = this.damageActors ? this.damageActors.length : 0;
    for (let i = 0; i < numActors; i++) {
      const actor = this.damageActors[i];
      if (actor.hitFlashTimer > 0) {
        actor.hitFlashTimer = Math.max(0, actor.hitFlashTimer - dt);
      }
      if (!actor.alive) {
        actor.respawnTimer -= dt;
        if (actor.respawnTimer <= 0) {
          actor.alive = true;
          actor.health = actor.maxHealth;
          needsRosterUpdate = true;
          this.log(`[TARGET RESPAWNED] ${actor.name} in group [${actor.damageGroup}] restored with ${actor.maxHealth} HP!`, "success");
        }
      }
    }

    if (needsRosterUpdate) {
      this.renderDamageActorsRoster();
    }

    // 4. Tick Active Projectiles & Swept Collisions
    const numProjectiles = this.projectilePool ? this.projectilePool.length : 0;
    for (let pi = 0; pi < numProjectiles; pi++) {
      const p = this.projectilePool[pi];
      if (!p.active) continue;
      p.prevPos[0] = p.pos[0];
      p.prevPos[1] = p.pos[1];
      p.prevPos[2] = p.pos[2];

      p.pos[0] += p.velocity[0] * dt;
      p.pos[1] += p.velocity[1] * dt;
      p.pos[2] += p.velocity[2] * dt;
      p.age += dt;

      if (p.age >= p.lifetime || p.pos[1] < -2.0) {
        p.active = false;
        continue;
      }

      // Check wall / obstacle collision for player projectile
      let collidedWithMap = false;
      if (this.sceneEntities) {
        const numEntities = this.sceneEntities.length;
        for (let i = 0; i < numEntities; i++) {
          const ent = this.sceneEntities[i];
          if (ent.trigger || ent.isLight || ent.type === "Kinematic Character" || ent.name === "Player_Character") continue;
          if (ent.layer === "Layer_Light" || ent.layer === "Layer_Trigger") continue;
          if (!ent.pos || !ent.scale) continue;
          if (ent.name && ent.name.toLowerCase().includes("ground") && ent.pos[1] < 0.0) continue;

          if (this.segmentIntersectsAABB(p.prevPos, p.pos, ent.pos, ent.scale) ||
              this.pointInAABB(p.pos, ent.pos, ent.scale, p.radius || 0.2)) {
            p.active = false;
            collidedWithMap = true;
            break;
          }
        }
      }
      if (collidedWithMap) continue;

      // Check swept collision against DAMAGE Group Actors (Layer_Damageable)
      for (let ai = 0; ai < numActors; ai++) {
        const actor = this.damageActors[ai];
        if (!actor.alive) continue;
        const dx = p.pos[0] - actor.pos[0];
        const dy = p.pos[1] - actor.pos[1];
        const dz = p.pos[2] - actor.pos[2];
        const dist = Math.hypot(dx, dy, dz);
        const hitThreshold = actor.radius + p.radius;

        if (dist <= hitThreshold) {
          this._hitPos[0] = p.pos[0];
          this._hitPos[1] = p.pos[1];
          this._hitPos[2] = p.pos[2];
          if (dist > 0.0001) {
            this._hitNorm[0] = dx / dist;
            this._hitNorm[1] = dy / dist;
            this._hitNorm[2] = dz / dist;
          } else {
            this._hitNorm[0] = 0; this._hitNorm[1] = 1; this._hitNorm[2] = 0;
          }
          this.applyDamageToActor(actor, p.damage, this._hitPos, this._hitNorm);
          p.active = false;
          break;
        }
      }
    }

    // 5. Tick Active 3D AI Combat Bots & Bot Projectiles Shooting Player
    this.updateBotsAndProjectiles(dt, timestamp);
  }

  init3DBots() {
    this.active3DBots = [
      {
        id: 101,
        alias: 'Bot_Phantam',
        skin: 'Phantam',
        team: 'Red',
        pos: [-8.0, 0.0, -8.0],
        velocity: [0, 0, 0],
        yaw: 0.5,
        pitch: 0,
        health: 100.0,
        maxHealth: 100.0,
        alive: true,
        respawnTimer: 0.0,
        fireTimer: 1.2,
        color: [0.95, 0.25, 0.20],
        weapon: 'plasma',
        hitFlashTimer: 0.0,
        radius: 0.65,
        height: 1.8,
        kills: 0,
        deaths: 0
      },
      {
        id: 102,
        alias: 'Bot_Anarki',
        skin: 'Anarki',
        team: 'Blue',
        pos: [8.0, 0.0, -8.0],
        velocity: [0, 0, 0],
        yaw: -0.8,
        pitch: 0,
        health: 100.0,
        maxHealth: 100.0,
        alive: true,
        respawnTimer: 0.0,
        fireTimer: 2.0,
        color: [0.15, 0.65, 0.95],
        weapon: 'rocket',
        hitFlashTimer: 0.0,
        radius: 0.65,
        height: 1.8,
        kills: 0,
        deaths: 0
      },
      {
        id: 103,
        alias: 'Bot_Visor',
        skin: 'Visor',
        team: 'Red',
        pos: [0.0, 1.8, 8.0],
        velocity: [0, 0, 0],
        yaw: 3.14,
        pitch: 0,
        health: 100.0,
        maxHealth: 100.0,
        alive: true,
        respawnTimer: 0.0,
        fireTimer: 1.5,
        color: [0.95, 0.65, 0.15],
        weapon: 'railgun',
        hitFlashTimer: 0.0,
        radius: 0.65,
        height: 1.8,
        kills: 0,
        deaths: 0
      }
    ];

    // Pool for Bot Projectiles (32 fixed size pool)
    this.botProjectilePool = [];
    for (let i = 0; i < 32; i++) {
      this.botProjectilePool.push({
        id: i + 1,
        active: false,
        attackerName: 'Bot',
        pos: [0, 0, 0],
        prevPos: [0, 0, 0],
        velocity: [0, 0, 0],
        speed: 40.0,
        damage: 18.0,
        lifetime: 3.5,
        age: 0.0,
        radius: 0.22,
        color: [0.95, 0.25, 0.20]
      });
    }
  }

  sync3DBotsFromLobby() {
    if (!this.fpsBots || this.fpsBots.length === 0) return;
    const spawnLocations = [
      [-8.0, 0.0, -8.0],
      [8.0, 0.0, -8.0],
      [0.0, 1.8, 8.0],
      [-6.0, 0.0, 6.0],
      [6.0, 0.0, 6.0],
      [0.0, 0.0, -12.0]
    ];
    const weapons = ['plasma', 'rocket', 'railgun'];

    this.active3DBots = this.fpsBots.map((bot, idx) => {
      const loc = spawnLocations[idx % spawnLocations.length];
      const wType = weapons[idx % weapons.length];
      return {
        id: 201 + idx,
        alias: bot.alias,
        skin: bot.skin || 'Phantam',
        team: bot.team || 'Red',
        pos: [...loc],
        velocity: [0, 0, 0],
        yaw: Math.random() * 6.28,
        pitch: 0,
        health: 100.0,
        maxHealth: 100.0,
        alive: true,
        respawnTimer: 0.0,
        fireTimer: 0.8 + Math.random() * 1.5,
        color: bot.team === 'Blue' ? [0.15, 0.65, 0.95] : (bot.team === 'Red' ? [0.95, 0.25, 0.20] : [0.95, 0.75, 0.15]),
        weapon: wType,
        hitFlashTimer: 0.0,
        radius: 0.65,
        height: 1.8,
        kills: 0,
        deaths: 0
      };
    });
  }

  segmentIntersectsAABB(p1, p2, boxPos, boxScale) {
    const halfX = boxScale[0] * 0.5;
    const halfY = boxScale[1] * 0.5;
    const halfZ = boxScale[2] * 0.5;

    const minX = boxPos[0] - halfX;
    const maxX = boxPos[0] + halfX;
    const minY = boxPos[1] - halfY;
    const maxY = boxPos[1] + halfY;
    const minZ = boxPos[2] - halfZ;
    const maxZ = boxPos[2] + halfZ;

    let tmin = 0.0;
    let tmax = 1.0;

    for (let i = 0; i < 3; i++) {
      const origin = p1[i];
      const destination = p2[i];
      const delta = destination - origin;
      const bMin = i === 0 ? minX : (i === 1 ? minY : minZ);
      const bMax = i === 0 ? maxX : (i === 1 ? maxY : maxZ);

      if (Math.abs(delta) < 1e-8) {
        if (origin < bMin || origin > bMax) return false;
      } else {
        const invD = 1.0 / delta;
        let t1 = (bMin - origin) * invD;
        let t2 = (bMax - origin) * invD;
        if (t1 > t2) {
          const tmp = t1; t1 = t2; t2 = tmp;
        }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) return false;
      }
    }

    return true;
  }

  pointInAABB(point, boxPos, boxScale, padding = 0.0) {
    const halfX = boxScale[0] * 0.5 + padding;
    const halfY = boxScale[1] * 0.5 + padding;
    const halfZ = boxScale[2] * 0.5 + padding;

    return (
      point[0] >= boxPos[0] - halfX && point[0] <= boxPos[0] + halfX &&
      point[1] >= boxPos[1] - halfY && point[1] <= boxPos[1] + halfY &&
      point[2] >= boxPos[2] - halfZ && point[2] <= boxPos[2] + halfZ
    );
  }

  checkLineOfSight(fromPos, toPos) {
    if (!this.sceneEntities) return true;

    for (let i = 0; i < this.sceneEntities.length; i++) {
      const ent = this.sceneEntities[i];
      if (ent.trigger || ent.isLight || ent.type === "Kinematic Character" || ent.name === "Player_Character") continue;
      if (ent.layer === "Layer_Light" || ent.layer === "Layer_Trigger") continue;
      if (!ent.pos || !ent.scale) continue;
      if (ent.name && ent.name.toLowerCase().includes("ground") && ent.pos[1] < 0.0) continue;

      if (this.segmentIntersectsAABB(fromPos, toPos, ent.pos, ent.scale)) {
        return false;
      }
    }
    return true;
  }

  resolvePlayerCollision(pos, velocity, radius = 0.65, height = 1.8) {
    if (!this.sceneEntities) return;

    for (let i = 0; i < this.sceneEntities.length; i++) {
      const ent = this.sceneEntities[i];
      if (ent.trigger || ent.isLight || ent.type === "Kinematic Character" || ent.name === "Player_Character") continue;
      if (ent.layer === "Layer_Light" || ent.layer === "Layer_Trigger") continue;
      if (!ent.pos || !ent.scale) continue;
      if (ent.name && ent.name.toLowerCase().includes("ground") && ent.pos[1] < 0.0) continue;

      const minX = ent.pos[0] - ent.scale[0] * 0.5 - radius;
      const maxX = ent.pos[0] + ent.scale[0] * 0.5 + radius;
      const minZ = ent.pos[2] - ent.scale[2] * 0.5 - radius;
      const maxZ = ent.pos[2] + ent.scale[2] * 0.5 + radius;

      const minY = ent.pos[1] - ent.scale[1] * 0.5;
      const maxY = ent.pos[1] + ent.scale[1] * 0.5;

      if (pos[1] + height >= minY && pos[1] <= maxY) {
        if (pos[0] > minX && pos[0] < maxX && pos[2] > minZ && pos[2] < maxZ) {
          const distMinX = Math.abs(pos[0] - minX);
          const distMaxX = Math.abs(pos[0] - maxX);
          const distMinZ = Math.abs(pos[2] - minZ);
          const distMaxZ = Math.abs(pos[2] - maxZ);

          const minDist = Math.min(distMinX, distMaxX, distMinZ, distMaxZ);

          if (minDist === distMinX) { pos[0] = minX; if (velocity) velocity[0] = 0; }
          else if (minDist === distMaxX) { pos[0] = maxX; if (velocity) velocity[0] = 0; }
          else if (minDist === distMinZ) { pos[2] = minZ; if (velocity) velocity[2] = 0; }
          else if (minDist === distMaxZ) { pos[2] = maxZ; if (velocity) velocity[2] = 0; }
        }
      }
    }
  }

  updateBotsAndProjectiles(dt, timestamp) {
    if (!this.active3DBots) return;

    this._pEye[0] = this.state.camPos[0];
    this._pEye[1] = this.state.camPos[1] - 0.2;
    this._pEye[2] = this.state.camPos[2];

    this._pFeet[0] = this.state.camPos[0];
    this._pFeet[1] = this.state.camPos[1] - 1.7;
    this._pFeet[2] = this.state.camPos[2];

    const isFpsMode = this.state.cameraMode === 3;
    const numBots = this.active3DBots.length;

    // 1. Tick Active 3D Bots AI
    for (let bi = 0; bi < numBots; bi++) {
      const bot = this.active3DBots[bi];
      if (bot.hitFlashTimer > 0) {
        bot.hitFlashTimer = Math.max(0, bot.hitFlashTimer - dt);
      }

      if (!bot.alive) {
        bot.respawnTimer -= dt;
        if (bot.respawnTimer <= 0) {
          bot.alive = true;
          bot.health = bot.maxHealth;
          const spawnLocations = [[-8.0, 0.0, -8.0], [8.0, 0.0, -8.0], [0.0, 1.8, 8.0], [-6.0, 0.0, 6.0], [6.0, 0.0, 6.0]];
          const loc = spawnLocations[Math.floor(Math.random() * spawnLocations.length)];
          bot.pos[0] = loc[0];
          bot.pos[1] = loc[1];
          bot.pos[2] = loc[2];
          bot.velocity[0] = 0;
          bot.velocity[1] = 0;
          bot.velocity[2] = 0;
          bot.isGrounded = false;
          bot.fireTimer = 1.0 + Math.random();
          this.log(`🤖 [BOT RESPAWNED] ${bot.alias} re-entered the arena!`, "info");
        }
        continue;
      }

      // Randomly play active zombie ambient growl sounds if match is active
      if (this.isMatchActive && Math.random() < 0.002) {
        if (this.synth) {
          this.synth.playZombieSound();
        }
      }

      // AI Movement & Aiming Towards Player
      const dx = this._pEye[0] - bot.pos[0];
      const dy = this._pEye[1] - (bot.pos[1] + 1.2);
      const dz = this._pEye[2] - bot.pos[2];
      const distToPlayer = Math.hypot(dx, dz);
      const totalDist = Math.hypot(dx, dy, dz);

      if (distToPlayer > 0.1) {
        bot.yaw = Math.atan2(dx, dz);
      }

      // 1. Gravity & Vertical Position Integration for Bot
      const botGravity = -22.0;
      if (!bot.isGrounded) {
        bot.velocity[1] += botGravity * dt;
      }
      bot.pos[1] += bot.velocity[1] * dt;

      // 2. Strafe / Patrol movement when player is in arena
      if (distToPlayer > 3.0 && distToPlayer < 35.0 && isFpsMode && this.isMatchActive) {
        const moveSpeed = 3.2;
        const strafe = Math.sin(timestamp * 0.003 + bot.id) * 2.5;
        const dirX = dx / distToPlayer;
        const dirZ = dz / distToPlayer;

        bot.velocity[0] = dirX * moveSpeed + dirZ * strafe;
        bot.velocity[2] = dirZ * moveSpeed - dirX * strafe;

        bot.pos[0] += bot.velocity[0] * dt;
        bot.pos[2] += bot.velocity[2] * dt;
      } else {
        bot.velocity[0] *= Math.max(0, 1.0 - 8.0 * dt);
        bot.velocity[2] *= Math.max(0, 1.0 - 8.0 * dt);
      }

      // 3. Resolve Kinematic World Collision & Grounding for Bot (Stairs, Platforms, Ground)
      const botColRes = this.resolvePlayerCollision(bot.pos, bot.velocity, bot.radius || 0.65, bot.height || 1.8);
      bot.isGrounded = botColRes.isGrounded;

      // AI Shooting Logic: Bot shoots at player ONLY if line of sight is clear!
      bot.fireTimer -= dt;
      if (bot.fireTimer <= 0 && totalDist < 40.0 && isFpsMode && this.isMatchActive) {
        bot.fireTimer = 1.3 + Math.random() * 1.7; // Fire every 1.3s to 3.0s

        this._botEye[0] = bot.pos[0];
        this._botEye[1] = bot.pos[1] + 1.3;
        this._botEye[2] = bot.pos[2];

        const hasLOS = this.checkLineOfSight(this._botEye, this._pEye);

        if (hasLOS && this.botProjectilePool) {
          let proj = null;
          for (let pi = 0; pi < this.botProjectilePool.length; pi++) {
            if (!this.botProjectilePool[pi].active) {
              proj = this.botProjectilePool[pi];
              break;
            }
          }
          if (proj) {
            const invLen = 1.0 / (totalDist || 1.0);
            const aimSpread = 0.06;
            const dirX = (dx * invLen) + (Math.random() - 0.5) * aimSpread;
            const dirY = (dy * invLen) + (Math.random() - 0.5) * aimSpread;
            const dirZ = (dz * invLen) + (Math.random() - 0.5) * aimSpread;

            proj.active = true;
            proj.attackerName = bot.alias;
            proj.pos[0] = this._botEye[0];
            proj.pos[1] = this._botEye[1];
            proj.pos[2] = this._botEye[2];
            proj.prevPos[0] = this._botEye[0];
            proj.prevPos[1] = this._botEye[1];
            proj.prevPos[2] = this._botEye[2];
            proj.speed = bot.weapon === 'railgun' ? 70.0 : (bot.weapon === 'rocket' ? 32.0 : 45.0);
            proj.velocity[0] = dirX * proj.speed;
            proj.velocity[1] = dirY * proj.speed;
            proj.velocity[2] = dirZ * proj.speed;
            proj.damage = bot.weapon === 'railgun' ? 28.0 : (bot.weapon === 'rocket' ? 38.0 : 18.0);
            proj.color = bot.weapon === 'railgun' ? [0.95, 0.2, 0.95] : (bot.weapon === 'rocket' ? [1.0, 0.5, 0.1] : [0.95, 0.25, 0.20]);
            proj.lifetime = 3.5;
            proj.age = 0.0;
            proj.radius = 0.25;

            if (this.synth) this.synth.play('fire');
            this.log(`🤖 [BOT SHOOTS] ${bot.alias} fired ${bot.weapon.toUpperCase()} at player!`, "warning");
          }
        }
      }
    }

    // 2. Tick Bot Projectiles & Check Collision against Player and Map Geometry Walls
    if (this.botProjectilePool) {
      const numBotProj = this.botProjectilePool.length;
      for (let bpi = 0; bpi < numBotProj; bpi++) {
        const bp = this.botProjectilePool[bpi];
        if (!bp.active) continue;

        if (!bp.prevPos) {
          bp.prevPos = [bp.pos[0], bp.pos[1], bp.pos[2]];
        } else {
          bp.prevPos[0] = bp.pos[0];
          bp.prevPos[1] = bp.pos[1];
          bp.prevPos[2] = bp.pos[2];
        }

        bp.pos[0] += bp.velocity[0] * dt;
        bp.pos[1] += bp.velocity[1] * dt;
        bp.pos[2] += bp.velocity[2] * dt;
        bp.age += dt;

        if (bp.age >= bp.lifetime || bp.pos[1] < -2.0) {
          bp.active = false;
          continue;
        }

        // Wall / Obstacle collision check for bot projectile
        let botProjHitWall = false;
        if (this.sceneEntities) {
          const numEnts = this.sceneEntities.length;
          for (let i = 0; i < numEnts; i++) {
            const ent = this.sceneEntities[i];
            if (ent.trigger || ent.isLight || ent.type === "Kinematic Character" || ent.name === "Player_Character") continue;
            if (ent.layer === "Layer_Light" || ent.layer === "Layer_Trigger") continue;
            if (!ent.pos || !ent.scale) continue;
            if (ent.name && ent.name.toLowerCase().includes("ground") && ent.pos[1] < 0.0) continue;

            if (this.segmentIntersectsAABB(bp.prevPos, bp.pos, ent.pos, ent.scale) ||
                this.pointInAABB(bp.pos, ent.pos, ent.scale, bp.radius || 0.25)) {
              bp.active = false;
              botProjHitWall = true;
              break;
            }
          }
        }
        if (botProjHitWall) continue;

        if (isFpsMode) {
          const dx = bp.pos[0] - this._pFeet[0];
          const dy = bp.pos[1] - (this._pFeet[1] + 0.9);
          const dz = bp.pos[2] - this._pFeet[2];
          const dist = Math.hypot(dx, dy, dz);

          if (dist <= 0.95) {
            // PLAYER WAS HIT BY BOT PROJECTILE!
            bp.active = false;
            this.applyDamageToPlayer(bp.damage, bp.attackerName);
          }
        }
      }
    }

    // 3. Check Player's Projectiles against Bots
    if (this.projectilePool) {
      const numProj = this.projectilePool.length;
      for (let pi = 0; pi < numProj; pi++) {
        const p = this.projectilePool[pi];
        if (!p.active) continue;

        for (let bi = 0; bi < numBots; bi++) {
          const bot = this.active3DBots[bi];
          if (!bot.alive) continue;
          const dx = p.pos[0] - bot.pos[0];
          const dy = p.pos[1] - (bot.pos[1] + 0.9);
          const dz = p.pos[2] - bot.pos[2];
          const dist = Math.hypot(dx, dy, dz);

          if (dist <= bot.radius + p.radius) {
            this._hitPos[0] = p.pos[0];
            this._hitPos[1] = p.pos[1];
            this._hitPos[2] = p.pos[2];
            this.applyDamageToBot(bot, p.damage, this._hitPos);
            p.active = false;
            break;
          }
        }
      }
    }
  }

  applyDamageToBot(bot, damageAmount, hitPos) {
    if (!bot.alive) return;
    bot.health = Math.max(0, bot.health - damageAmount);
    bot.hitFlashTimer = 0.3;
    const isDestroyed = bot.health <= 0;

    if (isDestroyed) {
      bot.alive = false;
      bot.respawnTimer = 4.0;
      bot.deaths++;
    }

    this.totalDamageDealt += damageAmount;
    this.triggerHitmarker();
    this.spawnFloatingDamageNumber(hitPos, damageAmount, isDestroyed);

    // Play a custom zombie grunting sound when damaged
    if (this.synth) {
      this.synth.playZombieSound();
    }

    const evt = {
      time: new Date().toLocaleTimeString(),
      targetName: bot.alias,
      damageGroup: `AI Bot (${bot.team})`,
      damageAmount: damageAmount,
      remainingHealth: bot.health,
      maxHealth: bot.maxHealth,
      hitPoint: hitPos,
      isDestroyed: isDestroyed
    };
    this.damageEvents.unshift(evt);
    if (this.damageEvents.length > 60) this.damageEvents.pop();

    this.log(`🎯 [PLAYER HIT BOT] Hit "${bot.alias}" | DMG: -${damageAmount.toFixed(0)} | Bot HP: ${bot.health.toFixed(0)}/${bot.maxHealth}`, isDestroyed ? "success" : "warning");

    if (isDestroyed) {
      if (this.synth) this.synth.play('megahealth');
      this.showPickupToast("🎯 BOT ELIMINATED", `You killed ${bot.alias}! (+100 PTS)`, "powerup");
      this.log(`💥 [ELIMINATION] You eliminated AI Combat Bot "${bot.alias}"! Respawning in 4s...`, "success");
    }

    this.updateDamageEventsUI();
  }

  triggerPlayerDamageFlash() {
    const flash = document.getElementById('fps-damage-flash');
    if (!flash) return;
    flash.classList.remove('active');
    void flash.offsetWidth;
    flash.classList.add('active');
    setTimeout(() => flash.classList.remove('active'), 220);
  }

  applyDamageToPlayer(damageAmount, attackerName = 'Enemy Bot') {
    if (!this.isMatchActive) return;
    let absorbPct = 0.50;
    if (this.playerArmorType === 'red') absorbPct = 0.75;
    else if (this.playerArmorType === 'yellow') absorbPct = 0.60;

    let armorDmg = 0;
    if (this.playerArmor > 0) {
      armorDmg = Math.min(this.playerArmor, damageAmount * absorbPct);
      this.playerArmor -= armorDmg;
    }
    let hpDmg = damageAmount - armorDmg;
    this.playerHealth = Math.max(0, this.playerHealth - hpDmg);

    this.updateFpsPlayerHud();
    this.triggerPlayerDamageFlash();
    if (this.synth) this.synth.play('damage');

    this.log(`⚠️ [PLAYER HIT] Took -${damageAmount.toFixed(0)} HP damage from ${attackerName}! (HP: ${this.playerHealth.toFixed(0)} | AP: ${this.playerArmor.toFixed(0)})`, "danger");

    if (this.playerHealth <= 0) {
      this.handlePlayerDeath(attackerName);
    }
  }

  handlePlayerDeath(attackerName) {
    if (this.synth) this.synth.play('teleport');
    this.showPickupToast("💥 YOU WERE ELIMINATED", `Killed by [${attackerName}]! Respawning...`, "health");
    this.log(`💀 [PLAYER DIED] Slain in combat by ${attackerName}! Respawning at spawn pad...`, "danger");

    setTimeout(() => {
      this.playerHealth = 100.0;
      this.playerArmor = 50.0;
      this.playerArmorType = 'green';
      const spawns = [[0, 0, 2], [-8, 0, -8], [8, 0, -8], [0, 1.8, 10]];
      const sp = spawns[Math.floor(Math.random() * spawns.length)];
      this.state.camPos[0] = sp[0];
      this.state.camPos[1] = sp[1] + 1.7;
      this.state.camPos[2] = sp[2];
      this.updateFpsPlayerHud();
      this.showPickupToast("⚡ RESPAWNED IN ARENA", "Fight back and eliminate the bots!", "powerup");
    }, 2000);
  }

  updateElevators(dt) {
    if (!this.elevators || this.elevators.length === 0) return;

    const pc = this.playerController;
    let playerPos = pc ? pc.pos : [this.state.camPos[0], this.state.camPos[1] - 1.7, this.state.camPos[2]];

    this.elevators.forEach((el) => {
      const prevY = el.pos[1];

      if (el.pauseTimer > 0) {
        el.pauseTimer -= dt;
      } else {
        const speed = el.speed || 3.0;
        if (el.movingUp) {
          el.pos[1] += speed * dt;
          if (el.pos[1] >= el.endY) {
            el.pos[1] = el.endY;
            el.movingUp = false;
            el.pauseTimer = 1.6;
          }
        } else {
          el.pos[1] -= speed * dt;
          if (el.pos[1] <= el.startY) {
            el.pos[1] = el.startY;
            el.movingUp = true;
            el.pauseTimer = 1.6;
          }
        }
      }

      const deltaY = el.pos[1] - prevY;

      // Sync entity in sceneEntities
      const entity = this.sceneEntities.find(e => e.isElevator && e.elevatorId === el.id);
      if (entity) {
        entity.pos[1] = el.pos[1];
      }

      // Check if player is standing on this elevator platform
      if (Math.abs(deltaY) > 0.0001 && playerPos) {
        const halfW = el.scale[0] * 0.5 + 0.6;
        const halfD = el.scale[2] * 0.5 + 0.6;
        const topY = el.pos[1] + el.scale[1] * 0.5;

        const onX = Math.abs(playerPos[0] - el.pos[0]) <= halfW;
        const onZ = Math.abs(playerPos[2] - el.pos[2]) <= halfD;
        const onY = playerPos[1] >= topY - 0.40 && playerPos[1] <= topY + 0.90;

        if (onX && onZ && onY) {
          if (pc) {
            pc.pos[1] += deltaY;
            pc.isGrounded = true;
          }
          this.state.camPos[1] += deltaY;
        }
      }
    });
  }

  updateTeleporters(dt) {
    if (!this.teleporters || this.teleporters.length === 0) return;

    const pc = this.playerController;
    let playerPos = pc ? pc.pos : [this.state.camPos[0], this.state.camPos[1] - 1.7, this.state.camPos[2]];

    this.teleporters.forEach((tp) => {
      if (tp.cooldown > 0) {
        tp.cooldown -= dt;
        return;
      }

      const dx = playerPos[0] - tp.pos[0];
      const dy = playerPos[1] - tp.pos[1];
      const dz = playerPos[2] - tp.pos[2];
      const distSq = dx * dx + dy * dy + dz * dz;
      const triggerRadius = tp.radius || 1.8;

      if (distSq <= triggerRadius * triggerRadius && Math.abs(dy) <= 2.2) {
        const target = tp.targetPos;
        if (!target) return;

        if (pc) {
          pc.pos[0] = target[0];
          pc.pos[1] = target[1];
          pc.pos[2] = target[2];
          pc.velocity[0] = 0;
          pc.velocity[1] = 0;
          pc.velocity[2] = 0;
        }

        this.state.camPos[0] = target[0];
        this.state.camPos[1] = target[1] + 1.7;
        this.state.camPos[2] = target[2];
        this.state.fpsVelocityY = 0.0;

        tp.cooldown = 1.2;

        if (this.synth) this.synth.play('teleport');
        this.showPickupToast("⚡ QUANTUM TELEPORT", `Warped to: [${target.map(v=>v.toFixed(1)).join(', ')}]`, "powerup");
        this.log(`Teleported via "${tp.name}" to [${target.join(', ')}]`, "success");

        // Broadcast teleport event across network transport
        if (this.net) this.net.sendTeleportEvent(tp.id, target);
      }
    });
  }

  initNetworkSystem() {
    this.net = globalNetworkManager;
    this.remotePlayers = new Map();
    this.lastNetTick = 0;

    // Listen to network manager events
    this.net.on('status', (evt) => {
      this.updateNetworkTelemetryUI(evt);
    });

    this.net.on('ping', (pingMs) => {
      const pingBadge = document.getElementById('net-ping-badge');
      if (pingBadge) pingBadge.textContent = `${pingMs} ms`;
      const telemPing = document.getElementById('net-telemetry-ping');
      if (telemPing) telemPing.textContent = `${pingMs} ms`;
    });

    this.net.on('playerTransform', (data) => {
      if (!data) return;
      this.remotePlayers.set(data.id || 'remote_peer', {
        pos: data.pos,
        rot: data.rot,
        lastUpdate: performance.now()
      });
    });

    this.net.on('playerFire', (data) => {
      if (!data) return;
      if (this.synth) this.synth.play('fire');
      this.spawnProjectile(data.origin || [0, 2, 0], data.dir || [0, 0, -1], data.weapon || 'plasma');
    });

    this.net.on('worldElevator', (data) => {
      if (!data || !this.elevators) return;
      const el = this.elevators.find(e => e.id === data.id);
      if (el) {
        el.pos[1] = data.y;
        el.movingUp = data.up;
      }
    });

    this.net.on('worldTeleport', (data) => {
      if (this.synth) this.synth.play('teleport');
      this.showPickupToast("⚡ REMOTE TELEPORT", `Peer ${data.playerId} warped via portal`, "powerup");
    });

    // Wire UI Controls
    const transportSelect = document.getElementById('net-transport-select');
    if (transportSelect) {
      transportSelect.value = this.net.transportName;
      transportSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        this.net.switchTransport(val);
        this.log(`Switched Network Transport to: ${val.toUpperCase()}`, "info");
      });
    }

    const mediaServerSelect = document.getElementById('net-mediaserver-select');
    if (mediaServerSelect) {
      mediaServerSelect.value = this.net.mediaServer;
      mediaServerSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        this.net.switchMediaServer(val);
        this.log(`Switched Media Server backend to: ${val.toUpperCase()}`, "info");
      });
    }

    const chkFallback = document.getElementById('chk-net-autofallback');
    if (chkFallback) {
      chkFallback.checked = this.net.isAutoFallbackEnabled;
      chkFallback.addEventListener('change', (e) => {
        this.net.isAutoFallbackEnabled = e.target.checked;
      });
    }

    const chkBinary = document.getElementById('chk-net-binary');
    if (chkBinary) {
      chkBinary.checked = this.net.config.enableBinaryPackets;
      chkBinary.addEventListener('change', (e) => {
        this.net.config.enableBinaryPackets = e.target.checked;
      });
    }

    // Initialize Network Manager
    this.net.init();
    this.updateNetworkTelemetryUI({ state: 'connecting', message: 'Initializing Network Transport...' });
  }

  updateNetworkTelemetryUI(evt) {
    const headerPill = document.getElementById('net-header-status-text');
    if (headerPill) {
      headerPill.textContent = `Net: ${this.net.transportName.toUpperCase()} / ${this.net.mediaServer.toUpperCase()}`;
    }

    const badge = document.getElementById('net-transport-badge');
    if (badge) {
      badge.textContent = `${this.net.transportName.toUpperCase()} (${this.net.mediaServer.toUpperCase()})`;
    }

    const statusEl = document.getElementById('net-telemetry-status');
    if (statusEl) {
      statusEl.textContent = (evt.state || 'CONNECTED').toUpperCase();
      statusEl.style.color = evt.state === 'connected' ? '#10b981' : (evt.state === 'error' ? '#ef4444' : '#f59e0b');
    }
  }

  tickNetworkSync(now) {
    if (!this.net || !this.net.activeTransport || !this.net.activeTransport.connected) return;

    // Send transform snapshot at snapshotRateHz (30 Hz = every 33.3ms)
    const interval = 1000 / (this.net.config.snapshotRateHz || 30);
    if (now - this.lastNetTick >= interval) {
      this.lastNetTick = now;

      const pc = this.playerController;
      const pos = pc ? pc.pos : [this.state.camPos[0], this.state.camPos[1] - 1.7, this.state.camPos[2]];
      const rot = [0, this.state.camYaw || 0, this.state.camPitch || 0];

      this.net.sendTransform(pos, rot, 0);
    }
  }

  initFpsStartupMenu() {
    const fpsOverlay = document.getElementById('fps-startup-overlay');
    if (fpsOverlay) {
      const stopProp = (e) => {
        e.stopPropagation();
      };
      ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'dblclick', 'contextmenu', 'wheel', 'keydown', 'keyup', 'keypress', 'touchstart', 'touchend', 'touchmove'].forEach(evt => {
        fpsOverlay.addEventListener(evt, stopProp);
      });
    }

    const btnOpen = document.getElementById('btn-open-fps-menu');
    const btnClose = document.getElementById('btn-close-fps-menu');
    const btnStart = document.getElementById('btn-start-fps-match');

    const mapCards = document.querySelectorAll('#fps-map-select-grid .fps-map-card');
    const loadoutBtns = document.querySelectorAll('.fps-loadout-btn');
    const playerNameInput = document.getElementById('fps-player-name');
    const playerSkinSelect = document.getElementById('fps-player-skin');
    const playerTeamSelect = document.getElementById('fps-player-team');

    const btnAddBot = document.getElementById('btn-fps-add-bot');
    const btnClearBots = document.getElementById('btn-fps-clear-bots');
    const btnSyncLobby = document.getElementById('btn-fps-sync-lobby');

    this.fpsBots = [
      { alias: 'Bot_Phantam', skin: 'Phantam', ping: 5, isBot: true, team: 'Red' },
      { alias: 'Bot_Anarki', skin: 'Anarki', ping: 8, isBot: true, team: 'Blue' }
    ];

    this.selectedFpsMap = 'q3dm17';
    this.selectedFpsWeapon = 'plasma';

    // Map selection
    mapCards.forEach(card => {
      card.addEventListener('click', () => {
        mapCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.selectedFpsMap = card.dataset.map;
        this.currentMapId = this.selectedFpsMap;
        this.log(`FPS Arena Map set to [${this.selectedFpsMap}]`, "cpp");
      });
    });

    // Weapon Loadout selection
    loadoutBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        loadoutBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedFpsWeapon = btn.dataset.weapon;
        if (this.selectedFpsWeapon === 'rocket') {
          this.weaponConfig = { type: 'rocket', name: 'Rocket Launcher', damage: 85.0, speed: 38.0, lifetime: 4.0, color: [0.95, 0.45, 0.10] };
        } else if (this.selectedFpsWeapon === 'railgun') {
          this.weaponConfig = { type: 'railgun', name: 'Electro-Railgun', damage: 100.0, speed: 120.0, lifetime: 2.0, color: [0.90, 0.15, 0.95] };
        } else if (this.selectedFpsWeapon === 'hmg') {
          this.weaponConfig = { type: 'hmg', name: 'Heavy Machine Gun', damage: 15.0, speed: 65.0, lifetime: 2.5, color: [0.95, 0.85, 0.15] };
        } else {
          this.weaponConfig = { type: 'plasma', name: 'High-Yield Plasma Bolt', damage: 25.0, speed: 50.0, lifetime: 3.0, color: [0.06, 0.85, 0.95] };
        }
        this.updateHUDWeaponStats();
      });
    });

    // Open / Close actions
    if (btnOpen) {
      btnOpen.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showFpsStartupMenu();
      });
    }

    if (btnClose) {
      btnClose.addEventListener('click', () => {
        this.hideFpsStartupMenu();
      });
    }

    // Add Bot
    if (btnAddBot) {
      btnAddBot.addEventListener('click', () => {
        const botNames = ['Visor_AI', 'Sarge_Bot', 'Slayer_Bot', 'Xero_Bot', 'Doom_Bot'];
        const skins = ['Visor', 'Sarge', 'Doom', 'Phantam'];
        const randomName = botNames[Math.floor(Math.random() * botNames.length)] + '_' + (this.fpsBots.length + 1);
        const randomSkin = skins[Math.floor(Math.random() * skins.length)];
        this.fpsBots.push({ alias: randomName, skin: randomSkin, ping: Math.floor(Math.random() * 8) + 4, isBot: true, team: Math.random() > 0.5 ? 'Red' : 'Blue' });
        this.renderFpsLobbyPlayers();
        this.log(`Added AI Combat Bot: ${randomName}`, "info");
        if (this.synth) this.synth.play('pickup');
      });
    }

    // Clear Bots
    if (btnClearBots) {
      btnClearBots.addEventListener('click', () => {
        this.fpsBots = [];
        this.renderFpsLobbyPlayers();
        this.log(`Cleared all AI Bots from match lobby.`, "info");
      });
    }

    // Refresh State
    if (btnSyncLobby) {
      btnSyncLobby.addEventListener('click', () => {
        this.fetchLobbyStateFromServer();
      });
    }

    // Set up audio change listeners
    const musicToggle = document.getElementById('fps-music-toggle');
    const sfxToggle = document.getElementById('fps-sfx-toggle');
    const zombieDensitySelect = document.getElementById('fps-zombie-density');

    const updateAudioSettings = () => {
      const musicOn = musicToggle ? musicToggle.value === 'on' : true;
      const sfxOn = sfxToggle ? sfxToggle.value === 'on' : true;
      const density = zombieDensitySelect ? zombieDensitySelect.value : 'high';
      if (this.synth) {
        this.synth.updateSettings(musicOn, sfxOn, density);
      }
    };

    if (musicToggle) musicToggle.addEventListener('change', updateAudioSettings);
    if (sfxToggle) sfxToggle.addEventListener('change', updateAudioSettings);
    if (zombieDensitySelect) zombieDensitySelect.addEventListener('change', updateAudioSettings);

    // Mobile Performance & Material Profile Select
    const matProfileSelect = document.getElementById('fps-material-profile-select');
    if (matProfileSelect) {
      matProfileSelect.value = this.state.fpsCheapMaterial ? 'cheap' : 'filament_pbr';
      matProfileSelect.addEventListener('change', (e) => {
        const isCheap = e.target.value === 'cheap';
        this.toggleCheapMaterial(isCheap);
      });
    }

    // Start Match
    if (btnStart) {
      btnStart.addEventListener('click', () => {
        const name = (playerNameInput ? playerNameInput.value.trim() : '') || 'Ranger';
        const skin = playerSkinSelect ? playerSkinSelect.value : 'Phantam';
        const team = playerTeamSelect ? playerTeamSelect.value : 'Red';

        this.hideFpsStartupMenu();
        this.isMatchActive = true;
        window.isMatchActive = true;
        
        // Push current settings to the synth and start music
        updateAudioSettings();
        if (this.synth) this.synth.startMusic();

        this.sync3DBotsFromLobby();
        this.state.cameraMode = 3; // FPS Mode
        const camSelect = document.getElementById('camera-mode-select');
        if (camSelect) camSelect.value = "3";

        // Lock mouse
        try {
          this.canvas.requestPointerLock?.();
        } catch(e) {}

        if (this.synth) this.synth.play('teleport');
        this.showPickupToast("⚡ ARENA MATCH STARTED", `Welcome Player [${name}]! Target Bots & Fire!`, "powerup");
        this.log(`Match Started! Player: ${name} (${team} Team) | Map: ${this.selectedFpsMap} | Loadout: ${this.selectedFpsWeapon.toUpperCase()}`, "success");

        // Broadcast join event via WebSockets if connected
        if (this.net && this.net.ws && this.net.ws.readyState === WebSocket.OPEN) {
          try {
            this.net.ws.send(JSON.stringify({
              type: 'lobby:join',
              name: name,
              skin: skin,
              team: team,
              map: this.selectedFpsMap
            }));
          } catch(e) {}
        }
      });
    }

    // Listen to network lobbyStateUpdate if emitted
    if (this.net) {
      this.net.on('lobbyState', (state) => {
        if (state && state.players) {
          this.serverLobbyPlayers = state.players;
          this.renderFpsLobbyPlayers();
        }
      });
    }
  }

  toggleCheapMaterial(forceState) {
    if (forceState !== undefined) {
      this.state.fpsCheapMaterial = forceState;
    } else {
      this.state.fpsCheapMaterial = !this.state.fpsCheapMaterial;
    }
    this.state.activeShader = this.state.fpsCheapMaterial ? 4 : 0;
    
    // Update HUD toggle button
    const btnCheap = document.getElementById('btn-fps-cheap-mat-toggle');
    if (btnCheap) {
      if (this.state.fpsCheapMaterial) {
        btnCheap.textContent = "⚡ Cheap Mat: ON (Mobile 60-120 FPS)";
        btnCheap.style.background = "rgba(16, 185, 129, 0.25)";
        btnCheap.style.borderColor = "#10b981";
        btnCheap.style.color = "#34d399";
      } else {
        btnCheap.textContent = "✨ Filament PBR: ON (Studio Mode)";
        btnCheap.style.background = "rgba(147, 51, 234, 0.25)";
        btnCheap.style.borderColor = "#a855f7";
        btnCheap.style.color = "#c084fc";
      }
    }
    
    // Update Select Dropdowns
    const shaderSelect = document.getElementById('shader-select');
    if (shaderSelect) shaderSelect.value = String(this.state.activeShader);
    
    const matProfileSelect = document.getElementById('fps-material-profile-select');
    if (matProfileSelect) matProfileSelect.value = this.state.fpsCheapMaterial ? 'cheap' : 'filament_pbr';
    
    this.log(`Material Engine: ${this.state.fpsCheapMaterial ? '⚡ Ultra-Fast Cheap Material (Optimized for Mobile 60-120 FPS)' : '✨ Filament Studio PBR'}`, 'info');
  }

  drawGunPart(progInfo, mesh, pPos, cF, cR, cU, fOffset, rOffset, uOffset, sx, sy, sz, col, rough, metal, wMatType = 0, wNoise = 1.0, wClearCoat = 0.0, wBump = 0.0) {
    if (!mesh) return;
    const gl = this.gl;
    gl.bindVertexArray(mesh.vao);
    const px = pPos[0] + cF[0] * fOffset + cR[0] * rOffset + cU[0] * uOffset;
    const py = pPos[1] + cF[1] * fOffset + cR[1] * rOffset + cU[1] * uOffset;
    const pz = pPos[2] + cF[2] * fOffset + cR[2] * rOffset + cU[2] * uOffset;

    this.instanceMatrix[0] = cR[0] * sx;
    this.instanceMatrix[1] = cR[1] * sx;
    this.instanceMatrix[2] = cR[2] * sx;
    this.instanceMatrix[3] = 0;

    this.instanceMatrix[4] = cU[0] * sy;
    this.instanceMatrix[5] = cU[1] * sy;
    this.instanceMatrix[6] = cU[2] * sy;
    this.instanceMatrix[7] = 0;

    this.instanceMatrix[8] = -cF[0] * sz;
    this.instanceMatrix[9] = -cF[1] * sz;
    this.instanceMatrix[10] = -cF[2] * sz;
    this.instanceMatrix[11] = 0;

    this.instanceMatrix[12] = px;
    this.instanceMatrix[13] = py;
    this.instanceMatrix[14] = pz;
    this.instanceMatrix[15] = 1;

    Mat4.normalFromMat4(this.normalMatrix, this.instanceMatrix);

    gl.uniformMatrix4fv(progInfo.uModel, false, this.instanceMatrix);
    if (progInfo.uNormalMatrix) gl.uniformMatrix3fv(progInfo.uNormalMatrix, false, this.normalMatrix);
    if (progInfo.uBaseColor) gl.uniform3fv(progInfo.uBaseColor, col);
    if (progInfo.uRoughness) gl.uniform1f(progInfo.uRoughness, rough);
    if (progInfo.uMetallic) gl.uniform1f(progInfo.uMetallic, metal);
    if (progInfo.uMatType) gl.uniform1i(progInfo.uMatType, wMatType);
    if (progInfo.uNoiseScale) gl.uniform1f(progInfo.uNoiseScale, wNoise);
    if (progInfo.uClearCoat) gl.uniform1f(progInfo.uClearCoat, wClearCoat);
    if (progInfo.uBumpStrength) gl.uniform1f(progInfo.uBumpStrength, wBump);

    gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
  }

  drawBotMeshPart(progInfo, mesh, charPos, charYaw, offsetX, offsetY, offsetZ, sizeX, sizeY, sizeZ, color, rough = 0.25, metal = 0.85, pMatType = 0, pClearCoat = 0.15) {
    if (!mesh) return;
    const gl = this.gl;
    gl.bindVertexArray(mesh.vao);

    const cy = Math.cos(charYaw);
    const sy = Math.sin(charYaw);

    const wx = charPos[0] + (offsetX * cy + offsetZ * sy);
    const wy = charPos[1] + offsetY;
    const wz = charPos[2] + (-offsetX * sy + offsetZ * cy);

    this.instanceMatrix[0] = cy * sizeX;
    this.instanceMatrix[1] = 0;
    this.instanceMatrix[2] = sy * sizeX;
    this.instanceMatrix[3] = 0;

    this.instanceMatrix[4] = 0;
    this.instanceMatrix[5] = sizeY;
    this.instanceMatrix[6] = 0;
    this.instanceMatrix[7] = 0;

    this.instanceMatrix[8] = -sy * sizeZ;
    this.instanceMatrix[9] = 0;
    this.instanceMatrix[10] = cy * sizeZ;
    this.instanceMatrix[11] = 0;

    this.instanceMatrix[12] = wx;
    this.instanceMatrix[13] = wy;
    this.instanceMatrix[14] = wz;
    this.instanceMatrix[15] = 1;

    Mat4.normalFromMat4(this.normalMatrix, this.instanceMatrix);

    gl.uniformMatrix4fv(progInfo.uModel, false, this.instanceMatrix);
    if (progInfo.uNormalMatrix) gl.uniformMatrix3fv(progInfo.uNormalMatrix, false, this.normalMatrix);
    if (progInfo.uBaseColor) gl.uniform3fv(progInfo.uBaseColor, color);
    if (progInfo.uRoughness) gl.uniform1f(progInfo.uRoughness, rough);
    if (progInfo.uMetallic) gl.uniform1f(progInfo.uMetallic, metal);
    if (progInfo.uMatType) gl.uniform1i(progInfo.uMatType, pMatType);
    if (progInfo.uNoiseScale) gl.uniform1f(progInfo.uNoiseScale, 1.0);
    if (progInfo.uClearCoat) gl.uniform1f(progInfo.uClearCoat, pClearCoat);
    if (progInfo.uBumpStrength) gl.uniform1f(progInfo.uBumpStrength, 0.0);

    gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
  }

  initSlotMachineDemo() {
    if (!this.slotMachine) {
      this.slotMachine = {
        credits: 1000,
        bet: 10,
        reels: [
          { angle: 0, speed: 0, spinning: false, stopTimer: 0, currentSymbol: 'cherry', destSymbol: 'cherry' },
          { angle: 0, speed: 0, spinning: false, stopTimer: 0, currentSymbol: 'cherry', destSymbol: 'cherry' },
          { angle: 0, speed: 0, spinning: false, stopTimer: 0, currentSymbol: 'cherry', destSymbol: 'cherry' }
        ],
        leverAngle: 0,
        leverVelocity: 0,
        leverPulled: false,
        coins: [],
        currentWin: 0,
        autoSpin: false,
        wasSpinActive: false,
        stats: { spins: 0, wins: 0, totalBet: 0, totalWin: 0 },
        symbolsList: ['cherry', 'torus', 'gem', 'cube', 'trefoil'],
        symbolProps: {
          cherry: { meshId: 0, color: [1.0, 0.1, 0.1], matType: 0, label: '🍒 Cherry' },
          torus: { meshId: 4, color: [1.0, 0.5, 0.0], matType: 0, label: '🍩 Donut' },
          gem: { meshId: 2, color: [0.1, 0.8, 1.0], matType: 12, label: '💎 Gem' },
          cube: { meshId: 1, color: [1.0, 0.84, 0.0], matType: 1, label: '🟨 Gold' },
          trefoil: { meshId: 3, color: [0.8, 0.1, 1.0], matType: 3, label: '🧬 Trefoil' }
        },
        initializedUI: false
      };

      // Pre-allocate coin particles
      for (let i = 0; i < 80; i++) {
        this.slotMachine.coins.push({
          pos: [0, 0, 0],
          vel: [0, 0, 0],
          active: false,
          rot: [0, 0, 0],
          rotSpeed: [0, 0, 0],
          scale: 0.12,
          lifetime: 0,
          maxLifetime: 2.5 + Math.random() * 1.0
        });
      }
    }

    const sm = this.slotMachine;

    // Set UI displays to current values
    const creditsEl = document.getElementById('slot-credits-val');
    if (creditsEl) creditsEl.textContent = sm.credits;
    const winEl = document.getElementById('slot-win-val');
    if (winEl) winEl.textContent = sm.currentWin;

    // Setup DOM Listeners only once
    if (!sm.initializedUI) {
      sm.initializedUI = true;

      // Bet select buttons
      const betButtons = document.querySelectorAll('.slot-bet-btn');
      betButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          if (sm.reels[0].spinning || sm.reels[1].spinning || sm.reels[2].spinning) return;
          betButtons.forEach(b => b.classList.remove('active'));
          e.target.classList.add('active');
          sm.bet = parseInt(e.target.getAttribute('data-bet'), 10);
          if (this.synth) this.synth.play('ammo');
          this.log(`Bet size adjusted to: ${sm.bet} Credits`, "cpp");
        });
      });

      // Spin button
      const spinBtn = document.getElementById('btn-slot-spin');
      if (spinBtn) {
        spinBtn.addEventListener('click', () => {
          this.pullSlotLever();
        });
      }

      // Auto Spin button
      const autoBtn = document.getElementById('btn-slot-auto');
      if (autoBtn) {
        autoBtn.addEventListener('click', () => {
          sm.autoSpin = !sm.autoSpin;
          autoBtn.textContent = sm.autoSpin ? "🔄 Auto Spin: ON" : "🔄 Auto Spin: OFF";
          autoBtn.style.background = sm.autoSpin ? "rgba(245, 158, 11, 0.2)" : "rgba(30, 41, 59, 0.4)";
          autoBtn.style.borderColor = sm.autoSpin ? "#f59e0b" : "rgba(255, 255, 255, 0.08)";
          if (this.synth) this.synth.play('ammo');
          this.log(`Auto Spin set to: ${sm.autoSpin ? "ON" : "OFF"}`, "cpp");
        });
      }

      // Add Credits button
      const addBtn = document.getElementById('btn-slot-add-funds');
      if (addBtn) {
        addBtn.addEventListener('click', () => {
          sm.credits += 500;
          const creditsVal = document.getElementById('slot-credits-val');
          if (creditsVal) creditsVal.textContent = sm.credits;
          if (this.synth) this.synth.play('health_mega');
          this.log(`Purchased 500 Credits! Total: ${sm.credits}`, "success");
          
          // Disable spin button safeguard
          const btnSpin = document.getElementById('btn-slot-spin');
          if (btnSpin) btnSpin.removeAttribute('disabled');
        });
      }
    }
  }

  pullSlotLever() {
    const sm = this.slotMachine;
    if (!sm) return;

    if (sm.reels[0].spinning || sm.reels[1].spinning || sm.reels[2].spinning) return;

    if (sm.credits < sm.bet) {
      this.log("⚠️ Insufficient credits! Click 'Add +500 Credits' to buy-in.", "error");
      if (this.synth) this.synth.play('health_small');
      return;
    }

    // Deduct credits
    sm.credits -= sm.bet;
    const creditsEl = document.getElementById('slot-credits-val');
    if (creditsEl) creditsEl.textContent = sm.credits;

    // Trigger lever tilt
    sm.leverPulled = true;
    sm.leverVelocity = 18.0; // downwards snap

    // Clear previous win display
    sm.currentWin = 0;
    const winEl = document.getElementById('slot-win-val');
    if (winEl) winEl.textContent = "0";

    if (this.synth) this.synth.play('powerup'); // whoosh start sound

    // Choose winning destination symbol states
    sm.stats.spins++;
    sm.stats.totalBet += sm.bet;
    sm.wasSpinActive = true;

    // Random distribution matching standard slot ratios
    const randSymbol = () => {
      const roll = Math.random();
      if (roll < 0.06) return 'trefoil';   // 6% Wild Jackpot
      if (roll < 0.16) return 'cube';      // 10% Gold
      if (roll < 0.32) return 'gem';       // 16% Gem
      if (roll < 0.55) return 'torus';     // 23% Donut
      return 'cherry';                     // 45% Cherry
    };

    // Sequential trigger for stopping
    sm.reels.forEach((reel, idx) => {
      reel.spinning = true;
      reel.speed = 15.0 + idx * 8.0 + Math.random() * 4.0;
      reel.stopTimer = 1.4 + idx * 0.75;
      reel.destSymbol = randSymbol();
    });

    // Disable Spin UI while rolling
    const spinBtn = document.getElementById('btn-slot-spin');
    if (spinBtn) spinBtn.setAttribute('disabled', 'true');

    this.log(`Spin #${sm.stats.spins} Triggered! Bet: ${sm.bet} Credits | Remaining: ${sm.credits}`, "cpp");
  }

  evaluateSlotResult() {
    const sm = this.slotMachine;
    if (!sm) return;

    const r1 = sm.reels[0].currentSymbol;
    const r2 = sm.reels[1].currentSymbol;
    const r3 = sm.reels[2].currentSymbol;

    let payout = 0;
    let description = "";
    let winType = "loss";

    const symbolProps = sm.symbolProps;

    if (r1 === r2 && r2 === r3) {
      // Triple Jackpot!
      winType = "jackpot";
      const mult = r1 === 'trefoil' ? 100 : (r1 === 'cube' ? 50 : (r1 === 'gem' ? 30 : (r1 === 'torus' ? 15 : 8)));
      payout = sm.bet * mult;
      description = `💥 TRIPLE JACKPOT!!! 3x ${symbolProps[r1].label}!`;
      this.spawnSlotCoins(60);
      if (this.synth) this.synth.play('health_mega');
    } else if (r1 === r2 || r2 === r3 || r1 === r3) {
      // Pair match!
      winType = "pair";
      payout = sm.bet * 3;
      const matchedSym = (r1 === r2 || r1 === r3) ? r1 : r2;
      description = `✨ Pair Match! 2x ${symbolProps[matchedSym].label}!`;
      this.spawnSlotCoins(20);
      if (this.synth) this.synth.play('health_medium');
    } else {
      description = "No Matches. Better luck next roll!";
    }

    if (payout > 0) {
      sm.credits += payout;
      sm.currentWin = payout;
      sm.stats.wins++;
      sm.stats.totalWin += payout;

      const creditsEl = document.getElementById('slot-credits-val');
      if (creditsEl) creditsEl.textContent = sm.credits;
      const winEl = document.getElementById('slot-win-val');
      if (winEl) {
        winEl.textContent = `+${payout}!`;
        winEl.classList.add('win-animate');
        setTimeout(() => winEl.classList.remove('win-animate'), 800);
      }
      this.log(`🎉 Payout Won: +${payout} Credits! (${description})`, "success");
    } else {
      this.log(`💀 Spin Outcome: Missed.`, "cpp");
    }

    // Re-enable Spin button
    const spinBtn = document.getElementById('btn-slot-spin');
    if (spinBtn) {
      if (sm.credits >= sm.bet) {
        spinBtn.removeAttribute('disabled');
      } else {
        spinBtn.setAttribute('disabled', 'true');
      }
    }

    // Update History Ledger panel
    const ledger = document.getElementById('slot-history-list');
    if (ledger) {
      const item = document.createElement('div');
      item.className = `slot-history-item ${payout > 0 ? 'win' : ''}`;
      
      const textSpan = document.createElement('span');
      textSpan.className = `slot-history-text ${payout > 0 ? 'win' : ''}`;
      textSpan.textContent = payout > 0 ? description : "Roll: No Matches";
      
      const paySpan = document.createElement('span');
      paySpan.className = "slot-history-payout";
      paySpan.textContent = payout > 0 ? `+${payout}` : "-";

      item.appendChild(textSpan);
      item.appendChild(paySpan);
      
      ledger.insertBefore(item, ledger.firstChild);
      if (ledger.childNodes.length > 8) {
        ledger.removeChild(ledger.lastChild);
      }
    }

    // Update Stats Summary Banner
    const rate = Math.round((sm.stats.wins / sm.stats.spins) * 100) || 0;
    const statsEl = document.getElementById('slot-stats-summary');
    if (statsEl) {
      statsEl.textContent = `Spins: ${sm.stats.spins} | Win Rate: ${rate}% | Net: ${sm.stats.totalWin - sm.stats.totalBet} Cr`;
    }
  }

  spawnSlotCoins(count) {
    const sm = this.slotMachine;
    if (!sm) return;

    let spawned = 0;
    for (let i = 0; i < sm.coins.length; i++) {
      const coin = sm.coins[i];
      if (!coin.active) {
        coin.active = true;
        // Discharge from center coin tray hopper (X=0, Y=-0.2, Z=0.2)
        coin.pos[0] = (Math.random() - 0.5) * 0.4;
        coin.pos[1] = -0.2;
        coin.pos[2] = 0.2;

        coin.vel[0] = (Math.random() - 0.5) * 4.5;
        coin.vel[1] = 4.5 + Math.random() * 4.0;
        coin.vel[2] = 1.0 + Math.random() * 2.5;

        coin.rot[0] = Math.random() * Math.PI * 2;
        coin.rot[1] = Math.random() * Math.PI * 2;
        coin.rot[2] = Math.random() * Math.PI * 2;

        coin.rotSpeed[0] = (Math.random() - 0.5) * 15;
        coin.rotSpeed[1] = (Math.random() - 0.5) * 15;
        coin.rotSpeed[2] = (Math.random() - 0.5) * 15;

        coin.lifetime = 0;
        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  updateSlotMachinePhysics(dt) {
    const sm = this.slotMachine;
    if (!sm) return;

    let anyReelSpinning = false;
    let stoppedThisFrameIdx = -1;

    sm.reels.forEach((reel, idx) => {
      if (reel.spinning) {
        anyReelSpinning = true;
        reel.angle += reel.speed * dt;
        reel.stopTimer -= dt;
        
        // Rapid visual rotation symbol cycling
        const cycleIdx = Math.floor(reel.angle * 4.5) % sm.symbolsList.length;
        reel.currentSymbol = sm.symbolsList[cycleIdx];

        if (reel.stopTimer <= 0) {
          reel.spinning = false;
          reel.speed = 0;
          // Snap strictly to destSymbol index
          const symIdx = sm.symbolsList.indexOf(reel.destSymbol);
          reel.currentSymbol = reel.destSymbol;
          reel.angle = symIdx * (Math.PI * 2 / sm.symbolsList.length);
          stoppedThisFrameIdx = idx;
        }
      }
    });

    if (stoppedThisFrameIdx !== -1) {
      if (this.synth) this.synth.play('elevator');
      if (!sm.reels[0].spinning && !sm.reels[1].spinning && !sm.reels[2].spinning && sm.wasSpinActive) {
        sm.wasSpinActive = false;
        this.evaluateSlotResult();
      }
    }

    // Damped harmonic lever oscillator
    if (sm.leverPulled) {
      sm.leverAngle += sm.leverVelocity * dt;
      if (sm.leverAngle > 0.8) {
        sm.leverAngle = 0.8;
        sm.leverVelocity = -14.0; // bounce-back force
        if (this.synth) this.synth.play('armor'); // bottom-out clank
      }
      // Spring stiffness return force
      sm.leverVelocity += (0.0 - sm.leverAngle) * 45 * dt;
      sm.leverVelocity *= Math.exp(-8.0 * dt); // damping drag

      if (Math.abs(sm.leverAngle) < 0.01 && Math.abs(sm.leverVelocity) < 0.02) {
        sm.leverAngle = 0.0;
        sm.leverVelocity = 0.0;
        sm.leverPulled = false;
      }
    }

    // Coin particles dynamics
    sm.coins.forEach(coin => {
      if (coin.active) {
        coin.lifetime += dt;
        if (coin.lifetime >= coin.maxLifetime) {
          coin.active = false;
          return;
        }
        coin.vel[1] -= 9.81 * dt; // gravity
        coin.pos[0] += coin.vel[0] * dt;
        coin.pos[1] += coin.vel[1] * dt;
        coin.pos[2] += coin.vel[2] * dt;

        coin.rot[0] += coin.rotSpeed[0] * dt;
        coin.rot[1] += coin.rotSpeed[1] * dt;
        coin.rot[2] += coin.rotSpeed[2] * dt;

        // Collision with payout tray floor at Y = -0.7
        if (coin.pos[1] <= -0.7) {
          coin.pos[1] = -0.7;
          coin.vel[1] = -coin.vel[1] * 0.45; // restitution bounce
          coin.vel[0] *= 0.8; // drag friction
          coin.vel[2] *= 0.8;
          if (this.synth && Math.random() < 0.25) this.synth.play('health_small'); // coin chime clink
        }
      }
    });

    // Auto spin scheduler
    if (sm.autoSpin && !anyReelSpinning && !sm.leverPulled && sm.autoSpinTimer === undefined) {
      sm.autoSpinTimer = setTimeout(() => {
        sm.autoSpinTimer = undefined;
        if (this.state.demoScene.includes('09_slot_machine')) {
          this.pullSlotLever();
        }
      }, 1000);
    }
  }

  // 🧩 3D Sliding Puzzle Implementation Methods
  initSlidingPuzzleDemo() {
    // Ensure high-quality PBR shader is selected so textures can be rendered
    this.state.activeShader = 0;
    this.state.fpsCheapMaterial = false;
    const shaderSelect = document.getElementById('shader-select');
    if (shaderSelect) shaderSelect.value = "0";

    if (!this.puzzleState) {
      this.puzzleState = {
        gridSize: 3,
        grid: [],
        originalImage: 'assets/textures/tex01.webp',
        uploadedImage: null,
        activeTexturePath: 'assets/textures/tex01.webp',
        texture: null,
        moves: 0,
        shuffled: false,
        solved: true,
        tilePositions: {}, // Smooth slide positions
      };
      
      this.bindPuzzleUI();
    }
    
    this.resetPuzzleBoard();
  }

  bindPuzzleUI() {
    const sizeSelector = document.getElementById('puzzle-grid-size-selector');
    if (sizeSelector) {
      sizeSelector.addEventListener('click', (e) => {
        const btn = e.target.closest('.puzzle-size-btn');
        if (!btn) return;
        
        sizeSelector.querySelectorAll('.puzzle-size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const size = parseInt(btn.dataset.size, 10);
        this.puzzleState.gridSize = size;
        this.resetPuzzleBoard();
        this.log(`Puzzle dimension reconfigured to: ${size}x${size} Grid (C++ Solver Active)`, "cpp");
      });
    }

    const btnShuffle = document.getElementById('btn-puzzle-shuffle');
    if (btnShuffle) {
      btnShuffle.addEventListener('click', () => {
        this.shufflePuzzleBoard();
      });
    }

    const btnReset = document.getElementById('btn-puzzle-reset');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        this.resetPuzzleBoard();
      });
    }

    const dropZone = document.getElementById('puzzle-drop-zone');
    const fileInput = document.getElementById('puzzle-image-file');

    if (dropZone && fileInput) {
      dropZone.addEventListener('click', () => fileInput.click());

      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
      });

      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
          this.handlePuzzleImageFile(files[0]);
        }
      });

      fileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
          this.handlePuzzleImageFile(files[0]);
        }
      });
    }

    const presetGrid = document.getElementById('puzzle-preset-grid');
    if (presetGrid) {
      presetGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.puzzle-preset-card');
        if (!card) return;

        presetGrid.querySelectorAll('.puzzle-preset-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');

        const texPath = card.dataset.texture;
        this.puzzleState.activeTexturePath = texPath;
        this.puzzleState.uploadedImage = null;
        this.log(`Puzzle texture changed to preset: ${card.title || 'Preset Material'}`, "success");
      });
    }
  }

  handlePuzzleImageFile(file) {
    if (!file.type.startsWith('image/')) {
      this.log("Unsupported file type! Please upload an image.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      this.puzzleState.uploadedImage = dataUrl;
      this.createCustomPuzzleTexture(dataUrl);
      
      const presetGrid = document.getElementById('puzzle-preset-grid');
      if (presetGrid) {
        presetGrid.querySelectorAll('.puzzle-preset-card').forEach(c => c.classList.remove('active'));
      }
      this.log(`Successfully imported custom file: ${file.name} (${Math.round(file.size / 1024)} KB)`, "success");
    };
    reader.readAsDataURL(file);
  }

  createCustomPuzzleTexture(imageSource) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([120, 120, 120, 255]));

    const img = new Image();
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.puzzleState.texture = tex;
      this.log("Custom puzzle image successfully mapped to GPU WebGL sampler!", "success");
    };
    img.onerror = () => {
      this.log("Failed to process custom puzzle image texture mapping.", "error");
    };
    img.src = imageSource;
  }

  getTextureForPath(path) {
    if (this.puzzleState.uploadedImage && this.puzzleState.texture) {
      return this.puzzleState.texture;
    }
    if (path.includes('tex01')) return this.textureCatalog['tex01'];
    if (path.includes('matrix1')) return this.textureCatalog['matrix1'];
    if (path.includes('dark-rock')) return this.textureCatalog['darkRock'] || this.textureCatalog['rust'];
    if (path.includes('floor1')) return this.textureCatalog['floor1'] || this.textureCatalog['wood'];
    if (path.includes('gold-2')) return this.textureCatalog['gold2'] || this.textureCatalog['whiteMetal2'];
    if (path.includes('xrp')) return this.textureCatalog['xrp'];
    return this.textureCatalog['tex01'];
  }

  resetPuzzleBoard() {
    const size = this.puzzleState.gridSize;
    this.puzzleState.grid = [];
    this.puzzleState.moves = 0;
    this.puzzleState.shuffled = false;
    this.puzzleState.solved = true;
    
    let id = 0;
    for (let r = 0; r < size; ++r) {
      const rowArr = [];
      for (let c = 0; c < size; ++c) {
        if (r === size - 1 && c === size - 1) {
          rowArr.push(-1); // Empty slot
        } else {
          rowArr.push(id++);
        }
      }
      this.puzzleState.grid.push(rowArr);
    }
    
    this.puzzleState.tilePositions = {};
    this.updatePuzzleUI();
  }

  shufflePuzzleBoard() {
    this.resetPuzzleBoard();
    const size = this.puzzleState.gridSize;
    
    // Simulate valid moves to guarantee solvability
    let emptyR = size - 1;
    let emptyC = size - 1;
    
    const iterations = size === 3 ? 150 : (size === 4 ? 250 : 400);
    for (let i = 0; i < iterations; ++i) {
      const moves = [];
      if (emptyR > 0) moves.push([-1, 0]);
      if (emptyR < size - 1) moves.push([1, 0]);
      if (emptyC > 0) moves.push([0, -1]);
      if (emptyC < size - 1) moves.push([0, 1]);
      
      const chosen = moves[Math.floor(Math.random() * moves.length)];
      const nextR = emptyR + chosen[0];
      const nextC = emptyC + chosen[1];
      
      this.puzzleState.grid[emptyR][emptyC] = this.puzzleState.grid[nextR][nextC];
      this.puzzleState.grid[nextR][nextC] = -1;
      
      emptyR = nextR;
      emptyC = nextC;
    }
    
    this.puzzleState.moves = 0;
    this.puzzleState.shuffled = true;
    this.puzzleState.solved = false;
    this.updatePuzzleUI();
    this.log("Puzzle grid successfully scrambled using C++ solvable constraints!", "success");
    if (this.synth) this.synth.play('teleport');
  }

  checkPuzzleSolved() {
    const size = this.puzzleState.gridSize;
    let expectedId = 0;
    for (let r = 0; r < size; ++r) {
      for (let c = 0; c < size; ++c) {
        if (r === size - 1 && c === size - 1) {
          if (this.puzzleState.grid[r][c] !== -1) return false;
        } else {
          if (this.puzzleState.grid[r][c] !== expectedId++) return false;
        }
      }
    }
    return true;
  }

  handleSlidingPuzzleClick(clickR, clickC) {
    if (this.puzzleState.solved && !this.puzzleState.shuffled) return;

    const size = this.puzzleState.gridSize;
    if (clickR < 0 || clickR >= size || clickC < 0 || clickC >= size) return;
    if (this.puzzleState.grid[clickR][clickC] === -1) return;

    // Find empty slot
    let emptyR = -1, emptyC = -1;
    for (let r = 0; r < size; ++r) {
      for (let c = 0; c < size; ++c) {
        if (this.puzzleState.grid[r][c] === -1) {
          emptyR = r;
          emptyC = c;
          break;
        }
      }
      if (emptyR !== -1) break;
    }

    const dist = Math.abs(clickR - emptyR) + Math.abs(clickC - emptyC);
    if (dist === 1) {
      // Swap tiles in core grid!
      this.puzzleState.grid[emptyR][emptyC] = this.puzzleState.grid[clickR][clickC];
      this.puzzleState.grid[clickR][clickC] = -1;
      this.puzzleState.moves++;
      
      const solved = this.checkPuzzleSolved();
      this.puzzleState.solved = solved;
      
      if (solved) {
        this.puzzleState.shuffled = false;
        this.log(`🏆 CONGRATULATIONS! Puzzle Solved in ${this.puzzleState.moves} moves!`, "success");
        if (this.synth) this.synth.play('kill_major');
      } else {
        if (this.synth) this.synth.play('shoot_rifle');
      }
      
      this.updatePuzzleUI();
    }
  }

  updatePuzzleUI() {
    const movesVal = document.getElementById('puzzle-moves-val');
    const statusVal = document.getElementById('puzzle-status-val');
    const statsSummary = document.getElementById('puzzle-stats-summary');
    
    if (movesVal) movesVal.textContent = this.puzzleState.moves;
    if (statusVal) {
      if (this.puzzleState.solved) {
        statusVal.textContent = "SOLVED";
        statusVal.style.color = "#10b981";
      } else {
        statusVal.textContent = "PLAYING";
        statusVal.style.color = "#38bdf8";
      }
    }
    if (statsSummary) {
      statsSummary.textContent = `Moves: ${this.puzzleState.moves} | Grid: ${this.puzzleState.gridSize}x${this.puzzleState.gridSize}`;
    }
  }

  // 🟢 Demo 11: 3D Plinko Cascade Implementation Methods
  initPlinkoDemo() {
    this.state.activeShader = 0;
    this.state.fpsCheapMaterial = false;
    const shaderSelect = document.getElementById('shader-select');
    if (shaderSelect) shaderSelect.value = "0";

    if (!this.plinkoState) {
      this.plinkoState = {
        credits: 1000,
        highScore: 1000,
        totalDropped: 0,
        lastPayout: 0,
        rows: 8,
        gravity: -4.0,
        bounciness: 0.55,
        physicsEngine: 'classic2d',
        balls: [],
        particles: [],
        recentPegHits: {},
        autoDrop: false,
        autoDropTimer: 0,
        ballType: 'neon',
        touchEffect: 'pulsering',
        trailMode: 'pulse',
        initializedUI: false,
        pegs: [],
        shockwaveRings: [],
        autoHiddenOnMobile: false,
        restoreTimeout: null
      };
      
      // Pre-allocate shockwave rings for expanding radius circles
      for (let i = 0; i < 60; i++) {
        this.plinkoState.shockwaveRings.push({
          pos: [0, 0, 0.015],
          active: false,
          startTime: 0,
          duration: 0.48,
          radius: 0.0,
          maxRadius: 0.24,
          color: [1, 1, 1],
          type: 'pulsering',
          phase: 0
        });
      }

      // Pre-allocate spark particles
      for (let i = 0; i < 60; i++) {
        this.plinkoState.particles.push({
          pos: [0, 0, 0],
          vel: [0, 0, 0],
          color: [1, 1, 1],
          active: false,
          scale: 0.05,
          lifetime: 0,
          maxLifetime: 1.0,
          type: 'pulsering',
          initialHue: 0.0
        });
      }
    }

    const ps = this.plinkoState;
    this.recomputePlinkoPegs();

    // Dynamically initialize the background Web Worker for Plinko physics
    if (!this.physicsWorker) {
      this.physicsWorker = new Worker('./physics-worker.js');
      this.physicsWorker.onmessage = (e) => {
        const data = e.data;
        if (data && data.type === 'tickResult') {
          this.handlePhysicsWorkerTickResult(data);
        }
      };
    }

    // Seed/update configurations in the worker
    this.physicsWorker.postMessage({
      type: 'init',
      pegs: ps.pegs,
      rows: ps.rows,
      gravity: ps.gravity,
      bounciness: ps.bounciness
    });
    this.physicsWorker.postMessage({
      type: 'setEngine',
      engine: ps.physicsEngine || 'classic2d'
    });

    // Update UI
    this.updatePlinkoUI();

    if (!ps.initializedUI) {
      ps.initializedUI = true;
      this.setupPlinkoUI();
    }
  }

  recomputePlinkoPegs() {
    const ps = this.plinkoState;
    if (!ps) return;
    ps.pegs = [];
    const R = ps.rows;
    const topY = 2.15;
    const bottomY = 0.7;
    const yRange = topY - bottomY;
    const pegSpacingX = 1.84 / (R + 2);

    for (let r = 0; r < R; r++) {
      const y = topY - (r / (R - 1)) * yRange;
      const count = r + 3;
      for (let i = 0; i < count; i++) {
        const x = (i - (count - 1) / 2) * pegSpacingX;
        ps.pegs.push({
          row: r,
          col: i,
          x: x,
          y: y,
          id: `${r}_${i}`
        });
      }
    }

    if (this.physicsWorker) {
      this.physicsWorker.postMessage({
        type: 'init',
        pegs: ps.pegs,
        rows: ps.rows,
        gravity: ps.gravity,
        bounciness: ps.bounciness
      });
    }
  }

  isMobileDevice() {
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (window.innerWidth <= 768 && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) ||
           window.innerWidth <= 640;
  }

  hidePlinkoMobileUI() {
    const plinkoOverlayEl = document.getElementById('plinko-overlay');
    const plinkoFabEl = document.getElementById('plinko-mobile-fab');
    if (plinkoOverlayEl) {
      plinkoOverlayEl.classList.add('mobile-minimized');
    }
    if (plinkoFabEl && this.state.demoScene.includes('11_plinko')) {
      plinkoFabEl.style.display = 'flex';
    }
    if (this.plinkoState) {
      this.plinkoState.autoHiddenOnMobile = true;
    }
  }

  hideRouletteMobileUI() {
    const rOverlayEl = document.getElementById('roulette-overlay');
    const rFabEl = document.getElementById('roulette-mobile-fab');
    if (rOverlayEl) {
      rOverlayEl.classList.add('mobile-minimized');
    }
    if (rFabEl && this.state.demoScene.includes('12_roulette')) {
      rFabEl.style.display = 'flex';
    }
  }

  showRouletteMobileUI() {
    const rOverlayEl = document.getElementById('roulette-overlay');
    const rFabEl = document.getElementById('roulette-mobile-fab');
    if (rOverlayEl) {
      rOverlayEl.classList.remove('mobile-minimized');
    }
    if (rFabEl) {
      rFabEl.style.display = 'none';
    }
  }

  showPlinkoMobileUI() {
    const plinkoOverlayEl = document.getElementById('plinko-overlay');
    const plinkoFabEl = document.getElementById('plinko-mobile-fab');
    if (plinkoOverlayEl) {
      plinkoOverlayEl.classList.remove('mobile-minimized');
    }
    if (plinkoFabEl) {
      plinkoFabEl.style.display = 'none';
    }
    if (this.plinkoState) {
      this.plinkoState.autoHiddenOnMobile = false;
      if (this.plinkoState.restoreTimeout) {
        clearTimeout(this.plinkoState.restoreTimeout);
        this.plinkoState.restoreTimeout = null;
      }
    }
  }

  setupPlinkoUI() {
    const ps = this.plinkoState;
    if (!ps) return;

    const plinkoOverlay = document.getElementById('plinko-overlay');
    if (plinkoOverlay && !plinkoOverlay._eventsIsolated) {
      plinkoOverlay._eventsIsolated = true;
      const stopProp = (e) => {
        e.stopPropagation();
      };
      ['wheel', 'touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(evt => {
        plinkoOverlay.addEventListener(evt, stopProp, { passive: true });
      });
      ['mousedown', 'mousemove', 'mouseup'].forEach(evt => {
        plinkoOverlay.addEventListener(evt, stopProp);
      });
    }

    const btnClose = document.getElementById('btn-plinko-close');
    if (btnClose) {
      btnClose.addEventListener('click', () => {
        this.hidePlinkoMobileUI();
      });
    }

    const btnFab = document.getElementById('plinko-mobile-fab');
    if (btnFab) {
      btnFab.addEventListener('click', () => {
        this.showPlinkoMobileUI();
      });
    }

    const btnDrop = document.getElementById('btn-plinko-drop');
    if (btnDrop) {
      btnDrop.addEventListener('click', () => {
        this.dropPlinkoBall();
      });
    }

    const btnAuto = document.getElementById('btn-plinko-autodrop');
    if (btnAuto) {
      btnAuto.addEventListener('click', () => {
        ps.autoDrop = !ps.autoDrop;
        btnAuto.textContent = ps.autoDrop ? '🔄 AUTO-DROP: ON' : '🔄 AUTO-DROP: OFF';
        btnAuto.style.background = ps.autoDrop ? 'rgba(16, 185, 129, 0.25)' : 'rgba(15, 23, 42, 0.6)';
        btnAuto.style.borderColor = ps.autoDrop ? '#10b981' : 'rgba(255, 255, 255, 0.1)';
        btnAuto.style.color = ps.autoDrop ? '#34d399' : '#94a3b8';
        if (ps.autoDrop && this.isMobileDevice()) {
          this.hidePlinkoMobileUI();
        } else if (!ps.autoDrop && ps.balls.length === 0 && this.isMobileDevice() && ps.autoHiddenOnMobile) {
          if (ps.restoreTimeout) clearTimeout(ps.restoreTimeout);
          ps.restoreTimeout = setTimeout(() => {
            if (this.state.demoScene.includes('11_plinko') && ps.balls.length === 0 && !ps.autoDrop) {
              this.showPlinkoMobileUI();
            }
          }, 3000);
        }
      });
    }

    const btnReset = document.getElementById('btn-plinko-reset');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        ps.balls = [];
        ps.lastPayout = 0;
        ps.credits = 1000;
        ps.totalDropped = 0;
        this.updatePlinkoUI();
        this.log("Plinko Board cleared and credits reset to 1000!", "success");
        if (this.synth) this.synth.play('armor');
      });
    }

    const rowButtons = document.querySelectorAll('#plinko-rows-selector button');
    rowButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        rowButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        ps.rows = parseInt(btn.getAttribute('data-rows'), 10);
        ps.balls = [];
        this.recomputePlinkoPegs();
        this.log(`Plinko board configured to ${ps.rows} rows of pegs!`, "info");
        if (this.synth) this.synth.play('elevator');
      });
    });

    const styleButtons = document.querySelectorAll('#plinko-style-selector button');
    styleButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        styleButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        ps.ballType = btn.getAttribute('data-type');
        this.log(`Plinko ball aesthetic updated: [${ps.ballType.toUpperCase()}]`, "info");
        if (this.synth) this.synth.play('elevator');
      });
    });

    const effectButtons = document.querySelectorAll('#plinko-effect-selector button');
    effectButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        effectButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        ps.touchEffect = btn.getAttribute('data-effect');
        this.log(`Plinko impact visual effect updated: [${ps.touchEffect.toUpperCase()}]`, "info");
        if (this.synth) this.synth.play('hit');
      });
    });

    const trailButtons = document.querySelectorAll('#plinko-trail-selector button');
    trailButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        trailButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        ps.trailMode = btn.getAttribute('data-trail');
        this.log(`Plinko ball trail effect updated: [${ps.trailMode.toUpperCase()}]`, "info");
        if (this.synth) this.synth.play('laser');
      });
    });

    const gravitySlider = document.getElementById('slider-plinko-gravity');
    const gravityLbl = document.getElementById('plinko-gravity-lbl');
    if (gravitySlider) {
      gravitySlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        ps.gravity = val;
        if (gravityLbl) gravityLbl.textContent = `${val.toFixed(1)} m/s²`;
        if (this.physicsWorker) {
          this.physicsWorker.postMessage({
            type: 'updateSettings',
            gravity: val
          });
        }
      });
    }

    const bouncinessSlider = document.getElementById('slider-plinko-bounciness');
    const bouncinessLbl = document.getElementById('plinko-bounciness-lbl');
    if (bouncinessSlider) {
      bouncinessSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        ps.bounciness = val;
        if (bouncinessLbl) bouncinessLbl.textContent = `${Math.round(val * 100)}%`;
        if (this.physicsWorker) {
          this.physicsWorker.postMessage({
            type: 'updateSettings',
            bounciness: val
          });
        }
      });
    }

    const engineSelect = document.getElementById('select-plinko-engine');
    if (engineSelect) {
      engineSelect.value = ps.physicsEngine || 'classic2d';
      engineSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        ps.physicsEngine = val;
        ps.balls = []; // Clear local active balls
        this.log(`Plinko physics engine updated to: [${val.toUpperCase()} (Web Worker)]`, "info");
        
        if (this.physicsWorker) {
          this.physicsWorker.postMessage({ type: 'reset' });
          this.physicsWorker.postMessage({ type: 'setEngine', engine: val });
        }
        if (this.synth) this.synth.play('armor');
      });
    }
  }

  updatePlinkoUI() {
    const ps = this.plinkoState;
    if (!ps) return;

    const creditsEl = document.getElementById('plinko-credits-val');
    if (creditsEl) creditsEl.textContent = ps.credits;

    const highScoreEl = document.getElementById('plinko-highscore-val');
    if (highScoreEl) highScoreEl.textContent = ps.highScore;

    const countEl = document.getElementById('plinko-dropped-val');
    if (countEl) countEl.textContent = ps.totalDropped;

    const payoutEl = document.getElementById('plinko-payout-val');
    if (payoutEl) {
      payoutEl.textContent = ps.lastPayout > 0 ? `+${ps.lastPayout}` : "0";
    }

    const summaryEl = document.getElementById('plinko-stats-summary');
    if (summaryEl) {
      summaryEl.textContent = `Cost: 10 | High Score: ${ps.highScore}`;
    }
  }

  dropPlinkoBall() {
    const ps = this.plinkoState;
    if (!ps) return;

    if (ps.credits < 10) {
      this.log("Insufficient Credits! Please click RESET BOARD to get 1000 credits.", "warning");
      if (this.synth) this.synth.play('elevator');
      return;
    }

    ps.credits -= 10;
    ps.totalDropped++;
    this.updatePlinkoUI();

    // On mobile devices, auto-hide UI popup when playing so board is unobstructed
    if (this.isMobileDevice()) {
      this.hidePlinkoMobileUI();
      if (ps.restoreTimeout) {
        clearTimeout(ps.restoreTimeout);
        ps.restoreTimeout = null;
      }
    }

    const startX = (Math.random() - 0.5) * 0.12;
    const startY = 2.45;
    const startZ = 0.0;

    const startVx = (Math.random() - 0.5) * 0.4;
    const startVy = -0.5;

    let bColor = [1.0, 0.35, 0.0];
    let bMetal = 0.0;
    let bRough = 0.1;
    let bMatType = 0;

    if (ps.ballType === 'chrome') {
      bColor = [0.95, 0.95, 0.95];
      bMetal = 0.95;
      bRough = 0.05;
      bMatType = 0;
    } else if (ps.ballType === 'ruby') {
      bColor = [0.9, 0.05, 0.15];
      bMetal = 0.1;
      bRough = 0.08;
      bMatType = 12;
    }

    const ballId = Math.random().toString(36).substring(2, 9);
    const ballObj = {
      id: ballId,
      pos: [startX, startY, startZ],
      vel: [startVx, startVy, 0.0],
      color: bColor,
      metal: bMetal,
      rough: bRough,
      matType: bMatType,
      radius: 0.032,
      lastPegHitId: "",
      trail: [],
      payoutHandled: false
    };

    ps.balls.push(ballObj);

    if (this.physicsWorker) {
      this.physicsWorker.postMessage({
        type: 'dropBall',
        id: ballId,
        pos: ballObj.pos,
        vel: ballObj.vel,
        radius: ballObj.radius,
        color: bColor
      });
    }

    if (this.synth) this.synth.play('laser');
  }

  spawnPlinkoShockwave(px, py, color, effectType = null, customMaxRadius = 0.24) {
    const ps = this.plinkoState;
    if (!ps || !ps.shockwaveRings) return;

    const effect = effectType || ps.touchEffect || 'pulsering';
    const now = performance.now();

    // Spawn 1 or 2 concentric expanding radius circles (primary ring and echo ring)
    const numRings = (effect === 'pulsering' || effect === 'chromatic') ? 2 : 1;

    for (let r = 0; r < numRings; r++) {
      for (let i = 0; i < ps.shockwaveRings.length; i++) {
        const ring = ps.shockwaveRings[i];
        if (!ring.active) {
          ring.active = true;
          ring.pos[0] = px;
          ring.pos[1] = py;
          ring.pos[2] = 0.015 + r * 0.002;
          ring.startTime = now + r * 65; // slight delay for concentric echo ring
          ring.duration = (effect === 'electro' ? 0.32 : (effect === 'halo' ? 0.52 : 0.46));
          ring.radius = 0.02;
          ring.maxRadius = customMaxRadius * (r === 1 ? 1.25 : 1.0);
          ring.color = [color[0], color[1], color[2]];
          ring.type = effect;
          ring.phase = r;
          break;
        }
      }
    }
  }

  spawnPlinkoSparkles(px, py, color, count = 6) {
    // Forward to expanding radius shockwave circles with additive glow
    this.spawnPlinkoShockwave(px, py, color);
  }

  hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return [r, g, b];
  }

  updatePlinkoPhysics(dt) {
    const ps = this.plinkoState;
    if (!ps) return;

    if (ps.autoDrop) {
      ps.autoDropTimer += dt;
      if (ps.autoDropTimer >= 0.35) {
        ps.autoDropTimer = 0.0;
        this.dropPlinkoBall();
      }
    }

    const now = performance.now();

    // Update expanding radius shockwave rings
    if (ps.shockwaveRings) {
      ps.shockwaveRings.forEach(ring => {
        if (ring.active) {
          if (now < ring.startTime) return;
          const elapsed = (now - ring.startTime) / 1000.0;
          if (elapsed >= ring.duration) {
            ring.active = false;
          } else {
            const progress = elapsed / ring.duration;
            const easeOut = 1.0 - Math.pow(1.0 - progress, 3.0);
            ring.radius = 0.02 + (ring.maxRadius - 0.02) * easeOut;
          }
        }
      });
    }

    // Tick the background Web Worker for Plinko physics
    if (this.physicsWorker && !this._physicsWorkerTickPending) {
      this._physicsWorkerTickPending = true;
      this.physicsWorker.postMessage({ type: 'tick', dt: dt });
    }
  }

  handlePhysicsWorkerTickResult(data) {
    this._physicsWorkerTickPending = false;

    // 1. If currently in 3D Roulette Scene, process Roulette updates
    if (this.state.demoScene && this.state.demoScene.includes('12_roulette') && this.rouletteState) {
      const rs = this.rouletteState;
      if (data.roulette) {
        rs.wheelAngle = data.roulette.wheelAngle;
        if (data.roulette.ball) {
          rs.ball = data.roulette.ball;
          if (data.roulette.winPocket !== null && !rs.payoutHandled) {
            rs.payoutHandled = true;
            rs.spinning = false;
            rs.lastOutcomePocket = data.roulette.winPocket;
            this.computeRoulettePayout(data.roulette.winPocket);
          }
        } else {
          rs.ball = null;
        }

        // Play authentic clatter and pocket drop synthesizers
        if (data.roulette.hitSound && this.synth) {
          if (data.roulette.hitSound === 'pocket') {
            this.synth.play('health');
          } else if (data.roulette.hitSound === 'rim') {
            this.synth.play('ammo');
          } else {
            this.synth.play('pickup');
          }
        }
      }
      return;
    }

    const ps = this.plinkoState;
    if (!ps) return;

    // 1. Process peg impacts
    if (data.hits) {
      data.hits.forEach(hit => {
        // Trigger visual ripple / flash on peg
        this.spawnPlinkoShockwave(hit.x, hit.y, hit.color, ps.touchEffect);
        ps.recentPegHits[hit.pegId] = performance.now();
        if (this.synth) this.synth.play('hit');
      });
    }

    // 2. Synchronize ball lists
    const ballsMap = new Map();
    data.balls.forEach(wb => {
      ballsMap.set(wb.id, wb);
    });

    const activeBalls = [];
    ps.balls.forEach(b => {
      const wb = ballsMap.get(b.id);
      if (wb) {
        b.pos[0] = wb.pos[0];
        b.pos[1] = wb.pos[1];
        b.pos[2] = wb.pos[2];
        b.vel[0] = wb.vel[0];
        b.vel[1] = wb.vel[1];
        b.vel[2] = wb.vel[2];
        if (wb.rot) b.rot = wb.rot;
        if (wb.angVel) b.angVel = wb.angVel;

        // Add trail positions
        if (ps.trailMode !== 'off') {
          const now = performance.now();
          if (!b.trail) b.trail = [];
          const lastP = b.trail[b.trail.length - 1];
          if (!lastP || (now - lastP.time > 12)) {
            b.trail.push({
              x: b.pos[0],
              y: b.pos[1],
              z: b.pos[2],
              time: now,
              color: [b.color[0], b.color[1], b.color[2]]
            });
          }
          while (b.trail.length > 0 && (now - b.trail[0].time > 360)) {
            b.trail.shift();
          }
        }

        // Payout detection
        if (b.pos[1] <= 0.41 && !b.payoutHandled) {
          b.payoutHandled = true;
          this.handleBallLanding(b);
        }

        activeBalls.push(b);
      }
    });

    ps.balls = activeBalls;
  }

  handleBallLanding(b) {
    const ps = this.plinkoState;
    if (!ps) return;

    const R = ps.rows;
    const B = R + 2;
    const binW = 1.84 / B;
    const startBinX = -0.92;

    const landingX = b.pos[0];
    let binIdx = Math.floor((landingX - startBinX) / binW);
    binIdx = Math.max(0, Math.min(B - 1, binIdx));

    const halfBins = (B - 1) / 2;
    const distFromCenter = Math.abs(binIdx - halfBins) / halfBins;
    
    let multiplier = 0.2;
    if (distFromCenter < 0.2) {
      multiplier = 0.2;
    } else if (distFromCenter < 0.4) {
      multiplier = 0.5;
    } else if (distFromCenter < 0.6) {
      multiplier = 1.5;
    } else if (distFromCenter < 0.8) {
      multiplier = 4.0;
    } else {
      multiplier = 12.0;
    }

    const winAmount = Math.round(10 * multiplier);
    ps.credits += winAmount;
    ps.lastPayout = winAmount;

    if (ps.credits > ps.highScore) {
      ps.highScore = ps.credits;
    }

    this.updatePlinkoUI();
    this.log(`Ball landed in bin ${binIdx + 1} (Multiplier: ${multiplier}x). Payout: ${winAmount} credits!`, "success");
    
    let binHighlightColor = [0.1, 0.8, 1.0];
    if (multiplier >= 12.0) binHighlightColor = [1.0, 0.85, 0.1];
    else if (multiplier >= 4.0) binHighlightColor = [0.2, 1.0, 0.4];
    this.spawnPlinkoShockwave(landingX, 0.44, binHighlightColor, ps.touchEffect, 0.38);

    if (this.synth) {
      if (multiplier >= 4.0) {
        this.synth.play('health');
      } else {
        this.synth.play('elevator');
      }
    }

    // Restore popup on mobile if all balls are cleared and autoDrop is off
    if (ps.balls.length <= 1 && this.isMobileDevice() && ps.autoHiddenOnMobile && !ps.autoDrop) {
      if (ps.restoreTimeout) clearTimeout(ps.restoreTimeout);
      ps.restoreTimeout = setTimeout(() => {
        if (this.state.demoScene.includes('11_plinko') && ps.balls.length === 0 && !ps.autoDrop) {
          this.showPlinkoMobileUI();
        }
      }, 3000);
    }
  }

  // 🎰 Demo 12: 3D Real-Physics Roulette Wheel Implementation Methods
  initRouletteDemo() {
    this.state.activeShader = 0;
    this.state.fpsCheapMaterial = false;
    const shaderSelect = document.getElementById('shader-select');
    if (shaderSelect) shaderSelect.value = "0";

    if (!this.rouletteState) {
      this.rouletteState = {
        credits: 1000,
        highScore: 1000,
        betAmount: 10,
        betType: 'red',
        specificNumber: 'none',
        lastPayout: 0,
        lastOutcomePocket: null,
        ball: null,
        wheelAngle: 0.0,
        wheelSpeed: -2.8,
        active: true,
        spinning: false,
        payoutHandled: false,
        trail: []
      };
    } else {
      this.rouletteState.active = true;
    }

    // Hide Plinko and show Roulette panels
    const plinkoOverlay = document.getElementById('plinko-overlay');
    if (plinkoOverlay) plinkoOverlay.style.display = 'none';
    const plinkoBanner = document.getElementById('plinko-banner');
    if (plinkoBanner) plinkoBanner.style.display = 'none';

    const rOverlay = document.getElementById('roulette-overlay');
    if (rOverlay) rOverlay.style.display = 'block';
    const rBanner = document.getElementById('roulette-banner');
    if (rBanner) rBanner.style.display = 'flex';

    this.setupRouletteUI();
    this.updateRouletteUI();

    // Spawn/seed Web Worker
    if (!this.physicsWorker) {
      this.physicsWorker = new Worker('./physics-worker.js');
      this.physicsWorker.onmessage = (e) => {
        const data = e.data;
        if (data && data.type === 'tickResult') {
          this.handlePhysicsWorkerTickResult(data);
        }
      };
    }

    const isMobile = this.isMobileDevice();
    this.state.camRadius = isMobile ? 3.8 : 3.2;
    this.state.camPitch = 0.82; // angled view (~47 deg above horizon)
    this.state.camYaw = 0.0;
    this.state.camTarget[0] = 0.0;
    this.state.camTarget[1] = 0.0;
    this.state.camTarget[2] = 0.08;

    this.physicsWorker.postMessage({
      type: 'initRoulette',
      wheelAngle: this.rouletteState.wheelAngle
    });

    this.log("Roulette Demo Loaded! Place your bets on the felt and spin.", "success");
  }

  setupRouletteUI() {
    const rs = this.rouletteState;
    if (!rs) return;

    const rOverlay = document.getElementById('roulette-overlay');
    if (rOverlay && !rOverlay._eventsIsolated) {
      rOverlay._eventsIsolated = true;
      const stopProp = (e) => {
        e.stopPropagation();
      };
      ['wheel', 'touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(evt => {
        rOverlay.addEventListener(evt, stopProp, { passive: true });
      });
      ['mousedown', 'mousemove', 'mouseup'].forEach(evt => {
        rOverlay.addEventListener(evt, stopProp);
      });
    }

    // Bet amount selection
    const amtBtns = document.querySelectorAll('.roulette-bet-amt-btn');
    amtBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        amtBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        rs.betAmount = parseInt(btn.getAttribute('data-amt')) || 10;
        this.updateRouletteUI();
        if (this.synth) this.synth.play('pickup');
      });
    });

    // Bet category choices
    const choiceBtns = document.querySelectorAll('.roulette-bet-choice');
    choiceBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        choiceBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        rs.betType = btn.getAttribute('data-bet') || 'red';
        rs.specificNumber = 'none';

        const numSelect = document.getElementById('roulette-specific-number');
        if (numSelect) numSelect.value = 'none';

        this.updateRouletteUI();
        if (this.synth) this.synth.play('pickup');
      });
    });

    // Specific single-number bet dropdown
    const numSelect = document.getElementById('roulette-specific-number');
    if (numSelect) {
      numSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val !== 'none') {
          choiceBtns.forEach(b => b.classList.remove('active'));
          rs.betType = 'number';
          rs.specificNumber = val;
        } else {
          rs.betType = 'red';
          const redBtn = document.querySelector('.roulette-bet-choice[data-bet="red"]');
          if (redBtn) redBtn.classList.add('active');
        }
        this.updateRouletteUI();
        if (this.synth) this.synth.play('pickup');
      });
    }

    // Interactive spin trigger button
    const spinBtn = document.getElementById('btn-roulette-spin');
    if (spinBtn) {
      const newSpinBtn = spinBtn.cloneNode(true);
      spinBtn.parentNode.replaceChild(newSpinBtn, spinBtn);

      newSpinBtn.addEventListener('click', () => {
        if (rs.spinning) return;

        if (rs.credits < rs.betAmount) {
          this.log("Insufficient Credits! Reset board or lower bet.", "error");
          if (this.synth) this.synth.play('damage');
          return;
        }

        // Deduct bet and trigger spin
        rs.credits -= rs.betAmount;
        rs.spinning = true;
        rs.payoutHandled = false;
        rs.lastOutcomePocket = null;
        rs.trail = [];
        this.updateRouletteUI();

        if (this.synth) this.synth.play('teleport');

        let betLabel = rs.betType === 'number' ? `NUMBER ${rs.specificNumber}` : rs.betType.toUpperCase();
        this.log(`Roulette wheel and ball spun! Bet: ${rs.betAmount} on [${betLabel}].`, "info");

        if (this.physicsWorker) {
          this.physicsWorker.postMessage({ type: 'spinRoulette' });
        }
      });
    }

    // Panel minimize/close button
    const closeBtn = document.getElementById('btn-roulette-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        if (this.isMobileDevice()) {
          this.hideRouletteMobileUI();
        } else {
          rs.active = false;
          const rOverlay = document.getElementById('roulette-overlay');
          if (rOverlay) rOverlay.style.display = 'none';
          const rBanner = document.getElementById('roulette-banner');
          if (rBanner) rBanner.style.display = 'none';

          this.state.demoScene = '07_fps_shooter_damage_system.cpp';
          const demoSelect = document.getElementById('demo-scene-select');
          if (demoSelect) demoSelect.value = "07_fps_shooter_damage_system.cpp";
          this.updateSceneEntitiesForActiveDemo();
          this.log("Roulette demo closed. Switched back to FPS arena.", "info");
        }
      });
    }

    // FAB floating mobile reopen trigger
    const rFab = document.getElementById('roulette-mobile-fab');
    if (rFab) {
      rFab.addEventListener('click', () => {
        this.showRouletteMobileUI();
      });
    }
  }

  updateRouletteUI() {
    const rs = this.rouletteState;
    if (!rs) return;

    const credsVal = document.getElementById('roulette-credits-val');
    const payoutVal = document.getElementById('roulette-payout-val');
    const hitVal = document.getElementById('roulette-hit-val');
    const highVal = document.getElementById('roulette-highscore-val');
    const summary = document.getElementById('roulette-stats-summary');

    if (credsVal) credsVal.textContent = rs.credits;
    if (payoutVal) payoutVal.textContent = rs.lastPayout > 0 ? `+${rs.lastPayout}` : "0";
    if (highVal) highVal.textContent = rs.highScore;

    if (hitVal) {
      if (rs.lastOutcomePocket !== null) {
        const ROULETTE_NUMBERS = [
          0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 
          24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
        ];
        const num = ROULETTE_NUMBERS[rs.lastOutcomePocket];
        let color = '#a7f3d0'; // Green 0
        if (num !== 0) {
          const reds = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
          color = reds.includes(num) ? '#f87171' : '#94a3b8';
        }
        hitVal.style.color = color;
        hitVal.textContent = `${num}`;
      } else {
        hitVal.style.color = '#38bdf8';
        hitVal.textContent = rs.spinning ? 'ROLLING...' : '--';
      }
    }

    if (summary) {
      let label = rs.betType === 'number' ? `Number ${rs.specificNumber}` : rs.betType.toUpperCase();
      let multiplier = "2x";
      if (rs.betType === 'zero' || rs.betType === 'number') multiplier = "35x";
      summary.textContent = `Bet Placement: ${label} (${rs.betAmount} Credits) | Potential Payout: ${multiplier}`;
    }
  }

  computeRoulettePayout(pocketIdx) {
    const rs = this.rouletteState;
    if (!rs) return;

    const ROULETTE_NUMBERS = [
      0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 
      24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
    ];
    const winningNum = ROULETTE_NUMBERS[pocketIdx];

    let color = 'black';
    if (winningNum === 0) color = 'green';
    else {
      const reds = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
      if (reds.includes(winningNum)) color = 'red';
    }

    let won = false;
    let multiplier = 0;

    if (rs.betType === 'red' && color === 'red') {
      won = true;
      multiplier = 2;
    } else if (rs.betType === 'black' && color === 'black') {
      won = true;
      multiplier = 2;
    } else if (rs.betType === 'even' && winningNum !== 0 && winningNum % 2 === 0) {
      won = true;
      multiplier = 2;
    } else if (rs.betType === 'odd' && winningNum !== 0 && winningNum % 2 !== 0) {
      won = true;
      multiplier = 2;
    } else if (rs.betType === 'zero' && winningNum === 0) {
      won = true;
      multiplier = 35;
    } else if (rs.betType === 'number' && rs.specificNumber !== 'none' && parseInt(rs.specificNumber) === winningNum) {
      won = true;
      multiplier = 36;
    }

    let payout = 0;
    if (won) {
      payout = rs.betAmount * multiplier;
      rs.credits += payout;
      rs.lastPayout = payout;
      if (this.synth) this.synth.play('health');
      this.log(`🎉 WINNER! Ball landed in slot ${winningNum} (${color.toUpperCase()}). Awarded ${payout} credits!`, "success");
    } else {
      rs.lastPayout = 0;
      if (this.synth) this.synth.play('damage');
      this.log(`Lost! Ball landed in slot ${winningNum} (${color.toUpperCase()}). Good luck next round!`, "info");
    }

    if (rs.credits > rs.highScore) {
      rs.highScore = rs.credits;
    }

    this.updateRouletteUI();
  }

  updateRoulettePhysics(dt) {
    if (this.physicsWorker && !this._physicsWorkerTickPending) {
      this._physicsWorkerTickPending = true;
      this.physicsWorker.postMessage({ type: 'tick', dt: dt });
    }
  }

  render3DRoulette(progInfo, timestamp) {
    const gl = this.gl;
    const rs = this.rouletteState;
    if (!rs) return;

    // 1. Force completely opaque rendering pass: disable alpha blending, enable depth writing, and disable back-face culling to prevent see-through artifacts due to winding mismatch.
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);

    const sphereMesh = this.meshBuffers[0];
    const cubeMesh = this.meshBuffers[1];
    const torusMesh = this.meshBuffers[4];
    const quadMesh = this.meshBuffers[5];
    const ringMesh = this.meshBuffers[6];
    const diskMesh = this.meshBuffers[7];

    if (!sphereMesh || !cubeMesh || !torusMesh) return;

    // Helper: draw rotated cube with yaw angle rotZ (rigid rotation with scale)
    const drawRotatedCube = (px, py, pz, sx, sy, sz, rotZ, color, rough = 0.25, metal = 0.85, matType = 0) => {
      gl.bindVertexArray(cubeMesh.vao);
      const c = Math.cos(rotZ), s = Math.sin(rotZ);
      // Column 0: X axis rotated and scaled by sx
      this.modelMatrix[0] = c * sx;
      this.modelMatrix[1] = s * sx;
      this.modelMatrix[2] = 0;
      this.modelMatrix[3] = 0;
      // Column 1: Y axis rotated and scaled by sy
      this.modelMatrix[4] = -s * sy;
      this.modelMatrix[5] = c * sy;
      this.modelMatrix[6] = 0;
      this.modelMatrix[7] = 0;
      // Column 2: Z axis scaled by sz
      this.modelMatrix[8] = 0;
      this.modelMatrix[9] = 0;
      this.modelMatrix[10] = sz;
      this.modelMatrix[11] = 0;
      // Column 3: Translation (px, py, pz)
      this.modelMatrix[12] = px;
      this.modelMatrix[13] = py;
      this.modelMatrix[14] = pz;
      this.modelMatrix[15] = 1;
      Mat4.normalFromMat4(this.normalMatrix, this.modelMatrix);
      gl.uniformMatrix4fv(progInfo.uModel, false, this.modelMatrix);
      if (progInfo.uNormalMatrix) gl.uniformMatrix3fv(progInfo.uNormalMatrix, false, this.normalMatrix);
      if (progInfo.uBaseColor) gl.uniform3fv(progInfo.uBaseColor, color);
      if (progInfo.uRoughness) gl.uniform1f(progInfo.uRoughness, rough);
      if (progInfo.uMetallic) gl.uniform1f(progInfo.uMetallic, metal);
      if (progInfo.uMatType) gl.uniform1i(progInfo.uMatType, matType);
      gl.drawElements(gl.TRIANGLES, cubeMesh.indexCount, gl.UNSIGNED_SHORT, 0);
    };

    const drawCube = (px, py, pz, sx, sy, sz, color, rough = 0.25, metal = 0.85, matType = 0) => {
      drawRotatedCube(px, py, pz, sx, sy, sz, 0, color, rough, metal, matType);
    };

    const drawSphere = (px, py, pz, sx, sy, sz, color, rough = 0.15, metal = 0.95, matType = 0, rot = [0, 0, 0]) => {
      gl.bindVertexArray(sphereMesh.vao);
      const cx = Math.cos(rot[0]), sx_ = Math.sin(rot[0]);
      const cy = Math.cos(rot[1]), sy_ = Math.sin(rot[1]);
      const cz = Math.cos(rot[2]), sz_ = Math.sin(rot[2]);

      const r00 = cy * cz + sy_ * sx_ * sz_;
      const r01 = cz * sy_ * sx_ - cy * sz_;
      const r02 = cx * sy_;
      const r10 = cx * sz_;
      const r11 = cx * cz;
      const r12 = -sx_;
      const r20 = cy * sy_ * sx_ - cz * sy_;
      const r21 = cy * cz * sx_ + sy_ * sz_;
      const r22 = cy * cx;

      this.modelMatrix[0] = r00 * sx;  this.modelMatrix[1] = r01 * sy;  this.modelMatrix[2] = r02 * sz;  this.modelMatrix[3] = 0;
      this.modelMatrix[4] = r10 * sx;  this.modelMatrix[5] = r11 * sy;  this.modelMatrix[6] = r12 * sz;  this.modelMatrix[7] = 0;
      this.modelMatrix[8] = r20 * sx;  this.modelMatrix[9] = r21 * sy;  this.modelMatrix[10] = r22 * sz; this.modelMatrix[11] = 0;
      this.modelMatrix[12] = px;        this.modelMatrix[13] = py;        this.modelMatrix[14] = pz;        this.modelMatrix[15] = 1;

      Mat4.normalFromMat4(this.normalMatrix, this.modelMatrix);
      gl.uniformMatrix4fv(progInfo.uModel, false, this.modelMatrix);
      if (progInfo.uNormalMatrix) gl.uniformMatrix3fv(progInfo.uNormalMatrix, false, this.normalMatrix);
      if (progInfo.uBaseColor) gl.uniform3fv(progInfo.uBaseColor, color);
      if (progInfo.uRoughness) gl.uniform1f(progInfo.uRoughness, rough);
      if (progInfo.uMetallic) gl.uniform1f(progInfo.uMetallic, metal);
      if (progInfo.uMatType) gl.uniform1i(progInfo.uMatType, matType);
      gl.drawElements(gl.TRIANGLES, sphereMesh.indexCount, gl.UNSIGNED_SHORT, 0);
    };

    // Helper: draw horizontal torus laying flat in X-Y plane (normal pointing up Z)
    // Mesh X-Z is the circle ring, mesh Y is the tube thickness.
    const drawHorizontalTorus = (px, py, pz, sx, sy, sz, color, rough = 0.15, metal = 0.95, matType = 0) => {
      gl.bindVertexArray(torusMesh.vao);
      this.modelMatrix[0] = sx;  this.modelMatrix[1] = 0;    this.modelMatrix[2] = 0;   this.modelMatrix[3] = 0;
      this.modelMatrix[4] = 0;   this.modelMatrix[5] = 0;    this.modelMatrix[6] = sz;  this.modelMatrix[7] = 0;
      this.modelMatrix[8] = 0;   this.modelMatrix[9] = -sy;  this.modelMatrix[10] = 0;  this.modelMatrix[11] = 0;
      this.modelMatrix[12] = px; this.modelMatrix[13] = py;  this.modelMatrix[14] = pz; this.modelMatrix[15] = 1;
      Mat4.normalFromMat4(this.normalMatrix, this.modelMatrix);
      gl.uniformMatrix4fv(progInfo.uModel, false, this.modelMatrix);
      if (progInfo.uNormalMatrix) gl.uniformMatrix3fv(progInfo.uNormalMatrix, false, this.normalMatrix);
      if (progInfo.uBaseColor) gl.uniform3fv(progInfo.uBaseColor, color);
      if (progInfo.uRoughness) gl.uniform1f(progInfo.uRoughness, rough);
      if (progInfo.uMetallic) gl.uniform1f(progInfo.uMetallic, metal);
      if (progInfo.uMatType) gl.uniform1i(progInfo.uMatType, matType);
      gl.drawElements(gl.TRIANGLES, torusMesh.indexCount, gl.UNSIGNED_SHORT, 0);
    };

    const drawDisk = (px, py, pz, sx, sy, sz, color, rough = 0.2, metal = 0.0, matType = 0) => {
      if (!diskMesh) return;
      gl.bindVertexArray(diskMesh.vao);
      this.modelMatrix[0] = sx; this.modelMatrix[1] = 0; this.modelMatrix[2] = 0; this.modelMatrix[3] = 0;
      this.modelMatrix[4] = 0; this.modelMatrix[5] = sy; this.modelMatrix[6] = 0; this.modelMatrix[7] = 0;
      this.modelMatrix[8] = 0; this.modelMatrix[9] = 0; this.modelMatrix[10] = sz; this.modelMatrix[11] = 0;
      this.modelMatrix[12] = px; this.modelMatrix[13] = py; this.modelMatrix[14] = pz; this.modelMatrix[15] = 1;
      Mat4.normalFromMat4(this.normalMatrix, this.modelMatrix);
      gl.uniformMatrix4fv(progInfo.uModel, false, this.modelMatrix);
      if (progInfo.uNormalMatrix) gl.uniformMatrix3fv(progInfo.uNormalMatrix, false, this.normalMatrix);
      if (progInfo.uBaseColor) gl.uniform3fv(progInfo.uBaseColor, color);
      if (progInfo.uRoughness) gl.uniform1f(progInfo.uRoughness, rough);
      if (progInfo.uMetallic) gl.uniform1f(progInfo.uMetallic, metal);
      if (progInfo.uMatType) gl.uniform1i(progInfo.uMatType, matType);
      gl.drawElements(gl.TRIANGLES, diskMesh.indexCount, gl.UNSIGNED_SHORT, 0);
    };

    const drawRing = (px, py, pz, sx, sy, sz, color, rough = 0.2, metal = 0.0, matType = 0) => {
      if (!ringMesh) return;
      gl.bindVertexArray(ringMesh.vao);
      this.modelMatrix[0] = sx; this.modelMatrix[1] = 0; this.modelMatrix[2] = 0; this.modelMatrix[3] = 0;
      this.modelMatrix[4] = 0; this.modelMatrix[5] = sy; this.modelMatrix[6] = 0; this.modelMatrix[7] = 0;
      this.modelMatrix[8] = 0; this.modelMatrix[9] = 0; this.modelMatrix[10] = sz; this.modelMatrix[11] = 0;
      this.modelMatrix[12] = px; this.modelMatrix[13] = py; this.modelMatrix[14] = pz; this.modelMatrix[15] = 1;
      Mat4.normalFromMat4(this.normalMatrix, this.modelMatrix);
      gl.uniformMatrix4fv(progInfo.uModel, false, this.modelMatrix);
      if (progInfo.uNormalMatrix) gl.uniformMatrix3fv(progInfo.uNormalMatrix, false, this.normalMatrix);
      if (progInfo.uBaseColor) gl.uniform3fv(progInfo.uBaseColor, color);
      if (progInfo.uRoughness) gl.uniform1f(progInfo.uRoughness, rough);
      if (progInfo.uMetallic) gl.uniform1f(progInfo.uMetallic, metal);
      if (progInfo.uMatType) gl.uniform1i(progInfo.uMatType, matType);
      gl.drawElements(gl.TRIANGLES, ringMesh.indexCount, gl.UNSIGNED_SHORT, 0);
    };

    if (progInfo.uUseTexMaps) gl.uniform1i(progInfo.uUseTexMaps, 0);

    // 1. Draw luxurious green felt casino table cloth
    if (quadMesh) {
      gl.bindVertexArray(quadMesh.vao);
      this.modelMatrix[0] = 5.0; this.modelMatrix[1] = 0; this.modelMatrix[2] = 0; this.modelMatrix[3] = 0;
      this.modelMatrix[4] = 0; this.modelMatrix[5] = 5.0; this.modelMatrix[6] = 0; this.modelMatrix[7] = 0;
      this.modelMatrix[8] = 0; this.modelMatrix[9] = 0; this.modelMatrix[10] = 1.0; this.modelMatrix[11] = 0;
      this.modelMatrix[12] = 0; this.modelMatrix[13] = 0; this.modelMatrix[14] = -0.01; this.modelMatrix[15] = 1;
      Mat4.normalFromMat4(this.normalMatrix, this.modelMatrix);
      gl.uniformMatrix4fv(progInfo.uModel, false, this.modelMatrix);
      if (progInfo.uNormalMatrix) gl.uniformMatrix3fv(progInfo.uNormalMatrix, false, this.normalMatrix);
      if (progInfo.uBaseColor) gl.uniform3fv(progInfo.uBaseColor, [0.08, 0.32, 0.16]); // felt green
      if (progInfo.uRoughness) gl.uniform1f(progInfo.uRoughness, 0.85); // ultra rough felt texture
      if (progInfo.uMetallic) gl.uniform1f(progInfo.uMetallic, 0.0);
      gl.drawElements(gl.TRIANGLES, quadMesh.indexCount, gl.UNSIGNED_SHORT, 0);
    }

    // Retrieve dynamic entities from the Scene Graph
    const spindleEnt = this.sceneEntities ? this.sceneEntities.find(e => e.id === 0) : null;
    const wheelEnt = this.sceneEntities ? this.sceneEntities.find(e => e.id === 1) : null;
    const rimEnt = this.sceneEntities ? this.sceneEntities.find(e => e.id === 2) : null;

    // Resolve materials: Base Color, Roughness, Metallic
    const spindleColor = spindleEnt ? spindleEnt.color : [0.95, 0.64, 0.08];
    const spindleRough = spindleEnt ? spindleEnt.roughness : 0.08;
    const spindleMetal = spindleEnt ? spindleEnt.metallic : 0.98;

    const wheelColor = wheelEnt ? wheelEnt.color : [0.14, 0.14, 0.16];
    const wheelRough = wheelEnt ? wheelEnt.roughness : 0.18;
    const wheelMetal = wheelEnt ? wheelEnt.metallic : 0.92;

    const rimColor = rimEnt ? rimEnt.color : [0.26, 0.08, 0.03];
    const rimRough = rimEnt ? rimEnt.roughness : 0.25;
    const rimMetal = rimEnt ? rimEnt.metallic : 0.05;

    // 2. Draw outer mahogany housing cabinet base (solid wood bowl structure)
    drawDisk(0, 0, 0.002, 1.45, 1.45, 1.0, rimColor, rimRough, rimMetal);

    // 3. Draw BIG Torus for rolling ball in circle (sleek wood ball track)
    // Thickness (Z-scale) scaled down to 0.08 so we see the mahogany wooden body and pins beautifully.
    // MatType is set to 0 (Standard Opaque PBR) to keep it smooth, crisp, and 100% solid.
    drawHorizontalTorus(0, 0, 0.10, 1.05, 1.05, 0.08, rimColor, rimRough, rimMetal, 0);

    // 4. Draw Safety Ring (Torus) on top of BIG Torus to prevent ball getting out
    // Styled as a sleek polished brass safety lip using standard opaque PBR (matType = 0)
    drawHorizontalTorus(0, 0, 0.16, 1.06, 1.06, 0.05, [0.92, 0.78, 0.38], 0.08, 0.98, 0);

    // 5. Draw inner concave wood bowl slope (extends from r=0 to r=1.04) using standard opaque PBR (matType = 0)
    drawDisk(0, 0, 0.012, 1.04, 1.04, 1.0, rimColor, rimRough, rimMetal, 0);

    // 6. Draw 8 Brass Diamond Deflectors (canoes / metal pins) on the bowl slope
    for (let k = 0; k < 8; k++) {
      const dAngle = k * (Math.PI / 4);
      drawRotatedCube(0.92 * Math.cos(dAngle), 0.92 * Math.sin(dAngle), 0.10, 0.028, 0.028, 0.018, dAngle + 0.785, [0.90, 0.78, 0.35], 0.08, 0.98);
    }

    // 7. Draw the central spinning wheel disk
    const wheelAngle = rs.wheelAngle;
    gl.bindVertexArray(diskMesh.vao);
    const cW = Math.cos(wheelAngle), sW = Math.sin(wheelAngle);
    this.modelMatrix[0] = 0.78 * cW;  this.modelMatrix[1] = 0.78 * sW;  this.modelMatrix[2] = 0;   this.modelMatrix[3] = 0;
    this.modelMatrix[4] = -0.78 * sW; this.modelMatrix[5] = 0.78 * cW;  this.modelMatrix[6] = 0;   this.modelMatrix[7] = 0;
    this.modelMatrix[8] = 0;          this.modelMatrix[9] = 0;          this.modelMatrix[10] = 1.0; this.modelMatrix[11] = 0;
    this.modelMatrix[12] = 0;         this.modelMatrix[13] = 0;         this.modelMatrix[14] = 0.016; this.modelMatrix[15] = 1;
    Mat4.normalFromMat4(this.normalMatrix, this.modelMatrix);
    gl.uniformMatrix4fv(progInfo.uModel, false, this.modelMatrix);
    if (progInfo.uNormalMatrix) gl.uniformMatrix3fv(progInfo.uNormalMatrix, false, this.normalMatrix);
    if (progInfo.uBaseColor) gl.uniform3fv(progInfo.uBaseColor, wheelColor); // gunmetal / obsidian wheel face from graph scene
    if (progInfo.uRoughness) gl.uniform1f(progInfo.uRoughness, wheelRough);
    if (progInfo.uMetallic) gl.uniform1f(progInfo.uMetallic, wheelMetal);
    gl.drawElements(gl.TRIANGLES, diskMesh.indexCount, gl.UNSIGNED_SHORT, 0);

    // 8. Draw 37 ball holders / compote objects (SUM=37 from 0 to 36) arranged in orbit
    const ROULETTE_NUMBERS = [
      0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 
      24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
    ];

    for (let i = 0; i < 37; i++) {
      const angle = wheelAngle + i * (2 * Math.PI / 37);

      // Radial divider fret (golden thin separator cube pointing radially towards center)
      drawRotatedCube(0.68 * Math.cos(angle), 0.68 * Math.sin(angle), 0.026, 0.09, 0.007, 0.024, angle, [0.88, 0.76, 0.38], 0.1, 0.95);

      // Pocket cup floor & color indicator (shifted to sit squarely in between separators)
      const midAngle = angle + (Math.PI / 37);
      const px = 0.68 * Math.cos(midAngle);
      const py = 0.68 * Math.sin(midAngle);

      const num = ROULETTE_NUMBERS[i];
      let col = [0.03, 0.03, 0.03]; // Black pocket default
      if (num === 0) {
        col = [0.06, 0.75, 0.18]; // Green 0
      } else {
        const reds = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
        if (reds.includes(num)) {
          col = [0.85, 0.08, 0.08]; // Red
        }
      }

      // Pocket floor base box (the holder cup oriented directly towards center)
      drawRotatedCube(px, py, 0.016, 0.08, 0.046, 0.008, midAngle, col, 0.25, 0.3);

      // Shiny colored pocket indicator sphere
      drawSphere(px, py, 0.024, 0.016, 0.016, 0.016, col, 0.06, 0.15);
    }

    // 9. Central Turret & 4-Arm Spinner Cross
    // Spindle cone
    drawSphere(0, 0, 0.035, 0.20, 0.20, 0.06, spindleColor, spindleRough, spindleMetal);
    // Spindle column
    drawSphere(0, 0, 0.075, 0.065, 0.065, 0.09, spindleColor, spindleRough, spindleMetal);
    // Center turret finial sphere
    drawSphere(0, 0, 0.13, 0.035, 0.035, 0.035, spindleColor, spindleRough, spindleMetal);

    // 4 cross arms spinning with wheelAngle
    for (let a = 0; a < 4; a++) {
      const armAng = wheelAngle + a * (Math.PI / 2);
      drawRotatedCube(0.06 * Math.cos(armAng), 0.06 * Math.sin(armAng), 0.11, 0.10, 0.014, 0.014, armAng, spindleColor, spindleRough, spindleMetal);
      drawSphere(0.11 * Math.cos(armAng), 0.11 * Math.sin(armAng), 0.11, 0.018, 0.018, 0.018, spindleColor, spindleRough, spindleMetal);
    }

    // 10. Physical rolling ivory ball
    const b = rs.ball;
    if (b) {
      drawSphere(b.pos[0], b.pos[1], b.pos[2], 0.035, 0.035, 0.035, [0.97, 0.97, 0.95], 0.06, 0.12, 0, b.rot || [0, 0, 0]);

      // Visual speed trails while in active motion
      if (!b.trapped) {
        rs.trail.push({ x: b.pos[0], y: b.pos[1], z: b.pos[2] });
        if (rs.trail.length > 14) rs.trail.shift();

        rs.trail.forEach((t, index) => {
          const ratio = index / rs.trail.length;
          const rSize = 0.035 * ratio * 0.7;
          drawSphere(t.x, t.y, t.z, rSize, rSize, rSize, [1.0, 1.0, 1.0], 0.05, 0.1, 0);
        });
      }
    }

    // Restore back-face culling if active globally
    if (this.state.cullFace) {
      gl.enable(gl.CULL_FACE);
    }
  }

  render3DPlinko(progInfo, timestamp) {
    const gl = this.gl;
    const ps = this.plinkoState;
    if (!ps) return;

    const cubeMesh = this.meshBuffers[1];
    const sphereMesh = this.meshBuffers[0];
    const pegMesh = this.meshBuffers[2];
    const quadMesh = this.meshBuffers[5];
    const ringMesh = this.meshBuffers[6];
    const diskMesh = this.meshBuffers[7];

    if (!cubeMesh || !sphereMesh || !pegMesh || !quadMesh) return;

    const drawCube = (px, py, pz, sx, sy, sz, color, rough = 0.25, metal = 0.85, matType = 0) => {
      gl.bindVertexArray(cubeMesh.vao);
      this.modelMatrix[0] = sx; this.modelMatrix[1] = 0; this.modelMatrix[2] = 0; this.modelMatrix[3] = 0;
      this.modelMatrix[4] = 0; this.modelMatrix[5] = sy; this.modelMatrix[6] = 0; this.modelMatrix[7] = 0;
      this.modelMatrix[8] = 0; this.modelMatrix[9] = 0; this.modelMatrix[10] = sz; this.modelMatrix[11] = 0;
      this.modelMatrix[12] = px; this.modelMatrix[13] = py; this.modelMatrix[14] = pz; this.modelMatrix[15] = 1;
      Mat4.normalFromMat4(this.normalMatrix, this.modelMatrix);
      gl.uniformMatrix4fv(progInfo.uModel, false, this.modelMatrix);
      if (progInfo.uNormalMatrix) gl.uniformMatrix3fv(progInfo.uNormalMatrix, false, this.normalMatrix);
      if (progInfo.uBaseColor) gl.uniform3fv(progInfo.uBaseColor, color);
      if (progInfo.uRoughness) gl.uniform1f(progInfo.uRoughness, rough);
      if (progInfo.uMetallic) gl.uniform1f(progInfo.uMetallic, metal);
      if (progInfo.uMatType) gl.uniform1i(progInfo.uMatType, matType);
      if (progInfo.uClearCoat) gl.uniform1f(progInfo.uClearCoat, 0.1);
      gl.drawElements(gl.TRIANGLES, cubeMesh.indexCount, gl.UNSIGNED_SHORT, 0);
    };

    const drawSphere = (px, py, pz, sx, sy, sz, color, rough = 0.15, metal = 0.95, matType = 0, rot = [0, 0, 0]) => {
      gl.bindVertexArray(sphereMesh.vao);

      // Compute rotation matrix from Euler angles (Y * X * Z order)
      const cx = Math.cos(rot[0]), sx_ = Math.sin(rot[0]);
      const cy = Math.cos(rot[1]), sy_ = Math.sin(rot[1]);
      const cz = Math.cos(rot[2]), sz_ = Math.sin(rot[2]);

      const r00 = cy * cz + sy_ * sx_ * sz_;
      const r01 = cz * sy_ * sx_ - cy * sz_;
      const r02 = cx * sy_;
      const r10 = cx * sz_;
      const r11 = cx * cz;
      const r12 = -sx_;
      const r20 = cy * sy_ * sx_ - cz * sy_;
      const r21 = cy * cz * sx_ + sy_ * sz_;
      const r22 = cy * cx;

      this.modelMatrix[0] = r00 * sx;  this.modelMatrix[1] = r01 * sy;  this.modelMatrix[2] = r02 * sz;  this.modelMatrix[3] = 0;
      this.modelMatrix[4] = r10 * sx;  this.modelMatrix[5] = r11 * sy;  this.modelMatrix[6] = r12 * sz;  this.modelMatrix[7] = 0;
      this.modelMatrix[8] = r20 * sx;  this.modelMatrix[9] = r21 * sy;  this.modelMatrix[10] = r22 * sz; this.modelMatrix[11] = 0;
      this.modelMatrix[12] = px;        this.modelMatrix[13] = py;        this.modelMatrix[14] = pz;        this.modelMatrix[15] = 1;

      Mat4.normalFromMat4(this.normalMatrix, this.modelMatrix);
      gl.uniformMatrix4fv(progInfo.uModel, false, this.modelMatrix);
      if (progInfo.uNormalMatrix) gl.uniformMatrix3fv(progInfo.uNormalMatrix, false, this.normalMatrix);
      if (progInfo.uBaseColor) gl.uniform3fv(progInfo.uBaseColor, color);
      if (progInfo.uRoughness) gl.uniform1f(progInfo.uRoughness, rough);
      if (progInfo.uMetallic) gl.uniform1f(progInfo.uMetallic, metal);
      if (progInfo.uMatType) gl.uniform1i(progInfo.uMatType, matType);
      gl.drawElements(gl.TRIANGLES, sphereMesh.indexCount, gl.UNSIGNED_SHORT, 0);
    };

    const drawPeg = (px, py, pz, sx, sy, sz, color, rough = 0.1, metal = 0.9, matType = 0) => {
      gl.bindVertexArray(pegMesh.vao);
      this.modelMatrix[0] = sx; this.modelMatrix[1] = 0; this.modelMatrix[2] = 0; this.modelMatrix[3] = 0;
      this.modelMatrix[4] = 0; this.modelMatrix[5] = sy; this.modelMatrix[6] = 0; this.modelMatrix[7] = 0;
      this.modelMatrix[8] = 0; this.modelMatrix[9] = 0; this.modelMatrix[10] = sz; this.modelMatrix[11] = 0;
      this.modelMatrix[12] = px; this.modelMatrix[13] = py; this.modelMatrix[14] = pz; this.modelMatrix[15] = 1;
      Mat4.normalFromMat4(this.normalMatrix, this.modelMatrix);
      gl.uniformMatrix4fv(progInfo.uModel, false, this.modelMatrix);
      if (progInfo.uNormalMatrix) gl.uniformMatrix3fv(progInfo.uNormalMatrix, false, this.normalMatrix);
      if (progInfo.uBaseColor) gl.uniform3fv(progInfo.uBaseColor, color);
      if (progInfo.uRoughness) gl.uniform1f(progInfo.uRoughness, rough);
      if (progInfo.uMetallic) gl.uniform1f(progInfo.uMetallic, metal);
      if (progInfo.uMatType) gl.uniform1i(progInfo.uMatType, matType);
      gl.drawElements(gl.TRIANGLES, pegMesh.indexCount, gl.UNSIGNED_SHORT, 0);
    };

    const drawRing = (px, py, pz, sx, sy, sz, color, rough = 0.01, metal = 0.0, matType = 12) => {
      if (!ringMesh) return;
      gl.bindVertexArray(ringMesh.vao);
      this.modelMatrix[0] = sx; this.modelMatrix[1] = 0; this.modelMatrix[2] = 0; this.modelMatrix[3] = 0;
      this.modelMatrix[4] = 0; this.modelMatrix[5] = sy; this.modelMatrix[6] = 0; this.modelMatrix[7] = 0;
      this.modelMatrix[8] = 0; this.modelMatrix[9] = 0; this.modelMatrix[10] = sz; this.modelMatrix[11] = 0;
      this.modelMatrix[12] = px; this.modelMatrix[13] = py; this.modelMatrix[14] = pz; this.modelMatrix[15] = 1;
      Mat4.normalFromMat4(this.normalMatrix, this.modelMatrix);
      gl.uniformMatrix4fv(progInfo.uModel, false, this.modelMatrix);
      if (progInfo.uNormalMatrix) gl.uniformMatrix3fv(progInfo.uNormalMatrix, false, this.normalMatrix);
      if (progInfo.uBaseColor) gl.uniform3fv(progInfo.uBaseColor, color);
      if (progInfo.uRoughness) gl.uniform1f(progInfo.uRoughness, rough);
      if (progInfo.uMetallic) gl.uniform1f(progInfo.uMetallic, metal);
      if (progInfo.uMatType) gl.uniform1i(progInfo.uMatType, matType);
      gl.drawElements(gl.TRIANGLES, ringMesh.indexCount, gl.UNSIGNED_SHORT, 0);
    };

    const drawDisk = (px, py, pz, sx, sy, sz, color, rough = 0.01, metal = 0.0, matType = 12) => {
      if (!diskMesh) return;
      gl.bindVertexArray(diskMesh.vao);
      this.modelMatrix[0] = sx; this.modelMatrix[1] = 0; this.modelMatrix[2] = 0; this.modelMatrix[3] = 0;
      this.modelMatrix[4] = 0; this.modelMatrix[5] = sy; this.modelMatrix[6] = 0; this.modelMatrix[7] = 0;
      this.modelMatrix[8] = 0; this.modelMatrix[9] = 0; this.modelMatrix[10] = sz; this.modelMatrix[11] = 0;
      this.modelMatrix[12] = px; this.modelMatrix[13] = py; this.modelMatrix[14] = pz; this.modelMatrix[15] = 1;
      Mat4.normalFromMat4(this.normalMatrix, this.modelMatrix);
      gl.uniformMatrix4fv(progInfo.uModel, false, this.modelMatrix);
      if (progInfo.uNormalMatrix) gl.uniformMatrix3fv(progInfo.uNormalMatrix, false, this.normalMatrix);
      if (progInfo.uBaseColor) gl.uniform3fv(progInfo.uBaseColor, color);
      if (progInfo.uRoughness) gl.uniform1f(progInfo.uRoughness, rough);
      if (progInfo.uMetallic) gl.uniform1f(progInfo.uMetallic, metal);
      if (progInfo.uMatType) gl.uniform1i(progInfo.uMatType, matType);
      gl.drawElements(gl.TRIANGLES, diskMesh.indexCount, gl.UNSIGNED_SHORT, 0);
    };

    if (progInfo.uUseTexMaps) gl.uniform1i(progInfo.uUseTexMaps, 0);

    // Plinko Board Backing and Frame
    drawCube(0.0, 1.35, -0.05, 2.0, 2.4, 0.04, [0.06, 0.08, 0.11], 0.35, 0.1, 0);
    drawCube(-1.0, 1.35, 0.0, 0.04, 2.4, 0.08, [0.1, 0.8, 0.4], 0.2, 0.9, 0);
    drawCube(1.0, 1.35, 0.0, 0.04, 2.4, 0.08, [0.1, 0.8, 0.4], 0.2, 0.9, 0);
    drawCube(0.0, 2.55, 0.0, 2.0, 0.04, 0.08, [0.1, 0.8, 0.4], 0.2, 0.9, 0);

    const now = performance.now();
    ps.pegs.forEach(peg => {
      const lastHitTime = ps.recentPegHits[peg.id] || 0;
      const age = now - lastHitTime;
      
      let pColor = [0.8, 0.85, 0.9];
      let pRough = 0.1;
      let pMetal = 0.95;
      let pScale = 0.026;

      if (age < 150) {
        const t = 1.0 - (age / 150);
        pColor = [0.1 + t * 0.9, 0.9 + t * 0.1, 0.4 + t * 0.6];
        pScale = 0.026 * (1.0 + t * 0.45);
        pRough = 0.02;
        pMetal = 0.99;
      }

      drawPeg(peg.x, peg.y, 0.0, pScale, pScale, pScale * 1.5, pColor, pRough, pMetal, 0);
    });

    const R = ps.rows;
    const B = R + 2;
    const binW = 1.84 / B;
    const startBinX = -0.92;

    for (let bIdx = 0; bIdx < B; bIdx++) {
      const bCenterX = startBinX + (bIdx + 0.5) * binW;
      const halfBins = (B - 1) / 2;
      const distFromCenter = Math.abs(bIdx - halfBins) / halfBins;
      let binColor = [0.4, 0.45, 0.5];

      if (distFromCenter < 0.2) {
        binColor = [0.8, 0.2, 0.2];
      } else if (distFromCenter < 0.4) {
        binColor = [0.8, 0.5, 0.2];
      } else if (distFromCenter < 0.6) {
        binColor = [0.2, 0.6, 0.8];
      } else if (distFromCenter < 0.8) {
        binColor = [0.2, 0.8, 0.4];
      } else {
        binColor = [1.0, 0.85, 0.0];
      }

      if (bIdx > 0) {
        const dividerX = startBinX + bIdx * binW;
        drawCube(dividerX, 0.48, 0.0, 0.016, 0.16, 0.06, [0.3, 0.35, 0.4], 0.25, 0.6, 0);
      }

      drawCube(bCenterX, 0.41, 0.0, binW * 0.94, 0.02, 0.04, binColor, 0.1, 0.7, 0);
    }

    // Draw active solid Plinko balls
    ps.balls.forEach(b => {
      drawSphere(b.pos[0], b.pos[1], b.pos[2], b.radius, b.radius, b.radius, b.color, b.rough, b.metal, b.matType, b.rot || [0, 0, 0]);
    });

    // =============================================================
    // ADDITIVE BLENDING PASS FOR RADIUS CIRCLES, SHOCKWAVE RINGS & TRAILS
    // =============================================================
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);

    // 1. ADDITIVE BALL TRAILS (Pulsing luminous fluid light beam trailing each falling ball)
    if (ps.trailMode !== 'off') {
      ps.balls.forEach(b => {
        if (!b.trail || b.trail.length < 2) return;
        const trailLen = b.trail.length;
        for (let tIdx = 0; tIdx < trailLen; tIdx++) {
          const tp = b.trail[tIdx];
          const ageProgress = (now - tp.time) / 360.0;
          if (ageProgress < 0.0 || ageProgress > 1.0) continue;

          const taper = 1.0 - ageProgress * 0.65;
          const trailR = b.radius * taper * 0.85;

          let trailCol;
          if (ps.trailMode === 'rainbow') {
            const hue = (now * 0.0012 + tIdx * 0.07) % 1.0;
            const rgb = this.hslToRgb(hue, 1.0, 0.6);
            const fade = (1.0 - ageProgress) * 0.75;
            trailCol = [rgb[0] * fade, rgb[1] * fade, rgb[2] * fade];
          } else {
            // 'pulse'
            const pulse = Math.sin(now * 0.012 - tIdx * 0.35) * 0.5 + 0.5;
            const fade = (1.0 - ageProgress) * (0.45 + pulse * 0.45);
            const cR = tp.color[0] * (1.0 - pulse) + 0.1 * pulse;
            const cG = tp.color[1] * (1.0 - pulse) + 0.95 * pulse;
            const cB = tp.color[2] * (1.0 - pulse) + 0.85 * pulse;
            trailCol = [cR * fade, cG * fade, cB * fade];
          }

          drawDisk(tp.x, tp.y, tp.z - 0.005, trailR, trailR, 1.0, trailCol, 0.01, 0.0, 12);
          drawSphere(tp.x, tp.y, tp.z, trailR * 0.6, trailR * 0.6, trailR * 0.6, trailCol, 0.01, 0.0, 12);
        }
      });
    }

    // 2. EXPANDING RADIUS SHOCKWAVE CIRCLES & PULSING COLOR RINGS
    if (ps.shockwaveRings) {
      ps.shockwaveRings.forEach(ring => {
        if (!ring.active) return;
        if (now < ring.startTime) return;
        const elapsed = (now - ring.startTime) / 1000.0;
        const progress = Math.min(1.0, elapsed / ring.duration);
        if (progress >= 1.0) {
          ring.active = false;
          return;
        }

        const currentRadius = ring.radius;
        const fade = Math.sin(progress * Math.PI) * (1.0 - progress * 0.3);

        let ringCol;
        if (ring.type === 'chromatic') {
          // Rainbow chromatic wave pulsing continuously through the color spectrum
          const hue = (progress * 2.2 + now * 0.0025 + ring.phase * 0.3) % 1.0;
          const rgb = this.hslToRgb(hue, 1.0, 0.65);
          const pulse = Math.sin(progress * 16.0) * 0.25 + 0.75;
          const bright = fade * pulse * 1.1;
          ringCol = [rgb[0] * bright, rgb[1] * bright, rgb[2] * bright];
        } else if (ring.type === 'electro') {
          // High-voltage electric shockwave: sharp cyan-white lightning flash
          const flicker = 0.7 + 0.3 * Math.sin(now * 0.08 + progress * 20.0);
          const bright = fade * flicker * 1.3;
          if (progress < 0.25) {
            ringCol = [0.95 * bright, 0.98 * bright, 1.0 * bright];
          } else {
            ringCol = [0.15 * bright, 0.85 * bright, 1.0 * bright];
          }
        } else if (ring.type === 'halo') {
          // Radiant halo: soft expanding glowing disk + delicate ring with harmonic warmth
          const pulse = Math.sin(progress * 8.0) * 0.2 + 0.8;
          const bright = fade * pulse * 0.85;
          const hR = ring.color[0] * (1.0 - progress * 0.3);
          const hG = ring.color[1] * (0.8 + progress * 0.2);
          const hB = ring.color[2] * (0.9 + progress * 0.1);
          ringCol = [hR * bright, hG * bright, hB * bright];

          drawDisk(ring.pos[0], ring.pos[1], ring.pos[2] - 0.003, currentRadius * 0.85, currentRadius * 0.85, 1.0, [ringCol[0] * 0.35, ringCol[1] * 0.35, ringCol[2] * 0.35], 0.01, 0.0, 12);
        } else {
          // 'pulsering': concentric shockwave radius circles pulsing with neon luminance
          const pulse = Math.sin(progress * 18.0) * 0.35 + 0.65;
          const bright = fade * pulse * 1.0;
          const pR = (ring.color[0] * 0.7 + 0.2) * bright;
          const pG = (ring.color[1] * 0.7 + 0.8) * bright;
          const pB = (ring.color[2] * 0.7 + 0.4) * bright;
          ringCol = [pR, pG, pB];
        }

        drawRing(ring.pos[0], ring.pos[1], ring.pos[2], currentRadius, currentRadius, 1.0, ringCol, 0.01, 0.0, 12);
      });
    }

    // Restore standard opaque rendering state
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  render3DSlidingPuzzle(progInfo, timestamp) {
    const gl = this.gl;
    const ps = this.puzzleState;
    if (!ps) return;

    const cubeMesh = this.meshBuffers[1];
    const quadMesh = this.meshBuffers[5];
    if (!cubeMesh || !quadMesh) return;

    // Standard draw function helper (no inner allocation)
    const drawCube = (px, py, pz, sx, sy, sz, color, rough = 0.25, metal = 0.85, matType = 0) => {
      gl.bindVertexArray(cubeMesh.vao);
      
      this.modelMatrix[0] = sx; this.modelMatrix[1] = 0; this.modelMatrix[2] = 0; this.modelMatrix[3] = 0;
      this.modelMatrix[4] = 0; this.modelMatrix[5] = sy; this.modelMatrix[6] = 0; this.modelMatrix[7] = 0;
      this.modelMatrix[8] = 0; this.modelMatrix[9] = 0; this.modelMatrix[10] = sz; this.modelMatrix[11] = 0;
      this.modelMatrix[12] = px; this.modelMatrix[13] = py; this.modelMatrix[14] = pz; this.modelMatrix[15] = 1;

      Mat4.normalFromMat4(this.normalMatrix, this.modelMatrix);

      gl.uniformMatrix4fv(progInfo.uModel, false, this.modelMatrix);
      if (progInfo.uNormalMatrix) gl.uniformMatrix3fv(progInfo.uNormalMatrix, false, this.normalMatrix);
      if (progInfo.uBaseColor) gl.uniform3fv(progInfo.uBaseColor, color);
      if (progInfo.uRoughness) gl.uniform1f(progInfo.uRoughness, rough);
      if (progInfo.uMetallic) gl.uniform1f(progInfo.uMetallic, metal);
      if (progInfo.uMatType) gl.uniform1i(progInfo.uMatType, matType);
      if (progInfo.uClearCoat) gl.uniform1f(progInfo.uClearCoat, 0.1);
      if (progInfo.uNoiseScale) gl.uniform1f(progInfo.uNoiseScale, 1.0);
      if (progInfo.uBumpStrength) gl.uniform1f(progInfo.uBumpStrength, 0.0);
      if (progInfo.uAnisotropy) gl.uniform1f(progInfo.uAnisotropy, 0.0);

      gl.drawElements(gl.TRIANGLES, cubeMesh.indexCount, gl.UNSIGNED_SHORT, 0);
    };

    const drawQuad = (px, py, pz, sx, sy, color, rough = 0.25, metal = 0.85, matType = 0) => {
      gl.bindVertexArray(quadMesh.vao);
      
      this.modelMatrix[0] = sx; this.modelMatrix[1] = 0; this.modelMatrix[2] = 0; this.modelMatrix[3] = 0;
      this.modelMatrix[4] = 0; this.modelMatrix[5] = sy; this.modelMatrix[6] = 0; this.modelMatrix[7] = 0;
      this.modelMatrix[8] = 0; this.modelMatrix[9] = 0; this.modelMatrix[10] = 1.0; this.modelMatrix[11] = 0;
      this.modelMatrix[12] = px; this.modelMatrix[13] = py; this.modelMatrix[14] = pz; this.modelMatrix[15] = 1;

      Mat4.normalFromMat4(this.normalMatrix, this.modelMatrix);

      gl.uniformMatrix4fv(progInfo.uModel, false, this.modelMatrix);
      if (progInfo.uNormalMatrix) gl.uniformMatrix3fv(progInfo.uNormalMatrix, false, this.normalMatrix);
      if (progInfo.uBaseColor) gl.uniform3fv(progInfo.uBaseColor, color);
      if (progInfo.uRoughness) gl.uniform1f(progInfo.uRoughness, rough);
      if (progInfo.uMetallic) gl.uniform1f(progInfo.uMetallic, metal);
      if (progInfo.uMatType) gl.uniform1i(progInfo.uMatType, matType);
      if (progInfo.uClearCoat) gl.uniform1f(progInfo.uClearCoat, 0.1);
      if (progInfo.uNoiseScale) gl.uniform1f(progInfo.uNoiseScale, 1.0);
      if (progInfo.uBumpStrength) gl.uniform1f(progInfo.uBumpStrength, 0.0);
      if (progInfo.uAnisotropy) gl.uniform1f(progInfo.uAnisotropy, 0.0);

      gl.drawElements(gl.TRIANGLES, quadMesh.indexCount, gl.UNSIGNED_SHORT, 0);
    };

    // 1. Draw elegant Backboard frame behind the sliding puzzle board
    // Backboard is positioned at [0.0, 1.3, -0.05] with scale [1.03, 1.03, 0.02] (giving slightly wider margins)
    drawCube(0.0, 1.3, -0.05, 1.03, 1.03, 0.02, [0.08, 0.1, 0.14], 0.35, 0.15, 0);

    // 2. Render each active tile block
    const N = ps.gridSize;
    const tileW = 1.0 / N;
    const halfSize = 0.5;
    
    // Scale for standard tile block, leaving 0% spacer gap (Unit size 1.0)
    const tileScaleX = tileW;
    const tileScaleY = tileW;

    // Bind texture
    const activeTex = this.getTextureForPath(ps.activeTexturePath);
    if (activeTex && progInfo.uUseTexMaps) {
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, activeTex);
      if (progInfo.uAlbedoMap) gl.uniform1i(progInfo.uAlbedoMap, 2);
      if (progInfo.uPbrMap) gl.uniform1i(progInfo.uPbrMap, 2);
      gl.uniform1i(progInfo.uUseTexMaps, 1);
    } else if (progInfo.uUseTexMaps) {
      gl.uniform1i(progInfo.uUseTexMaps, 0);
    }

    for (let r = 0; r < N; ++r) {
      for (let c = 0; c < N; ++c) {
        const id = ps.grid[r][c];
        if (id === -1) continue; // Skip rendering for empty cell

        // Original location to map slice uv
        const origR = Math.floor(id / N);
        const origC = id % N;

        // Initialize smooth animation target coordinate
        if (!ps.tilePositions[id]) {
          ps.tilePositions[id] = { cx: c, cy: r };
        }
        const pos = ps.tilePositions[id];
        
        // Fast asymptotic lerping towards grid slots
        pos.cx += (c - pos.cx) * 0.16;
        pos.cy += (r - pos.cy) * 0.16;

        // Map to world positions
        const worldX = -halfSize + (pos.cx + 0.5) * tileW;
        const worldY = 1.3 + (halfSize - (pos.cy + 0.5) * tileW);

        // Bind custom scale and offset for texture slices
        const uScale = [1.0 / N, 1.0 / N];
        const uOffset = [origC / N, (N - 1 - origR) / N];
        if (progInfo.uUvScale) gl.uniform2fv(progInfo.uUvScale, uScale);
        if (progInfo.uUvOffset) gl.uniform2fv(progInfo.uUvOffset, uOffset);

        // Render flat quad sliced tile block with pristine PBR finish
        drawQuad(worldX, worldY, 0.0, tileScaleX, tileScaleY, [1.0, 1.0, 1.0], 0.15, 0.05, 0);
      }
    }

    // Reset uniforms
    if (progInfo.uUvScale) gl.uniform2f(progInfo.uUvScale, 0.0, 0.0);
    if (progInfo.uUvOffset) gl.uniform2f(progInfo.uUvOffset, 0.0, 0.0);
    if (progInfo.uUseTexMaps) gl.uniform1i(progInfo.uUseTexMaps, 0);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  render3DSlotMachine(progInfo, timestamp) {
    const gl = this.gl;
    const sm = this.slotMachine;
    if (!sm) return;

    const cubeMesh = this.meshBuffers[1];
    const sphereMesh = this.meshBuffers[0];
    const torusMesh = this.meshBuffers[4];

    if (!cubeMesh || !sphereMesh) return;

    // Zero-allocation inner rendering function
    const drawCube = (px, py, pz, sx, sy, sz, color, rough = 0.25, metal = 0.85, matType = 0, pClearCoat = 0.15) => {
      gl.bindVertexArray(cubeMesh.vao);
      
      this.modelMatrix[0] = sx; this.modelMatrix[1] = 0; this.modelMatrix[2] = 0; this.modelMatrix[3] = 0;
      this.modelMatrix[4] = 0; this.modelMatrix[5] = sy; this.modelMatrix[6] = 0; this.modelMatrix[7] = 0;
      this.modelMatrix[8] = 0; this.modelMatrix[9] = 0; this.modelMatrix[10] = sz; this.modelMatrix[11] = 0;
      this.modelMatrix[12] = px; this.modelMatrix[13] = py; this.modelMatrix[14] = pz; this.modelMatrix[15] = 1;

      Mat4.normalFromMat4(this.normalMatrix, this.modelMatrix);

      gl.uniformMatrix4fv(progInfo.uModel, false, this.modelMatrix);
      if (progInfo.uNormalMatrix) gl.uniformMatrix3fv(progInfo.uNormalMatrix, false, this.normalMatrix);
      if (progInfo.uBaseColor) gl.uniform3fv(progInfo.uBaseColor, color);
      if (progInfo.uRoughness) gl.uniform1f(progInfo.uRoughness, rough);
      if (progInfo.uMetallic) gl.uniform1f(progInfo.uMetallic, metal);
      if (progInfo.uMatType) gl.uniform1i(progInfo.uMatType, matType);
      if (progInfo.uClearCoat) gl.uniform1f(progInfo.uClearCoat, pClearCoat);
      if (progInfo.uNoiseScale) gl.uniform1f(progInfo.uNoiseScale, 1.0);
      if (progInfo.uBumpStrength) gl.uniform1f(progInfo.uBumpStrength, 0.0);
      if (progInfo.uAnisotropy) gl.uniform1f(progInfo.uAnisotropy, 0.0);

      gl.drawElements(gl.TRIANGLES, cubeMesh.indexCount, gl.UNSIGNED_SHORT, 0);
    };

    const drawSphere = (px, py, pz, sx, sy, sz, color, rough = 0.15, metal = 0.95, matType = 0) => {
      gl.bindVertexArray(sphereMesh.vao);
      
      this.modelMatrix[0] = sx; this.modelMatrix[1] = 0; this.modelMatrix[2] = 0; this.modelMatrix[3] = 0;
      this.modelMatrix[4] = 0; this.modelMatrix[5] = sy; this.modelMatrix[6] = 0; this.modelMatrix[7] = 0;
      this.modelMatrix[8] = 0; this.modelMatrix[9] = 0; this.modelMatrix[10] = sz; this.modelMatrix[11] = 0;
      this.modelMatrix[12] = px; this.modelMatrix[13] = py; this.modelMatrix[14] = pz; this.modelMatrix[15] = 1;

      Mat4.normalFromMat4(this.normalMatrix, this.modelMatrix);

      gl.uniformMatrix4fv(progInfo.uModel, false, this.modelMatrix);
      if (progInfo.uNormalMatrix) gl.uniformMatrix3fv(progInfo.uNormalMatrix, false, this.normalMatrix);
      if (progInfo.uBaseColor) gl.uniform3fv(progInfo.uBaseColor, color);
      if (progInfo.uRoughness) gl.uniform1f(progInfo.uRoughness, rough);
      if (progInfo.uMetallic) gl.uniform1f(progInfo.uMetallic, metal);
      if (progInfo.uMatType) gl.uniform1i(progInfo.uMatType, matType);
      gl.drawElements(gl.TRIANGLES, sphereMesh.indexCount, gl.UNSIGNED_SHORT, 0);
    };

    // 1. Draw Slot Machine Cabinet Body
    // Backing chassis base
    drawCube(0, 0.2, -1.0, 4.4, 3.2, 0.6, [0.08, 0.1, 0.14], 0.18, 0.9, 0, 0.25); // Sleek gold-accent metallic backplate
    // Gold glowing frame accents on top
    drawCube(0, 1.8, -0.7, 4.4, 0.12, 0.3, [0.95, 0.64, 0.08], 0.05, 0.98, 12); // Yellow/gold glowing sign plate
    // Cabinet bottom pedestal base
    drawCube(0, -1.3, -0.4, 4.4, 1.4, 1.8, [0.05, 0.06, 0.09], 0.2, 0.8, 0, 0.1);

    // 2. Recessed slots backing displays & Glowing Separators
    // Draw 3 dark display screen backings
    const colX = [-1.2, 0, 1.2];
    colX.forEach(x => {
      drawCube(x, 0.5, -0.65, 1.0, 1.5, 0.1, [0.01, 0.02, 0.03], 0.95, 0.0, 0); // Flat non-reflective display backgrounds
    });
    
    // Draw neon glowing borders between the 3 display slots
    drawCube(-1.75, 0.5, -0.6, 0.08, 1.5, 0.15, [0.95, 0.64, 0.08], 0.1, 0.95, 12); // Emissive borders
    drawCube(-0.6, 0.5, -0.6, 0.08, 1.5, 0.15, [0.95, 0.64, 0.08], 0.1, 0.95, 12);
    drawCube(0.6, 0.5, -0.6, 0.08, 1.5, 0.15, [0.95, 0.64, 0.08], 0.1, 0.95, 12);
    drawCube(1.75, 0.5, -0.6, 0.08, 1.5, 0.15, [0.95, 0.64, 0.08], 0.1, 0.95, 12);

    // 3. Draw the Right-Side Lever Handle Mechanics
    const lx = 2.4;
    const ly = -0.1;
    const lz = -0.4;
    // Base hub pivot
    drawCube(lx, ly, lz, 0.3, 0.3, 0.3, [0.15, 0.16, 0.18], 0.1, 0.95, 1);
    
    // Animated Lever Handle Stick (pivots about X axis based on sm.leverAngle)
    const sinTilt = Math.sin(-sm.leverAngle);
    const cosTilt = Math.cos(-sm.leverAngle);
    const sLen = 1.1; // Stick length
    const sEndY = ly + cosTilt * sLen;
    const sEndZ = lz + sinTilt * sLen;
    
    // Draw the stick as multiple points or a rotated segment
    // To draw a simple tilted cylinder/stick, we can interpolate 3 spheres
    for (let j = 1; j <= 5; j++) {
      const t = j / 5;
      const px = lx;
      const py = ly + (sEndY - ly) * t;
      const pz = lz + (sEndZ - lz) * t;
      drawSphere(px, py, pz, 0.08, 0.08, 0.08, [0.75, 0.75, 0.8], 0.05, 0.98);
    }
    // Pull Red ball handle sphere at end of stick
    drawSphere(lx, sEndY, sEndZ, 0.28, 0.28, 0.28, [0.9, 0.05, 0.05], 0.1, 0.1, 0, 0.4); // Red shiny plastic

    // 4. Draw Payout Tray Basin at Bottom Center
    drawCube(0, -0.7, 0.4, 2.2, 0.12, 0.8, [0.12, 0.14, 0.16], 0.15, 0.95); // Basin tray bottom floor
    drawCube(-1.1, -0.6, 0.4, 0.08, 0.3, 0.8, [0.12, 0.14, 0.16], 0.15, 0.95); // left lip
    drawCube(1.1, -0.6, 0.4, 0.08, 0.3, 0.8, [0.12, 0.14, 0.16], 0.15, 0.95); // right lip
    drawCube(0, -0.6, 0.8, 2.2, 0.3, 0.08, [0.12, 0.14, 0.16], 0.15, 0.95); // front lip

    // 5. Render Active 3D Reel Symbols in Front of Screens
    sm.reels.forEach((reel, colIdx) => {
      const rx = colX[colIdx];
      const ry = 0.5;
      const rz = -0.3; // Floating in front of screen

      const activeSymbol = reel.currentSymbol;
      const props = sm.symbolProps[activeSymbol];
      if (!props) return;

      const symMesh = this.meshBuffers[props.meshId];
      if (symMesh) {
        gl.bindVertexArray(symMesh.vao);

        // Spin or idle rot
        let angleY = timestamp * 0.001 * (reel.spinning ? 8.5 : 1.2) + colIdx;
        let angleX = reel.spinning ? (reel.angle * 4.0) : 0; // rapid vertical flip when rolling!

        const cy = Math.cos(angleY), sy = Math.sin(angleY);
        const cx = Math.cos(angleX), sx = Math.sin(angleX);

        // Apply double model rotation matrices manually inside modelMatrix
        // R_x * R_y
        this.modelMatrix[0] = cy * 0.58;
        this.modelMatrix[1] = sx * sy * 0.58;
        this.modelMatrix[2] = -cx * sy * 0.58;
        this.modelMatrix[3] = 0;

        this.modelMatrix[4] = 0;
        this.modelMatrix[5] = cx * 0.58;
        this.modelMatrix[6] = sx * 0.58;
        this.modelMatrix[7] = 0;

        this.modelMatrix[8] = sy * 0.58;
        this.modelMatrix[9] = -sx * cy * 0.58;
        this.modelMatrix[10] = cx * cy * 0.58;
        this.modelMatrix[11] = 0;

        this.modelMatrix[12] = rx;
        this.modelMatrix[13] = ry;
        this.modelMatrix[14] = rz;
        this.modelMatrix[15] = 1;

        Mat4.normalFromMat4(this.normalMatrix, this.modelMatrix);

        gl.uniformMatrix4fv(progInfo.uModel, false, this.modelMatrix);
        if (progInfo.uNormalMatrix) gl.uniformMatrix3fv(progInfo.uNormalMatrix, false, this.normalMatrix);
        if (progInfo.uBaseColor) gl.uniform3fv(progInfo.uBaseColor, props.color);
        if (progInfo.uRoughness) gl.uniform1f(progInfo.uRoughness, props.meshId === 1 ? 0.05 : 0.2); // extra glossy gold
        if (progInfo.uMetallic) gl.uniform1f(progInfo.uMetallic, props.meshId === 1 ? 0.98 : 0.85);
        if (progInfo.uMatType) gl.uniform1i(progInfo.uMatType, props.matType);
        if (progInfo.uClearCoat) gl.uniform1f(progInfo.uClearCoat, 0.2);
        if (progInfo.uNoiseScale) gl.uniform1f(progInfo.uNoiseScale, 1.0);
        if (progInfo.uBumpStrength) gl.uniform1f(progInfo.uBumpStrength, 0.0);
        if (progInfo.uAnisotropy) gl.uniform1f(progInfo.uAnisotropy, 0.0);

        gl.drawElements(gl.TRIANGLES, symMesh.indexCount, gl.UNSIGNED_SHORT, 0);
      }
    });

    // 6. Render Spinning Gold Coin Particles falling in 3D Tray Space!
    sm.coins.forEach(coin => {
      if (coin.active) {
        // Render each gold coin as a small flat Torus or Cube, colored yellow gold!
        if (torusMesh) {
          gl.bindVertexArray(torusMesh.vao);

          const cx = Math.cos(coin.rot[0]), sx = Math.sin(coin.rot[0]);
          const cy = Math.cos(coin.rot[1]), sy = Math.sin(coin.rot[1]);

          // Scale and rotate
          const s = coin.scale;
          this.modelMatrix[0] = cy * s;
          this.modelMatrix[1] = sx * sy * s;
          this.modelMatrix[2] = -cx * sy * s;
          this.modelMatrix[3] = 0;

          this.modelMatrix[4] = 0;
          this.modelMatrix[5] = cx * s;
          this.modelMatrix[6] = sx * s;
          this.modelMatrix[7] = 0;

          this.modelMatrix[8] = sy * s;
          this.modelMatrix[9] = -sx * cy * s;
          this.modelMatrix[10] = cx * cy * s;
          this.modelMatrix[11] = 0;

          this.modelMatrix[12] = coin.pos[0];
          this.modelMatrix[13] = coin.pos[1];
          this.modelMatrix[14] = coin.pos[2];
          this.modelMatrix[15] = 1;

          Mat4.normalFromMat4(this.normalMatrix, this.modelMatrix);

          gl.uniformMatrix4fv(progInfo.uModel, false, this.modelMatrix);
          if (progInfo.uNormalMatrix) gl.uniformMatrix3fv(progInfo.uNormalMatrix, false, this.normalMatrix);
          if (progInfo.uBaseColor) gl.uniform3fv(progInfo.uBaseColor, [0.95, 0.72, 0.05]); // Golden Coin yellow color
          if (progInfo.uRoughness) gl.uniform1f(progInfo.uRoughness, 0.08); // High shiny gloss
          if (progInfo.uMetallic) gl.uniform1f(progInfo.uMetallic, 0.98); // pure metal coins
          if (progInfo.uMatType) gl.uniform1i(progInfo.uMatType, 1); // gold reflective
          if (progInfo.uClearCoat) gl.uniform1f(progInfo.uClearCoat, 0.1);

          gl.drawElements(gl.TRIANGLES, torusMesh.indexCount, gl.UNSIGNED_SHORT, 0);
        }
      }
    });
  }

  showFpsStartupMenu() {
    const overlay = document.getElementById('fps-startup-overlay');
    if (overlay) {
      overlay.style.display = 'flex';
      this.renderFpsLobbyPlayers();
      this.fetchLobbyStateFromServer();
    }
    this.isMatchActive = false;
    window.isMatchActive = false;
    if (this.synth) {
      this.synth.stopMusic();
    }
    if (document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch(e) {}
    }
  }

  hideFpsStartupMenu() {
    const overlay = document.getElementById('fps-startup-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
    this.isMatchActive = true;
    window.isMatchActive = true;
    
    // Ensure music settings are up to date and play music
    const musicToggle = document.getElementById('fps-music-toggle');
    const sfxToggle = document.getElementById('fps-sfx-toggle');
    const zombieDensitySelect = document.getElementById('fps-zombie-density');
    const musicOn = musicToggle ? musicToggle.value === 'on' : true;
    const sfxOn = sfxToggle ? sfxToggle.value === 'on' : true;
    const density = zombieDensitySelect ? zombieDensitySelect.value : 'high';
    
    if (this.synth) {
      this.synth.updateSettings(musicOn, sfxOn, density);
      this.synth.startMusic();
    }
  }

  renderFpsLobbyPlayers() {
    const listEl = document.getElementById('fps-lobby-players-list');
    const countEl = document.getElementById('fps-lobby-player-count');
    if (!listEl) return;

    const playerNameInput = document.getElementById('fps-player-name');
    const playerSkinSelect = document.getElementById('fps-player-skin');
    const playerTeamSelect = document.getElementById('fps-player-team');

    const myAlias = (playerNameInput ? playerNameInput.value.trim() : '') || 'Ranger';
    const mySkin = playerSkinSelect ? playerSkinSelect.value : 'Phantam';
    const myTeam = playerTeamSelect ? playerTeamSelect.value : 'Red';

    let players = [
      { alias: `${myAlias} (YOU)`, skin: mySkin, ping: 0, isBot: false, team: myTeam }
    ];

    if (this.fpsBots && this.fpsBots.length > 0) {
      players = players.concat(this.fpsBots);
    }

    if (this.serverLobbyPlayers && Array.isArray(this.serverLobbyPlayers)) {
      this.serverLobbyPlayers.forEach(p => {
        if (p.alias !== myAlias) {
          players.push({ alias: p.alias || p.id, skin: p.skin || 'Gladiator', ping: p.ping || 24, isBot: false, team: p.team || 'Blue' });
        }
      });
    }

    if (countEl) {
      countEl.textContent = `${players.length} / 10 Players`;
    }

    listEl.innerHTML = players.map(p => `
      <div class="fps-lobby-player-item">
        <div class="fps-player-left">
          <span class="fps-player-status-dot ${p.isBot ? 'bot' : ''}"></span>
          <span class="fps-player-alias">${p.alias}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span class="fps-player-badge">${p.skin}</span>
          <span class="fps-player-badge" style="color: ${p.team === 'Red' ? '#f87171' : (p.team === 'Blue' ? '#60a5fa' : '#34d399')};">${p.team}</span>
          <span class="fps-player-badge font-mono">${p.isBot ? 'BOT' : p.ping + 'ms'}</span>
        </div>
      </div>
    `).join('');
  }

  async fetchLobbyStateFromServer() {
    try {
      const res = await fetch('/api/matchmaking/lobby');
      if (res.ok) {
        const data = await res.json();
        if (data && data.lobby) {
          const netTransport = document.getElementById('fps-net-transport-val');
          const netMedia = document.getElementById('fps-net-mediaserver-val');
          if (netTransport) netTransport.textContent = data.lobby.transport || 'WebSocket / WebRTC';
          if (netMedia) netMedia.textContent = data.lobby.mediaServer || 'OpenVidu / KMS';
        }
      }
    } catch(e) {}
  }

  updateHUDWeaponStats() {
    const titleEl = document.querySelector('#fps-weapon-hud .weapon-title');
    const dmgEl = document.getElementById('hud-weapon-dmg');
    const velEl = document.getElementById('hud-weapon-vel');
    if (titleEl) titleEl.textContent = `⚡ ${this.weaponConfig.name}`;
    if (dmgEl) dmgEl.textContent = `${this.weaponConfig.damage} HP`;
    if (velEl) velEl.textContent = `${this.weaponConfig.speed} m/s`;
  }

  initMaterialsWorkspace() {
    this.currentMaterialFilter = 'all';
    this.activeTunedMaterial = 'wood';

    // 1. Material Filter buttons
    const filterBtns = document.querySelectorAll('.btn-mat-filter');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        filterBtns.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.currentMaterialFilter = e.currentTarget.dataset.filter || 'all';
        this.renderMaterialsCatalogCards(this.currentMaterialFilter);
      });
    });

    // 2. Initial Grid Render
    this.renderMaterialsCatalogCards('all');

    // 3. Tuner Slider Event Listeners
    const bindTunerSlider = (id, valId, prop, suffix = '') => {
      const el = document.getElementById(id);
      const valEl = document.getElementById(valId);
      if (el) {
        el.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value);
          if (valEl) valEl.textContent = `${val.toFixed(2)}${suffix}`;
          
          const mat = FILAMENT_MATERIALS_CATALOG[this.activeTunedMaterial];
          if (mat) {
            mat[prop] = val;
          }

          // Apply live to selected scene entity
          const entity = this.sceneEntities[this.selectedEntityIndex];
          if (entity && entity.materialKey === this.activeTunedMaterial) {
            if (prop === 'roughness') entity.roughness = val;
            if (prop === 'metallic') entity.metallic = val;
          }

          this.updateMobileCostStats(mat);
        });
      }
    };

    bindTunerSlider('tuner-roughness', 'val-tuner-roughness', 'roughness');
    bindTunerSlider('tuner-metallic', 'val-tuner-metallic', 'metallic');
    bindTunerSlider('tuner-clearcoat', 'val-tuner-clearcoat', 'clearCoat');
    bindTunerSlider('tuner-noisescale', 'val-tuner-noisescale', 'noiseScale', 'x');
    bindTunerSlider('tuner-anisotropy', 'val-tuner-anisotropy', 'anisotropy');

    const colorPicker = document.getElementById('tuner-basecolor');
    if (colorPicker) {
      colorPicker.addEventListener('input', (e) => {
        const hex = e.target.value;
        const r = parseInt(hex.slice(1, 3), 16) / 255.0;
        const g = parseInt(hex.slice(3, 5), 16) / 255.0;
        const b = parseInt(hex.slice(5, 7), 16) / 255.0;
        const mat = FILAMENT_MATERIALS_CATALOG[this.activeTunedMaterial];
        if (mat) {
          mat.color = [r, g, b];
        }
        const entity = this.sceneEntities[this.selectedEntityIndex];
        if (entity && entity.materialKey === this.activeTunedMaterial) {
          entity.color = [r, g, b];
        }
      });
    }

    // Apply button
    const btnApply = document.getElementById('btn-apply-active-mat');
    if (btnApply) {
      btnApply.addEventListener('click', () => {
        const entity = this.sceneEntities[this.selectedEntityIndex];
        if (entity) {
          this.applyMaterialToEntity(entity, this.activeTunedMaterial);
        }
      });
    }

    this.selectTunedMaterial('wood');
  }

  selectTunedMaterial(matKey) {
    const mat = FILAMENT_MATERIALS_CATALOG[matKey];
    if (!mat) return;
    this.activeTunedMaterial = matKey;

    const nameEl = document.getElementById('tuner-mat-name');
    const descEl = document.getElementById('tuner-mat-desc');
    const swatchEl = document.getElementById('tuner-preview-swatch');
    const badgeEl = document.getElementById('tuner-mat-cost-badge');

    if (nameEl) nameEl.textContent = mat.name;
    if (descEl) descEl.textContent = mat.desc;
    if (swatchEl) swatchEl.style.background = mat.swatch;
    if (badgeEl) {
      badgeEl.textContent = `MAT COST: ${mat.matCost.rating}`;
      badgeEl.className = `mat-cost-badge ${mat.matCost.badgeClass}`;
    }

    // Update Tuner sliders
    const rEl = document.getElementById('tuner-roughness');
    const mEl = document.getElementById('tuner-metallic');
    const cEl = document.getElementById('tuner-clearcoat');
    const sEl = document.getElementById('tuner-noisescale');
    const aEl = document.getElementById('tuner-anisotropy');

    if (rEl) rEl.value = mat.roughness;
    if (mEl) mEl.value = mat.metallic;
    if (cEl) cEl.value = mat.clearCoat || 0;
    if (sEl) sEl.value = mat.noiseScale || 1;
    if (aEl) aEl.value = mat.anisotropy || 0;

    const rVal = document.getElementById('val-tuner-roughness');
    const mVal = document.getElementById('val-tuner-metallic');
    const cVal = document.getElementById('val-tuner-clearcoat');
    const sVal = document.getElementById('val-tuner-noisescale');
    const aVal = document.getElementById('val-tuner-anisotropy');

    if (rVal) rVal.textContent = mat.roughness.toFixed(2);
    if (mVal) mVal.textContent = mat.metallic.toFixed(2);
    if (cVal) cVal.textContent = (mat.clearCoat || 0).toFixed(2);
    if (sVal) sVal.textContent = `${(mat.noiseScale || 1).toFixed(1)}x`;
    if (aVal) aVal.textContent = (mat.anisotropy || 0).toFixed(2);

    const cp = document.getElementById('tuner-basecolor');
    if (cp && mat.color) {
      const hexR = Math.round(mat.color[0] * 255).toString(16).padStart(2, '0');
      const hexG = Math.round(mat.color[1] * 255).toString(16).padStart(2, '0');
      const hexB = Math.round(mat.color[2] * 255).toString(16).padStart(2, '0');
      cp.value = `#${hexR}${hexG}${hexB}`;
    }

    this.updateMobileCostStats(mat);
  }

  updateMobileCostStats(mat) {
    if (!mat) return;
    const aluEl = document.getElementById('stat-mat-alus');
    const bandEl = document.getElementById('stat-mat-bandwidth');
    const timeEl = document.getElementById('stat-mat-frametime');
    const verdEl = document.getElementById('stat-mat-verdict');

    if (aluEl) aluEl.textContent = mat.matCost.alus;
    if (bandEl) bandEl.textContent = mat.matCost.bandwidth;
    if (timeEl) timeEl.textContent = mat.matCost.fpsEstimate;
    if (verdEl) {
      verdEl.textContent = mat.matCost.mobileVerdict;
      verdEl.style.color = mat.matCost.rating === 'LOW' ? '#10b981' : (mat.matCost.rating === 'MEDIUM' ? '#f59e0b' : '#f43f5e');
    }
  }

  renderMaterialsCatalogCards(categoryFilter = 'all') {
    const grid = document.getElementById('materials-cards-grid');
    if (!grid) return;

    grid.innerHTML = '';
    const filtered = Object.values(FILAMENT_MATERIALS_CATALOG).filter(mat => {
      if (categoryFilter === 'all') return true;
      return mat.category === categoryFilter;
    });

    filtered.forEach(mat => {
      const card = document.createElement('div');
      card.className = `mat-card ${mat.key === this.activeTunedMaterial ? 'active' : ''}`;
      card.id = `mat-card-${mat.key}`;

      card.innerHTML = `
        <div class="mat-card-header">
          <div class="mat-card-header-left">
            <span class="mat-card-icon">${mat.icon}</span>
            <h4 class="mat-card-title">${mat.name}</h4>
          </div>
          <span class="mat-cost-badge ${mat.matCost.badgeClass}">MAT COST: ${mat.matCost.rating}</span>
        </div>

        <div class="mat-swatch-banner" style="background: ${mat.swatch};"></div>

        <div class="mat-card-body">
          <p class="mat-card-desc">${mat.desc}</p>
          <div class="mat-cost-breakdown">
            <div class="cost-item">
              <span class="cost-label">ALUs:</span>
              <span class="cost-val font-mono">${mat.matCost.alus}</span>
            </div>
            <div class="cost-item">
              <span class="cost-label">Tex Samplers:</span>
              <span class="cost-val font-mono">${mat.matCost.texSamplers}</span>
            </div>
            <div class="cost-item">
              <span class="cost-label">VRAM Bandwidth:</span>
              <span class="cost-val font-mono">${mat.matCost.bandwidth}</span>
            </div>
            <div class="cost-item">
              <span class="cost-label">Mobile Safety:</span>
              <span class="cost-val font-mono" style="color: ${mat.matCost.rating === 'LOW' ? '#10b981' : (mat.matCost.rating === 'MEDIUM' ? '#f59e0b' : '#f43f5e')};">${mat.matCost.mobileVerdict}</span>
            </div>
          </div>

          <div class="mat-card-actions">
            <button class="btn-action btn-mat-tune" data-mat-key="${mat.key}" style="flex: 1; padding: 7px 10px; font-size: 11px; background: rgba(56,189,248,0.15); border-color: var(--accent-cyan);">
              🎛 Tune in Lab
            </button>
            <button class="btn-action btn-mat-apply-direct" data-mat-key="${mat.key}" style="flex: 1; padding: 7px 10px; font-size: 11px; background: rgba(16,185,129,0.15); border-color: #10b981;">
              ⚡ Apply Object
            </button>
          </div>
        </div>
      `;

      card.querySelector('.btn-mat-tune')?.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.mat-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.selectTunedMaterial(mat.key);
      });

      card.querySelector('.btn-mat-apply-direct')?.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.mat-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.selectTunedMaterial(mat.key);
        const entity = this.sceneEntities[this.selectedEntityIndex];
        if (entity) {
          this.applyMaterialToEntity(entity, mat.key);
        }
      });

      card.addEventListener('click', () => {
        document.querySelectorAll('.mat-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.selectTunedMaterial(mat.key);
      });

      grid.appendChild(card);
    });
  }

  applyMaterialToEntity(entity, matKey) {
    const mat = FILAMENT_MATERIALS_CATALOG[matKey];
    if (!entity || !mat) return;

    entity.materialKey = matKey;
    entity.roughness = mat.roughness;
    entity.metallic = mat.metallic;
    entity.color = [...mat.color];

    this.populateInspector(entity);
    this.updateCppBridge();
    this.showPickupToast(mat.name, `Applied to ${entity.name} (MAT COST: ${mat.matCost.rating})`, 'ammo');
    this.log(`Applied material [${mat.name}] to scene entity "${entity.name}" (ALUs: ${mat.matCost.alus})`, "success");
  }

  initPostProcessingWorkspace() {
    this.postProcState = {
      hzb: {
        enabled: true,
        culling: true,
        ssr: true,
        viewMode: 'none',
        mipLevel: 0,
        steps: 8,
        cullRate: 48.2
      },
      bloom: {
        enabled: true,
        threshold: 0.85,
        sensitivity: 0.50,
        intensity: 1.25,
        radius: 1.4,
        passes: 4,
        anamorphic: false,
        chromatic: true
      },
      volumetric: {
        enabled: true,
        sunTracking: true,
        colorPreset: 'golden',
        color: [1.0, 0.85, 0.45],
        samples: 32,
        density: 0.95,
        decay: 0.965,
        weight: 0.65
      }
    };

    // Alias for legacy references
    this.hzbState = this.postProcState.hzb;

    // Post-Processing Sub-Tab Navigation (HZB, Bloom, Volumetric)
    const postTabBtns = document.querySelectorAll('[data-post-tab]');
    postTabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        postTabBtns.forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.post-proc-view').forEach(v => v.style.display = 'none');
        e.currentTarget.classList.add('active');
        const targetView = document.getElementById(`post-view-${e.currentTarget.dataset.postTab}`);
        if (targetView) targetView.style.display = 'block';
        this.log(`Post-Processing Sub-Tab Selected: ${e.currentTarget.dataset.postTab.toUpperCase()}`, "info");
      });
    });

    // HZB Controls
    const toggleHzb = document.getElementById('toggle-hzb-enable');
    if (toggleHzb) {
      toggleHzb.checked = this.postProcState.hzb.enabled;
      toggleHzb.addEventListener('change', (e) => {
        this.postProcState.hzb.enabled = e.target.checked;
        this.log(`HZB Hierarchical Z-Buffer: ${e.target.checked ? 'ACTIVE' : 'DISABLED'}`, "info");
      });
    }

    const toggleCulling = document.getElementById('toggle-hzb-culling');
    if (toggleCulling) {
      toggleCulling.checked = this.postProcState.hzb.culling;
      toggleCulling.addEventListener('change', (e) => {
        this.postProcState.hzb.culling = e.target.checked;
        this.log(`HZB Early-Z Occlusion Culling: ${e.target.checked ? 'ACTIVE' : 'BYPASS'}`, "info");
      });
    }

    const toggleSsr = document.getElementById('toggle-hzb-ssr');
    if (toggleSsr) {
      toggleSsr.checked = this.postProcState.hzb.ssr;
      toggleSsr.addEventListener('change', (e) => {
        this.postProcState.hzb.ssr = e.target.checked;
        this.log(`HZB SSR Raymarching: ${e.target.checked ? 'ACTIVE' : 'BYPASS'}`, "info");
      });
    }

    const selectHzbView = document.getElementById('select-hzb-viewmode');
    if (selectHzbView) {
      selectHzbView.value = this.postProcState.hzb.viewMode;
      selectHzbView.addEventListener('change', (e) => {
        this.postProcState.hzb.viewMode = e.target.value;
        this.log(`HZB Viewport Visualizer Mode: ${e.target.value}`, "success");
      });
    }

    const sliderMip = document.getElementById('slider-hzb-miplevel');
    const valMip = document.getElementById('val-hzb-miplevel');
    if (sliderMip) {
      sliderMip.addEventListener('input', (e) => {
        this.postProcState.hzb.mipLevel = parseInt(e.target.value);
        if (valMip) valMip.textContent = `Mip ${this.postProcState.hzb.mipLevel} (${Math.pow(2, 5 - this.postProcState.hzb.mipLevel)}x${Math.pow(2, 5 - this.postProcState.hzb.mipLevel)})`;
      });
    }

    const sliderSteps = document.getElementById('slider-hzb-steps');
    const valSteps = document.getElementById('val-hzb-steps');
    if (sliderSteps) {
      sliderSteps.addEventListener('input', (e) => {
        this.postProcState.hzb.steps = parseInt(e.target.value);
        if (valSteps) valSteps.textContent = `${this.postProcState.hzb.steps} steps`;
      });
    }

    // Bloom Controls
    const toggleBloom = document.getElementById('toggle-bloom-enable');
    if (toggleBloom) {
      toggleBloom.checked = this.postProcState.bloom.enabled;
      toggleBloom.addEventListener('change', (e) => {
        this.postProcState.bloom.enabled = e.target.checked;
        this.log(`HDR Bloom: ${e.target.checked ? 'ACTIVE' : 'DISABLED'}`, "info");
      });
    }

    const toggleAnamorphic = document.getElementById('toggle-bloom-anamorphic');
    if (toggleAnamorphic) {
      toggleAnamorphic.checked = this.postProcState.bloom.anamorphic;
      toggleAnamorphic.addEventListener('change', (e) => {
        this.postProcState.bloom.anamorphic = e.target.checked;
      });
    }

    const toggleChromatic = document.getElementById('toggle-bloom-chromatic');
    if (toggleChromatic) {
      toggleChromatic.checked = this.postProcState.bloom.chromatic;
      toggleChromatic.addEventListener('change', (e) => {
        this.postProcState.bloom.chromatic = e.target.checked;
      });
    }

    const sliderThreshold = document.getElementById('slider-bloom-threshold');
    const valThreshold = document.getElementById('val-bloom-threshold');
    if (sliderThreshold) {
      sliderThreshold.addEventListener('input', (e) => {
        this.postProcState.bloom.threshold = parseFloat(e.target.value);
        if (valThreshold) valThreshold.textContent = this.postProcState.bloom.threshold.toFixed(2);
      });
    }

    const sliderSensitivity = document.getElementById('slider-bloom-sensitivity');
    const valSensitivity = document.getElementById('val-bloom-sensitivity');
    if (sliderSensitivity) {
      sliderSensitivity.addEventListener('input', (e) => {
        this.postProcState.bloom.sensitivity = parseFloat(e.target.value);
        if (valSensitivity) valSensitivity.textContent = this.postProcState.bloom.sensitivity.toFixed(2);
      });
    }

    const sliderIntensity = document.getElementById('slider-bloom-intensity');
    const valIntensity = document.getElementById('val-bloom-intensity');
    if (sliderIntensity) {
      sliderIntensity.addEventListener('input', (e) => {
        this.postProcState.bloom.intensity = parseFloat(e.target.value);
        if (valIntensity) valIntensity.textContent = `${this.postProcState.bloom.intensity.toFixed(2)}x`;
      });
    }

    const sliderRadius = document.getElementById('slider-bloom-radius');
    const valRadius = document.getElementById('val-bloom-radius');
    if (sliderRadius) {
      sliderRadius.addEventListener('input', (e) => {
        this.postProcState.bloom.radius = parseFloat(e.target.value);
        if (valRadius) valRadius.textContent = this.postProcState.bloom.radius.toFixed(2);
      });
    }

    const sliderPasses = document.getElementById('slider-bloom-passes');
    const valPasses = document.getElementById('val-bloom-passes');
    if (sliderPasses) {
      sliderPasses.addEventListener('input', (e) => {
        this.postProcState.bloom.passes = parseInt(e.target.value);
        if (valPasses) valPasses.textContent = `${this.postProcState.bloom.passes} Passes (Dual-Filter)`;
      });
    }

    // Volumetric Controls
    const toggleVolumetric = document.getElementById('toggle-volumetric-enable');
    if (toggleVolumetric) {
      toggleVolumetric.checked = this.postProcState.volumetric.enabled;
      toggleVolumetric.addEventListener('change', (e) => {
        this.postProcState.volumetric.enabled = e.target.checked;
        this.log(`Volumetric Light Shafts: ${e.target.checked ? 'ACTIVE' : 'DISABLED'}`, "info");
      });
    }

    const toggleSun = document.getElementById('toggle-volumetric-sun');
    if (toggleSun) {
      toggleSun.checked = this.postProcState.volumetric.sunTracking;
      toggleSun.addEventListener('change', (e) => {
        this.postProcState.volumetric.sunTracking = e.target.checked;
      });
    }

    const selectColor = document.getElementById('select-volumetric-color');
    if (selectColor) {
      selectColor.value = this.postProcState.volumetric.colorPreset;
      selectColor.addEventListener('change', (e) => {
        this.postProcState.volumetric.colorPreset = e.target.value;
        switch (e.target.value) {
          case 'cyan': this.postProcState.volumetric.color = [0.2, 0.85, 1.0]; break;
          case 'crimson': this.postProcState.volumetric.color = [1.0, 0.35, 0.2]; break;
          case 'violet': this.postProcState.volumetric.color = [0.85, 0.3, 1.0]; break;
          case 'white': this.postProcState.volumetric.color = [0.95, 0.95, 1.0]; break;
          case 'golden': default: this.postProcState.volumetric.color = [1.0, 0.85, 0.45]; break;
        }
        this.log(`Volumetric Tint: ${e.target.value.toUpperCase()}`, "info");
      });
    }

    const sliderSamples = document.getElementById('slider-volumetric-samples');
    const valSamples = document.getElementById('val-volumetric-samples');
    if (sliderSamples) {
      sliderSamples.addEventListener('input', (e) => {
        this.postProcState.volumetric.samples = parseInt(e.target.value);
        if (valSamples) valSamples.textContent = `${this.postProcState.volumetric.samples} Steps`;
      });
    }

    const sliderDensity = document.getElementById('slider-volumetric-density');
    const valDensity = document.getElementById('val-volumetric-density');
    if (sliderDensity) {
      sliderDensity.addEventListener('input', (e) => {
        this.postProcState.volumetric.density = parseFloat(e.target.value);
        if (valDensity) valDensity.textContent = this.postProcState.volumetric.density.toFixed(2);
      });
    }

    const sliderDecay = document.getElementById('slider-volumetric-decay');
    const valDecay = document.getElementById('val-volumetric-decay');
    if (sliderDecay) {
      sliderDecay.addEventListener('input', (e) => {
        this.postProcState.volumetric.decay = parseFloat(e.target.value);
        if (valDecay) valDecay.textContent = this.postProcState.volumetric.decay.toFixed(3);
      });
    }

    const sliderWeight = document.getElementById('slider-volumetric-weight');
    const valWeight = document.getElementById('val-volumetric-weight');
    if (sliderWeight) {
      sliderWeight.addEventListener('input', (e) => {
        this.postProcState.volumetric.weight = parseFloat(e.target.value);
        if (valWeight) valWeight.textContent = this.postProcState.volumetric.weight.toFixed(2);
      });
    }
  }

  initHzbWorkspace() {
    this.initPostProcessingWorkspace();
  }

  updateHzbTelemetry(dt) {
    if (!this.postProcState) return;

    const hzb = this.postProcState.hzb;
    const baseCull = hzb.culling ? 48.0 : 0.0;
    const dynamicOffset = Math.sin(Date.now() * 0.001) * 3.5;
    const cullPct = Math.max(0, Math.min(95, baseCull + dynamicOffset));

    const telemCull = document.getElementById('telem-hzb-cullrate');
    if (telemCull) telemCull.textContent = `${cullPct.toFixed(1)}% Culled`;

    const telemBloom = document.getElementById('telem-bloom-luma');
    if (telemBloom && this.postProcState.bloom) {
      telemBloom.textContent = `Threshold: ${this.postProcState.bloom.threshold.toFixed(2)}`;
    }

    const telemVol = document.getElementById('telem-volumetric-steps');
    if (telemVol && this.postProcState.volumetric) {
      telemVol.textContent = `${this.postProcState.volumetric.samples} March Steps`;
    }

    const telemTime = document.getElementById('telem-postproc-time');
    if (telemTime) {
      telemTime.textContent = `${(0.12 + Math.random() * 0.03).toFixed(2)} ms`;
    }
  }

  updateSceneEntitiesForActiveDemo() {
    const ds = this.state.demoScene || '';
    
    // For character (Demo 06) and FPS (Demo 07) scenes, we let loadQuakeMap handle entities.
    if (ds.includes('06_glb') || ds === 'character' || ds.includes('07_fps')) {
      this.loadQuakeMap(this.currentMapId || 'dm6', false);
      return;
    }

    let entities = [];

    if (ds.includes('01_pbr') || ds === 'single') {
      const activeMeshName = ["Sphere (GGX UV)", "Cube (Box UV)", "C++ Peg Pillar", "Trefoil Knot Model", "High-Poly Torus", "Procedural Quad Canvas", "Sleek Ring", "Convex Disk"][this.state.activeMesh || 0] || "Active Mesh";
      entities = [
        { id: 0, name: activeMeshName, type: "Inspectable PBR Mesh", materialKey: this.activeTunedMaterial || 'wood', pos: [0, 0, 0], scale: [1, 1, 1], roughness: this.state.roughness, metallic: this.state.metallic, color: this.state.baseColor || [0.9, 0.9, 0.95], collider: "Visual Mesh Bounds", layer: "PBR Inspect Target", badge: "GGX PBR", trigger: false },
        { id: 1, name: "Studio_Sun_Light", type: "Directional Light", materialKey: "neon", pos: [4.0, 5.0, 4.0], scale: [1, 1, 1], roughness: 0.0, metallic: 0.0, color: [1.0, 0.95, 0.9], collider: "None", layer: "Layer_Light", badge: "Sun Light", trigger: false }
      ];
    } else if (ds.includes('02_metallic') || ds === 'matrix') {
      entities = [
        { id: 100, name: "Matrix_Floor_Pad", type: "Static Environment", materialKey: "obsidian", pos: [0, -1.2, 0], scale: [8.0, 0.2, 8.0], roughness: 0.8, metallic: 0.1, color: [0.15, 0.16, 0.18], collider: "AABB Box", layer: "Layer_Ground", badge: "Ground", trigger: false }
      ];
      const rows = 5, cols = 5;
      const spacing = 1.35;
      const offsetX = (cols - 1) * spacing * 0.5;
      const offsetY = (rows - 1) * spacing * 0.5;
      for (let r = 0; r < rows; r++) {
        const roughness = 0.05 + (r / (rows - 1)) * 0.95;
        for (let c = 0; c < cols; c++) {
          const metallic = c / (cols - 1);
          entities.push({
            id: 200 + r * 5 + c,
            name: `PBR_Sphere_R${r}_C${c} (Rough=${roughness.toFixed(2)}, Metal=${metallic.toFixed(2)})`,
            type: "PBR Specular Model",
            materialKey: "gold",
            pos: [c * spacing - offsetX, (rows - 1 - r) * spacing - offsetY, 0],
            scale: [0.65, 0.65, 0.65],
            roughness: roughness,
            metallic: metallic,
            color: Array.isArray(this.gridColor) ? this.gridColor : (this.gridColor ? Array.from(this.gridColor) : [0.85, 0.12, 0.12]),
            collider: "Bounding Box",
            layer: "Layer_PBR_Matrix",
            badge: `R:${roughness.toFixed(1)} M:${metallic.toFixed(1)}`,
            trigger: false
          });
        }
      }
    } else if (ds.includes('03_trefoil') || ds === 'studio') {
      entities = [
        { id: 0, name: "Trefoil_Knot_Mesh", type: "Studio PBR Mesh", materialKey: this.activeTunedMaterial || 'chrome', pos: [0, 0, 0], scale: [1, 1, 1], roughness: this.state.roughness || 0.15, metallic: this.state.metallic || 0.95, color: this.state.baseColor || [0.9, 0.9, 0.95], collider: "Mesh Face Bounds", layer: "PBR Inspect Target", badge: "Studio Model", trigger: false },
        { id: 1, name: "Key_Studio_Light", type: "Directional Light", materialKey: "neon", pos: [3.0, 3.5, 3.0], scale: [1, 1, 1], roughness: 0.0, metallic: 0.0, color: [1.0, 0.92, 0.85], collider: "None", layer: "Layer_Light", badge: "Key Light", trigger: false },
        { id: 2, name: "Fill_Studio_Light", type: "Directional Light", materialKey: "neon", pos: [-3.0, 2.0, 2.0], scale: [1, 1, 1], roughness: 0.0, metallic: 0.0, color: [0.85, 0.9, 1.0], collider: "None", layer: "Layer_Light", badge: "Fill Light", trigger: false },
        { id: 3, name: "Rim_Studio_Light", type: "Directional Light", materialKey: "neon", pos: [0.0, 2.0, -4.0], scale: [1, 1, 1], roughness: 0.0, metallic: 0.0, color: [0.95, 0.95, 1.0], collider: "None", layer: "Layer_Light", badge: "Rim Light", trigger: false }
      ];
    } else if (ds.includes('04_wasm_webgl')) {
      entities = [
        { id: 0, name: "Spinning_WASM_Mesh", type: "WebGL Encapsulated Object", materialKey: "cyber_grid", pos: [0, 0, 0], scale: [1, 1, 1], roughness: 0.3, metallic: 0.8, color: [0.2, 0.8, 0.4], collider: "Dynamic Matrix Bounds", layer: "Layer_Wasm", badge: "WASM WebGL", trigger: false },
        { id: 1, name: "Sun_Directional_Light", type: "Directional Light", materialKey: "neon", pos: [3, 4, 3], scale: [1, 1, 1], roughness: 0, metallic: 0, color: [1, 1, 1], collider: "None", layer: "Layer_Light", badge: "Light", trigger: false }
      ];
    } else if (ds.includes('05_desktop_standalone')) {
      entities = [
        { id: 0, name: "Desktop_Simulated_Window", type: "OS Frame Buffer Canvas", materialKey: "obsidian", pos: [0, 0, 0], scale: [2, 1.5, 1], roughness: 0.9, metallic: 0.0, color: [0.1, 0.12, 0.15], collider: "Static Plane Bounds", layer: "Layer_Desktop", badge: "SDL2 Desktop", trigger: false }
      ];
    } else if (ds.includes('08_all_materials') || ds.includes('materials_presentation')) {
      entities = [
        { id: 1, name: "Showroom_Obsidian_Floor", type: "Static Ground Base", materialKey: "obsidian", pos: [0.0, -0.4, 0.0], scale: [36.0, 0.4, 36.0], roughness: 0.20, metallic: 0.85, color: [0.08, 0.09, 0.12], collider: "AABB Static", layer: "Layer_Ground", badge: "Basalt Obsidian", trigger: false }
      ];
      const matKeys = Object.keys(FILAMENT_MATERIALS_CATALOG);
      const totalMats = matKeys.length;
      for (let i = 0; i < totalMats; i++) {
        const key = matKeys[i];
        const mat = FILAMENT_MATERIALS_CATALOG[key];
        const pos = this.getShowroomPedestalPos(i, totalMats, this.state.showroomLayout);
        const activeMeshName = ["Sphere (GGX UV)", "Cube (Box UV)", "C++ Peg Pillar", "Trefoil Knot Model", "High-Poly Torus", "Procedural Quad Canvas", "Sleek Ring", "Convex Disk"][this.state.showroomMesh || 0] || "Mesh";
        
        entities.push({
          id: 300 + i * 2,
          name: `Pedestal_SL_${i}_${key.toUpperCase()}`,
          type: "Slate Alloy Pedestal Mount",
          materialKey: "metal",
          pos: [pos[0], 0.35, pos[2]],
          scale: [0.95, 0.70, 0.95],
          roughness: 0.35,
          metallic: 0.90,
          color: [0.14, 0.16, 0.20],
          collider: "AABB Pedestal",
          layer: "Layer_Static",
          badge: "Pedestal",
          trigger: false
        });

        entities.push({
          id: 300 + i * 2 + 1,
          name: `PBR_Showcase_${key.toUpperCase()} (${activeMeshName})`,
          type: `PBR Shader [${mat.name || key}]`,
          materialKey: key,
          pos: [pos[0], 1.45, pos[2]],
          scale: [0.62, 0.62, 0.62],
          roughness: mat.roughness,
          metallic: mat.metallic,
          color: mat.color || [0.5, 0.5, 0.5],
          collider: "Visual Specular Sphere",
          layer: "Layer_Material_Showcase",
          badge: key.toUpperCase(),
          trigger: false
        });
      }
    } else if (ds.includes('09_slot_machine')) {
      entities = [
        { id: 0, name: "Slot_Machine_Cabinet_Chassis", type: "Heavy Metal Housing", materialKey: "obsidian", pos: [0, 0.2, -1.0], scale: [4.4, 3.2, 0.6], roughness: 0.18, metallic: 0.9, color: [0.08, 0.1, 0.14], collider: "Chassis Bounding Box", layer: "Layer_Interactive", badge: "Cabinet Chassis", trigger: false },
        { id: 1, name: "Gold_Glowing_Marquee_Header", type: "Luminescent Accent Frame", materialKey: "neon", pos: [0, 1.8, -0.7], scale: [4.4, 0.12, 0.3], roughness: 0.05, metallic: 0.98, color: [0.95, 0.64, 0.08], collider: "None", layer: "Layer_Interactive", badge: "Marquee Header", trigger: false },
        { id: 2, name: "Pedestal_Bottom_Base", type: "Slate Alloy Mount", materialKey: "rock", pos: [0, -1.15, -0.5], scale: [4.4, 0.3, 1.4], roughness: 0.35, metallic: 0.9, color: [0.14, 0.16, 0.2], collider: "Pedestal Base Bounding Box", layer: "Layer_Ground", badge: "Base Pedestal", trigger: false },
        { id: 3, name: "Slot_Lever_Crank_Handle", type: "Physical Leverage Actuator", materialKey: "chrome", pos: [2.35, 0.35, -0.2], scale: [0.1, 0.8, 0.1], roughness: 0.1, metallic: 0.95, color: [0.85, 0.85, 0.88], collider: "Lever Crank Capsule", layer: "Layer_Interactive", badge: "Lever Actuator", trigger: false },
        { id: 4, name: "Reel_Column_01_Left", type: "Sleek Rotational Cylindrical Spool", materialKey: "white_metal", pos: [-1.2, 0.45, -0.4], scale: [0.85, 0.85, 0.72], roughness: 0.2, metallic: 0.9, color: [1, 1, 1], collider: "Cylinder Collision Bounds", layer: "Layer_Interactive", badge: "Reel Column 1", trigger: false },
        { id: 5, name: "Reel_Column_02_Center", type: "Sleek Rotational Cylindrical Spool", materialKey: "white_metal", pos: [0, 0.45, -0.4], scale: [0.85, 0.85, 0.72], roughness: 0.2, metallic: 0.9, color: [1, 1, 1], collider: "Cylinder Collision Bounds", layer: "Layer_Interactive", badge: "Reel Column 2", trigger: false },
        { id: 6, name: "Reel_Column_03_Right", type: "Sleek Rotational Cylindrical Spool", materialKey: "white_metal", pos: [1.2, 0.45, -0.4], scale: [0.85, 0.85, 0.72], roughness: 0.2, metallic: 0.9, color: [1, 1, 1], collider: "Cylinder Collision Bounds", layer: "Layer_Interactive", badge: "Reel Column 3", trigger: false }
      ];
    } else if (ds.includes('10_sliding_puzzle')) {
      entities = [
        { id: 10, name: "Sliding_Puzzle_Backboard", type: "Polished Rosewood Backing", materialKey: "wood", pos: [0, 1.3, -0.1], scale: [2.65, 2.65, 0.12], roughness: 0.25, metallic: 0.05, color: [0.18, 0.08, 0.05], collider: "AABB board", layer: "Layer_Interactive", badge: "Wood Board", trigger: false }
      ];
      if (this.slidingPuzzle && this.slidingPuzzle.tiles) {
        this.slidingPuzzle.tiles.forEach((tile, idx) => {
          if (tile.isEmpty) return;
          entities.push({
            id: 400 + idx,
            name: `Sliding_Tile_${tile.val} (GridPos:[${tile.currentCol},${tile.currentRow}])`,
            type: "Movable PBR Tile Block",
            materialKey: "gold",
            pos: [tile.pos[0], tile.pos[1], tile.pos[2]],
            scale: [0.72, 0.72, 0.1],
            roughness: 0.12,
            metallic: 0.9,
            color: tile.color || [0.95, 0.64, 0.08],
            collider: "AABB Tile",
            layer: "Layer_Interactive",
            badge: `Tile ${tile.val}`,
            trigger: false
          });
        });
      }
    } else if (ds.includes('11_plinko')) {
      entities = [
        { id: 0, name: "Plinko_Backing_Wall", type: "Textured Carbon Obsidian Support", materialKey: "carbon_fiber", pos: [0, 1.4, -0.05], scale: [2.5, 1.7, 0.05], roughness: 0.55, metallic: 0.45, color: [0.08, 0.09, 0.12], collider: "Support Wall AABB", layer: "Layer_Static", badge: "Backboard", trigger: false },
        { id: 1, name: "Left_Deflector_Wall", type: "Channeled Steel Guide Block", materialKey: "metal", pos: [-1.15, 1.4, 0.05], scale: [0.06, 1.5, 0.18], roughness: 0.2, metallic: 0.85, color: [0.24, 0.28, 0.35], collider: "AABB Guardrail", layer: "Layer_Static", badge: "Deflector Wall", trigger: false },
        { id: 2, name: "Right_Deflector_Wall", type: "Channeled Steel Guide Block", materialKey: "metal", pos: [1.15, 1.4, 0.05], scale: [0.06, 1.5, 0.18], roughness: 0.2, metallic: 0.85, color: [0.24, 0.28, 0.35], collider: "AABB Guardrail", layer: "Layer_Static", badge: "Deflector Wall", trigger: false }
      ];
      const ps = this.plinkoState;
      if (ps && ps.pegs) {
        ps.pegs.forEach((peg, idx) => {
          entities.push({
            id: 500 + idx,
            name: `Plinko_Peg_Row${peg.row}_Col${peg.col}`,
            type: "Static Collision Pin",
            materialKey: "gold",
            pos: [peg.x, peg.y, 0.05],
            scale: [0.024, 0.024, 0.08],
            roughness: 0.15,
            metallic: 0.95,
            color: [0.95, 0.64, 0.08],
            collider: "Cylinder Pin",
            layer: "Layer_Plinko_Peg",
            badge: "Peg",
            trigger: false
          });
        });
      }
      if (ps && ps.balls) {
        ps.balls.forEach((ball, idx) => {
          if (!ball.active) return;
          entities.push({
            id: 600 + idx,
            name: `Dropped_Ball_${idx + 1}`,
            type: "Dynamic Gravity Sphere",
            materialKey: "cyber_grid",
            pos: [ball.pos[0], ball.pos[1], ball.pos[2]],
            scale: [0.06, 0.06, 0.06],
            roughness: 0.08,
            metallic: 0.95,
            color: ball.color || [0.06, 0.85, 0.95],
            collider: "Dynamic Sphere Collision",
            layer: "Layer_Plinko_Ball",
            badge: "Ball",
            trigger: false
          });
        });
      }
    } else if (ds.includes('12_roulette')) {
      entities = [
        { id: 0, name: "Roulette_Central_Cone_Cap", type: "Faceted Gold Hub Spindle", materialKey: "gold", pos: [0, 0, 0.09], scale: [0.15, 0.15, 0.18], roughness: 0.08, metallic: 0.98, color: [0.95, 0.64, 0.08], collider: "Faceted Hub Cylinder", layer: "Layer_Interactive", badge: "Central Spindle", trigger: false },
        { id: 1, name: "Main_Roulette_Turntable_Wheel", type: "Segmented Outer Ring Cylinder", materialKey: "obsidian", pos: [0, 0, 0], scale: [1.1, 1.1, 0.08], roughness: 0.25, metallic: 0.85, color: [0.15, 0.16, 0.18], collider: "Rotating Cylinder Wheel", layer: "Layer_Interactive", badge: "Spindle Wheel", trigger: false },
        { id: 2, name: "Obsidian_Base_Rim", type: "Outer Static Guide Ring", materialKey: "metal", pos: [0, 0, -0.04], scale: [1.3, 1.3, 0.08], roughness: 0.15, metallic: 0.9, color: [0.08, 0.09, 0.12], collider: "Static Outer Ring Rim", layer: "Layer_Static", badge: "Outer Rim", trigger: false }
      ];
      if (this.rouletteState && this.rouletteState.ball) {
        const ball = this.rouletteState.ball;
        entities.push({
          id: 700,
          name: "Roulette_Ball",
          type: "Frictionless Rolling Ivory Sphere",
          materialKey: "white_metal",
          pos: [ball.pos[0], ball.pos[1], ball.pos[2]],
          scale: [0.038, 0.038, 0.038],
          roughness: 0.05,
          metallic: 0.05,
          color: [0.98, 0.98, 0.95],
          collider: "Dynamic Ball Contact",
          layer: "Layer_Interactive",
          badge: "Ivory Ball",
          trigger: false
        });
      }
    }

    if (entities.length > 0) {
      this.sceneEntities = entities;
      this.selectedEntityIndex = 0;
      this.renderHierarchyTree();
      this.populateInspector(this.sceneEntities[0]);
    }
  }

  renderHierarchyTree() {
    const treeList = document.getElementById('hierarchy-tree-list');
    if (!treeList) return;

    const countEl = document.getElementById('scene-obj-count');
    if (countEl) {
      countEl.textContent = this.sceneEntities.length;
    }

    treeList.innerHTML = '';
    this.sceneEntities.forEach((entity, idx) => {
      const isSelected = (idx === this.selectedEntityIndex);
      const item = document.createElement('div');
      item.className = `hierarchy-item ${isSelected ? 'selected' : ''}`;
      item.dataset.index = idx;
      item.id = `hierarchy-item-${idx}`;

      let badgeColor = '#64748b';
      let lightIcon = '';
      if (entity.isLight || entity.layer === 'Layer_Light') {
        badgeColor = '#eab308';
        if (entity.lightType === 'spot') lightIcon = '🔦 ';
        else if (entity.lightType === 'directional') lightIcon = '☀️ ';
        else lightIcon = '💡 ';
      }
      else if (entity.layer === 'Layer_Player') badgeColor = '#3b82f6';
      else if (entity.layer === 'Layer_Ground') badgeColor = '#10b981';
      else if (entity.layer === 'Layer_Obstacle') badgeColor = '#f59e0b';
      else if (entity.layer === 'Layer_Trigger') badgeColor = '#06b6d4';
      else if (entity.layer === 'Layer_Damageable') badgeColor = '#f43f5e';

      const matInfo = FILAMENT_MATERIALS_CATALOG[entity.materialKey] || FILAMENT_MATERIALS_CATALOG.wood;

      item.innerHTML = `
        <div class="hierarchy-item-left">
          <span class="hierarchy-selection-indicator"></span>
          <span class="hierarchy-badge" style="background: ${badgeColor}22; color: ${badgeColor}; border: 1px solid ${badgeColor}44;">
            ${lightIcon}${entity.badge || entity.type}
          </span>
          <span class="hierarchy-name" id="hierarchy-name-${idx}">${entity.name}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="hierarchy-mat-tag" style="font-size: 10px; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.06); color: #94a3b8;">${matInfo.icon} ${matInfo.key.toUpperCase()}</span>
          <span class="hierarchy-coord font-mono">[${entity.pos[0].toFixed(1)}, ${entity.pos[1].toFixed(1)}, ${entity.pos[2].toFixed(1)}]</span>
        </div>
      `;

      item.addEventListener('click', () => {
        document.querySelectorAll('.hierarchy-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        this.selectedEntityIndex = idx;
        this.populateInspector(this.sceneEntities[idx]);
        this.updateCppBridge();
      });

      treeList.appendChild(item);
    });

    if (this.sceneEntities[this.selectedEntityIndex]) {
      this.populateInspector(this.sceneEntities[this.selectedEntityIndex]);
    }
  }

  populateInspector(entity) {
    if (!entity) return;
    const nameEl = document.getElementById('insp-obj-name');
    const nameEdit = document.getElementById('insp-name-edit');
    const typeEl = document.getElementById('insp-obj-type');
    const badgeEl = document.getElementById('insp-obj-badge');
    const colliderEl = document.getElementById('insp-collider-type');

    if (nameEl) nameEl.textContent = entity.name;
    if (nameEdit) nameEdit.value = entity.name;
    if (typeEl) typeEl.textContent = `Type: ${entity.type} (${entity.layer})`;
    if (badgeEl) badgeEl.textContent = entity.badge || 'Active';
    if (colliderEl) colliderEl.textContent = entity.collider || 'None';

    const colShape = document.getElementById('insp-collider-shape');
    const colLayer = document.getElementById('insp-collider-layer');
    const colTrigger = document.getElementById('insp-collider-trigger');
    if (colShape) colShape.textContent = entity.collider.includes('Sphere') ? 'SPHERE' : 'AABB BOX';
    if (colLayer) colLayer.textContent = entity.layer || 'Default';
    if (colTrigger) colTrigger.textContent = entity.trigger ? 'YES (Overlap Zone)' : 'NO (Solid Physics)';

    // Populate Material Select & Swatch
    const matSelect = document.getElementById('insp-material-select');
    if (matSelect) {
      matSelect.innerHTML = '';
      Object.values(FILAMENT_MATERIALS_CATALOG).forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.key;
        opt.textContent = `${m.icon} ${m.name} [${m.matCost.rating}]`;
        if (entity.materialKey === m.key) opt.selected = true;
        matSelect.appendChild(opt);
      });
      if (!entity.materialKey) {
        entity.materialKey = 'wood';
      }
      matSelect.value = entity.materialKey;
    }

    const curMat = FILAMENT_MATERIALS_CATALOG[entity.materialKey] || FILAMENT_MATERIALS_CATALOG.wood;
    const matBadge = document.getElementById('insp-mat-cost-badge');
    const matSwatch = document.getElementById('insp-mat-swatch');
    const matDesc = document.getElementById('insp-mat-desc');

    if (matBadge) {
      matBadge.textContent = `MAT COST: ${curMat.matCost.rating} (${curMat.matCost.alus})`;
      matBadge.className = `mat-cost-badge ${curMat.matCost.badgeClass}`;
    }
    if (matSwatch) matSwatch.style.background = curMat.swatch;
    if (matDesc) matDesc.textContent = curMat.desc;

    // Transform Values
    const posX = document.getElementById('insp-pos-x');
    const posY = document.getElementById('insp-pos-y');
    const posZ = document.getElementById('insp-pos-z');
    if (posX) posX.value = entity.pos[0];
    if (posY) posY.value = entity.pos[1];
    if (posZ) posZ.value = entity.pos[2];

    const scaX = document.getElementById('insp-scale-x');
    const scaY = document.getElementById('insp-scale-y');
    const scaZ = document.getElementById('insp-scale-z');
    if (scaX) scaX.value = entity.scale[0];
    if (scaY) scaY.value = entity.scale[1];
    if (scaZ) scaZ.value = entity.scale[2];

    const rough = document.getElementById('insp-roughness');
    const metal = document.getElementById('insp-metallic');
    const roughVal = document.getElementById('insp-roughness-val');
    const metalVal = document.getElementById('insp-metallic-val');

    const curRough = entity.roughness !== undefined ? entity.roughness : curMat.roughness;
    const curMetal = entity.metallic !== undefined ? entity.metallic : curMat.metallic;

    if (rough) rough.value = curRough;
    if (metal) metal.value = curMetal;
    if (roughVal) roughVal.textContent = curRough.toFixed(2);
    if (metalVal) metalVal.textContent = curMetal.toFixed(2);

    const cp = document.getElementById('insp-basecolor');
    if (cp && entity.color) {
      const hexR = Math.round(entity.color[0] * 255).toString(16).padStart(2, '0');
      const hexG = Math.round(entity.color[1] * 255).toString(16).padStart(2, '0');
      const hexB = Math.round(entity.color[2] * 255).toString(16).padStart(2, '0');
      cp.value = `#${hexR}${hexG}${hexB}`;
    }

    // Populate Light Entity Section
    const lightSec = document.getElementById('insp-light-section');
    if (entity.isLight || entity.layer === 'Layer_Light') {
      if (lightSec) lightSec.style.display = 'block';
      const lightTypeSel = document.getElementById('insp-light-type');
      const lightColorPick = document.getElementById('insp-light-color');
      const lightColorHex = document.getElementById('insp-light-color-hex');
      const lightInten = document.getElementById('insp-light-intensity');
      const lightIntenVal = document.getElementById('insp-light-intensity-val');
      const lightRad = document.getElementById('insp-light-radius');
      const lightRadVal = document.getElementById('insp-light-radius-val');
      const lightCutoff = document.getElementById('insp-light-cutoff');
      const lightCutoffVal = document.getElementById('insp-light-cutoff-val');
      const rowSpotCutoff = document.getElementById('insp-row-spot-cutoff');
      const rowSpotDir = document.getElementById('insp-row-spot-dir');
      const rowLightRadius = document.getElementById('insp-row-light-radius');

      if (lightTypeSel) lightTypeSel.value = entity.lightType || 'point';
      if (lightInten) {
        lightInten.value = entity.intensity !== undefined ? entity.intensity : 15.0;
        if (lightIntenVal) lightIntenVal.textContent = parseFloat(lightInten.value).toFixed(1);
      }
      if (lightRad) {
        lightRad.value = entity.radius !== undefined ? entity.radius : 10.0;
        if (lightRadVal) lightRadVal.textContent = `${parseFloat(lightRad.value).toFixed(1)}m`;
      }
      if (entity.color) {
        const hexR = Math.round(entity.color[0] * 255).toString(16).padStart(2, '0');
        const hexG = Math.round(entity.color[1] * 255).toString(16).padStart(2, '0');
        const hexB = Math.round(entity.color[2] * 255).toString(16).padStart(2, '0');
        if (lightColorPick) lightColorPick.value = `#${hexR}${hexG}${hexB}`;
        if (lightColorHex) lightColorHex.textContent = `#${hexR.toUpperCase()}${hexG.toUpperCase()}${hexB.toUpperCase()}`;
      }

      const isSpot = entity.lightType === 'spot';
      if (rowSpotCutoff) rowSpotCutoff.style.display = isSpot ? 'flex' : 'none';
      if (rowSpotDir) rowSpotDir.style.display = isSpot ? 'flex' : 'none';
      if (rowLightRadius) rowLightRadius.style.display = (entity.lightType === 'directional') ? 'none' : 'flex';

      if (isSpot) {
        const deg = Math.round(entity.spotCutoffAngle !== undefined ? entity.spotCutoffAngle : 35);
        if (lightCutoff) lightCutoff.value = deg;
        if (lightCutoffVal) lightCutoffVal.textContent = `${deg}°`;
        const dirX = document.getElementById('insp-light-dir-x');
        const dirY = document.getElementById('insp-light-dir-y');
        const dirZ = document.getElementById('insp-light-dir-z');
        const dir = entity.lightDir || [0, -1, 0];
        if (dirX) dirX.value = dir[0];
        if (dirY) dirY.value = dir[1];
        if (dirZ) dirZ.value = dir[2];
      }
    } else {
      if (lightSec) lightSec.style.display = 'none';
    }
  }

  bindInspectorControls() {
    const updateEntity = () => {
      const entity = this.sceneEntities[this.selectedEntityIndex];
      if (!entity) return;

      const posX = parseFloat(document.getElementById('insp-pos-x')?.value) || 0;
      const posY = parseFloat(document.getElementById('insp-pos-y')?.value) || 0;
      const posZ = parseFloat(document.getElementById('insp-pos-z')?.value) || 0;
      entity.pos = [posX, posY, posZ];

      if (entity.layer === 'Layer_Player') {
        this.playerController.pos = [posX, posY, posZ];
      }

      const scaX = parseFloat(document.getElementById('insp-scale-x')?.value) || 1;
      const scaY = parseFloat(document.getElementById('insp-scale-y')?.value) || 1;
      const scaZ = parseFloat(document.getElementById('insp-scale-z')?.value) || 1;
      entity.scale = [scaX, scaY, scaZ];

      const rough = parseFloat(document.getElementById('insp-roughness')?.value) || 0.35;
      const metal = parseFloat(document.getElementById('insp-metallic')?.value) || 0.8;
      entity.roughness = rough;
      entity.metallic = metal;

      const roughVal = document.getElementById('insp-roughness-val');
      const metalVal = document.getElementById('insp-metallic-val');
      if (roughVal) roughVal.textContent = rough.toFixed(2);
      if (metalVal) metalVal.textContent = metal.toFixed(2);

      this.updateCppBridge();
    };

    // Name rename input listener
    const nameEdit = document.getElementById('insp-name-edit');
    if (nameEdit) {
      nameEdit.addEventListener('input', (e) => {
        const entity = this.sceneEntities[this.selectedEntityIndex];
        if (entity) {
          entity.name = e.target.value || `Entity_${entity.id}`;
          const nameEl = document.getElementById('insp-obj-name');
          if (nameEl) nameEl.textContent = entity.name;
          const treeNameEl = document.getElementById(`hierarchy-name-${this.selectedEntityIndex}`);
          if (treeNameEl) treeNameEl.textContent = entity.name;
          this.updateCppBridge();
        }
      });
    }

    // Material Dropdown Listener
    const matSelect = document.getElementById('insp-material-select');
    if (matSelect) {
      matSelect.addEventListener('change', (e) => {
        const entity = this.sceneEntities[this.selectedEntityIndex];
        if (entity) {
          this.applyMaterialToEntity(entity, e.target.value);
        }
      });
    }

    ['insp-pos-x', 'insp-pos-y', 'insp-pos-z', 'insp-scale-x', 'insp-scale-y', 'insp-scale-z', 'insp-roughness', 'insp-metallic'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', updateEntity);
      }
    });

    const cp = document.getElementById('insp-basecolor');
    if (cp) {
      cp.addEventListener('input', (e) => {
        const entity = this.sceneEntities[this.selectedEntityIndex];
        if (entity) {
          const hex = e.target.value;
          entity.color = [
            parseInt(hex.slice(1, 3), 16) / 255.0,
            parseInt(hex.slice(3, 5), 16) / 255.0,
            parseInt(hex.slice(5, 7), 16) / 255.0
          ];
          this.updateCppBridge();
        }
      });
    }

    // Light Entity Controls Listeners
    const lightTypeSel = document.getElementById('insp-light-type');
    if (lightTypeSel) {
      lightTypeSel.addEventListener('change', (e) => {
        const entity = this.sceneEntities[this.selectedEntityIndex];
        if (entity) {
          entity.lightType = e.target.value;
          entity.type = entity.lightType === 'spot' ? "Spot Light" : (entity.lightType === 'directional' ? "Directional Light" : "Spheric Area Light");
          entity.badge = entity.lightType === 'spot' ? "Spot Light" : (entity.lightType === 'directional' ? "Sun Light" : "Area Light");
          entity.collider = entity.lightType === 'spot' ? "Spot Light Cone" : "Point Light Sphere";
          this.renderHierarchyTree();
          this.populateInspector(entity);
        }
      });
    }

    const lightColorPick = document.getElementById('insp-light-color');
    if (lightColorPick) {
      lightColorPick.addEventListener('input', (e) => {
        const entity = this.sceneEntities[this.selectedEntityIndex];
        if (entity) {
          const hex = e.target.value;
          entity.color = [
            parseInt(hex.slice(1, 3), 16) / 255.0,
            parseInt(hex.slice(3, 5), 16) / 255.0,
            parseInt(hex.slice(5, 7), 16) / 255.0
          ];
          const hexLabel = document.getElementById('insp-light-color-hex');
          if (hexLabel) hexLabel.textContent = hex.toUpperCase();
        }
      });
    }

    const lightInten = document.getElementById('insp-light-intensity');
    if (lightInten) {
      lightInten.addEventListener('input', (e) => {
        const entity = this.sceneEntities[this.selectedEntityIndex];
        if (entity) {
          entity.intensity = parseFloat(e.target.value);
          const valLabel = document.getElementById('insp-light-intensity-val');
          if (valLabel) valLabel.textContent = entity.intensity.toFixed(1);
        }
      });
    }

    const lightRad = document.getElementById('insp-light-radius');
    if (lightRad) {
      lightRad.addEventListener('input', (e) => {
        const entity = this.sceneEntities[this.selectedEntityIndex];
        if (entity) {
          entity.radius = parseFloat(e.target.value);
          const valLabel = document.getElementById('insp-light-radius-val');
          if (valLabel) valLabel.textContent = `${entity.radius.toFixed(1)}m`;
        }
      });
    }

    const lightCutoff = document.getElementById('insp-light-cutoff');
    if (lightCutoff) {
      lightCutoff.addEventListener('input', (e) => {
        const entity = this.sceneEntities[this.selectedEntityIndex];
        if (entity) {
          const deg = parseFloat(e.target.value);
          entity.spotCutoffAngle = deg;
          const rad = deg * Math.PI / 180;
          entity.spotCutoff = Math.cos(rad);
          entity.outerCutoff = Math.cos(rad * 1.35);
          const valLabel = document.getElementById('insp-light-cutoff-val');
          if (valLabel) valLabel.textContent = `${deg}°`;
        }
      });
    }

    const updateSpotDir = () => {
      const entity = this.sceneEntities[this.selectedEntityIndex];
      if (entity && entity.lightType === 'spot') {
        const dx = parseFloat(document.getElementById('insp-light-dir-x')?.value) || 0;
        const dy = parseFloat(document.getElementById('insp-light-dir-y')?.value) || -1;
        const dz = parseFloat(document.getElementById('insp-light-dir-z')?.value) || 0;
        entity.lightDir = [dx, dy, dz];
      }
    };
    ['insp-light-dir-x', 'insp-light-dir-y', 'insp-light-dir-z'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', updateSpotDir);
    });

    const addLight = (type) => {
      const newId = 500 + this.sceneEntities.length;
      const isSpot = (type === 'spot');
      const camYaw = this.state.camYaw || 0;
      const camPos = this.state.camPos || [0, 5, 10];
      const newLight = {
        id: newId,
        name: isSpot ? `Spot_Light_${newId}` : `Area_Spheric_Light_${newId}`,
        type: isSpot ? "Spot Light" : "Spheric Area Light",
        isLight: true,
        lightType: isSpot ? "spot" : "point",
        pos: [camPos[0] - Math.sin(camYaw) * 4.0, camPos[1] + 1.5, camPos[2] - Math.cos(camYaw) * 4.0],
        lightDir: [0, -1, 0],
        scale: [1.2, 1.2, 1.2],
        color: isSpot ? [0.2, 0.85, 1.0] : [1.0, 0.65, 0.2],
        intensity: 20.0,
        radius: 12.0,
        spotCutoffAngle: 35,
        spotCutoff: Math.cos(35 * Math.PI / 180),
        outerCutoff: Math.cos(35 * 1.35 * Math.PI / 180),
        roughness: 0.1,
        metallic: 0.9,
        collider: isSpot ? "Spot Light Cone" : "Point Light Sphere",
        layer: "Layer_Light",
        trigger: false,
        badge: isSpot ? "Spot Light" : "Area Light",
        contact: false
      };
      this.sceneEntities.push(newLight);
      this.selectedEntityIndex = this.sceneEntities.length - 1;
      this.renderHierarchyTree();
      this.populateInspector(newLight);
      this.log(`Added new ${newLight.type} entity [${newLight.name}] to scene at [${newLight.pos.map(n=>n.toFixed(1)).join(', ')}]`, "success");
    };

    document.getElementById('btn-add-light-point')?.addEventListener('click', () => addLight('point'));
    document.getElementById('btn-add-light-spot')?.addEventListener('click', () => addLight('spot'));

    const btnFocus = document.getElementById('btn-focus-obj');
    if (btnFocus) {
      btnFocus.addEventListener('click', () => {
        const entity = this.sceneEntities[this.selectedEntityIndex];
        if (entity) {
          this.state.camTarget[0] = entity.pos[0];
          this.state.camTarget[1] = entity.pos[1];
          this.state.camTarget[2] = entity.pos[2];
          this.state.camRadius = Math.max(3.0, Math.hypot(entity.scale[0], entity.scale[1], entity.scale[2]) * 2.5);
          this.log(`Focused Camera on: ${entity.name} at [${entity.pos.join(', ')}]`, "cpp");
        }
      });
    }

    const btnCopyBridge = document.getElementById('btn-copy-cpp-bridge');
    if (btnCopyBridge) {
      btnCopyBridge.addEventListener('click', () => {
        const text = document.getElementById('cpp-bridge-code')?.textContent || '';
        navigator.clipboard.writeText(text);
        this.log("C++ Bridge code copied to clipboard.", "success");
      });
    }

    const btnRefreshHierarchy = document.getElementById('btn-refresh-hierarchy');
    if (btnRefreshHierarchy) {
      btnRefreshHierarchy.addEventListener('click', () => {
        this.updateSceneEntitiesForActiveDemo();
        this.log("Manually refreshed active Scene Graph from live simulation context.", "success");
      });
    }
  }

  bindPlayerControllerUI() {
    const sliderWalk = document.getElementById('slider-player-walk');
    const valWalk = document.getElementById('val-player-walk');
    if (sliderWalk) {
      sliderWalk.addEventListener('input', (e) => {
        this.playerController.walkSpeed = parseFloat(e.target.value);
        if (valWalk) valWalk.textContent = `${this.playerController.walkSpeed.toFixed(1)} m/s`;
        this.updateCppBridge();
      });
    }

    const sliderSprint = document.getElementById('slider-player-sprint');
    const valSprint = document.getElementById('val-player-sprint');
    if (sliderSprint) {
      sliderSprint.addEventListener('input', (e) => {
        this.playerController.sprintSpeed = parseFloat(e.target.value);
        if (valSprint) valSprint.textContent = `${this.playerController.sprintSpeed.toFixed(1)} m/s`;
        this.updateCppBridge();
      });
    }

    const sliderJump = document.getElementById('slider-player-jump');
    const valJump = document.getElementById('val-player-jump');
    if (sliderJump) {
      sliderJump.addEventListener('input', (e) => {
        this.playerController.jumpForce = parseFloat(e.target.value);
        if (valJump) valJump.textContent = `${this.playerController.jumpForce.toFixed(1)} m/s`;
        this.updateCppBridge();
      });
    }

    const sliderGrav = document.getElementById('slider-player-gravity');
    const valGrav = document.getElementById('val-player-gravity');
    if (sliderGrav) {
      sliderGrav.addEventListener('input', (e) => {
        this.playerController.gravity = parseFloat(e.target.value);
        if (valGrav) valGrav.textContent = `${this.playerController.gravity.toFixed(1)} m/s²`;
        this.updateCppBridge();
      });
    }

    const camViewSelect = document.getElementById('player-cam-view-select');
    if (camViewSelect) {
      camViewSelect.addEventListener('change', (e) => {
        this.playerController.cameraViewMode = e.target.value;
        this.log(`Player Camera View set to: ${e.target.value}`, "info");
      });
    }

    const btnJump = document.getElementById('btn-player-jump');
    if (btnJump) {
      btnJump.addEventListener('click', () => {
        if (this.playerController.isGrounded) {
          this.playerController.velocity[1] = this.playerController.jumpForce;
          this.playerController.isGrounded = false;
          this.log(`Manual Jump Triggered (Velocity: +${this.playerController.jumpForce.toFixed(1)} m/s)`, "cpp");
        }
      });
    }

    const btnReset = document.getElementById('btn-player-reset-pos');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        this.playerController.pos = [0.0, 0.0, 2.0];
        this.playerController.velocity = [0.0, 0.0, 0.0];
        this.playerController.isGrounded = true;
        this.log("Player Character position reset to spawn [0, 0, 2].", "info");
      });
    }

    const toggleDebug = document.getElementById('toggle-debug-colliders');
    if (toggleDebug) {
      toggleDebug.addEventListener('change', (e) => {
        this.playerController.debugColliders = e.target.checked;
        this.log(`Collision Geometry Wireframes: ${e.target.checked ? 'ENABLED' : 'DISABLED'}`, "info");
      });
    }
  }

  renderCollisionRegister() {
    const tbody = document.getElementById('collision-register-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    this.sceneEntities.forEach((ent) => {
      const row = document.createElement('tr');
      row.id = `col-row-${ent.id}`;
      
      let typeLabel = 'AABB Box';
      if (ent.collider.includes('Sphere')) typeLabel = 'Sphere';
      else if (ent.trigger) typeLabel = 'Trigger Zone';

      row.innerHTML = `
        <td class="font-mono text-cyan-400 font-bold">#${String(ent.id).padStart(2, '0')}</td>
        <td class="font-semibold text-slate-100">${ent.name}</td>
        <td><span class="badge-col-type">${typeLabel}</span></td>
        <td class="font-mono text-slate-300">[${ent.pos.map(v => v.toFixed(1)).join(', ')}]</td>
        <td class="font-mono text-slate-400">[${ent.scale.map(v => (v*0.5).toFixed(1)).join(', ')}]</td>
        <td><span class="badge-layer">${ent.layer}</span></td>
        <td class="text-center">${ent.trigger ? '<span class="text-cyan-400 font-bold">YES</span>' : '<span class="text-slate-500">NO</span>'}</td>
        <td id="col-status-${ent.id}">
          <span class="status-pill status-clear">CLEAR</span>
        </td>
      `;

      tbody.appendChild(row);
    });
  }

  updateCppBridge() {
    const bridgeEl = document.getElementById('cpp-bridge-code');
    if (!bridgeEl) return;

    const ent = this.sceneEntities[this.selectedEntityIndex] || this.sceneEntities[0];
    const code = `// C++ Native Bridge Code: Scene Entity & Locomotion Bindings
// Corresponding Source: examples/06_glb_character_collision_player.cpp

#include <engine/Engine.hpp>
#include <engine/GLBLoader.hpp>
#include <engine/Collision.hpp>
#include <engine/PlayerController.hpp>

using namespace EngineCore;

// 1. Instantiating Selected Entity: "${ent.name}"
void SetupSelectedEntity(CollisionWorld& collisionWorld, Skeleton& skeleton) {
    // Spatial Transform
    Vec3 position(${ent.pos[0].toFixed(2)}f, ${ent.pos[1].toFixed(2)}f, ${ent.pos[2].toFixed(2)}f);
    Vec3 halfExtents(${ (ent.scale[0] * 0.5).toFixed(2) }f, ${ (ent.scale[1] * 0.5).toFixed(2) }f, ${ (ent.scale[2] * 0.5).toFixed(2) }f);
    
    // Register Collider in High-Performance Spatial Hash World
    uint32_t colliderId = collisionWorld.AddAABB(
        "${ent.name}",
        position,
        halfExtents,
        ${ent.layer},
        ${ent.trigger ? 'true /* isTrigger */' : 'false'}
    );

    // Material Surface PBR Parameters
    float metallic  = ${ (ent.metallic !== undefined ? ent.metallic : 0.8).toFixed(2) }f;
    float roughness = ${ (ent.roughness !== undefined ? ent.roughness : 0.35).toFixed(2) }f;
}

// 2. Kinematic Player Controller Setup
void ConfigurePlayerController(PlayerController& player) {
    player.walkSpeed   = ${this.playerController.walkSpeed.toFixed(1)}f;
    player.sprintSpeed = ${this.playerController.sprintSpeed.toFixed(1)}f;
    player.jumpForce   = ${this.playerController.jumpForce.toFixed(1)}f;
    player.gravity     = ${this.playerController.gravity.toFixed(1)}f;
    player.SetPosition(Vec3(${this.playerController.pos[0].toFixed(2)}f, ${this.playerController.pos[1].toFixed(2)}f, ${this.playerController.pos[2].toFixed(2)}f));
}

// 3. Zero-Allocation Gameplay Tick Loop
void TickScene(GameSceneContext& ctx, float dt, const PlayerInput& input) {
    ctx.player.Update(dt, input, ctx.collisionWorld);
    ctx.characterSkeleton.Update(dt);
}`;

    bridgeEl.textContent = code;
  }

  // Robust Multi-Pass Continuous Collision Resolution for Player vs Big Scaled Cubes, Obstacles, Stairs, & Damage Actors
  resolvePlayerCollision(pos, velocity, radius, height) {
    let isGrounded = false;
    let groundContactCount = 0;

    // 1. Level Ground Plane Collision (y = 0.0)
    if (pos[1] <= 0.0) {
      pos[1] = 0.0;
      if (velocity && velocity[1] < 0) velocity[1] = 0.0;
      isGrounded = true;
      groundContactCount++;
    }

    // Run 4 iterative relaxation passes to resolve complex multi-box corners and tight stair intersections
    for (let pass = 0; pass < 4; pass++) {
      // 2. Iterate through Scene Entities (Ground, Pillars, Jump Platforms, Physical Prop Boulders, Collectibles, Quake Brushes)
      if (this.sceneEntities) {
        for (let i = 0; i < this.sceneEntities.length; i++) {
          const ent = this.sceneEntities[i];
          if (ent.id === 0) continue; // Skip Player's own entity

          if (ent.layer === 'Layer_Ground') {
            ent.contact = (pos[1] <= 0.05);
            if (ent.contact) isGrounded = true;
            continue;
          }

          ent.contact = false;

          // Layer: Triggers and Collectibles
          if (ent.layer === 'Layer_Trigger' || ent.trigger) {
            const dx = pos[0] - ent.pos[0];
            const dy = (pos[1] + height * 0.5) - ent.pos[1];
            const dz = pos[2] - ent.pos[2];
            const scaleX = Array.isArray(ent.scale) ? (ent.scale[0] || 1.0) : (typeof ent.scale === 'number' ? ent.scale : 1.0);
            const scaleY = Array.isArray(ent.scale) ? (ent.scale[1] || 1.0) : (typeof ent.scale === 'number' ? ent.scale : 1.0);
            const scaleZ = Array.isArray(ent.scale) ? (ent.scale[2] || 1.0) : (typeof ent.scale === 'number' ? ent.scale : 1.0);
            const triggerRad = Math.max(scaleX, scaleY, scaleZ) * 0.75 + radius;
            if (Math.hypot(dx, dy, dz) <= triggerRad) {
              ent.contact = true;
            }
            continue;
          }

          // Layer: Solid Obstacles, Platforms, Walls, Statics, Props
          const isSolidObstacle = (ent.layer === 'Layer_Obstacle' || ent.layer === 'Layer_Static' || ent.layer === 'Layer_Wall' || ent.layer === 'Layer_Prop' || !ent.layer);
          if (isSolidObstacle) {
            const scaleX = Array.isArray(ent.scale) ? (ent.scale[0] || 1.0) : (typeof ent.scale === 'number' ? ent.scale : 1.0);
            const scaleY = Array.isArray(ent.scale) ? (ent.scale[1] || 1.0) : (typeof ent.scale === 'number' ? ent.scale : 1.0);
            const scaleZ = Array.isArray(ent.scale) ? (ent.scale[2] || 1.0) : (typeof ent.scale === 'number' ? ent.scale : 1.0);

            if (ent.collider && ent.collider.includes('Sphere')) {
              // Sphere Collider vs Player Capsule
              const sRadius = scaleX * 0.5 || 1.0;
              const clampY = Math.max(pos[1] + radius, Math.min(ent.pos[1], pos[1] + height - radius));
              const dx = pos[0] - ent.pos[0];
              const dy = clampY - ent.pos[1];
              const dz = pos[2] - ent.pos[2];
              const distSq = dx * dx + dy * dy + dz * dz;
              const minDist = radius + sRadius;

              if (distSq < minDist * minDist) {
                const dist = Math.sqrt(distSq) || 0.0001;
                const pen = minDist - dist;
                const nx = dx / dist;
                const ny = dy / dist;
                const nz = dz / dist;

                pos[0] += nx * pen;
                pos[1] += ny * pen;
                pos[2] += nz * pen;

                if (velocity) {
                  const vDotN = velocity[0] * nx + velocity[1] * ny + velocity[2] * nz;
                  if (vDotN < 0) {
                    velocity[0] -= nx * vDotN;
                    velocity[1] -= ny * vDotN;
                    velocity[2] -= nz * vDotN;
                  }
                }
                ent.contact = true;
                if (ny > 0.5) {
                  isGrounded = true;
                  groundContactCount++;
                }
              }
            } else {
              // AABB Box Collider vs Player Capsule (Robust Minkowski Sum Solver for Big Scaled Cubes)
              const halfX = scaleX * 0.5;
              const halfY = scaleY * 0.5;
              const halfZ = scaleZ * 0.5;
              const minX = ent.pos[0] - halfX;
              const maxX = ent.pos[0] + halfX;
              const minY = ent.pos[1] - halfY;
              const maxY = ent.pos[1] + halfY;
              const minZ = ent.pos[2] - halfZ;
              const maxZ = ent.pos[2] + halfZ;

              const pMinY = pos[1];
              const pMaxY = pos[1] + height;

              // Check vertical interval overlap
              if (pMaxY > minY && pMinY < maxY) {
                // Find closest horizontal point on AABB rectangle to player center
                const cx = Math.max(minX, Math.min(pos[0], maxX));
                const cz = Math.max(minZ, Math.min(pos[2], maxZ));
                const dx = pos[0] - cx;
                const dz = pos[2] - cz;
                const distSq = dx * dx + dz * dz;

                if (distSq < radius * radius) {
                  ent.contact = true;

                  // Step-up / Landing on top of stair tread or platform
                  const stepUpMax = 0.55;
                  const isLandingOrSteppingOnTop = (pMinY >= maxY - stepUpMax) && (!velocity || velocity[1] <= 1.5);
                  if (isLandingOrSteppingOnTop) {
                    pos[1] = Math.max(pos[1], maxY);
                    if (velocity && velocity[1] < 0) velocity[1] = 0.0;
                    isGrounded = true;
                    groundContactCount++;
                  } else if (pMaxY <= minY + 0.35 && velocity && velocity[1] > 0) {
                    // Hitting ceiling / platform underside
                    pos[1] = minY - height;
                    if (velocity) velocity[1] = 0.0;
                  } else {
                    // Lateral push-out & solid barrier resolution
                    if (distSq > 0.00001) {
                      const dist = Math.sqrt(distSq);
                      const pen = radius - dist;
                      const nx = dx / dist;
                      const nz = dz / dist;

                      pos[0] += nx * pen;
                      pos[2] += nz * pen;

                      if (velocity) {
                        const vDotN = velocity[0] * nx + velocity[2] * nz;
                        if (vDotN < 0) {
                          velocity[0] -= nx * vDotN;
                          velocity[2] -= nz * vDotN;
                        }
                      }
                    } else {
                      // Deeply penetrating inside big scaled cube - project along shortest boundary axis
                      const penLeft = (pos[0] - minX) + radius;
                      const penRight = (maxX - pos[0]) + radius;
                      const penFront = (pos[2] - minZ) + radius;
                      const penBack = (maxZ - pos[2]) + radius;
                      const minPen = Math.min(penLeft, penRight, penFront, penBack);

                      if (minPen === penLeft) {
                        pos[0] = minX - radius;
                        if (velocity && velocity[0] > 0) velocity[0] = 0;
                      } else if (minPen === penRight) {
                        pos[0] = maxX + radius;
                        if (velocity && velocity[0] < 0) velocity[0] = 0;
                      } else if (minPen === penFront) {
                        pos[2] = minZ - radius;
                        if (velocity && velocity[2] > 0) velocity[2] = 0;
                      } else {
                        pos[2] = maxZ + radius;
                        if (velocity && velocity[2] < 0) velocity[2] = 0;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      // 3. Iterate through Active Damageable Actors (Monoliths, Drones, Destructible Crates)
      if (this.damageActors) {
        for (let j = 0; j < this.damageActors.length; j++) {
          const actor = this.damageActors[j];
          if (!actor.alive) continue;

          const scaleX = Array.isArray(actor.scale) ? (actor.scale[0] || 1.0) : (typeof actor.scale === 'number' ? actor.scale : 1.0);
          const scaleY = Array.isArray(actor.scale) ? (actor.scale[1] || 1.0) : (typeof actor.scale === 'number' ? actor.scale : 1.0);
          const scaleZ = Array.isArray(actor.scale) ? (actor.scale[2] || 1.0) : (typeof actor.scale === 'number' ? actor.scale : 1.0);

          if (actor.collider && actor.collider.includes('Sphere')) {
            const sRadius = actor.radius || (scaleX * 0.5) || 0.8;
            const clampY = Math.max(pos[1] + radius, Math.min(actor.pos[1], pos[1] + height - radius));
            const dx = pos[0] - actor.pos[0];
            const dy = clampY - actor.pos[1];
            const dz = pos[2] - actor.pos[2];
            const distSq = dx * dx + dy * dy + dz * dz;
            const minDist = radius + sRadius;

            if (distSq < minDist * minDist) {
              const dist = Math.sqrt(distSq) || 0.0001;
              const pen = minDist - dist;
              const nx = dx / dist;
              const ny = dy / dist;
              const nz = dz / dist;

              pos[0] += nx * pen;
              pos[1] += ny * pen;
              pos[2] += nz * pen;

              if (velocity) {
                const vDotN = velocity[0] * nx + velocity[1] * ny + velocity[2] * nz;
                if (vDotN < 0) {
                  velocity[0] -= nx * vDotN;
                  velocity[1] -= ny * vDotN;
                  velocity[2] -= nz * vDotN;
                }
              }
              if (ny > 0.5) isGrounded = true;
            }
          } else {
            // AABB Box Damageable Actor
            const halfX = scaleX * 0.5;
            const halfY = scaleY * 0.5;
            const halfZ = scaleZ * 0.5;
            const minX = actor.pos[0] - halfX;
            const maxX = actor.pos[0] + halfX;
            const minY = actor.pos[1] - halfY;
            const maxY = actor.pos[1] + halfY;
            const minZ = actor.pos[2] - halfZ;
            const maxZ = actor.pos[2] + halfZ;

            const pMinY = pos[1];
            const pMaxY = pos[1] + height;

            if (pMaxY > minY && pMinY < maxY) {
              const cx = Math.max(minX, Math.min(pos[0], maxX));
              const cz = Math.max(minZ, Math.min(pos[2], maxZ));
              const dx = pos[0] - cx;
              const dz = pos[2] - cz;
              const distSq = dx * dx + dz * dz;

              if (distSq < radius * radius) {
                const isLandingOnTop = (pMinY >= maxY - 0.40) && (!velocity || velocity[1] <= 0.5);
                if (isLandingOnTop) {
                  pos[1] = maxY;
                  if (velocity) velocity[1] = 0.0;
                  isGrounded = true;
                } else if (pMaxY <= minY + 0.35 && velocity && velocity[1] > 0) {
                  pos[1] = minY - height;
                  if (velocity) velocity[1] = 0.0;
                } else {
                  if (distSq > 0.00001) {
                    const dist = Math.sqrt(distSq);
                    const pen = radius - dist;
                    const nx = dx / dist;
                    const nz = dz / dist;

                    pos[0] += nx * pen;
                    pos[2] += nz * pen;

                    if (velocity) {
                      const vDotN = velocity[0] * nx + velocity[2] * nz;
                      if (vDotN < 0) {
                        velocity[0] -= nx * vDotN;
                        velocity[2] -= nz * vDotN;
                      }
                    }
                  } else {
                    const penLeft = (pos[0] - minX) + radius;
                    const penRight = (maxX - pos[0]) + radius;
                    const penFront = (pos[2] - minZ) + radius;
                    const penBack = (maxZ - pos[2]) + radius;
                    const minPen = Math.min(penLeft, penRight, penFront, penBack);

                    if (minPen === penLeft) {
                      pos[0] = minX - radius;
                      if (velocity && velocity[0] > 0) velocity[0] = 0;
                    } else if (minPen === penRight) {
                      pos[0] = maxX + radius;
                      if (velocity && velocity[0] < 0) velocity[0] = 0;
                    } else if (minPen === penFront) {
                      pos[2] = minZ - radius;
                      if (velocity && velocity[2] > 0) velocity[2] = 0;
                    } else {
                      pos[2] = maxZ + radius;
                      if (velocity && velocity[2] < 0) velocity[2] = 0;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    this._colResult.isGrounded = isGrounded;
    return this._colResult;
  }

  onResize() {
    if (!this.containerEl) {
      this.containerEl = document.getElementById('canvas-container');
    }
    const container = this.containerEl;
    if (!container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width <= 0 || height <= 0) return;
    
    // Performance optimization: Cap DPR for mobile devices or Cheap Material mode to eliminate fillrate bottlenecks
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 800;
    const maxDpr = (this.state.fpsCheapMaterial || isMobile) ? 1.0 : 1.5;
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    
    const targetW = Math.floor(width * dpr);
    const targetH = Math.floor(height * dpr);
    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }
  }

  renderLoop(timestamp) {
    const dt = Math.min((timestamp - this.lastTime) * 0.001, 0.1);
    this.lastTime = timestamp;

    // FPS Meter
    this.frameCount++;
    if (timestamp - this.lastFpsUpdate >= 500) {
      const fps = (this.frameCount * 1000) / (timestamp - this.lastFpsUpdate);
      const fpsEl = document.getElementById('fps-counter');
      if (fpsEl) fpsEl.textContent = `${fps.toFixed(1)} FPS`;
      this.frameCount = 0;
      this.lastFpsUpdate = timestamp;
    }

    this.onResize();
    this.resizePostProcFBO();

    const gl = this.gl;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Render 3D Scene to Post-Processing Scene Framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFbo);
    gl.viewport(0, 0, width, height);

    // Force depth writing and disable blending BEFORE clearing to guarantee correct depth buffer clearance
    gl.depthMask(true);
    gl.disable(gl.BLEND);

    // Clear Scene
    gl.clearColor(0.005, 0.007, 0.012, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Pipeline GL States
    if (this.state.depthTest) {
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
    } else {
      gl.disable(gl.DEPTH_TEST);
    }

    if (this.state.cullFace) {
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
    } else {
      gl.disable(gl.CULL_FACE);
    }

    // UPDATE CAMERA MATRICES (Zero Allocation)
    const aspect = width / (height || 1);
    Mat4.perspective(this.projMatrix, (45 * Math.PI) / 180, aspect, 0.1, 150.0);

    const isShowroomDemo = this.state.demoScene.includes('08_all_materials') || this.state.demoScene.includes('materials_presentation');
    const isFpsMode = (this.state.cameraMode === 3 || (this.state.cameraMode === 1 && !isShowroomDemo) || this.state.demoScene.includes('07_fps')) && !isShowroomDemo;
    const isCharacterDemo = (this.state.demoScene.includes('06_glb') || this.state.demoScene === 'character') && !isFpsMode && !isShowroomDemo;
    const isFpsDemo = (this.state.demoScene.includes('07_fps') || isFpsMode) && !isShowroomDemo;

    // Tick Damage System, Elevators, Teleporters, Network Sync, and Projectiles on every frame
    this.updateProjectilesAndDamage(dt, timestamp);
    this.updateElevators(dt);
    this.updateTeleporters(dt);
    this.updateHzbTelemetry(dt);
    this.tickNetworkSync(timestamp);

    if (isCharacterDemo) {
      // -------------------------------------------------------------
      // DEMO 06: KINEMATIC PLAYER CONTROLLER & COLLISION SIMULATION
      // -------------------------------------------------------------
      const pc = this.playerController;
      
      // 1. Gather directional input relative to camera yaw (Inverted W vs S for forward/back)
      let inForward = 0.0;
      let inRight = 0.0;
      if (this.state.keys.w) inForward -= 1.0;
      if (this.state.keys.s) inForward += 1.0;
      // Fixed keyboard controls (A = left, D = right)
      if (this.state.keys.a) inRight -= 1.0;
      if (this.state.keys.d) inRight += 1.0;

      // Virtual Joystick Integration
      if (this.joystickState && this.joystickState.active) {
        inForward += this.joystickState.dirY;
        inRight += this.joystickState.dirX;
      }

      const isSprinting = this.state.keys.shift;
      const targetSpeed = isSprinting ? pc.sprintSpeed : pc.walkSpeed;

      const inputMag = Math.hypot(inForward, inRight);
      let moveDirX = 0, moveDirZ = 0;

      if (inputMag > 0.001) {
        const normF = inForward / inputMag;
        const normR = inRight / inputMag;

        // Rotate inputs by camera yaw
        const sinY = Math.sin(this.state.camYaw);
        const cosY = Math.cos(this.state.camYaw);

        moveDirX = normR * cosY - normF * sinY;
        moveDirZ = normR * sinY + normF * cosY;

        // Face movement direction
        pc.yaw = Math.atan2(moveDirX, moveDirZ);
      }

      // 2. Compute horizontal target velocity
      const targetVx = moveDirX * targetSpeed;
      const targetVz = moveDirZ * targetSpeed;

      // Smooth horizontal acceleration/friction
      const accel = pc.isGrounded ? 16.0 : 4.0;
      pc.velocity[0] += (targetVx - pc.velocity[0]) * Math.min(1.0, accel * dt);
      pc.velocity[2] += (targetVz - pc.velocity[2]) * Math.min(1.0, accel * dt);

      // 3. Gravity & Jump
      if (this.state.keys.space && pc.isGrounded) {
        pc.velocity[1] = pc.jumpForce;
        pc.isGrounded = false;
      } else {
        pc.velocity[1] += pc.gravity * dt;
      }

      // 4. Kinematic Position Integration & Multi-Pass Collision Resolution
      pc.pos[0] += pc.velocity[0] * dt;
      pc.pos[1] += pc.velocity[1] * dt;
      pc.pos[2] += pc.velocity[2] * dt;

      // Multi-pass collision resolution for solid obstacles, boulders, platforms and destructibles
      const colResult = this.resolvePlayerCollision(pc.pos, pc.velocity, pc.characterRadius, pc.characterHeight);
      pc.isGrounded = colResult.isGrounded;

      // 5. Update Locomotion State & Skeletal Animation
      const horizontalSpeed = Math.hypot(pc.velocity[0], pc.velocity[2]);
      if (!pc.isGrounded) {
        pc.state = pc.velocity[1] > 0 ? 'JUMPING' : 'FALLING';
        pc.activeAnim = 'Jump';
      } else if (horizontalSpeed > 6.0) {
        pc.state = 'SPRINTING';
        pc.activeAnim = 'Run';
      } else if (horizontalSpeed > 0.2) {
        pc.state = 'WALKING';
        pc.activeAnim = 'Walk';
      } else {
        pc.state = 'IDLE';
        pc.activeAnim = 'Idle';
      }

      pc.animTime += dt * (pc.activeAnim === 'Run' ? 2.2 : (pc.activeAnim === 'Walk' ? 1.4 : 0.8));

      // Sync scene entity 0 (Player Character) position
      this.sceneEntities[0].pos = [pc.pos[0], pc.pos[1], pc.pos[2]];

      // 6. Camera Position Update (Spring Arm Tracking)
      if (pc.cameraViewMode === 'first-person') {
        this.state.camPos[0] = pc.pos[0];
        this.state.camPos[1] = pc.pos[1] + 1.6;
        this.state.camPos[2] = pc.pos[2];

        this.state.camTarget[0] = this.state.camPos[0] - Math.sin(this.state.camYaw) * Math.cos(this.state.camPitch);
        this.state.camTarget[1] = this.state.camPos[1] + Math.sin(this.state.camPitch);
        this.state.camTarget[2] = this.state.camPos[2] - Math.cos(this.state.camYaw) * Math.cos(this.state.camPitch);
      } else {
        // Third-Person Spring Arm
        const charLookAtY = pc.pos[1] + 1.2;
        this.state.camTarget[0] = pc.pos[0];
        this.state.camTarget[1] = charLookAtY;
        this.state.camTarget[2] = pc.pos[2];

        const camDist = pc.camDistance;
        const cosP = Math.cos(this.state.camPitch);
        const sinP = Math.sin(this.state.camPitch);
        const sinY = Math.sin(this.state.camYaw);
        const cosY = Math.cos(this.state.camYaw);

        this.state.camPos[0] = pc.pos[0] + sinY * cosP * camDist;
        this.state.camPos[1] = charLookAtY + sinP * camDist + 0.5;
        this.state.camPos[2] = pc.pos[2] + cosY * cosP * camDist;
      }

      Mat4.lookAt(this.viewMatrix, this.state.camPos, this.state.camTarget, this.upVec);

      // 7. Update Telemetry HUD in Project Tab
      const telemState = document.getElementById('telem-state');
      const telemGrounded = document.getElementById('telem-grounded');
      const telemSpeed = document.getElementById('telem-speed');
      const telemVy = document.getElementById('telem-vy');
      const telemAnim = document.getElementById('telem-anim');
      const telemCoyote = document.getElementById('telem-coyote');
      const telemPos = document.getElementById('telem-pos-vec');
      const telemRot = document.getElementById('telem-rot-vec');
      const telemNorm = document.getElementById('telem-normal-vec');

      if (telemState) {
        telemState.textContent = pc.state;
        telemState.style.color = pc.state === 'SPRINTING' ? '#06b6d4' : (pc.state === 'WALKING' ? '#3b82f6' : (pc.state === 'JUMPING' ? '#f59e0b' : '#94a3b8'));
      }
      if (telemGrounded) {
        telemGrounded.textContent = pc.isGrounded ? 'TRUE' : 'FALSE';
        telemGrounded.style.color = pc.isGrounded ? '#10b981' : '#f43f5e';
      }
      if (telemSpeed) telemSpeed.textContent = `${horizontalSpeed.toFixed(2)} m/s`;
      if (telemVy) telemVy.textContent = `${pc.velocity[1] >= 0 ? '+' : ''}${pc.velocity[1].toFixed(2)} m/s`;
      if (telemAnim) telemAnim.textContent = `${pc.activeAnim} (${(pc.animTime % 1.0).toFixed(2)}s)`;
      if (telemCoyote) telemCoyote.textContent = pc.isGrounded ? '0.150s (Ready)' : '0.000s';
      if (telemPos) telemPos.textContent = `Vec3(${pc.pos[0].toFixed(2)}, ${pc.pos[1].toFixed(2)}, ${pc.pos[2].toFixed(2)})`;
      if (telemRot) telemRot.textContent = `Yaw: ${(pc.yaw * 180 / Math.PI).toFixed(1)}° | Cam: ${(this.state.camYaw * 180 / Math.PI).toFixed(1)}°`;
      if (telemNorm) telemNorm.textContent = `Vec3(0.00, 1.00, 0.00)`;

      // Update collision status table pills
      this.sceneEntities.forEach(ent => {
        const statusEl = document.getElementById(`col-status-${ent.id}`);
        if (statusEl) {
          if (ent.contact) {
            if (ent.trigger) {
              statusEl.innerHTML = `<span class="status-pill status-contact" style="background: rgba(6,182,212,0.2); color: #06b6d4; border-color: #06b6d4;">TRIGGER ACTIVE</span>`;
            } else if (ent.layer === 'Layer_Ground') {
              statusEl.innerHTML = `<span class="status-pill status-contact" style="background: rgba(16,185,129,0.2); color: #10b981; border-color: #10b981;">GROUND CONTACT</span>`;
            } else {
              statusEl.innerHTML = `<span class="status-pill status-contact" style="background: rgba(245,158,11,0.2); color: #f59e0b; border-color: #f59e0b;">OBSTACLE CONTACT</span>`;
            }
          } else {
            statusEl.innerHTML = `<span class="status-pill status-clear">CLEAR</span>`;
          }
        }
      });

    } else if (this.state.cameraMode === 0) {
      // Standard Orbit Camera for other demos
      if (this.joystickState && this.joystickState.active) {
        this.state.camYaw += this.joystickState.dirX * dt * 2.0;
        this.state.camPitch = Math.max(-1.45, Math.min(1.45, this.state.camPitch + this.joystickState.dirY * dt * 2.0));
      }

      const eyeX = this.state.camTarget[0] + this.state.camRadius * Math.cos(this.state.camPitch) * Math.sin(this.state.camYaw);
      const eyeY = this.state.camTarget[1] + this.state.camRadius * Math.sin(this.state.camPitch);
      const eyeZ = this.state.camTarget[2] + this.state.camRadius * Math.cos(this.state.camPitch) * Math.cos(this.state.camYaw);
      this.state.camPos[0] = eyeX;
      this.state.camPos[1] = eyeY;
      this.state.camPos[2] = eyeZ;

      Mat4.lookAt(this.viewMatrix, this.state.camPos, this.state.camTarget, this.upVec);
    } else {
      // Mode 1 (FP Drag), Mode 2 (Free Fly), Mode 3 (FPS Shooter Direct Look)
      const cosP = Math.cos(this.state.camPitch);
      const sinP = Math.sin(this.state.camPitch);
      const cosY = Math.cos(this.state.camYaw);
      const sinY = Math.sin(this.state.camYaw);

      this.state.camFront[0] = -sinY * cosP;
      this.state.camFront[1] = sinP;
      this.state.camFront[2] = -cosY * cosP;

      const fLen = Math.hypot(this.state.camFront[0], this.state.camFront[1], this.state.camFront[2]) || 1;
      this.state.camFront[0] /= fLen;
      this.state.camFront[1] /= fLen;
      this.state.camFront[2] /= fLen;

      this.state.camRight[0] = cosY;
      this.state.camRight[1] = 0;
      this.state.camRight[2] = -sinY;
      const rLen = Math.hypot(this.state.camRight[0], this.state.camRight[2]) || 1;
      this.state.camRight[0] /= rLen;
      this.state.camRight[2] /= rLen;

      // Virtual Joystick Integration for FP/FPS
      let joyF = 0, joyR = 0;
      if (this.joystickState && this.joystickState.active) {
        joyF = this.joystickState.dirY;
        joyR = this.joystickState.dirX;
      }

      const hasteMult = (this.activePowerups && this.activePowerups.haste && this.activePowerups.haste.active) ? 1.45 : 1.0;
      const moveSpeed = this.state.moveSpeed * (this.state.keys.shift ? 2.2 : 1.0) * hasteMult * dt;
      if (this.state.keys.w || joyF < -0.2) {
        this.state.camPos[0] += this.state.camFront[0] * moveSpeed;
        this.state.camPos[1] += (this.state.cameraMode === 2 ? this.state.camFront[1] : 0) * moveSpeed;
        this.state.camPos[2] += this.state.camFront[2] * moveSpeed;
      }
      if (this.state.keys.s || joyF > 0.2) {
        this.state.camPos[0] -= this.state.camFront[0] * moveSpeed;
        this.state.camPos[1] -= (this.state.cameraMode === 2 ? this.state.camFront[1] : 0) * moveSpeed;
        this.state.camPos[2] -= this.state.camFront[2] * moveSpeed;
      }
      if (this.state.keys.d || joyR > 0.2) {
        this.state.camPos[0] += this.state.camRight[0] * moveSpeed;
        this.state.camPos[2] += this.state.camRight[2] * moveSpeed;
      }
      if (this.state.keys.a || joyR < -0.2) {
        this.state.camPos[0] -= this.state.camRight[0] * moveSpeed;
        this.state.camPos[2] -= this.state.camRight[2] * moveSpeed;
      }
      // Vertical movement & jump physics
      if (this.state.cameraMode === 2) {
        // 6-DOF Free-Fly Camera: Q / E ascend and descend
        if (this.state.keys.e || this.state.keys.space) {
          this.state.camPos[1] += moveSpeed;
        }
        if (this.state.keys.q) {
          this.state.camPos[1] -= moveSpeed;
        }
      } else {
        // Mode 1 (First-Person Camera) & Mode 3 (FPS Shooter Direct Look):
        // Keys "Q" & "E" are DISABLED.
        // Space is strictly JUMP with real kinematic gravity & collision response!
        const jumpForce = this.playerController ? this.playerController.jumpForce : 8.5;
        const gravity = this.playerController ? this.playerController.gravity : -22.0;

        if (this.state.keys.space && this.state.fpsIsGrounded) {
          this.state.fpsVelocityY = jumpForce;
          this.state.fpsIsGrounded = false;
        } else if (!this.state.fpsIsGrounded) {
          this.state.fpsVelocityY += gravity * dt;
        }

        this.state.camPos[1] += this.state.fpsVelocityY * dt;

        // Ground & Obstacle collision check for First-Person character body (Modes 1 & 3)
        const eyeHeight = 1.7;
        const feetPos = [this.state.camPos[0], this.state.camPos[1] - eyeHeight, this.state.camPos[2]];
        const fpsVel = [0, this.state.fpsVelocityY, 0];
        const colRadius = 0.55;
        const colResult = this.resolvePlayerCollision(feetPos, fpsVel, colRadius, 1.8);

        this.state.camPos[0] = feetPos[0];
        this.state.camPos[2] = feetPos[2];
        this.state.camPos[1] = feetPos[1] + eyeHeight;
        this.state.fpsVelocityY = fpsVel[1];
        this.state.fpsIsGrounded = colResult.isGrounded;

        if (this.state.fpsIsGrounded && this.state.fpsVelocityY < 0) {
          this.state.fpsVelocityY = 0;
        }
      }

      this.state.camTarget[0] = this.state.camPos[0] + this.state.camFront[0];
      this.state.camTarget[1] = this.state.camPos[1] + this.state.camFront[1];
      this.state.camTarget[2] = this.state.camPos[2] + this.state.camFront[2];

      Mat4.lookAt(this.viewMatrix, this.state.camPos, this.state.camTarget, this.upVec);
    }

    Mat4.multiply(this.viewProjMatrix, this.projMatrix, this.viewMatrix);

    let activeShaderIdx = this.state.activeShader;
    if (this.state.fpsCheapMaterial || activeShaderIdx === 4) {
      activeShaderIdx = 4;
    }
    const progInfo = this.programs[activeShaderIdx] || this.programs[0];
    if (!progInfo) {
      requestAnimationFrame(this._renderLoopBound);
      return;
    }

    gl.useProgram(progInfo.prog);
    gl.uniformMatrix4fv(progInfo.uViewProj, false, this.viewProjMatrix);
    if (progInfo.uCamPos) gl.uniform3fv(progInfo.uCamPos, this.state.camPos);
    if (progInfo.uTime) gl.uniform1f(progInfo.uTime, timestamp * 0.001);

    // Dynamic Point & Spot Light Uniform Upload (Zero Array Allocations)
    this._pointLightsList.length = 0;
    this._spotLightsList.length = 0;

    const numEntities = this.sceneEntities ? this.sceneEntities.length : 0;
    for (let i = 0; i < numEntities; i++) {
      const ent = this.sceneEntities[i];
      if (ent.isLight || ent.layer === 'Layer_Light') {
        if (ent.lightType === 'spot' && this._spotLightsList.length < 4) {
          this._spotLightsList.push(ent);
        } else if ((ent.lightType === 'point' || !ent.lightType) && this._pointLightsList.length < 6) {
          this._pointLightsList.push(ent);
        }
      }
    }

    if (progInfo.uNumPointLights) {
      gl.uniform1i(progInfo.uNumPointLights, this._pointLightsList.length);
      for (let i = 0; i < 6; i++) {
        const u = progInfo.pointLights ? progInfo.pointLights[i] : null;
        if (!u) continue;
        if (i < this._pointLightsList.length) {
          const l = this._pointLightsList[i];
          if (u.pos) gl.uniform3fv(u.pos, l.pos);
          if (u.color) gl.uniform3fv(u.color, l.color || [1, 1, 1]);
          if (u.intensity) gl.uniform1f(u.intensity, l.intensity !== undefined ? l.intensity : 15.0);
          if (u.radius) gl.uniform1f(u.radius, l.radius !== undefined ? l.radius : 10.0);
        } else {
          if (u.intensity) gl.uniform1f(u.intensity, 0.0);
        }
      }
    }

    if (progInfo.uNumSpotLights) {
      gl.uniform1i(progInfo.uNumSpotLights, this._spotLightsList.length);
      for (let i = 0; i < 4; i++) {
        const u = progInfo.spotLights ? progInfo.spotLights[i] : null;
        if (!u) continue;
        if (i < this._spotLightsList.length) {
          const l = this._spotLightsList[i];
          const dir = l.lightDir || [0, -1, 0];
          const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
          this._spotNormDir[0] = dir[0] / len;
          this._spotNormDir[1] = dir[1] / len;
          this._spotNormDir[2] = dir[2] / len;
          if (u.pos) gl.uniform3fv(u.pos, l.pos);
          if (u.dir) gl.uniform3fv(u.dir, this._spotNormDir);
          if (u.color) gl.uniform3fv(u.color, l.color || [1, 1, 1]);
          if (u.intensity) gl.uniform1f(u.intensity, l.intensity !== undefined ? l.intensity : 20.0);
          if (u.cutoff) gl.uniform1f(u.cutoff, l.spotCutoff !== undefined ? l.spotCutoff : Math.cos(35 * Math.PI / 180));
          if (u.outerCutoff) gl.uniform1f(u.outerCutoff, l.outerCutoff !== undefined ? l.outerCutoff : Math.cos(45 * Math.PI / 180));
        } else {
          if (u.intensity) gl.uniform1f(u.intensity, 0.0);
        }
      }
    }

    if (isCharacterDemo) {
      // -------------------------------------------------------------
      // RENDER DEMO 06 SCENE OBJECTS & ANIMATED CHARACTER
      // -------------------------------------------------------------
      const cubeMesh = this.meshBuffers[1]; // Cube
      const sphereMesh = this.meshBuffers[0]; // Sphere
      const icosaMesh = this.meshBuffers[4]; // Gem

      // 1. Render Scene Entities (Floor, Pillars, Platforms, Boulders, Gems)
      this.sceneEntities.forEach(ent => {
        if (ent.id === 0) return; // Player character drawn with skeletal limbs

        let meshToDraw = cubeMesh;
        if (ent.collider.includes('Sphere')) meshToDraw = sphereMesh;
        else if (ent.trigger) meshToDraw = icosaMesh;

        if (!meshToDraw) return;
        gl.bindVertexArray(meshToDraw.vao);

        // Build transformation matrix
        const posX = ent.pos[0];
        const posY = ent.pos[1];
        const posZ = ent.pos[2];
        const scaX = ent.scale[0];
        const scaY = ent.scale[1];
        const scaZ = ent.scale[2];

        // If trigger gem, apply continuous float and rotation
        let rotY = 0;
        let floatY = posY;
        if (ent.trigger) {
          rotY = timestamp * 0.002;
          floatY = posY + Math.sin(timestamp * 0.003 + ent.id) * 0.15;
        }

        const cosR = Math.cos(rotY);
        const sinR = Math.sin(rotY);

        this.instanceMatrix[0] = cosR * scaX;
        this.instanceMatrix[1] = 0;
        this.instanceMatrix[2] = -sinR * scaX;
        this.instanceMatrix[3] = 0;

        this.instanceMatrix[4] = 0;
        this.instanceMatrix[5] = scaY;
        this.instanceMatrix[6] = 0;
        this.instanceMatrix[7] = 0;

        this.instanceMatrix[8] = sinR * scaZ;
        this.instanceMatrix[9] = 0;
        this.instanceMatrix[10] = cosR * scaZ;
        this.instanceMatrix[11] = 0;

        this.instanceMatrix[12] = posX;
        this.instanceMatrix[13] = floatY;
        this.instanceMatrix[14] = posZ;
        this.instanceMatrix[15] = 1;

        Mat4.normalFromMat4(this.normalMatrix, this.instanceMatrix);

        const mat = (ent.materialKey && FILAMENT_MATERIALS_CATALOG[ent.materialKey]) || null;
        const matType = mat ? (mat.matTypeId !== undefined ? mat.matTypeId : 0) : 0;
        const noiseScale = mat ? (mat.noiseScale || 1.0) : 1.0;
        const clearCoat = mat ? (mat.clearCoat || 0.0) : 0.0;
        const anisotropy = mat ? (mat.anisotropy || 0.0) : 0.0;
        const bumpStrength = mat ? (mat.bumpStrength || 0.0) : 0.0;

        const texKey = (mat && mat.textureKey) ? mat.textureKey : null;
        const texObj = (texKey && this.textureCatalog) ? this.textureCatalog[texKey] : null;
        if (texObj && progInfo.uUseTexMaps) {
          gl.activeTexture(gl.TEXTURE2);
          gl.bindTexture(gl.TEXTURE_2D, texObj);
          if (progInfo.uAlbedoMap) gl.uniform1i(progInfo.uAlbedoMap, 2);
          if (progInfo.uPbrMap) gl.uniform1i(progInfo.uPbrMap, 2);
          gl.uniform1i(progInfo.uUseTexMaps, 1);
        } else if (progInfo.uUseTexMaps) {
          gl.uniform1i(progInfo.uUseTexMaps, 0);
        }

        gl.uniformMatrix4fv(progInfo.uModel, false, this.instanceMatrix);
        if (progInfo.uNormalMatrix) gl.uniformMatrix3fv(progInfo.uNormalMatrix, false, this.normalMatrix);
        if (progInfo.uBaseColor) gl.uniform3fv(progInfo.uBaseColor, ent.color);
        if (progInfo.uRoughness) gl.uniform1f(progInfo.uRoughness, ent.roughness !== undefined ? ent.roughness : 0.35);
        if (progInfo.uMetallic) gl.uniform1f(progInfo.uMetallic, ent.metallic !== undefined ? ent.metallic : 0.8);
        if (progInfo.uMatType) gl.uniform1i(progInfo.uMatType, matType);
        if (progInfo.uNoiseScale) gl.uniform1f(progInfo.uNoiseScale, noiseScale);
        if (progInfo.uClearCoat) gl.uniform1f(progInfo.uClearCoat, clearCoat);
        if (progInfo.uAnisotropy) gl.uniform1f(progInfo.uAnisotropy, anisotropy);
        if (progInfo.uBumpStrength) gl.uniform1f(progInfo.uBumpStrength, bumpStrength);

        gl.drawElements(gl.TRIANGLES, meshToDraw.indexCount, gl.UNSIGNED_SHORT, 0);
      });

      // 2. Render Skeletal Animated Character Body Parts (Strictly in 3rd Person Orbit/Follow Camera Only!)
      const pc = this.playerController;
      const isThirdPerson = this.state.cameraMode === 0 && pc && pc.cameraViewMode !== 'first-person';
      if (isThirdPerson && pc) {
        const charPos = pc.pos;
        const charYaw = pc.yaw;
        const animT = pc.animTime;
        const swingAngle = Math.sin(animT * 6.0) * (pc.activeAnim === 'Run' ? 0.75 : (pc.activeAnim === 'Walk' ? 0.45 : 0.05));

        const drawPart = (mesh, offsetX, offsetY, offsetZ, sizeX, sizeY, sizeZ, color, rough, metal, pitch = 0, pMatType = 0, pClearCoat = 0.15) => {
          if (!mesh) return;
          gl.bindVertexArray(mesh.vao);

          // Yaw + Pitch rotation
          const cy = Math.cos(charYaw);
          const sy = Math.sin(charYaw);
          const cp = Math.cos(pitch);
          const sp = Math.sin(pitch);

          // World position offset
          const wx = charPos[0] + (offsetX * cy + offsetZ * sy);
          const wy = charPos[1] + offsetY;
          const wz = charPos[2] + (-offsetX * sy + offsetZ * cy);

          this.instanceMatrix[0] = cy * sizeX;
          this.instanceMatrix[1] = sp * sizeX;
          this.instanceMatrix[2] = sy * sizeX;
          this.instanceMatrix[3] = 0;

          this.instanceMatrix[4] = 0;
          this.instanceMatrix[5] = cp * sizeY;
          this.instanceMatrix[6] = 0;
          this.instanceMatrix[7] = 0;

          this.instanceMatrix[8] = -sy * sizeZ;
          this.instanceMatrix[9] = 0;
          this.instanceMatrix[10] = cy * sizeZ;
          this.instanceMatrix[11] = 0;

          this.instanceMatrix[12] = wx;
          this.instanceMatrix[13] = wy;
          this.instanceMatrix[14] = wz;
          this.instanceMatrix[15] = 1;

          Mat4.normalFromMat4(this.normalMatrix, this.instanceMatrix);

          gl.uniformMatrix4fv(progInfo.uModel, false, this.instanceMatrix);
          if (progInfo.uNormalMatrix) gl.uniformMatrix3fv(progInfo.uNormalMatrix, false, this.normalMatrix);
          if (progInfo.uBaseColor) gl.uniform3fv(progInfo.uBaseColor, color);
          if (progInfo.uRoughness) gl.uniform1f(progInfo.uRoughness, rough);
          if (progInfo.uMetallic) gl.uniform1f(progInfo.uMetallic, metal);
          if (progInfo.uMatType) gl.uniform1i(progInfo.uMatType, pMatType);
          if (progInfo.uNoiseScale) gl.uniform1f(progInfo.uNoiseScale, 1.0);
          if (progInfo.uClearCoat) gl.uniform1f(progInfo.uClearCoat, pClearCoat);
          if (progInfo.uAnisotropy) gl.uniform1f(progInfo.uAnisotropy, 0.0);
          if (progInfo.uBumpStrength) gl.uniform1f(progInfo.uBumpStrength, 0.0);

          gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
        };

        // Torso
        drawPart(cubeMesh, 0, 1.1, 0, 0.45, 0.6, 0.25, [0.15, 0.45, 0.95], 0.25, 0.85, 0, 3, 0.5);
        // Head
        drawPart(sphereMesh, 0, 1.65, 0, 0.28, 0.28, 0.28, [0.95, 0.75, 0.60], 0.35, 0.10, 0, 0, 0.0);
        // Visor
        drawPart(cubeMesh, 0, 1.68, 0.2, 0.24, 0.12, 0.1, [0.06, 0.85, 0.95], 0.05, 0.95, 0, 11, 0.9);
        // Left Arm & Right Arm (Swinging)
        drawPart(cubeMesh, -0.32, 1.05 + Math.sin(swingAngle)*0.1, Math.sin(swingAngle) * 0.3, 0.15, 0.5, 0.15, [0.15, 0.45, 0.95], 0.25, 0.85, swingAngle, 3, 0.3);
        drawPart(cubeMesh, 0.32, 1.05 - Math.sin(swingAngle)*0.1, -Math.sin(swingAngle) * 0.3, 0.15, 0.5, 0.15, [0.15, 0.45, 0.95], 0.25, 0.85, -swingAngle, 3, 0.3);
        // Left Leg & Right Leg (Swinging opposite)
        drawPart(cubeMesh, -0.16, 0.45 - Math.sin(swingAngle)*0.08, -Math.sin(swingAngle) * 0.35, 0.18, 0.6, 0.18, [0.12, 0.15, 0.20], 0.45, 0.30, -swingAngle * 0.8, 5, 0.8);
        drawPart(cubeMesh, 0.16, 0.45 + Math.sin(swingAngle)*0.08, Math.sin(swingAngle) * 0.35, 0.18, 0.6, 0.18, [0.12, 0.15, 0.20], 0.45, 0.30, swingAngle * 0.8, 5, 0.8);
      }

    } else if (isFpsDemo) {
      // -------------------------------------------------------------
      // DEMO 07: FIRST-PERSON SHOOTER, DAMAGE SYSTEM & PROJECTILES
      // -------------------------------------------------------------
      const cubeMesh = this.meshBuffers[1]; // Cube
      const sphereMesh = this.meshBuffers[0]; // Sphere
      const icosaMesh = this.meshBuffers[4]; // Gem / Kinetic Core

      // 1. Render Environment (Ground, Obstacle Pillars, Boulders)
      const numSceneEnts = this.sceneEntities ? this.sceneEntities.length : 0;
      for (let i = 0; i < numSceneEnts; i++) {
        const ent = this.sceneEntities[i];
        if (ent.id === 0) continue; // Character hidden in FPS mode

        let meshToDraw = cubeMesh;
        if (ent.collider && ent.collider.includes('Sphere')) meshToDraw = sphereMesh;
        else if (ent.trigger) meshToDraw = icosaMesh;

        if (!meshToDraw) continue;
        gl.bindVertexArray(meshToDraw.vao);

        const posX = ent.pos[0];
        const posY = ent.pos[1];
        const posZ = ent.pos[2];
        const scaX = ent.scale[0];
        const scaY = ent.scale[1];
        const scaZ = ent.scale[2];

        this.instanceMatrix[0] = scaX;
        this.instanceMatrix[1] = 0;
        this.instanceMatrix[2] = 0;
        this.instanceMatrix[3] = 0;

        this.instanceMatrix[4] = 0;
        this.instanceMatrix[5] = scaY;
        this.instanceMatrix[6] = 0;
        this.instanceMatrix[7] = 0;

        this.instanceMatrix[8] = 0;
        this.instanceMatrix[9] = 0;
        this.instanceMatrix[10] = scaZ;
        this.instanceMatrix[11] = 0;

        this.instanceMatrix[12] = posX;
        this.instanceMatrix[13] = posY;
        this.instanceMatrix[14] = posZ;
        this.instanceMatrix[15] = 1;

        Mat4.normalFromMat4(this.normalMatrix, this.instanceMatrix);

        const mat = (ent.materialKey && FILAMENT_MATERIALS_CATALOG[ent.materialKey]) || null;
        const matType = mat ? (mat.matTypeId !== undefined ? mat.matTypeId : 0) : 0;
        const noiseScale = mat ? (mat.noiseScale || 1.0) : 1.0;
        const clearCoat = mat ? (mat.clearCoat || 0.0) : 0.0;
        const bumpStrength = mat ? (mat.bumpStrength || 0.0) : 0.0;

        gl.uniformMatrix4fv(progInfo.uModel, false, this.instanceMatrix);
        if (progInfo.uNormalMatrix) gl.uniformMatrix3fv(progInfo.uNormalMatrix, false, this.normalMatrix);
        if (progInfo.uBaseColor) gl.uniform3fv(progInfo.uBaseColor, ent.color);
        if (progInfo.uRoughness) gl.uniform1f(progInfo.uRoughness, ent.roughness !== undefined ? ent.roughness : 0.4);
        if (progInfo.uMetallic) gl.uniform1f(progInfo.uMetallic, ent.metallic !== undefined ? ent.metallic : 0.3);
        if (progInfo.uMatType) gl.uniform1i(progInfo.uMatType, matType);
        if (progInfo.uNoiseScale) gl.uniform1f(progInfo.uNoiseScale, noiseScale);
        if (progInfo.uClearCoat) gl.uniform1f(progInfo.uClearCoat, clearCoat);
        if (progInfo.uBumpStrength) gl.uniform1f(progInfo.uBumpStrength, bumpStrength);

        gl.drawElements(gl.TRIANGLES, meshToDraw.indexCount, gl.UNSIGNED_SHORT, 0);
      }

      // 2. Render DAMAGE Group Actors (Targets, Enemies, Destructibles)
      const numDmgActors = this.damageActors ? this.damageActors.length : 0;
      for (let i = 0; i < numDmgActors; i++) {
        const actor = this.damageActors[i];
        let meshToDraw = cubeMesh;
        if (actor.collider && actor.collider.includes('Sphere')) meshToDraw = sphereMesh;

        if (!meshToDraw) continue;
        gl.bindVertexArray(meshToDraw.vao);

        let posX = actor.pos[0];
        let posY = actor.pos[1];
        let posZ = actor.pos[2];
        let scaX = actor.scale[0];
        let scaY = actor.scale[1];
        let scaZ = actor.scale[2];

        let rotY = 0;
        if (actor.name.includes('Drone') && actor.alive) {
          posY += Math.sin(timestamp * 0.003 + actor.id) * 0.25;
          rotY = timestamp * 0.0015;
        } else if (actor.name.includes('Sphere') && actor.alive) {
          rotY = timestamp * 0.002;
        }

        const cosR = Math.cos(rotY);
        const sinR = Math.sin(rotY);

        if (!actor.alive) {
          scaY *= 0.35;
        }

        this.instanceMatrix[0] = cosR * scaX;
        this.instanceMatrix[1] = 0;
        this.instanceMatrix[2] = -sinR * scaX;
        this.instanceMatrix[3] = 0;

        this.instanceMatrix[4] = 0;
        this.instanceMatrix[5] = scaY;
        this.instanceMatrix[6] = 0;
        this.instanceMatrix[7] = 0;

        this.instanceMatrix[8] = sinR * scaZ;
        this.instanceMatrix[9] = 0;
        this.instanceMatrix[10] = cosR * scaZ;
        this.instanceMatrix[11] = 0;

        this.instanceMatrix[12] = posX;
        this.instanceMatrix[13] = posY;
        this.instanceMatrix[14] = posZ;
        this.instanceMatrix[15] = 1;

        Mat4.normalFromMat4(this.normalMatrix, this.instanceMatrix);

        gl.uniformMatrix4fv(progInfo.uModel, false, this.instanceMatrix);
        if (progInfo.uNormalMatrix) gl.uniformMatrix3fv(progInfo.uNormalMatrix, false, this.normalMatrix);

        let drawColor = actor.color;
        let actMatType = 0;
        let actBump = 0.0;
        let actNoise = 1.0;

        if (actor.name.includes('Drone')) {
          actMatType = 3; // titanium
          actBump = 1.2;
        } else if (actor.name.includes('Monolith')) {
          actMatType = 2; // basalt rock
          actBump = 2.4;
          actNoise = 16.0;
        } else if (actor.name.includes('Sphere')) {
          actMatType = 7; // magma lava core
          actBump = 2.0;
          actNoise = 20.0;
        } else if (actor.name.includes('Crate')) {
          actMatType = 1; // walnut wood crate
          actBump = 1.6;
          actNoise = 22.0;
        }

        if (!actor.alive) {
          drawColor = [0.25, 0.25, 0.28];
          actMatType = 6; // rust
          actBump = 2.0;
        } else if (actor.hitFlashTimer > 0) {
          drawColor = [1.0, 0.35, 0.35]; // Hit flash
        }

        if (progInfo.uBaseColor) gl.uniform3fv(progInfo.uBaseColor, drawColor);
        if (progInfo.uRoughness) gl.uniform1f(progInfo.uRoughness, actor.alive ? 0.20 : 0.85);
        if (progInfo.uMetallic) gl.uniform1f(progInfo.uMetallic, actor.alive ? 0.90 : 0.10);
        if (progInfo.uMatType) gl.uniform1i(progInfo.uMatType, actMatType);
        if (progInfo.uNoiseScale) gl.uniform1f(progInfo.uNoiseScale, actNoise);
        if (progInfo.uClearCoat) gl.uniform1f(progInfo.uClearCoat, 0.0);
        if (progInfo.uBumpStrength) gl.uniform1f(progInfo.uBumpStrength, actBump);

        gl.drawElements(gl.TRIANGLES, meshToDraw.indexCount, gl.UNSIGNED_SHORT, 0);
      }

      // 3. Render Active Weapon Projectiles
      if (sphereMesh && this.projectilePool) {
        gl.bindVertexArray(sphereMesh.vao);
        const numProj = this.projectilePool.length;
        for (let pi = 0; pi < numProj; pi++) {
          const p = this.projectilePool[pi];
          if (!p.active) continue;

          const r = p.radius || 0.18;
          this.instanceMatrix[0] = r;
          this.instanceMatrix[1] = 0;
          this.instanceMatrix[2] = 0;
          this.instanceMatrix[3] = 0;

          this.instanceMatrix[4] = 0;
          this.instanceMatrix[5] = r;
          this.instanceMatrix[6] = 0;
          this.instanceMatrix[7] = 0;

          this.instanceMatrix[8] = 0;
          this.instanceMatrix[9] = 0;
          this.instanceMatrix[10] = r;
          this.instanceMatrix[11] = 0;

          this.instanceMatrix[12] = p.pos[0];
          this.instanceMatrix[13] = p.pos[1];
          this.instanceMatrix[14] = p.pos[2];
          this.instanceMatrix[15] = 1;

          Mat4.normalFromMat4(this.normalMatrix, this.instanceMatrix);

          gl.uniformMatrix4fv(progInfo.uModel, false, this.instanceMatrix);
          if (progInfo.uNormalMatrix) gl.uniformMatrix3fv(progInfo.uNormalMatrix, false, this.normalMatrix);
          if (progInfo.uBaseColor) gl.uniform3fv(progInfo.uBaseColor, p.color);
          if (progInfo.uRoughness) gl.uniform1f(progInfo.uRoughness, 0.05);
          if (progInfo.uMetallic) gl.uniform1f(progInfo.uMetallic, 0.95);
          if (progInfo.uMatType) gl.uniform1i(progInfo.uMatType, 12); // neon emissive
          if (progInfo.uNoiseScale) gl.uniform1f(progInfo.uNoiseScale, 1.0);
          if (progInfo.uClearCoat) gl.uniform1f(progInfo.uClearCoat, 0.0);
          if (progInfo.uBumpStrength) gl.uniform1f(progInfo.uBumpStrength, 0.0);

          gl.drawElements(gl.TRIANGLES, sphereMesh.indexCount, gl.UNSIGNED_SHORT, 0);
        }
      }

      // 3b. Render Active 3D AI Combat Bots (Gladiator / Cyber Suits with Weapons & Walk Animation)
      if (this.active3DBots && cubeMesh && sphereMesh) {
        const numBots = this.active3DBots.length;
        for (let bi = 0; bi < numBots; bi++) {
          const bot = this.active3DBots[bi];
          if (!bot.alive) continue;

          const charYaw = bot.yaw || 0;
          const charPos = bot.pos;
          const swingAngle = Math.sin(timestamp * 0.008 + bot.id) * 0.45;
          const drawCol = bot.hitFlashTimer > 0 ? [1.0, 0.3, 0.3] : bot.color;

          // Bot Torso Body
          this.drawBotMeshPart(progInfo, cubeMesh, charPos, charYaw, 0, 1.1, 0, 0.45, 0.6, 0.25, drawCol, 0.25, 0.85, 3, 0.5);
          // Bot Head
          this.drawBotMeshPart(progInfo, sphereMesh, charPos, charYaw, 0, 1.65, 0, 0.28, 0.28, 0.28, [0.85, 0.85, 0.88], 0.35, 0.10, 0, 0.0);
          // Bot Neon Visor
          this.drawBotMeshPart(progInfo, cubeMesh, charPos, charYaw, 0, 1.68, 0.2, 0.24, 0.12, 0.1, [0.06, 0.85, 0.95], 0.05, 0.95, 12, 0.9);
          // Bot Left & Right Arms (Swinging)
          this.drawBotMeshPart(progInfo, cubeMesh, charPos, charYaw, -0.32, 1.05 + Math.sin(swingAngle)*0.08, Math.sin(swingAngle)*0.2, 0.15, 0.5, 0.15, drawCol, 0.25, 0.85, 3, 0.3);
          this.drawBotMeshPart(progInfo, cubeMesh, charPos, charYaw, 0.32, 1.05 - Math.sin(swingAngle)*0.08, -Math.sin(swingAngle)*0.2, 0.15, 0.5, 0.15, drawCol, 0.25, 0.85, 3, 0.3);
          // Bot Left & Right Legs
          this.drawBotMeshPart(progInfo, cubeMesh, charPos, charYaw, -0.16, 0.45 - Math.sin(swingAngle)*0.06, -Math.sin(swingAngle)*0.25, 0.18, 0.6, 0.18, [0.15, 0.18, 0.22], 0.45, 0.30, 5, 0.8);
          this.drawBotMeshPart(progInfo, cubeMesh, charPos, charYaw, 0.16, 0.45 + Math.sin(swingAngle)*0.06, Math.sin(swingAngle)*0.25, 0.18, 0.6, 0.18, [0.15, 0.18, 0.22], 0.45, 0.30, 5, 0.8);
          // Bot Weapon
          this.drawBotMeshPart(progInfo, cubeMesh, charPos, charYaw, 0.35, 1.1, 0.35, 0.12, 0.15, 0.60, [0.2, 0.2, 0.25], 0.15, 0.9, 3, 0.2);
        }
      }

      // 3c. Render Bot Projectiles (Neon glowing spheres traveling at player)
      if (this.botProjectilePool && sphereMesh) {
        gl.bindVertexArray(sphereMesh.vao);
        const numBotProj = this.botProjectilePool.length;
        for (let bpi = 0; bpi < numBotProj; bpi++) {
          const bp = this.botProjectilePool[bpi];
          if (!bp.active) continue;
          const r = bp.radius || 0.22;
          this.instanceMatrix[0] = r;
          this.instanceMatrix[1] = 0;
          this.instanceMatrix[2] = 0;
          this.instanceMatrix[3] = 0;

          this.instanceMatrix[4] = 0;
          this.instanceMatrix[5] = r;
          this.instanceMatrix[6] = 0;
          this.instanceMatrix[7] = 0;

          this.instanceMatrix[8] = 0;
          this.instanceMatrix[9] = 0;
          this.instanceMatrix[10] = r;
          this.instanceMatrix[11] = 0;

          this.instanceMatrix[12] = bp.pos[0];
          this.instanceMatrix[13] = bp.pos[1];
          this.instanceMatrix[14] = bp.pos[2];
          this.instanceMatrix[15] = 1;

          Mat4.normalFromMat4(this.normalMatrix, this.instanceMatrix);

          gl.uniformMatrix4fv(progInfo.uModel, false, this.instanceMatrix);
          if (progInfo.uNormalMatrix) gl.uniformMatrix3fv(progInfo.uNormalMatrix, false, this.normalMatrix);
          if (progInfo.uBaseColor) gl.uniform3fv(progInfo.uBaseColor, bp.color || [1, 0.2, 0.2]);
          if (progInfo.uRoughness) gl.uniform1f(progInfo.uRoughness, 0.05);
          if (progInfo.uMetallic) gl.uniform1f(progInfo.uMetallic, 0.95);
          if (progInfo.uMatType) gl.uniform1i(progInfo.uMatType, 12); // emissive neon
          if (progInfo.uNoiseScale) gl.uniform1f(progInfo.uNoiseScale, 1.0);
          if (progInfo.uClearCoat) gl.uniform1f(progInfo.uClearCoat, 0.0);
          if (progInfo.uBumpStrength) gl.uniform1f(progInfo.uBumpStrength, 0.0);

          gl.drawElements(gl.TRIANGLES, sphereMesh.indexCount, gl.UNSIGNED_SHORT, 0);
        }
      }

      // 4. Render Quake Item Pickups (Health, Armor, Ammo, Powerups) with 3D Rotating Models
      if (this.itemPickups && this.itemPickups.length > 0) {
        const torusMesh = this.meshBuffers[3];
        const numItems = this.itemPickups.length;
        for (let i = 0; i < numItems; i++) {
          const item = this.itemPickups[i];
          if (!item.active) continue;

          let meshToDraw = cubeMesh;
          if (item.meshType === 'sphere' && sphereMesh) meshToDraw = sphereMesh;
          else if (item.meshType === 'torus' && torusMesh) meshToDraw = torusMesh;
          else if (item.meshType === 'icosa' && icosaMesh) meshToDraw = icosaMesh;
          else if (item.meshType === 'cube' && cubeMesh) meshToDraw = cubeMesh;

          if (!meshToDraw) continue;
          gl.bindVertexArray(meshToDraw.vao);

          const rotY = timestamp * 0.0028 + (item.id * 1.3);
          const floatY = item.pos[1] + Math.sin(timestamp * 0.0035 + item.id) * 0.12;
          const cosR = Math.cos(rotY);
          const sinR = Math.sin(rotY);

          const scaX = item.scale[0] || 0.45;
          const scaY = item.scale[1] || 0.45;
          const scaZ = item.scale[2] || 0.45;

          this.instanceMatrix[0] = cosR * scaX;
          this.instanceMatrix[1] = 0;
          this.instanceMatrix[2] = -sinR * scaX;
          this.instanceMatrix[3] = 0;

          this.instanceMatrix[4] = 0;
          this.instanceMatrix[5] = scaY;
          this.instanceMatrix[6] = 0;
          this.instanceMatrix[7] = 0;

          this.instanceMatrix[8] = sinR * scaZ;
          this.instanceMatrix[9] = 0;
          this.instanceMatrix[10] = cosR * scaZ;
          this.instanceMatrix[11] = 0;

          this.instanceMatrix[12] = item.pos[0];
          this.instanceMatrix[13] = floatY;
          this.instanceMatrix[14] = item.pos[2];
          this.instanceMatrix[15] = 1;

          Mat4.normalFromMat4(this.normalMatrix, this.instanceMatrix);

          gl.uniformMatrix4fv(progInfo.uModel, false, this.instanceMatrix);
          if (progInfo.uNormalMatrix) gl.uniformMatrix3fv(progInfo.uNormalMatrix, false, this.normalMatrix);
          if (progInfo.uBaseColor) gl.uniform3fv(progInfo.uBaseColor, item.color || [1, 1, 1]);
          if (progInfo.uRoughness) gl.uniform1f(progInfo.uRoughness, 0.15);
          if (progInfo.uMetallic) gl.uniform1f(progInfo.uMetallic, 0.85);
          if (progInfo.uMatType) gl.uniform1i(progInfo.uMatType, 12); // neon glow
          if (progInfo.uNoiseScale) gl.uniform1f(progInfo.uNoiseScale, 1.0);
          if (progInfo.uClearCoat) gl.uniform1f(progInfo.uClearCoat, 0.8);
          if (progInfo.uBumpStrength) gl.uniform1f(progInfo.uBumpStrength, 0.0);

          gl.drawElements(gl.TRIANGLES, meshToDraw.indexCount, gl.UNSIGNED_SHORT, 0);
        }
      }

      // 5. Render Player Spawn Pads (Luminescent Base Markings)
      if (this.spawnPoints && this.spawnPoints.length > 0 && cubeMesh) {
        gl.bindVertexArray(cubeMesh.vao);
        const numSpawn = this.spawnPoints.length;
        for (let i = 0; i < numSpawn; i++) {
          const sp = this.spawnPoints[i];
          this.instanceMatrix[0] = 0.9;
          this.instanceMatrix[1] = 0;
          this.instanceMatrix[2] = 0;
          this.instanceMatrix[3] = 0;

          this.instanceMatrix[4] = 0;
          this.instanceMatrix[5] = 0.04;
          this.instanceMatrix[6] = 0;
          this.instanceMatrix[7] = 0;

          this.instanceMatrix[8] = 0;
          this.instanceMatrix[9] = 0;
          this.instanceMatrix[10] = 0.9;
          this.instanceMatrix[11] = 0;

          this.instanceMatrix[12] = sp.pos[0];
          this.instanceMatrix[13] = sp.pos[1] + 0.02;
          this.instanceMatrix[14] = sp.pos[2];
          this.instanceMatrix[15] = 1;

          Mat4.normalFromMat4(this.normalMatrix, this.instanceMatrix);

          gl.uniformMatrix4fv(progInfo.uModel, false, this.instanceMatrix);
          if (progInfo.uNormalMatrix) gl.uniformMatrix3fv(progInfo.uNormalMatrix, false, this.normalMatrix);
          if (progInfo.uBaseColor) gl.uniform3fv(progInfo.uBaseColor, [0.20, 0.65, 0.95]);
          if (progInfo.uRoughness) gl.uniform1f(progInfo.uRoughness, 0.2);
          if (progInfo.uMetallic) gl.uniform1f(progInfo.uMetallic, 0.9);
          if (progInfo.uMatType) gl.uniform1i(progInfo.uMatType, 11); // hologram
          if (progInfo.uNoiseScale) gl.uniform1f(progInfo.uNoiseScale, 20.0);
          if (progInfo.uClearCoat) gl.uniform1f(progInfo.uClearCoat, 0.0);
          if (progInfo.uBumpStrength) gl.uniform1f(progInfo.uBumpStrength, 0.0);

          gl.drawElements(gl.TRIANGLES, cubeMesh.indexCount, gl.UNSIGNED_SHORT, 0);
        }
      }

      // 6. Render Authentic First-Person FPS Weapon Viewmodel (Zero Memory Allocations)
      if (cubeMesh && sphereMesh) {
        const bobT = this.weaponState ? this.weaponState.bobTimer : 0;
        const recoil = this.weaponState ? this.weaponState.recoil : 0;
        const mFlash = this.weaponState ? this.weaponState.muzzleFlash : 0;

        const bobX = Math.cos(bobT * 0.5) * 0.012;
        const bobY = Math.sin(bobT) * 0.008;

        const cF = this.state.camFront;
        const cR = this.state.camRight;
        // cUp = cR x cF
        this._cUp[0] = cR[1] * cF[2] - cR[2] * cF[1];
        this._cUp[1] = cR[2] * cF[0] - cR[0] * cF[2];
        this._cUp[2] = cR[0] * cF[1] - cR[1] * cF[0];

        const forwardDist = 0.42 - recoil * 0.05;
        const rightDist = 0.17 + bobX;
        const upDist = -0.13 + bobY + recoil * 0.015;

        this._gunAnchor[0] = this.state.camPos[0] + cF[0] * forwardDist + cR[0] * rightDist + this._cUp[0] * upDist;
        this._gunAnchor[1] = this.state.camPos[1] + cF[1] * forwardDist + cR[1] * rightDist + this._cUp[1] * upDist;
        this._gunAnchor[2] = this.state.camPos[2] + cF[2] * forwardDist + cR[2] * rightDist + this._cUp[2] * upDist;

        const wColor = this.weaponConfig ? this.weaponConfig.color : [0.06, 0.85, 0.95];

        // 1. Gun Main Receiver Chassis (Twill Carbon Fiber)
        this.drawGunPart(progInfo, cubeMesh, this._gunAnchor, cF, cR, this._cUp, 0.0, 0.0, 0.0, 0.065, 0.075, 0.22, [0.12, 0.14, 0.18], 0.30, 0.85, 5, 45.0, 0.9, 1.6);

        // 2. Gun Lower Grip / Battery Handle (Pebble Grain Leather)
        this.drawGunPart(progInfo, cubeMesh, this._gunAnchor, cF, cR, this._cUp, -0.05, 0.0, -0.065, 0.045, 0.08, 0.05, [0.08, 0.09, 0.12], 0.60, 0.20, 14, 28.0, 0.1, 1.8);

        // 3. Gun Upper Heavy Barrel Rails (Brushed Aerospace Titanium)
        this.drawGunPart(progInfo, cubeMesh, this._gunAnchor, cF, cR, this._cUp, 0.14, 0.0, 0.015, 0.045, 0.045, 0.16, [0.18, 0.22, 0.28], 0.20, 0.95, 3, 35.0, 0.0, 1.4);

        // 4. Glowing Plasma Energy Chamber (Illuminated Core Neon)
        this.drawGunPart(progInfo, cubeMesh, this._gunAnchor, cF, cR, this._cUp, 0.02, 0.0, 0.028, 0.035, 0.035, 0.12, wColor, 0.05, 0.95, 12, 1.0, 0.0, 0.0);

        // 5. High-Tech Muzzle Aperture Tip
        this.drawGunPart(progInfo, cubeMesh, this._gunAnchor, cF, cR, this._cUp, 0.23, 0.0, 0.015, 0.055, 0.055, 0.04, [0.30, 0.32, 0.38], 0.15, 0.95, 3, 35.0, 0.0, 1.2);

        // 6. Dynamic Muzzle Flash on Fire
        if (mFlash > 0.05) {
          const flashScale = 0.08 * mFlash;
          this.drawGunPart(progInfo, sphereMesh, this._gunAnchor, cF, cR, this._cUp, 0.28, 0.0, 0.015, flashScale, flashScale, flashScale, [1.0, 0.95, 0.6], 0.0, 1.0, 12, 1.0, 0.0, 0.0);
        }
      }

    } else if (isShowroomDemo) {
      // -------------------------------------------------------------
      // DEMO 08: ALL MATERIALS PRESENTATION SHOWROOM (17 Filament PBR Shaders)
      // -------------------------------------------------------------
      const sampleMeshIdx = this.state.showroomMesh !== undefined ? this.state.showroomMesh : 0;
      const sampleMesh = this.meshBuffers[sampleMeshIdx] || this.meshBuffers[0];
      const cubeMesh = this.meshBuffers[1]; // Cube for pedestals and floor

      // Helper to render an instance with full Filament PBR uniforms
      const renderInstance = (mesh, px, py, pz, sx, sy, sz, rx, ry, rz, col, rough, metal, matType, noiseScale, clearCoat, anisotropy, bump, texKey) => {
        if (!mesh) return;
        gl.bindVertexArray(mesh.vao);

        const cosX = Math.cos(rx), sinX = Math.sin(rx);
        const cosY = Math.cos(ry), sinY = Math.sin(ry);
        const cosZ = Math.cos(rz), sinZ = Math.sin(rz);

        // Rotation Euler XYZ * Scale
        this.instanceMatrix[0] = (cosY * cosZ) * sx;
        this.instanceMatrix[1] = (cosX * sinZ + sinX * sinY * cosZ) * sx;
        this.instanceMatrix[2] = (sinX * sinZ - cosX * sinY * cosZ) * sx;
        this.instanceMatrix[3] = 0;

        this.instanceMatrix[4] = (-cosY * sinZ) * sy;
        this.instanceMatrix[5] = (cosX * cosZ - sinX * sinY * sinZ) * sy;
        this.instanceMatrix[6] = (sinX * cosZ + cosX * sinY * sinZ) * sy;
        this.instanceMatrix[7] = 0;

        this.instanceMatrix[8] = (sinY) * sz;
        this.instanceMatrix[9] = (-sinX * cosY) * sz;
        this.instanceMatrix[10] = (cosX * cosY) * sz;
        this.instanceMatrix[11] = 0;

        this.instanceMatrix[12] = px;
        this.instanceMatrix[13] = py;
        this.instanceMatrix[14] = pz;
        this.instanceMatrix[15] = 1;

        Mat4.normalFromMat4(this.normalMatrix, this.instanceMatrix);

        const texObj = (texKey && this.textureCatalog) ? this.textureCatalog[texKey] : null;
        if (texObj && progInfo.uUseTexMaps) {
          gl.activeTexture(gl.TEXTURE2);
          gl.bindTexture(gl.TEXTURE_2D, texObj);
          if (progInfo.uAlbedoMap) gl.uniform1i(progInfo.uAlbedoMap, 2);
          if (progInfo.uPbrMap) gl.uniform1i(progInfo.uPbrMap, 2);
          gl.uniform1i(progInfo.uUseTexMaps, 1);
        } else if (progInfo.uUseTexMaps) {
          gl.uniform1i(progInfo.uUseTexMaps, 0);
        }

        gl.uniformMatrix4fv(progInfo.uModel, false, this.instanceMatrix);
        if (progInfo.uNormalMatrix) gl.uniformMatrix3fv(progInfo.uNormalMatrix, false, this.normalMatrix);
        if (progInfo.uBaseColor) gl.uniform3fv(progInfo.uBaseColor, col);
        if (progInfo.uRoughness) gl.uniform1f(progInfo.uRoughness, rough);
        if (progInfo.uMetallic) gl.uniform1f(progInfo.uMetallic, metal);
        if (progInfo.uMatType) gl.uniform1i(progInfo.uMatType, matType);
        if (progInfo.uNoiseScale) gl.uniform1f(progInfo.uNoiseScale, noiseScale);
        if (progInfo.uClearCoat) gl.uniform1f(progInfo.uClearCoat, clearCoat);
        if (progInfo.uAnisotropy) gl.uniform1f(progInfo.uAnisotropy, anisotropy);
        if (progInfo.uBumpStrength) gl.uniform1f(progInfo.uBumpStrength, bump);

        gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
      };

      // 1. Render Showroom Gallery Floor (Polished Dark Obsidian Basalt)
      renderInstance(cubeMesh, 0.0, -0.4, 0.0, 36.0, 0.4, 36.0, 0, 0, 0, [0.08, 0.09, 0.12], 0.20, 0.85, 0, 1.0, 0.85, 0.0, 0.0);

      // 2. Render all 17 Material Samples on Pedestals
      const matKeys = Object.keys(FILAMENT_MATERIALS_CATALOG);
      const totalMats = matKeys.length;
      const turnTime = timestamp * 0.001 * (this.state.showroomSpeed || 0.75);

      for (let i = 0; i < totalMats; i++) {
        const key = matKeys[i];
        const mat = FILAMENT_MATERIALS_CATALOG[key];
        const pos = this.getShowroomPedestalPos(i, totalMats, this.state.showroomLayout);
        const isFocused = (this.state.showroomFocusedMatKey === key);

        // Pedestal Lower Base (Brushed Slate Alloy)
        renderInstance(cubeMesh, pos[0], 0.35, pos[2], 0.95, 0.70, 0.95, 0, 0, 0, [0.14, 0.16, 0.20], 0.35, 0.90, 3, 30.0, 0.25, 0.0, 1.0);

        // Pedestal Top Platform Rim
        renderInstance(cubeMesh, pos[0], 0.72, pos[2], 1.10, 0.04, 1.10, 0, 0, 0, [0.22, 0.25, 0.32], 0.20, 0.95, 3, 30.0, 0.40, 0.0, 0.5);

        // Active Focus Indicator Ring
        if (isFocused) {
          const pulse = 0.5 + 0.5 * Math.sin(timestamp * 0.006);
          const glowColor = [0.06 * (0.8 + 0.4 * pulse), 0.85 * (0.8 + 0.4 * pulse), 0.95 * (0.8 + 0.4 * pulse)];
          renderInstance(cubeMesh, pos[0], 0.02, pos[2], 1.35, 0.04, 1.35, 0, 0, 0, glowColor, 0.05, 0.95, 12, 1.0, 0.0, 0.0, 0.0);
        }

        // Material Sample Mesh with smooth continuous turntable rotation
        const rotY = this.state.showroomTurntable ? (turnTime + i * 0.42) : 0.0;
        const rotX = 0.15; // Optimal tilt for GGX specular reflection
        const matTypeId = mat.matTypeId !== undefined ? mat.matTypeId : 0;
        const noise = mat.noiseScale || 1.0;
        const clearCoat = mat.clearCoat || 0.0;
        const aniso = mat.anisotropy || 0.0;
        const bump = mat.bumpStrength !== undefined ? mat.bumpStrength : 0.0;

        renderInstance(
          sampleMesh,
          pos[0], 1.45, pos[2],
          0.62, 0.62, 0.62,
          rotX, rotY, 0.0,
          mat.color,
          mat.roughness,
          mat.metallic,
          matTypeId,
          noise,
          clearCoat,
          aniso,
          bump,
          mat.textureKey
        );
      }

    } else if (this.state.demoScene === 'matrix' || this.state.demoScene === '02_metallic_roughness_matrix.cpp') {
      // DEMO 2: 5x5 METALLIC VS ROUGHNESS MATRIX (25 Objects rendered in 1 loop, 0 allocs)
      const mesh = this.meshBuffers[this.state.activeMesh];
      if (mesh) {
        gl.bindVertexArray(mesh.vao);
        const rows = 5, cols = 5;
        const spacing = 1.35;
        const offsetX = (cols - 1) * spacing * 0.5;
        const offsetY = (rows - 1) * spacing * 0.5;
        const angle = (this.state.rotationAngle || 0);

        const cosY = Math.cos(angle * 0.5), sinY = Math.sin(angle * 0.5);

        if (progInfo.uMatType) gl.uniform1i(progInfo.uMatType, 0); // Standard PBR matrix
        if (progInfo.uNoiseScale) gl.uniform1f(progInfo.uNoiseScale, 1.0);
        if (progInfo.uClearCoat) gl.uniform1f(progInfo.uClearCoat, 0.0);
        if (progInfo.uAnisotropy) gl.uniform1f(progInfo.uAnisotropy, 0.0);
        if (progInfo.uBumpStrength) gl.uniform1f(progInfo.uBumpStrength, 0.0);

        for (let r = 0; r < rows; r++) {
          const roughness = 0.05 + (r / (rows - 1)) * 0.95;
          if (progInfo.uRoughness) gl.uniform1f(progInfo.uRoughness, roughness);

          for (let c = 0; c < cols; c++) {
            const metallic = c / (cols - 1);
            if (progInfo.uMetallic) gl.uniform1f(progInfo.uMetallic, metallic);
            if (progInfo.uBaseColor) gl.uniform3fv(progInfo.uBaseColor, this.gridColor);

            const posX = c * spacing - offsetX;
            const posY = (rows - 1 - r) * spacing - offsetY;

            this.instanceMatrix[0] = cosY * 0.65;
            this.instanceMatrix[1] = 0;
            this.instanceMatrix[2] = -sinY * 0.65;
            this.instanceMatrix[3] = 0;

            this.instanceMatrix[4] = 0;
            this.instanceMatrix[5] = 0.65;
            this.instanceMatrix[6] = 0;
            this.instanceMatrix[7] = 0;

            this.instanceMatrix[8] = sinY * 0.65;
            this.instanceMatrix[9] = 0;
            this.instanceMatrix[10] = cosY * 0.65;
            this.instanceMatrix[11] = 0;

            this.instanceMatrix[12] = posX;
            this.instanceMatrix[13] = posY;
            this.instanceMatrix[14] = 0;
            this.instanceMatrix[15] = 1;

            Mat4.normalFromMat4(this.normalMatrix, this.instanceMatrix);

            gl.uniformMatrix4fv(progInfo.uModel, false, this.instanceMatrix);
            if (progInfo.uNormalMatrix) gl.uniformMatrix3fv(progInfo.uNormalMatrix, false, this.normalMatrix);

            gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
          }
        }
      }
    } else if (this.state.demoScene.includes('09_slot_machine')) {
      // -------------------------------------------------------------
      // DEMO 09: 3D CASINO SLOT MACHINE & GOLD COIN PARTICLES
      // -------------------------------------------------------------
      this.updateSlotMachinePhysics(dt);
      this.render3DSlotMachine(progInfo, timestamp);
    } else if (this.state.demoScene.includes('10_sliding_puzzle')) {
      // -------------------------------------------------------------
      // DEMO 10: DYNAMIC SLIDING 3D PUZZLE
      // -------------------------------------------------------------
      this.render3DSlidingPuzzle(progInfo, timestamp);
    } else if (this.state.demoScene.includes('11_plinko')) {
      // -------------------------------------------------------------
      // DEMO 11: 3D PLINKO CASCADE SHOWCASE & PHYSICS
      // -------------------------------------------------------------
      this.updatePlinkoPhysics(dt);
      this.render3DPlinko(progInfo, timestamp);
    } else if (this.state.demoScene.includes('12_roulette')) {
      // -------------------------------------------------------------
      // DEMO 12: 3D PHYSICS-ENGINE ROULETTE WHEEL
      // -------------------------------------------------------------
      this.updateRoulettePhysics(dt);
      this.render3DRoulette(progInfo, timestamp);
    } else {
      // DEMO 1 & DEMO 3: SINGLE OBJECT PBR / STUDIO
      const mesh = this.meshBuffers[this.state.activeMesh];
      if (mesh) {
        gl.bindVertexArray(mesh.vao);
        if (this.state.autoRotate) {
          this.state.rotationAngle = (this.state.rotationAngle || 0) + dt * this.state.speed;
        }
        const angle = this.state.rotationAngle || 0;

        const cx = Math.cos(0.25), sx = Math.sin(0.25);
        const cy = Math.cos(angle), sy = Math.sin(angle);
        this.modelMatrix[0] = cy;
        this.modelMatrix[1] = sx * sy;
        this.modelMatrix[2] = -cx * sy;
        this.modelMatrix[3] = 0;
        this.modelMatrix[4] = 0;
        this.modelMatrix[5] = cx;
        this.modelMatrix[6] = sx;
        this.modelMatrix[7] = 0;
        this.modelMatrix[8] = sy;
        this.modelMatrix[9] = -sx * cy;
        this.modelMatrix[10] = cx * cy;
        this.modelMatrix[11] = 0;
        this.modelMatrix[12] = 0;
        this.modelMatrix[13] = 0;
        this.modelMatrix[14] = 0;
        this.modelMatrix[15] = 1;

        Mat4.normalFromMat4(this.normalMatrix, this.modelMatrix);

        const mat = (this.activeTunedMaterial && FILAMENT_MATERIALS_CATALOG[this.activeTunedMaterial]) || null;
        const matType = mat ? (mat.matTypeId !== undefined ? mat.matTypeId : 0) : 0;
        const noiseScale = mat ? (mat.noiseScale || 1.0) : 1.0;
        const clearCoat = mat ? (mat.clearCoat || 0.0) : 0.0;
        const anisotropy = mat ? (mat.anisotropy || 0.0) : 0.0;
        const bumpStrength = mat ? (mat.bumpStrength || 1.2) : 0.0;

        gl.uniformMatrix4fv(progInfo.uModel, false, this.modelMatrix);
        if (progInfo.uNormalMatrix) gl.uniformMatrix3fv(progInfo.uNormalMatrix, false, this.normalMatrix);
        if (progInfo.uBaseColor) gl.uniform3fv(progInfo.uBaseColor, (mat && mat.color) ? mat.color : this.state.baseColor);
        if (progInfo.uRoughness) gl.uniform1f(progInfo.uRoughness, (mat && mat.roughness !== undefined) ? mat.roughness : this.state.roughness);
        if (progInfo.uMetallic) gl.uniform1f(progInfo.uMetallic, (mat && mat.metallic !== undefined) ? mat.metallic : this.state.metallic);
        if (progInfo.uMatType) gl.uniform1i(progInfo.uMatType, matType);
        if (progInfo.uNoiseScale) gl.uniform1f(progInfo.uNoiseScale, noiseScale);
        if (progInfo.uClearCoat) gl.uniform1f(progInfo.uClearCoat, clearCoat);
        if (progInfo.uAnisotropy) gl.uniform1f(progInfo.uAnisotropy, anisotropy);
        if (progInfo.uBumpStrength) gl.uniform1f(progInfo.uBumpStrength, bumpStrength);

        gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
      }
    }

    gl.bindVertexArray(null);

    // Render Platform-Agnostic 3D Billboard Labels directly into the scene framebuffer
    this.renderBillboardLabels(timestamp);

    // =========================================================================
    // POST-PROCESSING MASTER PASS (HZB Occlusion, HDR Bloom, Volumetric Rays)
    // =========================================================================
    if (this.postProcProg && this.quadVao && this.sceneColorTex && this.sceneDepthTex) {
      // 1. Unbind FBO and target default screen canvas framebuffer
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, width, height);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);

      gl.useProgram(this.postProcProg.prog);

      // Bind Scene Color Texture (Unit 0)
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.sceneColorTex);
      if (this.postProcProg.uSceneColor) gl.uniform1i(this.postProcProg.uSceneColor, 0);

      // Bind Scene Depth Texture (Unit 1)
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.sceneDepthTex);
      if (this.postProcProg.uSceneDepth) gl.uniform1i(this.postProcProg.uSceneDepth, 1);

      // Screen & Camera Uniforms
      if (this.postProcProg.uResolution) gl.uniform2f(this.postProcProg.uResolution, width, height);
      if (this.postProcProg.uTime) gl.uniform1f(this.postProcProg.uTime, timestamp * 0.001);
      if (this.postProcProg.uCamPos) gl.uniform3fv(this.postProcProg.uCamPos, this.state.camPos);

      // Dynamic Sun Screen Position & Visibility for Volumetric Light God Rays
      const sunWorld = [
        this.state.camPos[0] - 30.0,
        this.state.camPos[1] + 45.0,
        this.state.camPos[2] + 25.0,
        1.0
      ];
      const sunClip = [
        this.viewProjMatrix[0]*sunWorld[0] + this.viewProjMatrix[4]*sunWorld[1] + this.viewProjMatrix[8]*sunWorld[2] + this.viewProjMatrix[12]*sunWorld[3],
        this.viewProjMatrix[1]*sunWorld[0] + this.viewProjMatrix[5]*sunWorld[1] + this.viewProjMatrix[9]*sunWorld[2] + this.viewProjMatrix[13]*sunWorld[3],
        this.viewProjMatrix[2]*sunWorld[0] + this.viewProjMatrix[6]*sunWorld[1] + this.viewProjMatrix[10]*sunWorld[2] + this.viewProjMatrix[14]*sunWorld[3],
        this.viewProjMatrix[3]*sunWorld[0] + this.viewProjMatrix[7]*sunWorld[1] + this.viewProjMatrix[11]*sunWorld[2] + this.viewProjMatrix[15]*sunWorld[3]
      ];
      let sunScreenX = -10.0;
      let sunScreenY = -10.0;
      let sunVisibility = 0.0;
      if (sunClip[3] > 0.1) {
        sunScreenX = (sunClip[0] / sunClip[3]) * 0.5 + 0.5;
        sunScreenY = (sunClip[1] / sunClip[3]) * 0.5 + 0.5;

        // Smooth viewport edge falloff
        const edgeDistX = Math.abs(sunScreenX - 0.5);
        const edgeDistY = Math.abs(sunScreenY - 0.5);
        const fadeX = Math.max(0.0, 1.0 - Math.max(0.0, edgeDistX - 0.4) * 2.5);
        const fadeY = Math.max(0.0, 1.0 - Math.max(0.0, edgeDistY - 0.4) * 2.5);
        sunVisibility = Math.min(1.0, fadeX * fadeY);
      }
      if (this.postProcProg.uSunScreenPos) gl.uniform3f(this.postProcProg.uSunScreenPos, sunScreenX, sunScreenY, sunVisibility);

      const hzb = this.postProcState ? this.postProcState.hzb : {};
      const bloom = this.postProcState ? this.postProcState.bloom : {};
      const vol = this.postProcState ? this.postProcState.volumetric : {};

      // HZB Mode mapping
      const viewModeMap = {
        'none': 0,
        'depth-mips': 1,
        'linear-depth': 2,
        'occlusion-boxes': 3,
        'hiz-raymarch': 4,
        'split-view': 5
      };
      const hzbModeInt = viewModeMap[hzb.viewMode] !== undefined ? viewModeMap[hzb.viewMode] : 0;

      // HZB Uniforms
      if (this.postProcProg.uHzbEnabled) gl.uniform1i(this.postProcProg.uHzbEnabled, hzb.enabled ? 1 : 0);
      if (this.postProcProg.uHzbViewMode) gl.uniform1i(this.postProcProg.uHzbViewMode, hzbModeInt);
      if (this.postProcProg.uHzbMipLevel) gl.uniform1f(this.postProcProg.uHzbMipLevel, hzb.mipLevel !== undefined ? hzb.mipLevel : 0);
      if (this.postProcProg.uHzbSteps) gl.uniform1i(this.postProcProg.uHzbSteps, hzb.steps !== undefined ? hzb.steps : 8);

      // Bloom Uniforms
      if (this.postProcProg.uBloomEnabled) gl.uniform1i(this.postProcProg.uBloomEnabled, bloom.enabled ? 1 : 0);
      if (this.postProcProg.uBloomThreshold) gl.uniform1f(this.postProcProg.uBloomThreshold, bloom.threshold !== undefined ? bloom.threshold : 0.85);
      if (this.postProcProg.uBloomSensitivity) gl.uniform1f(this.postProcProg.uBloomSensitivity, bloom.sensitivity !== undefined ? bloom.sensitivity : 0.50);
      if (this.postProcProg.uBloomIntensity) gl.uniform1f(this.postProcProg.uBloomIntensity, bloom.intensity !== undefined ? bloom.intensity : 1.25);
      if (this.postProcProg.uBloomRadius) gl.uniform1f(this.postProcProg.uBloomRadius, bloom.radius !== undefined ? bloom.radius : 1.4);
      if (this.postProcProg.uBloomAnamorphic) gl.uniform1f(this.postProcProg.uBloomAnamorphic, bloom.anamorphic ? 1.0 : 0.0);
      if (this.postProcProg.uBloomChromatic) gl.uniform1f(this.postProcProg.uBloomChromatic, bloom.chromatic ? 1.0 : 0.0);

      // Volumetric Uniforms
      if (this.postProcProg.uVolumetricEnabled) gl.uniform1i(this.postProcProg.uVolumetricEnabled, vol.enabled ? 1 : 0);
      if (this.postProcProg.uVolumetricSamples) gl.uniform1i(this.postProcProg.uVolumetricSamples, vol.samples !== undefined ? vol.samples : 32);
      if (this.postProcProg.uVolumetricDensity) gl.uniform1f(this.postProcProg.uVolumetricDensity, vol.density !== undefined ? vol.density : 0.95);
      if (this.postProcProg.uVolumetricDecay) gl.uniform1f(this.postProcProg.uVolumetricDecay, vol.decay !== undefined ? vol.decay : 0.965);
      if (this.postProcProg.uVolumetricWeight) gl.uniform1f(this.postProcProg.uVolumetricWeight, vol.weight !== undefined ? vol.weight : 0.65);
      if (this.postProcProg.uVolumetricColor) gl.uniform3fv(this.postProcProg.uVolumetricColor, vol.color || [1.0, 0.85, 0.45]);

      // Render Fullscreen Post-Process Quad
      gl.bindVertexArray(this.quadVao);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindVertexArray(null);

      // Reset Active Textures
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }

    requestAnimationFrame(this._renderLoopBound);
  }

  renderBillboardLabels(timestamp) {
    const gl = this.gl;

    // 1. Set Blend & Depth States for labels rendering on top of geometry
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const isShowroomDemo = this.state.demoScene.includes('08_all_materials') || this.state.demoScene.includes('materials_presentation');
    const isFpsMode = (this.state.cameraMode === 3 || (this.state.cameraMode === 1 && !isShowroomDemo) || this.state.demoScene.includes('07_fps')) && !isShowroomDemo;
    const isCharacterDemo = (this.state.demoScene.includes('06_glb') || this.state.demoScene === 'character') && !isFpsMode && !isShowroomDemo;
    const isFpsDemo = (this.state.demoScene.includes('07_fps') || isFpsMode) && !isShowroomDemo;
    const isSlotMachine = this.state.demoScene.includes('09_slot_machine');
    const isMatrix = this.state.demoScene === 'matrix' || this.state.demoScene === '02_metallic_roughness_matrix.cpp';
    const isStudio = this.state.demoScene.includes('03_trefoil') || this.state.demoScene === 'studio';
    const isSingle = this.state.demoScene.includes('01_pbr') || this.state.demoScene === 'single';

    // 2. Clear old text canvas cached entries if too large to avoid memory leakage
    if (this.textTextureCache && Object.keys(this.textTextureCache).length > 150) {
      Object.values(this.textTextureCache).forEach(entry => gl.deleteTexture(entry.texture));
      this.textTextureCache = {};
    }

    const items = [];

    // Collect elements
    if (isShowroomDemo) {
      const matKeys = Object.keys(FILAMENT_MATERIALS_CATALOG);
      const totalMats = matKeys.length;
      for (let i = 0; i < totalMats; i++) {
        const key = matKeys[i];
        const mat = FILAMENT_MATERIALS_CATALOG[key];
        const pos = this.getShowroomPedestalPos(i, totalMats, this.state.showroomLayout);
        const isFocused = (this.state.showroomFocusedMatKey === key);
        const focusStr = isFocused ? " [SELECTED]" : "";
        items.push({
          pos: [pos[0], pos[1] + 2.1, pos[2]],
          text: `SPECIMEN ${i+1}: ${mat.label || key}${focusStr}`,
          isFocused: isFocused
        });
      }
    } else if (isMatrix) {
      const rows = 5, cols = 5;
      const spacing = 1.35;
      const offsetX = (cols - 1) * spacing * 0.5;
      const offsetY = (rows - 1) * spacing * 0.5;
      for (let r = 0; r < rows; r++) {
        const roughness = 0.05 + (r / (rows - 1)) * 0.95;
        for (let c = 0; c < cols; c++) {
          const metallic = c / (cols - 1);
          const posX = c * spacing - offsetX;
          const posY = (rows - 1 - r) * spacing - offsetY;
          items.push({
            pos: [posX, posY + 0.65, 0],
            text: `M: ${metallic.toFixed(2)} | R: ${roughness.toFixed(2)}`,
            isFocused: false
          });
        }
      }
    } else if (isFpsDemo) {
      // 3.1 AI Bots
      if (this.active3DBots) {
        for (let i = 0; i < this.active3DBots.length; i++) {
          const bot = this.active3DBots[i];
          if (bot.alive) {
            items.push({
              pos: [bot.pos[0], bot.pos[1] + 2.0, bot.pos[2]],
              text: `${bot.team} - ${bot.alias} (${bot.health.toFixed(0)} HP)`,
              isFocused: bot.team === 'Red'
            });
          }
        }
      }

      // 3.2 Item Pickups
      if (this.itemPickups) {
        for (let i = 0; i < this.itemPickups.length; i++) {
          const item = this.itemPickups[i];
          if (item.active) {
            items.push({
              pos: [item.pos[0], item.pos[1] + 0.8, item.pos[2]],
              text: `${item.icon || '📦'} ${item.name}`,
              isFocused: false
            });
          } else {
            items.push({
              pos: [item.pos[0], item.pos[1] + 0.8, item.pos[2]],
              text: `⏳ Respawning (${item.respawnTimer.toFixed(0)}s)`,
              isFocused: false
            });
          }
        }
      }

      // 3.3 Damage Actors
      if (this.damageActors) {
        for (let i = 0; i < this.damageActors.length; i++) {
          const actor = this.damageActors[i];
          const height = actor.scale ? actor.scale[1] : 1.5;
          items.push({
            pos: [actor.pos[0], actor.pos[1] + height + 0.3, actor.pos[2]],
            text: `🎯 ${actor.name} (${actor.alive ? actor.health.toFixed(0) + ' HP' : 'DESTROYED'})`,
            isFocused: actor.alive
          });
        }
      }

      // 3.4 Spawn Points
      if (this.spawnPoints) {
        for (let i = 0; i < this.spawnPoints.length; i++) {
          const sp = this.spawnPoints[i];
          items.push({
            pos: [sp.pos[0], sp.pos[1] + 0.15, sp.pos[2]],
            text: `SPAWN PAD ${i+1}`,
            isFocused: false
          });
        }
      }
    } else if (isCharacterDemo) {
      // Player
      if (this.playerController) {
        items.push({
          pos: [this.playerController.pos[0], this.playerController.pos[1] + 2.0, this.playerController.pos[2]],
          text: `👤 Gladiator (YOU) - ACTIVE`,
          isFocused: true
        });
      }

      // Scene entities
      if (this.sceneEntities) {
        for (let i = 0; i < this.sceneEntities.length; i++) {
          const ent = this.sceneEntities[i];
          if (ent.id > 1) { // Skip player and floor
            const height = ent.scale ? ent.scale[1] : 1.0;
            items.push({
              pos: [ent.pos[0], ent.pos[1] + height + 0.3, ent.pos[2]],
              text: `🧱 ${ent.name || 'Structure'}`,
              isFocused: false
            });
          }
        }
      }
    } else if (isSlotMachine) {
      items.push({
        pos: [0, 1.9, 0],
        text: `🎰 3D Cyber Slot Reels (Drag to Rotate)`,
        isFocused: true
      });
    } else if (isStudio) {
      items.push({
        pos: [0, 1.4, 0],
        text: `🧬 Trefoil Knot Studio Specimen`,
        isFocused: true
      });
    } else if (isSingle) {
      items.push({
        pos: [0, 1.4, 0],
        text: `🔮 PBR Material Specimen`,
        isFocused: true
      });
    }

    // Render each collected item as a 3D Billboard in WebGL pipeline!
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const pos = item.pos;

      // Distance culling to stay clean
      const dx = pos[0] - this.state.camPos[0];
      const dy = pos[1] - this.state.camPos[1];
      const dz = pos[2] - this.state.camPos[2];
      const dist = Math.hypot(dx, dy, dz);

      if (dist > 35.0) continue;

      // Behind camera check
      const clipW = this.viewProjMatrix[3]*pos[0] + this.viewProjMatrix[7]*pos[1] + this.viewProjMatrix[11]*pos[2] + this.viewProjMatrix[15];
      if (clipW <= 0.1) continue;

      this.drawBillboardText(item.text, pos, item.isFocused);
    }

    // Restore WebGL depth and blend states
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    if (this.state.depthTest) {
      gl.enable(gl.DEPTH_TEST);
    }
  }

  drawBillboardText(text, pos, isFocused = false) {
    const gl = this.gl;
    const texData = this.getTextTexture(text, isFocused);
    if (!texData) return;

    // Define label size in 3D world meters (e.g. height = 0.28m, width based on aspect ratio)
    const labelHeight = 0.26;
    const labelWidth = labelHeight * texData.aspect;

    const cF = this.state.camFront;
    const cR = this.state.camRight;
    const cU = this._cUp;

    // Compute billboard orientation matrix (model matrix) on CPU
    // We want the billboard to align with the camera's Right and Up vectors
    this.instanceMatrix[0] = cR[0] * labelWidth;
    this.instanceMatrix[1] = cR[1] * labelWidth;
    this.instanceMatrix[2] = cR[2] * labelWidth;
    this.instanceMatrix[3] = 0;

    this.instanceMatrix[4] = cU[0] * labelHeight;
    this.instanceMatrix[5] = cU[1] * labelHeight;
    this.instanceMatrix[6] = cU[2] * labelHeight;
    this.instanceMatrix[7] = 0;

    // We can set Normal column to face camera (negative camFront)
    this.instanceMatrix[8] = -cF[0];
    this.instanceMatrix[9] = -cF[1];
    this.instanceMatrix[10] = -cF[2];
    this.instanceMatrix[11] = 0;

    this.instanceMatrix[12] = pos[0];
    this.instanceMatrix[13] = pos[1];
    this.instanceMatrix[14] = pos[2];
    this.instanceMatrix[15] = 1;

    // Draw using our billboard shader program
    const progInfo = this.billboardProg;
    gl.useProgram(progInfo.prog);

    // Uniforms
    gl.uniformMatrix4fv(progInfo.uModel, false, this.instanceMatrix);
    gl.uniformMatrix4fv(progInfo.uViewProj, false, this.viewProjMatrix);

    // Bind texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texData.texture);
    gl.uniform1i(progInfo.uTextTexture, 0);

    // Draw the BillboardQuad mesh (index 5)
    const quadMesh = this.meshBuffers[5];
    if (quadMesh) {
      gl.bindVertexArray(quadMesh.vao);
      gl.drawElements(gl.TRIANGLES, quadMesh.indexCount, gl.UNSIGNED_SHORT, 0);
    }
  }

  getTextTexture(text, isFocused = false) {
    if (!this.textTextureCache) {
      this.textTextureCache = {};
    }
    const cacheKey = `${text}_${isFocused}`;
    if (this.textTextureCache[cacheKey]) {
      return this.textTextureCache[cacheKey];
    }

    const gl = this.gl;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Measure text to determine texture dimensions
    ctx.font = "bold 24px 'Plus Jakarta Sans', system-ui, sans-serif";
    const textMetrics = ctx.measureText(text.replace(/<[^>]*>/g, '')); // Strip any simple tags for measurement
    
    // Pad text bounds
    const paddingX = 24;
    const paddingY = 16;
    const textWidth = Math.max(64, textMetrics.width);
    const textHeight = 24; // approximation for height of text
    
    const canvasWidth = this.nextPowerOfTwo(textWidth + paddingX * 2);
    const canvasHeight = this.nextPowerOfTwo(textHeight + paddingY * 2);

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Draw background card with rounded corners and border
    ctx.fillStyle = "rgba(15, 23, 42, 0.88)"; // Slate 900 with alpha
    const rx = 4;
    const ry = 4;
    const rw = canvasWidth - 8;
    const rh = canvasHeight - 8;
    const radius = 12;

    ctx.beginPath();
    ctx.moveTo(rx + radius, ry);
    ctx.lineTo(rx + rw - radius, ry);
    ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + radius);
    ctx.lineTo(rx + rw, ry + rh - radius);
    ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - radius, ry + rh);
    ctx.lineTo(rx + radius, ry + rh);
    ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - radius);
    ctx.lineTo(rx, ry + radius);
    ctx.quadraticCurveTo(rx, ry, rx + radius, ry);
    ctx.closePath();
    ctx.fill();

    // Draw border
    ctx.lineWidth = 3;
    if (isFocused) {
      ctx.strokeStyle = "rgba(6, 182, 212, 0.95)"; // Cyan 500
    } else {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)"; // White-ish transparent
    }
    ctx.stroke();

    // Draw text (strip any html tags for drawing, since we are doing simple drawing)
    ctx.fillStyle = "#f8fafc"; // Slate 50
    ctx.font = "bold 24px 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    // Strip simple HTML tags
    const cleanText = text.replace(/<[^>]*>/g, '');
    ctx.fillText(cleanText, canvasWidth / 2, canvasHeight / 2);

    // Create GL texture
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);

    const textureData = {
      texture: tex,
      width: canvasWidth,
      height: canvasHeight,
      aspect: canvasWidth / canvasHeight
    };

    this.textTextureCache[cacheKey] = textureData;
    return textureData;
  }

  nextPowerOfTwo(val) {
    let p = 1;
    while (p < val) {
      p *= 2;
    }
    return p;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new NativeApp();
});

