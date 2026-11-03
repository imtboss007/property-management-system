export type CompanyRecordRow = {
  record_type: string;
  record_key: string;
  payload: Record<string, unknown> | null;
  updated_at?: string | null;
  deleted_at?: string | null;
};

type CompanyRecordQuery = {
  eq(column: string, value: string): CompanyRecordQuery;
  order(column: string, options?: { ascending?: boolean }): CompanyRecordQuery;
  range(from: number, to: number): PromiseLike<{
    data: CompanyRecordRow[] | null;
    error: { message: string } | null;
  }>;
};

type CompanyRecordClient = {
  from(table: string): {
    select(columns: string): CompanyRecordQuery;
  };
};

/**
 * Read every company row in bounded, deterministic pages. Supabase/PostgREST
 * response limits must never silently truncate a workspace or make old local
 * records overwrite cloud rows that were merely outside the first page.
 */
export async function fetchAllCompanyRecords(
  clientInput: unknown,
  companyId: string,
  pageSize = 500
): Promise<CompanyRecordRow[]> {
  // Keep the Supabase client's deeply generic fluent-builder types behind this
  // narrow boundary; the query shape is validated by this module's typed adapter.
  const client = clientInput as CompanyRecordClient;
  if (!client || typeof client.from !== "function") throw new Error("A company-record client is required.");
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 1000) {
    throw new Error("Company record page size must be between 1 and 1,000.");
  }
  const rows: CompanyRecordRow[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from("company_records")
      .select("record_type,record_key,payload,updated_at,deleted_at")
      .eq("company_id", companyId)
      .order("record_type", { ascending: true })
      .order("record_key", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) {
      throw new Error("Could not load company records at row " + offset + ": " + error.message);
    }
    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}
