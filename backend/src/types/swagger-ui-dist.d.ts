/**
 * Minimal ambient declaration for `swagger-ui-dist/absolute-path`.
 *
 * `swagger-ui-dist` is published with no TypeScript types. Its
 * `absolute-path.js` is a single one-liner that resolves
 * `__dirname` to an absolute path. We only need the call
 * signature for the Swagger UI asset loader, so a focused
 * declaration is sufficient.
 *
 * `CommonJS` interop: the package uses `module.exports = function`,
 * so the imported binding is the function itself, not a
 * namespace. Importers should treat the default export as
 * callable.
 */
declare module 'swagger-ui-dist/absolute-path' {
  /**
   * Resolve the absolute filesystem path of the `swagger-ui-dist`
   * directory. Throws outside of Node.
   */
  function getAbsoluteSwaggerFsPath(): string;

  export default getAbsoluteSwaggerFsPath;
}