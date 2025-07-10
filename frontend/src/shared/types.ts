import { Ticket } from "./TicketSystem";

export type User = {
    id: string;
    email: string;
    display_name: string;
    github_username: string | null;
    is_placeholder: boolean;
  };

  export type ActivityEvent = {
    event_type: string;
    title: string;
    github_repository_owner_id: string;
    github_repository_name: string;
    created_at: Date;
    ticket_activity_events: TicketActivityEvent[];
  }

  export type TicketActivityEvent = {
    ticket: Ticket;
    event_type: string;
    title: string;
  }