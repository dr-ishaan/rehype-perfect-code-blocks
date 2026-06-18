// Allow Vite's ?raw import syntax for CSS files.
declare module '*.css?raw' {
  const css: string;
  export default css;
}
