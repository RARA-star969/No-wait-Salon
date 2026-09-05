/** CSV/Excel export for the staff Customers directory. Pure formatting —
 *  every value it writes is passed in from already-fetched real data, never
 *  computed or fabricated here. */
import type { CustomerDirectoryEntry } from '../services/staffCustomersService';

export type ExportRange = 'today' | '30d' | 'all';

const EXPORT_COLUMNS = [
  'Customer name',
  'Phone',
  'Customer ID',
  'Total visits',
  'First visit',
  'Last visit',
  'New/Repeat',
  'Most-used service',
  'Usually served by',
  'Total spend (INR)',
  'Last payment method',
] as const;

function rangeStartMs(range: ExportRange, now = Date.now()): number {
  if (range === 'all') return 0;
  if (range === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start.getTime();
  }
  return now - 30 * 24 * 60 * 60_000;
}

export function filterByRange(customers: CustomerDirectoryEntry[], range: ExportRange, now = Date.now()): CustomerDirectoryEntry[] {
  const from = rangeStartMs(range, now);
  return customers.filter((customer) => customer.lastVisitAt >= from);
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

function customerRow(customer: CustomerDirectoryEntry): (string | number)[] {
  return [
    customer.name,
    customer.phone,
    customer.customerId,
    customer.totalVisits,
    formatDate(customer.firstVisitAt),
    formatDate(customer.lastVisitAt),
    customer.tag === 'repeat' ? 'Repeat' : 'New',
    customer.mostUsedService || '',
    customer.usualStaff || '',
    customer.totalSpendInr != null ? customer.totalSpendInr : '',
    customer.lastPaymentMethod || '',
  ];
}

function csvEscape(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildCustomersCsv(customers: CustomerDirectoryEntry[]): string {
  const lines = [EXPORT_COLUMNS.join(','), ...customers.map((customer) => customerRow(customer).map(csvEscape).join(','))];
  return lines.join('\n');
}

function xmlEscape(value: string | number): string {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** A real SpreadsheetML (Office 2003 XML) workbook — Excel opens this
 *  natively under a `.xls` name with no format-mismatch warning, without
 *  pulling in a binary xlsx-writing dependency for one export screen. */
export function buildCustomersExcelXml(customers: CustomerDirectoryEntry[]): string {
  const headerCells = EXPORT_COLUMNS.map((column) => `<Cell><Data ss:Type="String">${xmlEscape(column)}</Data></Cell>`).join('');
  const dataRows = customers
    .map((customer) => {
      const cells = customerRow(customer)
        .map((value) => `<Cell><Data ss:Type="${typeof value === 'number' ? 'Number' : 'String'}">${xmlEscape(value)}</Data></Cell>`)
        .join('');
      return `<Row>${cells}</Row>`;
    })
    .join('');
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Customers">
    <Table>
      <Row>${headerCells}</Row>
      ${dataRows}
    </Table>
  </Worksheet>
</Workbook>`;
}

export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
