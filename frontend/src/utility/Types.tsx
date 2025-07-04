import { ReactNode } from "react";
import { EntityType } from "../shared/Entities";

export interface Type {
    name: string;
    cacheKey: (id: number) => [string, number];
    hydatedCacheKey?: (id: number) => [string, number];
    suggestedMutiCacheKeys?: (id: number) => string;
    component: (id: number) => ReactNode;
    backendRepresentation: EntityType;
}