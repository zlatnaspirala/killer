// examples/02_metallic_roughness_matrix.cpp
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
#include <vector>

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
    Entity lightEntity;
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

            // Create material instance per grid element
            ctx.sphereInstances[r][c] = ctx.baseMaterial->createInstance();
            ctx.sphereInstances[r][c]->setParameter("baseColor", float3(0.95f, 0.95f, 0.95f));
            ctx.sphereInstances[r][c]->setParameter("roughness", roughness);
            ctx.sphereInstances[r][c]->setParameter("metallic", metallic);

            // Create Entity
            ctx.sphereEntities[r][c] = EntityManager::get().create();

            RenderableManager::Builder(1)
                .boundingBox({{-0.5f, -0.5f, -0.5f}, {0.5f, 0.5f, 0.5f}})
                .material(0, ctx.sphereInstances[r][c])
                .geometry(0, RenderableManager::PrimitiveType::TRIANGLES, vb, ib, 0, ib->getIndexCount())
                .build(*ctx.engine, ctx.sphereEntities[r][c]);

            ctx.scene->addEntity(ctx.sphereEntities[r][c]);

            // Set fixed world translation (zero runtime reallocation)
            auto inst = tm.getInstance(ctx.sphereEntities[r][c]);
            float posX = c * SPACING - offsetX;
            float posY = (GRID_ROWS - 1 - r) * SPACING - offsetY;
            tm.setTransform(inst, mat4f::translation(float3{posX, posY, 0.0f}));
        }
    }
}

void RenderGridFrame(MatrixDemoContext& ctx) {
    if (ctx.renderer->beginFrame(nullptr)) {
        ctx.renderer->render(ctx.view);
        ctx.renderer->endFrame();
    }
}
