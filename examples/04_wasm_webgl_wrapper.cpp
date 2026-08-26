// examples/04_wasm_webgl_wrapper.cpp
// Emscripten C++ WebAssembly Export Wrapper
// Direct WebGL2 / GLES3 rendering harness without heavy abstractions

#include <emscripten/emscripten.h>
#include <emscripten/html5.h>
#include <emscripten/bind.h>
#include <GLES3/gl3.h>
#include <cmath>
#include <iostream>

struct WasmRenderer {
    EMSCRIPTEN_WEBGL_CONTEXT_HANDLE glContext = 0;
    int canvasWidth = 1280;
    int canvasHeight = 720;
    GLuint program = 0;
    GLuint vao = 0;
    GLuint vbo = 0;
    GLuint ibo = 0;
    int indexCount = 0;

    float roughness = 0.35f;
    float metallic = 0.8f;
    float baseColor[3] = {0.15f, 0.40f, 0.95f};

    // Preallocated uniforms
    GLint uModelLoc = -1;
    GLint uViewProjLoc = -1;
    GLint uCamPosLoc = -1;
    GLint uBaseColorLoc = -1;
    GLint uRoughnessLoc = -1;
    GLint uMetallicLoc = -1;
    GLint uTimeLoc = -1;
};

static WasmRenderer g_renderer;

extern "C" {

EMSCRIPTEN_KEEPALIVE
int InitEngineWasm(const char* targetCanvasId, int width, int height) {
    EmscriptenWebGLContextAttributes attr;
    emscripten_webgl_init_context_attributes(&attr);
    attr.majorVersion = 2; // WebGL 2.0 / GLES 3.0
    attr.minorVersion = 0;
    attr.alpha = 0;
    attr.depth = 1;
    attr.antialias = 1;

    g_renderer.glContext = emscripten_webgl_create_context(targetCanvasId, &attr);
    if (g_renderer.glContext <= 0) {
        std::cerr << "[WASM] Failed to acquire WebGL2 context on " << targetCanvasId << "\n";
        return 0;
    }

    emscripten_webgl_make_context_current(g_renderer.glContext);
    g_renderer.canvasWidth = width;
    g_renderer.canvasHeight = height;

    glViewport(0, 0, width, height);
    glEnable(GL_DEPTH_TEST);
    glDepthFunc(GL_LEQUAL);

    std::cout << "[WASM] Engine successfully initialized with WebGL2 Context ID: " << g_renderer.glContext << "\n";
    return 1;
}

EMSCRIPTEN_KEEPALIVE
void UpdateMaterialParams(float r, float g, float b, float roughness, float metallic) {
    g_renderer.baseColor[0] = r;
    g_renderer.baseColor[1] = g;
    g_renderer.baseColor[2] = b;
    g_renderer.roughness = roughness;
    g_renderer.metallic = metallic;
}

EMSCRIPTEN_KEEPALIVE
void RenderTick(float time) {
    glClearColor(0.04f, 0.05f, 0.07f, 1.0f);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

    // Draw active meshes with zero allocations...
}

} // extern "C"
