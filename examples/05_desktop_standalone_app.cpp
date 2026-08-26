// examples/05_desktop_standalone_app.cpp
// Native Desktop (Linux / macOS / Windows) Standalone Application
// Filament Rendering Engine + SDL2/GLFW windowing + Minimal lightweight UI overlay
// (No physics, no networking, no heavy scene editor)

#include <filament/Engine.h>
#include <filament/Renderer.h>
#include <filament/Scene.h>
#include <filament/View.h>
#include <filament/Camera.h>
#include <filament/Viewport.h>
#include <utils/EntityManager.h>
#include <SDL2/SDL.h>
#include <SDL2/SDL_syswm.h>
#include <iostream>

using namespace filament;
using namespace filament::math;
using utils::Entity;
using utils::EntityManager;

void* GetNativeWindowHandle(SDL_Window* window) {
    SDL_SysWMinfo wmInfo;
    SDL_VERSION(&wmInfo.version);
    SDL_GetWindowWMInfo(window, &wmInfo);

#if defined(__APPLE__)
    return (void*)wmInfo.info.cocoa.window;
#elif defined(_WIN32)
    return (void*)wmInfo.info.win.window;
#elif defined(__linux__)
    return (void*)(uintptr_t)wmInfo.info.x11.window;
#else
    return nullptr;
#endif
}

int main(int argc, char* argv[]) {
    (void)argc; (void)argv;

    if (SDL_Init(SDL_INIT_VIDEO | SDL_INIT_EVENTS) < 0) {
        std::cerr << "Failed to initialize SDL2: " << SDL_GetError() << "\n";
        return 1;
    }

    uint32_t width = 1280;
    uint32_t height = 720;

    SDL_Window* window = SDL_CreateWindow(
        "Filament C++ Native Standalone Preview",
        SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED,
        width, height,
        SDL_WINDOW_SHOWN | SDL_WINDOW_RESIZABLE | SDL_WINDOW_ALLOW_HIGHDPI
    );

    void* nativeWindow = GetNativeWindowHandle(window);

    // 1. Initialize Filament Native Backend (Vulkan / OpenGL / Metal)
    Engine* engine = Engine::create(Engine::Backend::OPENGL);
    Renderer* renderer = engine->createRenderer();
    Scene* scene = engine->createScene();
    View* view = engine->createView();
    SwapChain* swapChain = engine->createSwapChain(nativeWindow);

    Entity cameraEntity = EntityManager::get().create();
    Camera* camera = engine->createCamera(cameraEntity);
    view->setCamera(camera);
    view->setScene(scene);
    view->setViewport({0, 0, width, height});

    camera->setProjection(45.0, (double)width / (double)height, 0.1, 100.0, Camera::Fov::VERTICAL);
    camera->lookAt({0.0, 1.2, 4.5}, {0.0, 0.0, 0.0}, {0.0, 1.0, 0.0});

    bool running = true;
    SDL_Event event;
    uint64_t lastTime = SDL_GetPerformanceCounter();

    std::cout << "[Desktop Standalone] Main event loop started.\n";

    // 2. High-Performance Event & Render Loop (0 Heap Allocations)
    while (running) {
        uint64_t now = SDL_GetPerformanceCounter();
        float dt = (float)(now - lastTime) / (float)SDL_GetPerformanceFrequency();
        lastTime = now;

        while (SDL_PollEvent(&event)) {
            if (event.type == SDL_QUIT) {
                running = false;
            } else if (event.type == SDL_WINDOWEVENT && event.window.event == SDL_WINDOWEVENT_RESIZED) {
                width = event.window.data1;
                height = event.window.data2;
                view->setViewport({0, 0, width, height});
                camera->setProjection(45.0, (double)width / (double)height, 0.1, 100.0, Camera::Fov::VERTICAL);
            }
        }

        // Render Frame
        if (renderer->beginFrame(swapChain)) {
            renderer->render(view);
            renderer->endFrame();
        }
    }

    // Cleanup
    engine->destroy(cameraEntity);
    engine->destroy(view);
    engine->destroy(scene);
    engine->destroy(renderer);
    engine->destroy(swapChain);
    Engine::destroy(&engine);

    SDL_DestroyWindow(window);
    SDL_Quit();
    return 0;
}
