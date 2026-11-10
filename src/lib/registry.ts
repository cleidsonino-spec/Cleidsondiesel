import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const customersQuery = () => queryOptions({
  queryKey: ["customers"],
  queryFn: async () => {
    const { data, error } = await supabase.from("customers").select("*").order("name");
    if (error) throw error;
    return data;
  },
});
export const vehiclesQuery = () => queryOptions({
  queryKey: ["vehicles"],
  queryFn: async () => {
    const { data, error } = await supabase.from("vehicles").select("*").order("plate");
    if (error) throw error;
    return data;
  },
});