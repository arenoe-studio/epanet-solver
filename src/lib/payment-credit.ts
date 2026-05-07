import { sql } from "drizzle-orm";

import type { DbClient } from "@/lib/db";
import { transactions } from "@/lib/db/schema";

type CreditSelector = { orderId: string } | { transactionId: number };

export async function creditPaidTransaction(
  db: DbClient,
  selector: CreditSelector,
  paymentMethod?: string | null
) {
  const now = new Date();
  const whereClause =
    "orderId" in selector
      ? sql`${transactions.orderId} = ${selector.orderId}`
      : sql`${transactions.id} = ${selector.transactionId}`;

  const result = await db.execute(sql`
    with tx as (
      select
        id,
        user_id,
        coalesce(tokens, 0) as tokens
      from transactions
      where ${whereClause}
        and credited_at is null
    ),
    mark_paid as (
      update transactions
      set
        status = 'paid',
        payment_method = coalesce(${paymentMethod ?? null}, payment_method),
        paid_at = coalesce(paid_at, ${now}),
        credited_at = ${now}
      where id in (select id from tx)
      returning user_id, coalesce(tokens, 0) as tokens
    ),
    credit_balance as (
      insert into token_balances (user_id, balance, total_bought, total_used, updated_at)
      select user_id, tokens, tokens, 0, ${now}
      from mark_paid
      where user_id is not null and tokens > 0
      on conflict (user_id) do update
      set
        balance = coalesce(token_balances.balance, 0) + excluded.balance,
        total_bought = coalesce(token_balances.total_bought, 0) + excluded.total_bought,
        updated_at = excluded.updated_at
      returning user_id
    )
    select user_id, tokens from mark_paid
  `);

  return result.rows.length > 0;
}
