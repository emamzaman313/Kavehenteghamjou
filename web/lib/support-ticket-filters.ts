export type SupportTicketFilterRow = {
  id: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  requester_id: string;
  requester?: { display_name?: string | null; username?: string | null } | null;
};

export type SupportTicketFilterOptions = {
  search?: string;
  status?: string;
  priority?: string;
  staff?: boolean;
};

function normalizeSearch(value: string): string {
  return value.trim().normalize('NFKC').toLocaleLowerCase();
}

export function filterSupportTickets<T extends SupportTicketFilterRow>(
  tickets: readonly T[],
  options: SupportTicketFilterOptions = {},
): T[] {
  const query = normalizeSearch(options.search ?? '');
  const status = options.status ?? 'all';
  const priority = options.priority ?? 'all';
  const staff = options.staff === true;

  return tickets.filter((ticket) => {
    if (status !== 'all' && ticket.status !== status) return false;
    if (staff && priority !== 'all' && ticket.priority !== priority) return false;
    if (!query) return true;

    const searchable = normalizeSearch([
      ticket.subject,
      ticket.requester?.display_name ?? '',
      ticket.requester?.username ?? '',
      ticket.requester_id,
      ticket.category,
      ticket.id,
    ].join(' '));

    return searchable.includes(query);
  });
}
