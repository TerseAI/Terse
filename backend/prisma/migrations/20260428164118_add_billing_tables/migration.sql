-- CreateEnum
CREATE TYPE "OverageMode" AS ENUM ('soft', 'strict');

-- CreateTable
CREATE TABLE "billing_customers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "stripe_customer_id" TEXT,
    "overage_mode" "OverageMode" NOT NULL DEFAULT 'soft',
    "overage_cap_multiplier" DECIMAL(65,30) NOT NULL DEFAULT 2.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_customers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_customers_organization_id_key" ON "billing_customers"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_customers_stripe_customer_id_key" ON "billing_customers"("stripe_customer_id");

-- CreateIndex
CREATE INDEX "billing_customers_stripe_customer_id_idx" ON "billing_customers"("stripe_customer_id");
