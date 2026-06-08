---
name: Neural Interface
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#b9ccb2'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#84967e'
  outline-variant: '#3b4b37'
  surface-tint: '#00e639'
  primary: '#ebffe2'
  on-primary: '#003907'
  primary-container: '#00ff41'
  on-primary-container: '#007117'
  inverse-primary: '#006e16'
  secondary: '#ebb2ff'
  on-secondary: '#520072'
  secondary-container: '#b600f8'
  on-secondary-container: '#fff6fc'
  tertiary: '#ecfcff'
  on-tertiary: '#00363d'
  tertiary-container: '#7fecff'
  on-tertiary-container: '#006b78'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#72ff70'
  primary-fixed-dim: '#00e639'
  on-primary-fixed: '#002203'
  on-primary-fixed-variant: '#00530e'
  secondary-fixed: '#f8d8ff'
  secondary-fixed-dim: '#ebb2ff'
  on-secondary-fixed: '#320047'
  on-secondary-fixed-variant: '#74009f'
  tertiary-fixed: '#9cf0ff'
  tertiary-fixed-dim: '#00daf3'
  on-tertiary-fixed: '#001f24'
  on-tertiary-fixed-variant: '#004f58'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  headline-xl:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
  body-md:
    fontFamily: JetBrains Mono
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.05em
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.4'
spacing:
  unit: 4px
  gutter: 16px
  margin: 24px
  container-max: 1440px
---

## Brand & Style

This design system is a high-fidelity digital simulation, drawing inspiration from late-90s cyberpunk and terminal aesthetics. The brand personality is technical, clandestine, and hyper-efficient, designed for power users who navigate complex data streams. It evokes an emotional response of being "inside the machine"—a state of focused, digital flow.

The aesthetic combines **Brutalism** with **Glassmorphism**. Surfaces are pitch black and non-reflective, acting as a void for glowing, translucent data clusters. Visual hierarchy is established through "digital rain" textures, scanline overlays, and vibrant light-emitting borders rather than traditional shadows or skeuomorphic depth. The UI feels like a head-up display (HUD) or a high-end command terminal.

## Colors

The palette is anchored in absolute darkness to maximize the contrast of "emissive" digital elements.

- **Primary (Matrix Green):** Used for critical data, successful states, and primary actions. It represents the "source code" of the interface.
- **Secondary (Neon Violet):** Used for encryption, security layers, and rare data nodes. It provides a deep, digital warmth to the cold green.
- **Tertiary (Electric Blue):** Used for navigation cues, active selection states, and telemetry data.
- **Neutral:** A range of near-black grays are used for layering glass effects, ensuring the background remains a void while allowing for discernible structural panels.

All accent colors should be implemented with a `0 0 8px` outer glow (drop-shadow) to simulate phosphorous screen emission.

## Typography

Typography functions as data visualization. **Space Grotesk** provides a technical, geometric foundation for high-impact headings, while **JetBrains Mono** ensures every string of text feels like a line of executable code.

- **Headings:** Should be set in tight tracking with an ultra-bold weight. Use uppercase for Section Headers to emphasize the "System" feel.
- **Data/Labels:** All labels must be monospaced to ensure vertical alignment of characters, facilitating rapid scanning of numerical data.
- **Emphasis:** Instead of italics, use color shifts (e.g., changing a label from Green to Electric Blue) or thin underline deco-lines.

## Layout & Spacing

The layout follows a **Rigid Grid** philosophy, reminiscent of a command terminal. Everything is aligned to a 4px baseline grid to maintain mathematical precision.

- **Grid:** A 12-column system is used for desktop, shifting to a single-column stack for mobile. Gutters are kept tight (16px) to maximize data density.
- **Panels:** Layouts are composed of "Modular Clusters"—self-contained panels that resemble windowed terminal sessions.
- **Density:** High information density is encouraged. Use thin horizontal and vertical rules (1px) to separate content instead of excessive whitespace.

## Elevation & Depth

This system rejects soft shadows in favor of **Luminance and Opacity**.

- **Glassmorphism:** Use a `backdrop-filter: blur(12px)` on all floating panels. Backgrounds are `#000000` at 60-80% opacity.
- **Borders as Hierarchy:** Instead of shadows, use 1px solid borders. Higher priority elements have a brighter border (`#00FF41`) and a subtle outer glow. Lower priority elements use dimmed borders (`#00FF41` at 30% opacity).
- **Scanlines:** A global overlay of 2px horizontal lines at 5% opacity should be applied to all "elevated" surfaces to simulate a CRT monitor.

## Shapes

The shape language is **Sharp (0px)**. Roundness is perceived as "organic" and "soft," which contradicts the digital, programmed nature of the design system. 

All buttons, cards, and input fields must have perfectly square 90-degree corners. For specific "Call to Action" elements, a "clipped corner" effect (45-degree notch) can be used on the top-right and bottom-left to emphasize a military/tech aesthetic.

## Components

- **Buttons:** Sharp-edged boxes with 1px borders. Default state is a hollow border with a subtle glow; hover state fills the box with a solid green background and black text.
- **Input Fields:** Styled as "terminal prompts." Use a `>` character as a prefix. Active inputs feature a blinking vertical cursor block.
- **Progress Gauges:** Avoid standard circular loaders. Use horizontal segmented bars (bit-blocks) or radial "vector" dials that look like telemetry equipment.
- **Cards:** Referred to as "Data Clusters." They have no shadows. They use 1px borders and a subtle "Digital Rain" background pattern at 5% opacity.
- **Chips/Tags:** Minimalist tags in monospaced font, enclosed in brackets like `[ STATUS: ACTIVE ]`.
- **Navigation:** Vertical sidebars with "active node" indicators using the Electric Blue accent.