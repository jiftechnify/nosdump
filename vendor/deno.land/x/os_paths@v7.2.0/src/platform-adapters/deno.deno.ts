// spell-checker:ignore Deno

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as path from 'https://deno.land/std@0.134.0/path/mod.ts';

/* eslint-disable @typescript-eslint/ban-ts-comment */

// @ts-ignore
import { Platform } from './_base.ts';

// create a local reference to refer to `Deno` (for better linting without need for multiple `// @ts-ignore` directives)
// @ts-ignore
const deno = Deno;

// Deno general permission(s) at time of import
// * Deno.Permissions (stabilized in v1.8.0)
// * hack: b/c of missing sync permissions API, general initial permission(s) are used to avoid requiring async access to env()
// * ref: [Expose sync versions of Deno.permissions functions](https://github.com/denoland/deno/issues/6388)
const queryEnv = await deno?.permissions?.query({ name: 'env' });
const allowEnv = (queryEnv?.state ?? 'granted') === 'granted';

export const adapter: Platform.Adapter = {
	atImportPermissions: { env: allowEnv },
	env: {
		get: (s: string) => {
			return adapter.atImportPermissions.env ? deno.env.get(s) : void 0;
		},
	},
	// Deno (as of v1.6) has no built-in implementation for homedir() or tmpdir()
	os: {}, // * module is tolerant of missing homedir()/tmpdir() functions
	path,
	process: { platform: deno.build.os },
};

/* eslint-enable @typescript-eslint/ban-ts-comment */
