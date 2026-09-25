import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const PROJECT_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PUBLIC_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const ADMIN_PANEL = Deno.env.get("PROXITI_PANEL_URL") || "https://humbertomennella.github.io/painel-proxiti/";
const ORIGINS = new Set([
  "https://proxiti.com.br",
  "https://www.proxiti.com.br",
  "https://humbertomennella.github.io",
  "https://central.proxiti.com.br"
]);
const admin = createClient(PROJECT_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const json = (data: unknown, code = 200, origin = "") =>
  new Response(JSON.stringify(data), { status: code, headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...(origin && ORIGINS.has(origin) ? { "access-control-allow-origin": origin, "vary": "Origin" } : {})
  } });
const clean = (v: unknown, max: number): string => typeof v === "string" ? v.trim().slice(0, max + 1) : "";
const validEmail = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
const validUuid = (s: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const bytesToHex = (data: Uint8Array): string => Array.from(data).map(n => n.toString(16).padStart(2, "0")).join("");
async function digest(text: string): Promise<string> {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))));
}
async function signedIdentity(value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SERVICE_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return bytesToHex(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}
function token(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(b).map(n => n.toString(16).padStart(2, "0")).join("");
}
async function limit(identity: string, hourly: boolean, max: number): Promise<boolean> {
  const now = new Date(), bucket = new Date(now);
  if (hourly) { bucket.setUTCMinutes(0, 0, 0); }
  else { bucket.setUTCHours(0, 0, 0, 0); }
  const hash = await signedIdentity(identity);
  const { data, error } = await admin.rpc("proxiti_consume_limit", { p_identity: hash, p_bucket: bucket.toISOString(), p_limit: max });
  if (error) throw error;
  return data === true;
}
async function checkTicket(id: string, secret: string) {
  if (!validUuid(id) || !/^[a-f0-9]{64}$/i.test(secret)) return null;
  const hash = await digest(secret);
  const { data, error } = await admin.from("support_tickets")
    .select("id,reference,subject,status,assigned_to,source,created_at")
    .eq("id", id).eq("access_hash", hash).maybeSingle();
  return error ? null : data;
}
async function onlineStaff() {
  const cutoff = new Date(Date.now() - 60000).toISOString();
  const { data, error } = await admin.from("staff_presence")
    .select("staff_id,last_seen,profiles!inner(role,status,permissions)")
    .gte("last_seen",cutoff).order("last_seen",{ascending:false}).limit(30);
  if (error) throw error;
  return (data ?? []).filter((x: any) => x.profiles?.status === "active" &&
    (x.profiles?.role === "administrator" || (x.profiles?.permissions?.chat === true && x.profiles?.permissions?.tickets_view === true)));
}


/** Aviso administrativo sem dados pessoais: ativado somente após cadastrar RESEND_API_KEY no Supabase. */
async function notifyAdministrators(reference: number, event: "created" | "customer_reply", eventId: string): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY") || "";
  if (!apiKey) return;
  try {
    const { data: profiles, error: listError } = await admin.from("profiles")
      .select("id").eq("role", "administrator").eq("status", "active").limit(5);
    if (listError) throw listError;
    const recipients: string[] = [];
    for (const profile of profiles || []) {
      const { data, error } = await admin.auth.admin.getUserById(profile.id);
      const address = data?.user?.email?.trim().toLowerCase();
      if (!error && address && validEmail(address)) recipients.push(address);
    }
    const to = [...new Set(recipients)];
    if (!to.length) { console.warn("PROXITI: nenhum administrador com e-mail para o aviso."); return; }
    const number = String(reference);
    const title = event === "created" ? "Novo chamado" : "Nova mensagem de cliente";
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json",
        "Idempotency-Key": "proxiti/" + event + "/" + eventId
      },
      body: JSON.stringify({
        from: "Central PROXITI <alertas@envios.proxiti.com.br>",
        to,
        subject: "[PROXITI] " + title + " #" + number,
        text: title + " no chamado #" + number + ".\n\nAcesse a Central Tecnica para visualizar e atender: " +
          ADMIN_PANEL + "\n\nEsta mensagem e automatica. Nao responda a este e-mail."
      }),
      signal: AbortSignal.timeout(4500)
    });
    if (!response.ok) console.warn("PROXITI: Resend retornou HTTP " + response.status + " ao enviar aviso.");
  } catch (error) {
    console.warn("PROXITI: aviso por e-mail indisponível (chamado preservado).",
      error instanceof Error ? error.name : "unknown");
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") {
    if (!ORIGINS.has(origin)) return json({ error: "Origem não autorizada." }, 403);
    return new Response(null, { status: 204, headers: {
      "access-control-allow-origin": origin, "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
      "access-control-max-age": "1800", "vary": "Origin"
    } });
  }
  // Clientes públicos autenticam sua conversa com token aleatório; equipe com JWT validado.
  if (req.method !== "POST" || !ORIGINS.has(origin)) return json({ error: "Requisição não autorizada." }, 403, origin);
  if (!PROJECT_URL || !SERVICE_KEY) return json({ error: "Serviço indisponível." }, 503, origin);
  if (Number(req.headers.get("content-length") || 0) > 12000) return json({ error: "Solicitação muito grande." }, 413, origin);
  let body: Record<string, unknown>;
  try { const raw = await req.text(); if (raw.length > 12000) throw new Error("large"); body = JSON.parse(raw); }
  catch { return json({ error: "Dados inválidos." }, 400, origin); }
  try {
    const action = clean(body.action, 30);
    if (action === "online") {
      const staff = await onlineStaff();
      return json({ online: staff.length }, 200, origin);
    }
    if (action === "invite") {
      const auth = req.headers.get("authorization") || "";
      if (!/^Bearer\s+[-\w.]+$/i.test(auth)) return json({ error: "Acesso não autorizado." }, 401, origin);
      const jwt = auth.replace(/^Bearer\s+/i, "");
      const { data: userData, error: userError } = await admin.auth.getUser(jwt);
      if (userError || !userData.user) return json({ error: "Sessão inválida." }, 401, origin);
      let assurance = "aal1";
      try {
        const raw = jwt.split(".")[1] || "";
        assurance = JSON.parse(atob(raw.replace(/-/g, "+").replace(/_/g, "/"))).aal || "aal1";
      } catch { return json({ error: "Token inválido." }, 401, origin); }
      if (assurance !== "aal2")
        return json({ error: "Ative e confirme a verificação em duas etapas em Meu perfil antes de convidar técnicos." }, 403, origin);
      const { data: profile } = await admin.from("profiles").select("role,status")
        .eq("id",userData.user.id).maybeSingle();
      if (profile?.role !== "administrator" || profile?.status !== "active")
        return json({ error: "Acesso não autorizado." }, 403, origin);
      const email = clean(body.email, 254).toLowerCase();
      if (!validEmail(email)) return json({ error: "E-mail inválido." }, 400, origin);
      if (!await limit("invite:" + userData.user.id, true, 8)) return json({ error: "Limite de convites atingido." }, 429, origin);
      const { error } = await admin.auth.admin.inviteUserByEmail(email,{ redirectTo: ADMIN_PANEL });
      if (error) return json({ error: "Não foi possível enviar o convite. Verifique o e-mail e as limitações do serviço." }, 409, origin);
      return json({ ok: true }, 200, origin);
    }
    if (action === "create") {
      // Campo honeypot, apenas para reduzir ruído. Não substitui o limite server-side.
      if (clean(body.company_website, 200)) return json({ ok: true }, 200, origin);
      if (body.privacy_accepted !== true) return json({ error: "Confirme a leitura do aviso de privacidade." }, 400, origin);
      const name = clean(body.name, 120), email = clean(body.email, 254).toLowerCase();
      const subject = clean(body.subject, 160), description = clean(body.description, 3000);
      const source = body.source === "chat" ? "chat" : "form";
      const phone = clean(body.phone, 40), serviceType = clean(body.service_type, 80);
      const impact = clean(body.impact, 120), customerType = clean(body.customer_type, 60);
      if (name.length < 2 || name.length > 120 || !validEmail(email) ||
        subject.length < 4 || subject.length > 160 || description.length < 8 || description.length > 3000)
        return json({ error: "Revise o nome, o e-mail e a descrição do atendimento." }, 400, origin);
      const network = (req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") ||
        (req.headers.get("x-forwarded-for") || "").split(",")[0] || "unknown").slice(0,100);
      if (!await limit("email:" + email, false, 5) || !await limit("ip:" + network, true, 12))
        return json({ error: "Limite de solicitações atingido. Utilize o contato direto da PROXITI." }, 429, origin);
      let assignedTo: string | null = null;
      if (source === "chat") {
        const staff = await onlineStaff();
        assignedTo = (staff.find((s: any) => s.profiles.role === "technician") || staff[0])?.staff_id ?? null;
      }
      const secret = token(), accessHash = await digest(secret);
      const { data: ticket, error } = await admin.from("support_tickets").insert({
        customer_name:name,customer_email:email,customer_phone:phone||null,subject,
        description,service_type:serviceType||null,impact:impact||null,customer_type:customerType||null,
        source,assigned_to:assignedTo,access_hash:accessHash
      }).select("id,reference,status,assigned_to").single();
      if (error || !ticket) throw error || new Error("ticket missing");
      const { error: msgError } = await admin.from("support_messages").insert({
        ticket_id:ticket.id,sender_kind:"customer",body:description
      });
      if (msgError) throw msgError;
      await notifyAdministrators(ticket.reference, "created", ticket.id);
      return json({
        ok:true,id:ticket.id,reference:ticket.reference,access_token:secret,
        status:ticket.status,online:!!assignedTo
      }, 201, origin);
    }
    if (action === "conversation" || action === "reply") {
      const ticketId = clean(body.ticket_id, 36), secret = clean(body.access_token, 64);
      const ticket = await checkTicket(ticketId,secret);
      if (!ticket) return json({ error: "Conversa não encontrada ou acesso expirado." }, 404, origin);
      if (action === "conversation") {
        const { data, error } = await admin.from("support_messages")
          .select("id,sender_kind,body,created_at").eq("ticket_id",ticketId)
          .order("created_at",{ascending:true}).limit(150);
        if (error) throw error;
        return json({ ticket:{reference:ticket.reference,subject:ticket.subject,status:ticket.status,online:!!ticket.assigned_to},messages:data||[] },200,origin);
      }
      const content = clean(body.message, 2000);
      if (!content || content.length>2000 || ticket.status==="closed")
        return json({ error: "Não é possível enviar essa mensagem." },400,origin);
      if (!await limit("msg:"+ticketId, true, 30)) return json({ error: "Limite de mensagens atingido. Aguarde um pouco." },429,origin);
      const { data: reply, error } = await admin.from("support_messages").insert({
        ticket_id:ticketId,sender_kind:"customer",body:content
      }).select("id").single();
      if (error || !reply) throw error || new Error("message missing");
      if (ticket.status === "resolved") await admin.from("support_tickets").update({status:"triage",updated_at:new Date().toISOString()}).eq("id",ticketId);
      await notifyAdministrators(ticket.reference, "customer_reply", reply.id);
      return json({ok:true},200,origin);
    }
    return json({ error: "Operação desconhecida." },400,origin);
  } catch (error) {
    console.error("PROXITI support error",error instanceof Error ? error.message : "unknown");
    return json({ error: "Não foi possível concluir a operação agora." },500,origin);
  }
});
