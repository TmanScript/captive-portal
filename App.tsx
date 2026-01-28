import React, { useState, useEffect, useCallback } from "react";
import {
  User,
  Mail,
  Phone,
  Lock,
  ChevronRight,
  CheckCircle2,
  Wifi,
  Zap,
  MessageSquare,
  Loader2,
  Database,
  ShoppingCart,
  Copy,
  Info,
  AlertTriangle,
  ShieldAlert,
  Globe,
  XCircle,
  RefreshCw,
} from "lucide-react";
import Input from "./components/Input";
import { RegistrationPayload, UsageResponse } from "./types";
import { DEFAULT_PLAN_UUID } from "./constants";
import {
  registerUser,
  requestOtp,
  verifyOtp,
  loginUser,
  getUsage,
} from "./services/api";

type Step = "REGISTRATION" | "OTP_VERIFY" | "LOGIN" | "USAGE_INFO" | "SUCCESS";

interface DomainStatus {
  domain: string;
  label: string;
  status: "checking" | "ok" | "blocked";
}

const App: React.FC = () => {
  const [step, setStep] = useState<Step>("LOGIN");
  const [formData, setFormData] = useState<RegistrationPayload>({
    username: "",
    email: "",
    password1: "",
    password2: "",
    first_name: "",
    last_name: "",
    phone_number: "",
    method: "mobile_phone",
    plan_pricing: DEFAULT_PLAN_UUID,
  });

  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [usageData, setUsageData] = useState<{
    remainingMB: string;
    hasData: boolean;
  } | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [showHelper, setShowHelper] = useState(true);

  // Diagnostic State
  const [diagnostics, setDiagnostics] = useState<DomainStatus[]>([
    { domain: "device.onetel.co.za", label: "Auth Server", status: "checking" },
    { domain: "esm.sh", label: "App Libraries", status: "checking" },
    { domain: "cdn.tailwindcss.com", label: "Styling", status: "checking" },
    {
      domain: "tmanscript.github.io",
      label: "Portal Host",
      status: "checking",
    },
  ]);

  const [uamParams, setUamParams] = useState({
    uamip: "192.168.182.1",
    uamport: "3990",
    challenge: "",
  });
  const [currentUrl, setCurrentUrl] = useState("");

  const runDiagnostics = useCallback(async () => {
    setDiagnostics((prev) => prev.map((d) => ({ ...d, status: "checking" })));

    const tests = diagnostics.map(async (d) => {
      try {
        // Use a mode: 'no-cors' trick to just check if the host is reachable at all
        // without triggering CORS blocks on simple ping
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        await fetch(`https://${d.domain}/favicon.ico`, {
          mode: "no-cors",
          signal: controller.signal,
          cache: "no-cache",
        });

        clearTimeout(timeoutId);
        return { ...d, status: "ok" as const };
      } catch (e) {
        return { ...d, status: "blocked" as const };
      }
    });

    const results = await Promise.all(tests);
    setDiagnostics(results);
  }, []);

  useEffect(() => {
    runDiagnostics();
    const interval = setInterval(runDiagnostics, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [runDiagnostics]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loginUrl = params.get("loginurl");
    let targetParams = params;

    if (loginUrl) {
      try {
        const decodedUrl = new URL(decodeURIComponent(loginUrl));
        targetParams = decodedUrl.searchParams;
      } catch (e) {}
    }

    const uamip =
      targetParams.get("uamip") || params.get("uamip") || "192.168.182.1";
    const uamport =
      targetParams.get("uamport") || params.get("uamport") || "3990";
    const challenge =
      targetParams.get("challenge") || params.get("challenge") || "";

    setUamParams({ uamip, uamport, challenge });
    setCurrentUrl(window.location.origin + window.location.pathname);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "username") {
      const sanitized = value.trim();
      setFormData((prev) => ({
        ...prev,
        username: sanitized,
        phone_number: sanitized,
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLoginData((prev) => ({ ...prev, [name]: value }));
  };

  const parseResponse = async (response: Response) => {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      return { detail: text || `Status ${response.status}` };
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    setIsNetworkError(false);

    try {
      const response = await loginUser(loginData);
      const data = await parseResponse(response);

      if (response.ok) {
        const token = data.token || data.key || data.token_key;
        setAuthToken(token);
        const usageRes = await getUsage(token);
        const usage: UsageResponse = await parseResponse(usageRes);

        if (usage.checks && usage.checks.length > 0) {
          const check = usage.checks[0];
          const remainingBytes = check.value - check.result;
          const remainingMB = (remainingBytes / (1024 * 1024)).toFixed(2);
          const hasData = remainingBytes > 0;
          setUsageData({ remainingMB, hasData });
          setStep("USAGE_INFO");
        } else {
          setStep("SUCCESS");
        }
      } else {
        setErrorMessage(data.detail || "Incorrect phone number or password.");
      }
    } catch (err) {
      setIsNetworkError(true);
      setErrorMessage(
        "Network Blocked: The hotspot router failed to reach the authentication server.",
      );
      runDiagnostics();
    } finally {
      setIsSubmitting(false);
    }
  };

  const connectToRouter = () => {
    const loginUrl = `http://${uamParams.uamip}:${uamParams.uamport}/logon`;
    const form = document.createElement("form");
    form.method = "GET";
    form.action = loginUrl;

    const params = {
      username: step === "SUCCESS" ? formData.username : loginData.username,
      password: step === "SUCCESS" ? formData.password1 : loginData.password,
    };

    Object.entries(params).forEach(([key, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = value;
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Walled Garden domains copied!");
  };

  const WALLED_GARDEN =
    "device.onetel.co.za,umoja.network.coova.org,tmanscript.github.io,github.io,esm.sh,cdn.tailwindcss.com,fonts.googleapis.com,fonts.gstatic.com,cdnjs.cloudflare.com";

  const renderContent = () => {
    if (step === "SUCCESS" || (step === "USAGE_INFO" && usageData?.hasData)) {
      return (
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center border-t-8 border-pink-500 animate-in zoom-in">
          <div className="mb-6 flex justify-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Authenticated!
          </h2>
          {usageData && (
            <div className="mb-6 p-4 bg-pink-50 rounded-2xl border border-pink-100">
              <p className="text-pink-600 font-bold text-lg">
                {usageData.remainingMB} MB Remaining
              </p>
              <p className="text-pink-400 text-xs uppercase tracking-widest font-black mt-1">
                Available Balance
              </p>
            </div>
          )}
          <p className="text-gray-600 mb-8">
            Your account is ready. Click below to activate your internet session
            on this router.
          </p>
          <button
            onClick={connectToRouter}
            className="w-full py-4 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-2xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
          >
            Activate Internet Now <Zap className="w-5 h-5" />
          </button>
        </div>
      );
    }

    return (
      <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-pink-100 relative">
        <div className="hidden lg:flex flex-col justify-between p-12 bg-pink-500 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-pink-400 opacity-20 rounded-full -mr-20 -mt-20 blur-3xl animate-pulse"></div>
          <div className="relative z-10">
            <h2 className="text-4xl font-bold leading-tight mb-6 text-white text-shadow-sm">
              High Speed WiFi Awaits
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-pink-600/30 p-3 rounded-xl border border-pink-400/30">
                <CheckCircle2 className="w-5 h-5 text-pink-200" />
                <span className="font-medium">
                  Direct RADIUS Authentication
                </span>
              </div>
              <div className="flex items-center gap-3 bg-pink-600/30 p-3 rounded-xl border border-pink-400/30">
                <CheckCircle2 className="w-5 h-5 text-pink-200" />
                <span className="font-medium">Real-time Usage Monitoring</span>
              </div>
              <div className="flex items-center gap-3 bg-pink-600/30 p-3 rounded-xl border border-pink-400/30">
                <CheckCircle2 className="w-5 h-5 text-pink-200" />
                <span className="font-medium">Instant Session Activation</span>
              </div>
            </div>
          </div>

          {/* Diagnostic Panel - Side */}
          <div className="relative z-10 bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-pink-100">
                Live Connection Health
              </p>
              <button
                onClick={runDiagnostics}
                className="text-pink-100 hover:text-white"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {diagnostics.map((d) => (
                <div
                  key={d.domain}
                  className="flex items-center gap-2 text-[9px] font-bold"
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      d.status === "ok"
                        ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]"
                        : d.status === "blocked"
                          ? "bg-red-400 animate-pulse"
                          : "bg-yellow-400"
                    }`}
                  />
                  <span className="truncate">{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-8 sm:p-12 flex flex-col justify-center bg-white">
          <div className="lg:hidden mb-6 flex items-center justify-between bg-pink-50 p-3 rounded-2xl border border-pink-100">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-pink-500" />
              <span className="text-[10px] font-bold text-gray-600 uppercase">
                System Status
              </span>
            </div>
            <div className="flex gap-1.5">
              {diagnostics.map((d) => (
                <div
                  key={d.domain}
                  className={`w-1.5 h-1.5 rounded-full ${d.status === "ok" ? "bg-green-500" : "bg-red-500 animate-pulse"}`}
                />
              ))}
            </div>
          </div>

          <h3 className="text-2xl font-bold mb-8 text-gray-900">
            Sign In to Onetel
          </h3>
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <Input
              label="Phone Number"
              name="username"
              type="tel"
              value={loginData.username}
              onChange={handleLoginChange}
              placeholder="+27..."
              icon={<Phone className="w-4 h-4" />}
              required
            />
            <Input
              label="Password"
              name="password"
              type="password"
              value={loginData.password}
              onChange={handleLoginChange}
              placeholder="••••••"
              icon={<Lock className="w-4 h-4" />}
              required
            />

            {isNetworkError && (
              <div className="bg-red-50 border-2 border-red-100 p-4 rounded-2xl animate-in shake duration-500">
                <div className="flex gap-3 items-start">
                  <ShieldAlert className="w-6 h-6 text-red-500 flex-shrink-0" />
                  <div>
                    <p className="text-red-700 font-bold text-[11px] uppercase mb-1">
                      Router Blocking Connection
                    </p>
                    <p className="text-red-600 text-[10px] leading-relaxed mb-3">
                      Your hotspot router is blocking the Onetel Auth Server.
                      This portal cannot verify your account without internet
                      access to the auth server.
                    </p>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(WALLED_GARDEN)}
                      className="w-full py-2 bg-red-100 hover:bg-red-200 text-red-700 font-bold text-[10px] rounded-lg border border-red-200 flex items-center justify-center gap-2"
                    >
                      <Copy className="w-3 h-3" /> Copy Admin Fix List
                    </button>
                  </div>
                </div>
              </div>
            )}

            {errorMessage && !isNetworkError && (
              <div className="text-red-600 text-[11px] leading-tight font-bold bg-red-50 p-3 rounded-xl border border-red-100 flex gap-2 items-center">
                <XCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-pink-500 text-white font-bold rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70 group"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Log In & Connect{" "}
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <button
            onClick={() => setStep("REGISTRATION")}
            className="w-full mt-8 text-pink-500 font-bold text-sm hover:underline"
          >
            New here? Create your account
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-[#fdf2f8]">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center p-4 bg-pink-500 rounded-[1.5rem] shadow-xl mb-4 transform -rotate-3">
          <Wifi className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-5xl font-black text-gray-900 tracking-tighter">
          ONETEL<span className="text-pink-500">.</span>
        </h1>
      </div>

      {renderContent()}

      {showHelper && (
        <div className="mt-8 max-w-xl w-full bg-white border-2 border-pink-100 rounded-[2rem] p-6 shadow-xl animate-in slide-in-from-bottom-8 duration-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-pink-500 rounded-full animate-ping"></div>
              <h4 className="text-[10px] font-black text-gray-800 uppercase tracking-widest">
                Router Connectivity Checklist
              </h4>
            </div>
            <button
              onClick={() => setShowHelper(false)}
              className="text-gray-400 hover:text-gray-600 font-bold text-[9px] uppercase tracking-tighter"
            >
              Dismiss
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {diagnostics.map((d) => (
                <div
                  key={d.domain}
                  className={`p-3 rounded-xl border flex items-center justify-between ${d.status === "ok" ? "bg-green-50 border-green-100" : d.status === "blocked" ? "bg-red-50 border-red-100" : "bg-gray-50 border-gray-100"}`}
                >
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-gray-800">
                      {d.label}
                    </span>
                    <span className="text-[8px] text-gray-400 font-mono truncate max-w-[120px]">
                      {d.domain}
                    </span>
                  </div>
                  {d.status === "ok" ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  )}
                </div>
              ))}
            </div>

            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <p className="text-[9px] font-bold text-gray-400 uppercase mb-2">
                Required Walled Garden List (uamallowed)
              </p>
              <div className="flex gap-2">
                <code className="text-[9px] font-mono text-gray-500 bg-white p-2 rounded-lg border border-gray-200 block truncate flex-1 leading-normal">
                  {WALLED_GARDEN}
                </code>
                <button
                  onClick={() => copyToClipboard(WALLED_GARDEN)}
                  className="p-2 bg-pink-500 text-white rounded-lg shadow-sm hover:bg-pink-600 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="mt-8 text-center text-gray-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
        <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
        Onetel Network • Gateway Core v3.0
      </p>
    </div>
  );
};

export default App;
