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
    std::string name;
    Vec3 pos;
    Team team;
    float hp;
    float maxHp;
    float speed;
    float attackRange;
    float attackCooldown;
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
        if (attackCooldown > 0.0f) attackCooldown -= dt;
    }
};

struct Projectile {
    Vec3 src, dst, current;
    float progress;
    Team team;
};

// OpenGL Rendering Helper Functions
void SetPerspective(float fovY, float aspect, float zNear, float zFar) {
#if defined(_WIN32)
    float fH = tanf(fovY / 360.0f * 3.14159265f) * zNear;
    float fW = fH * aspect;
    glFrustum(-fW, fW, -fH, fH, zNear, zFar);
#endif
}

// Draw 3D Cylinder / Column
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

// Draw Conical Canopy
void DrawCone(float r, float h, int slices) {
#if defined(_WIN32)
    glBegin(GL_TRIANGLES);
    for (int i = 0; i < slices; ++i) {
        float a1 = i * 2.0f * 3.14159265f / slices;
        float a2 = (i + 1) * 2.0f * 3.14159265f / slices;
        glVertex3f(0.0f, h, 0.0f);
        glVertex3f(std::cos(a1) * r, 0.0f, std::sin(a1) * r);
        glVertex3f(std::cos(a2) * r, 0.0f, std::sin(a2) * r);
    }
    glEnd();
#endif
}

// Draw 3D Cube
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

// Draw Floating 3D Health Bar
void DrawHealthBar(float hpRatio, float width = 1.2f, float height = 0.2f) {
#if defined(_WIN32)
    float halfW = width * 0.5f;
    // Dark Background
    glColor3f(0.1f, 0.1f, 0.1f);
    glBegin(GL_QUADS);
    glVertex3f(-halfW, 0.0f, 0.0f);
    glVertex3f( halfW, 0.0f, 0.0f);
    glVertex3f( halfW, height, 0.0f);
    glVertex3f(-halfW, height, 0.0f);
    glEnd();

    // Health Fill (Green to Red)
    float fillW = -halfW + (width * hpRatio);
    if (hpRatio > 0.5f) glColor3f(0.2f, 0.9f, 0.3f);
    else if (hpRatio > 0.25f) glColor3f(0.9f, 0.8f, 0.1f);
    else glColor3f(0.9f, 0.2f, 0.2f);

    glBegin(GL_QUADS);
    glVertex3f(-halfW, 0.02f, 0.01f);
    glVertex3f( fillW, 0.02f, 0.01f);
    glVertex3f( fillW, height - 0.02f, 0.01f);
    glVertex3f(-halfW, height - 0.02f, 0.01f);
    glEnd();
#endif
}

// Draw Detailed Procedural Tree
void DrawProceduralTree(float x, float z, float scale = 1.0f) {
#if defined(_WIN32)
    glPushMatrix();
    glTranslatef(x, 0.0f, z);
    glScalef(scale, scale, scale);

    // Trunk
    glColor3f(0.35f, 0.22f, 0.12f);
    DrawCylinder(0.4f, 0.25f, 2.5f, 8);

    // Canopy Tier 1
    glPushMatrix();
    glTranslatef(0.0f, 1.8f, 0.0f);
    glColor3f(0.12f, 0.45f, 0.18f);
    DrawCone(1.6f, 2.0f, 10);
    glPopMatrix();

    // Canopy Tier 2
    glPushMatrix();
    glTranslatef(0.0f, 2.8f, 0.0f);
    glColor3f(0.18f, 0.55f, 0.22f);
    DrawCone(1.2f, 1.8f, 10);
    glPopMatrix();

    glPopMatrix();
#endif
}

// Draw Detailed MOBA Tower Spire
void DrawMobaTower(float x, float z, Team team, float hpRatio) {
#if defined(_WIN32)
    glPushMatrix();
    glTranslatef(x, 0.0f, z);

    // Tower Base
    glColor3f(0.25f, 0.28f, 0.32f);
    DrawCylinder(1.2f, 0.9f, 1.5f, 12);

    // Mid Pillar
    glPushMatrix();
    glTranslatef(0.0f, 1.5f, 0.0f);
    glColor3f(0.35f, 0.38f, 0.42f);
    DrawCylinder(0.9f, 0.6f, 2.2f, 10);
    glPopMatrix();

    // Top Floating Crystal
    glPushMatrix();
    glTranslatef(0.0f, 4.2f, 0.0f);
    if (team == Team::RED) glColor3f(1.0f, 0.2f, 0.2f);
    else                   glColor3f(0.2f, 0.5f, 1.0f);
    DrawCube(0.9f);
    glPopMatrix();

    // Health Bar
    glPushMatrix();
    glTranslatef(0.0f, 5.2f, 0.0f);
    DrawHealthBar(hpRatio, 2.0f, 0.3f);
    glPopMatrix();

    glPopMatrix();
#endif
}

int main(int argc, char* argv[]) {
    (void)argc; (void)argv;
    std::cout << "===========================================================\n";
    std::cout << "  Killer App C++ MOBA Engine: Forest of Hollow Blood View  \n";
    std::cout << "===========================================================\n";

    EngineCore::EngineConfig config;
    config.width = 1280;
    config.height = 720;
    config.enableDepthTest = true;

    EngineCore::Engine engine;
    if (!engine.Init(config)) {
        std::cerr << "Failed to initialize Killer App C++ Engine!" << std::endl;
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
    wc.lpszClassName = "MobaHighResWindowClass";

    if (!RegisterClassExA(&wc)) return 1;

    RECT wr = { 0, 0, (LONG)config.width, (LONG)config.height };
    AdjustWindowRect(&wr, WS_OVERLAPPEDWINDOW, FALSE);

    HWND hwnd = CreateWindowExA(
        0, wc.lpszClassName, "MOBA: Forest of Hollow Blood - Native C++ 3D Engine",
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

    std::cout << "[Native C++ MOBA Viewport] High-fidelity 3D map, trees, towers & units rendering!\n";

    // Setup Waypoints for 3 Classic Dota Lanes
    std::vector<Vec3> redMid = { Vec3(-14, 0, -14), Vec3(-7, 0, -7), Vec3(0, 0, 0), Vec3(7, 0, 7), Vec3(14, 0, 14) };
    std::vector<Vec3> blackMid = { Vec3(14, 0, 14), Vec3(7, 0, 7), Vec3(0, 0, 0), Vec3(-7, 0, -7), Vec3(-14, 0, -14) };

    std::vector<MobaUnit> units;
    // Spawn Creeps
    for (int i = 0; i < 4; ++i) {
        MobaUnit r;
        r.name = "Radiant_Melee_Creep";
        r.pos = Vec3(-14.0f + i * 1.0f, 0.0f, -14.0f);
        r.team = Team::RED;
        r.hp = 300.0f; r.maxHp = 300.0f;
        r.speed = 3.6f;
        r.waypointIndex = 0;
        r.waypoints = redMid;
        units.push_back(r);

        MobaUnit b;
        b.name = "Dire_Melee_Creep";
        b.pos = Vec3(14.0f - i * 1.0f, 0.0f, 14.0f);
        b.team = Team::BLACK;
        b.hp = 300.0f; b.maxHp = 300.0f;
        b.speed = 3.6f;
        b.waypointIndex = 0;
        b.waypoints = blackMid;
        units.push_back(b);
    }

    // Hero Unit (Dragon Knight / Juggernaut)
    MobaUnit playerHero;
    playerHero.name = "Dragon_Knight_Hero";
    playerHero.pos = Vec3(-10.0f, 0.0f, -10.0f);
    playerHero.team = Team::RED;
    playerHero.hp = 850.0f; playerHero.maxHp = 850.0f;
    playerHero.speed = 4.2f;

    // Jungle Trees Positions
    std::vector<Vec3> treesList = {
        Vec3(-10, 0, -2), Vec3(-12, 0, 2), Vec3(-8, 0, 5), Vec3(-4, 0, 8),
        Vec3(2, 0, -10), Vec3(5, 0, -12), Vec3(8, 0, -6), Vec3(10, 0, -2),
        Vec3(-6, 0, -10), Vec3(2, 0, 10), Vec3(6, 0, 12), Vec3(10, 0, 4)
    };

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

        // Hero Movement
        playerHero.pos.x = -10.0f + std::sin(time * 0.8f) * 6.0f;
        playerHero.pos.z = -10.0f + std::cos(time * 0.8f) * 6.0f;

        // Clear Color (Dark Jungle Environment)
        glClearColor(0.08f, 0.12f, 0.15f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

        // 1. Perspective Matrix
        glMatrixMode(GL_PROJECTION);
        glLoadIdentity();
        float aspect = (float)config.width / (float)(config.height > 0 ? config.height : 1);
        SetPerspective(48.0f, aspect, 0.5f, 200.0f);

        // 2. Camera View Matrix (Top-Down MOBA Perspective)
        glMatrixMode(GL_MODELVIEW);
        glLoadIdentity();
        glTranslatef(0.0f, -8.0f, -38.0f);
        glRotatef(52.0f, 1.0f, 0.0f, 0.0f);
        glRotatef(time * 6.0f, 0.0f, 1.0f, 0.0f); // Map rotation

        // 3. Ground Terrain
        glBegin(GL_QUADS);
        glColor3f(0.14f, 0.32f, 0.16f);
        glVertex3f(-25.0f, 0.0f, -25.0f);
        glVertex3f( 25.0f, 0.0f, -25.0f);
        glVertex3f( 25.0f, 0.0f,  25.0f);
        glVertex3f(-25.0f, 0.0f,  25.0f);
        glEnd();

        // 4. River Water Channel
        glBegin(GL_QUADS);
        glColor3f(0.12f, 0.48f, 0.78f);
        glVertex3f(-25.0f, 0.02f,  18.0f);
        glVertex3f(-18.0f, 0.02f,  25.0f);
        glVertex3f( 25.0f, 0.02f, -18.0f);
        glVertex3f( 18.0f, 0.02f, -25.0f);
        glEnd();

        // 5. Dirt Lane Paths
        glLineWidth(8.0f);
        glBegin(GL_LINES);
        glColor3f(0.55f, 0.42f, 0.25f);
        // Mid Lane
        glVertex3f(-14.0f, 0.05f, -14.0f); glVertex3f(14.0f, 0.05f, 14.0f);
        // Top Lane
        glVertex3f(-14.0f, 0.05f, -14.0f); glVertex3f(-14.0f, 0.05f, 14.0f);
        glVertex3f(-14.0f, 0.05f, 14.0f);  glVertex3f(14.0f, 0.05f, 14.0f);
        // Bot Lane
        glVertex3f(-14.0f, 0.05f, -14.0f); glVertex3f(14.0f, 0.05f, -14.0f);
        glVertex3f(14.0f, 0.05f, -14.0f);  glVertex3f(14.0f, 0.05f, 14.0f);
        glEnd();

        // 6. Jungle Trees
        for (const auto& treePos : treesList) {
            DrawProceduralTree(treePos.x, treePos.z, 1.0f);
        }

        // 7. MOBA Towers
        DrawMobaTower(-10.0f, -10.0f, Team::RED, 1.0f);
        DrawMobaTower(-5.0f, -5.0f, Team::RED, 0.75f);
        DrawMobaTower(10.0f, 10.0f, Team::BLACK, 1.0f);
        DrawMobaTower(5.0f, 5.0f, Team::BLACK, 0.60f);

        // 8. Ancient Bases
        // Radiant Base
        glPushMatrix();
        glTranslatef(-14.0f, 0.0f, -14.0f);
        glColor3f(0.9f, 0.15f, 0.15f);
        DrawCylinder(2.2f, 0.2f, 3.5f, 8);
        glPopMatrix();

        // Dire Base
        glPushMatrix();
        glTranslatef(14.0f, 0.0f, 14.0f);
        glColor3f(0.15f, 0.35f, 0.95f);
        DrawCylinder(2.2f, 0.2f, 3.5f, 8);
        glPopMatrix();

        // 9. Moving Creeps with Health Bars
        for (const auto& u : units) {
            glPushMatrix();
            glTranslatef(u.pos.x, u.pos.y, u.pos.z);

            // Creep Body
            glPushMatrix();
            glTranslatef(0.0f, 0.5f, 0.0f);
            if (u.team == Team::RED) glColor3f(0.95f, 0.75f, 0.15f);
            else                     glColor3f(0.15f, 0.85f, 0.95f);
            DrawCube(0.8f);
            glPopMatrix();

            // Health Bar Above Head
            glPushMatrix();
            glTranslatef(0.0f, 1.4f, 0.0f);
            DrawHealthBar(u.hp / u.maxHp, 1.0f, 0.18f);
            glPopMatrix();

            glPopMatrix();
        }

        // 10. Hero Unit (Dragon Knight) with Gold/HP Bar
        glPushMatrix();
        glTranslatef(playerHero.pos.x, playerHero.pos.y, playerHero.pos.z);

        // Hero Mesh (Body + Armor Top)
        glPushMatrix();
        glTranslatef(0.0f, 0.8f, 0.0f);
        glColor3f(1.0f, 0.55f, 0.0f); // Gold Hero Armor
        DrawCylinder(0.6f, 0.4f, 1.6f, 10);
        glPopMatrix();

        // Hero Health Bar
        glPushMatrix();
        glTranslatef(0.0f, 2.8f, 0.0f);
        DrawHealthBar(playerHero.hp / playerHero.maxHp, 1.8f, 0.25f);
        glPopMatrix();

        glPopMatrix();

        SwapBuffers(hdc);
        std::this_thread::sleep_for(std::chrono::milliseconds(16));
    }

    wglMakeCurrent(NULL, NULL);
    wglDeleteContext(hglrc);
    ReleaseDC(hwnd, hdc);
    DestroyWindow(hwnd);
    std::cout << "[Native C++ MOBA Viewport] Window closed.\n";
#endif

    return 0;
}
