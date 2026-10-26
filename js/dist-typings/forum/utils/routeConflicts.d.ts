type RouteMap = Record<string, {
    path: string;
    component?: unknown;
    resolver?: unknown;
}>;
export declare function relocateRoutes(routes?: RouteMap, enabled?: (id: string) => boolean): string[];
export declare function yieldConflictingRoutes(routes?: RouteMap): string[];
export {};
