ALTER TYPE "InputConfigType" ADD VALUE 'DURABLE_OBJECT_INPUT';

CREATE TABLE "automation_durable_object_configs" (
    "id" TEXT NOT NULL,
    "automation_input_id" TEXT NOT NULL,
    "socket_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_durable_object_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "automation_durable_object_configs_automation_input_id_key" ON "automation_durable_object_configs"("automation_input_id");
CREATE UNIQUE INDEX "automation_durable_object_configs_socket_token_key" ON "automation_durable_object_configs"("socket_token");
CREATE INDEX "automation_durable_object_configs_socket_token_idx" ON "automation_durable_object_configs"("socket_token");

ALTER TABLE "automation_durable_object_configs" ADD CONSTRAINT "automation_durable_object_configs_automation_input_id_fkey" FOREIGN KEY ("automation_input_id") REFERENCES "automation_inputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
