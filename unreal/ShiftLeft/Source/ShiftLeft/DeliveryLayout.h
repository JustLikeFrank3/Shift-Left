#pragma once

// Camera faces +Y: screen-right is -X. Keep stage placement, spawning and
// terminal proximity in one coordinate convention instead of independent signs.
namespace ShiftLeftLayout
{
    constexpr float Spacing = 1200.f;
    constexpr float StageX(int Stage) { return 2400.f - Stage * Spacing; }
    constexpr float StartX = StageX(4) + 180.f;
}
