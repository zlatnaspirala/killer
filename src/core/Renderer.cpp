#include "engine/Renderer.hpp"
#include "engine/Camera.hpp"
#include "engine/Engine.hpp"
#include <cmath>
#include <iostream>
#include <vector>

#if defined(_WIN32)
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <gl/GL.h>
#pragma comment(lib, "opengl32.lib")
#endif

namespace EngineCore {

struct ItemPickup {
    std::string key;
    std::string name;
    float pos[3];
    float color[3];
    bool active = true;
    float respawnTimer = 0.0f;
};

static std::vector<ItemPickup> g_items = {
    { "health_small", "Small Health Vial", {-10.0f, 0.5f, -5.0f}, {0.15f, 0.95f, 0.65f}, true, 0.0f },
    { "megahealth", "MegaHealth Sphere", {0.0f, 0.8f, 0.0f}, {0.06f, 0.92f, 0.95f}, true, 0.0f },
    { "armor_yellow", "Yellow Combat Armor", {10.0f, 0.5f, -5.0f}, {0.95f, 0.80f, 0.15f}, true, 0.0f },
    { "powerup_quad", "Quad Damage Rune", {0.0f, 1.0f, 10.0f}, {0.20f, 0.55f, 1.0f}, true, 0.0f },
    { "powerup_haste", "Haste Speed Rune", {-8.0f, 0.6f, 8.0f}, {0.95f, 0.85f, 0.15f}, true, 0.0f }
};

Renderer::Renderer() = default;
Renderer::~Renderer() = default;

bool Renderer::Init(const EngineConfig& config) {
    (void)config;
    for (int i = 0; i < 16; ++i) m_modelMatrix[i] = (i % 5 == 0) ? 1.0f : 0.0f;

#if defined(_WIN32)
    glEnable(GL_DEPTH_TEST);
    glDisable(GL_CULL_FACE);
    glShadeModel(GL_SMOOTH);
#endif

    return true;
}

void Renderer::SetViewport(int x, int y, int width, int height) {
#if defined(_WIN32)
    glViewport(x, y, width, height);
#else
    (void)x; (void)y; (void)width; (void)height;
#endif
}

void Renderer::BeginFrame(const float clearColor[4]) {
    m_drawCalls = 0;
    m_vertexCount = 0;
    m_triangleCount = 0;

#if defined(_WIN32)
    if (clearColor) {
        glClearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
    } else {
        glClearColor(0.08f, 0.12f, 0.15f, 1.0f);
    }
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
#else
    (void)clearColor;
#endif
}

void Renderer::DrawScene(const CameraController& camera, float time, const float baseColor[3], float roughness) {
    (void)camera;
    (void)baseColor;
    (void)roughness;

#if defined(_WIN32)
    // 1. Camera Projection
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    float aspect = 1280.0f / 720.0f;
    float fH = tanf(48.0f / 360.0f * 3.14159265f) * 0.5f;
    float fW = fH * aspect;
    glFrustum(-fW, fW, -fH, fH, 0.5f, 200.0f);

    // 2. Camera View Transformation
    glMatrixMode(GL_MODELVIEW);
    glLoadIdentity();
    glTranslatef(0.0f, -8.0f, -38.0f);
    glRotatef(52.0f, 1.0f, 0.0f, 0.0f);
    glRotatef(time * 5.0f, 0.0f, 1.0f, 0.0f);

    // 3. Render Arena Ground Plane (Basalt PBR)
    glBegin(GL_QUADS);
    glColor3f(0.18f, 0.22f, 0.26f);
    glVertex3f(-25.0f, 0.0f, -25.0f);
    glVertex3f( 25.0f, 0.0f, -25.0f);
    glVertex3f( 25.0f, 0.0f,  25.0f);
    glVertex3f(-25.0f, 0.0f,  25.0f);
    glEnd();

    // 4. Render Diagonal River Channel
    glBegin(GL_QUADS);
    glColor3f(0.12f, 0.48f, 0.78f);
    glVertex3f(-25.0f, 0.02f,  18.0f);
    glVertex3f(-18.0f, 0.02f,  25.0f);
    glVertex3f( 25.0f, 0.02f, -18.0f);
    glVertex3f( 18.0f, 0.02f, -25.0f);
    glEnd();

    // 5. Render Dirt Lanes
    glLineWidth(8.0f);
    glBegin(GL_LINES);
    glColor3f(0.55f, 0.42f, 0.25f);
    glVertex3f(-14.0f, 0.05f, -14.0f); glVertex3f(14.0f, 0.05f, 14.0f);
    glVertex3f(-14.0f, 0.05f, -14.0f); glVertex3f(-14.0f, 0.05f, 14.0f);
    glVertex3f(-14.0f, 0.05f, 14.0f);  glVertex3f(14.0f, 0.05f, 14.0f);
    glVertex3f(-14.0f, 0.05f, -14.0f); glVertex3f(14.0f, 0.05f, -14.0f);
    glVertex3f(14.0f, 0.05f, -14.0f);  glVertex3f(14.0f, 0.05f, 14.0f);
    glEnd();

    // 6. Render Floating Elemental Items & Runes Catalog
    for (auto& item : g_items) {
        if (!item.active) continue;

        glPushMatrix();
        float hoverY = item.pos[1] + std::sin(time * 3.0f + item.pos[0]) * 0.2f;
        glTranslatef(item.pos[0], hoverY, item.pos[2]);
        glRotatef(time * 60.0f, 0.0f, 1.0f, 0.0f);

        // Glowing Rune/Item Core
        glColor3f(item.color[0], item.color[1], item.color[2]);
        
        float s = 0.5f;
        glBegin(GL_QUADS);
        glVertex3f(-s, -s,  s); glVertex3f( s, -s,  s); glVertex3f( s,  s,  s); glVertex3f(-s,  s,  s);
        glVertex3f(-s, -s, -s); glVertex3f(-s,  s, -s); glVertex3f( s,  s, -s); glVertex3f( s, -s, -s);
        glVertex3f(-s,  s, -s); glVertex3f(-s,  s,  s); glVertex3f( s,  s,  s); glVertex3f( s,  s, -s);
        glVertex3f(-s, -s, -s); glVertex3f( s, -s, -s); glVertex3f( s, -s,  s); glVertex3f(-s, -s,  s);
        glVertex3f( s, -s, -s); glVertex3f( s,  s, -s); glVertex3f( s,  s,  s); glVertex3f( s, -s,  s);
        glVertex3f(-s, -s, -s); glVertex3f(-s, -s,  s); glVertex3f(-s,  s,  s); glVertex3f(-s,  s, -s);
        glEnd();

        glPopMatrix();
        m_drawCalls++;
    }

    m_drawCalls += 10;
    m_vertexCount += 120;
    m_triangleCount += 60;
#endif
}

void Renderer::EndFrame() {
    FlushMaterialBatches();
}

void Renderer::UpdateModelTransform(float angleX, float angleY) {
    float cx = std::cos(angleX); float sx = std::sin(angleX);
    float cy = std::cos(angleY); float sy = std::sin(angleY);

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
    for (const auto& bucket : m_batchQueue) {
        if (!bucket.instances.empty()) {
            m_drawCalls++;
            m_triangleCount += (bucket.indexCount / 3) * bucket.instances.size();
        }
    }
    m_batchQueue.clear();
}

} // namespace EngineCore
