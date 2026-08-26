#pragma once
#include <cmath>
#include <cstring>
#include <algorithm>

namespace EngineCore {

enum class CameraMode {
    OrbitArc = 0,
    FirstPerson = 1,
    FreeFly = 2
};

class CameraController {
public:
    CameraController(float fovDeg = 45.0f, float aspect = 16.0f / 9.0f, float nearPlane = 0.1f, float farPlane = 100.0f)
        : m_fov(fovDeg * 0.0174532925f), m_aspect(aspect), m_near(nearPlane), m_far(farPlane) {
        UpdateMatrices();
    }

    void SetMode(CameraMode mode) {
        m_mode = mode;
        if (m_mode == CameraMode::FirstPerson || m_mode == CameraMode::FreeFly) {
            // Recalculate forward vector from current angles
            UpdateFPVectors();
        }
        UpdateMatrices();
    }

    CameraMode GetMode() const { return m_mode; }

    void SetAspectRatio(float aspect) {
        m_aspect = aspect;
        UpdateMatrices();
    }

    // Zero-allocation mouse look & pan
    void OnMouseMove(float dx, float dy, bool isLeftDown, bool isRightDown, bool isMiddleDown, bool shiftHeld) {
        if (m_mode == CameraMode::OrbitArc) {
            if (isLeftDown && !shiftHeld) {
                // Arc Orbit
                m_yaw += dx * 0.006f;
                m_pitch += dy * 0.006f;
                m_pitch = std::clamp(m_pitch, -1.45f, 1.45f);
                UpdateArcPose();
            } else if (isRightDown || (isLeftDown && shiftHeld) || isMiddleDown) {
                // Pan target
                float panSpeed = m_radius * 0.0015f;
                float rightX = std::cos(m_yaw);
                float rightZ = -std::sin(m_yaw);
                m_target[0] -= rightX * dx * panSpeed;
                m_target[2] -= rightZ * dx * panSpeed;
                m_target[1] += dy * panSpeed;
                UpdateArcPose();
            }
        } else {
            // First Person / Free-Fly mouse look
            if (isLeftDown || isRightDown || isMiddleDown) {
                m_yaw += dx * 0.004f;
                m_pitch -= dy * 0.004f;
                m_pitch = std::clamp(m_pitch, -1.50f, 1.50f);
                UpdateFPVectors();
                UpdateMatrices();
            }
        }
    }

    void OnMouseWheel(float deltaY) {
        if (m_mode == CameraMode::OrbitArc) {
            m_radius += deltaY * 0.003f;
            m_radius = std::clamp(m_radius, 0.8f, 25.0f);
            UpdateArcPose();
        } else {
            // In FP mode, scroll adjusts move speed
            m_moveSpeed *= (deltaY > 0 ? 0.9f : 1.1f);
            m_moveSpeed = std::clamp(m_moveSpeed, 0.5f, 50.0f);
        }
    }

    // Keyboard navigation (WASD, QE, Space/Shift)
    void Update(float dt, bool keyW, bool keyS, bool keyA, bool keyD, bool keyQ, bool keyE, bool keySpace, bool keyShift) {
        if (m_mode == CameraMode::OrbitArc) {
            // Smooth damping or keyboard panning if needed
            return;
        }

        float speed = m_moveSpeed * (keyShift ? 2.5f : 1.0f) * dt;
        float moveX = 0.0f;
        float moveY = 0.0f;
        float moveZ = 0.0f;

        if (keyW) { moveX += m_front[0]; moveY += m_front[1]; moveZ += m_front[2]; }
        if (keyS) { moveX -= m_front[0]; moveY -= m_front[1]; moveZ -= m_front[2]; }
        if (keyD) { moveX += m_right[0]; moveY += m_right[1]; moveZ += m_right[2]; }
        if (keyA) { moveX -= m_right[0]; moveY -= m_right[1]; moveZ -= m_right[2]; }
        if (keyE || keySpace) { moveY += 1.0f; }
        if (keyQ) { moveY -= 1.0f; }

        if (m_mode == CameraMode::FirstPerson) {
            // Constrain FP camera to horizontal walking plane unless flying
            // (keeps moveY purely for Q/E)
        }

        m_pos[0] += moveX * speed;
        m_pos[1] += moveY * speed;
        m_pos[2] += moveZ * speed;

        UpdateMatrices();
    }

    void ResetPose() {
        m_pos[0] = 0.0f; m_pos[1] = 1.2f; m_pos[2] = 4.5f;
        m_target[0] = 0.0f; m_target[1] = 0.0f; m_target[2] = 0.0f;
        m_yaw = 0.0f;
        m_pitch = 0.25f;
        m_radius = 4.5f;
        UpdateArcPose();
    }

    const float* GetViewProjMatrix() const { return m_viewProjMatrix; }
    const float* GetPosition() const { return m_pos; }
    const float* GetTarget() const { return m_target; }
    float GetYaw() const { return m_yaw; }
    float GetPitch() const { return m_pitch; }
    float GetRadius() const { return m_radius; }
    float GetMoveSpeed() const { return m_moveSpeed; }

private:
    void UpdateArcPose() {
        m_pos[0] = m_target[0] + m_radius * std::cos(m_pitch) * std::sin(m_yaw);
        m_pos[1] = m_target[1] + m_radius * std::sin(m_pitch);
        m_pos[2] = m_target[2] + m_radius * std::cos(m_pitch) * std::cos(m_yaw);
        UpdateMatrices();
    }

    void UpdateFPVectors() {
        m_front[0] = std::cos(m_pitch) * std::sin(m_yaw);
        m_front[1] = std::sin(m_pitch);
        m_front[2] = -std::cos(m_pitch) * std::cos(m_yaw);

        // Normalize front
        float len = 1.0f / std::sqrt(m_front[0]*m_front[0] + m_front[1]*m_front[1] + m_front[2]*m_front[2]);
        m_front[0] *= len; m_front[1] *= len; m_front[2] *= len;

        // Right = cross(front, [0,1,0])
        m_right[0] = -m_front[2];
        m_right[1] = 0.0f;
        m_right[2] = m_front[0];
        float rlen = 1.0f / std::sqrt(m_right[0]*m_right[0] + m_right[2]*m_right[2] + 0.00001f);
        m_right[0] *= rlen; m_right[2] *= rlen;

        // Target for LookAt = pos + front
        m_target[0] = m_pos[0] + m_front[0];
        m_target[1] = m_pos[1] + m_front[1];
        m_target[2] = m_pos[2] + m_front[2];
    }

    void UpdateMatrices() {
        // Fast Perspective Matrix (Column-Major)
        float f = 1.0f / std::tan(m_fov * 0.5f);
        float rangeInv = 1.0f / (m_near - m_far);

        float proj[16] = {0};
        proj[0] = f / m_aspect;
        proj[5] = f;
        proj[10] = (m_near + m_far) * rangeInv;
        proj[11] = -1.0f;
        proj[14] = 2.0f * m_near * m_far * rangeInv;

        // Fast LookAt Matrix
        float zx = m_pos[0] - m_target[0];
        float zy = m_pos[1] - m_target[1];
        float zz = m_pos[2] - m_target[2];
        float zlen = 1.0f / std::sqrt(zx*zx + zy*zy + zz*zz + 0.000001f);
        zx *= zlen; zy *= zlen; zz *= zlen;

        float upX = 0.0f, upY = 1.0f, upZ = 0.0f;
        float xx = upY * zz - upZ * zy;
        float xy = upZ * zx - upX * zz;
        float xz = upX * zy - upY * zx;
        float xlen = 1.0f / std::sqrt(xx*xx + xy*xy + xz*xz + 0.000001f);
        xx *= xlen; xy *= xlen; xz *= xlen;

        float yx = zy * xz - zz * xy;
        float yy = zz * xx - zx * xz;
        float yz = zx * xy - zy * xx;

        float view[16] = {
            xx, yx, zx, 0.0f,
            xy, yy, zy, 0.0f,
            xz, yz, zz, 0.0f,
            -(xx*m_pos[0] + xy*m_pos[1] + xz*m_pos[2]),
            -(yx*m_pos[0] + yy*m_pos[1] + yz*m_pos[2]),
            -(zx*m_pos[0] + zy*m_pos[1] + zz*m_pos[2]),
            1.0f
        };

        // Zero-alloc matrix multiplication
        for (int i = 0; i < 4; ++i) {
            for (int j = 0; j < 4; ++j) {
                float sum = 0.0f;
                for (int k = 0; k < 4; ++k) {
                    sum += proj[k * 4 + j] * view[i * 4 + k];
                }
                m_viewProjMatrix[i * 4 + j] = sum;
            }
        }
    }

    CameraMode m_mode = CameraMode::OrbitArc;
    float m_pos[3] = {0.0f, 1.2f, 4.5f};
    float m_target[3] = {0.0f, 0.0f, 0.0f};
    float m_front[3] = {0.0f, 0.0f, -1.0f};
    float m_right[3] = {1.0f, 0.0f, 0.0f};

    float m_fov;
    float m_aspect;
    float m_near;
    float m_far;
    float m_yaw = 0.0f;
    float m_pitch = 0.25f;
    float m_radius = 4.5f;
    float m_moveSpeed = 4.0f;

    float m_viewProjMatrix[16];
};

} // namespace EngineCore
