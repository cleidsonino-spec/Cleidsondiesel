import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const ordersQuery = () =>
  queryOptions({
    queryKey: ["orders"],
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
