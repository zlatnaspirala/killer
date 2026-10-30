#include "engine/Engine.hpp"
#include <iostream>
#include <chrono>
#include <thread>
#include <cmath>

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

int main(int argc, char* argv[]) {
    (void)argc; (void)argv;
    std::cout << "========================================\n";
    std::cout << "  Killer App Native C++ Desktop Engine  \n";
    std::cout << "========================================\n";

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
    // Create native Windows OpenGL Window
    HINSTANCE hInstance = GetModuleHandle(NULL);
    WNDCLASSEXA wc = {};
    wc.cbSize = sizeof(WNDCLASSEXA);
    wc.style = CS_OWNDC | CS_HREDRAW | CS_VREDRAW;
    wc.lpfnWndProc = WndProc;
    wc.hInstance = hInstance;
    wc.hCursor = LoadCursor(NULL, IDC_ARROW);
    wc.lpszClassName = "KillerAppWindowClass";

    if (!RegisterClassExA(&wc)) {
        std::cerr << "Failed to register Win32 window class!" << std::endl;
        return 1;
    }

    RECT wr = { 0, 0, (LONG)config.width, (LONG)config.height };
    AdjustWindowRect(&wr, WS_OVERLAPPEDWINDOW, FALSE);

    HWND hwnd = CreateWindowExA(
        0, wc.lpszClassName, "Killer App - Native Desktop 3D Viewport",
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

    std::cout << "[Win32 OpenGL] Native 3D Viewport window launched successfully!\n";

    MSG msg = {};
    bool running = true;
    float time = 0.0f;

    while (running) {
        while (PeekMessage(&msg, NULL, 0, 0, PM_REMOVE)) {
            if (msg.message == WM_QUIT) {
                running = false;
            }
            TranslateMessage(&msg);
            DispatchMessage(&msg);
        }

        if (!running) break;

        time += 0.016f;
        engine.Update(0.016f);

        // Render Native 3D Graphics
        glClearColor(0.1f, 0.12f, 0.18f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

        glMatrixMode(GL_PROJECTION);
        glLoadIdentity();
        float aspect = (float)config.width / (float)config.height;
        float fov = 60.0f * 3.14159265f / 180.0f;
        float f = 1.0f / tanf(fov / 2.0f);
        float zNear = 0.1f;
        float zFar = 100.0f;
        float proj[16] = {
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (zFar + zNear) / (zNear - zFar), -1,
            0, 0, (2 * zFar * zNear) / (zNear - zFar), 0
        };
        glLoadMatrixf(proj);

        glMatrixMode(GL_MODELVIEW);
        glLoadIdentity();
        glTranslatef(0.0f, -0.5f, -4.0f);
        glRotatef(time * 45.0f, 0.0f, 1.0f, 0.0f);

        // Render Ground Grid
        glBegin(GL_LINES);
        glColor3f(0.2f, 0.3f, 0.4f);
        for (int i = -10; i <= 10; ++i) {
            glVertex3f((float)i, 0.0f, -10.0f);
            glVertex3f((float)i, 0.0f, 10.0f);
            glVertex3f(-10.0f, 0.0f, (float)i);
            glVertex3f(10.0f, 0.0f, (float)i);
        }
        glEnd();

        // Render Animated 3D Pyramid Mesh
        glBegin(GL_TRIANGLES);
        // Front
        glColor3f(0.9f, 0.2f, 0.3f);
        glVertex3f(0.0f, 1.0f, 0.0f);
        glColor3f(0.2f, 0.8f, 0.4f);
        glVertex3f(-0.8f, -0.5f, 0.8f);
        glColor3f(0.2f, 0.4f, 0.9f);
        glVertex3f(0.8f, -0.5f, 0.8f);

        // Right
        glColor3f(0.9f, 0.2f, 0.3f);
        glVertex3f(0.0f, 1.0f, 0.0f);
        glColor3f(0.2f, 0.4f, 0.9f);
        glVertex3f(0.8f, -0.5f, 0.8f);
        glColor3f(0.8f, 0.8f, 0.2f);
        glVertex3f(0.8f, -0.5f, -0.8f);

        // Back
        glColor3f(0.9f, 0.2f, 0.3f);
        glVertex3f(0.0f, 1.0f, 0.0f);
        glColor3f(0.8f, 0.8f, 0.2f);
        glVertex3f(0.8f, -0.5f, -0.8f);
        glColor3f(0.8f, 0.2f, 0.8f);
        glVertex3f(-0.8f, -0.5f, -0.8f);

        // Left
        glColor3f(0.9f, 0.2f, 0.3f);
        glVertex3f(0.0f, 1.0f, 0.0f);
        glColor3f(0.8f, 0.2f, 0.8f);
        glVertex3f(-0.8f, -0.5f, -0.8f);
        glColor3f(0.2f, 0.8f, 0.4f);
        glVertex3f(-0.8f, -0.5f, 0.8f);
        glEnd();

        SwapBuffers(hdc);
        std::this_thread::sleep_for(std::chrono::milliseconds(16));
    }

    wglMakeCurrent(NULL, NULL);
    wglDeleteContext(hglrc);
    ReleaseDC(hwnd, hdc);
    DestroyWindow(hwnd);
    std::cout << "[Win32 OpenGL] Window closed.\n";
#else
    std::cout << "Running headless loop...\n";
    for (int frame = 1; frame <= 100; ++frame) {
        engine.Update(0.016f);
        engine.Render();
        std::this_thread::sleep_for(std::chrono::milliseconds(16));
    }
#endif

    return 0;
}
