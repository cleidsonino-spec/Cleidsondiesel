import { pgTable, uuid, varchar, text, date, timestamp, numeric, integer, index, uniqueIndex } from "drizzle-orm/pg-core";

export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  document: varchar("document", { length: 30 }),
  phone: varchar("phone", { length: 30 }),
  email: varchar("email", { length: 255 }),
  address: text("address"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  documentUnique: uniqueIndex("customers_document_unique").on(table.document),
  nameIdx: index("customers_name_idx").on(table.name),
}));

export const vehicles = pgTable("vehicles", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "restrict" }),
  plate: varchar("plate", { length: 10 }).notNull(),
  make: varchar("make", { length: 80 }),
  model: varchar("model", { length: 100 }),
  year: integer("year"),
  engine: varchar("engine", { length: 100 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  plateUnique: uniqueIndex("vehicles_plate_unique").on(table.plate),
  customerIdx: index("vehicles_customer_idx").on(table.customerId),
}));

export const serviceOrders = pgTable("service_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderNumber: varchar("order_number", { length: 30 }).notNull().unique(),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "restrict" }),
  vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
  status: varchar("status", { length: 30 }).default("open").notNull(),
  description: text("description"),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  total: numeric("total", { precision: 12, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  customerIdx: index("service_orders_customer_idx").on(table.customerId),
  vehicleIdx: index("service_orders_vehicle_idx").on(table.vehicleId),
}));

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  serviceOrderId: uuid("service_order_id").notNull().references(() => serviceOrders.id, { onDelete: "restrict" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  method: varchar("method", { length: 40 }),
  status: varchar("status", { length: 30 }).default("pending").notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orderIdx: index("payments_order_idx").on(table.serviceOrderId),
}));

export const warranties = pgTable("warranties", {
  id: uuid("id").defaultRandom().primaryKey(),
  serviceOrderId: uuid("service_order_id").notNull().references(() => serviceOrders.id, { onDelete: "restrict" }),
  startsAt: date("starts_at").notNull(),
  endsAt: date("ends_at").notNull(),
  months: integer("months").default(3).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orderUnique: uniqueIndex("warranties_order_unique").on(table.serviceOrderId),
  endDateIdx: index("warranties_end_date_idx").on(table.endsAt),
}));
