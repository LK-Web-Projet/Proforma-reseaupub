-- CreateTable
CREATE TABLE "public"."Gestionnaire" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telephone" TEXT,

    CONSTRAINT "Gestionnaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InvoiceGestionnaire" (
    "invoiceId" TEXT NOT NULL,
    "gestionnaireId" TEXT NOT NULL,

    CONSTRAINT "InvoiceGestionnaire_pkey" PRIMARY KEY ("invoiceId","gestionnaireId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Gestionnaire_email_key" ON "public"."Gestionnaire"("email");

-- AddForeignKey
ALTER TABLE "public"."InvoiceGestionnaire" ADD CONSTRAINT "InvoiceGestionnaire_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InvoiceGestionnaire" ADD CONSTRAINT "InvoiceGestionnaire_gestionnaireId_fkey" FOREIGN KEY ("gestionnaireId") REFERENCES "public"."Gestionnaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
