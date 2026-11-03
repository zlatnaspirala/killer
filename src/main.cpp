#include "engine/Engine.hpp"
#include "engine/MobaEngine.hpp"
#include <iostream>
#include <chrono>
#include <thread>
#include <cmath>
#include <vector>
#include <string>
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

enum class GameState {
    MainMenu,
    HeroSelect,
    Playing,
    InGameMenu
};

static GameState g_gameState = GameState::MainMenu;
static int g_selectedHeroIndex = 0;
static bool g_showShopOverlay = false;
static float g_matchTimer = 0.0f;
static std::string g_notificationText = "WELCOME TO FOREST OF HOLLOW BLOOD - C++ NATIVE MOBA";
static float g_notificationTimer = 5.0f;

// Tron Bases
static float g_redTronHp = 2000.0f;
static float g_redTronMaxHp = 2000.0f;
static float g_blackTronHp = 2000.0f;
static float g_blackTronMaxHp = 2000.0f;

// Spell Cooldowns & Effects
static float g_spellQCooldown = 0.0f;
static float g_spellWCooldown = 0.0f;
static float g_spellECooldown = 0.0f;
static float g_spellRCooldown = 0.0f;
static float g_starfallFxTimer = 0.0f;
static Vec3 g_starfallPos(0, 0, 0);
static float g_eclipseFxTimer = 0.0f;
static Vec3 g_eclipsePos(0, 0, 0);
static float g_barrierTimer = 0.0f;

#if defined(_WIN32)
static GLuint g_fontSmall = 0;
static GLuint g_fontLarge = 0;

void InitFonts(HDC hdc) {
    g_fontSmall = glGenLists(256);
    HFONT fontS = CreateFontA(-14, 0, 0, 0, FW_BOLD, FALSE, FALSE, FALSE, ANSI_CHARSET,
        OUT_TT_PRECIS, CLIP_DEFAULT_PRECIS, ANTIALIASED_QUALITY,
        FF_DONTCARE | DEFAULT_PITCH, "Segoe UI");
    SelectObject(hdc, fontS);
    wglUseFontBitmapsA(hdc, 0, 256, g_fontSmall);
    DeleteObject(fontS);

    g_fontLarge = glGenLists(256);
    HFONT fontL = CreateFontA(-26, 0, 0, 0, FW_EXTRABOLD, FALSE, FALSE, FALSE, ANSI_CHARSET,
        OUT_TT_PRECIS, CLIP_DEFAULT_PRECIS, ANTIALIASED_QUALITY,
        FF_DONTCARE | DEFAULT_PITCH, "Segoe UI");
    SelectObject(hdc, fontL);
    wglUseFontBitmapsA(hdc, 0, 256, g_fontLarge);
    DeleteObject(fontL);
}

void DrawText2D(GLuint fontBase, const std::string& text, float x, float y, float r, float g, float b) {
    glColor3f(r, g, b);
    glRasterPos2f(x, y);
    glListBase(fontBase);
    glCallLists((GLsizei)text.length(), GL_UNSIGNED_BYTE, text.c_str());
}

void DrawQuad2D(float x, float y, float w, float h, float r, float g, float b, float a = 1.0f) {
    glEnable(GL_BLEND);
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
    glColor4f(r, g, b, a);
    glBegin(GL_QUADS);
    glVertex2f(x, y);
    glVertex2f(x + w, y);
    glVertex2f(x + w, y + h);
    glVertex2f(x, y + h);
    glEnd();
    glDisable(GL_BLEND);
}

void DrawBorder2D(float x, float y, float w, float h, float r, float g, float b, float thickness = 2.0f) {
    glColor3f(r, g, b);
    glLineWidth(thickness);
    glBegin(GL_LINE_LOOP);
    glVertex2f(x, y);
    glVertex2f(x + w, y);
    glVertex2f(x + w, y + h);
    glVertex2f(x, y + h);
    glEnd();
}

void Begin2D(int width, int height) {
    glMatrixMode(GL_PROJECTION);
    glPushMatrix();
    glLoadIdentity();
    glOrtho(0, width, height, 0, -1, 1);
    glMatrixMode(GL_MODELVIEW);
    glPushMatrix();
    glLoadIdentity();
    glDisable(GL_DEPTH_TEST);
}

void End2D() {
    glEnable(GL_DEPTH_TEST);
    glMatrixMode(GL_PROJECTION);
    glPopMatrix();
    glMatrixMode(GL_MODELVIEW);
    glPopMatrix();
}

void SetPerspective(float fovY, float aspect, float zNear, float zFar) {
    float fH = tanf(fovY / 360.0f * 3.14159265f) * zNear;
    float fW = fH * aspect;
    glFrustum(-fW, fW, -fH, fH, zNear, zFar);
}

void DrawCube(float size) {
    float s = size * 0.5f;
    glBegin(GL_QUADS);
    glVertex3f(-s, -s,  s); glVertex3f( s, -s,  s); glVertex3f( s,  s,  s); glVertex3f(-s,  s,  s);
    glVertex3f(-s, -s, -s); glVertex3f(-s,  s, -s); glVertex3f( s,  s, -s); glVertex3f( s, -s, -s);
    glVertex3f(-s,  s, -s); glVertex3f(-s,  s,  s); glVertex3f( s,  s,  s); glVertex3f( s,  s, -s);
    glVertex3f(-s, -s, -s); glVertex3f( s, -s, -s); glVertex3f( s, -s,  s); glVertex3f(-s, -s,  s);
    glVertex3f( s, -s, -s); glVertex3f( s,  s, -s); glVertex3f( s,  s,  s); glVertex3f( s, -s,  s);
    glVertex3f(-s, -s, -s); glVertex3f(-s, -s,  s); glVertex3f(-s,  s,  s); glVertex3f(-s,  s, -s);
    glEnd();
}

void DrawCylinder(float baseR, float topR, float h, int slices) {
    glBegin(GL_QUAD_STRIP);
    for (int i = 0; i <= slices; ++i) {
        float a = i * 2.0f * 3.14159265f / slices;
        float c = std::cos(a), s = std::sin(a);
        glVertex3f(c * baseR, 0.0f, s * baseR);
        glVertex3f(c * topR, h, s * topR);
    }
    glEnd();
}

void DrawRing(float innerR, float outerR, int slices) {
    glBegin(GL_QUAD_STRIP);
    for (int i = 0; i <= slices; ++i) {
        float a = i * 2.0f * 3.14159265f / slices;
        float c = std::cos(a), s = std::sin(a);
        glVertex3f(c * innerR, 0.1f, s * innerR);
        glVertex3f(c * outerR, 0.1f, s * outerR);
    }
    glEnd();
}

void DrawHealthBar3D(float hpRatio, float width = 1.4f, float height = 0.22f) {
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
}
#endif

int main(int argc, char* argv[]) {
    (void)argc; (void)argv;
    std::cout << "=================================================================\n";
    std::cout << "  MOBA: Forest of Hollow Blood - Official Native C++ Engine       \n";
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
        0, wc.lpszClassName, "MOBA: Forest of Hollow Blood - Official Native C++ Game Engine",
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

    InitFonts(hdc);

    MSG msg = {};
    bool running = true;
    float time = 0.0f;

    while (running) {
        while (PeekMessage(&msg, NULL, 0, 0, PM_REMOVE)) {
            if (msg.message == WM_QUIT) running = false;

            if (msg.message == WM_KEYDOWN) {
                WPARAM vk = msg.wParam;

                if (g_gameState == GameState::MainMenu) {
                    if (vk == '1' || vk == VK_RETURN || vk == VK_SPACE) {
                        g_gameState = GameState::HeroSelect;
                    } else if (vk == '2') {
                        mobaEngine.SelectHeroByIndex(0);
                        g_gameState = GameState::Playing;
                        g_notificationText = "MATCH STARTED! DEFEND YOUR RADIANT ANCIENT TRON!";
                        g_notificationTimer = 4.0f;
                    }
                }
                else if (g_gameState == GameState::HeroSelect) {
                    if (vk == VK_LEFT || vk == 'A' || vk == 'a') {
                        g_selectedHeroIndex = (g_selectedHeroIndex + 5) % 6;
                    } else if (vk == VK_RIGHT || vk == 'D' || vk == 'd') {
                        g_selectedHeroIndex = (g_selectedHeroIndex + 1) % 6;
                    } else if (vk >= '1' && vk <= '6') {
                        g_selectedHeroIndex = (int)(vk - '1');
                    } else if (vk == VK_RETURN || vk == VK_SPACE) {
                        mobaEngine.SelectHeroByIndex(g_selectedHeroIndex);
                        g_gameState = GameState::Playing;
                        g_notificationText = "CHAMPION LOCKED: " + mobaEngine.GetPlayerHero().name + "! FIGHT!";
                        g_notificationTimer = 4.0f;
                    } else if (vk == VK_ESCAPE) {
                        g_gameState = GameState::MainMenu;
                    }
                }
                else if (g_gameState == GameState::Playing) {
                    if (vk == 'M' || vk == 'm' || vk == VK_ESCAPE) {
                        g_gameState = GameState::InGameMenu;
                    }
                    else if (vk == 'B' || vk == 'b') {
                        g_showShopOverlay = !g_showShopOverlay;
                        g_notificationText = g_showShopOverlay ? "BASE SHOP OPENED [1-4 to BUY]" : "BASE SHOP CLOSED";
                        g_notificationTimer = 2.0f;
                    }
                    else if (g_showShopOverlay) {
                        if (vk == '1') mobaEngine.BuyItem("health_vial");
                        else if (vk == '2') mobaEngine.BuyItem("yellow_armor");
                        else if (vk == '3') mobaEngine.BuyItem("quad_damage");
                        else if (vk == '4') mobaEngine.BuyItem("blink_dagger");
                    }
                    else {
                        // Spells
                        Vec3 heroPos = mobaEngine.playerController.position;
                        MobaHeroData hero = mobaEngine.GetPlayerHero();

                        if ((vk == '1' || vk == 'Q' || vk == 'q') && g_spellQCooldown <= 0.0f) {
                            g_spellQCooldown = 3.5f;
                            g_starfallFxTimer = 1.2f;
                            g_starfallPos = heroPos;
                            g_notificationText = hero.name + " CAST SPELL [Q]: STARFALL (-145 HP AREA DAMAGE)";
                            g_notificationTimer = 2.5f;
                        }
                        else if ((vk == '2' || vk == 'W' || vk == 'w') && g_spellWCooldown <= 0.0f) {
                            g_spellWCooldown = 6.0f;
                            mobaEngine.playerController.position.x += 6.0f;
                            g_notificationText = hero.name + " CAST SPELL [W]: BLINK DASH!";
                            g_notificationTimer = 2.5f;
                        }
                        else if ((vk == '3' || vk == 'E' || vk == 'e') && g_spellECooldown <= 0.0f) {
                            g_spellECooldown = 8.0f;
                            g_barrierTimer = 4.0f;
                            g_notificationText = hero.name + " CAST SPELL [E]: BARRIER SHIELD (+150 ABSORB)";
                            g_notificationTimer = 2.5f;
                        }
                        else if ((vk == '4' || vk == 'R' || vk == 'r') && g_spellRCooldown <= 0.0f) {
                            g_spellRCooldown = 18.0f;
                            g_eclipseFxTimer = 2.0f;
                            g_eclipsePos = heroPos;
                            g_notificationText = hero.name + " UNLEASHED ULTIMATE [R]: HOLLOW ECLIPSE!";
                            g_notificationTimer = 3.0f;
                        }
                        // Camera / Hero Movement
                        else if (vk == 'W' || vk == 'w' || vk == VK_UP) mobaEngine.playerController.position.z += 1.2f;
                        else if (vk == 'S' || vk == 's' || vk == VK_DOWN) mobaEngine.playerController.position.z -= 1.2f;
                        else if (vk == 'A' || vk == 'a' || vk == VK_LEFT) mobaEngine.playerController.position.x -= 1.2f;
                        else if (vk == 'D' || vk == 'd' || vk == VK_RIGHT) mobaEngine.playerController.position.x += 1.2f;
                    }
                }
                else if (g_gameState == GameState::InGameMenu) {
                    if (vk == '1' || vk == VK_ESCAPE) g_gameState = GameState::Playing;
                    else if (vk == '2') g_gameState = GameState::HeroSelect;
                    else if (vk == '3') {
                        mobaEngine.Init();
                        g_gameState = GameState::Playing;
                        g_matchTimer = 0.0f;
                        g_notificationText = "MATCH RESTARTED!";
                        g_notificationTimer = 3.0f;
                    }
                    else if (vk == '4') g_gameState = GameState::MainMenu;
                }
            }

            TranslateMessage(&msg);
            DispatchMessage(&msg);
        }

        if (!running) break;

        float dt = 0.016f;
        time += dt;

        if (g_gameState == GameState::Playing) {
            g_matchTimer += dt;
            engine.Update(dt);
            mobaEngine.Update(dt);

            if (g_spellQCooldown > 0.0f) g_spellQCooldown -= dt;
            if (g_spellWCooldown > 0.0f) g_spellWCooldown -= dt;
            if (g_spellECooldown > 0.0f) g_spellECooldown -= dt;
            if (g_spellRCooldown > 0.0f) g_spellRCooldown -= dt;
            if (g_starfallFxTimer > 0.0f) g_starfallFxTimer -= dt;
            if (g_eclipseFxTimer > 0.0f) g_eclipseFxTimer -= dt;
            if (g_barrierTimer > 0.0f) g_barrierTimer -= dt;
        }

        if (g_notificationTimer > 0.0f) g_notificationTimer -= dt;

        // Render Frame
        glClearColor(0.05f, 0.08f, 0.12f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

        float aspect = (float)config.width / (float)(config.height > 0 ? config.height : 1);

        // ==========================================
        // 3D SCENE RENDERING
        // ==========================================
        glMatrixMode(GL_PROJECTION);
        glLoadIdentity();
        SetPerspective(48.0f, aspect, 0.5f, 200.0f);

        glMatrixMode(GL_MODELVIEW);
        glLoadIdentity();

        if (g_gameState == GameState::MainMenu) {
            float rotCamX = std::sin(time * 0.3f) * 22.0f;
            float rotCamZ = std::cos(time * 0.3f) * 22.0f;
            glTranslatef(rotCamX, -12.0f, -35.0f + rotCamZ);
            glRotatef(40.0f, 1.0f, 0.0f, 0.0f);
            glRotatef(time * 8.0f, 0.0f, 1.0f, 0.0f);
        } else if (g_gameState == GameState::HeroSelect) {
            glTranslatef(0.0f, -3.5f, -14.0f);
            glRotatef(18.0f, 1.0f, 0.0f, 0.0f);
        } else {
            Vec3 heroP = mobaEngine.playerController.position;
            glTranslatef(-heroP.x, -10.0f, -32.0f - heroP.z);
            glRotatef(52.0f, 1.0f, 0.0f, 0.0f);
        }

        // Draw Terrain Grass Ground
        glBegin(GL_QUADS);
        glColor3f(0.12f, 0.28f, 0.15f);
        glVertex3f(-30.0f, 0.0f, -30.0f);
        glVertex3f( 30.0f, 0.0f, -30.0f);
        glVertex3f( 30.0f, 0.0f,  30.0f);
        glVertex3f(-30.0f, 0.0f,  30.0f);
        glEnd();

        // River Channel
        glBegin(GL_QUADS);
        glColor3f(0.10f, 0.45f, 0.75f);
        glVertex3f(-30.0f, 0.02f,  20.0f);
        glVertex3f(-20.0f, 0.02f,  30.0f);
        glVertex3f( 30.0f, 0.02f, -20.0f);
        glVertex3f( 20.0f, 0.02f, -30.0f);
        glEnd();

        // Lanes (Top, Mid, Bot Dirt Paths)
        glLineWidth(9.0f);
        glBegin(GL_LINES);
        glColor3f(0.50f, 0.38f, 0.22f);
        glVertex3f(-18.0f, 0.05f, -18.0f); glVertex3f(18.0f, 0.05f, 18.0f); // Mid
        glVertex3f(-18.0f, 0.05f, -18.0f); glVertex3f(-18.0f, 0.05f, 18.0f); // Top Left
        glVertex3f(-18.0f, 0.05f, 18.0f);  glVertex3f(18.0f, 0.05f, 18.0f);  // Top Right
        glVertex3f(-18.0f, 0.05f, -18.0f); glVertex3f(18.0f, 0.05f, -18.0f); // Bot Left
        glVertex3f(18.0f, 0.05f, -18.0f);  glVertex3f(18.0f, 0.05f, 18.0f);  // Bot Right
        glEnd();

        // Red Base Tron Ancient (-18, -18)
        glPushMatrix();
        glTranslatef(-18.0f, 0.0f, -18.0f);
        glColor3f(0.9f, 0.15f, 0.15f);
        DrawCylinder(2.8f, 1.2f, 3.5f, 12);
        glPushMatrix();
        glTranslatef(0.0f, 3.5f + std::sin(time * 3.0f) * 0.3f, 0.0f);
        glRotatef(time * 45.0f, 0.0f, 1.0f, 0.0f);
        glColor3f(1.0f, 0.3f, 0.3f);
        DrawCube(1.5f);
        glPopMatrix();
        glPopMatrix();

        // Black Base Tron Ancient (18, 18)
        glPushMatrix();
        glTranslatef(18.0f, 0.0f, 18.0f);
        glColor3f(0.15f, 0.5f, 0.9f);
        DrawCylinder(2.8f, 1.2f, 3.5f, 12);
        glPushMatrix();
        glTranslatef(0.0f, 3.5f + std::sin(time * 3.0f) * 0.3f, 0.0f);
        glRotatef(-time * 45.0f, 0.0f, 1.0f, 0.0f);
        glColor3f(0.3f, 0.7f, 1.0f);
        DrawCube(1.5f);
        glPopMatrix();
        glPopMatrix();

        if (g_gameState == GameState::Playing || g_gameState == GameState::InGameMenu) {
            // Render Towers
            for (const auto& tower : mobaEngine.GetTowers()) {
                if (!tower.damageable || !tower.damageable->IsAlive()) continue;

                glPushMatrix();
                glTranslatef(tower.position.x, 0.0f, tower.position.z);

                glColor3f(0.32f, 0.35f, 0.40f);
                DrawCylinder(1.2f, 0.8f, 2.8f, 10);

                glPushMatrix();
                glTranslatef(0.0f, 2.8f, 0.0f);
                if (tower.team == MobaTeam::RED_RADIANT) glColor3f(0.95f, 0.2f, 0.2f);
                else                                     glColor3f(0.2f, 0.6f, 0.95f);
                DrawCube(1.0f);
                glPopMatrix();

                glPushMatrix();
                glTranslatef(0.0f, 4.2f, 0.0f);
                DrawHealthBar3D(tower.damageable->health / tower.damageable->maxHealth, 2.0f, 0.28f);
                glPopMatrix();

                glPopMatrix();
            }

            // Render Creeps
            for (const auto& creep : mobaEngine.GetCreeps()) {
                if (!creep.damageable || !creep.damageable->IsAlive()) continue;

                glPushMatrix();
                glTranslatef(creep.position.x, creep.position.y, creep.position.z);

                glPushMatrix();
                glTranslatef(0.0f, 0.5f, 0.0f);
                if (creep.team == MobaTeam::RED_RADIANT) glColor3f(0.95f, 0.8f, 0.1f);
                else                                     glColor3f(0.1f, 0.85f, 0.95f);
                DrawCube(0.85f);
                glPopMatrix();

                glPushMatrix();
                glTranslatef(0.0f, 1.5f, 0.0f);
                DrawHealthBar3D(creep.damageable->health / creep.damageable->maxHealth, 1.2f, 0.20f);
                glPopMatrix();

                glPopMatrix();
            }

            // Render Hero Unit
            Vec3 heroPos = mobaEngine.playerController.position;
            glPushMatrix();
            glTranslatef(heroPos.x, heroPos.y, heroPos.z);

            glPushMatrix();
            glTranslatef(0.0f, 0.8f, 0.0f);
            glColor3f(1.0f, 0.55f, 0.0f);
            DrawCylinder(0.65f, 0.45f, 1.8f, 10);
            glPopMatrix();

            // Barrier Shield FX
            if (g_barrierTimer > 0.0f) {
                glColor4f(0.2f, 0.8f, 1.0f, 0.6f);
                DrawRing(0.9f, 1.4f, 16);
            }

            glPushMatrix();
            glTranslatef(0.0f, 3.0f, 0.0f);
            MobaHeroData hero = mobaEngine.GetPlayerHero();
            DrawHealthBar3D(hero.hp / hero.maxHp, 2.2f, 0.3f);
            glPopMatrix();

            glPopMatrix();

            // Render Spell FX
            if (g_starfallFxTimer > 0.0f) {
                glPushMatrix();
                glTranslatef(g_starfallPos.x, 0.1f, g_starfallPos.z);
                glColor3f(1.0f, 0.85f, 0.1f);
                DrawRing(1.5f, 4.5f, 20);
                glPopMatrix();
            }

            if (g_eclipseFxTimer > 0.0f) {
                glPushMatrix();
                glTranslatef(g_eclipsePos.x, 0.1f, g_eclipsePos.z);
                glColor3f(0.9f, 0.1f, 0.3f);
                DrawRing(2.0f, 8.0f, 24);
                glPopMatrix();
            }
        }

        // ==========================================
        // 2D HUD OVERLAY & MENUS
        // ==========================================
        Begin2D(config.width, config.height);

        if (g_gameState == GameState::MainMenu) {
            // Main Menu Overlay
            DrawQuad2D(0, 0, config.width, config.height, 0.02f, 0.04f, 0.08f, 0.70f);
            DrawQuad2D(config.width * 0.5f - 280, 100, 560, 480, 0.05f, 0.08f, 0.12f, 0.90f);
            DrawBorder2D(config.width * 0.5f - 280, 100, 560, 480, 0.9f, 0.6f, 0.1f, 3.0f);

            DrawText2D(g_fontLarge, "FOREST OF HOLLOW BLOOD", config.width * 0.5f - 180, 150, 1.0f, 0.8f, 0.2f);
            DrawText2D(g_fontSmall, "OFFICIAL C++ NATIVE MOBA ENGINE (3-LANE DOTA STYLE)", config.width * 0.5f - 200, 185, 0.6f, 0.8f, 1.0f);

            DrawQuad2D(config.width * 0.5f - 220, 230, 440, 50, 0.1f, 0.25f, 0.15f, 0.9f);
            DrawBorder2D(config.width * 0.5f - 220, 230, 440, 50, 0.2f, 0.9f, 0.3f, 2.0f);
            DrawText2D(g_fontSmall, "[1] ENTER CHAMPION DRAFT (SELECT HERO)", config.width * 0.5f - 180, 260, 1.0f, 1.0f, 1.0f);

            DrawQuad2D(config.width * 0.5f - 220, 300, 440, 50, 0.15f, 0.18f, 0.28f, 0.9f);
            DrawBorder2D(config.width * 0.5f - 220, 300, 440, 50, 0.3f, 0.6f, 0.9f, 2.0f);
            DrawText2D(g_fontSmall, "[2] QUICK PLAY MATCH (ARISSA RANGER)", config.width * 0.5f - 180, 330, 1.0f, 1.0f, 1.0f);

            DrawQuad2D(config.width * 0.5f - 220, 370, 440, 120, 0.08f, 0.10f, 0.15f, 0.9f);
            DrawBorder2D(config.width * 0.5f - 220, 370, 440, 120, 0.5f, 0.5f, 0.6f, 1.5f);
            DrawText2D(g_fontSmall, "CONTROLS:", config.width * 0.5f - 200, 395, 0.9f, 0.7f, 0.2f);
            DrawText2D(g_fontSmall, "  WASD / ARROWS : Move Hero & Pan Camera", config.width * 0.5f - 200, 420, 0.8f, 0.8f, 0.8f);
            DrawText2D(g_fontSmall, "  1, 2, 3, 4 / Q, W, E, R : Cast Combat Spells", config.width * 0.5f - 200, 445, 0.8f, 0.8f, 0.8f);
            DrawText2D(g_fontSmall, "  B : Open Item Shop  |  M / ESC : In-Game Menu", config.width * 0.5f - 200, 470, 0.8f, 0.8f, 0.8f);
        }
        else if (g_gameState == GameState::HeroSelect) {
            // Champion Draft
            DrawQuad2D(0, 0, config.width, config.height, 0.04f, 0.06f, 0.10f, 0.85f);
            DrawText2D(g_fontLarge, "SELECT YOUR CHAMPION", config.width * 0.5f - 150, 50, 1.0f, 0.85f, 0.2f);
            DrawText2D(g_fontSmall, "Use LEFT / RIGHT Arrows or Keys [1-6] to Preview, Press ENTER / SPACE to Lock In", config.width * 0.5f - 270, 80, 0.7f, 0.85f, 1.0f);

            auto heroes = mobaEngine.GetHeroCatalog();
            for (size_t i = 0; i < heroes.size(); ++i) {
                float boxX = 60.0f + i * 195.0f;
                float boxY = 120.0f;
                float boxW = 180.0f;
                float boxH = 460.0f;

                bool isSelected = (static_cast<int>(i) == g_selectedHeroIndex);
                if (isSelected) {
                    DrawQuad2D(boxX, boxY, boxW, boxH, 0.18f, 0.28f, 0.18f, 0.95f);
                    DrawBorder2D(boxX, boxY, boxW, boxH, 0.2f, 0.95f, 0.3f, 3.5f);
                } else {
                    DrawQuad2D(boxX, boxY, boxW, boxH, 0.08f, 0.10f, 0.14f, 0.85f);
                    DrawBorder2D(boxX, boxY, boxW, boxH, 0.3f, 0.35f, 0.45f, 1.5f);
                }

                DrawText2D(g_fontLarge, "[" + std::to_string(i + 1) + "] " + heroes[i].name, boxX + 10, boxY + 35, isSelected ? 0.3f : 0.9f, isSelected ? 1.0f : 0.9f, isSelected ? 0.4f : 0.9f);
                DrawText2D(g_fontSmall, heroes[i].role, boxX + 10, boxY + 65, 0.9f, 0.7f, 0.2f);

                DrawText2D(g_fontSmall, "HP: " + std::to_string((int)heroes[i].maxHp), boxX + 10, boxY + 110, 0.2f, 0.9f, 0.3f);
                DrawText2D(g_fontSmall, "MP: " + std::to_string((int)heroes[i].maxMp), boxX + 10, boxY + 135, 0.3f, 0.6f, 1.0f);
                DrawText2D(g_fontSmall, "ATK: " + std::to_string((int)heroes[i].attackDamage), boxX + 10, boxY + 160, 1.0f, 0.4f, 0.4f);
                DrawText2D(g_fontSmall, "SPD: " + std::to_string((int)heroes[i].moveSpeed), boxX + 10, boxY + 185, 0.9f, 0.9f, 0.3f);

                DrawText2D(g_fontSmall, "PRIMARY ABILITY:", boxX + 10, boxY + 230, 0.9f, 0.6f, 0.1f);
                DrawText2D(g_fontSmall, heroes[i].primaryAbility, boxX + 10, boxY + 255, 1.0f, 1.0f, 1.0f);

                if (isSelected) {
                    DrawQuad2D(boxX + 10, boxY + 390, boxW - 20, 45, 0.2f, 0.7f, 0.3f, 0.95f);
                    DrawText2D(g_fontSmall, "LOCKED IN", boxX + 45, boxY + 420, 1.0f, 1.0f, 1.0f);
                }
            }
        }
        else if (g_gameState == GameState::Playing || g_gameState == GameState::InGameMenu) {
            // TOP MATCH STATUS BAR
            DrawQuad2D(0, 0, config.width, 50, 0.05f, 0.07f, 0.10f, 0.90f);
            DrawBorder2D(0, 0, config.width, 50, 0.2f, 0.3f, 0.4f, 1.5f);

            // Red Tron HP Bar
            DrawText2D(g_fontSmall, "RED TRON", 20, 22, 0.95f, 0.2f, 0.2f);
            DrawQuad2D(90, 12, 180, 16, 0.15f, 0.05f, 0.05f, 0.9f);
            DrawQuad2D(90, 12, 180 * (g_redTronHp / g_redTronMaxHp), 16, 0.9f, 0.2f, 0.2f, 1.0f);

            // Match Timer & Kills
            int mins = (int)g_matchTimer / 60;
            int secs = (int)g_matchTimer % 60;
            char timerStr[32];
            snprintf(timerStr, sizeof(timerStr), "%02d:%02d", mins, secs);

            DrawText2D(g_fontLarge, "HOLLOW BLOOD", config.width * 0.5f - 90, 28, 1.0f, 0.85f, 0.2f);
            DrawText2D(g_fontSmall, std::string("KILLS: ") + std::to_string(mobaEngine.GetPlayerKills()) + "  |  TIME: " + timerStr, config.width * 0.5f - 85, 44, 0.8f, 0.8f, 0.8f);

            // Black Tron HP Bar
            DrawText2D(g_fontSmall, "BLACK TRON", config.width - 280, 22, 0.2f, 0.6f, 0.95f);
            DrawQuad2D(config.width - 190, 12, 170, 16, 0.05f, 0.1f, 0.2f, 0.9f);
            DrawQuad2D(config.width - 190, 12, 170 * (g_blackTronHp / g_blackTronMaxHp), 16, 0.2f, 0.6f, 0.95f, 1.0f);

            // Notification Banner
            if (g_notificationTimer > 0.0f) {
                DrawQuad2D(config.width * 0.5f - 280, 60, 560, 30, 0.08f, 0.12f, 0.18f, 0.92f);
                DrawBorder2D(config.width * 0.5f - 280, 60, 560, 30, 0.9f, 0.7f, 0.2f, 1.5f);
                DrawText2D(g_fontSmall, g_notificationText, config.width * 0.5f - 260, 80, 1.0f, 0.9f, 0.3f);
            }

            // BOTTOM HUD BAR
            DrawQuad2D(0, config.height - 110, config.width, 110, 0.04f, 0.06f, 0.09f, 0.92f);
            DrawBorder2D(0, config.height - 110, config.width, 110, 0.2f, 0.3f, 0.45f, 2.0f);

            MobaHeroData hero = mobaEngine.GetPlayerHero();

            // Hero Portrait & Name
            DrawQuad2D(20, config.height - 95, 80, 80, 0.12f, 0.15f, 0.22f, 0.9f);
            DrawBorder2D(20, config.height - 95, 80, 80, 0.9f, 0.6f, 0.1f, 2.0f);
            DrawText2D(g_fontSmall, hero.name, 25, config.height - 60, 1.0f, 1.0f, 1.0f);
            DrawText2D(g_fontSmall, "LVL 1", 25, config.height - 35, 0.9f, 0.8f, 0.2f);

            // HP & Mana Bars
            DrawText2D(g_fontSmall, "HP: " + std::to_string((int)hero.hp) + "/" + std::to_string((int)hero.maxHp), 115, config.height - 78, 0.2f, 0.95f, 0.3f);
            DrawQuad2D(115, config.height - 72, 220, 12, 0.1f, 0.2f, 0.1f, 0.9f);
            DrawQuad2D(115, config.height - 72, 220 * (hero.hp / hero.maxHp), 12, 0.2f, 0.9f, 0.3f, 1.0f);

            DrawText2D(g_fontSmall, "MP: " + std::to_string((int)hero.mp) + "/" + std::to_string((int)hero.maxMp), 115, config.height - 42, 0.3f, 0.65f, 1.0f);
            DrawQuad2D(115, config.height - 36, 220, 12, 0.05f, 0.1f, 0.2f, 0.9f);
            DrawQuad2D(115, config.height - 36, 220 * (hero.mp / hero.maxMp), 12, 0.3f, 0.6f, 0.95f, 1.0f);

            // Attributes
            DrawText2D(g_fontSmall, "ATK: " + std::to_string((int)hero.attackDamage), 350, config.height - 70, 0.95f, 0.4f, 0.4f);
            DrawText2D(g_fontSmall, "SPD: " + std::to_string((int)hero.moveSpeed), 350, config.height - 45, 0.9f, 0.9f, 0.3f);
            DrawText2D(g_fontSmall, "GOLD: " + std::to_string(mobaEngine.GetPlayerGold()) + " G", 350, config.height - 20, 1.0f, 0.8f, 0.1f);

            // Spells (Q, W, E, R)
            float spellStartX = 500.0f;
            float spellY = config.height - 90.0f;

            struct SpellSlot { std::string key; std::string name; float cd; };
            SpellSlot slots[4] = {
                { "Q/1", "Starfall", g_spellQCooldown },
                { "W/2", "Blink", g_spellWCooldown },
                { "E/3", "Barrier", g_spellECooldown },
                { "R/4", "Eclipse", g_spellRCooldown }
            };

            for (int i = 0; i < 4; ++i) {
                float sx = spellStartX + i * 110.0f;
                DrawQuad2D(sx, spellY, 95, 70, 0.10f, 0.12f, 0.18f, 0.9f);
                DrawBorder2D(sx, spellY, 95, 70, i == 3 ? 0.9f : 0.4f, i == 3 ? 0.2f : 0.6f, i == 3 ? 0.2f : 0.8f, 2.0f);

                DrawText2D(g_fontSmall, slots[i].key, sx + 8, spellY + 22, 0.9f, 0.8f, 0.2f);
                DrawText2D(g_fontSmall, slots[i].name, sx + 8, spellY + 45, 1.0f, 1.0f, 1.0f);

                if (slots[i].cd > 0.0f) {
                    DrawQuad2D(sx, spellY, 95, 70, 0.0f, 0.0f, 0.0f, 0.75f);
                    char cdStr[16];
                    snprintf(cdStr, sizeof(cdStr), "%.1fs", slots[i].cd);
                    DrawText2D(g_fontSmall, cdStr, sx + 30, spellY + 40, 0.9f, 0.3f, 0.3f);
                }
            }

            // Shop Trigger Button
            DrawQuad2D(config.width - 200, config.height - 85, 180, 60, 0.85f, 0.5f, 0.1f, 0.95f);
            DrawBorder2D(config.width - 200, config.height - 85, 180, 60, 1.0f, 0.9f, 0.3f, 2.0f);
            DrawText2D(g_fontSmall, "BASE SHOP [B]", config.width - 170, config.height - 50, 1.0f, 1.0f, 1.0f);

            // Item Shop Overlay
            if (g_showShopOverlay) {
                DrawQuad2D(config.width * 0.5f - 260, 110, 520, 360, 0.06f, 0.08f, 0.12f, 0.95f);
                DrawBorder2D(config.width * 0.5f - 260, 110, 520, 360, 0.9f, 0.7f, 0.2f, 2.5f);

                DrawText2D(g_fontLarge, "BASE ITEM CATALOG", config.width * 0.5f - 120, 150, 1.0f, 0.85f, 0.2f);

                auto catalog = mobaEngine.GetShopCatalog();
                for (size_t i = 0; i < catalog.size(); ++i) {
                    float iy = 180.0f + i * 65.0f;
                    DrawQuad2D(config.width * 0.5f - 230, iy, 460, 55, 0.12f, 0.15f, 0.22f, 0.9f);
                    DrawBorder2D(config.width * 0.5f - 230, iy, 460, 55, 0.3f, 0.5f, 0.7f, 1.5f);

                    DrawText2D(g_fontSmall, "[" + std::to_string(i + 1) + "] " + catalog[i].name, config.width * 0.5f - 215, iy + 25, 1.0f, 1.0f, 1.0f);
                    DrawText2D(g_fontSmall, catalog[i].effect, config.width * 0.5f - 215, iy + 45, 0.7f, 0.9f, 0.7f);
                    DrawText2D(g_fontSmall, std::to_string(catalog[i].cost) + " GOLD", config.width * 0.5f + 130, iy + 35, 1.0f, 0.8f, 0.2f);
                }
            }

            // In-Game Pause Menu
            if (g_gameState == GameState::InGameMenu) {
                DrawQuad2D(0, 0, config.width, config.height, 0.02f, 0.04f, 0.06f, 0.75f);
                DrawQuad2D(config.width * 0.5f - 200, 160, 400, 360, 0.08f, 0.10f, 0.15f, 0.95f);
                DrawBorder2D(config.width * 0.5f - 200, 160, 400, 360, 0.9f, 0.7f, 0.2f, 2.5f);

                DrawText2D(g_fontLarge, "MATCH PAUSED", config.width * 0.5f - 85, 205, 1.0f, 0.85f, 0.2f);

                DrawText2D(g_fontSmall, "[1] RESUME MATCH", config.width * 0.5f - 140, 260, 1.0f, 1.0f, 1.0f);
                DrawText2D(g_fontSmall, "[2] CHAMPION DRAFT (CHANGE HERO)", config.width * 0.5f - 140, 310, 1.0f, 1.0f, 1.0f);
                DrawText2D(g_fontSmall, "[3] RESTART MATCH", config.width * 0.5f - 140, 360, 1.0f, 1.0f, 1.0f);
                DrawText2D(g_fontSmall, "[4] MAIN MENU", config.width * 0.5f - 140, 410, 1.0f, 1.0f, 1.0f);
            }
        }

        End2D();

        SwapBuffers(hdc);
        std::this_thread::sleep_for(std::chrono::milliseconds(16));
    }

    wglMakeCurrent(NULL, NULL);
    wglDeleteContext(hglrc);
    ReleaseDC(hwnd, hdc);
    DestroyWindow(hwnd);
    std::cout << "[Pure C++ Native Engine] Window closed cleanly.\n";
#else
    std::cout << "Headless C++ engine simulation...\n";
#endif

    return 0;
}
