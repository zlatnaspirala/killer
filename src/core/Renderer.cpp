#include "engine/Renderer.hpp"
#include "engine/Camera.hpp"
#include "engine/Engine.hpp"
#include <cmath>
#include <iostream>
#include <algorithm>

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

Renderer::Renderer() = default;
Renderer::~Renderer() = default;

bool Renderer::Init(const EngineConfig& config) {
    (void)config;
    // Set identity model matrix
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
    (void)time;
    (void)baseColor;
    (void)roughness;

#if defined(_WIN32)
    // 1. Setup Camera Projection
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    float aspect = 1280.0f / 720.0f;
    float fH = tanf(48.0f / 360.0f * 3.14159265f) * 0.5f;
    float fW = fH * aspect;
    glFrustum(-fW, fW, -fH, fH, 0.5f, 200.0f);

    // 2. Setup Camera View Transformation
    glMatrixMode(GL_MODELVIEW);
    glLoadIdentity();
    glTranslatef(0.0f, -8.0f, -38.0f);
    glRotatef(52.0f, 1.0f, 0.0f, 0.0f);
    glRotatef(time * 5.0f, 0.0f, 1.0f, 0.0f);

    // 3. Render Ground Terrain
    glBegin(GL_QUADS);
    glColor3f(0.14f, 0.32f, 0.16f);
    glVertex3f(-25.0f, 0.0f, -25.0f);
    glVertex3f( 25.0f, 0.0f, -25.0f);
    glVertex3f( 25.0f, 0.0f,  25.0f);
    glVertex3f(-25.0f, 0.0f,  25.0f);
    glEnd();

    // 4. Render River
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

    m_drawCalls += 5;
    m_vertexCount += 48;
    m_triangleCount += 24;
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
