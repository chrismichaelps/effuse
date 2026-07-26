export {
	compareRoutePatterns,
	compileRoutePattern,
	matchRoutePattern,
	parseRoutePattern,
	resolveRoutePattern,
	type CompiledRoutePattern,
	type MatchedRouteParams,
	type RouteParamInput,
	type RoutePattern,
	type RoutePatternParam,
	type RoutePatternSegment,
} from './route-pattern.js';

export {
	createRouteTrie,
	matchRouteTrie,
	isTrieRoutable,
	type RouteTrie,
	type RouteTrieEntry,
	type RouteTrieMatch,
} from './route-trie.js';
