#include "engine/Engine.hpp"
#include <iostream>
#include <chrono>
#include <thread>

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

    std::cout << "Native Engine Initialized Successfully!\n";
    std::cout << "Viewport: " << config.width << "x" << config.height << "\n";
    std::cout << "Running loop...\n";

    // Simulation loop
    for (int frame = 1; frame <= 100; ++frame) {
        engine.Update(0.016f);
        engine.Render();
        if (frame % 20 == 0) {
            std::cout << "Frame " << frame << " rendered | Draw Calls: " 
                      << engine.GetDrawCallCount() << " | Vertices: " 
                      << engine.GetVertexCount() << std::endl;
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(16));
    }

    std::cout << "Native Engine loop completed successfully.\n";
    return 0;
}
