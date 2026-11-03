#include "engine/Engine.hpp"
#include "engine/MobaEngine.hpp"
#include <iostream>
#include <chrono>
#include <thread>
#include <cmath>

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

static LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_CLOSE:
            DestroyWindow(hwnd);
            break;
        case WM_DESTROY:
            PostQuitMessage(0);
            break;
        case WM_KEYDOWN:
            if (wParam == VK_ESCAPE) PostQuitMessage(0);
            break;
        default:
            return DefWindowProc(hwnd, msg, wParam, lParam);
    }
    return 0;
}
#endif

using namespace EngineCore;

enum class GameState {
    MainMenu,
    HeroSelect,
    ItemShop,
    Playing
};

static GameState g_gameState = GameState::Playing;

void SetPerspective(float fovY, float aspect, float zNear, float zFar) {
#if defined(_WIN32)
    float fH = tanf(fovY / 360.0f * 3.14159265f) * zNear;
    float fW = fH * aspect;
    glFrustum(-fW, fW, -fH, fH, zNear, zFar);
#endif
}

void DrawCube(float size) {
#if defined(_WIN32)
    float s = size * 0.5f;
    glBegin(GL_QUADS);
    glVertex3f(-s, -s,  s); glVertex3f( s, -s,  s); glVertex3f( s,  s,  s); glVertex3f(-s,  s,  s);
    glVertex3f(-s, -s, -s); glVertex3f(-s,  s, -s); glVertex3f( s,  s, -s); glVertex3f( s, -s, -s);
    glVertex3f(-s,  s, -s); glVertex3f(-s,  s,  s); glVertex3f( s,  s,  s); glVertex3f( s,  s, -s);
    glVertex3f(-s, -s, -s); glVertex3f( s, -s, -s); glVertex3f( s, -s,  s); glVertex3f(-s, -s,  s);
    glVertex3f( s, -s, -s); glVertex3f( s,  s, -s); glVertex3f( s,  s,  s); glVertex3f( s, -s,  s);
    glVertex3f(-s, -s, -s); glVertex3f(-s, -s,  s); glVertex3f(-s,  s,  s); glVertex3f(-s,  s, -s);
    glEnd();
#endif
}

void DrawCylinder(float baseR, float topR, float h, int slices) {
#if defined(_WIN32)
    glBegin(GL_QUAD_STRIP);
    for (int i = 0; i <= slices; ++i) {
        float a = i * 2.0f * 3.14159265f / slices;
        float c = std::cos(a), s = std::sin(a);
        glVertex3f(c * baseR, 0.0f, s * baseR);
        glVertex3f(c * topR, h, s * topR);
    }
    glEnd();
#endif
}

void DrawHealthBar(float hpRatio, float width = 1.4f, float height = 0.22f) {
#if defined(_WIN32)
    float halfW = width * 0.5f;
    float clampedHp = std::max(0.0f, std::min(1.0f, hpRatio));

    glColor3f(0.1f, 0.1f, 0.1f);
    glBegin(GL_QUADS);
    glVertex3f(-halfW, 0.0f, 0.0f);
    glVertex3f( halfW, 0.0f, 0.0f);
    glVertex3f( halfW, height, 0.0f);
    glVertex3f(-halfW, height, 0.0f);
    glEnd();

    float fillW = -halfW + (width * clampedHp);
    if (clampedHp > 0.5f) glColor3f(0.2f, 0.9f, 0.3f);
    else if (clampedHp > 0.25f) glColor3f(0.9f, 0.8f, 0.1f);
    else glColor3f(0.9f, 0.2f, 0.2f);

    glBegin(GL_QUADS);
    glVertex3f(-halfW, 0.02f, 0.01f);
    glVertex3f( fillW, 0.02f, 0.01f);
    glVertex3f( fillW, height - 0.02f, 0.01f);
    glVertex3f(-halfW, height - 0.02f, 0.01f);
    glEnd();
#endif
}

int main(int argc, char* argv[]) {
    (void)argc; (void)argv;
    std::cout << "=================================================================\n";
    std::cout << "  MOBA: Forest of Hollow Blood - Official C++ Game Engine         \n";
    std::cout << "=================================================================\n";

    EngineConfig config;
    config.width = 1280;
    config.height = 720;

    Engine engine;
    if (!engine.Init(config)) {
        std::cerr << "Failed to initialize C++ Engine Core!" << std::endl;
        return 1;
    }

    MobaGameEngine mobaEngine;
    mobaEngine.Init();

    float cameraX = 0.0f;
    float cameraZ = -38.0f;

#if defined(_WIN32)
    HINSTANCE hInstance = GetModuleHandle(NULL);
    WNDCLASSEXA wc = {};
    wc.cbSize = sizeof(WNDCLASSEXA);
    wc.style = CS_OWNDC | CS_HREDRAW | CS_VREDRAW;
    wc.lpfnWndProc = WndProc;
    wc.hInstance = hInstance;
    wc.hCursor = LoadCursor(NULL, IDC_ARROW);
    wc.lpszClassName = "MobaNativeFullEngineClass";

    if (!RegisterClassExA(&wc)) return 1;

    RECT wr = { 0, 0, (LONG)config.width, (LONG)config.height };
    AdjustWindowRect(&wr, WS_OVERLAPPEDWINDOW, FALSE);

    HWND hwnd = CreateWindowExA(
        0, wc.lpszClassName, "MOBA: Forest of Hollow Blood - Official Native C++ Engine",
        WS_OVERLAPPEDWINDOW | WS_VISIBLE,
        CW_USEDEFAULT, CW_USEDEFAULT, wr.right - wr.left, wr.bottom - wr.top,
        NULL, NULL, hInstance, NULL
    );

    if (!hwnd) return 1;

    HDC hdc = GetDC(hwnd);

    PIXELFORMATDESCRIPTOR pfd = {};
    pfd.nSize = sizeof(PIXELFORMATDESCRIPTOR);
    pfd.nVersion = 1;
    pfd.dwFlags = PFD_DRAW_TO_WINDOW | PFD_SUPPORT_OPENGL | PFD_DOUBLEBUFFER;
    pfd.iPixelType = PFD_TYPE_RGBA;
    pfd.cColorBits = 32;
    pfd.cDepthBits = 24;

    int pixelFormat = ChoosePixelFormat(hdc, &pfd);
    SetPixelFormat(hdc, pixelFormat, &pfd);

    HGLRC hglrc = wglCreateContext(hdc);
    wglMakeCurrent(hdc, hglrc);

    glEnable(GL_DEPTH_TEST);
    glDisable(GL_CULL_FACE);
    glViewport(0, 0, config.width, config.height);

    std::cout << "[Native C++ Engine] MobaGameEngine initialized with 6 Official Heroes:\n";
    std::cout << "  1. Arissa  2. Bot  3. Erika  4. Monster  5. Skeletonz  6. Woman Mobile\n";

    MSG msg = {};
    bool running = true;
    float time = 0.0f;

    while (running) {
        while (PeekMessage(&msg, NULL, 0, 0, PM_REMOVE)) {
            if (msg.message == WM_QUIT) running = false;

            if (msg.message == WM_KEYDOWN) {
                WPARAM vk = msg.wParam;
                if (vk == '1') mobaEngine.SelectHeroByIndex(0); // Arissa
                else if (vk == '2') mobaEngine.SelectHeroByIndex(1); // Bot
                else if (vk == '3') mobaEngine.SelectHeroByIndex(2); // Erika
                else if (vk == '4') mobaEngine.SelectHeroByIndex(3); // Monster
                else if (vk == '5') mobaEngine.SelectHeroByIndex(4); // Skeletonz
                else if (vk == '6') mobaEngine.SelectHeroByIndex(5); // Woman Mobile
                else if (vk == 'B' || vk == 'b') mobaEngine.BuyItem("health_vial");
                else if (vk == 'W' || vk == 'w' || vk == VK_UP) cameraZ += 1.2f;
                else if (vk == 'S' || vk == 's' || vk == VK_DOWN) cameraZ -= 1.2f;
                else if (vk == 'A' || vk == 'a' || vk == VK_LEFT) cameraX -= 1.2f;
                else if (vk == 'D' || vk == 'd' || vk == VK_RIGHT) cameraX += 1.2f;
            }

            TranslateMessage(&msg);
            DispatchMessage(&msg);
        }

        if (!running) break;

        float dt = 0.016f;
        time += dt;

        engine.Update(dt);
        mobaEngine.Update(dt);

        // Render Frame
        glClearColor(0.08f, 0.12f, 0.15f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

        glMatrixMode(GL_PROJECTION);
        glLoadIdentity();
        float aspect = (float)config.width / (float)(config.height > 0 ? config.height : 1);
        SetPerspective(48.0f, aspect, 0.5f, 200.0f);

        glMatrixMode(GL_MODELVIEW);
        glLoadIdentity();
        glTranslatef(cameraX, -8.0f, cameraZ);
        glRotatef(52.0f, 1.0f, 0.0f, 0.0f);

        // Terrain
        glBegin(GL_QUADS);
        glColor3f(0.14f, 0.32f, 0.16f);
        glVertex3f(-25.0f, 0.0f, -25.0f);
        glVertex3f( 25.0f, 0.0f, -25.0f);
        glVertex3f( 25.0f, 0.0f,  25.0f);
        glVertex3f(-25.0f, 0.0f,  25.0f);
        glEnd();

        // River
        glBegin(GL_QUADS);
        glColor3f(0.12f, 0.48f, 0.78f);
        glVertex3f(-25.0f, 0.02f,  18.0f);
        glVertex3f(-18.0f, 0.02f,  25.0f);
        glVertex3f( 25.0f, 0.02f, -18.0f);
        glVertex3f( 18.0f, 0.02f, -25.0f);
        glEnd();

        // Lanes
        glLineWidth(8.0f);
        glBegin(GL_LINES);
        glColor3f(0.55f, 0.42f, 0.25f);
        glVertex3f(-14.0f, 0.05f, -14.0f); glVertex3f(14.0f, 0.05f, 14.0f);
        glVertex3f(-14.0f, 0.05f, -14.0f); glVertex3f(-14.0f, 0.05f, 14.0f);
        glVertex3f(-14.0f, 0.05f, 14.0f);  glVertex3f(14.0f, 0.05f, 14.0f);
        glVertex3f(-14.0f, 0.05f, -14.0f); glVertex3f(14.0f, 0.05f, -14.0f);
        glVertex3f(14.0f, 0.05f, -14.0f);  glVertex3f(14.0f, 0.05f, 14.0f);
        glEnd();

        // Towers
        for (const auto& tower : mobaEngine.GetTowers()) {
            if (!tower.damageable || !tower.damageable->IsAlive()) continue;

            glPushMatrix();
            glTranslatef(tower.position.x, 0.0f, tower.position.z);

            glColor3f(0.3f, 0.3f, 0.35f);
            DrawCylinder(1.2f, 0.8f, 2.5f, 10);

            glPushMatrix();
            glTranslatef(0.0f, 2.5f, 0.0f);
            if (tower.team == MobaTeam::RED_RADIANT) glColor3f(0.9f, 0.2f, 0.2f);
            else                                     glColor3f(0.2f, 0.5f, 0.9f);
            DrawCube(0.9f);
            glPopMatrix();

            glPushMatrix();
            glTranslatef(0.0f, 3.8f, 0.0f);
            DrawHealthBar(tower.damageable->health / tower.damageable->maxHealth, 1.8f, 0.25f);
            glPopMatrix();

            glPopMatrix();
        }

        // Creeps
        for (const auto& creep : mobaEngine.GetCreeps()) {
            if (!creep.damageable || !creep.damageable->IsAlive()) continue;

            glPushMatrix();
            glTranslatef(creep.position.x, creep.position.y, creep.position.z);

            glPushMatrix();
            glTranslatef(0.0f, 0.5f, 0.0f);
            if (creep.team == MobaTeam::RED_RADIANT) glColor3f(0.95f, 0.8f, 0.1f);
            else                                     glColor3f(0.1f, 0.85f, 0.95f);
            DrawCube(0.8f);
            glPopMatrix();

            glPushMatrix();
            glTranslatef(0.0f, 1.4f, 0.0f);
            DrawHealthBar(creep.damageable->health / creep.damageable->maxHealth, 1.0f, 0.18f);
            glPopMatrix();

            glPopMatrix();
        }

        // Hero Unit
        Vec3 heroPos = mobaEngine.playerController.position;
        glPushMatrix();
        glTranslatef(heroPos.x, heroPos.y, heroPos.z);

        glPushMatrix();
        glTranslatef(0.0f, 0.8f, 0.0f);
        glColor3f(1.0f, 0.55f, 0.0f);
        DrawCylinder(0.6f, 0.4f, 1.6f, 10);
        glPopMatrix();

        glPushMatrix();
        glTranslatef(0.0f, 2.8f, 0.0f);
        DrawHealthBar(1.0f, 1.8f, 0.25f);
        glPopMatrix();

        glPopMatrix();

        SwapBuffers(hdc);
        std::this_thread::sleep_for(std::chrono::milliseconds(16));
    }

    wglMakeCurrent(NULL, NULL);
    wglDeleteContext(hglrc);
    ReleaseDC(hwnd, hdc);
    DestroyWindow(hwnd);
    std::cout << "[Pure C++ Native Engine] Window closed.\n";
#else
    std::cout << "Headless C++ engine simulation...\n";
#endif

    return 0;
}
