// examples/01_pbr_material_preview.cpp
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

    float metallic = 0.8f;
    float roughness = 0.25f;
    float3 baseColor = float3(0.15f, 0.45f, 0.95f);
};

// Initialize minimal Filament scene
bool InitFilamentScene(EngineContext& ctx, void* nativeWindowHandle, uint32_t width, uint32_t height) {
    // 1. Create Filament Engine
    ctx.engine = Engine::create(Engine::Backend::OPENGL); // or Backend::VULKAN / Backend::METAL
    if (!ctx.engine) return false;

    // 2. Create Renderer, Scene, View, and Camera
    ctx.renderer = ctx.engine->createRenderer();
    ctx.scene = ctx.engine->createScene();
    ctx.view = ctx.engine->createView();
    
    Entity cameraEntity = EntityManager::get().create();
    ctx.camera = ctx.engine->createCamera(cameraEntity);
    ctx.view->setCamera(ctx.camera);
    ctx.view->setScene(ctx.scene);
    ctx.view->setViewport({0, 0, width, height});

    // 3. Set perspective projection
    float aspect = static_cast<float>(width) / static_cast<float>(height);
    ctx.camera->setProjection(45.0, aspect, 0.1, 100.0, Camera::Fov::VERTICAL);
    ctx.camera->lookAt({0.0, 1.2, 4.5}, {0.0, 0.0, 0.0}, {0.0, 1.0, 0.0});

    // 4. Create Directional Key Light
    ctx.sunLightEntity = EntityManager::get().create();
    LightManager::Builder(LightManager::Type::DIRECTIONAL)
        .color(Color::toLinear<ACCURATE>({0.98f, 0.95f, 0.90f}))
        .intensity(110000.0f) // Lux
        .direction(normalize(float3(0.6f, -1.0f, -0.8f)))
        .castShadows(true)
        .build(*ctx.engine, ctx.sunLightEntity);
    ctx.scene->addEntity(ctx.sunLightEntity);

    std::cout << "[Filament Demo 01] PBR Material Preview Initialized successfully.\n";
    return true;
}

// Zero-allocation per-frame render tick
void RenderFrame(EngineContext& ctx, float deltaTime, float totalTime) {
    if (!ctx.renderer->beginFrame(nullptr)) return;

    // Update material properties dynamically without allocation
    if (ctx.materialInstance) {
        ctx.materialInstance->setParameter("baseColor", ctx.baseColor);
        ctx.materialInstance->setParameter("roughness", ctx.roughness);
        ctx.materialInstance->setParameter("metallic", ctx.metallic);
    }

    // Rotate object via TransformManager
    auto& tm = ctx.engine->getTransformManager();
    auto instance = tm.getInstance(ctx.renderableEntity);
    if (instance) {
        mat4f rotation = mat4f::rotation(totalTime * 0.8f, float3{0.0f, 1.0f, 0.0f});
        tm.setTransform(instance, rotation);
    }

    // Render viewport
    ctx.renderer->render(ctx.view);
    ctx.renderer->endFrame();
}

// Shutdown and resource cleanup
void ShutdownFilament(EngineContext& ctx) {
    ctx.engine->destroy(ctx.renderableEntity);
    ctx.engine->destroy(ctx.sunLightEntity);
    ctx.engine->destroy(ctx.view);
    ctx.engine->destroy(ctx.scene);
    ctx.engine->destroy(ctx.renderer);
    Engine::destroy(&ctx.engine);
}
