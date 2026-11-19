import { describe, expect, it } from 'vitest';
import { filterSupportTickets, type SupportTicketFilterRow } from '../lib/support-ticket-filters';

const tickets: SupportTicketFilterRow[] = [
  {
    id: 'ticket-urgent',
    subject: 'مشکل ورود',
    category: 'account',
    status: 'open',
    priority: 'urgent',
    requester_id: 'user-1',
    requester: { display_name: 'ممد', username: 'mmd' },
  },
  {
    id: 'ticket-normal',
    subject: 'پرسش فنی',
    category: 'technical',
    status: 'in_progress',
    priority: 'normal',
    requester_id: 'user-2',
    requester: { display_name: 'کاربر دوم', username: 'second_user' },
  },
  {
    id: 'ticket-closed',
    subject: 'درخواست بسته‌شده',
    category: 'other',
    status: 'closed',
    priority: 'low',
    requester_id: 'user-3',
    requester: null,
  },
];

describe('support ticket filtering', () => {
  it('returns all tickets when no filters are selected', () => {
    expect(filterSupportTickets(tickets, { staff: true })).toHaveLength(3);
  });

  it('searches ticket subject, requester identity, category, and ID', () => {
    expect(filterSupportTickets(tickets, { search: 'MMD' }).map((ticket) => ticket.id)).toEqual(['ticket-urgent']);
    expect(filterSupportTickets(tickets, { search: 'ticket-normal' }).map((ticket) => ticket.id)).toEqual(['ticket-normal']);
    expect(filterSupportTickets(tickets, { search: 'technical' }).map((ticket) => ticket.id)).toEqual(['ticket-normal']);
  });

  it('filters by status and priority together for staff', () => {
    expect(filterSupportTickets(tickets, {
      status: 'open',
      priority: 'urgent',
      staff: true,
    }).map((ticket) => ticket.id)).toEqual(['ticket-urgent']);
    expect(filterSupportTickets(tickets, {
      status: 'open',
      priority: 'normal',
      staff: true,
    })).toEqual([]);
  });

  it('never applies staff-only priority filters to regular users', () => {
    expect(filterSupportTickets(tickets, {
      priority: 'urgent',
      staff: false,
    })).toHaveLength(3);
  });
});
