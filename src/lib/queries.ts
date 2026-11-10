import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const ordersQuery = () =>
  queryOptions({
    queryKey: ["orders"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select("*")
        .order("number", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

export const orderQuery = (id: string) =>
  queryOptions({
    queryKey: ["orders", id],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase.from("service_orders").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const appointmentsQuery = () =>
  queryOptions({
    queryKey: ["appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .order("scheduled_date", { ascending: false })
        .order("scheduled_time", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

export const appointmentQuery = (id: string) =>
  queryOptions({
    queryKey: ["appointments", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("appointments").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });


export const customerOrdersQuery = (customerId: string) =>
  queryOptions({
    queryKey: ["orders", "customer", customerId],
    enabled: Boolean(customerId),
    queryFn: async () => {
      const pageSize = 500;
      const allOrders = [];
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await supabase
          .from("service_orders")
          .select("*")
          .eq("customer_id", customerId)
          .order("number", { ascending: false })
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        allOrders.push(...data);
        if (data.length < pageSize) return allOrders;
      }
    },
  });
