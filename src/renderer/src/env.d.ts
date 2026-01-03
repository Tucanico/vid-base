// This triple-slash directive is a TypeScript feature that brings in type definitions
// In this case, it includes Vite's client-side type definitions
// This allows TypeScript to understand Vite-specific features, such as:
//  - Importing assets like .svg, .png, etc., directly into your code
//  - Accessing environment variables under `import.meta.env`
/// <reference types="vite/client" />
