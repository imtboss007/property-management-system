import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, Building2, Cloud, KeyRound, LoaderCircle, LockKeyhole, LogOut, Mail, Plus, ShieldCheck, UserPlus } from "lucide-react";
import App from "./App";
import { assignLegacyVaultToCompany } from "./lib/local-db";
import { isLocalOnlySelected, persistStorageMode } from "./lib/storage-mode";
import { hasLegacyLocalRecords, hasPersonalWorkspaceCache, prepareCompanyWorkspace, preparePersonalWorkspace, scopedStorageKey, supabase, type CompanyRole, type WorkspaceCompany } from "./lib/supabase";

type AuthMode = "signin" | "signup" | "reset";
type Membership = { company_id: string; role: CompanyRole };

// Always return hosted account emails to the permanent production website, not localhost.
const AUTH_REDIRECT_URL = "https://axivestra.pages.dev";

export default function AuthGate() {
  const [checked, setChecked] = useState(false);
  const [recoverySession, setRecoverySession] = useState(false);
  const [localOnlyAccess, setLocalOnlyAccess] = useState(isLocalOnlySelected);
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
  const [activePersonal, setActivePersonal] = useState(false);
  const [membershipsReady, setMembershipsReady] = useState(false);
  const [migrationCompany, setMigrationCompany] = useState<WorkspaceCompany | null>(null);
  const [migrationPersonal, setMigrationPersonal] = useState(false);

  const clearMessages = () => { setError(""); setInfo(""); };

  const continueLocalOnly = () => {
    try {
      persistStorageMode("local");
      clearMessages();
      setLocalOnlyAccess(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

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
        setActivePersonal(false);
        setMembershipsReady(false);
        setMigrationCompany(null);
        setMigrationPersonal(false);
        localStorage.removeItem("axivestra.activeCompanyId");
        localStorage.removeItem("axivestra.activePersonalUserId");
      }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const loadMemberships = useCallback(async () => {
    if (localOnlyAccess || !supabase || !userId) return;
    setBusy(true);
    setError("");
    try {
      const { data: membershipsData, error: membershipError } = await supabase
        .from("company_memberships").select("company_id,role").eq("user_id", userId);
      if (membershipError) throw membershipError;
      const rows = (membershipsData || []) as Membership[];
      if (!rows.length) {
        setMemberships([]);
        setMembershipsReady(true);
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
      setMembershipsReady(true);
    } catch (cause) {
      setError("Could not load your company memberships. " + (cause instanceof Error ? cause.message : String(cause)));
      setMembershipsReady(false);
    } finally {
      setBusy(false);
    }
  }, [userId, localOnlyAccess]);

  useEffect(() => {
    if (userId && !localOnlyAccess) { setMembershipsReady(false); void loadMemberships(); }
    else { setMemberships([]); setMembershipsReady(false); }
  }, [userId, localOnlyAccess, loadMemberships]);

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    clearMessages();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: emailInput.trim(), password });
        if (authError) throw authError;
        setInfo("Signed in. Opening your workspace…");
      } else if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({ email: emailInput.trim(), password, options: { emailRedirectTo: AUTH_REDIRECT_URL } });
        if (authError) throw authError;
        if (!data.session) {
          setInfo("Account created. Check your email to confirm it, then return here to sign in.");
          setMode("signin");
        } else {
          setInfo("Account created. Your private Personal Mode workspace is ready; Company Mode is optional.");
        }
      } else {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(emailInput.trim(), { redirectTo: AUTH_REDIRECT_URL });
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
      if (company) {
        if (hasPersonalWorkspaceCache(userId) || hasLegacyLocalRecords()) {
          setMigrationCompany(company);
          setInfo("");
        } else await openCompany(company, false);
      }
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
      const importingPersonalWorkspace = hasPersonalWorkspaceCache(userId);
      localStorage.removeItem("axivestra.activePersonalUserId");
      localStorage.setItem("axivestra.activeCompanyId", company.id);
      await prepareCompanyWorkspace(company, userId, importLegacy);
      if (importLegacy && company.role !== "read_only" && !importingPersonalWorkspace) {
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
      if (importLegacy) localStorage.setItem("axivestra.personalImportedIntoCompany." + userId + "." + company.id, "1");
      setMigrationCompany(null);
      setMigrationPersonal(false);
      setActivePersonal(false);
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
    const personalNotYetImported = Boolean(userId && hasPersonalWorkspaceCache(userId) && localStorage.getItem("axivestra.personalImportedIntoCompany." + userId + "." + company.id) !== "1");
    if (company.role !== "read_only" && (personalNotYetImported || (!initialized && hasLegacyLocalRecords()))) {
      setMigrationCompany(company);
      clearMessages();
      return;
    }
    void openCompany(company, false);
  };


  const openPersonal = async (importLegacy: boolean) => {
    if (!supabase || !userId) return;
    clearMessages();
    setBusy(true);
    try {
      localStorage.removeItem("axivestra.activeCompanyId");
      localStorage.setItem("axivestra.activePersonalUserId", userId);
      await preparePersonalWorkspace(userId, importLegacy);
      setMigrationPersonal(false);
      setMigrationCompany(null);
      setActiveCompany(null);
      setActivePersonal(true);
      setInfo("");
    } catch (cause) {
      localStorage.removeItem("axivestra.activePersonalUserId");
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally { setBusy(false); }
  };

  const choosePersonal = () => {
    if (!userId) return;
    if (!hasPersonalWorkspaceCache(userId) && hasLegacyLocalRecords()) {
      setMigrationPersonal(true);
      setMigrationCompany(null);
      clearMessages();
      return;
    }
    void openPersonal(false);
  };

  useEffect(() => {
    if (!localOnlyAccess && userId && membershipsReady && memberships.length === 0 && !activeCompany && !activePersonal && !migrationPersonal && !migrationCompany) {
      choosePersonal();
    }
  }, [localOnlyAccess, userId, membershipsReady, memberships.length, activeCompany, activePersonal, migrationPersonal, migrationCompany]);

  const openWorkspaceChooser = () => {
    setActivePersonal(false);
    setActiveCompany(null);
    localStorage.removeItem("axivestra.activePersonalUserId");
    localStorage.removeItem("axivestra.activeCompanyId");
    clearMessages();
  };

  const signOut = async () => {
    setBusy(true);
    try { if (supabase) await supabase.auth.signOut(); }
    finally {
      setActiveCompany(null);
      setActivePersonal(false);
      setMigrationCompany(null);
      setMigrationPersonal(false);
      localStorage.removeItem("axivestra.activeCompanyId");
      localStorage.removeItem("axivestra.activePersonalUserId");
      setBusy(false);
    }
  };

  // Local-first installs open straight into AXIVESTRA; Local Only does not wait for an account session.
  if (!supabase || localOnlyAccess) return <App />;

  if (!checked) return <div className="auth-shell"><div className="auth-card auth-loading"><LoaderCircle className="auth-spinner" size={28}/><strong>Restoring secure session…</strong></div></div>;

  if (recoverySession && userId) {
    return <div className="auth-shell"><div className="auth-card"><div className="auth-brand"><div className="auth-brand-mark"><img src="./axivestra-mark.svg" alt="AXIVESTRA logo"/></div><div><strong>AXIVESTRA</strong><span>Secure account recovery</span></div></div><div className="auth-icon"><KeyRound size={25}/></div><span className="auth-kicker">RESET PASSWORD</span><h1>Choose a new password.</h1><p className="auth-copy">Set a new password for {email || "your account"}. You will be signed out after the change and can sign back in.</p><form className="auth-form" onSubmit={submitNewPassword}><label>New password<div className="auth-input"><KeyRound size={17}/><input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event=>setPassword(event.target.value)} placeholder="At least 8 characters"/></div></label>{error && <div className="auth-error" role="alert">{error}</div>}{info && <div className="auth-info" role="status">{info}</div>}<button className="auth-primary" disabled={busy}>{busy ? <LoaderCircle className="auth-spinner" size={17}/> : <ShieldCheck size={17}/>} {busy ? "Updating password…" : "Update password"}</button></form></div></div>;
  }

  if (!userId) {
    return <div className="auth-shell"><div className="auth-card"><div className="auth-brand"><div className="auth-brand-mark"><img src="./axivestra-mark.svg" alt="AXIVESTRA logo"/></div><div><strong>AXIVESTRA</strong><span>Personal + company workspace</span></div></div><div className="auth-icon"><LockKeyhole size={25}/></div><span className="auth-kicker">SECURE ACCOUNT ACCESS</span><h1>{mode === "signin" ? "Welcome back." : mode === "signup" ? "Create your account." : "Recover access."}</h1><p className="auth-copy">Start with a private Personal Mode workspace. No company is required. Company Mode is optional and can be added later.</p><form className="auth-form" onSubmit={submitAuth}><label>Email address<div className="auth-input"><Mail size={17}/><input type="email" autoComplete="email" required value={emailInput} onChange={event=>setEmailInput(event.target.value)} placeholder="you@company.com"/></div></label>{mode !== "reset" && <label>Password<div className="auth-input"><KeyRound size={17}/><input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={event=>setPassword(event.target.value)} placeholder="At least 8 characters"/></div></label>}{error && <div className="auth-error" role="alert">{error}</div>}{info && <div className="auth-info" role="status">{info}</div>}<button className="auth-primary" disabled={busy}>{busy ? <LoaderCircle className="auth-spinner" size={17}/> : mode === "signin" ? <LockKeyhole size={17}/> : mode === "signup" ? <UserPlus size={17}/> : <Mail size={17}/>} {busy ? "Please wait…" : mode === "signin" ? "Sign in securely" : mode === "signup" ? "Create account" : "Send recovery email"}</button></form><div className="auth-links">{mode !== "signup" && <button onClick={()=>{setMode("signup");clearMessages();}}>Create an account</button>}{mode !== "signin" && <button onClick={()=>{setMode("signin");clearMessages();}}>Back to sign in</button>}{mode !== "reset" && <button onClick={()=>{setMode("reset");clearMessages();}}>Forgot password?</button>}</div><div className="auth-links"><button type="button" onClick={continueLocalOnly}>Continue without login · Local storage only</button></div><p className="auth-footnote"><ShieldCheck size={14}/> Local Only keeps records on this device. You can pair Android with Windows later for local-network sync; no account is required.</p></div></div>;
  }

  if (migrationCompany) {
    return <div className="auth-shell"><div className="auth-card"><div className="auth-brand"><div className="auth-brand-mark"><img src="./axivestra-mark.svg" alt="AXIVESTRA logo"/></div><div><strong>AXIVESTRA</strong><span>Device-to-company migration</span></div></div><div className="auth-icon"><Cloud size={25}/></div><span className="auth-kicker">BACKUP BEFORE IMPORT</span><h1>Import this device's records?</h1><p className="auth-copy">Your Personal Mode workspace or this device has existing records. Choose whether to copy them into <strong>{migrationCompany.name}</strong>. This is a copy: your Personal Mode records remain intact. Existing company cloud-only records are preserved. Document file bytes and WhatsApp session credentials are not uploaded.</p>{error && <div className="auth-error" role="alert">{error}</div>}<button className="auth-primary" disabled={busy} onClick={()=>void openCompany(migrationCompany,true)}>{busy ? "Preparing…" : "Import and merge local records"} <ArrowRight size={17}/></button><button className="auth-secondary" disabled={busy} onClick={()=>void openCompany(migrationCompany,false)}>Use this company's cloud data</button><button className="auth-link-button" disabled={busy} onClick={()=>setMigrationCompany(null)}>Back to companies</button></div></div>;
  }


  if (migrationPersonal) {
    return <div className="auth-shell"><div className="auth-card"><div className="auth-brand"><div className="auth-brand-mark"><img src="./axivestra-mark.svg" alt="AXIVESTRA logo"/></div><div><strong>AXIVESTRA</strong><span>Personal workspace setup</span></div></div><div className="auth-icon"><Cloud size={25}/></div><span className="auth-kicker">DEVICE DATA FOUND</span><h1>Bring your existing records?</h1><p className="auth-copy">This device already has AXIVESTRA records. You can copy those records into your private cloud workspace so they are available on any signed-in phone or PC. Original document files remain in the local document vault.</p>{error && <div className="auth-error" role="alert">{error}</div>}<button className="auth-primary" disabled={busy} onClick={()=>void openPersonal(true)}>{busy ? "Importing…" : "Import this device's records"} <ArrowRight size={17}/></button><button className="auth-secondary" disabled={busy} onClick={()=>void openPersonal(false)}>Start with personal cloud data</button><button className="auth-link-button" disabled={busy} onClick={()=>setMigrationPersonal(false)}>Back to workspace options</button></div></div>;
  }

  if (activeCompany) {
    return <App key={"company:" + activeCompany.id} company={activeCompany} userId={userId} onSignOut={signOut} onSwitchCompany={openWorkspaceChooser}/>;
  }

  if (activePersonal) {
    return <App key={"personal:" + userId} personalUserId={userId} userId={userId} onSignOut={signOut} onSwitchCompany={openWorkspaceChooser}/>;
  }

  return <div className="auth-shell auth-company-shell"><div className="auth-card auth-company-card"><div className="auth-brand"><div className="auth-brand-mark"><img src="./axivestra-mark.svg" alt="AXIVESTRA logo"/></div><div><strong>AXIVESTRA</strong><span>Choose your workspace</span></div><button className="auth-signout" onClick={()=>void signOut()} disabled={busy}><LogOut size={15}/> Sign out</button></div><div className="auth-icon"><UserPlus size={25}/></div><span className="auth-kicker">PERSONAL BY DEFAULT · COMPANY OPTIONAL</span><h1>Select your workspace.</h1><p className="auth-copy">Signed in as <strong>{email}</strong>. Personal Mode is private to your account. Company Mode is available when you need shared team access.</p>{error && <div className="auth-error" role="alert">{error}</div>}{info && <div className="auth-info" role="status">{info}</div>}<button className="auth-company-row personal-choice-row" onClick={choosePersonal} disabled={busy}><span className="auth-company-icon"><UserPlus size={19}/></span><span className="auth-company-details"><strong>Open Personal Workspace</strong><small>Private records · independent phone or PC · cloud sync</small></span><ArrowRight size={17}/></button><div className="auth-company-list"><h2 className="auth-workspace-subheading">Company Mode</h2>{memberships.map(company=><button className="auth-company-row" key={company.id} onClick={()=>chooseCompany(company)} disabled={busy}><span className="auth-company-icon"><Building2 size={19}/></span><span className="auth-company-details"><strong>{company.name}</strong><small>{company.role.replace("_"," ")} · shared cloud workspace</small></span><ArrowRight size={17}/></button>)}{memberships.length===0&&!busy&&<div className="auth-empty">You do not belong to a company. Personal Mode works independently.</div>}</div><form className="auth-create-company" onSubmit={createCompany}><label>Optional: create a company workspace</label><div className="auth-create-row"><input required maxLength={160} value={companyName} onChange={event=>setCompanyName(event.target.value)} placeholder="Company name"/><button className="auth-primary auth-create-button" disabled={busy}><Plus size={17}/> Create company</button></div><small>You remain the owner. Team members can be added later. Your personal workspace is not deleted or overwritten.</small></form><button className="auth-link-button" disabled={busy} onClick={()=>void loadMemberships()}>{busy ? "Refreshing…" : "Refresh company access"}</button></div></div>;
}
