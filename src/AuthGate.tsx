import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, Building2, Cloud, KeyRound, LoaderCircle, LockKeyhole, LogOut, Mail, Plus, ShieldCheck, Smartphone, UserPlus } from "lucide-react";
import App from "./App";
import { assignLegacyVaultToCompany } from "./lib/local-db";
import { hasLegacyLocalRecords, prepareCompanyWorkspace, scopedStorageKey, supabase, type CompanyRole, type WorkspaceCompany } from "./lib/supabase";

type AuthMode = "signin" | "signup" | "reset";
type Membership = { company_id: string; role: CompanyRole };

export default function AuthGate() {
  const [checked, setChecked] = useState(false);
  const [localMode, setLocalMode] = useState(false);
  const [recoverySession, setRecoverySession] = useState(false);
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<AuthMode>("signin");
  const [emailInput, setEmailInput] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [memberships, setMemberships] = useState<WorkspaceCompany[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [activeCompany, setActiveCompany] = useState<WorkspaceCompany | null>(null);
  const [migrationCompany, setMigrationCompany] = useState<WorkspaceCompany | null>(null);

  const clearMessages = () => { setError(""); setInfo(""); };

  useEffect(() => {
    if (!supabase) {
      setChecked(true);
      return;
    }
    let active = true;
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      const current = data.session?.user;
      setUserId(current?.id || "");
      setEmail(current?.email || "");
      setEmailInput(current?.email || "");
      setChecked(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") setRecoverySession(true);
      const current = session?.user;
      setUserId(current?.id || "");
      setEmail(current?.email || "");
      setEmailInput(current?.email || "");
      if (!current) {
        setRecoverySession(false);
        setMemberships([]);
        setActiveCompany(null);
        setMigrationCompany(null);
        localStorage.removeItem("axivestra.activeCompanyId");
      }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const loadMemberships = useCallback(async () => {
    if (!supabase || !userId) return;
    setBusy(true);
    setError("");
    try {
      const { data: membershipsData, error: membershipError } = await supabase
        .from("company_memberships").select("company_id,role").eq("user_id", userId);
      if (membershipError) throw membershipError;
      const rows = (membershipsData || []) as Membership[];
      if (!rows.length) {
        setMemberships([]);
        return;
      }
      const { data: companiesData, error: companiesError } = await supabase
        .from("companies").select("id,name").in("id", rows.map(row => row.company_id));
      if (companiesError) throw companiesError;
      const companyById = new Map((companiesData || []).map(row => [row.id, row]));
      setMemberships(rows.flatMap(row => {
        const company = companyById.get(row.company_id);
        return company ? [{ id: company.id, name: company.name, role: row.role }] : [];
      }));
    } catch (cause) {
      setError("Could not load your company memberships. Confirm the AXIVESTRA SQL migrations are applied and retry. " + (cause instanceof Error ? cause.message : String(cause)));
    } finally {
      setBusy(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) void loadMemberships();
    else setMemberships([]);
  }, [userId, loadMemberships]);

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    clearMessages();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: emailInput.trim(), password });
        if (authError) throw authError;
        setInfo("Signed in. Loading company access…");
      } else if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({ email: emailInput.trim(), password });
        if (authError) throw authError;
        if (!data.session) {
          setInfo("Account created. Check your email to confirm it, then return here to sign in.");
          setMode("signin");
        } else {
          setInfo("Account created. You can now create a company or accept access from an existing owner.");
        }
      } else {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(emailInput.trim());
        if (authError) throw authError;
        setInfo("Password recovery instructions have been sent if the account exists.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const submitNewPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    clearMessages();
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setPassword("");
      setRecoverySession(false);
      await supabase.auth.signOut();
      setMode("signin");
      setInfo("Password updated. Sign in with your new password.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const createCompany = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    const name = companyName.trim();
    if (!name) { setError("Enter a company name."); return; }
    clearMessages();
    setBusy(true);
    try {
      const { data, error: createError } = await supabase.rpc("create_company_with_owner", { company_name: name });
      if (createError) throw createError;
      setCompanyName("");
      setInfo("Company created. Preparing its secure workspace…");
      await loadMemberships();
      const { data: membershipsData, error: membershipError } = await supabase.from("company_memberships").select("company_id,role").eq("user_id", userId);
      if (membershipError) throw membershipError;
      const rows = (membershipsData || []) as Membership[];
      const { data: companiesData, error: companyError } = await supabase.from("companies").select("id,name").in("id", rows.map(row => row.company_id));
      if (companyError) throw companyError;
      const companyById = new Map((companiesData || []).map(row => [row.id, row]));
      const company = rows.map(row => { const value=companyById.get(row.company_id); return value ? {id:value.id,name:value.name,role:row.role} as WorkspaceCompany : null; }).find(item => item?.id === data) || null;
      if (company) await openCompany(company, false);
    } catch (cause) {
      setError("Company creation failed. " + (cause instanceof Error ? cause.message : String(cause)));
    } finally {
      setBusy(false);
    }
  };

  const openCompany = async (company: WorkspaceCompany, importLegacy: boolean) => {
    if (!supabase || !userId) return;
    clearMessages();
    setBusy(true);
    try {
      localStorage.setItem("axivestra.activeCompanyId", company.id);
      await prepareCompanyWorkspace(company, userId, importLegacy);
      if (importLegacy && company.role !== "read_only") {
        // The vault is device-local and intentionally is not uploaded to cloud.
        // Migrate legacy file metadata and file bytes only after the user explicitly chooses import.
        const legacyDocumentMetadata = localStorage.getItem("estateflow.documents");
        const companyDocumentKey = scopedStorageKey(company.id, "estateflow.documents");
        if (legacyDocumentMetadata && localStorage.getItem(companyDocumentKey) === null) {
          localStorage.setItem(companyDocumentKey, legacyDocumentMetadata);
        }
        await assignLegacyVaultToCompany(company.id);
        // Migration is an explicit one-company assignment. Removing the legacy source prevents
        // later company switches from offering the same document metadata for a second import.
        localStorage.removeItem("estateflow.documents");
      }
      setMigrationCompany(null);
      setActiveCompany(company);
      setInfo("");
    } catch (cause) {
      localStorage.removeItem("axivestra.activeCompanyId");
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const chooseCompany = (company: WorkspaceCompany) => {
    const initialized = localStorage.getItem(scopedStorageKey(company.id, "estateflow.initialized")) === "1";
    // Read-only memberships must never be offered an import action that can change local
    // records. Open only their authorized company cloud snapshot and leave legacy data untouched.
    if (company.role !== "read_only" && !initialized && hasLegacyLocalRecords()) {
      setMigrationCompany(company);
      clearMessages();
      return;
    }
    void openCompany(company, false);
  };

  const signOut = async () => {
    setBusy(true);
    try { if (supabase) await supabase.auth.signOut(); }
    finally {
      setActiveCompany(null);
      setMigrationCompany(null);
      localStorage.removeItem("axivestra.activeCompanyId");
      setBusy(false);
    }
  };

  if (!supabase && !localMode) {
    return <div className="auth-shell"><div className="auth-card"><div className="auth-brand"><div className="auth-brand-mark">AX</div><div><strong>AXIVESTRA</strong><span>Asset Intelligence Platform</span></div></div><div className="auth-icon"><Smartphone size={25}/></div><span className="auth-kicker">LOCAL WORKSPACE</span><h1>Use AXIVESTRA on this device</h1><p className="auth-copy">Cloud login is not configured in this build. Your current workspace remains local to this device; it is not protected by cloud company isolation.</p><div className="auth-warning"><ShieldCheck size={18}/><div><strong>Cloud sign-in is not enabled</strong><span>Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to the build environment, then apply the Supabase migrations to enable account and company access.</span></div></div><button className="auth-primary" onClick={() => { localStorage.removeItem("axivestra.activeCompanyId"); setLocalMode(true); }}>Continue in local mode <ArrowRight size={17}/></button><a className="auth-link" href="https://github.com/imtboss007/property-management-system/blob/feature/estateflow-unified-whatsapp-automation/SUPABASE-AUTH-SETUP.md" target="_blank" rel="noreferrer">Open cloud setup guide</a></div></div>;
  }

  if (!supabase && localMode) return <App />;

  if (!checked) return <div className="auth-shell"><div className="auth-card auth-loading"><LoaderCircle className="auth-spinner" size={28}/><strong>Restoring secure session…</strong></div></div>;

  if (recoverySession && userId) {
    return <div className="auth-shell"><div className="auth-card"><div className="auth-brand"><div className="auth-brand-mark">AX</div><div><strong>AXIVESTRA</strong><span>Secure account recovery</span></div></div><div className="auth-icon"><KeyRound size={25}/></div><span className="auth-kicker">RESET PASSWORD</span><h1>Choose a new password.</h1><p className="auth-copy">Set a new password for {email || "your account"}. You will be signed out after the change and can sign back in.</p><form className="auth-form" onSubmit={submitNewPassword}><label>New password<div className="auth-input"><KeyRound size={17}/><input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event=>setPassword(event.target.value)} placeholder="At least 8 characters"/></div></label>{error && <div className="auth-error" role="alert">{error}</div>}{info && <div className="auth-info" role="status">{info}</div>}<button className="auth-primary" disabled={busy}>{busy ? <LoaderCircle className="auth-spinner" size={17}/> : <ShieldCheck size={17}/>} {busy ? "Updating password…" : "Update password"}</button></form></div></div>;
  }

  if (!userId) {
    return <div className="auth-shell"><div className="auth-card"><div className="auth-brand"><div className="auth-brand-mark">AX</div><div><strong>AXIVESTRA</strong><span>Secure workspace</span></div></div><div className="auth-icon"><LockKeyhole size={25}/></div><span className="auth-kicker">COMPANY ACCESS</span><h1>{mode === "signin" ? "Welcome back." : mode === "signup" ? "Create your account." : "Recover access."}</h1><p className="auth-copy">Your company workspace is protected by Supabase Auth and database row-level policies when configured by your administrator.</p><form className="auth-form" onSubmit={submitAuth}><label>Email address<div className="auth-input"><Mail size={17}/><input type="email" autoComplete="email" required value={emailInput} onChange={event=>setEmailInput(event.target.value)} placeholder="you@company.com"/></div></label>{mode !== "reset" && <label>Password<div className="auth-input"><KeyRound size={17}/><input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={event=>setPassword(event.target.value)} placeholder="At least 8 characters"/></div></label>}{error && <div className="auth-error" role="alert">{error}</div>}{info && <div className="auth-info" role="status">{info}</div>}<button className="auth-primary" disabled={busy}>{busy ? <LoaderCircle className="auth-spinner" size={17}/> : mode === "signin" ? <LockKeyhole size={17}/> : mode === "signup" ? <UserPlus size={17}/> : <Mail size={17}/>} {busy ? "Please wait…" : mode === "signin" ? "Sign in securely" : mode === "signup" ? "Create account" : "Send recovery email"}</button></form><div className="auth-links">{mode !== "signup" && <button onClick={()=>{setMode("signup");clearMessages();}}>Create an account</button>}{mode !== "signin" && <button onClick={()=>{setMode("signin");clearMessages();}}>Back to sign in</button>}{mode !== "reset" && <button onClick={()=>{setMode("reset");clearMessages();}}>Forgot password?</button>}</div><p className="auth-footnote"><ShieldCheck size={14}/> Never use your WhatsApp pairing code as your account password.</p></div></div>;
  }

  if (migrationCompany) {
    return <div className="auth-shell"><div className="auth-card"><div className="auth-brand"><div className="auth-brand-mark">AX</div><div><strong>AXIVESTRA</strong><span>Device-to-company migration</span></div></div><div className="auth-icon"><Cloud size={25}/></div><span className="auth-kicker">BACKUP BEFORE IMPORT</span><h1>Import this device's records?</h1><p className="auth-copy">This device has existing local records. Choose whether to copy them into <strong>{migrationCompany.name}</strong>. Existing cloud-only records are preserved and matching IDs use this device's version. This does not upload document file bytes or WhatsApp session credentials.</p>{error && <div className="auth-error" role="alert">{error}</div>}<button className="auth-primary" disabled={busy} onClick={()=>void openCompany(migrationCompany,true)}>{busy ? "Preparing…" : "Import and merge local records"} <ArrowRight size={17}/></button><button className="auth-secondary" disabled={busy} onClick={()=>void openCompany(migrationCompany,false)}>Use this company's cloud data</button><button className="auth-link-button" disabled={busy} onClick={()=>setMigrationCompany(null)}>Back to companies</button></div></div>;
  }

  if (activeCompany) {
    return <App company={activeCompany} userId={userId} onSignOut={signOut} onSwitchCompany={()=>{setActiveCompany(null);localStorage.removeItem("axivestra.activeCompanyId");}}/>;
  }

  return <div className="auth-shell auth-company-shell"><div className="auth-card auth-company-card"><div className="auth-brand"><div className="auth-brand-mark">AX</div><div><strong>AXIVESTRA</strong><span>Multi-company command workspace</span></div><button className="auth-signout" onClick={()=>void signOut()} disabled={busy}><LogOut size={15}/> Sign out</button></div><div className="auth-icon"><Building2 size={25}/></div><span className="auth-kicker">CHOOSE YOUR WORKSPACE</span><h1>Your companies.</h1><p className="auth-copy">Signed in as <strong>{email}</strong>. Each company uses a separate local cache and cloud record scope.</p>{error && <div className="auth-error" role="alert">{error}</div>}{info && <div className="auth-info" role="status">{info}</div>}<div className="auth-company-list">{memberships.map(company=><button className="auth-company-row" key={company.id} onClick={()=>chooseCompany(company)} disabled={busy}><span className="auth-company-icon"><Building2 size={19}/></span><span className="auth-company-details"><strong>{company.name}</strong><small>{company.role.replace("_"," ")} · cloud workspace</small></span><ArrowRight size={17}/></button>)}{memberships.length===0&&!busy&&<div className="auth-empty">No company access found. Create a company below or ask an existing owner to add your account.</div>}</div><form className="auth-create-company" onSubmit={createCompany}><label>Create a new company workspace</label><div className="auth-create-row"><input required maxLength={160} value={companyName} onChange={event=>setCompanyName(event.target.value)} placeholder="Company name"/><button className="auth-primary auth-create-button" disabled={busy}><Plus size={17}/> Create company</button></div><small>You'll be assigned as its owner. Other users must be added by an owner or admin.</small></form><button className="auth-link-button" disabled={busy} onClick={()=>void loadMemberships()}>{busy ? "Refreshing…" : "Refresh company access"}</button></div></div>;
}
