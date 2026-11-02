# AXIVESTRA UI design references

The AXIVESTRA visual refresh uses the following repositories as design and component-system references. It does not replace the AXIVESTRA application or its data model.

1. [Magic UI](https://github.com/magicuidesign/magicui) — MIT. Reference patterns: animated gradients, bento-style composition, restrained motion, and visual hierarchy.
2. [shadcn/ui](https://github.com/shadcn-ui/ui) — MIT. Reference patterns: accessible controls, consistent component anatomy, focus states, and responsive primitives.
3. [React Bits](https://github.com/DavidHDev/react-bits) — MIT + Commons Clause. Reference only for motion and interaction ideas. AXIVESTRA does not bundle or port React Bits components because the additional Commons Clause restricts redistribution or sale of the components themselves.

## AXIVESTRA implementation

- Existing React, TypeScript, Lucide, CSS, Electron, and Capacitor architecture is retained.
- The new visual system is authored in AXIVESTRA styles; no complete external dashboard template is copied.
- The 3D histogram is an original SVG isometric renderer. It uses the same saved asset allocation, pipeline, and recorded cashflow values as the existing analytics layer.
- The histogram uses SVG rather than WebGL to preserve compatibility with Android WebView and lower-powered devices.
- Reduced-motion preferences, keyboard activation, responsive chart scrolling, and safe-area spacing are supported.
- No business-record schema, local storage key, sync collection, export contract, or permission rule is changed by the UI work.
