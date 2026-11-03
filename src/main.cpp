#include "engine/Engine.hpp"
#include "engine/Collision.hpp"
#include "engine/DamageSystem.hpp"
#include "engine/PlayerController.hpp"
#include "engine/Camera.hpp"
#include <iostream>
#include <chrono>
#include <thread>
#include <vector>
#include <cmath>
#include <string>
#include <memory>
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

// Game State Machine
enum class GameState {
    MainMenu,
    HeroSelect,
    ItemShop,
    Playing,
    Paused
};

static GameState g_gameState = GameState::MainMenu;
static int g_selectedHeroIndex = 0;
static int g_playerGold = 600;
static int g_playerKills = 0;
static float g_cameraX = 0.0f;
static float g_cameraZ = -38.0f;
static float g_cameraYaw = 0.0f;

struct HeroClass {
    std::string name;
    std::string role;
    float hp;
    float attackDamage;
    float moveSpeed;
    std::string ability;
};

static std::vector<HeroClass> g_heroes = {
    { "Dragon Knight", "Strength / Tank", 850.0f, 62.0f, 4.2f, "Breathe Fire" },
    { "Juggernaut", "Agility / Carry", 650.0f, 75.0f, 4.8f, "Blade Fury" },
    { "Crystal Maiden", "Intelligence / Support", 520.0f, 48.0f, 3.8f, "Freezing Field" },
    { "Sniper", "Agility / Ranged", 580.0f, 82.0f, 4.0f, "Assassinate" }
};

struct ShopItem {
    std::string name;
    int cost;
    std::string effect;
};

static std::vector<ShopItem> g_shopItems = {
    { "Small Health Vial", 100, "+150 HP Restore" },
    { "Yellow Combat Armor", 250, "+75 Armor Defense" },
    { "Quad Damage Rune", 500, "4x Damage Multiplier" },
    { "Blink Dagger", 400, "Instant Teleportation" }
};

// OpenGL Perspective Projection
void SetPerspective(float fovY, float aspect, float zNear, float zFar) {
#if defined(_WIN32)
    float fH = tanf(fovY / 360.0f * 3.14159265f) * zNear;
    float fW = fH * aspect;
    glFrustum(-fW, fW, -fH, fH, zNear, zFar);
#endif
}

// 3D Geometry Helpers
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

void DrawTree(float x, float z, float scale = 1.0f) {
#if defined(_WIN32)
    glPushMatrix();
    glTranslatef(x, 0.0f, z);
    glScalef(scale, scale, scale);

    glColor3f(0.35f, 0.22f, 0.12f);
    DrawCylinder(0.4f, 0.25f, 2.5f, 8);

    glPushMatrix();
    glTranslatef(0.0f, 1.8f, 0.0f);
    glColor3f(0.12f, 0.48f, 0.18f);
    DrawCone(1.6f, 2.2f, 10);
    glPopMatrix();

    glPushMatrix();
    glTranslatef(0.0f, 2.9f, 0.0f);
    glColor3f(0.18f, 0.58f, 0.24f);
    DrawCone(1.2f, 1.8f, 10);
    glPopMatrix();

    glPopMatrix();
#endif
}

struct MobaCreepUnit {
    uint32_t id;
    std::string name;
    Vec3 pos;
    std::string team;
    size_t waypointIndex = 0;
    std::vector<Vec3> waypoints;
    float attackCooldown = 0.0f;
    std::shared_ptr<DamageableActor> damageable;

    void update(float dt, DamageSystem& damageSys, std::vector<MobaCreepUnit>& allCreeps) {
        if (!damageable || !damageable->IsAlive()) return;

        if (waypointIndex < waypoints.size()) {
            const Vec3& target = waypoints[waypointIndex];
            float d = (pos - target).Length();
            if (d < 0.8f) {
                waypointIndex++;
            } else {
                float dx = target.x - pos.x;
                float dz = target.z - pos.z;
                float len = std::hypot(dx, dz);
                if (len > 0.001f) {
                    pos.x += (dx / len) * 3.6f * dt;
                    pos.z += (dz / len) * 3.6f * dt;
                    damageable->position = pos;
                }
            }
        } else {
            waypointIndex = 0;
            pos = waypoints[0];
            damageable->position = pos;
        }

        attackCooldown -= dt;
        if (attackCooldown <= 0.0f) {
            for (auto& other : allCreeps) {
                if (other.id != id && other.damageable && other.damageable->IsAlive() && other.team != team) {
                    if ((pos - other.pos).Length() <= 2.2f) {
                        damageSys.ApplyDamage(other.id, 25.0f, id, other.pos, Vec3(0, 1, 0));
                        attackCooldown = 1.2f;
                        break;
                    }
                }
            }
        }
    }
};

int main(int argc, char* argv[]) {
    (void)argc; (void)argv;
    std::cout << "=================================================================\n";
    std::cout << "  MOBA: Forest of Hollow Blood - Native C++ Game Application      \n";
    std::cout << "=================================================================\n";
    std::cout << "Controls:\n";
    std::cout << "  [1] Start Match   [2] Hero Select   [3] Item Shop   [M] Menu\n";
    std::cout << "  [WASD / Arrow Keys] Move Camera View   [SPACE] Reset Camera\n";
    std::cout << "=================================================================\n";

    EngineConfig config;
    config.width = 1280;
    config.height = 720;

    Engine engine;
    if (!engine.Init(config)) {
        std::cerr << "Failed to initialize C++ Engine Core!" << std::endl;
        return 1;
    }

    CollisionWorld collisionWorld;
    DamageSystem damageSystem;
    PlayerController playerHeroController;

    collisionWorld.AddAABB("Terrain_Floor", Vec3(0, -0.5f, 0), Vec3(30.0f, 0.5f, 30.0f), Layer_Ground);
    collisionWorld.AddAABB("Radiant_Ancient", Vec3(-14.0f, 1.5f, -14.0f), Vec3(2.5f, 1.5f, 2.5f), Layer_Obstacle);
    collisionWorld.AddAABB("Dire_Ancient", Vec3(14.0f, 1.5f, 14.0f), Vec3(2.5f, 1.5f, 2.5f), Layer_Obstacle);

    damageSystem.AddOnDamageListener([](const DamageEvent& evt) {
        std::cout << "[Combat Event] " << evt.targetName << " took " << evt.damageAmount 
                  << " damage! Remaining HP: " << evt.remainingHealth << "/" << evt.maxHealth << "\n";
    });

    damageSystem.AddOnDestroyedListener([](const DamageEvent& evt) {
        g_playerKills++;
        g_playerGold += 45;
        std::cout << "[Kill Ticker] " << evt.targetName << " DESTROYED! +45 Gold Awarded! Total Gold: " 
                  << g_playerGold << " | Kills: " << g_playerKills << "\n";
    });

    auto radiantTower1 = std::make_shared<DamageableActor>(101, "Radiant_Mid_Tower_1", "Towers", 800.0f, Vec3(-10, 0, -10));
    auto radiantTower2 = std::make_shared<DamageableActor>(102, "Radiant_Mid_Tower_2", "Towers", 800.0f, Vec3(-5, 0, -5));
    auto direTower1    = std::make_shared<DamageableActor>(201, "Dire_Mid_Tower_1", "Towers", 800.0f, Vec3(10, 0, 10));
    auto direTower2    = std::make_shared<DamageableActor>(202, "Dire_Mid_Tower_2", "Towers", 800.0f, Vec3(5, 0, 5));

    damageSystem.RegisterActor(radiantTower1);
    damageSystem.RegisterActor(radiantTower2);
    damageSystem.RegisterActor(direTower1);
    damageSystem.RegisterActor(direTower2);

    std::vector<Vec3> redMidWaypoints = { Vec3(-14, 0, -14), Vec3(-7, 0, -7), Vec3(0, 0, 0), Vec3(7, 0, 7), Vec3(14, 0, 14) };
    std::vector<Vec3> blackMidWaypoints = { Vec3(14, 0, 14), Vec3(7, 0, 7), Vec3(0, 0, 0), Vec3(-7, 0, -7), Vec3(-14, 0, -14) };

    std::vector<MobaCreepUnit> creeps;
    uint32_t creepIdCounter = 1;

    for (int i = 0; i < 4; ++i) {
        MobaCreepUnit r;
        r.id = creepIdCounter++;
        r.name = "Radiant_Creep_" + std::to_string(i + 1);
        r.pos = Vec3(-14.0f + i * 1.0f, 0.0f, -14.0f);
        r.team = "Radiant";
        r.waypoints = redMidWaypoints;
        r.damageable = std::make_shared<DamageableActor>(r.id, r.name, "Creeps", 320.0f, r.pos);
        damageSystem.RegisterActor(r.damageable);
        creeps.push_back(r);

        MobaCreepUnit b;
        b.id = creepIdCounter++;
        b.name = "Dire_Creep_" + std::to_string(i + 1);
        b.pos = Vec3(14.0f - i * 1.0f, 0.0f, 14.0f);
        b.team = "Dire";
        b.waypoints = blackMidWaypoints;
        b.damageable = std::make_shared<DamageableActor>(b.id, b.name, "Creeps", 320.0f, b.pos);
        damageSystem.RegisterActor(b.damageable);
        creeps.push_back(b);
    }

    playerHeroController.position = Vec3(-8.0f, 0.0f, -8.0f);
    playerHeroController.walkSpeed = 5.0f;

    std::vector<Vec3> jungleTrees = {
        Vec3(-10, 0, -2), Vec3(-12, 0, 2), Vec3(-8, 0, 5), Vec3(-4, 0, 8),
        Vec3(2, 0, -10), Vec3(5, 0, -12), Vec3(8, 0, -6), Vec3(10, 0, -2)
    };

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
        0, wc.lpszClassName, "MOBA: Forest of Hollow Blood - Native C++ Game",
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

    std::cout << "\n======================================================\n";
    std::cout << "  MAIN MENU ACTIVE\n";
    std::cout << "  Press [1] to START MATCH\n";
    std::cout << "  Press [2] for HERO SELECTION\n";
    std::cout << "  Press [3] for ITEM SHOP\n";
    std::cout << "======================================================\n";

    MSG msg = {};
    bool running = true;
    float time = 0.0f;

    while (running) {
        while (PeekMessage(&msg, NULL, 0, 0, PM_REMOVE)) {
            if (msg.message == WM_QUIT) running = false;
            
            if (msg.message == WM_KEYDOWN) {
                WPARAM vk = msg.wParam;
                if (vk == '1') {
                    g_gameState = GameState::Playing;
                    std::cout << "\n>>> [MATCH STARTED] Entering Forest of Hollow Blood battlefield! Selected Hero: " 
                              << g_heroes[g_selectedHeroIndex].name << "\n";
                } else if (vk == '2') {
                    g_gameState = GameState::HeroSelect;
                    g_selectedHeroIndex = (g_selectedHeroIndex + 1) % g_heroes.size();
                    std::cout << "\n>>> [HERO SELECT] Selected Hero: " << g_heroes[g_selectedHeroIndex].name 
                              << " (" << g_heroes[g_selectedHeroIndex].role << ") | Ability: " 
                              << g_heroes[g_selectedHeroIndex].ability << "\n";
                } else if (vk == '3') {
                    g_gameState = GameState::ItemShop;
                    std::cout << "\n>>> [ITEM SHOP] Current Gold: " << g_playerGold << " Gold\n";
                    for (size_t i = 0; i < g_shopItems.size(); ++i) {
                        std::cout << "    [" << (i + 1) << "] " << g_shopItems[i].name << " - " 
                                  << g_shopItems[i].cost << " Gold (" << g_shopItems[i].effect << ")\n";
                    }
                } else if (vk == 'M' || vk == 'm') {
                    g_gameState = GameState::MainMenu;
                    std::cout << "\n>>> [MAIN MENU] Returned to Main Menu. Press [1] to Play.\n";
                } else if (vk == 'W' || vk == 'w' || vk == VK_UP) {
                    g_cameraZ += 1.2f;
                } else if (vk == 'S' || vk == 's' || vk == VK_DOWN) {
                    g_cameraZ -= 1.2f;
                } else if (vk == 'A' || vk == 'a' || vk == VK_LEFT) {
                    g_cameraX -= 1.2f;
                } else if (vk == 'D' || vk == 'd' || vk == VK_RIGHT) {
                    g_cameraX += 1.2f;
                } else if (vk == VK_SPACE) {
                    g_cameraX = 0.0f;
                    g_cameraZ = -38.0f;
                    std::cout << ">>> Camera reset to center.\n";
                }
            }

            TranslateMessage(&msg);
            DispatchMessage(&msg);
        }

        if (!running) break;

        float dt = 0.016f;
        time += dt;

        if (g_gameState == GameState::Playing) {
            engine.Update(dt);
            damageSystem.Update(dt);

            for (auto& creep : creeps) {
                creep.update(dt, damageSystem, creeps);
            }

            playerHeroController.position = Vec3(
                -8.0f + std::sin(time * 0.7f) * 5.0f,
                0.0f,
                -8.0f + std::cos(time * 0.7f) * 5.0f
            );
        }

        // Render Frame
        glClearColor(0.08f, 0.12f, 0.15f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

        glMatrixMode(GL_PROJECTION);
        glLoadIdentity();
        float aspect = (float)config.width / (float)(config.height > 0 ? config.height : 1);
        SetPerspective(48.0f, aspect, 0.5f, 200.0f);

        glMatrixMode(GL_MODELVIEW);
        glLoadIdentity();
        // Camera with WASD Panning
        glTranslatef(g_cameraX, -8.0f, g_cameraZ);
        glRotatef(52.0f, 1.0f, 0.0f, 0.0f);

        // Render Battlefield Terrain
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

        // Dirt Lanes
        glLineWidth(8.0f);
        glBegin(GL_LINES);
        glColor3f(0.55f, 0.42f, 0.25f);
        glVertex3f(-14.0f, 0.05f, -14.0f); glVertex3f(14.0f, 0.05f, 14.0f);
        glVertex3f(-14.0f, 0.05f, -14.0f); glVertex3f(-14.0f, 0.05f, 14.0f);
        glVertex3f(-14.0f, 0.05f, 14.0f);  glVertex3f(14.0f, 0.05f, 14.0f);
        glVertex3f(-14.0f, 0.05f, -14.0f); glVertex3f(14.0f, 0.05f, -14.0f);
        glVertex3f(14.0f, 0.05f, -14.0f);  glVertex3f(14.0f, 0.05f, 14.0f);
        glEnd();

        // Jungle Trees
        for (const auto& tp : jungleTrees) {
            DrawTree(tp.x, tp.z, 1.0f);
        }

        // Towers
        auto drawTowerActor = [](std::shared_ptr<DamageableActor> tower, bool isRadiant) {
            if (!tower) return;
            glPushMatrix();
            glTranslatef(tower->position.x, 0.0f, tower->position.z);

            glColor3f(0.3f, 0.3f, 0.35f);
            DrawCylinder(1.2f, 0.8f, 2.5f, 10);

            glPushMatrix();
            glTranslatef(0.0f, 2.5f, 0.0f);
            if (isRadiant) glColor3f(0.9f, 0.2f, 0.2f);
            else           glColor3f(0.2f, 0.5f, 0.9f);
            DrawCube(0.9f);
            glPopMatrix();

            glPushMatrix();
            glTranslatef(0.0f, 3.8f, 0.0f);
            DrawHealthBar(tower->health / tower->maxHealth, 1.8f, 0.25f);
            glPopMatrix();

            glPopMatrix();
        };

        drawTowerActor(radiantTower1, true);
        drawTowerActor(radiantTower2, true);
        drawTowerActor(direTower1, false);
        drawTowerActor(direTower2, false);

        // Ancients
        glPushMatrix();
        glTranslatef(-14.0f, 0.0f, -14.0f);
        glColor3f(0.9f, 0.15f, 0.15f);
        DrawCylinder(2.2f, 0.2f, 3.5f, 8);
        glPopMatrix();

        glPushMatrix();
        glTranslatef(14.0f, 0.0f, 14.0f);
        glColor3f(0.15f, 0.35f, 0.95f);
        DrawCylinder(2.2f, 0.2f, 3.5f, 8);
        glPopMatrix();

        // Creeps
        for (const auto& creep : creeps) {
            if (!creep.damageable || !creep.damageable->IsAlive()) continue;

            glPushMatrix();
            glTranslatef(creep.pos.x, creep.pos.y, creep.pos.z);

            glPushMatrix();
            glTranslatef(0.0f, 0.5f, 0.0f);
            if (creep.team == "Radiant") glColor3f(0.95f, 0.8f, 0.1f);
            else                         glColor3f(0.1f, 0.85f, 0.95f);
            DrawCube(0.8f);
            glPopMatrix();

            glPushMatrix();
            glTranslatef(0.0f, 1.4f, 0.0f);
            DrawHealthBar(creep.damageable->health / creep.damageable->maxHealth, 1.0f, 0.18f);
            glPopMatrix();

            glPopMatrix();
        }

        // Player Hero
        Vec3 heroPos = playerHeroController.position;
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
