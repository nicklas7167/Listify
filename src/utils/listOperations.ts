import { supabase } from "@/integrations/supabase/client";

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("User not authenticated");
  }
  return user;
}

export async function createList(listName: string) {
  const user = await getCurrentUser();
  
  const { data, error } = await supabase
    .from("lists")
    .insert({
      name: listName,
      owner_id: user.id
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

interface List {
  id: string;
  name: string;
  created_at: string;
  owner_id: string;
  share_code: string;
}

export async function checkListExists(shareCode: string): Promise<List> {
  console.log("Checking list with share code:", shareCode);
  
  const { data, error } = await supabase
    .rpc('get_list_by_share_code', { p_share_code: shareCode })
    .single();

  if (error) {
    console.error("Error checking list existence:", error);
    throw new Error("Error checking list");
  }
  
  if (!data) {
    console.log("No list found with share code:", shareCode);
    throw new Error("List not found - please check the share code and try again");
  }

  console.log("Found list data:", data);
  return data as List;
}

export async function joinList(shareCode: string) {
  console.log("Starting join list process with share code:", shareCode);
  const user = await getCurrentUser();
  console.log("Current user:", user.id);
  
  try {
    // First, get the list ID from the share code
    const list = await checkListExists(shareCode);
    console.log("Found list with ID:", list.id);

    // Check if already a member
    const { data: existingMembership, error: membershipError } = await supabase
      .from("list_members")
      .select("*")
      .eq("list_id", list.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) {
      console.error("Error checking membership:", membershipError);
      throw membershipError;
    }

    if (existingMembership) {
      console.log("User is already a member");
      return { alreadyMember: true };
    }

    // Insert new membership using RPC to handle share code verification
    const { error: insertError } = await supabase
      .rpc('join_list_with_share_code', {
        p_list_id: list.id,
        p_user_id: user.id,
        p_share_code: shareCode
      });

    if (insertError) {
      console.error("Error inserting membership:", insertError);
      throw insertError;
    }

    console.log("Successfully joined list");
    return { alreadyMember: false };
  } catch (error) {
    console.error("Error in join list process:", error);
    throw error;
  }
}