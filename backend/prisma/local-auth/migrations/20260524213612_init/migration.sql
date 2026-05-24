-- CreateTable
CREATE TABLE "local_identities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "display_name" TEXT,
    "created_via" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "local_organizations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "local_memberships" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identity_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "roles" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "local_memberships_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "local_identities" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "local_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "local_organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "local_identities_email_key" ON "local_identities"("email");

-- CreateIndex
CREATE INDEX "local_memberships_identity_id_idx" ON "local_memberships"("identity_id");

-- CreateIndex
CREATE INDEX "local_memberships_organization_id_idx" ON "local_memberships"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "local_memberships_identity_id_organization_id_key" ON "local_memberships"("identity_id", "organization_id");
