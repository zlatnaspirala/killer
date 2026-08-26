#pragma once
#include <cstdint>

namespace EngineCore {

// Bitmask flags for zero-allocation key tracking
enum KeyFlags : uint32_t {
    KEY_NONE  = 0,
    KEY_W     = 1 << 0,
    KEY_A     = 1 << 1,
    KEY_S     = 1 << 2,
    KEY_D     = 1 << 3,
    KEY_Q     = 1 << 4,
    KEY_E     = 1 << 5,
    KEY_SPACE = 1 << 6,
    KEY_SHIFT = 1 << 7,
    KEY_CTRL  = 1 << 8
};

enum MouseButtonFlags : uint8_t {
    MOUSE_NONE   = 0,
    MOUSE_LEFT   = 1 << 0,
    MOUSE_RIGHT  = 1 << 1,
    MOUSE_MIDDLE = 1 << 2
};

class InputManager {
public:
    InputManager() = default;

    void SetKeyDown(KeyFlags key) { m_keys |= key; }
    void SetKeyUp(KeyFlags key)   { m_keys &= ~key; }
    bool IsKeyDown(KeyFlags key) const { return (m_keys & key) != 0; }

    void SetMouseButton(MouseButtonFlags button, bool down) {
        if (down) m_mouseButtons |= button;
        else      m_mouseButtons &= ~button;
    }
    bool IsMouseButtonDown(MouseButtonFlags button) const {
        return (m_mouseButtons & button) != 0;
    }

    void OnMouseMove(float dx, float dy) {
        m_deltaX += dx;
        m_deltaY += dy;
    }

    void OnMouseWheel(float deltaY) {
        m_wheelDelta += deltaY;
    }

    float GetDeltaX() const { return m_deltaX; }
    float GetDeltaY() const { return m_deltaY; }
    float GetWheelDelta() const { return m_wheelDelta; }

    uint32_t GetKeyMask() const { return m_keys; }
    uint8_t GetMouseMask() const { return m_mouseButtons; }

    // Zero allocation frame reset
    void ResetFrameDeltas() {
        m_deltaX = 0.0f;
        m_deltaY = 0.0f;
        m_wheelDelta = 0.0f;
    }

private:
    uint32_t m_keys = KEY_NONE;
    uint8_t m_mouseButtons = MOUSE_NONE;
    float m_deltaX = 0.0f;
    float m_deltaY = 0.0f;
    float m_wheelDelta = 0.0f;
};

} // namespace EngineCore
