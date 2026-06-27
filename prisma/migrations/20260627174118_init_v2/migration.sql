-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "numero" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT '',
    "fechaEmision" DATETIME NOT NULL,
    "proveedor" TEXT NOT NULL DEFAULT '',
    "total" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL DEFAULT '',
    "producto" TEXT NOT NULL,
    "cantidad" REAL NOT NULL,
    "valorUnit" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
