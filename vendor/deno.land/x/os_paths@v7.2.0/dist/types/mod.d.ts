/** `OSPaths` (API) Determine common OS/platform paths (home, temp, ...) */
interface OSPaths {
    /** Create an `OSPaths` object (a preceding `new` is optional). */
    (): OSPaths;
    /** Create an `OSPaths` object (`new` is optional). */
    new (): OSPaths;
    /** Returns the path string of the user's home directory (or `undefined` if the user's home directory is not resolvable). */
    home(): string | undefined;
    /** Returns the path string of the system's default directory for temporary files. */
    temp(): string;
}

declare const _: OSPaths;

export { OSPaths, _ as default };
