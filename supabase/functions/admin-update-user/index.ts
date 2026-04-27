import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Sem autorização" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (!callerProfile || !["admin", "manager"].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem gerenciar usuários" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { user_id, action, role, full_name, password, commission_rule_ids } = body;

    if (!user_id || !action) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: user_id, action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent self-demotion
    if (user_id === caller.id && action === "update_role") {
      return new Response(JSON.stringify({ error: "Você não pode alterar seu próprio perfil" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (action === "update_role") {
      const validRoles = ["admin", "manager", "consultant", "partner"];
      if (!role || !validRoles.includes(role)) {
        return new Response(JSON.stringify({ error: `Role inválido. Use: ${validRoles.join(", ")}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (commission_rule_ids !== undefined && !Array.isArray(commission_rule_ids)) {
        return new Response(JSON.stringify({ error: "commission_rule_ids deve ser um array de UUIDs" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updates: Record<string, string> = { role };
      if (full_name) updates.full_name = full_name;

      const { error } = await adminClient
        .from("profiles")
        .update(updates)
        .eq("id", user_id);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // If client sent commission_rule_ids, rewrite the user's rule associations
      // (delete-all-then-insert). Sending [] clears all associations.
      if (Array.isArray(commission_rule_ids)) {
        const { error: linkErr } = await adminClient
          .from("user_commission_rules")
          .delete()
          .eq("user_id", user_id);

        if (linkErr) {
          return new Response(JSON.stringify({ error: `Erro ao limpar regras antigas: ${linkErr.message}` }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (commission_rule_ids.length > 0) {
          const rows = commission_rule_ids.map((rule_id: string) => ({
            user_id,
            rule_id,
            created_by: caller.id,
          }));
          const { error: insErr } = await adminClient
            .from("user_commission_rules")
            .insert(rows);

          if (insErr) {
            return new Response(JSON.stringify({ error: `Erro ao vincular regras: ${insErr.message}` }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }

      return new Response(JSON.stringify({ success: true, action: "update_role" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_commission_rules") {
      if (!Array.isArray(commission_rule_ids)) {
        return new Response(JSON.stringify({ error: "commission_rule_ids deve ser um array de UUIDs" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: delErr } = await adminClient
        .from("user_commission_rules")
        .delete()
        .eq("user_id", user_id);

      if (delErr) {
        return new Response(JSON.stringify({ error: `Erro ao limpar regras antigas: ${delErr.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (commission_rule_ids.length > 0) {
        const rows = commission_rule_ids.map((rule_id: string) => ({
          user_id,
          rule_id,
          created_by: caller.id,
        }));
        const { error: insErr } = await adminClient
          .from("user_commission_rules")
          .insert(rows);

        if (insErr) {
          return new Response(JSON.stringify({ error: `Erro ao vincular regras: ${insErr.message}` }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(JSON.stringify({ success: true, action: "update_commission_rules" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "disable") {
      // Ban the user (prevents login)
      const { error } = await adminClient.auth.admin.updateUserById(user_id, {
        ban_duration: "876600h", // ~100 years
      });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, action: "disable" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "enable") {
      const { error } = await adminClient.auth.admin.updateUserById(user_id, {
        ban_duration: "none",
      });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, action: "enable" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset_password") {
      if (!password || password.length < 6) {
        return new Response(JSON.stringify({ error: "Senha deve ter pelo menos 6 caracteres" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await adminClient.auth.admin.updateUserById(user_id, { password });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, action: "reset_password" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
