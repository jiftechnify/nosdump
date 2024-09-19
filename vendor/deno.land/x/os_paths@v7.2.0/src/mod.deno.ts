// spell-checker:ignore Deno

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { Adapt } from '../dist/esm/lib/OSPaths.js';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import type { OSPaths } from '../dist/types/mod.d.ts';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { adapter } from './platform-adapters/deno.deno.ts';

const _: OSPaths = Adapt(adapter).OSPaths as OSPaths;

export type { OSPaths };
export default _;
