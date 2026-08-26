// examples/03_trefoil_studio.cpp
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
    float metallic = 0.95f;            // Mirror conductor
    float roughness = 0.12f;           // High gloss reflection
    float3 baseColor = float3(0.93f, 0.28f, 0.60f); // Vibrant Rose Magenta
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

    std::cout << "[Filament C++] Trefoil Studio Multi-Light Rig initialized with zero per-frame allocs.\n";
    return true;
}

// Zero-allocation per-frame render tick
void RenderStudioFrame(StudioEngineContext& ctx, float deltaTime, float totalTime) {
    if (!ctx.renderer->beginFrame(nullptr)) return;

    if (ctx.pbrMaterial) {
        ctx.pbrMaterial->setParameter("baseColor", ctx.baseColor);
        ctx.pbrMaterial->setParameter("roughness", ctx.roughness);
        ctx.pbrMaterial->setParameter("metallic", ctx.metallic);
    }

    auto& tm = ctx.engine->getTransformManager();
    auto instance = tm.getInstance(ctx.trefoilMeshEntity);
    if (instance) {
        mat4f rotation = mat4f::rotation(totalTime * ctx.rotationSpeed, float3{0.0f, 1.0f, 0.0f});
        tm.setTransform(instance, rotation);
    }

    ctx.renderer->render(ctx.view);
    ctx.renderer->endFrame();
}
