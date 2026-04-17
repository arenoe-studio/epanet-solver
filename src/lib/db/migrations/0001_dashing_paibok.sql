CREATE UNIQUE INDEX "transactions_order_id_unique" ON "transactions" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");