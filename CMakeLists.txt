cmake_minimum_required(VERSION 3.15)
project(NativeCppEngine CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(include)

file(GLOB_RECURSE SOURCES "src/core/*.cpp")

if(EMSCRIPTEN)
    add_executable(NativeEngine ${SOURCES})
    set_target_properties(NativeEngine PROPERTIES
        OUTPUT_NAME "engine"
        SUFFIX ".js"
        LINK_FLAGS "-s WASM=1 -s USE_WEBGL2=1 -s FULL_ES3=1 -s ALLOW_MEMORY_GROWTH=1 --bind -O3"
    )
else()
    # Build shared engine library (NativeEngine.dll / .so / .dylib)
    add_library(NativeEngine SHARED ${SOURCES})

    # Build primary desktop executable (killer_app.exe - 3D MOBA Engine Viewport)
    add_executable(killer_app src/main.cpp ${SOURCES})
    target_include_directories(killer_app PRIVATE include)

    # Build MOBA standalone core example (moba_game.exe)
    add_executable(moba_game examples/15_moba.cpp)
    target_include_directories(moba_game PRIVATE include)
endif()


