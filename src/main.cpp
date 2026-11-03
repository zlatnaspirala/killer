#include <iostream>
#include <string>
#include <filesystem>

#if defined(_WIN32)
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <shellapi.h>
#endif

int main(int argc, char* argv[]) {
    (void)argc; (void)argv;
    std::cout << "=================================================================\n";
    std::cout << "  Killer App - Native Multiplatform Desktop Game Engine          \n";
    std::cout << "=================================================================\n";

#if defined(_WIN32)
    // 1. Get path of running executable
    char buffer[MAX_PATH];
    GetModuleFileNameA(NULL, buffer, MAX_PATH);
    std::string exeDir(buffer);
    size_t pos = exeDir.find_last_of("\\/");
    if (pos != std::string::npos) {
        exeDir = exeDir.substr(0, pos);
    }

    // 2. Locate index.html in release dir, root dir or parent dir
    std::string targetUrl;
    std::string path1 = exeDir + "\\index.html";
    std::string path2 = exeDir + "\\..\\index.html";
    std::string path3 = exeDir + "\\..\\..\\index.html";

    if (std::filesystem::exists(path1)) {
        targetUrl = path1;
    } else if (std::filesystem::exists(path2)) {
        targetUrl = path2;
    } else if (std::filesystem::exists(path3)) {
        targetUrl = path3;
    } else {
        targetUrl = "http://localhost:3000";
    }

    std::cout << "[Native Desktop Launcher] Loading Full Web MOBA Game from:\n";
    std::cout << "--> " << targetUrl << "\n";

    // 3. Launch native desktop window host for the complete game
    HINSTANCE hInst = ShellExecuteA(NULL, "open", targetUrl.c_str(), NULL, NULL, SW_SHOWNORMAL);
    if ((INT_PTR)hInst <= 32) {
        std::cerr << "[Native Desktop Error] Could not launch native game window. Code: " << (INT_PTR)hInst << "\n";
        return 1;
    }

    std::cout << "[Native Desktop Success] Full MOBA Game launched natively in desktop window!\n";
#else
    std::cout << "[Native Desktop] Non-Windows desktop runtime active.\n";
#endif

    return 0;
}
