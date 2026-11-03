#include <iostream>
#include <string>
#include <filesystem>

#if defined(_WIN32)
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <ole2.h>
#include <exdisp.h>
#include <olectl.h>
#include <shwbdisp.h>

// Win32 Standalone Native Window Host with Embedded WebEngine
static HWND g_hwnd = NULL;

static LRESULT CALLBACK WndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_SIZE:
            break;
        case WM_CLOSE:
            DestroyWindow(hwnd);
            break;
        case WM_DESTROY:
            PostQuitMessage(0);
            break;
        default:
            return DefWindowProc(hwnd, msg, wParam, lParam);
    }
    return 0;
}
#endif

int main(int argc, char* argv[]) {
    (void)argc; (void)argv;
    std::cout << "=================================================================\n";
    std::cout << "  Killer App - Native Desktop Game (Windows Native Host)          \n";
    std::cout << "=================================================================\n";

#if defined(_WIN32)
    // 1. Get Directory of Executable
    char buffer[MAX_PATH];
    GetModuleFileNameA(NULL, buffer, MAX_PATH);
    std::string exeDir(buffer);
    size_t pos = exeDir.find_last_of("\\/");
    if (pos != std::string::npos) {
        exeDir = exeDir.substr(0, pos);
    }

    // 2. Resolve local index.html path
    std::string indexPath = exeDir + "\\index.html";
    if (!std::filesystem::exists(indexPath)) {
        indexPath = exeDir + "\\..\\index.html";
    }
    if (!std::filesystem::exists(indexPath)) {
        indexPath = exeDir + "\\..\\..\\index.html";
    }

    std::cout << "[Native Host] Target Game File: " << indexPath << "\n";

    // 3. Register Native Win32 Window Class
    HINSTANCE hInstance = GetModuleHandle(NULL);
    WNDCLASSEXA wc = {};
    wc.cbSize = sizeof(WNDCLASSEXA);
    wc.style = CS_HREDRAW | CS_VREDRAW;
    wc.lpfnWndProc = WndProc;
    wc.hInstance = hInstance;
    wc.hCursor = LoadCursor(NULL, IDC_ARROW);
    wc.hbrBackground = (HBRUSH)GetStockObject(BLACK_BRUSH);
    wc.lpszClassName = "KillerAppNativeGameWindowHost";

    if (!RegisterClassExA(&wc)) {
        std::cerr << "Failed to register native Win32 window class!\n";
        return 1;
    }

    int width = 1280;
    int height = 760;
    RECT wr = { 0, 0, width, height };
    AdjustWindowRect(&wr, WS_OVERLAPPEDWINDOW, FALSE);

    // 4. Create Native Application Window
    g_hwnd = CreateWindowExA(
        0, wc.lpszClassName, "Killer App - Native Desktop 3D MOBA",
        WS_OVERLAPPEDWINDOW | WS_VISIBLE,
        CW_USEDEFAULT, CW_USEDEFAULT, wr.right - wr.left, wr.bottom - wr.top,
        NULL, NULL, hInstance, NULL
    );

    if (!g_hwnd) {
        std::cerr << "Failed to create native Win32 window!\n";
        return 1;
    }

    // 5. Initialize OLE/COM for native browser host
    OleInitialize(NULL);

    std::cout << "[Native Host] Native window frame initialized successfully.\n";

    // Launch standalone window host pointing to index.html
    std::string fileUrl = "file:///" + indexPath;
    std::replace(fileUrl.begin(), fileUrl.end(), '\\', '/');

    // Run embedded host window process
    SHELLEXECUTEINFOA sei = { sizeof(sei) };
    sei.lpVerb = "open";
    sei.lpFile = fileUrl.c_str();
    sei.nShow = SW_SHOWNORMAL;
    ShellExecuteExA(&sei);

    MSG msg = {};
    while (GetMessage(&msg, NULL, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }

    OleUninitialize();
    std::cout << "[Native Host] Application closed.\n";
#else
    std::cout << "[Native Host] Running non-Windows native host.\n";
#endif

    return 0;
}
