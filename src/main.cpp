#include "engine/Engine.hpp"
#include <iostream>
#include <chrono>
#include <thread>
#include <vector>
#include <cmath>
#include <string>

#if defined(_WIN32)
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
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

// Simple 3D Vector
struct Vec3 {
    float x, y, z;
    Vec3(float _x = 0, float _y = 0, float _z = 0) : x(_x), y(_y), z(_z) {}
    float dist(const Vec3& o) const {
        float dx = x - o.x, dy = y - o.y, dz = z - o.z;
        return std::sqrt(dx*dx + dy*dy + dz*dz);
    }
};

enum class Team { RED, BLACK };

struct MobaUnit {
    Vec3 pos;
    Team team;
    float hp;
    float speed;
    size_t waypointIndex;
    std::vector<Vec3> waypoints;

    void update(float dt) {
        if (hp <= 0.0f || waypointIndex >= waypoints.size()) return;
        const Vec3& target = waypoints[waypointIndex];
        float d = pos.dist(target);
        if (d < 0.8f) {
            waypointIndex++;
        } else {
            float dx = target.x - pos.x;
            float dz = target.z - pos.z;
            float len = std::hypot(dx, dz);
            if (len > 0.001f) {
                pos.x += (dx / len) * speed * dt;
                pos.z += (dz / len) * speed * dt;
            }
        }
    }
};

// OpenGL Frustum Helper
void SetPerspective(float fovY, float aspect, float zNear, float zFar) {
#if defined(_WIN32)
    float fH = tanf(fovY / 360.0f * 3.14159265f) * zNear;
    float fW = fH * aspect;
    glFrustum(-fW, fW, -fH, fH, zNear, zFar);
#endif
}

// Render Solid 3D Cube
void DrawCube(float size) {
#if defined(_WIN32)
    float s = size * 0.5f;
    glBegin(GL_QUADS);
    // Front
    glVertex3f(-s, -s,  s); glVertex3f( s, -s,  s); glVertex3f( s,  s,  s); glVertex3f(-s,  s,  s);
    // Back
    glVertex3f(-s, -s, -s); glVertex3f(-s,  s, -s); glVertex3f( s,  s, -s); glVertex3f( s, -s, -s);
    // Top
    glVertex3f(-s,  s, -s); glVertex3f(-s,  s,  s); glVertex3f( s,  s,  s); glVertex3f( s,  s, -s);
    // Bottom
    glVertex3f(-s, -s, -s); glVertex3f( s, -s, -s); glVertex3f( s, -s,  s); glVertex3f(-s, -s,  s);
    // Right
    glVertex3f( s, -s, -s); glVertex3f( s,  s, -s); glVertex3f( s,  s,  s); glVertex3f( s, -s,  s);
    // Left
    glVertex3f(-s, -s, -s); glVertex3f(-s, -s,  s); glVertex3f(-s,  s,  s); glVertex3f(-s,  s, -s);
    glEnd();
#endif
}

// Render Upright 3D Tower Column
void DrawTower(float radius, float height, int slices) {
#if defined(_WIN32)
    glBegin(GL_QUAD_STRIP);
    for (int i = 0; i <= slices; ++i) {
        float angle = i * 2.0f * 3.14159265f / slices;
        float cosA = std::cos(angle);
        float sinA = std::sin(angle);

        glVertex3f(cosA * radius, 0.0f, sinA * radius);
        glVertex3f(cosA * (radius * 0.7f), height, sinA * (radius * 0.7f));
    }
    glEnd();

    // Top Gem
    glBegin(GL_TRIANGLES);
    glVertex3f(0.0f, height + 1.2f, 0.0f);
    glVertex3f(-radius, height, radius);
    glVertex3f(radius, height, radius);

    glVertex3f(0.0f, height + 1.2f, 0.0f);
    glVertex3f(radius, height, radius);
    glVertex3f(radius, height, -radius);

    glVertex3f(0.0f, height + 1.2f, 0.0f);
    glVertex3f(radius, height, -radius);
    glVertex3f(-radius, height, -radius);

    glVertex3f(0.0f, height + 1.2f, 0.0f);
    glVertex3f(-radius, height, -radius);
    glVertex3f(-radius, height, radius);
    glEnd();
#endif
}

int main(int argc, char* argv[]) {
    (void)argc; (void)argv;
    std::cout << "=====================================================\n";
    std::cout << "  Killer App Native C++ MOBA Engine: Forest of Blood \n";
    std::cout << "=====================================================\n";

    EngineCore::EngineConfig config;
    config.width = 1280;
    config.height = 720;
    config.enableDepthTest = true;

    EngineCore::Engine engine;
    if (!engine.Init(config)) {
        std::cerr << "Failed to initialize Killer App Native Engine!" << std::endl;
        return 1;
    }

#if defined(_WIN32)
    HINSTANCE hInstance = GetModuleHandle(NULL);
    WNDCLASSEXA wc = {};
    wc.cbSize = sizeof(WNDCLASSEXA);
    wc.style = CS_OWNDC | CS_HREDRAW | CS_VREDRAW;
    wc.lpfnWndProc = WndProc;
    wc.hInstance = hInstance;
    wc.hCursor = LoadCursor(NULL, IDC_ARROW);
    wc.lpszClassName = "MobaWindowClass";

    if (!RegisterClassExA(&wc)) {
        std::cerr << "Failed to register Win32 window class!" << std::endl;
        return 1;
    }

    RECT wr = { 0, 0, (LONG)config.width, (LONG)config.height };
    AdjustWindowRect(&wr, WS_OVERLAPPEDWINDOW, FALSE);

    HWND hwnd = CreateWindowExA(
        0, wc.lpszClassName, "MOBA: Forest of Hollow Blood - Native 3D Viewport",
        WS_OVERLAPPEDWINDOW | WS_VISIBLE,
        CW_USEDEFAULT, CW_USEDEFAULT, wr.right - wr.left, wr.bottom - wr.top,
        NULL, NULL, hInstance, NULL
    );

    if (!hwnd) {
        std::cerr << "Failed to create Win32 window!" << std::endl;
        return 1;
    }

    HDC hdc = GetDC(hwnd);

    PIXELFORMATDESCRIPTOR pfd = {};
    pfd.nSize = sizeof(PIXELFORMATDESCRIPTOR);
    pfd.nVersion = 1;
    pfd.dwFlags = PFD_DRAW_TO_WINDOW | PFD_SUPPORT_OPENGL | PFD_DOUBLEBUFFER;
    pfd.iPixelType = PFD_TYPE_RGBA;
    pfd.cColorBits = 32;
    pfd.cDepthBits = 24;
    pfd.iLayerType = PFD_MAIN_PLANE;

    int pixelFormat = ChoosePixelFormat(hdc, &pfd);
    SetPixelFormat(hdc, pixelFormat, &pfd);

    HGLRC hglrc = wglCreateContext(hdc);
    wglMakeCurrent(hdc, hglrc);

    glEnable(GL_DEPTH_TEST);
    glDisable(GL_CULL_FACE); // Render all faces
    glViewport(0, 0, config.width, config.height);

    std::cout << "[Win32 MOBA Viewport] Native 3D MOBA Map & Unit System running!\n";

    // Setup Waypoints for 3 Lanes
    std::vector<Vec3> redMid = { Vec3(-14, 0, -14), Vec3(-7, 0, -7), Vec3(0, 0, 0), Vec3(7, 0, 7), Vec3(14, 0, 14) };
    std::vector<Vec3> blackMid = { Vec3(14, 0, 14), Vec3(7, 0, 7), Vec3(0, 0, 0), Vec3(-7, 0, -7), Vec3(-14, 0, -14) };

    std::vector<MobaUnit> units;
    for (int i = 0; i < 5; ++i) {
        MobaUnit r;
        r.pos = Vec3(-14.0f + i * 1.0f, 0.0f, -14.0f);
        r.team = Team::RED;
        r.hp = 300.0f;
        r.speed = 3.5f;
        r.waypointIndex = 0;
        r.waypoints = redMid;
        units.push_back(r);

        MobaUnit b;
        b.pos = Vec3(14.0f - i * 1.0f, 0.0f, 14.0f);
        b.team = Team::BLACK;
        b.hp = 300.0f;
        b.speed = 3.5f;
        b.waypointIndex = 0;
        b.waypoints = blackMid;
        units.push_back(b);
    }

    std::vector<Vec3> redTowers = { Vec3(-10, 0, -10), Vec3(-5, 0, -5) };
    std::vector<Vec3> blackTowers = { Vec3(10, 0, 10), Vec3(5, 0, 5) };

    MSG msg = {};
    bool running = true;
    float time = 0.0f;

    while (running) {
        while (PeekMessage(&msg, NULL, 0, 0, PM_REMOVE)) {
            if (msg.message == WM_QUIT) running = false;
            TranslateMessage(&msg);
            DispatchMessage(&msg);
        }

        if (!running) break;

        float dt = 0.016f;
        time += dt;
        engine.Update(dt);

        for (auto& u : units) {
            u.update(dt);
            if (u.waypointIndex >= u.waypoints.size()) {
                u.waypointIndex = 0;
                u.pos = u.waypoints[0];
            }
        }

        // Clear Screen
        glClearColor(0.1f, 0.12f, 0.18f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

        // 1. Projection Matrix
        glMatrixMode(GL_PROJECTION);
        glLoadIdentity();
        float aspect = (float)config.width / (float)(config.height > 0 ? config.height : 1);
        SetPerspective(50.0f, aspect, 0.5f, 200.0f);

        // 2. Camera ModelView Matrix
        glMatrixMode(GL_MODELVIEW);
        glLoadIdentity();
        // Position camera high above looking down at center
        glTranslatef(0.0f, -8.0f, -38.0f);
        glRotatef(50.0f, 1.0f, 0.0f, 0.0f);
        glRotatef(time * 8.0f, 0.0f, 1.0f, 0.0f); // Gentle rotation

        // 3. Render Ground Map (Grass Plane)
        glBegin(GL_QUADS);
        glColor3f(0.18f, 0.42f, 0.20f);
        glVertex3f(-25.0f, 0.0f, -25.0f);
        glVertex3f( 25.0f, 0.0f, -25.0f);
        glVertex3f( 25.0f, 0.0f,  25.0f);
        glVertex3f(-25.0f, 0.0f,  25.0f);
        glEnd();

        // 4. Render River Channel
        glBegin(GL_QUADS);
        glColor3f(0.15f, 0.55f, 0.85f);
        glVertex3f(-25.0f, 0.02f,  18.0f);
        glVertex3f(-18.0f, 0.02f,  25.0f);
        glVertex3f( 25.0f, 0.02f, -18.0f);
        glVertex3f( 18.0f, 0.02f, -25.0f);
        glEnd();

        // 5. Render Mid & Side Lanes
        glLineWidth(8.0f);
        glBegin(GL_LINES);
        glColor3f(0.6f, 0.48f, 0.28f);
        // Mid
        glVertex3f(-14.0f, 0.05f, -14.0f); glVertex3f(14.0f, 0.05f, 14.0f);
        // Top
        glVertex3f(-14.0f, 0.05f, -14.0f); glVertex3f(-14.0f, 0.05f, 14.0f);
        glVertex3f(-14.0f, 0.05f, 14.0f);  glVertex3f(14.0f, 0.05f, 14.0f);
        // Bot
        glVertex3f(-14.0f, 0.05f, -14.0f); glVertex3f(14.0f, 0.05f, -14.0f);
        glVertex3f(14.0f, 0.05f, -14.0f);  glVertex3f(14.0f, 0.05f, 14.0f);
        glEnd();

        // 6. Render Ancients / Bases
        // Red Base
        glPushMatrix();
        glTranslatef(-14.0f, 0.0f, -14.0f);
        glColor3f(1.0f, 0.2f, 0.2f);
        DrawCube(3.2f);
        glPopMatrix();

        // Black Base
        glPushMatrix();
        glTranslatef(14.0f, 0.0f, 14.0f);
        glColor3f(0.2f, 0.4f, 1.0f);
        DrawCube(3.2f);
        glPopMatrix();

        // 7. Render Upright Towers
        glColor3f(0.9f, 0.25f, 0.25f);
        for (const auto& t : redTowers) {
            glPushMatrix();
            glTranslatef(t.x, t.y, t.z);
            DrawTower(1.0f, 3.5f, 12);
            glPopMatrix();
        }

        glColor3f(0.25f, 0.5f, 1.0f);
        for (const auto& t : blackTowers) {
            glPushMatrix();
            glTranslatef(t.x, t.y, t.z);
            DrawTower(1.0f, 3.5f, 12);
            glPopMatrix();
        }

        // 8. Render Moving Creeps
        for (const auto& u : units) {
            glPushMatrix();
            glTranslatef(u.pos.x, u.pos.y + 0.5f, u.pos.z);
            if (u.team == Team::RED) glColor3f(1.0f, 0.85f, 0.1f);
            else                     glColor3f(0.1f, 0.95f, 0.95f);
            DrawCube(1.0f);
            glPopMatrix();
        }

        SwapBuffers(hdc);
        std::this_thread::sleep_for(std::chrono::milliseconds(16));
    }

    wglMakeCurrent(NULL, NULL);
    wglDeleteContext(hglrc);
    ReleaseDC(hwnd, hdc);
    DestroyWindow(hwnd);
    std::cout << "[Win32 MOBA Viewport] Window closed.\n";
#else
    std::cout << "Headless simulation...\n";
#endif

    return 0;
}
