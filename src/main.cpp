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

// Simple 3D Vector for MOBA Simulation
struct Vec3 {
    float x, y, z;
    Vec3(float _x = 0, float _y = 0, float _z = 0) : x(_x), y(_y), z(_z) {}
    float dist(const Vec3& o) const {
        float dx = x - o.x, dy = y - o.y, dz = z - o.z;
        return std::sqrt(dx*dx + dy*dy + dz*dz);
    }
};

// MOBA Unit Types
enum class Team { RED, BLACK };

struct MobaUnit {
    Vec3 pos;
    Team team;
    float hp;
    float maxHp;
    float speed;
    size_t waypointIndex;
    std::vector<Vec3> waypoints;

    void update(float dt) {
        if (hp <= 0.0f || waypointIndex >= waypoints.size()) return;
        const Vec3& target = waypoints[waypointIndex];
        float d = pos.dist(target);
        if (d < 0.6f) {
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

// Helper: Render 3D Cylinder for Towers
void DrawCylinder(float baseRadius, float topRadius, float height, int slices) {
#if defined(_WIN32)
    glBegin(GL_TRIANGLE_STRIP);
    for (int i = 0; i <= slices; ++i) {
        float angle = i * 2.0f * 3.14159265f / slices;
        float cosA = std::cos(angle);
        float sinA = std::sin(angle);

        glNormal3f(cosA, 0.0f, sinA);
        glVertex3f(cosA * baseRadius, 0.0f, sinA * baseRadius);
        glVertex3f(cosA * topRadius, height, sinA * topRadius);
    }
    glEnd();
#endif
}

// Helper: Render 3D Sphere / Cube
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
    glViewport(0, 0, config.width, config.height);

    std::cout << "[Win32 MOBA Viewport] Native 3D MOBA Map & Unit System running!\n";

    // Setup Waypoints for 3 Classic Dota Lanes
    std::vector<Vec3> redToBlackMid = {
        Vec3(-14, 0, -14), Vec3(-8, 0, -8), Vec3(0, 0, 0), Vec3(8, 0, 8), Vec3(14, 0, 14)
    };
    std::vector<Vec3> blackToRedMid = {
        Vec3(14, 0, 14), Vec3(8, 0, 8), Vec3(0, 0, 0), Vec3(-8, 0, -8), Vec3(-14, 0, -14)
    };

    std::vector<MobaUnit> units;
    // Spawn Creeps
    for (int i = 0; i < 4; ++i) {
        MobaUnit redCreep;
        redCreep.pos = Vec3(-14.0f + i * 0.8f, 0.0f, -14.0f);
        redCreep.team = Team::RED;
        redCreep.hp = 300.0f; redCreep.maxHp = 300.0f;
        redCreep.speed = 3.5f;
        redCreep.waypointIndex = 0;
        redCreep.waypoints = redToBlackMid;
        units.push_back(redCreep);

        MobaUnit blackCreep;
        blackCreep.pos = Vec3(14.0f - i * 0.8f, 0.0f, 14.0f);
        blackCreep.team = Team::BLACK;
        blackCreep.hp = 300.0f; blackCreep.maxHp = 300.0f;
        blackCreep.speed = 3.5f;
        blackCreep.waypointIndex = 0;
        blackCreep.waypoints = blackToRedMid;
        units.push_back(blackCreep);
    }

    // Towers setup (Upright vertical cylinders)
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

        // Update Creeps
        for (auto& u : units) {
            u.update(dt);
            if (u.waypointIndex >= u.waypoints.size()) {
                u.waypointIndex = 0;
                u.pos = u.waypoints[0];
            }
        }

        // Render MOBA Map Graphics
        glClearColor(0.08f, 0.15f, 0.10f, 1.0f); // Grass green background
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

        glMatrixMode(GL_PROJECTION);
        glLoadIdentity();
        float aspect = (float)config.width / (float)config.height;
        float fov = 45.0f * 3.14159265f / 180.0f;
        float f = 1.0f / tanf(fov / 2.0f);
        float proj[16] = {
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, -1.02f, -1.0f,
            0, 0, -0.202f, 0
        };
        glLoadMatrixf(proj);

        glMatrixMode(GL_MODELVIEW);
        glLoadIdentity();
        // Top-Down MOBA Camera View
        glTranslatef(0.0f, -18.0f, -22.0f);
        glRotatef(55.0f, 1.0f, 0.0f, 0.0f);
        glRotatef(time * 5.0f, 0.0f, 1.0f, 0.0f); // Slow map rotation

        // 1. Draw Terrain Ground Plane
        glBegin(GL_QUADS);
        glColor3f(0.12f, 0.28f, 0.14f);
        glVertex3f(-20.0f, 0.0f, -20.0f);
        glVertex3f( 20.0f, 0.0f, -20.0f);
        glVertex3f( 20.0f, 0.0f,  20.0f);
        glVertex3f(-20.0f, 0.0f,  20.0f);
        glEnd();

        // 2. Draw Diagonal River
        glBegin(GL_QUADS);
        glColor3f(0.1f, 0.4f, 0.7f);
        glVertex3f(-20.0f, 0.05f,  15.0f);
        glVertex3f(-15.0f, 0.05f,  20.0f);
        glVertex3f( 20.0f, 0.05f, -15.0f);
        glVertex3f( 15.0f, 0.05f, -20.0f);
        glEnd();

        // 3. Draw Lanes (Dirt tracks)
        glLineWidth(6.0f);
        glBegin(GL_LINES);
        glColor3f(0.45f, 0.35f, 0.22f);
        // Mid lane
        glVertex3f(-14.0f, 0.08f, -14.0f); glVertex3f(14.0f, 0.08f, 14.0f);
        // Top lane
        glVertex3f(-14.0f, 0.08f, -14.0f); glVertex3f(-14.0f, 0.08f, 14.0f);
        glVertex3f(-14.0f, 0.08f, 14.0f);  glVertex3f(14.0f, 0.08f, 14.0f);
        // Bot lane
        glVertex3f(-14.0f, 0.08f, -14.0f); glVertex3f(14.0f, 0.08f, -14.0f);
        glVertex3f(14.0f, 0.08f, -14.0f);  glVertex3f(14.0f, 0.08f, 14.0f);
        glEnd();

        // 4. Draw Ancients / Bases
        // Red Base
        glPushMatrix();
        glTranslatef(-14.0f, 0.0f, -14.0f);
        glColor3f(0.9f, 0.15f, 0.15f);
        DrawCube(2.5f);
        glPopMatrix();

        // Black Base
        glPushMatrix();
        glTranslatef(14.0f, 0.0f, 14.0f);
        glColor3f(0.2f, 0.2f, 0.8f);
        DrawCube(2.5f);
        glPopMatrix();

        // 5. Draw Towers (Upright vertical 3D structures)
        glColor3f(0.8f, 0.2f, 0.2f);
        for (const auto& t : redTowers) {
            glPushMatrix();
            glTranslatef(t.x, t.y, t.z);
            DrawCylinder(0.6f, 0.4f, 2.8f, 12);
            glPopMatrix();
        }

        glColor3f(0.2f, 0.4f, 0.9f);
        for (const auto& t : blackTowers) {
            glPushMatrix();
            glTranslatef(t.x, t.y, t.z);
            DrawCylinder(0.6f, 0.4f, 2.8f, 12);
            glPopMatrix();
        }

        // 6. Draw Creeps (Moving Units)
        for (const auto& u : units) {
            glPushMatrix();
            glTranslatef(u.pos.x, u.pos.y + 0.3f, u.pos.z);
            if (u.team == Team::RED) glColor3f(1.0f, 0.2f, 0.2f);
            else                     glColor3f(0.2f, 0.6f, 1.0f);
            DrawCube(0.6f);
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
    std::cout << "Running MOBA simulation in headless mode...\n";
    for (int i = 0; i < 50; ++i) {
        engine.Update(0.016f);
    }
#endif

    return 0;
}
