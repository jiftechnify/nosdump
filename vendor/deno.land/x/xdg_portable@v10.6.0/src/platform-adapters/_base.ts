// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Platform {
	export type Adapter = {
		readonly atImportPermissions: {
			/** Is general environment access granted at module import time?
			- note: used for graceful degradation, but this grant is *required* for unimpaired module functionality
			- always `true` for non-Deno platforms
			*/
			readonly env?: boolean;
		};
		readonly env: {
			/** @function Returns the value of the named environment variable. */
			readonly get: (name: string) => string | undefined;
		};
		readonly osPaths: {
			/** @function Returns the path string of the user's home directory (or `undefined` if the user's home directory is not resolvable). */
			readonly home: () => string | undefined;
			/** @function Returns the path string of the system's default directory for temporary files. */
			readonly temp: () => string;
		};
		readonly path: {
			/** Path list delimiter */
			readonly delimiter: string;
			/** @function Returns all path segments, joined using the platform-specific separator, and normalized. */
			readonly join: (...paths: readonly string[]) => string;
			/** @function Returns the normalized path, resolving all `.` and `..` segments. */
			readonly normalize: (path: string) => string;
		};
		readonly process: {
			/** OS/platform identity string */
			readonly platform: string;
		};
	};
}
