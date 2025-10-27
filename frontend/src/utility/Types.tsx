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

export const TicketType: Type = {
  name: "Ticket",
  cacheKey: (id: number) => ["ticket", id],
  hydatedCacheKey: (id: number) => ["hydrated-ticket", id],
  suggestedMutiCacheKeys: () => "/api/tickets",
  component: () => <div>Ticket</div>,
  backendRepresentation: EntityType.TICKET,
};

export const Types: Type[] = [TicketType];
