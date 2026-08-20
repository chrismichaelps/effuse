/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

export { buildCatalogFromDocument, type CatalogBuild } from './build.js';
export {
	createCatalog,
	DEFAULT_IDENTITY_FIELD,
	REFERENCE_FIELD,
	type Catalog,
} from './catalog.js';
export { BUILT_IN_SCALARS } from './built-in-scalars.js';
export { unwrapType } from './named-type.js';
export { printCatalog } from './print.js';
export { mergeCatalogs, mergeCatalogsSafe } from './merge.js';
export {
	resolveCoordinate,
	type CoordinateTarget,
} from './resolve-coordinate.js';
export {
	ChangeSeverity,
	compareCatalogs,
	type CatalogChange,
} from './changes.js';
export { sortCatalog } from './sort.js';
