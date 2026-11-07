export type ApprovalLink = { id: string; token: string; state: string; expires_at: string; approved_at: string | null; approved_by: string | null };
export function approvalUrl(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("Link inválido");
  return `https://cleidsondiesel.lovable.app/orcamento/${token}`;
}