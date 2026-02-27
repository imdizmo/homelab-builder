<system_role>
Act as an Expert Frontend Engineer and Elite UI/UX Designer specializing in premium, highly technical web applications and Pro-Tools. 
</system_role>

<task_instructions>
Your task is to implement the frontend UI/UX redesign for the "Homelab Builder" application based on the design specification provided below. 

Before writing the code, carefully consider and evaluate the constraints. Output a brief, step-by-step architectural plan for the components. Once the plan is established, provide the clean, modular frontend code (e.g., React/Vue components and CSS). Do not output unnecessary intermediate reasoning or filler text.
</task_instructions>

<implementation_guidelines>
- Architecture: Use a modular, component-driven approach. 
- Styling: Use modern CSS practices (CSS variables, Flexbox/Grid). 
- Consistency: The final design must feel singular and cohesive. Commit entirely to the "Solid & Precise" aesthetic.
- Negative Constraint Enforcement: ABSOLUTELY ZERO glassmorphism. Do not use backdrop-blur, frosted glass effects, or semi-transparent layered backgrounds. Use exclusively solid, opaque, matte materials.
- If I describes something that is not in the app ignore it, note it in the separate need_to_implement.md file. 
</implementation_guidelines>

<design_specification>
# UI/UX Redesign Documentation: Homelab Builder

**Objective:** Transition from a raw, engineering-focused look to a modern, luxurious interface in the style of a Web3 Pro-Tool (the "Solid & Precise" aesthetic).
**Core Principle:** ZERO glassmorphism. The focus is strictly on matte surfaces, sharp details, microscopic bezels/borders, and perfect typography.

## 1. Nodes / Device Cards
The current thick and bright borders must be completely removed. The card should look like a precisely cut piece of dark metal.
* **Background:** Solid, completely opaque, and very dark graphite/black (e.g., `#111113` or `#18181B`).
* **Border:** Extremely thin, 1-pixel border in a very subtle gray (e.g., `rgba(255, 255, 255, 0.08)` or `#27272A`).
* **Status Indicator:** Instead of outlining the entire card with color, apply only one of the following accents:
    * A thin (2px) strip of color (e.g., green for running, red for error) exclusively on the top edge of the card (`border-top`).
    * A glowing, small dot (LED dot) next to the device name.
* **Shadows:** No classic drop shadows that elevate the element. The card must lie completely "flat".

## 2. Workspace Canvas & Lighting
* **App Background:** A very deep shade (e.g., `#0B0B0E`), avoiding absolute black (`#000000`).
* **Grid:** Grid points must have drastically reduced visibility (opacity around 5-8%). They should form a barely noticeable texture.
* **Lighting (Spotlight Effect):** Instead of shadows on the cards, generate a subtle, radial gradient on the canvas background, positioned exactly *underneath* the active nodes. The card should look as if it's casting its own highly diffused light onto the canvas in the color of its status.

## 3. Layout & UI Controls (Side Panels)
* **Flat & Bordered:** Side panels and the top toolbar (e.g., "Library", "Resource Usage") must be completely flat.
* **Separation:** Separate panels from the canvas using only a sharp, one-pixel line (`border-right`, `border-bottom` in a color like `#27272A`). Do not use any box-shadows here.

## 4. Typography
Text hierarchy must rely on dramatic contrast.
* **Labels:** Texts like "IP:", "Cores:" should be small (e.g., 11-12px), in a muted gray (`#A1A1AA`), and use a modern, geometric sans-serif font (e.g., *Inter*, *Geist*, or *Plus Jakarta Sans*).
* **Values:** Technical data (e.g., `192.168.1.108`) must be bright white (`#FAFAFA`) and use a monospaced font (e.g., *JetBrains Mono* or *Fira Code*). This will give the interface a premium, technical, hacker aesthetic.
</design_specification>