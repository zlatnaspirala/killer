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

int main(int argc, char* argv[]) {
    (void)argc; (void)argv;
    std::cout << "=================================================================\n";
    std::cout << "  Killer App - Native Multiplatform C++ Game Engine             \n";
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

    // Register Damage System Callbacks
    damageSystem.AddOnDamageListener([](const DamageEvent& evt) {
        std::cout << "[Combat Event] " << evt.targetName << " took " << evt.damageAmount 
                  << " damage! Remaining HP: " << evt.remainingHealth << "/" << evt.maxHealth << "\n";
    });

    damageSystem.AddOnDestroyedListener([](const DamageEvent& evt) {
        std::cout << "[Destroyed Event] " << evt.targetName << " DESTROYED!\n";
    });

#if defined(_WIN32)
    HINSTANCE hInstance = GetModuleHandle(NULL);
    WNDCLASSEXA wc = {};
    wc.cbSize = sizeof(WNDCLASSEXA);
    wc.style = CS_OWNDC | CS_HREDRAW | CS_VREDRAW;
    wc.lpfnWndProc = WndProc;
    wc.hInstance = hInstance;
    wc.hCursor = LoadCursor(NULL, IDC_ARROW);
    wc.lpszClassName = "KillerAppNativeWindowClass";

    if (!RegisterClassExA(&wc)) return 1;

    RECT wr = { 0, 0, (LONG)config.width, (LONG)config.height };
    AdjustWindowRect(&wr, WS_OVERLAPPEDWINDOW, FALSE);

    HWND hwnd = CreateWindowExA(
        0, wc.lpszClassName, "Killer App - Pure C++ Native Game Engine Viewport",
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

    engine.Resize(config.width, config.height);

    std::cout << "[Native C++ Engine] Window and hardware-accelerated OpenGL context active!\n";

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

        // C++ Engine Tick
        engine.Update(dt);
        damageSystem.Update(dt);

        // Render C++ Engine Scene
        engine.Render();

        SwapBuffers(hdc);
        std::this_thread::sleep_for(std::chrono::milliseconds(16));
    }

    wglMakeCurrent(NULL, NULL);
    wglDeleteContext(hglrc);
    ReleaseDC(hwnd, hdc);
    DestroyWindow(hwnd);
    std::cout << "[Native C++ Engine] Window closed.\n";
#else
    std::cout << "Running headless C++ Engine...\n";
#endif

    return 0;
}
