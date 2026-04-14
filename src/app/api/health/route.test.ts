import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSql = vi.fn();
const mockEnd = vi.fn();

vi.mock("postgres", () => ({
  default: () => {
    const sql = Object.assign(mockSql, { end: mockEnd });
    return sql;
  },
}));

import { GET } from "./route";

describe("/api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  });

  it("returns 200 when database is reachable", async () => {
    mockSql.mockResolvedValueOnce([{ "?column?": 1 }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(mockEnd).toHaveBeenCalled();
  });

  it("returns 503 when database is unreachable", async () => {
    mockSql.mockRejectedValueOnce(new Error("Connection refused"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("error");
  });
});
