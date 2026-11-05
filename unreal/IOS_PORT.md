# iOS port assessment

Status: exploratory follow-up to the Mac build. There is no iOS build, signing setup, touch-control implementation or device validation yet. The same incident simulation and original geometry/music can be reused; the desktop configuration cannot simply be packaged unchanged for a phone.

## Toolchain and device

Use the Mac UE 5.8 installation with its iOS platform support and a compatible full Xcode. Epic's [current iOS requirements](https://dev.epicgames.com/documentation/unreal-engine/ios-ipados-and-tvos-development-requirements-for-unreal-engine) recommend Xcode 26.1.1 and base SDK 26, with supported target OS versions 17 or later. Recheck those requirements when building; use the installed engine's Apple SDK compatibility metadata rather than bypassing its version checks.

Select an actual iPhone/iPad model before setting performance and deployment targets. Configure a unique bundle identifier, development team and signing/provisioning through Xcode and Unreal's iOS settings. Trust the device and enable Developer Mode as required by [Epic's device setup guide](https://dev.epicgames.com/documentation/unreal-engine/set-up-ios-ipados-and-tvos-devices-for-development-in-unreal-engine). TestFlight/App Store distribution requires the appropriate Apple Developer Program setup; do not commit credentials, signing keys or provisioning secrets.

## Work required

1. **Mobile rendering:** Epic states that [Lumen does not currently work on iOS/iPadOS](https://dev.epicgames.com/documentation/unreal-engine/using-lumen-global-illumination-on-mobile-in-unreal-engine). The current corridor depends on desktop Lumen, virtual shadows and multiple dynamic lights. Choose a supported [mobile rendering path](https://dev.epicgames.com/documentation/unreal-engine/mobile-rendering-and-shading-modes-for-unreal-engine), replace indirect lighting/reflections appropriately, limit lights/shadows and verify the art direction on device. The project's current static-lighting setting also needs review if baked lighting is chosen.
2. **Touch controls:** implement left/right movement, jump, terminal interaction, PATCH!, DOC, validation and music/help buttons. Modal choices need reliable touch input. The existing desktop key bindings and Canvas hitboxes alone do not create a playable touch interface.
3. **Phone layout:** support landscape safe areas/notches, readable evidence, practical touch targets and useful camera framing. Remove the desktop Quit action on iOS. Do not depend on a physical keyboard/controller.
4. **Lifecycle and audio:** pause exposure on backgrounding, handle resume, audio interruption and device audio settings; preserve incident state intentionally. Profile thermal behavior, frame pacing, memory and battery use on actual hardware.
5. **Cook/sign/package:** build a Development device package, verify all dynamically loaded art/audio are cooked, provision/sign it and complete the full incident on the target device. Only then prepare TestFlight or public distribution.

Finish the Mac slice first. An iOS simulator launch or successful cook does not establish that this rendering/input implementation works on a physical phone. Do not label this plan as a completed port.
